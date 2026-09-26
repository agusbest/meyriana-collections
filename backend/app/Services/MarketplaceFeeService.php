<?php

namespace App\Services;

use App\Models\MarketplaceFee;

class MarketplaceFeeService
{
    /**
     * Hitung nilai fee berdasarkan tipe (percentage / fixed).
     * Sengaja dipisah jadi service agar basis perhitungan mudah
     * diganti di masa depan tanpa menyentuh SaleService.
     */
    public function calculate(MarketplaceFee $fee, float $basis): float
    {
        return $fee->type === 'percentage'
            ? round($basis * (float) $fee->value / 100, 2)
            : (float) $fee->value;
    }
}
