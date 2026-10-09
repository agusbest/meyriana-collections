<?php

namespace App\Services;

/**
 * Logika murni impor pesanan marketplace (tanpa database), supaya mudah diuji.
 *
 * Alur per baris pesanan:
 *   baris order -> cari listing (nama produk + nama variasi, cadangan: SKU + variasi)
 *   -> isi paket (listing_components) -> qty komponen x qty order -> item penjualan per varian.
 *
 * $listings: [[id, product_name, variation_name, marketplace_sku, is_active,
 *              components => [[product_variant_id, qty]]]]
 * $variants: [variantId => [stock => int, cost => float, label => string]]
 */
class OrderImportPlanner
{
    private array $byName = [];
    private array $bySku = [];

    public function __construct(array $listings, private array $variants)
    {
        foreach ($listings as $listing) {
            $variation = self::normalize($listing['variation_name'] ?? null);

            $this->byName[self::normalize($listing['product_name'] ?? null) . '|' . $variation][] = $listing;

            $sku = self::normalize($listing['marketplace_sku'] ?? null);
            if ($sku !== '') {
                $this->bySku[$sku . '|' . $variation][] = $listing;
            }
        }
    }

    /** Huruf kecil, spasi ganda/NBSP dirapikan. */
    public static function normalize(?string $value): string
    {
        $value = str_replace("\u{00A0}", ' ', (string) $value);
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;

        return mb_strtolower(trim($value));
    }

    /**
     * Status pesanan marketplace -> status penjualan lokal.
     * 'skip' = tidak diimpor (belum dibayar / dibatalkan).
     */
    public static function saleStatus(?string $raw): string
    {
        $status = self::normalize($raw);

        if ($status === '' ) {
            return 'pending';
        }

        if (str_contains($status, 'batal') || str_contains($status, 'belum bayar') || str_contains($status, 'cancel') || str_contains($status, 'unpaid')) {
            return 'skip';
        }

        if (str_starts_with($status, 'selesai') || $status === 'completed') {
            return 'completed';
        }

        return 'pending';
    }

    /**
     * @return array{listing: ?array, reason: string}  reason: ok | unmapped | not_found
     */
    public function match(array $line): array
    {
        $variation = self::normalize($line['variation_name'] ?? null);
        $candidates = $this->byName[self::normalize($line['product_name'] ?? null) . '|' . $variation] ?? [];

        if (! $candidates) {
            $sku = self::normalize($line['sku'] ?? null);
            $bySku = $sku !== '' ? ($this->bySku[$sku . '|' . $variation] ?? []) : [];

            // SKU penjual tidak unik: hanya dipakai kalau tepat 1 listing yang cocok
            if (count($bySku) === 1) {
                $candidates = $bySku;
            }
        }

        if (! $candidates) {
            return ['listing' => null, 'reason' => 'not_found'];
        }

        // Utamakan listing yang sudah dipetakan, lalu yang aktif
        usort($candidates, fn ($a, $b) => [empty($a['components']), ! ($a['is_active'] ?? true), $a['id']] <=> [empty($b['components']), ! ($b['is_active'] ?? true), $b['id']]);

        $listing = $candidates[0];

        return ['listing' => $listing, 'reason' => empty($listing['components']) ? 'unmapped' : 'ok'];
    }

