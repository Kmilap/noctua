<?php

namespace App\Http\Requests;

use App\Models\AlertRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAlertRuleRequest extends FormRequest
{
    /**
     * Autorización: delegamos a la policy de AlertRule, método update.
     * Necesitamos acceder a la regla del route para pasarla a la policy.
     */
    public function authorize(): bool
    {
        $rule = $this->route('alert_rule');
        return $this->user()->can('update', $rule);
    }

    /**
     * Reglas de validación. Todos los campos con 'sometimes' —
     * en update parcial, solo validamos lo que llega.
     *
     * Nota: no permitimos cambiar service_id. Si alguien quiere
     * mover una regla a otro service, elimina y crea otra.
     */
    public function rules(): array
    {
        return [
            'metric_name' => ['sometimes', 'string', 'max:100'],
            'operator' => ['sometimes', 'string', Rule::in(AlertRule::OPERATORS)],
            'threshold' => ['sometimes', 'numeric'],
            'consecutive_failures' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'severity' => ['sometimes', 'string', Rule::in(AlertRule::SEVERITIES)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'operator.in' => 'El operador debe ser uno de: ' . implode(', ', AlertRule::OPERATORS),
            'severity.in' => 'La severidad debe ser: info, warning o critical.',
        ];
    }
}