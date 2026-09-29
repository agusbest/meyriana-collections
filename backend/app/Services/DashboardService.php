<?php

namespace App\Services;

use App\Models\Marketplace;
use App\Models\Product;
use App\Models\Sale;

class DashboardService
{
    public function summary(array $filters): array
    {
        $baseQuery = Sale::query();
        $this->applyFilters($baseQuery, $filters);

        $completed = (clone $baseQuery)->where('status', 'completed');
        $pending = (clone $baseQuery)->where('status', 'pending');

        return [
            'total_products' => Product::count(),
            'total_stock' => (int) \App\Models\ProductVariant::sum('stock'),
            'total_sales' => (float) $completed->sum('total_sales'),
            'marketplace_fee' => (float) $completed->sum('marketplace_fee'),
            'real_profit' => (float) $completed->sum('profit'),
            'pending_transactions' => (clone $pending)->count(),
            'estimated_pending_profit' => (float) $pending->sum('profit'),
            'by_marketplace' => $this->byMarketplace($filters),
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
}
