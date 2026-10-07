<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Peran pengguna:
     *   admin = semua menu, termasuk Dashboard dan Pengguna
     *   staff = semua menu kecuali Dashboard dan Pengguna
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->default('staff')->after('password');
            $table->boolean('is_active')->default(true)->after('role');
        });

        // Akun yang sudah ada sebelum fitur ini (akun admin awal) dijadikan admin
        DB::table('users')->update(['role' => 'admin']);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'is_active']);
        });
    }
};
