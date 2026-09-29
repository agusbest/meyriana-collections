<?php

namespace App\Services;

use App\Models\ProductVariant;
use App\Models\Purchase;
use App\Models\StockHistory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PurchaseService
{
    public function create(array $data): Purchase
    {
        return DB::transaction(function () use ($data) {
            $purchase = Purchase::create([
                'invoice_number' => $data['invoice_number']
                    ?? $this->generateInvoiceNumber($data['purchase_date']),
                'supplier_id' => $data['supplier_id'],
                'purchase_date' => $data['purchase_date'],
                'total_amount' => 0,
            ]);

            $total = $this->applyItems($purchase, $data['items']);

            $purchase->update([
                'total_amount' => $total,
            ]);

            return $purchase->load([
                'supplier',
                'items.productVariant.product',
            ]);
        });
    }

    /**
     * Edit pembelian.
     *
     * Stok hanya disesuaikan sebesar SELISIH antara jumlah lama dan jumlah baru
     * per variasi. Jadi mengganti invoice, tanggal, atau harga tidak menyentuh
     * stok, dan edit tetap bisa dilakukan walau sebagian stok sudah terjual.
     * Edit hanya ditolak kalau selisihnya membuat stok menjadi minus.
     */
    public function update(Purchase $purchase, array $data): Purchase
    {
        return DB::transaction(function () use ($purchase, $data) {
            $purchase->load('items');

            // Total qty per variasi (baris ganda pada variasi yang sama dijumlahkan)
            $oldQty = $purchase->items
                ->groupBy('product_variant_id')
                ->map(fn ($rows) => (int) $rows->sum('qty'));

            $newQty = collect($data['items'])
                ->groupBy('product_variant_id')
                ->map(fn ($rows) => (int) $rows->sum('qty'));

            // Kunci baris dengan urutan id yang tetap supaya tidak saling menunggu (deadlock)
            $variantIds = $oldQty->keys()
                ->merge($newQty->keys())
                ->unique()
                ->sort()
                ->values();

            foreach ($variantIds as $variantId) {
                $delta = $newQty->get($variantId, 0) - $oldQty->get($variantId, 0);

                if ($delta === 0) {
                    continue;
                }

                $variant = ProductVariant::with('product')
                    ->lockForUpdate()
                    ->findOrFail($variantId);

                $before = (int) $variant->stock;
                $after = $before + $delta;

                if ($after < 0) {
                    $label = trim(
                        ($variant->product?->name ?? 'Produk') . ' '
                        . collect([$variant->color, $variant->size])->filter()->implode(' / ')
                    );

                    throw new \RuntimeException(
                        "Perubahan tidak bisa disimpan: stok {$label} saat ini {$before}, "
                        . 'sedangkan pembelian dikurangi ' . abs($delta) . ' pcs. '
                        . 'Sebagian stok kemungkinan sudah terjual.'
                    );
                }

                $variant->update([
                    'stock' => $after,
                ]);

                StockHistory::create([
                    'product_variant_id' => $variant->id,
                    'type' => $delta > 0 ? 'purchase_in' : 'adjustment',
                    'qty' => $delta,
                    'stock_before' => $before,
                    'stock_after' => $after,
                    'reference_type' => Purchase::class,
                    'reference_id' => $purchase->id,
                ]);
            }

            $purchase->items()->delete();

            $purchase->update([
                'invoice_number' => $data['invoice_number'] ?? $purchase->invoice_number,
                'supplier_id' => $data['supplier_id'],
                'purchase_date' => $data['purchase_date'],
                'total_amount' => 0,
            ]);

            // Stok sudah disesuaikan di atas, jadi di sini hanya membuat baris item
            $total = $this->createItems($purchase, $data['items']);

            $purchase->update([
                'total_amount' => $total,
            ]);

            return $purchase->load([
                'supplier',
                'items.productVariant.product',
            ]);
        });
    }

    public function delete(Purchase $purchase): void
    {
        DB::transaction(function () use ($purchase) {
            $purchase->load('items');

            foreach ($purchase->items as $item) {
                $variant = ProductVariant::lockForUpdate()
                    ->findOrFail($item->product_variant_id);

                $before = (int) $variant->stock;
                $after = $before - $item->qty;

                if ($after < 0) {
                    throw new \RuntimeException(
                        "Pembelian tidak dapat dihapus karena stok variant {$variant->id} sudah terpakai."
                    );
                }

                $variant->update([
                    'stock' => $after,
                ]);

                StockHistory::create([
                    'product_variant_id' => $variant->id,
                    'type' => 'adjustment',
                    'qty' => -$item->qty,
                    'stock_before' => $before,
                    'stock_after' => $after,
                    'reference_type' => Purchase::class,
                    'reference_id' => $purchase->id,
                ]);
            }

            $purchase->delete();
        });
    }

    /**
     * Nomor invoice otomatis: INV-{tanggal pembelian}-{nomor urut per hari}
     * Contoh: INV-20260928-0001, INV-20260928-0002, ...
     * Harus dipanggil di dalam transaksi (baris terakhir dikunci).
     */
    private function generateInvoiceNumber(string $purchaseDate): string
    {
        $prefix = 'INV-' . Carbon::parse($purchaseDate)->format('Ymd') . '-';

        $last = Purchase::where('invoice_number', 'like', $prefix . '%')
            ->lockForUpdate()
            ->orderByDesc('invoice_number')
            ->value('invoice_number');

        $next = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Dipakai saat membuat pembelian baru: simpan item + tambah stok + catat histori.
     */
    private function applyItems(Purchase $purchase, array $items): float
    {
        $total = 0;

        foreach ($items as $item) {
            $variant = ProductVariant::lockForUpdate()
                ->findOrFail($item['product_variant_id']);

            $qty = (int) $item['qty'];
            $price = (float) $item['price'];
            $subtotal = $qty * $price;

            $purchase->items()->create([
                'product_variant_id' => $variant->id,
                'qty' => $qty,
                'price' => $price,
                'subtotal' => $subtotal,
            ]);

            $before = (int) $variant->stock;
            $after = $before + $qty;

            $variant->update([
                'stock' => $after,
            ]);

            StockHistory::create([
                'product_variant_id' => $variant->id,
                'type' => 'purchase_in',
                'qty' => $qty,
                'stock_before' => $before,
                'stock_after' => $after,
                'reference_type' => Purchase::class,
                'reference_id' => $purchase->id,
            ]);

            $total += $subtotal;
        }

        return $total;
    }

    /**
     * Hanya menyimpan baris item (tanpa mengubah stok) dan mengembalikan totalnya.
     */
    private function createItems(Purchase $purchase, array $items): float
    {
        $total = 0;

        foreach ($items as $item) {
            $qty = (int) $item['qty'];
            $price = (float) $item['price'];
            $subtotal = $qty * $price;

            $purchase->items()->create([
                'product_variant_id' => (int) $item['product_variant_id'],
                'qty' => $qty,
                'price' => $price,
                'subtotal' => $subtotal,
            ]);

            $total += $subtotal;
        }

        return $total;
    }
}
