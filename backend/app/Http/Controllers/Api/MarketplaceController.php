<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MarketplaceRequest;
use App\Models\Marketplace;

class MarketplaceController extends Controller
{
    public function index()
    {
        return response()->json(Marketplace::with('fees')->orderBy('name')->get());
    }

    public function store(MarketplaceRequest $request)
    {
        return response()->json(Marketplace::create($request->validated()), 201);
    }

    public function show(Marketplace $marketplace)
    {
        return response()->json($marketplace->load('fees'));
    }

    public function update(MarketplaceRequest $request, Marketplace $marketplace)
    {
        $marketplace->update($request->validated());

        return response()->json($marketplace);
    }

    public function destroy(Marketplace $marketplace)
    {
        $marketplace->delete();

        return response()->json(['message' => 'Marketplace dihapus']);
    }
}
