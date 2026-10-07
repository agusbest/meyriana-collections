<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Biaya operasional di luar HPP & fee marketplace: plastik packing, kertas thermal, lakban, dst.
     * Total biaya per periode dikurangkan dari profit di Dashboard (laba bersih).
     */
    public function up(): void
    {
        Schema::create('operational_expenses', function (Blueprint $table) {
            $table->id();
            $table->date('expense_date');
            $table->string('category', 100);
            $table->string('name');
            $table->decimal('qty', 12, 2)->nullable();   // jumlah yang dibeli (opsional), untuk menghitung harga satuan
            $table->string('unit', 30)->nullable();      // satuan (opsional): pcs, roll, pack
            $table->decimal('amount', 15, 2);            // total harga yang dibayar
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('expense_date');
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operational_expenses');
    }
};
