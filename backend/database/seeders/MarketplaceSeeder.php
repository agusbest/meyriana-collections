<?php

namespace Database\Seeders;

use App\Models\Marketplace;
use Illuminate\Database\Seeder;

class MarketplaceSeeder extends Seeder
{
    public function run(): void
    {
        $shopee = Marketplace::firstOrCreate(
            ['code' => 'shopee'],
            ['name' => 'Shopee', 'is_active' => true]
        );

        $shopee->fees()->createMany([
            ['name' => 'Biaya Admin', 'type' => 'percentage', 'value' => 5, 'is_active' => true],
            ['name' => 'Biaya Aplikasi', 'type' => 'percentage', 'value' => 2, 'is_active' => true],
            ['name' => 'Biaya Layanan', 'type' => 'percentage', 'value' => 1, 'is_active' => true],
            ['name' => 'Biaya Tetap', 'type' => 'fixed', 'value' => 1250, 'is_active' => true],
        ]);

        Marketplace::firstOrCreate(['code' => 'tokopedia'], ['name' => 'Tokopedia', 'is_active' => true]);
        Marketplace::firstOrCreate(['code' => 'lazada'], ['name' => 'Lazada', 'is_active' => true]);
        Marketplace::firstOrCreate(['code' => 'tiktok_shop'], ['name' => 'TikTok Shop', 'is_active' => true]);
    }
}
