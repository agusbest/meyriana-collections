<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // "auto" = dipetakan otomatis (perlu dicek), "manual" = sudah dicek/diatur sendiri, null = belum dipetakan
    public function up(): void
    {
        Schema::table('marketplace_listings', function (Blueprint $table) {
            $table->string('mapping_source', 10)->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('marketplace_listings', function (Blueprint $table) {
            $table->dropColumn('mapping_source');
        });
    }
};
