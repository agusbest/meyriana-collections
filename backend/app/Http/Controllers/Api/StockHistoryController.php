<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockHistory;
use Illuminate\Http\Request;

class StockHistoryController extends Controller
{
    public function index(Request $request)
    {
        $query = StockHistory::with('productVariant.product');

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('product_variant_id')) {
            $query->where('product_variant_id', $request->product_variant_id);
        }

        // Cari berdasarkan nama produk, SKU, warna, atau ukuran
        if ($request->filled('search')) {
            $search = $request->search;

            $query->whereHas('productVariant', function ($variantQuery) use ($search) {
                $variantQuery
                    ->where('color', 'like', "%{$search}%")
                    ->orWhere('size', 'like', "%{$search}%")
                    ->orWhereHas('product', function ($productQuery) use ($search) {
                        $productQuery
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('sku', 'like', "%{$search}%");
                    });
            });
        }

        return response()->json(
            $query
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->paginate(30)
        );
    }
}
