<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardTrendService;
use Illuminate\Http\Request;

/** GET /api/dashboard/trend?date_from=&date_to=&marketplace_id= */
class DashboardTrendController extends Controller
{
    public function __invoke(Request $request, DashboardTrendService $service)
    {
        $filters = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'marketplace_id' => ['nullable', 'integer'],
        ]);

        return response()->json($service->daily($filters));
    }
}
