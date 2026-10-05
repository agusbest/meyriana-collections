<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketplaceListing extends Model
{
    protected $fillable = [
        'marketplace_id',
        'external_product_id',
        'external_variation_id',
        'product_name',
        'variation_name',
        'marketplace_sku',
        'parent_sku',
        'price',
        'marketplace_stock',
        'is_active',
        'mapping_source',
        'last_imported_at',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'marketplace_stock' => 'integer',
        'is_active' => 'boolean',
        'last_imported_at' => 'datetime',
    ];

    protected $appends = ['available_stock'];

    public function marketplace()
    {
        return $this->belongsTo(Marketplace::class);
    }

    public function components()
    {
        return $this->hasMany(ListingComponent::class);
    }

    /**
     * Berapa kali listing ini bisa dijual dari stok lokal:
     * MIN( floor(stok varian / qty) ) untuk semua komponennya.
     * null = belum dipetakan (atau komponen belum dimuat).
     */
    public function getAvailableStockAttribute(): ?int
    {
        if (! $this->relationLoaded('components') || $this->components->isEmpty()) {
            return null;
        }

        return (int) $this->components
            ->map(function ($component) {
                $stock = max(0, (int) ($component->productVariant?->stock ?? 0));

                return intdiv($stock, max(1, (int) $component->qty));
            })
            ->min();
    }
}
