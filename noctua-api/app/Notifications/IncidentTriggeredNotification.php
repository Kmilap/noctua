<?php

namespace App\Notifications;

use App\Models\AlertIncident;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class IncidentTriggeredNotification extends Notification
{
    use Queueable;

    public function __construct(public AlertIncident $incident)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

public function toMail(object $notifiable): MailMessage
{
    $incident = $this->incident->loadMissing(['alertRule.service']);
    $rule     = $incident->alertRule;
    $service  = $rule?->service;

    $severity    = strtoupper($rule->severity ?? 'warning');
    $serviceName = $service->name ?? 'Servicio desconocido';
    $metric      = $rule->metric_name ?? 'N/A';
    $operator    = $rule->operator ?? '';
    $threshold   = $rule->threshold ?? '';
    $triggeredAt = $incident->triggered_at?->format('Y-m-d H:i:s') ?? now()->format('Y-m-d H:i:s');

    $ruleDescription = trim("{$metric} {$operator} {$threshold}");

    // URL al detalle del incidente en el frontend.
    // Mismo patrón que welcome.blade.php: config con fallback a env.
    $frontendUrl = rtrim(
        config('app.frontend_url', env('FRONTEND_URL', '/')),
        '/'
    );
    $incidentUrl = "{$frontendUrl}/incidents/{$incident->id}";

    return (new MailMessage)
        ->subject("[Noctua] [{$severity}] Incidente en {$serviceName}")
        ->view('emails.incident-triggered', [
            'serviceName'     => $serviceName,
            'severity'        => $severity,
            'ruleDescription' => $ruleDescription,
            'triggeredAt'     => $triggeredAt,
            'incidentId'      => $incident->id,
            'incidentUrl'     => $incidentUrl,
        ]);
}

    public function toArray(object $notifiable): array
    {
        return [
            'incident_id'   => $this->incident->id,
            'alert_rule_id' => $this->incident->alert_rule_id,
            'severity'      => $this->incident->alertRule?->severity,
        ];
    }
}
