<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SupplierRequest;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
        // Untuk dropdown (form produk, filter produk): kirim semua supplier tanpa paginasi
        if ($request->boolean('all')) {
            return response()->json(Supplier::orderBy('name')->get(['id', 'name']));
        }

        // purchases_count & products_count dipakai frontend untuk tabel supplier
        $query = Supplier::withCount(['purchases', 'products']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('name')->paginate(20));
    }

    public function store(SupplierRequest $request)
    {
        return response()->json(Supplier::create($request->validated()), 201);
    }

    public function show(Supplier $supplier)
    {
        return response()->json($supplier);
    }

    public function update(SupplierRequest $request, Supplier $supplier)
    {
        $supplier->update($request->validated());

        return response()->json($supplier);
    }

    public function destroy(Supplier $supplier)
    {
        // Supplier yang sudah punya pembelian tidak boleh dihapus (histori pembelian harus utuh)
        if ($supplier->purchases()->exists()) {
            return response()->json([
                'message' => 'Supplier ini sudah punya riwayat pembelian sehingga tidak bisa dihapus.',
            ], 409);
        }

        // Supplier yang masih punya produk juga tidak boleh dihapus
        $productCount = $supplier->products()->count();

        if ($productCount > 0) {
            return response()->json([
                'message' => "Supplier ini masih punya {$productCount} produk. Pindahkan atau hapus produknya dulu.",
            ], 409);
        }

        $supplier->delete();

        return response()->json(['message' => 'Supplier dihapus']);
    }
}
