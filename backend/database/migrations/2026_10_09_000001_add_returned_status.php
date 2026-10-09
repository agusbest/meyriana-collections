<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambah nilai enum:
     *   sales.status          -> 'returned'  (pesanan diretur)
     *   stock_histories.type  -> 'return_in' (stok masuk karena retur)
     * Nilai enum yang sudah ada dibaca dari database lalu ditambah, supaya tidak ada yang hilang.
     */
    public function up(): void
    {
        $this->addEnumValue('sales', 'status', 'returned', "NOT NULL DEFAULT 'pending'");
        $this->addEnumValue('stock_histories', 'type', 'return_in', 'NOT NULL');
    }

    public function down(): void
    {
        // Kembalikan dulu data yang memakai nilai baru, baru nilai enum-nya dihapus
        DB::table('sales')->where('status', 'returned')->update(['status' => 'cancelled']);
        DB::table('stock_histories')->where('type', 'return_in')->update(['type' => 'sale_cancel_in']);

        $this->removeEnumValue('sales', 'status', 'returned', "NOT NULL DEFAULT 'pending'");
        $this->removeEnumValue('stock_histories', 'type', 'return_in', 'NOT NULL');
    }

    private function enumValues(string $table, string $column): array
    {
        $type = DB::selectOne(
            'SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [$table, $column]
        )?->t;

        if (! $type || ! str_starts_with(strtolower($type), 'enum(')) {
            return [];
        }

        preg_match_all("/'((?:[^']|'')*)'/", $type, $m);

        return array_map(fn ($v) => str_replace("''", "'", $v), $m[1]);
    }

    private function setEnum(string $table, string $column, array $values, string $suffix): void
    {
        $list = implode(',', array_map(fn ($v) => DB::getPdo()->quote($v), $values));

        DB::statement("ALTER TABLE `{$table}` MODIFY `{$column}` ENUM({$list}) {$suffix}");
    }

    private function addEnumValue(string $table, string $column, string $value, string $suffix): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        $values = $this->enumValues($table, $column);

        // Kolom bukan enum (mis. string biasa): tidak perlu diubah
        if (! $values || in_array($value, $values, true)) {
            return;
        }

        $this->setEnum($table, $column, [...$values, $value], $suffix);
    }

    private function removeEnumValue(string $table, string $column, string $value, string $suffix): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        $values = array_values(array_diff($this->enumValues($table, $column), [$value]));

        if ($values) {
            $this->setEnum($table, $column, $values, $suffix);
        }
    }
};
