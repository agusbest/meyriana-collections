<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\StockHistory;
use Illuminate\Support\Facades\DB;

class PurchaseService
{
    public function create(array $data): Purchase
    {
        return DB::transaction(function () use ($data) {
            $total = collect($data['items'])->sum(fn ($i) => $i['qty'] * $i['price']);

            $purchase = Purchase::create([
                'invoice_number' => $data['invoice_number'],
                'supplier_id' => $data['supplier_id'],
                'purchase_date' => $data['purchase_date'],
                'total_amount' => $total,
            ]);

            foreach ($data['items'] as $item) {
                $purchase->items()->create([
                    'product_id' => $item['product_id'],
                    'qty' => $item['qty'],
                    'price' => $item['price'],
                    'subtotal' => $item['qty'] * $item['price'],
                ]);

                $product = Product::findOrFail($item['product_id']);
                $before = $product->stock;
                $product->increment('stock', $item['qty']);

                StockHistory::create([
                    'product_id' => $product->id,
                    'type' => 'purchase_in',
                    'qty' => $item['qty'],
                    'stock_before' => $before,
                    'stock_after' => $before + $item['qty'],
                    'reference_type' => Purchase::class,
                    'reference_id' => $purchase->id,
                ]);
            }

            return $purchase->load('items');
        });
    }
}
