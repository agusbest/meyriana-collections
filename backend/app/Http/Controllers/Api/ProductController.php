<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductRequest;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::query()
            ->with(['supplier:id,name', 'variants'])
            ->withCount('variants');

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhereHas('supplier', function ($supplierQuery) use ($search) {
                        $supplierQuery->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('variants', function ($variantQuery) use ($search) {
                        $variantQuery
                            ->where('color', 'like', "%{$search}%")
                            ->orWhere('size', 'like', "%{$search}%");
                    });
            });
        }

        // Filter per supplier: "supplier A punya produk apa saja"
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->boolean('all')) {
            return response()->json(
                $query->orderBy('name')->get()
            );
        }

        return response()->json(
            $query
                ->orderByDesc('id')
                ->paginate(20)
        );
    }

    public function store(ProductRequest $request)
    {
        $product = DB::transaction(function () use ($request) {
            $data = $request->validated();

            $product = Product::create([
                'supplier_id' => $data['supplier_id'],
                'sku' => $data['sku'],
                'name' => $data['name'],
                'category' => $data['category'] ?? null,
                'is_active' => $data['is_active'] ?? true,
            ]);

            $this->saveVariants($product, $request);

            return $product->load(['supplier:id,name', 'variants']);
        });

        return response()->json($product, 201);
    }

    public function show(Product $product)
    {
        return response()->json(
            $product->load(['supplier:id,name', 'variants'])
        );
    }

    public function update(ProductRequest $request, Product $product)
    {
        $product = DB::transaction(function () use ($request, $product) {
            $data = $request->validated();

            $product->update([
                'supplier_id' => $data['supplier_id'],
                'sku' => $data['sku'],
                'name' => $data['name'],
                'category' => $data['category'] ?? null,
                'is_active' => $data['is_active'] ?? true,
            ]);

            $this->saveVariants($product, $request);

            return $product->load(['supplier:id,name', 'variants']);
        });

        return response()->json($product);
    }

    public function destroy(Product $product)
    {
        // Produk yang sudah dipakai transaksi tidak boleh dihapus.
        if ($product->saleItems()->exists() || $product->purchaseItems()->exists()) {
            return response()->json([
                'message' => 'Produk ini sudah dipakai di transaksi sehingga tidak bisa dihapus. '
                    . 'Nonaktifkan saja lewat menu Edit.',
            ], 409);
        }

        $usedInListings = \App\Models\ListingComponent::whereIn(
            'product_variant_id',
            $product->variants()->pluck('id')
        )->exists();

        if ($usedInListings) {
            return response()->json([
                'message' => 'Produk ini dipakai di pemetaan Listing Marketplace. '
                    . 'Ubah pemetaannya dulu, atau nonaktifkan produknya saja.',
            ], 409);
        }

        DB::transaction(function () use ($product) {
            foreach ($product->variants as $variant) {
                if ($variant->image_path) {
                    Storage::disk('public')->delete($variant->image_path);
                }
            }

            $product->delete();
        });

        return response()->json([
            'message' => 'Produk dihapus',
        ]);
    }

    /**
     * Simpan/update semua variasi produk.
     *
     * Stok sengaja tidak disentuh karena stok berasal dari
     * transaksi pembelian dan penjualan.
     */
    private function saveVariants(Product $product, ProductRequest $request): void
    {
        $variants = $request->input('variants', []);
        $existingIds = [];

        foreach ($variants as $index => $variantData) {
            $variantId = $variantData['id'] ?? null;

            if ($variantId) {
                $variant = ProductVariant::where('product_id', $product->id)
                    ->findOrFail($variantId);

                $existingIds[] = $variant->id;

                $variant->update([
                    'color' => $variantData['color'] ?? null,
                    'size' => $variantData['size'] ?? null,
                    'purchase_price' => $variantData['purchase_price'] ?? 0,
                    'selling_price' => $variantData['selling_price'] ?? 0,
                    'is_active' => $variantData['is_active'] ?? true,
                ]);
            } else {
                $variant = ProductVariant::create([
                    'product_id' => $product->id,
                    'color' => $variantData['color'] ?? null,
                    'size' => $variantData['size'] ?? null,
                    'purchase_price' => $variantData['purchase_price'] ?? 0,
                    'selling_price' => $variantData['selling_price'] ?? 0,
                    'stock' => 0,
                    'is_active' => $variantData['is_active'] ?? true,
                ]);

                $existingIds[] = $variant->id;
            }

            $image = $request->file("variants.$index.image");

            if ($image) {
                if ($variant->image_path) {
                    Storage::disk('public')->delete($variant->image_path);
                }

                $variant->update([
                    'image_path' => $image->store(
                        'products/variants',
                        'public'
                    ),
                ]);
            }
        }

        /*
         * Variasi yang dihapus dari form tidak langsung dihapus dari DB.
         * Kita nonaktifkan agar histori transaksi tetap aman.
         */
        $product->variants()
            ->whereNotIn('id', $existingIds)
            ->update([
                'is_active' => false,
            ]);
    }

    /**
     * GET /api/products/{product}/profit
     */
    public function profit(Product $product)
    {
        $items = $product->saleItems()
            ->whereHas('sale', fn($q) => $q->where('status', 'completed'))
            ->with('sale.fees')
            ->get();

        $totalQty = $items->sum('qty');
        $totalSales = $items->sum('subtotal');
        $totalCost = $items->sum('cost_total');

        $marketplaceFee = 0;

        foreach ($items->groupBy('sale_id') as $saleItemsGroup) {
            $sale = $saleItemsGroup->first()->sale;

            if ($sale->total_sales > 0) {
                $productShare =
                    $saleItemsGroup->sum('subtotal')
                    / $sale->total_sales;

                $marketplaceFee +=
                    $sale->marketplace_fee * $productShare;
            }
        }

        return response()->json([
            'product' => $product->name,
            'total_qty' => $totalQty,
            'total_sales' => round($totalSales, 2),
            'total_cost' => round($totalCost, 2),
            'marketplace_fee' => round($marketplaceFee, 2),
            'profit' => round(
                $totalSales - $totalCost - $marketplaceFee,
                2
            ),
        ]);
    }
}
