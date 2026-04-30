<?php

use App\Http\Controllers\AlertRuleController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HeartbeatController;
use App\Http\Controllers\IncidentController;
use App\Http\Controllers\MetricController;
use App\Http\Controllers\NotificationChannelController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\ServiceStatusController;
use App\Http\Controllers\TeamController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Rutas de autenticación
require __DIR__.'/auth.php';

// Rutas protegidas por Sanctum
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user()->load('roles');
    });

    Route::post('/logout', [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'destroy']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::get('/services/status', [ServiceStatusController::class, 'index']);
    Route::apiResource('services', ServiceController::class);
    Route::get('services/{service}/metrics/history', [MetricController::class, 'history']);

    Route::get('/team', [TeamController::class, 'show']);
    Route::put('/team', [TeamController::class, 'update']);

    // Sprint 3.1 — Alert Rules
    Route::patch('alert-rules/{alert_rule}/toggle-active', [AlertRuleController::class, 'toggleActive']);
    Route::apiResource('alert-rules', AlertRuleController::class);

    // Sprint 3.1 — Incidents
    Route::post('incidents/{incident}/acknowledge', [IncidentController::class, 'acknowledge']);
    Route::post('incidents/{incident}/resolve', [IncidentController::class, 'resolve']);
    Route::apiResource('incidents', IncidentController::class)
        ->only(['index', 'show']);

    // Sprint 3.2 — Notification Channels
    Route::patch('notification-channels/{notification_channel}/toggle-active', [NotificationChannelController::class, 'toggleActive']);
    Route::post('notification-channels/{notification_channel}/test', [NotificationChannelController::class, 'test']);
    Route::apiResource('notification-channels', NotificationChannelController::class);
    
});

// Rutas protegidas por API key (ingesta) con rate limiting
Route::middleware([\App\Http\Middleware\ApiKeyAuth::class])->group(function () {
    Route::post('/metrics', [MetricController::class, 'store'])->middleware('throttle:60,1');
    Route::post('/heartbeat', [HeartbeatController::class, 'store'])->middleware('throttle:60,1');
});