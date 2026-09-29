<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\MarketplaceController;
use App\Http\Controllers\Api\MarketplaceFeeController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\StockHistoryController;
use App\Http\Controllers\Api\SupplierController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);

// Protected (butuh Bearer token dari Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Products
    Route::get('/products/{product}/profit', [ProductController::class, 'profit']);
    Route::apiResource('products', ProductController::class);

    // Suppliers
    Route::apiResource('suppliers', SupplierController::class);

    // Purchases (tidak ada update/destroy di V1 - histori dikunci)
    // Route::apiResource('purchases', PurchaseController::class)->only(['index', 'store', 'show']);
    Route::apiResource('purchases', PurchaseController::class);

    // Marketplaces + nested fees
    Route::apiResource('marketplaces', MarketplaceController::class);
    Route::apiResource('marketplaces.fees', MarketplaceFeeController::class)
        ->shallow()
        ->only(['index', 'store', 'update', 'destroy']);

    // Sales
    Route::apiResource('sales', SaleController::class)->only(['index', 'store', 'show']);
    Route::post('/sales/{sale}/complete', [SaleController::class, 'complete']);
    Route::post('/sales/{sale}/cancel', [SaleController::class, 'cancel']);

    // Stock history
    Route::get('/stock-histories', [StockHistoryController::class, 'index']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);
});
