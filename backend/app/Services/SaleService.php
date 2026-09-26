<?php

namespace App\Services;

use App\Models\MarketplaceFee;
use App\Models\Product;
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
            // 1. Validasi stok cukup untuk semua item sebelum memproses apa pun
            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                if ($product->stock < $item['qty']) {
                    throw ValidationException::withMessages([
                        'stock' => "Stok {$product->name} tidak mencukupi",
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

            // 2. Buat sale_items, ambil harga modal sebagai snapshot, kurangi stok
            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $subtotal = $item['qty'] * $item['selling_price'];
                $costTotal = $item['qty'] * (float) $product->purchase_price;

                $sale->items()->create([
                    'product_id' => $product->id,
                    'qty' => $item['qty'],
                    'selling_price' => $item['selling_price'],
                    'cost_price' => $product->purchase_price, // snapshot
                    'subtotal' => $subtotal,
                    'cost_total' => $costTotal,
                ]);

                $before = $product->stock;
                $product->decrement('stock', $item['qty']);

                StockHistory::create([
                    'product_id' => $product->id,
                    'type' => 'sale_out',
                    'qty' => -$item['qty'],
                    'stock_before' => $before,
                    'stock_after' => $before - $item['qty'],
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

            $otherFee = $data['other_fee'] ?? 0;
            $profit = $totalSales - $totalCost - $marketplaceFeeTotal - $otherFee;

            $sale->update([
                'total_sales' => $totalSales,
                'total_cost' => $totalCost,
                'marketplace_fee' => $marketplaceFeeTotal,
                'other_fee' => $otherFee,
                'profit' => $profit,
            ]);

            return $sale->load(['items', 'fees']);
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

    public function cancel(Sale $sale): Sale
    {
        return DB::transaction(function () use ($sale) {
            foreach ($sale->items as $item) {
                $product = $item->product;
                $before = $product->stock;
                $product->increment('stock', $item->qty);

                StockHistory::create([
                    'product_id' => $product->id,
                    'type' => 'sale_cancel_in',
                    'qty' => $item->qty,
                    'stock_before' => $before,
                    'stock_after' => $before + $item->qty,
                    'reference_type' => Sale::class,
                    'reference_id' => $sale->id,
                ]);
            }

            $sale->update(['status' => 'cancelled']);

            return $sale;
        });
    }
}
