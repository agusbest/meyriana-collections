<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MarketplaceListing;
use App\Models\Supplier;
use App\Services\ListingImportService;
use App\Services\ListingMappingService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class MarketplaceListingController extends Controller
{
    public function __construct(
        private ListingImportService $importer,
        private ListingMappingService $mapper,
    ) {}

    /**
     * Daftar listing dikelompokkan per produk marketplace (Kode Produk), 20 produk per halaman.
     */
    public function index(Request $request)
    {
        $request->validate([
            'marketplace_id' => 'required|integer|exists:marketplaces,id',
            'status' => 'nullable|in:mapped,unmapped,auto',
        ]);

        $marketplaceId = (int) $request->marketplace_id;

        $base = MarketplaceListing::where('marketplace_id', $marketplaceId)->where('is_active', true);

        if ($request->filled('search')) {
            $search = $request->search;

            $base->where(function ($q) use ($search) {
                $q->where('product_name', 'like', "%{$search}%")
                    ->orWhere('variation_name', 'like', "%{$search}%")
                    ->orWhere('marketplace_sku', 'like', "%{$search}%")
                    ->orWhere('external_product_id', $search);
            });
        }

        if ($request->status === 'unmapped') {
            $base->doesntHave('components');
        } elseif ($request->status === 'mapped') {
            $base->has('components');
        } elseif ($request->status === 'auto') {
            $base->has('components')->where('mapping_source', 'auto');
        }

        $groups = (clone $base)
            ->select('external_product_id')
            ->selectRaw('MAX(product_name) as product_name')
            ->groupBy('external_product_id')
            ->orderBy('product_name')
            ->paginate(20);

        // Semua variasi aktif dari produk-produk di halaman ini (bukan hanya yang cocok filter)
        $listings = MarketplaceListing::with('components.productVariant.product')
            ->where('marketplace_id', $marketplaceId)
            ->where('is_active', true)
            ->whereIn('external_product_id', $groups->getCollection()->pluck('external_product_id'))
            ->orderBy('id')
            ->get()
            ->groupBy('external_product_id');

        $groups->setCollection(
            $groups->getCollection()->map(fn ($group) => [
                'external_product_id' => $group->external_product_id,
                'product_name' => $group->product_name,
                'listings' => $listings->get($group->external_product_id, collect())->values(),
            ])
        );

        $total = MarketplaceListing::where('marketplace_id', $marketplaceId)->where('is_active', true)->count();
        $mapped = MarketplaceListing::where('marketplace_id', $marketplaceId)->where('is_active', true)
            ->has('components')
            ->count();

        $auto = MarketplaceListing::where('marketplace_id', $marketplaceId)->where('is_active', true)
            ->where('mapping_source', 'auto')
            ->has('components')
            ->count();

        return response()->json(array_merge($groups->toArray(), [
            'stats' => [
                'total' => $total,
                'mapped' => $mapped,
                'unmapped' => $total - $mapped,
                'auto' => $auto,
            ],
        ]));
    }

    /**
     * POST /marketplace-listings/import
     * rows dibaca dari file ekspor Shopee di browser, lalu dikirim sebagai JSON.
     */
    public function import(Request $request)
    {
        $data = $request->validate([
            'marketplace_id' => 'required|integer|exists:marketplaces,id',
            'deactivate_missing' => 'boolean',
            'rows' => 'required|array|min:1|max:20000',
        ], [
            'rows.required' => 'File tidak berisi data listing.',
            'rows.max' => 'Maksimal 20.000 baris per impor.',
        ]);

        $result = $this->importer->import(
            (int) $data['marketplace_id'],
            $data['rows'],
            (bool) ($data['deactivate_missing'] ?? true),
        );

        return response()->json($result);
    }

    /**
     * POST /marketplace-listings/mapping
     */
    public function map(Request $request)
    {
        $data = $request->validate([
            'listing_ids' => 'required|array|min:1|max:500',
            'listing_ids.*' => 'integer|exists:marketplace_listings,id',
            'lines' => 'required|array|min:1|max:20',
            'lines.*.product_id' => 'nullable|integer|exists:products,id',
            'lines.*.new_product_name' => 'nullable|required_without:lines.*.product_id|string|max:255',
            'lines.*.supplier_id' => 'nullable|required_without:lines.*.product_id|integer|exists:suppliers,id',
            'lines.*.category' => 'nullable|string|max:100',
            'lines.*.qty' => 'required|integer|min:1|max:1000',
            'lines.*.variant_mode' => 'required|in:follow,fixed',
            'lines.*.color' => 'nullable|string|max:100',
            'lines.*.size' => 'nullable|string|max:100',
            'lines.*.purchase_price' => 'nullable|numeric|min:0',
        ], [
            'listing_ids.required' => 'Pilih minimal satu variasi.',
            'lines.required' => 'Isi minimal satu barang lokal.',
            'lines.*.new_product_name.required_without' => 'Nama produk baru wajib diisi.',
            'lines.*.supplier_id.required_without' => 'Supplier wajib dipilih untuk produk baru.',
            'lines.*.qty.min' => 'Qty minimal 1.',
        ]);

        $listings = $this->mapper->apply($data['listing_ids'], $data['lines'], 'manual');

        return response()->json($listings);
    }

    /**
     * GET /marketplace-listings/unmapped?marketplace_id=
     * Semua listing aktif yang belum dipetakan (tanpa paginasi), untuk Petakan Otomatis.
     */
    public function unmapped(Request $request)
    {
        $request->validate([
            'marketplace_id' => 'required|integer|exists:marketplaces,id',
        ]);

        $listings = MarketplaceListing::where('marketplace_id', $request->marketplace_id)
            ->where('is_active', true)
            ->doesntHave('components')
            ->orderBy('external_product_id')
            ->orderBy('id')
            ->get(['id', 'external_product_id', 'product_name', 'variation_name', 'marketplace_sku'])
            ->makeHidden('available_stock');

        return response()->json($listings);
    }

    /**
     * POST /marketplace-listings/auto-map
     * jobs: [{ listing_ids: [...], lines: [{ new_product_name, supplier_id, category, qty }] }]
     * Hanya listing yang MASIH belum dipetakan yang diproses, jadi pemetaan manual tidak tertimpa.
     */
    public function autoMap(Request $request)
    {
        $data = $request->validate([
            'supplier_id' => 'required|integer|exists:suppliers,id',
            'jobs' => 'required|array|min:1|max:100',
            'jobs.*.listing_ids' => 'required|array|min:1|max:200',
            'jobs.*.listing_ids.*' => 'integer',
            'jobs.*.lines' => 'required|array|min:1|max:10',
            'jobs.*.lines.*.new_product_name' => 'required|string|max:255',
            'jobs.*.lines.*.category' => 'nullable|string|max:100',
            'jobs.*.lines.*.qty' => 'required|integer|min:1|max:1000',
        ], [
            'supplier_id.required' => 'Pilih supplier untuk produk baru.',
            'jobs.*.lines.*.new_product_name.required' => 'Ada nama barang lokal yang kosong.',
        ]);

        $mapped = 0;
        $skipped = 0;

        foreach ($data['jobs'] as $job) {
            $ids = MarketplaceListing::whereIn('id', $job['listing_ids'])
                ->doesntHave('components')
                ->pluck('id')
                ->all();

            $skipped += count($job['listing_ids']) - count($ids);

            if (! $ids) {
                continue;
            }

            $lines = array_map(fn ($line) => [
                'product_id' => null,
                'new_product_name' => $line['new_product_name'],
                'supplier_id' => $data['supplier_id'],
                'category' => $line['category'] ?? null,
                'qty' => $line['qty'],
                'variant_mode' => 'follow',
            ], $job['lines']);

            $this->mapper->apply($ids, $lines, 'auto');

            $mapped += count($ids);
        }

        return response()->json(['mapped' => $mapped, 'skipped' => $skipped]);
    }

    /**
     * POST /marketplace-listings/setup
     * Dipakai wizard "Impor dari Shopee": barang gudang (+ supplier & HPP) dan isi paket sekaligus.
     */
    public function setup(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1|max:500',
            'items.*.key' => 'required|string|max:255',
            'items.*.name' => 'required|string|max:255',
            'items.*.supplier_id' => 'required|integer',
            'items.*.category' => 'nullable|string|max:100',
            'items.*.purchase_price' => 'nullable|numeric|min:0',
            'jobs' => 'required|array|min:1|max:100',
            'jobs.*.listing_ids' => 'required|array|min:1|max:200',
            'jobs.*.listing_ids.*' => 'integer',
            'jobs.*.reviewed' => 'boolean',
            'jobs.*.variants' => 'nullable|array|max:200',
            'jobs.*.variants.*.listing_id' => 'required|integer',
            'jobs.*.variants.*.color' => 'nullable|string|max:100',
            'jobs.*.variants.*.size' => 'nullable|string|max:100',
            'jobs.*.lines' => 'required|array|min:1|max:10',
            'jobs.*.lines.*.item' => 'required|string|max:255',
            'jobs.*.lines.*.qty' => 'required|integer|min:1|max:1000',
        ], [
            'items.*.name.required' => 'Ada nama barang yang kosong.',
            'items.*.supplier_id.required' => 'Ada barang yang belum dipilih suppliernya.',
            'items.*.purchase_price.min' => 'HPP tidak boleh minus.',
            'jobs.*.lines.*.qty.min' => 'Jumlah minimal 1.',
            'jobs.*.variants.*.color.max' => 'Warna maksimal 100 karakter.',
            'jobs.*.variants.*.size.max' => 'Ukuran maksimal 100 karakter.',
        ]);

        // Cek supplier sekali saja (lebih cepat daripada aturan exists per baris)
        $supplierIds = collect($data['items'])->pluck('supplier_id')->unique()->values();

        if (Supplier::whereIn('id', $supplierIds)->count() !== $supplierIds->count()) {
            throw ValidationException::withMessages(['items' => 'Ada supplier yang tidak ditemukan.']);
        }

        $keys = collect($data['items'])->pluck('key')->flip();

        foreach ($data['jobs'] as $job) {
            foreach ($job['lines'] as $line) {
                if (! $keys->has($line['item'])) {
                    throw ValidationException::withMessages([
                        'jobs' => "Barang \"{$line['item']}\" tidak ada di daftar barang gudang.",
                    ]);
                }
            }
        }

        return response()->json($this->mapper->setupBulk($data['items'], $data['jobs']));
    }

    /**
     * POST /marketplace-listings/unmap
     */
    public function unmap(Request $request)
    {
        $data = $request->validate([
            'listing_ids' => 'required|array|min:1|max:500',
            'listing_ids.*' => 'integer|exists:marketplace_listings,id',
        ]);

        $deleted = $this->mapper->unmap($data['listing_ids']);

        return response()->json(['deleted' => $deleted]);
    }
}
