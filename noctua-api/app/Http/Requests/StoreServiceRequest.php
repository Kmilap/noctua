<?php

namespace App\Http\Requests;

use App\Models\Service;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'url'  => 'nullable|url|max:500',

            // Campos de servicio con plantilla (Sprint 2 D5).
            // Si viene template_id, host_port se vuelve obligatorio
            // y se valida que esté libre y en rango seguro.
            'template_id' => 'nullable|integer|exists:service_templates,id',
            'host_port'   => [
                'nullable',
                'integer',
                'min:1024',
                'max:9999',
                'required_with:template_id',
            ],
        ];
    }

    /**
     * Validación adicional: el host_port no puede estar en uso por otro
     * servicio activo. La validación se hace fuera de rules() porque
     * requiere consultar BD con lógica más compleja que un simple
     * unique:services,host_port (no queremos chocar con servicios
     * destruidos cuyo registro aún existe pero con container_id=null).
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $hostPort = $this->input('host_port');

            if (!$hostPort) {
                return;
            }

            $portInUse = Service::query()
                ->where('host_port', $hostPort)
                ->whereNotNull('container_id')
                ->whereIn('container_status', ['starting', 'running'])
                ->exists();

            if ($portInUse) {
                $validator->errors()->add(
                    'host_port',
                    "El puerto {$hostPort} ya está en uso por otro contenedor activo."
                );
            }
        });
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre del servicio es obligatorio.',
            'url.url'       => 'La URL debe tener un formato válido.',

            'template_id.integer' => 'La plantilla seleccionada es inválida.',
            'template_id.exists'  => 'La plantilla seleccionada no existe en el catálogo.',

            'host_port.required_with' => 'Debes indicar el puerto cuando creas un servicio desde plantilla.',
            'host_port.integer'       => 'El puerto debe ser un número entero.',
            'host_port.min'           => 'El puerto debe ser mayor o igual a 1024 (rango no privilegiado).',
            'host_port.max'           => 'El puerto debe ser menor o igual a 9999 (rango reservado por Noctua).',
        ];
    }
}
