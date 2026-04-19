<?php

namespace App\Http\Requests;

use App\Models\NotificationChannel;
use Illuminate\Foundation\Http\FormRequest;

class UpdateNotificationChannelRequest extends FormRequest
{
    /**
     * Autorización: solo admins del mismo team.
     * La policy valida ambas condiciones (team + rol admin).
     */
    public function authorize(): bool
    {
        $channel = $this->route('notification_channel');
        return $this->user()->can('update', $channel);
    }

    /**
     * Reglas con 'sometimes' — update parcial.
     * No se permite cambiar el 'type' (un canal email no se convierte en slack).
     * Si se quiere cambiar tipo, se elimina y se crea otro.
     */
    public function rules(): array
    {
        /** @var NotificationChannel $channel */
        $channel = $this->route('notification_channel');

        $rules = [
            'config'    => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ];

        // Si mandan config, validamos según el tipo existente del canal
        if ($this->has('config')) {
            if ($channel->type === 'email') {
                $rules['config.address'] = ['required', 'email', 'max:255'];
            }

            if ($channel->type === 'slack') {
                $rules['config.webhook_url'] = [
                    'required',
                    'url',
                    'starts_with:https://hooks.slack.com/',
                    'max:500',
                ];
            }
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'config.address.email'           => 'El email debe tener un formato válido.',
            'config.webhook_url.starts_with' => 'El webhook URL debe ser de Slack.',
        ];
    }
}