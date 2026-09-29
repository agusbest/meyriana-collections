<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * sale_items lama menunjuk ke products (product_id). Stok sekarang ada di
     * product_variants, jadi item penjualan harus menunjuk ke variasi.
     *
     * Aman dijalankan walau tabel sudah memakai product_variant_id (langsung dilewati).
     */
    public function up(): void
    {
        if (Schema::hasColumn('sale_items', 'product_variant_id')) {
            return;
        }

        Schema::table('sale_items', function (Blueprint $table) {
            $table->unsignedBigInteger('product_variant_id')->nullable()->after('sale_id');
        });

        if (Schema::hasColumn('sale_items', 'product_id')) {
            // Data lama: pakai variasi pertama dari produk yang sama
            DB::statement(
                'UPDATE sale_items SET product_variant_id = (
                    SELECT MIN(pv.id) FROM product_variants pv
                    WHERE pv.product_id = sale_items.product_id
                )'
            );

            Schema::table('sale_items', function (Blueprint $table) {
                $table->dropForeign(['product_id']);
                $table->dropColumn('product_id');
            });
        }

        Schema::table('sale_items', function (Blueprint $table) {
            $table->foreign('product_variant_id')
                ->references('id')
                ->on('product_variants')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('sale_items', 'product_variant_id')) {
            return;
        }

        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropForeign(['product_variant_id']);
            $table->dropColumn('product_variant_id');
        });
    }
};
