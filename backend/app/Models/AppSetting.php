<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Pengaturan umum aplikasi, disimpan sebagai pasangan key -> value (JSON). */
class AppSetting extends Model
{
    public const PACKING_COST = 'packing_cost_per_order';
    public const PACKING_CATEGORIES = 'packing_covered_categories';

    protected $fillable = ['key', 'value'];

    public static function getValue(string $key, mixed $default = null): mixed
    {
        $row = static::where('key', $key)->first();

        return $row ? json_decode($row->value, true) : $default;
    }

    public static function setValue(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => json_encode($value)]);
    }

    /** Biaya packing yang dibebankan ke tiap pesanan baru (Rp). */
    public static function packingCostPerOrder(): float
    {
        return max(0, (float) static::getValue(self::PACKING_COST, 0));
    }

    /**
     * Kategori Biaya Operasional yang sudah tercakup di biaya packing per pesanan.
     * Kategori ini tidak dipotong lagi di Dashboard supaya tidak dihitung dua kali.
     * Dikembalikan dalam huruf kecil untuk pembandingan.
     */
    public static function packingCoveredCategories(): array
    {
        if (static::packingCostPerOrder() <= 0) {
            return []; // fitur mati: semua biaya operasional tetap dipotong seperti biasa
        }

        return array_values(array_unique(array_map(
            fn ($c) => mb_strtolower(trim((string) $c)),
            (array) static::getValue(self::PACKING_CATEGORIES, [])
        )));
    }
}
