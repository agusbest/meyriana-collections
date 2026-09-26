<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Marketplace extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'code', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function fees()
    {
        return $this->hasMany(MarketplaceFee::class);
    }

    public function activeFees()
    {
        return $this->hasMany(MarketplaceFee::class)->where('is_active', true);
    }

    public function sales()
    {
        return $this->hasMany(Sale::class);
    }
}
