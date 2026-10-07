<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\OperationalExpenseRequest;
use App\Models\OperationalExpense;
use Illuminate\Http\Request;

class OperationalExpenseController extends Controller
{
    public function index(Request $request)
    {
        // "scope" = pencarian + rentang tanggal. Dipakai untuk ringkasan per kategori,
        // supaya pilihan kategori tetap terlihat walau salah satunya sedang difilter.
        $scope = OperationalExpense::query();

        if ($request->filled('search')) {
            $search = $request->search;

            $scope->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%");
            });
        }

        if ($request->filled('date_from')) {
            $scope->whereDate('expense_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $scope->whereDate('expense_date', '<=', $request->date_to);
        }

        $base = (clone $scope);

        if ($request->filled('category')) {
            $base->where('category', $request->category);
        }

        $summary = [
            'total' => (float) (clone $base)->sum('amount'),
            'count' => (clone $base)->count(),
            'by_category' => (clone $scope)
                ->select('category')
                ->selectRaw('SUM(amount) as total')
                ->selectRaw('COUNT(*) as count')
                ->groupBy('category')
                ->orderByDesc('total')
                ->limit(12)
                ->get()
                ->map(fn ($row) => [
                    'category' => $row->category,
                    'total' => (float) $row->total,
                    'count' => (int) $row->count,
                ])
                ->all(),
        ];

        // Semua kategori yang pernah dipakai (urut paling sering), untuk saran isian di form
        $categories = OperationalExpense::query()
            ->select('category')
            ->groupBy('category')
            ->orderByRaw('COUNT(*) DESC')
            ->pluck('category');

        $page = $base
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json(array_merge($page->toArray(), [
            'summary' => $summary,
            'categories' => $categories,
        ]));
    }

    public function store(OperationalExpenseRequest $request)
    {
        $data = $request->validated();
        $data['category'] = $this->canonicalCategory($data['category']);

        return response()->json(OperationalExpense::create($data), 201);
    }

    public function show(OperationalExpense $operationalExpense)
    {
        return response()->json($operationalExpense);
    }

    public function update(OperationalExpenseRequest $request, OperationalExpense $operationalExpense)
    {
        $data = $request->validated();
        $data['category'] = $this->canonicalCategory($data['category']);

        $operationalExpense->update($data);

        return response()->json($operationalExpense);
    }

    public function destroy(OperationalExpense $operationalExpense)
    {
        $operationalExpense->delete();

        return response()->json(['message' => 'Biaya dihapus']);
    }

    /**
     * Penulisan kategori disamakan dengan yang sudah ada ("kemasan" -> "Kemasan"),
     * supaya total per kategori tidak terpecah hanya karena beda huruf besar/kecil.
     * (Perbandingan tidak peka huruf besar/kecil pada kolase MySQL bawaan Laravel.)
     */
    private function canonicalCategory(string $category): string
    {
        $category = trim($category);

        return OperationalExpense::where('category', $category)->value('category') ?? $category;
    }
}
