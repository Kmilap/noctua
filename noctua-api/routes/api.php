<?php

use App\Http\Controllers\AlertRuleController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HeartbeatController;
use App\Http\Controllers\IncidentController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\MetricController;
use App\Http\Controllers\NotificationChannelController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\ServiceStatusController;
use App\Http\Controllers\ServiceTemplateController;
use App\Http\Controllers\TeamController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SelfCheckController;

require __DIR__.'/auth.php';

Route::get('/self-check', [SelfCheckController::class, 'index'])->middleware('throttle:30,1');

// Invitaciones — públicas (no requieren auth)
Route::post('/invitations/{token}/accept', [InvitationController::class, 'accept']);

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user()->load('roles');
    });

    Route::post('/logout', [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'destroy']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::get('/services/status', [ServiceStatusController::class, 'index']);

    Route::post('services/{service}/start',   [ServiceController::class, 'start']);
    Route::post('services/{service}/stop',    [ServiceController::class, 'stop']);
    Route::post('services/{service}/restart', [ServiceController::class, 'restart']);

    Route::apiResource('services', ServiceController::class);
    Route::get('services/{service}/metrics/history', [MetricController::class, 'history']);
    Route::get('services/{service}/metrics/summary',  [MetricController::class, 'summary']);

    Route::get('/service-templates', [ServiceTemplateController::class, 'index']);

    Route::get('/team', [TeamController::class, 'show']);
    Route::put('/team', [TeamController::class, 'update']);

    // Invitaciones — requieren auth (solo admin)
    Route::post('/invitations', [InvitationController::class, 'store']);

    // Alert Rules
    Route::patch('alert-rules/{alert_rule}/toggle-active', [AlertRuleController::class, 'toggleActive']);
    Route::apiResource('alert-rules', AlertRuleController::class);

    // Incidents
    Route::post('incidents/{incident}/acknowledge', [IncidentController::class, 'acknowledge']);
    Route::post('incidents/{incident}/resolve',     [IncidentController::class, 'resolve']);
    Route::apiResource('incidents', IncidentController::class)->only(['index', 'show']);

    // Notification Channels
    Route::patch('notification-channels/{notification_channel}/toggle-active', [NotificationChannelController::class, 'toggleActive']);
    Route::post('notification-channels/{notification_channel}/test',           [NotificationChannelController::class, 'test']);
    Route::apiResource('notification-channels', NotificationChannelController::class);
});

Route::middleware([\App\Http\Middleware\ApiKeyAuth::class])->group(function () {
    Route::post('/metrics',   [MetricController::class, 'store'])->middleware('throttle:60,1');
    Route::post('/heartbeat', [HeartbeatController::class, 'store'])->middleware('throttle:60,1');
});

// Gestión de miembros del equipo
Route::middleware(['auth:sanctum'])->group(function () {
    Route::patch('/team/members/{user}', [\App\Http\Controllers\TeamController::class, 'updateMember']);
});
