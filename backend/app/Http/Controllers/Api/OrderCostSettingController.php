<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\OperationalExpense;
use Illuminate\Http\Request;

/** Setting -> Biaya per Pesanan */
class OrderCostSettingController extends Controller
{
    public function show()
    {
        return response()->json($this->payload());
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'packing_cost_per_order' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'covered_categories' => ['present', 'array'],
            'covered_categories.*' => ['string', 'max:100'],
        ], [
            'packing_cost_per_order.required' => 'Biaya per pesanan wajib diisi (isi 0 untuk mematikan).',
            'packing_cost_per_order.min' => 'Biaya per pesanan tidak boleh minus.',
        ]);

        AppSetting::setValue(AppSetting::PACKING_COST, round((float) $data['packing_cost_per_order'], 2));
        AppSetting::setValue(
            AppSetting::PACKING_CATEGORIES,
            array_values(array_unique(array_filter(array_map('trim', $data['covered_categories']))))
        );

        return response()->json($this->payload());
    }

    private function payload(): array
    {
        return [
            'packing_cost_per_order' => AppSetting::packingCostPerOrder(),
            'covered_categories' => (array) AppSetting::getValue(AppSetting::PACKING_CATEGORIES, []),
            // Kategori yang pernah dipakai di Biaya Operasional, untuk pilihan centang
            'available_categories' => OperationalExpense::query()
                ->select('category')
                ->whereNotNull('category')
                ->distinct()
                ->orderBy('category')
                ->pluck('category')
                ->values(),
        ];
    }
}
