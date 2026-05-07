<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Solo se actualizan campos de metadata.
     *
     * template_id y host_port NO son editables después de creado el servicio:
     * cambiarlos requeriría destruir y recrear el contenedor, lo cual es una
     * operación distinta y se hace via destroy + create separados, no via PUT.
     */
    public function rules(): array
    {
        return [
            'name'   => 'sometimes|required|string|max:255',
            'url'    => 'sometimes|nullable|url|max:500',
            'status' => 'sometimes|in:active,warning,critical,unknown',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre del servicio es obligatorio.',
            'url.url'       => 'La URL debe tener un formato válido.',
            'status.in'     => 'El estado debe ser: active, warning, critical o unknown.',
        ];
    }
}
