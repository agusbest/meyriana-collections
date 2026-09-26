<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MarketplaceFee extends Model
{
    use HasFactory;

    protected $fillable = ['marketplace_id', 'name', 'type', 'value', 'is_active'];

    protected $casts = [
        'value' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function marketplace()
    {
        return $this->belongsTo(Marketplace::class);
    }
}
