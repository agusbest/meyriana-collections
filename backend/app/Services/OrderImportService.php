<?php

namespace App\Services;

use App\Models\MarketplaceListing;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\StockHistory;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Impor file pesanan marketplace menjadi penjualan.
 * Stok dipotong per varian lewat SaleService (HPP & fee di-snapshot, tercatat di Histori Stok).
 */
class OrderImportService
{
    public function __construct(private SaleService $saleService)
    {
    }

    /** Cek dulu tanpa menyimpan apa pun. */
    public function preview(int $marketplaceId, array $orders, bool $autoAdjust): array
    {
        return $this->planner($marketplaceId)->plan($orders, $this->existing($marketplaceId, $orders), $autoAdjust);
    }

    public function import(int $marketplaceId, array $orders, bool $autoAdjust): array
    {
        $plan = $this->preview($marketplaceId, $orders, $autoAdjust);

        $imported = [];
        $completed = [];
        $failed = [];

        foreach ($plan['orders'] as $order) {
            if ($order['status'] === 'complete') {
                if ($this->markCompleted($marketplaceId, $order['order_number'])) {
                    $completed[] = $order['order_number'];
                } else {
                    $failed[] = ['order_number' => $order['order_number'], 'message' => 'Status penjualan sudah berubah, tidak ditandai selesai.'];
                }
                continue;
            }

            if ($order['status'] !== 'ready') {
                continue;
            }

            try {
                $sale = DB::transaction(fn () => $this->store($marketplaceId, $order, $autoAdjust));
                $imported[] = ['order_number' => $order['order_number'], 'sale_id' => $sale->id];
            } catch (ValidationException $e) {
                $failed[] = [
                    'order_number' => $order['order_number'],
                    'message' => collect($e->errors())->flatten()->first() ?? $e->getMessage(),
                ];
            } catch (QueryException $e) {
                // Biasanya nomor pesanan bentrok karena impor dijalankan bersamaan
                $failed[] = ['order_number' => $order['order_number'], 'message' => 'Gagal disimpan (nomor pesanan sudah ada?).'];
            } catch (Throwable $e) {
                report($e);
                $failed[] = ['order_number' => $order['order_number'], 'message' => 'Gagal disimpan.'];
            }
        }

        $plan['summary']['imported'] = count($imported);
        $plan['summary']['completed'] = count($completed);
        $plan['summary']['failed'] = count($failed);

        return [
            'summary' => $plan['summary'],
            'imported' => $imported,
            'completed' => $completed,
            'failed' => $failed,
            // pesanan yang dilewati beserta alasannya (tanpa detail item supaya respons kecil)
            'skipped' => collect($plan['orders'])
                ->whereNotIn('status', ['ready', 'complete'])
                ->map(fn ($o) => [
                    'order_number' => $o['order_number'],
                    'status' => $o['status'],
                    'message' => $o['message'],
                ])
                ->values(),
            'problems' => $plan['problems'],
            'shortages' => $plan['shortages'],
        ];
    }

    private function store(int $marketplaceId, array $order, bool $autoAdjust): Sale
    {
        if (Sale::where('order_number', $order['order_number'])->exists()) {
            throw ValidationException::withMessages(['order_number' => 'Nomor pesanan sudah ada.']);
        }

        $adjustmentIds = $autoAdjust ? $this->topUpStock($order['items']) : [];

        $sale = $this->saleService->create([
            'order_number' => $order['order_number'],
            'marketplace_id' => $marketplaceId,
            'sale_date' => $order['sale_date'],
            'other_fee' => 0,
            'items' => $order['items'],
        ]);

        if ($adjustmentIds) {
            // Penyesuaian stok ditautkan ke pesanan yang memicunya, supaya bisa dilacak di Histori Stok
            StockHistory::whereIn('id', $adjustmentIds)->update([
                'reference_type' => Sale::class,
                'reference_id' => $sale->id,
            ]);
        }

        if ($order['sale_status'] === 'completed') {
            $sale = $this->saleService->complete($sale);
        }

        return $sale;
    }

