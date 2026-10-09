<?php

namespace App\Services;

use App\Models\Marketplace;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\OperationalExpense;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function summary(array $filters): array
    {
        $baseQuery = Sale::query();
        $this->applyFilters($baseQuery, $filters);

        $completed = (clone $baseQuery)->where('status', 'completed');
        $pending = (clone $baseQuery)->where('status', 'pending');
        $expensesApplied = empty($filters['marketplace_id']);
        $operationalExpenses = $expensesApplied ? $this->operationalExpenses($filters) : 0.0;

        return [
            'total_products' => Product::count(),
            'total_stock' => (int) \App\Models\ProductVariant::sum('stock'),
            'total_sales' => (float) $completed->sum('total_sales'),
            'marketplace_fee' => (float) $completed->sum('marketplace_fee'),
            'real_profit' => (float) $completed->sum('profit'),
            'operational_expenses' => $operationalExpenses,
            'expenses_applied' => $expensesApplied,
            'net_profit' => (float) $completed->sum('profit') - $operationalExpenses,
            'pending_transactions' => (clone $pending)->count(),
            'estimated_pending_profit' => (float) $pending->sum('profit'),
            'by_marketplace' => $this->byMarketplace($filters),
            // Nilai stok gudang saat ini (stok x HPP). Tidak ikut filter tanggal/marketplace.
            'stock_value' => (float) ProductVariant::where('stock', '>', 0)
                ->sum(DB::raw('stock * purchase_price')),

            // Varian yang masih ada stoknya tapi HPP belum diisi (nilai stok jadi kurang lengkap)
            'stock_without_hpp' => ProductVariant::where('stock', '>', 0)
                ->where('purchase_price', '<=', 0)
                ->count(),
        ];
    }

    /**
     * Breakdown profit per marketplace, untuk kartu "Performa Channel".
     */
    private function byMarketplace(array $filters): array
    {
        return Marketplace::query()
            ->withCount(['sales as completed_sales_count' => function ($q) use ($filters) {
                $q->where('status', 'completed');
                $this->applyFilters($q, $filters);
            }])
            ->with(['sales' => function ($q) use ($filters) {
                $q->where('status', 'completed');
                $this->applyFilters($q, $filters);
            }])
            ->get()
            ->map(function ($marketplace) {
                return [
                    'id' => $marketplace->id,
                    'name' => $marketplace->name,
                    'code' => $marketplace->code,
                    'omzet' => (float) $marketplace->sales->sum('total_sales'),
                    'fee' => (float) $marketplace->sales->sum('marketplace_fee'),
                    'profit' => (float) $marketplace->sales->sum('profit'),
                ];
            })
            ->filter(fn($m) => $m['omzet'] > 0) // hanya tampilkan channel yang punya transaksi
            ->sortByDesc('profit')
            ->values()
            ->all();
    }

    private function applyFilters($query, array $filters): void
    {
        if (! empty($filters['date_from'])) {
            $query->whereDate('sale_date', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('sale_date', '<=', $filters['date_to']);
        }

        if (! empty($filters['marketplace_id'])) {
            $query->where('marketplace_id', $filters['marketplace_id']);
        }
    }

    private function operationalExpenses(array $filters): float
    {
        $query = OperationalExpense::query();

        if (! empty($filters['date_from'])) {
            $query->whereDate('expense_date', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('expense_date', '<=', $filters['date_to']);
        }

        // Kategori yang sudah dihitung lewat Biaya per Pesanan tidak dipotong lagi
        $covered = \App\Models\AppSetting::packingCoveredCategories();
        if ($covered) {
            $query->whereRaw(
                'LOWER(category) NOT IN (' . implode(',', array_fill(0, count($covered), '?')) . ')',
                $covered
            );
        }

        return (float) $query->sum('amount');
    }
}
