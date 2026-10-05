<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Isi 1 kali penjualan sebuah listing, per potong.
     * Contoh "3 SETEL KUTUNG AUTUMN" = Baju Kutung (Autumn) x3 + Celana Pop (Autumn) x3.
     */
    public function up(): void
    {
        Schema::create('listing_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('marketplace_listing_id')->constrained('marketplace_listings')->cascadeOnDelete();
            // restrict: varian yang dipakai listing tidak boleh terhapus diam-diam
            $table->foreignId('product_variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->unsignedInteger('qty');
            $table->timestamps();

            $table->unique(['marketplace_listing_id', 'product_variant_id'], 'listing_components_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_components');
    }
};
