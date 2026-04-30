<?php
namespace App\Http\Controllers;
use App\Models\AlertIncident;
use App\Services\IncidentManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class IncidentController extends Controller
{
    /**
     * GET /api/incidents
     * Lista los incidentes del team del usuario autenticado.
     * Soporta filtros: ?status=triggered, ?service_id=X, ?alert_rule_id=Y.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', AlertIncident::class);
        $query = AlertIncident::query()
            ->whereHas('alertRule.service', function ($q) use ($request) {
                $q->where('team_id', $request->user()->team_id);
            })
            ->with([
                'alertRule:id,service_id,metric_name,operator,threshold,severity',
                'alertRule.service:id,name,team_id',
                'acknowledgedBy:id,name,email',
                'resolvedBy:id,name,email',
            ]);
        if ($request->filled('status')) {
            $query->byStatus($request->string('status')->toString());
        }
        if ($request->filled('alert_rule_id')) {
            $query->where('alert_rule_id', $request->integer('alert_rule_id'));
        }
        if ($request->filled('service_id')) {
            $query->whereHas('alertRule', function ($q) use ($request) {
                $q->where('service_id', $request->integer('service_id'));
            });
        }
        $incidents = $query->orderByDesc('triggered_at')->paginate(20);
        return response()->json($incidents);
    }

    /**
     * GET /api/incidents/{incident}
     */
    public function show(AlertIncident $incident): JsonResponse
    {
        $this->authorize('view', $incident);
        return response()->json(
            $incident->load([
                'alertRule.service:id,name,team_id',
                'acknowledgedBy:id,name,email',
                'resolvedBy:id,name,email',
            ])
        );
    }

    /**
     * POST /api/incidents/{incident}/acknowledge
     * Transiciona el incidente a 'acknowledged'.
     * La validación de transición vive en el modelo (lanza excepción si es inválida).
     */
    public function acknowledge(Request $request, AlertIncident $incident): JsonResponse
    {
        $this->authorize('acknowledge', $incident);
        try {
            $incident = IncidentManager::acknowledge($incident, $request->user()->id);
        } catch (\RuntimeException $e) {
            // La máquina de estados rechazó la transición.
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Acknowledge failed', [
                'incident_id' => $incident->id,
                'user_id'     => $request->user()->id,
                'error'       => $e->getMessage(),
            ]);
            throw $e;
        }
        return response()->json($incident->load([
            'alertRule.service:id,name,team_id',
            'acknowledgedBy:id,name,email',
        ]));
    }

    /**
     * POST /api/incidents/{incident}/resolve
     * Transiciona el incidente a 'resolved'.
     */
    public function resolve(Request $request, AlertIncident $incident): JsonResponse
    {
        $this->authorize('resolve', $incident);
        try {
            $incident = IncidentManager::resolve($incident, $request->user()->id);
        } catch (\RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Resolve failed', [
                'incident_id' => $incident->id,
                'user_id'     => $request->user()->id,
                'error'       => $e->getMessage(),
            ]);
            throw $e;
        }
        return response()->json($incident->load([
            'alertRule.service:id,name,team_id',
            'acknowledgedBy:id,name,email',
            'resolvedBy:id,name,email',
        ]));
    }
}