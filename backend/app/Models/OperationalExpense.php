<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OperationalExpense extends Model
{
    use HasFactory;

    protected $fillable = [
        'expense_date',
        'category',
        'name',
        'qty',
        'unit',
        'amount',
        'notes',
    ];

    protected $casts = [
        'expense_date' => 'date:Y-m-d',
        'qty' => 'decimal:2',
        'amount' => 'decimal:2',
    ];

    protected $appends = ['unit_price'];

    /**
     * Harga per satuan = total harga / jumlah (null kalau jumlah tidak diisi).
     * Contoh: plastik packing Rp 60.000 untuk 500 pcs -> Rp 120 per pcs.
     */
    public function getUnitPriceAttribute(): ?float
    {
        $qty = (float) $this->qty;

        return $qty > 0 ? round((float) $this->amount / $qty, 2) : null;
    }
}
