<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaleRequest;
use App\Models\Sale;
use App\Services\SaleService;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    public function __construct(private SaleService $saleService) {}

    public function index(Request $request)
    {
        // items_count dipakai frontend untuk menampilkan jumlah item per pesanan
        $query = Sale::with('marketplace')->withCount('items');

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhereHas('marketplace', function ($marketplaceQuery) use ($search) {
                        $marketplaceQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }


        if ($request->filled('marketplace_id')) {
            $query->where('marketplace_id', $request->marketplace_id);
        }

        // Rentang tanggal dipakai bersama oleh Dashboard (filter) dan tombol Export
        if ($request->filled('date_from')) {
            $query->whereDate('sale_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('sale_date', '<=', $request->date_to);
        }

        $query->orderByDesc('sale_date')->orderByDesc('id');

        // Dipakai tombol Export: kirim SEMUA baris yang cocok filter, tanpa paginasi
        if ($request->boolean('all')) {
            return response()->json($query->get());
        }

        return response()->json($query->paginate(20));
    }

    public function store(SaleRequest $request)
    {
        $sale = $this->saleService->create($request->validated());

        return response()->json($sale, 201);
    }

    public function show(Sale $sale)
    {
        return response()->json(
            $sale->load(['marketplace', 'items.productVariant.product', 'fees'])
        );
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

    /**
     * POST /api/sales/{sale}/return
     */
    public function markReturned(Sale $sale)
    {
        if (! in_array($sale->status, ['pending', 'completed'], true)) {
            return response()->json(['message' => 'Hanya pesanan Diproses atau Dana Dicairkan yang bisa diretur'], 422);
        }

        return response()->json($this->saleService->markReturned($sale));
    }
}
