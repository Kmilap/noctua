<?php

namespace App\Http\Controllers;

use App\Models\ServiceTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceTemplateController extends Controller
{
    /**
     * Lista el catálogo de plantillas disponibles para provisionar servicios.
     *
     * Cualquier usuario autenticado puede ver el catálogo: incluso un viewer
     * necesita saber qué plantillas existen para entender qué tipo de servicios
     * hay en el sistema. La autorización para CREAR un servicio con plantilla
     * se aplica en ServiceController, no aquí.
     */
    public function index(Request $request): JsonResponse
    {
        $templates = ServiceTemplate::query()
            ->orderBy('category')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'slug',
                'image',
                'internal_port',
                'category',
                'description',
                'icon',
                'persistent',
            ]);

        return response()->json([
            'data' => $templates,
        ]);
    }
}
