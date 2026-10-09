<?php

namespace App\Services;

use App\Models\MarketplaceFee;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\StockHistory;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleService
{
    public function __construct(private MarketplaceFeeService $feeService)
    {
    }

    public function create(array $data): Sale
    {
        return DB::transaction(function () use ($data) {
            // Total qty diminta per variasi (baris ganda pada variasi yang sama dijumlahkan)
            $required = collect($data['items'])
                ->groupBy('product_variant_id')
                ->map(fn ($rows) => (int) $rows->sum('qty'));

            // Kunci baris variasi dengan urutan id tetap supaya tidak saling menunggu (deadlock)
            $variants = ProductVariant::with('product')
                ->whereIn('id', $required->keys())
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            // 1. Validasi stok cukup untuk semua variasi sebelum memproses apa pun
            foreach ($required as $variantId => $qty) {
                $variant = $variants->get($variantId);

                if (! $variant) {
                    throw ValidationException::withMessages([
                        'items' => 'Variasi produk tidak ditemukan.',
                    ]);
                }

                if ((int) $variant->stock < $qty) {
                    throw ValidationException::withMessages([
                        'items' => "Stok {$this->label($variant)} tidak mencukupi "
                            . "(tersisa {$variant->stock}, diminta {$qty}).",
                    ]);
                }
            }

            $totalSales = 0;
            $totalCost = 0;

            $sale = Sale::create([
                'order_number' => $data['order_number'],
                'marketplace_id' => $data['marketplace_id'],
                'sale_date' => $data['sale_date'],
                'status' => 'pending',
            ]);

            // 2. Buat sale_items, ambil HPP variasi sebagai snapshot, kurangi stok
            foreach ($data['items'] as $item) {
                $variant = $variants->get((int) $item['product_variant_id']);

                $qty = (int) $item['qty'];

                if (isset($item['subtotal'])) {
                    // Dari impor pesanan: harga paket sudah dibagi per varian, subtotal dipakai apa adanya
                    $subtotal = round((float) $item['subtotal'], 2);
                    $price = round($subtotal / max(1, $qty), 2);
                } else {
                    $price = (float) $item['selling_price'];
                    $subtotal = $qty * $price;
                }
                $costTotal = $qty * (float) $variant->purchase_price;

                $sale->items()->create([
                    'product_variant_id' => $variant->id,
                    'qty' => $qty,
                    'selling_price' => $price,
                    'cost_price' => $variant->purchase_price, // snapshot
                    'subtotal' => $subtotal,
                    'cost_total' => $costTotal,
                ]);

                $before = (int) $variant->stock;

                // decrement memperbarui stok di database sekaligus di objek $variant
                $variant->decrement('stock', $qty);

                StockHistory::create([
                    'product_variant_id' => $variant->id,
                    'type' => 'sale_out',
                    'qty' => -$qty,
                    'stock_before' => $before,
                    'stock_after' => $before - $qty,
                    'reference_type' => Sale::class,
                    'reference_id' => $sale->id,
                ]);

                $totalSales += $subtotal;
                $totalCost += $costTotal;
            }

            // 3. Hitung & snapshot marketplace fee yang aktif
            $marketplaceFeeTotal = 0;
            $activeFees = MarketplaceFee::where('marketplace_id', $sale->marketplace_id)
                ->where('is_active', true)
                ->get();

            foreach ($activeFees as $fee) {
                $amount = $this->feeService->calculate($fee, $totalSales);

                $sale->fees()->create([
                    'marketplace_fee_id' => $fee->id,
                    'name' => $fee->name,
                    'type' => $fee->type,
                    'value' => $fee->value,
                    'amount' => $amount,
                ]);

                $marketplaceFeeTotal += $amount;
            }

            $otherFee = (float) ($data['other_fee'] ?? 0);
            $profit = $totalSales - $totalCost - $marketplaceFeeTotal - $otherFee;

            $sale->update([
                'total_sales' => $totalSales,
                'total_cost' => $totalCost,
                'marketplace_fee' => $marketplaceFeeTotal,
                'other_fee' => $otherFee,
                'profit' => $profit,
            ]);

            return $sale->load(['marketplace', 'items.productVariant.product', 'fees']);
        });
    }

    public function complete(Sale $sale): Sale
    {
        $sale->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        return $sale;
    }

    /** Batal sebelum dikirim: semua stok kembali, status "cancelled". */
    public function cancel(Sale $sale): Sale
    {
        return $this->restock($sale, 'cancelled', 'sale_cancel_in');
    }

    /**
     * Retur (versi sederhana): seluruh pesanan diretur dan semua barang kembali ke stok.
     * Status jadi "returned", sehingga tidak dihitung lagi sebagai penjualan/laba di Dashboard.
     */
    public function markReturned(Sale $sale): Sale
    {
        return $this->restock($sale, 'returned', 'return_in');
    }

    private function restock(Sale $sale, string $status, string $historyType): Sale
    {
        return DB::transaction(function () use ($sale, $status, $historyType) {
            // Kunci baris penjualan dan cek ulang status, supaya stok tidak dikembalikan dua kali
            $sale = Sale::whereKey($sale->id)->lockForUpdate()->firstOrFail();

            if (in_array($sale->status, ['cancelled', 'returned'], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Stok pesanan ini sudah pernah dikembalikan.',
                ]);
            }

            $sale->load('items');

            foreach ($sale->items->sortBy('product_variant_id') as $item) {
                // Data penjualan lama (sebelum ada variasi) tidak punya variasi untuk dikembalikan stoknya
                if (! $item->product_variant_id) {
                    continue;
                }

                $variant = ProductVariant::lockForUpdate()
                    ->findOrFail($item->product_variant_id);

                $before = (int) $variant->stock;

                $variant->increment('stock', $item->qty);

                StockHistory::create([
                    'product_variant_id' => $variant->id,
                    'type' => $historyType,
                    'qty' => $item->qty,
                    'stock_before' => $before,
                    'stock_after' => $before + $item->qty,
                    'reference_type' => Sale::class,
                    'reference_id' => $sale->id,
                ]);
            }

            $sale->update(['status' => $status]);

            return $sale->load(['marketplace', 'items.productVariant.product', 'fees']);
        });
    }

    private function label(ProductVariant $variant): string
    {
        $options = collect([$variant->color, $variant->size])->filter()->implode(' / ');

        return trim(($variant->product?->name ?? 'Produk') . ' ' . $options);
    }
}
