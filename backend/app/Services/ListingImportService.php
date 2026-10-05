<?php

namespace App\Services;

use App\Models\MarketplaceListing;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ListingImportService
{
    /**
     * Simpan/perbarui listing dari file ekspor marketplace (sudah dibaca jadi array di frontend).
     * Kunci: marketplace + Kode Produk + Kode Variasi. Pemetaan (komponen) yang sudah ada tidak disentuh.
     *
     * @return array{total:int, created:int, updated:int, deactivated:int, skipped:int}
     */
    public function import(int $marketplaceId, array $rows, bool $deactivateMissing = true): array
    {
        return DB::transaction(function () use ($marketplaceId, $rows, $deactivateMissing) {
            // key "kodeProduk:kodeVariasi" => is_active (sebelum impor)
            $existing = MarketplaceListing::where('marketplace_id', $marketplaceId)
                ->get(['external_product_id', 'external_variation_id', 'is_active'])
                ->mapWithKeys(fn ($l) => [
                    $l->external_product_id . ':' . $l->external_variation_id => (bool) $l->is_active,
                ]);

            $now = now()->toDateTimeString();
            $payload = [];
            $imported = [];
            $created = 0;
            $skipped = 0;

            foreach ($rows as $row) {
                $productId = trim((string) ($row['external_product_id'] ?? ''));
                $variationId = trim((string) ($row['external_variation_id'] ?? '')) ?: '0';
                $name = trim((string) ($row['product_name'] ?? ''));

                if ($productId === '' || $name === '' || strlen($productId) > 50 || strlen($variationId) > 50) {
                    $skipped++;
                    continue;
                }

                $key = $productId . ':' . $variationId;

                if (isset($imported[$key])) {
                    $skipped++; // baris ganda di file
                    continue;
                }

                $imported[$key] = true;

                if (! $existing->has($key)) {
                    $created++;
                }

                $payload[] = [
                    'marketplace_id' => $marketplaceId,
                    'external_product_id' => $productId,
                    'external_variation_id' => $variationId,
                    'product_name' => Str::limit($name, 490, ''),
                    'variation_name' => $this->nullable($row['variation_name'] ?? null),
                    'marketplace_sku' => $this->nullable($row['sku'] ?? null),
                    'parent_sku' => $this->nullable($row['parent_sku'] ?? null),
                    'price' => max(0, (float) ($row['price'] ?? 0)),
                    'marketplace_stock' => max(0, (int) ($row['stock'] ?? 0)),
                    'is_active' => true,
                    'last_imported_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            $deactivated = 0;

            if ($deactivateMissing) {
                // Listing yang tidak ada lagi di file dinonaktifkan (bukan dihapus),
                // supaya pemetaan & histori penjualannya tetap aman.
                $deactivated = $existing
                    ->filter(fn ($active, $key) => $active && ! isset($imported[$key]))
                    ->count();

                MarketplaceListing::where('marketplace_id', $marketplaceId)->update(['is_active' => false]);
            }

            foreach (array_chunk($payload, 500) as $chunk) {
                MarketplaceListing::upsert(
                    $chunk,
                    ['marketplace_id', 'external_product_id', 'external_variation_id'],
                    [
                        'product_name',
                        'variation_name',
                        'marketplace_sku',
                        'parent_sku',
                        'price',
                        'marketplace_stock',
                        'is_active',
                        'last_imported_at',
                        'updated_at',
                    ]
                );
            }

            return [
                'total' => count($payload),
                'created' => $created,
                'updated' => count($payload) - $created,
                'deactivated' => $deactivated,
                'skipped' => $skipped,
            ];
        });
    }

    private function nullable($value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : Str::limit($value, 250, '');
    }
}
