<?php

namespace App\Services;

use App\Models\ListingComponent;
use App\Models\MarketplaceListing;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ListingMappingService
{
    /**
     * Terapkan "resep" ke beberapa listing sekaligus (biasanya semua variasi 1 produk Shopee).
     *
     * Tiap baris resep = 1 barang lokal per potong:
     *   - product_id (produk lokal yang sudah ada) ATAU new_product_name (+ supplier_id, category) untuk dibuat baru
     *   - qty: berapa potong per 1 kali listing terjual
     *   - variant_mode "follow": warna/ukuran diambil dari Nama Variasi Shopee ("Coklat Rainbow,XL" -> Coklat Rainbow / XL)
     *     variant_mode "fixed":  warna/ukuran tetap sesuai isian (color, size)
     * Varian lokal yang belum ada dibuat otomatis (stok 0, HPP 0 -> isi nanti di menu Produk).
     */
    public function apply(array $listingIds, array $lines, string $source = 'manual'): Collection
    {
        return DB::transaction(function () use ($listingIds, $lines, $source) {
            $listings = MarketplaceListing::whereIn('id', $listingIds)->get();

            // 1. Produk lokal per baris resep (pakai yang ada, atau buat baru dengan nama pendek)
            $products = [];

            foreach ($lines as $i => $line) {
                $products[$i] = ! empty($line['product_id'])
                    ? Product::findOrFail($line['product_id'])
                    : $this->findOrCreateProduct($line);
            }

            // 2. Untuk tiap listing: tentukan varian per baris, lalu ganti komponennya
            foreach ($listings as $listing) {
                [$followColor, $followSize] = self::parseVariation($listing->variation_name);

                $components = [];

                foreach ($lines as $i => $line) {
                    $follow = ($line['variant_mode'] ?? 'follow') === 'follow';

                    $color = $follow ? $followColor : self::clean($line['color'] ?? null);
                    $size = $follow ? $followSize : self::clean($line['size'] ?? null);

                    $variant = $this->findOrCreateVariant($products[$i], $color, $size);

                    // varian yang sama muncul dua kali di resep -> qty dijumlahkan
                    $components[$variant->id] = ($components[$variant->id] ?? 0) + (int) $line['qty'];
                }

                $listing->components()->delete();

                foreach ($components as $variantId => $qty) {
                    $listing->components()->create([
                        'product_variant_id' => $variantId,
                        'qty' => $qty,
                    ]);
                }
            }

            // HPP per potong (opsional): berlaku untuk semua warna/ukuran barang tersebut
            foreach ($lines as $i => $line) {
                if (isset($line['purchase_price']) && $line['purchase_price'] !== '') {
                    ProductVariant::where('product_id', $products[$i]->id)
                        ->update(['purchase_price' => (float) $line['purchase_price']]);
                }
            }

            // "auto" = hasil tebakan otomatis (perlu dicek), "manual" = sudah diatur sendiri
            MarketplaceListing::whereIn('id', $listingIds)->update(['mapping_source' => $source]);

            return MarketplaceListing::with('components.productVariant.product')
                ->whereIn('id', $listingIds)
                ->get();
        });
    }

    /**
     * Simpan hasil wizard "Impor dari Shopee" sekaligus.
     *
     * $items: barang gudang [{ key, name, supplier_id, category, purchase_price }]
     *         key = nama dalam huruf kecil, dipakai jobs untuk menunjuk barang
     * $jobs:  isi paket per kelompok listing [{ listing_ids, reviewed, lines: [{ item: key, qty }] }]
     *
     * Hanya listing yang belum dipetakan yang diproses, jadi aman dijalankan ulang.
     */
    public function setupBulk(array $items, array $jobs): array
    {
        return DB::transaction(function () use ($items, $jobs) {
            // 1. Barang gudang: pakai yang sudah ada (nama sama) atau buat baru
            $products = [];
            $hpp = [];

            foreach ($items as $item) {
                $name = trim((string) $item['name']);
                $product = Product::where('name', $name)->first();

                if ($product) {
                    $product->update(['supplier_id' => $item['supplier_id']]);
                } else {
                    $product = Product::create([
                        'supplier_id' => $item['supplier_id'],
                        'sku' => $this->uniqueSku($name),
                        'name' => $name,
                        'category' => self::clean($item['category'] ?? null),
                        'is_active' => true,
                    ]);
                }

                $products[$item['key']] = $product;

                if (isset($item['purchase_price']) && $item['purchase_price'] !== '') {
                    $hpp[$item['key']] = (float) $item['purchase_price'];
                }
            }

            // 2. Isi paket tiap produk Shopee (varian warna/ukuran dibuat otomatis)
            $mapped = 0;
            $skipped = 0;

            foreach ($jobs as $job) {
                $ids = MarketplaceListing::whereIn('id', $job['listing_ids'])
                    ->doesntHave('components')
                    ->pluck('id')
                    ->all();

                $skipped += count($job['listing_ids']) - count($ids);

                if (! $ids) {
                    continue;
                }

                $lines = array_map(fn ($line) => [
                    'product_id' => $products[$line['item']]->id,
                    'qty' => (int) $line['qty'],
                    'variant_mode' => 'follow',
                ], $job['lines']);

                $this->apply($ids, $lines, ! empty($job['reviewed']) ? 'manual' : 'auto');

                $mapped += count($ids);
            }

            // 3. HPP per potong berlaku untuk semua warna/ukuran barang itu,
            //    termasuk varian yang baru dibuat di langkah 2
            foreach ($hpp as $key => $price) {
                ProductVariant::where('product_id', $products[$key]->id)->update(['purchase_price' => $price]);
            }

            return ['mapped' => $mapped, 'skipped' => $skipped];
        });
    }

    public function unmap(array $listingIds): int
    {
        return DB::transaction(function () use ($listingIds) {
            $deleted = ListingComponent::whereIn('marketplace_listing_id', $listingIds)->delete();

            MarketplaceListing::whereIn('id', $listingIds)->update(['mapping_source' => null]);

            return $deleted;
        });
    }

    /**
     * "Coklat Rainbow,XL" -> ["Coklat Rainbow", "XL"]; "Autumn" -> ["Autumn", null]; "" / "-" -> [null, null]
     */
    public static function parseVariation(?string $name): array
    {
        $name = trim((string) $name);

        if ($name === '' || $name === '-') {
            return [null, null];
        }

        $parts = array_map('trim', explode(',', $name, 2));

        return [self::clean($parts[0]), self::clean($parts[1] ?? null)];
    }

    public static function clean(?string $value): ?string
    {
        $value = trim((string) $value);

        return ($value === '' || $value === '-') ? null : $value;
    }

    private function findOrCreateProduct(array $line): Product
    {
        $name = trim((string) $line['new_product_name']);

        // Nama sama dengan produk yang sudah ada -> pakai yang ada, jangan dobel
        $existing = Product::where('name', $name)->first();

        if ($existing) {
            return $existing;
        }

        return Product::create([
            'supplier_id' => $line['supplier_id'] ?? null,
            'sku' => $this->uniqueSku($name),
            'name' => $name,
            'category' => self::clean($line['category'] ?? null),
            'is_active' => true,
        ]);
    }

    private function findOrCreateVariant(Product $product, ?string $color, ?string $size): ProductVariant
    {
        $query = ProductVariant::where('product_id', $product->id);

        $color === null ? $query->whereNull('color') : $query->where('color', $color);
        $size === null ? $query->whereNull('size') : $query->where('size', $size);

        $variant = $query->first();

        if ($variant) {
            if (! $variant->is_active) {
                $variant->update(['is_active' => true]);
            }

            return $variant;
        }

        return ProductVariant::create([
            'product_id' => $product->id,
            'color' => $color,
            'size' => $size,
            'purchase_price' => 0,
            'selling_price' => 0,
            'stock' => 0,
            'is_active' => true,
        ]);
    }

    private function uniqueSku(string $name): string
    {
        $base = Str::limit(Str::upper(Str::slug($name)), 90, '') ?: 'PRODUK';
        $sku = $base;
        $n = 2;

        while (Product::where('sku', $sku)->exists()) {
            $sku = $base . '-' . $n++;
        }

        return $sku;
    }
}
