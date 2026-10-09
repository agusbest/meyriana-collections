<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * - app_settings: pengaturan umum aplikasi (key -> value)
     * - sales.packing_cost: biaya packing per pesanan, di-snapshot saat pesanan dibuat
     */
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->decimal('packing_cost', 15, 2)->default(0)->after('other_fee');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('packing_cost');
        });

        Schema::dropIfExists('app_settings');
    }
};
