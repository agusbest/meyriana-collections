<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\MarketplaceController;
use App\Http\Controllers\Api\MarketplaceFeeController;
use App\Http\Controllers\Api\MarketplaceListingController;
use App\Http\Controllers\Api\OperationalExpenseController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SaleImportController;
use App\Http\Controllers\Api\StockHistoryController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UserController;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);

// Protected: harus login (token Sanctum) dan akun aktif
Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Products
    Route::get('/products/{product}/profit', [ProductController::class, 'profit']);
    Route::apiResource('products', ProductController::class);

    // Suppliers
    Route::apiResource('suppliers', SupplierController::class);

    // Purchases
    Route::apiResource('purchases', PurchaseController::class);

    // Marketplaces + nested fees
    Route::apiResource('marketplaces', MarketplaceController::class);
    Route::apiResource('marketplaces.fees', MarketplaceFeeController::class)
        ->shallow()
        ->only(['index', 'store', 'update', 'destroy']);

    // Sales (impor ditaruh sebelum route {sale})
    Route::post('/sales/import/preview', [SaleImportController::class, 'preview']);
    Route::post('/sales/import', [SaleImportController::class, 'store']);
    Route::apiResource('sales', SaleController::class)->only(['index', 'store', 'show']);
    Route::post('/sales/{sale}/complete', [SaleController::class, 'complete']);
    Route::post('/sales/{sale}/cancel', [SaleController::class, 'cancel']);
    Route::post('/sales/{sale}/return', [SaleController::class, 'markReturned']);

    // Stock history
    Route::get('/stock-histories', [StockHistoryController::class, 'index']);

    // Listing Marketplace
    Route::get('/marketplace-listings', [MarketplaceListingController::class, 'index']);
    Route::get('/marketplace-listings/unmapped', [MarketplaceListingController::class, 'unmapped']);
    Route::post('/marketplace-listings/import', [MarketplaceListingController::class, 'import']);
    Route::post('/marketplace-listings/mapping', [MarketplaceListingController::class, 'map']);
    Route::post('/marketplace-listings/unmap', [MarketplaceListingController::class, 'unmap']);
    Route::post('/marketplace-listings/auto-map', [MarketplaceListingController::class, 'autoMap']);
    Route::post('/marketplace-listings/setup', [MarketplaceListingController::class, 'setup']);

    // Biaya operasional
    Route::apiResource('operational-expenses', OperationalExpenseController::class);

    // Khusus admin (grup ini DI DALAM grup login)
    Route::middleware(EnsureUserIsAdmin::class)->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index']);
        Route::apiResource('users', UserController::class)->except(['show']);
    });
});
