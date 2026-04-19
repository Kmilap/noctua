<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreNotificationChannelRequest;
use App\Http\Requests\UpdateNotificationChannelRequest;
use App\Models\AlertIncident;
use App\Models\NotificationChannel;
use App\Notifications\IncidentTriggeredNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Throwable;

class NotificationChannelController extends Controller
{
    /**
     * GET /api/notification-channels
     * Lista los canales del team del usuario autenticado.
     * Soporta filtro opcional ?type=email|slack y ?is_active=true/false.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', NotificationChannel::class);

        $query = NotificationChannel::query()
            ->where('team_id', $request->user()->team_id);

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $channels = $query->orderByDesc('id')->paginate(20);

        return response()->json($channels);
    }

    /**
     * POST /api/notification-channels
     * Crea un canal nuevo. FormRequest ya validó y autorizó.
     */
    public function store(StoreNotificationChannelRequest $request): JsonResponse
    {
        $channel = NotificationChannel::create($request->validated());

        return response()->json($channel, 201);
    }

    /**
     * GET /api/notification-channels/{notification_channel}
     */
    public function show(NotificationChannel $notificationChannel): JsonResponse
    {
        $this->authorize('view', $notificationChannel);

        return response()->json($notificationChannel);
    }

    /**
     * PATCH /api/notification-channels/{notification_channel}
     */
    public function update(
        UpdateNotificationChannelRequest $request,
        NotificationChannel $notificationChannel
    ): JsonResponse {
        $notificationChannel->update($request->validated());

        return response()->json($notificationChannel->fresh());
    }

    /**
     * DELETE /api/notification-channels/{notification_channel}
     */
    public function destroy(NotificationChannel $notificationChannel): JsonResponse
    {
        $this->authorize('delete', $notificationChannel);

        $notificationChannel->delete();

        return response()->json(null, 204);
    }

    /**
     * POST /api/notification-channels/{notification_channel}/test
     * Envía una notificación de prueba para verificar que el canal funciona.
     * Busca un incidente real del team para usar como muestra —
     * así el usuario ve exactamente cómo se verán los emails reales.
     */
    public function test(NotificationChannel $notificationChannel): JsonResponse
    {
        $this->authorize('test', $notificationChannel);

        try {
            $sampleIncident = AlertIncident::query()
                ->whereHas('alertRule.service', function ($q) use ($notificationChannel) {
                    $q->where('team_id', $notificationChannel->team_id);
                })
                ->with(['alertRule.service'])
                ->latest('id')
                ->first();

            if ($sampleIncident === null) {
                return response()->json([
                    'message' => 'No hay incidentes en el sistema para usar como muestra. Crea una regla y dispara un incidente primero.',
                ], 422);
            }

            match ($notificationChannel->type) {
                'email' => $this->testEmail($notificationChannel, $sampleIncident),
                'slack' => $this->testSlack($notificationChannel, $sampleIncident),
                default => throw new \RuntimeException("Tipo de canal no soportado: {$notificationChannel->type}"),
            };

            return response()->json([
                'message' => 'Notificación de prueba enviada exitosamente.',
                'channel' => $notificationChannel->only(['id', 'type']),
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Fallo al enviar notificación de prueba.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * PATCH /api/notification-channels/{notification_channel}/toggle-active
     * Endpoint de conveniencia para la UI.
     */
    public function toggleActive(NotificationChannel $notificationChannel): JsonResponse
    {
        $this->authorize('update', $notificationChannel);

        $notificationChannel->update([
            'is_active' => !$notificationChannel->is_active,
        ]);

        return response()->json($notificationChannel);
    }

    // ---------- Helpers privados del endpoint de test ----------

    private function testEmail(NotificationChannel $channel, AlertIncident $incident): void
    {
        $address = $channel->config['address'] ?? null;

        if (!$address) {
            throw new \RuntimeException('Canal email sin address configurado.');
        }

        Notification::route('mail', $address)
            ->notify(new IncidentTriggeredNotification($incident));
    }

    private function testSlack(NotificationChannel $channel, AlertIncident $incident): void
    {
        $webhook = $channel->config['webhook_url'] ?? null;

        if (!$webhook) {
            throw new \RuntimeException('Canal slack sin webhook_url configurado.');
        }

        $rule     = $incident->alertRule;
        $service  = $rule?->service;
        $severity = strtoupper($rule->severity ?? 'warning');

        $response = Http::timeout(10)->post($webhook, [
            'text' => "✅ *[Noctua] Test de canal:* canal tipo {$channel->type} funcionando correctamente."
                    . "(Severidad de muestra: {$severity}, servicio: " . ($service->name ?? 'N/A') . ")",
        ]);

        if (!$response->successful()) {
            throw new \RuntimeException(
                "Slack webhook respondió con status {$response->status()}: {$response->body()}"
            );
        }
    }
}