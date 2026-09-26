<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductRequest;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::query();

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('sku', 'like', "%{$request->search}%");
            });
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return response()->json($query->orderBy('name')->paginate(20));
    }

    public function store(ProductRequest $request)
    {
        $product = Product::create($request->validated());

        return response()->json($product, 201);
    }

    public function show(Product $product)
    {
        return response()->json($product);
    }

    public function update(ProductRequest $request, Product $product)
    {
        $product->update($request->validated());

        return response()->json($product);
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->json(['message' => 'Produk dihapus']);
    }

    /**
     * GET /api/products/{id}/profit
     * Profit per produk, hanya menghitung sale_items pada sale berstatus completed.
     */
    public function profit(Product $product)
    {
        $items = $product->saleItems()
            ->whereHas('sale', fn ($q) => $q->where('status', 'completed'))
            ->with('sale.fees')
            ->get();

        $totalQty = $items->sum('qty');
        $totalSales = $items->sum('subtotal');
        $totalCost = $items->sum('cost_total');

        // Alokasi marketplace fee secara proporsional terhadap kontribusi subtotal produk ini
        $marketplaceFee = 0;
        foreach ($items->groupBy('sale_id') as $saleItemsGroup) {
            $sale = $saleItemsGroup->first()->sale;
            if ($sale->total_sales > 0) {
                $productShare = $saleItemsGroup->sum('subtotal') / $sale->total_sales;
                $marketplaceFee += $sale->marketplace_fee * $productShare;
            }
        }

        return response()->json([
            'product' => $product->name,
            'total_qty' => $totalQty,
            'total_sales' => round($totalSales, 2),
            'total_cost' => round($totalCost, 2),
            'marketplace_fee' => round($marketplaceFee, 2),
            'profit' => round($totalSales - $totalCost - $marketplaceFee, 2),
        ]);
    }
}