    /**
     * Stok kurang -> tambah sebesar kekurangannya (tipe "adjustment") supaya pesanan tetap tercatat.
     * Dihitung ulang dari stok di database saat ini, bukan dari hasil cek.
     */
    private function topUpStock(array $items): array
    {
        $required = collect($items)
            ->groupBy('product_variant_id')
            ->map(fn ($rows) => (int) $rows->sum('qty'));

        $variants = ProductVariant::whereIn('id', $required->keys())
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $ids = [];

        foreach ($variants as $variant) {
            $before = (int) $variant->stock;
            $short = $required[$variant->id] - $before;

            if ($short <= 0) {
                continue;
            }

            $variant->increment('stock', $short);

            $ids[] = StockHistory::create([
                'product_variant_id' => $variant->id,
                'type' => 'adjustment',
                'qty' => $short,
                'stock_before' => $before,
                'stock_after' => $before + $short,
            ])->id;
        }

        return $ids;
    }

    private function planner(int $marketplaceId): OrderImportPlanner
    {
        $listings = MarketplaceListing::where('marketplace_id', $marketplaceId)
            ->with('components.productVariant.product')
            ->get();

        $variants = [];

        $rows = $listings->map(function ($listing) use (&$variants) {
            foreach ($listing->components as $component) {
                $variant = $component->productVariant;

                if ($variant && ! isset($variants[$variant->id])) {
                    $options = collect([$variant->color, $variant->size])->filter()->implode(' / ');

                    $variants[$variant->id] = [
                        'stock' => (int) $variant->stock,
                        'cost' => (float) $variant->purchase_price,
                        'label' => trim(($variant->product?->name ?? 'Produk') . ' ' . $options),
                    ];
                }
            }

            return [
                'id' => $listing->id,
                'product_name' => $listing->product_name,
                'variation_name' => $listing->variation_name,
                'marketplace_sku' => $listing->marketplace_sku,
                'is_active' => (bool) $listing->is_active,
                'components' => $listing->components
                    ->filter(fn ($c) => $c->productVariant)
                    ->map(fn ($c) => ['product_variant_id' => $c->product_variant_id, 'qty' => (int) $c->qty])
                    ->values()
                    ->all(),
            ];
        })->all();

        return new OrderImportPlanner($rows, $variants);
    }

    /**
     * Nomor pesanan yang sudah ada => status penjualannya.
     * Milik marketplace lain diberi "other" supaya tidak ikut ditandai selesai.
     */
    private function existing(int $marketplaceId, array $orders): array
    {
        $numbers = collect($orders)
            ->pluck('order_number')
            ->map(fn ($n) => trim((string) $n))
            ->filter()
            ->unique()
            ->values();

        // Disusun manual (bukan flatMap) supaya nomor pesanan berupa angka tidak di-index ulang
        $existing = [];

        foreach ($numbers->chunk(500) as $chunk) {
            $sales = Sale::whereIn('order_number', $chunk->values())
                ->get(['order_number', 'status', 'marketplace_id']);

            foreach ($sales as $sale) {
                $existing[(string) $sale->order_number] = (int) $sale->marketplace_id === $marketplaceId
                    ? $sale->status
                    : 'other';
            }
        }

        return $existing;
    }

    /** Tandai selesai hanya kalau saat ini masih "pending" (dicek ulang dengan kunci baris). */
    private function markCompleted(int $marketplaceId, string $orderNumber): bool
    {
        return DB::transaction(function () use ($marketplaceId, $orderNumber) {
            $sale = Sale::where('order_number', $orderNumber)
                ->where('marketplace_id', $marketplaceId)
                ->lockForUpdate()
                ->first();

            if (! $sale || $sale->status !== 'pending') {
                return false;
            }

            $this->saleService->complete($sale);

            return true;
        });
    }
}