    /**
     * Bagi total harga 1 baris order ke varian isi paket, sebanding dengan HPP
     * (kalau HPP semua 0: sebanding jumlah potong). Dihitung dalam sen supaya jumlahnya pas.
     *
     * @return array<int, array{product_variant_id:int, qty:int, subtotal:float}>
     */
    public function allocate(float $lineTotal, int $lineQty, array $components): array
    {
        $rows = [];

        foreach ($components as $component) {
            $variantId = (int) $component['product_variant_id'];
            $pieces = max(1, (int) $component['qty']) * $lineQty;
            $cost = (float) ($this->variants[$variantId]['cost'] ?? 0);

            $rows[] = ['product_variant_id' => $variantId, 'qty' => $pieces, 'weight' => max(0, $cost) * $pieces];
        }

        $totalWeight = array_sum(array_column($rows, 'weight'));

        if ($totalWeight <= 0) {
            foreach ($rows as &$row) {
                $row['weight'] = $row['qty'];
            }
            unset($row);
            $totalWeight = array_sum(array_column($rows, 'weight'));
        }

        $cents = (int) round($lineTotal * 100);
        $given = 0;
        $last = count($rows) - 1;

        foreach ($rows as $i => &$row) {
            $share = $i === $last ? $cents - $given : (int) round($cents * $row['weight'] / $totalWeight);
            $given += $share;
            $row['subtotal'] = $share / 100;
            unset($row['weight']);
        }
        unset($row);

        return $rows;
    }

