<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SaleFee extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id', 'marketplace_fee_id', 'name', 'type', 'value', 'amount',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'amount' => 'decimal:2',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function marketplaceFee()
    {
        return $this->belongsTo(MarketplaceFee::class);
    }
}
