<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAlertRuleRequest;
use App\Http\Requests\UpdateAlertRuleRequest;
use App\Models\AlertRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AlertRuleController extends Controller
{
    /**
     * GET /api/alert-rules
     * Lista las reglas del team del usuario autenticado.
     * Soporta filtro opcional ?service_id=X y ?is_active=true/false.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', AlertRule::class);

        $query = AlertRule::query()
            ->whereHas('service', function ($q) use ($request) {
                $q->where('team_id', $request->user()->team_id);
            })
            ->with('service:id,name,team_id');

        if ($request->filled('service_id')) {
            $query->where('service_id', $request->integer('service_id'));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $rules = $query->orderByDesc('id')->paginate(20);

        return response()->json($rules);
    }

    /**
     * POST /api/alert-rules
     * Crea una regla nueva. FormRequest ya validó y autorizó.
     */
    public function store(StoreAlertRuleRequest $request): JsonResponse
    {
        $rule = AlertRule::create($request->validated());

        return response()->json(
            $rule->load('service:id,name,team_id'),
            201
        );
    }

    /**
     * GET /api/alert-rules/{alert_rule}
     * Muestra una regla específica.
     */
    public function show(AlertRule $alertRule): JsonResponse
    {
        $this->authorize('view', $alertRule);

        return response()->json(
            $alertRule->load('service:id,name,team_id')
        );
    }

    /**
     * PATCH /api/alert-rules/{alert_rule}
     * Actualiza campos de la regla.
     */
    public function update(UpdateAlertRuleRequest $request, AlertRule $alertRule): JsonResponse
    {
        $alertRule->update($request->validated());

        return response()->json(
            $alertRule->fresh(['service:id,name,team_id'])
        );
    }

    /**
     * DELETE /api/alert-rules/{alert_rule}
     */
    public function destroy(AlertRule $alertRule): JsonResponse
    {
        $this->authorize('delete', $alertRule);

        $alertRule->delete();

        return response()->json(null, 204);
    }

    /**
     * PATCH /api/alert-rules/{alert_rule}/toggle-active
     * Endpoint de conveniencia para la UI: activar/desactivar
     * sin tener que mandar PATCH con el nuevo valor.
     */
    public function toggleActive(AlertRule $alertRule): JsonResponse
    {
        $this->authorize('toggleActive', $alertRule);

        $alertRule->update([
            'is_active' => !$alertRule->is_active,
        ]);

        return response()->json($alertRule);
    }
}