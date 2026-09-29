<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MarketplaceRequest;
use App\Models\Marketplace;

class MarketplaceController extends Controller
{
    public function index()
    {
        // fees dipakai form penjualan (estimasi biaya) dan halaman Pengaturan Fee.
        // sales_count dipakai untuk menampilkan jumlah penjualan per marketplace.
        return response()->json(
            Marketplace::with(['fees' => fn ($q) => $q->orderBy('id')])
                ->withCount('sales')
                ->orderBy('name')
                ->get()
        );
    }

    public function store(MarketplaceRequest $request)
    {
        $marketplace = Marketplace::create($request->validated());

        return response()->json(
            $marketplace->load('fees')->loadCount('sales'),
            201
        );
    }

    public function show(Marketplace $marketplace)
    {
        return response()->json(
            $marketplace->load('fees')->loadCount('sales')
        );
    }

    public function update(MarketplaceRequest $request, Marketplace $marketplace)
    {
        $marketplace->update($request->validated());

        return response()->json(
            $marketplace->load('fees')->loadCount('sales')
        );
    }

    public function destroy(Marketplace $marketplace)
    {
        // Marketplace yang sudah punya penjualan tidak boleh dihapus (histori profit harus utuh)
        if ($marketplace->sales()->exists()) {
            return response()->json([
                'message' => 'Marketplace ini sudah punya riwayat penjualan sehingga tidak bisa dihapus. '
                    . 'Nonaktifkan saja.',
            ], 409);
        }

        // Fee milik marketplace ini ikut terhapus (cascade di database)
        $marketplace->delete();

        return response()->json(['message' => 'Marketplace dihapus']);
    }
}
