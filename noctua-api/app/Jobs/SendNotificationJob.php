<?php

namespace App\Jobs;

use App\Models\AlertIncident;
use App\Models\NotificationChannel;
use App\Models\NotificationLog;
use App\Notifications\IncidentTriggeredNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

class SendNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Número de reintentos si el job falla por completo (ej: excepción no controlada).
     * Los errores por canal individual NO cuentan aquí — esos se manejan con try/catch
     * y se registran en notification_logs con status=failed.
     */
    public int $tries = 3;

    public int $backoff = 10;

    public function __construct(public AlertIncident $incident)
    {
    }

    public function handle(): void
    {
        // Cargar relaciones necesarias para obtener el team del incidente
        $this->incident->loadMissing(['alertRule.service']);

        $service = $this->incident->alertRule?->service;

        if (!$service) {
            Log::warning('SendNotificationJob: incidente sin servicio asociado', [
                'incident_id' => $this->incident->id,
            ]);
            return;
        }

        // Buscar canales activos del team del servicio
        $channels = NotificationChannel::query()
            ->where('team_id', $service->team_id)
            ->where('is_active', true)
            ->get();

        if ($channels->isEmpty()) {
            Log::info('SendNotificationJob: team sin canales activos', [
                'incident_id' => $this->incident->id,
                'team_id'     => $service->team_id,
            ]);
            return;
        }

        // Enviar por cada canal, aislando fallos para que uno no tumbe a los demás
        foreach ($channels as $channel) {
            $this->dispatchToChannel($channel);
        }
    }

    /**
     * Envía la notificación por un canal individual y registra el resultado.
     * Cada canal se maneja con try/catch para que un fallo no afecte a los otros.
     */
    private function dispatchToChannel(NotificationChannel $channel): void
    {
        try {
            match ($channel->type) {
                'email' => $this->sendEmail($channel),
                'slack' => $this->sendSlack($channel),
                default => throw new \RuntimeException("Tipo de canal no soportado: {$channel->type}"),
            };

            $this->logSuccess($channel);
        } catch (Throwable $e) {
            Log::error('SendNotificationJob: fallo enviando a canal', [
                'incident_id' => $this->incident->id,
                'channel_id'  => $channel->id,
                'channel_type'=> $channel->type,
                'error'       => $e->getMessage(),
            ]);

            $this->logFailure($channel, $e->getMessage());
        }
    }

    /**
     * Envía email vía Laravel Notification usando AnonymousNotifiable.
     * AnonymousNotifiable permite enviar a un email arbitrario sin necesidad
     * de un modelo User — útil porque el email del canal puede ser de un grupo.
     */
    private function sendEmail(NotificationChannel $channel): void
    {
        $address = $channel->config['address'] ?? null;

        if (!$address) {
            throw new \RuntimeException('Canal email sin address configurado');
        }

        Notification::route('mail', $address)
            ->notify(new IncidentTriggeredNotification($this->incident));
    }

    /**
     * Envía mensaje a Slack vía webhook. Formato simple con bloques de texto.
     */
    private function sendSlack(NotificationChannel $channel): void
    {
        $webhook = $channel->config['webhook_url'] ?? null;

        if (!$webhook) {
            throw new \RuntimeException('Canal slack sin webhook_url configurado');
        }

        $rule        = $this->incident->alertRule;
        $service     = $rule?->service;
        $severity    = strtoupper($rule->severity ?? 'warning');
        $serviceName = $service->name ?? 'Servicio desconocido';
        $condition   = trim(($rule->metric_name ?? 'N/A') . ' ' . ($rule->operator ?? '') . ' ' . ($rule->threshold ?? ''));
        $triggeredAt = $this->incident->triggered_at?->format('Y-m-d H:i:s') ?? now()->format('Y-m-d H:i:s');

        $payload = [
            'text'   => "*[Noctua] [{$severity}] Incidente en {$serviceName}*",
            'blocks' => [
                [
                    'type' => 'header',
                    'text' => [
                        'type' => 'plain_text',
                        'text' => "🚨 [{$severity}] Incidente #{$this->incident->id}",
                    ],
                ],
                [
                    'type'   => 'section',
                    'fields' => [
                        ['type' => 'mrkdwn', 'text' => "*Servicio:*\n{$serviceName}"],
                        ['type' => 'mrkdwn', 'text' => "*Condición:*\n{$condition}"],
                        ['type' => 'mrkdwn', 'text' => "*Severidad:*\n{$severity}"],
                        ['type' => 'mrkdwn', 'text' => "*Disparado:*\n{$triggeredAt}"],
                    ],
                ],
            ],
        ];

        $response = Http::timeout(10)->post($webhook, $payload);

        if (!$response->successful()) {
            throw new \RuntimeException(
                "Slack webhook respondió con status {$response->status()}: {$response->body()}"
            );
        }
    }

    private function logSuccess(NotificationChannel $channel): void
    {
        NotificationLog::create([
            'alert_incident_id'       => $this->incident->id,
            'notification_channel_id' => $channel->id,
            'status'                  => 'sent',
            'error_message'           => null,
            'sent_at'                 => now(),
        ]);
    }

    private function logFailure(NotificationChannel $channel, string $error): void
    {
        NotificationLog::create([
            'alert_incident_id'       => $this->incident->id,
            'notification_channel_id' => $channel->id,
            'status'                  => 'failed',
            'error_message'           => substr($error, 0, 1000),
            'sent_at'                 => now(),
        ]);
    }
}