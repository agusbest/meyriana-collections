<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PurchaseRequest;
use App\Models\Purchase;
use App\Services\PurchaseService;

class PurchaseController extends Controller
{
    public function __construct(private PurchaseService $purchaseService)
    {
    }

    public function index()
    {
        return response()->json(
            Purchase::with(['supplier', 'items.product'])->latest()->paginate(20)
        );
    }

    public function store(PurchaseRequest $request)
    {
        $purchase = $this->purchaseService->create($request->validated());

        return response()->json($purchase, 201);
    }

    public function show(Purchase $purchase)
    {
        return response()->json($purchase->load(['supplier', 'items.product']));
    }
}
