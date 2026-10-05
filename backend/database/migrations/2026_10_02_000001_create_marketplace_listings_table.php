<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Satu baris = satu variasi produk di marketplace (Kode Produk + Kode Variasi Shopee).
     * Stok fisik TIDAK disimpan di sini; stok ada di product_variants (per potong).
     */
    public function up(): void
    {
        Schema::create('marketplace_listings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('marketplace_id')->constrained('marketplaces')->cascadeOnDelete();
            $table->string('external_product_id', 50);    // Kode Produk
            $table->string('external_variation_id', 50);  // Kode Variasi ("0" kalau tanpa variasi)
            $table->string('product_name', 500);
            $table->string('variation_name')->nullable();
            $table->string('marketplace_sku')->nullable(); // SKU di Shopee (hanya petunjuk, tidak unik)
            $table->string('parent_sku')->nullable();
            $table->decimal('price', 15, 2)->default(0);
            $table->integer('marketplace_stock')->default(0); // stok di Shopee saat terakhir diimpor
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_imported_at')->nullable();
            $table->timestamps();

            $table->unique(
                ['marketplace_id', 'external_product_id', 'external_variation_id'],
                'marketplace_listings_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_listings');
    }
};
