<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaleRequest;
use App\Models\Sale;
use App\Services\SaleService;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    public function __construct(private SaleService $saleService)
    {
    }

    public function index(Request $request)
    {
        $query = Sale::with(['marketplace', 'items.product']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('marketplace_id')) {
            $query->where('marketplace_id', $request->marketplace_id);
        }

        return response()->json($query->latest()->paginate(20));
    }

    public function store(SaleRequest $request)
    {
        $sale = $this->saleService->create($request->validated());

        return response()->json($sale, 201);
    }

    public function show(Sale $sale)
    {
        return response()->json($sale->load(['marketplace', 'items.product', 'fees']));
    }

    /**
     * POST /api/sales/{sale}/complete
     */
    public function complete(Sale $sale)
    {
        if ($sale->status !== 'pending') {
            return response()->json(['message' => 'Hanya transaksi pending yang bisa diselesaikan'], 422);
        }

        return response()->json($this->saleService->complete($sale));
    }

    /**
     * POST /api/sales/{sale}/cancel
     */
    public function cancel(Sale $sale)
    {
        if ($sale->status !== 'pending') {
            return response()->json(['message' => 'Hanya transaksi pending yang bisa dibatalkan'], 422);
        }

        return response()->json($this->saleService->cancel($sale));
    }
}