    /**
     * @param  array  $orders  [[order_number, sale_date, status, lines => [[product_name, variation_name, sku, qty, total]]]]
     * @param  array  $existingOrders  nomor pesanan yang sudah ada => status penjualannya
     *                                 (pending | completed | cancelled | other = milik marketplace lain)
     * @param  bool   $autoAdjust  stok kurang -> tambah stok otomatis (penyesuaian) lalu tetap diimpor
     */
    public function plan(array $orders, array $existingOrders, bool $autoAdjust): array
    {
        $existing = [];
        foreach ($existingOrders as $number => $status) {
            $existing[(string) $number] = (string) $status;
        }
        $stock = array_map(fn ($v) => (int) $v['stock'], $this->variants);
        $initial = $stock;

        // Urut dari pesanan paling lama supaya stok terpotong sesuai urutan kejadian
        usort($orders, fn ($a, $b) => [(string) ($a['sale_date'] ?? ''), (string) $a['order_number']]
            <=> [(string) ($b['sale_date'] ?? ''), (string) $b['order_number']]);

        $results = [];
        $problems = [];   // listing belum dipetakan / tidak ditemukan
        $needed = [];     // total kebutuhan per varian dari pesanan yang bisa diimpor
        $seen = [];

        foreach ($orders as $order) {
            $number = trim((string) ($order['order_number'] ?? ''));
            $saleStatus = self::saleStatus($order['status'] ?? null);

            $result = [
                'order_number' => $number,
                'sale_date' => $order['sale_date'] ?? null,
                'marketplace_status' => $order['status'] ?? null,
                'sale_status' => $saleStatus === 'skip' ? null : $saleStatus,
                'status' => 'ready',
                'message' => null,
                'total' => 0,
                'items' => [],
                'adjustments' => [],
            ];

            if (isset($seen[$number])) {
                $result['status'] = 'duplicate';
                $result['message'] = 'Nomor pesanan ganda di file.';
                $results[] = $result;
                continue;
            }
            $seen[$number] = true;

            if (isset($existing[$number])) {
                $current = $existing[$number];
                $result['total'] = array_sum(array_map(fn ($l) => (float) ($l['total'] ?? 0), $order['lines'] ?? []));
                $result['current_status'] = $current;

                // Sudah diimpor saat masih diproses, sekarang di marketplace sudah selesai -> tandai selesai
                if ($current === 'pending' && $saleStatus === 'completed') {
                    $result['status'] = 'complete';
                    $result['message'] = 'Sudah ada, akan ditandai selesai (dana dicairkan).';
                } else {
                    $result['status'] = 'duplicate';
                    $result['message'] = match ($current) {
                        'completed' => 'Sudah ada dan sudah selesai.',
                        'cancelled' => 'Sudah ada dan sudah dibatalkan.',
                        'returned' => 'Sudah ada dan sudah diretur.',
                        'other' => 'Nomor pesanan sudah dipakai marketplace lain.',
                        default => 'Sudah ada, status di file belum selesai.',
                    };
                }

                $results[] = $result;
                continue;
            }

            if ($saleStatus === 'skip') {
                $result['status'] = 'skipped';
                $result['message'] = 'Pesanan batal / belum dibayar, tidak diimpor.';
                $results[] = $result;
                continue;
            }

            $items = [];
            $badLines = [];

            foreach ($order['lines'] ?? [] as $line) {
                $qty = (int) ($line['qty'] ?? 0);
                $total = (float) ($line['total'] ?? 0);

                if ($qty <= 0) {
                    continue; // seluruhnya dikembalikan
                }

                $result['total'] += $total;
                $match = $this->match($line);

                if ($match['reason'] !== 'ok') {
                    $key = $match['listing']['id'] ?? (self::normalize($line['product_name'] ?? '') . '|' . self::normalize($line['variation_name'] ?? ''));
                    $problems[$key] ??= [
                        'reason' => $match['reason'],
                        'listing_id' => $match['listing']['id'] ?? null,
                        'product_name' => $line['product_name'] ?? '',
                        'variation_name' => $line['variation_name'] ?? null,
                        'sku' => $line['sku'] ?? null,
                        'orders' => 0,
                    ];
                    $problems[$key]['orders']++;
                    $badLines[] = $line['product_name'] ?? '';
                    continue;
                }

                array_push($items, ...$this->allocate($total, $qty, $match['listing']['components']));
            }

            if ($badLines) {
                $result['status'] = 'unmapped';
                $result['message'] = 'Ada produk yang belum dihubungkan ke stok lokal.';
                $results[] = $result;
                continue;
            }

            if (! $items) {
                $result['status'] = 'skipped';
                $result['message'] = 'Tidak ada barang (semua dikembalikan).';
                $results[] = $result;
                continue;
            }

            $required = [];
            foreach ($items as $item) {
                $required[$item['product_variant_id']] = ($required[$item['product_variant_id']] ?? 0) + $item['qty'];
            }

            $short = [];
            foreach ($required as $variantId => $qty) {
                $needed[$variantId] = ($needed[$variantId] ?? 0) + $qty;
                $available = $stock[$variantId] ?? 0;

                if ($available < $qty) {
                    $short[$variantId] = $qty - $available;
                }
            }

            $result['items'] = $items;

            if ($short && ! $autoAdjust) {
                $result['status'] = 'no_stock';
                $result['message'] = 'Stok kurang: ' . implode(', ', array_map(
                    fn ($id) => $this->label($id) . " (kurang {$short[$id]})",
                    array_keys($short)
                ));
                $results[] = $result;
                continue;
            }

            $result['adjustments'] = $short;

            foreach ($required as $variantId => $qty) {
                $stock[$variantId] = ($stock[$variantId] ?? 0) + ($short[$variantId] ?? 0) - $qty;
            }

            $results[] = $result;
        }

        $shortages = [];
        foreach ($needed as $variantId => $qty) {
            $available = $initial[$variantId] ?? 0;
            if ($qty > $available) {
                $shortages[] = [
                    'product_variant_id' => $variantId,
                    'label' => $this->label($variantId),
                    'stock' => $available,
                    'needed' => $qty,
                    'short' => $qty - $available,
                ];
            }
        }
        usort($shortages, fn ($a, $b) => $b['short'] <=> $a['short'] ?: strcmp($a['label'], $b['label']));

        $problems = array_values($problems);
        usort($problems, fn ($a, $b) => $b['orders'] <=> $a['orders'] ?: strcmp($a['product_name'], $b['product_name']));

        $counts = array_fill_keys(['ready', 'complete', 'duplicate', 'skipped', 'unmapped', 'no_stock'], 0);
        foreach ($results as $r) {
            $counts[$r['status']]++;
        }

        return [
            'summary' => $counts + [
                'total' => count($results),
                'adjusted' => count(array_filter($results, fn ($r) => $r['status'] === 'ready' && $r['adjustments'])),
            ],
            'orders' => $results,
            'problems' => $problems,
            'shortages' => $shortages,
        ];
    }

    private function label(int $variantId): string
    {
        return $this->variants[$variantId]['label'] ?? "Varian #{$variantId}";
    }
}
