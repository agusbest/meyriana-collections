<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OrderImportService;
use Illuminate\Http\Request;

class SaleImportController extends Controller
{
    public function __construct(private OrderImportService $service)
    {
    }

    /** POST /sales/import/preview — cek file tanpa menyimpan. */
    public function preview(Request $request)
    {
        $data = $this->validated($request, 5000);

        return response()->json(
            $this->service->preview($data['marketplace_id'], $data['orders'], (bool) ($data['auto_adjust'] ?? false))
        );
    }

    /** POST /sales/import — simpan pesanan yang lolos cek (dikirim bertahap dari frontend). */
    public function store(Request $request)
    {
        $data = $this->validated($request, 200);

        return response()->json(
            $this->service->import($data['marketplace_id'], $data['orders'], (bool) ($data['auto_adjust'] ?? false))
        );
    }

    private function validated(Request $request, int $maxOrders): array
    {
        return $request->validate([
            'marketplace_id' => ['required', 'integer', 'exists:marketplaces,id'],
            'auto_adjust' => ['sometimes', 'boolean'],
            'orders' => ['required', 'array', 'min:1', "max:{$maxOrders}"],
            'orders.*.order_number' => ['required', 'string', 'max:100'],
            'orders.*.sale_date' => ['required', 'date_format:Y-m-d'],
            'orders.*.status' => ['nullable', 'string', 'max:100'],
            'orders.*.lines' => ['required', 'array', 'min:1'],
            'orders.*.lines.*.product_name' => ['required', 'string', 'max:1000'],
            'orders.*.lines.*.variation_name' => ['nullable', 'string', 'max:255'],
            'orders.*.lines.*.sku' => ['nullable', 'string', 'max:255'],
            'orders.*.lines.*.qty' => ['required', 'integer', 'min:0'],
            'orders.*.lines.*.total' => ['required', 'numeric', 'min:0'],
        ], [
            'orders.max' => "Maksimal {$maxOrders} pesanan per kirim.",
            'orders.*.sale_date.date_format' => 'Tanggal pesanan tidak terbaca.',
        ]);
    }
}
