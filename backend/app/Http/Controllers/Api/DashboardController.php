<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private DashboardService $dashboardService)
    {
    }

    public function index(Request $request)
    {
        $filters = $request->only(['date_from', 'date_to', 'marketplace_id']);

        return response()->json($this->dashboardService->summary($filters));
    }
}
