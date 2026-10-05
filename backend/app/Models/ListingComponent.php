<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ListingComponent extends Model
{
    protected $fillable = [
        'marketplace_listing_id',
        'product_variant_id',
        'qty',
    ];

    protected $casts = [
        'qty' => 'integer',
    ];

    public function listing()
    {
        return $this->belongsTo(MarketplaceListing::class, 'marketplace_listing_id');
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
