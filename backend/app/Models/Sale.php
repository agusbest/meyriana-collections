<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_number',
        'marketplace_id',
        'sale_date',
        'total_sales',
        'total_cost',
        'marketplace_fee',
        'other_fee',
        'profit',
        'status',
        'completed_at',
        'packing_cost',
    ];

    protected $casts = [
        'sale_date' => 'date:Y-m-d',
        'total_sales' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'marketplace_fee' => 'decimal:2',
        'other_fee' => 'decimal:2',
        'profit' => 'decimal:2',
        'completed_at' => 'datetime',
        'packing_cost' => 'decimal:2',
    ];

    public function marketplace()
    {
        return $this->belongsTo(Marketplace::class);
    }

    public function items()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function fees()
    {
        return $this->hasMany(SaleFee::class);
    }
}
