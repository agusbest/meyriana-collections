<?php

namespace App\Services;

use App\Models\Sale;
use Carbon\CarbonImmutable;

/** Data grafik tren harian: omzet & laba pesanan yang sudah selesai (Dana Dicairkan). */
class DashboardTrendService
{
    private const MAX_DAYS = 366;

    public function daily(array $filters): array
    {
        $to = ! empty($filters['date_to'])
            ? CarbonImmutable::parse($filters['date_to'])->startOfDay()
            : CarbonImmutable::today()->endOfMonth()->startOfDay();

        $from = ! empty($filters['date_from'])
            ? CarbonImmutable::parse($filters['date_from'])->startOfDay()
            : $to->startOfMonth();

        if ($from->greaterThan($to)) {
            [$from, $to] = [$to, $from];
        }

        // Batasi rentang supaya grafik tetap terbaca
        if ($from->diffInDays($to) >= self::MAX_DAYS) {
            $from = $to->subDays(self::MAX_DAYS - 1);
        }

        $query = Sale::query()
            ->where('status', 'completed')
            ->whereDate('sale_date', '>=', $from->toDateString())
            ->whereDate('sale_date', '<=', $to->toDateString());

        if (! empty($filters['marketplace_id'])) {
            $query->where('marketplace_id', $filters['marketplace_id']);
        }

        $rows = $query
            ->selectRaw('DATE(sale_date) as day, SUM(total_sales) as omzet, SUM(profit) as laba, COUNT(*) as orders')
            ->groupByRaw('DATE(sale_date)')
            ->get()
            ->keyBy(fn ($row) => substr((string) $row->day, 0, 10));

        $days = [];

        for ($date = $from; $date->lessThanOrEqualTo($to); $date = $date->addDay()) {
            $key = $date->toDateString();
            $row = $rows->get($key);

            $days[] = [
                'date' => $key,
                'omzet' => round((float) ($row->omzet ?? 0), 2),
                'laba' => round((float) ($row->laba ?? 0), 2),
                'orders' => (int) ($row->orders ?? 0),
            ];
        }

        return [
            'date_from' => $from->toDateString(),
            'date_to' => $to->toDateString(),
            'days' => $days,
        ];
    }
}
