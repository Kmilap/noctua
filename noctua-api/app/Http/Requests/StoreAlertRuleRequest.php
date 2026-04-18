<?php

namespace App\Http\Requests;

use App\Models\AlertRule;
use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAlertRuleRequest extends FormRequest
{
    /**
     * Autorización: delegamos a la policy de AlertRule.
     * "¿Puede este usuario crear reglas?"
     */
    public function authorize(): bool
    {
        return $this->user()->can('create', AlertRule::class);
    }

    /**
     * Reglas de validación. Todos los campos son required excepto
     * los que tienen defaults razonables en la migración.
     */
    public function rules(): array
    {
        return [
            'service_id' => [
                'required',
                'integer',
                Rule::exists('services', 'id')->where(function ($query) {
                    // Solo services del mismo team del usuario.
                    $query->where('team_id', $this->user()->team_id);
                }),
            ],
            'metric_name' => ['required', 'string', 'max:100'],
            'operator' => ['required', 'string', Rule::in(AlertRule::OPERATORS)],
            'threshold' => ['required', 'numeric'],
            'consecutive_failures' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'severity' => ['sometimes', 'string', Rule::in(AlertRule::SEVERITIES)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Mensajes custom en español para mejor UX en React.
     */
    public function messages(): array
    {
        return [
            'service_id.exists' => 'El service especificado no existe o no pertenece a tu team.',
            'operator.in' => 'El operador debe ser uno de: ' . implode(', ', AlertRule::OPERATORS),
            'severity.in' => 'La severidad debe ser: info, warning o critical.',
        ];
    }
}