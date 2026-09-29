<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PurchaseRequest;
use App\Models\Purchase;
use App\Services\PurchaseService;
use Illuminate\Http\Request;

class PurchaseController extends Controller
{
    public function __construct(
        private PurchaseService $purchaseService
    ) {}

    public function index(Request $request)
    {
        $query = Purchase::with([
            'supplier',
            'items.productVariant.product',
        ]);

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', function ($supplierQuery) use ($search) {
                        $supplierQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        return response()->json(
            $query->latest()->paginate(20)
        );
    }

    public function store(PurchaseRequest $request)
    {
        $purchase = $this->purchaseService->create(
            $request->validated()
        );

        return response()->json($purchase, 201);
    }

    public function show(Purchase $purchase)
    {
        return response()->json(
            $purchase->load([
                'supplier',
                'items.productVariant.product',
            ])
        );
    }

    public function update(
        PurchaseRequest $request,
        Purchase $purchase
    ) {
        try {
            $purchase = $this->purchaseService->update(
                $purchase,
                $request->validated()
            );

            return response()->json($purchase);
        } catch (\RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 409);
        }
    }

    public function destroy(Purchase $purchase)
    {
        try {
            $this->purchaseService->delete($purchase);

            return response()->json([
                'message' => 'Pembelian berhasil dihapus.',
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 409);
        }
    }
}
