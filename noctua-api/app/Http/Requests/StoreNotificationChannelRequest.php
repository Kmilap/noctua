<?php

namespace App\Http\Requests;

use App\Models\NotificationChannel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreNotificationChannelRequest extends FormRequest
{
    /**
     * Autorización: delegamos a la policy.
     * "¿Puede este usuario crear canales?" (solo admin)
     */
    public function authorize(): bool
    {
        return $this->user()->can('create', NotificationChannel::class);
    }

    /**
     * Reglas base + validación dinámica del config según el tipo de canal.
     * Los campos del JSONB config varían: email necesita address, slack necesita webhook_url.
     */
public function rules(): array
{
    $rules = [
        'type'      => ['required', 'string', Rule::in(NotificationChannel::TYPES)],
        'config'    => ['required', 'array'],
        'is_active' => ['sometimes', 'boolean'],
    ];

    if ($this->input('type') === 'email') {
        $rules['config.address'] = ['required', 'email', 'max:255'];
    }

    if ($this->input('type') === 'slack') {
        $rules['config.webhook_url'] = [
            'required',
            'url',
            'starts_with:https://hooks.slack.com/',
            'max:500',
        ];
    }

    return $rules;
}

    /**
     * Agregamos team_id a los datos validados.
     * El cliente nunca debería poder especificar team_id — se inyecta
     * automáticamente desde el usuario autenticado (multitenancy seguro).
     */
    public function validated($key = null, $default = null): array
    {
        $validated = parent::validated($key, $default);
        $validated['team_id'] = $this->user()->team_id;
        return $validated;
    }

    public function messages(): array
    {
        return [
            'type.in'                        => 'El tipo debe ser: ' . implode(', ', NotificationChannel::TYPES),
            'config.address.required'        => 'El email es obligatorio para canales de tipo email.',
            'config.address.email'           => 'El email debe tener un formato válido.',
            'config.webhook_url.required'    => 'El webhook URL es obligatorio para canales de Slack.',
            'config.webhook_url.starts_with' => 'El webhook URL debe ser de Slack (empezar con https://hooks.slack.com/).',
        ];
    }
}