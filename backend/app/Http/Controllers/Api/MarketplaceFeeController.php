<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MarketplaceFeeRequest;
use App\Models\Marketplace;
use App\Models\MarketplaceFee;

class MarketplaceFeeController extends Controller
{
    public function index(Marketplace $marketplace)
    {
        return response()->json($marketplace->fees()->orderBy('id')->get());
    }

    public function store(MarketplaceFeeRequest $request, Marketplace $marketplace)
    {
        $fee = $marketplace->fees()->create($request->validated());

        return response()->json($fee, 201);
    }

    public function update(MarketplaceFeeRequest $request, MarketplaceFee $fee)
    {
        $fee->update($request->validated());

        return response()->json($fee);
    }

    /**
     * Aman dihapus: penjualan lama menyimpan salinan fee (sale_fees) sendiri,
     * jadi histori profit tidak berubah.
     */
    public function destroy(MarketplaceFee $fee)
    {
        $fee->delete();

        return response()->json(['message' => 'Fee dihapus']);
    }
}
