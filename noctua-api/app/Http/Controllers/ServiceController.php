<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreServiceRequest;
use App\Http\Requests\UpdateServiceRequest;
use App\Models\Service;
use App\Services\ContainerManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ServiceController extends Controller
{
    /**
     * Mensaje uniforme para las 4 rutas que dependen de ContainerManager
     * (store con plantilla, start, stop, restart) cuando el provisioning
     * de contenedores está apagado vía config('noctua.container_provisioning').
     */
    private const PROVISIONING_DISABLED_MESSAGE = 'El provisioning de contenedores está deshabilitado en este despliegue.';

    /**
     * ContainerManager se inyecta por constructor para facilitar testing
     * y mantener una sola instancia por request.
     */
    public function __construct(
        private readonly ContainerManager $containerManager,
    ) {
    }

    /**
     * Respuesta 422 uniforme cuando una operación requeriría hablarle a
     * ContainerManager pero container_provisioning está en false.
     */
    private function provisioningDisabledResponse(): JsonResponse
    {
        return response()->json([
            'message' => self::PROVISIONING_DISABLED_MESSAGE,
            'errors'  => [
                'container' => [self::PROVISIONING_DISABLED_MESSAGE],
            ],
        ], 422);
    }

    public function index(Request $request): JsonResponse
    {
        $services = $request->user()->team->services()->latest()->get();
        return response()->json($services);
    }

    /**
     * Crea un servicio. Dos modos según el payload:
     *
     * - Sin template_id: servicio externo (URL ya existente, monitoreo via heartbeats).
     *   No toca Docker. Comportamiento previo de Sprint 1.
     *
     * - Con template_id: servicio provisionado por Noctua.
     *   Crea fila en BD + arranca contenedor Docker en una transacción atómica.
     *   Si Docker falla, la fila se rollbackea: estado final consistente
     *   (o existe con contenedor, o no existe).
     */
    public function store(StoreServiceRequest $request): JsonResponse
    {
        $this->authorize('create', Service::class);

        $plainKey = Str::random(64);
        $hasTemplate = $request->filled('template_id');

        // Servicio externo: comportamiento simple, sin Docker.
        if (!$hasTemplate) {
            $service = $request->user()->team->services()->create([
                'name'         => $request->name,
                'url'          => $request->url,
                'api_key_hash' => hash('sha256', $plainKey),
                'status'       => 'unknown',
            ]);

            return response()->json([
                'service' => $service,
                'api_key' => $plainKey,
                'message' => 'Guardá esta API key, no se mostrará de nuevo.',
            ], 201);
        }

        // Con plantilla pero provisioning apagado: no llegar a ContainerManager.
        if (!config('noctua.container_provisioning')) {
            return $this->provisioningDisabledResponse();
        }

        // Servicio con plantilla: BD + Docker en transacción.
        try {
            $service = DB::transaction(function () use ($request, $plainKey) {
                $hostPort = (int) $request->host_port;

                $service = $request->user()->team->services()->create([
                    'name'         => $request->name,
                    // URL autogenerada en dev. En S7 cambia a dominio público
                    // con reverse proxy: https://{slug}-{id}.{domain}.
                    'url'          => 'http://' . config('noctua.health_check_host') . ":{$hostPort}",
                    'api_key_hash' => hash('sha256', $plainKey),
                    'status'       => 'unknown',
                    'template_id'  => (int) $request->template_id,
                    'host_port'    => $hostPort,
                ]);

                // ContainerManager::create lanza ValidationException o RuntimeException
                // si falla. Cualquiera de las dos aborta la transacción y rollbackea.
                $this->containerManager->create($service, $plainKey);

                return $service->fresh();
            });

            return response()->json([
                'service' => $service,
                'api_key' => $plainKey,
                'message' => 'Servicio provisionando. El contenedor estará listo en unos segundos.',
            ], 201);
        } catch (ValidationException $e) {
            // Errores de validación del manager (puerto en uso, límite alcanzado, etc.)
            // se propagan tal cual: Laravel los serializa como 422 con estructura.
            throw $e;
        } catch (RuntimeException $e) {
            // Docker falló (daemon down, imagen no descargada, etc.)
            // Logueamos el error técnico completo para debug, pero al cliente
            // le devolvemos un mensaje sanitizado sin stderr de Docker.
            Log::error('ServiceController::store fallo Docker', [
                'team_id'     => $request->user()->team_id,
                'template_id' => $request->template_id,
                'host_port'   => $request->host_port,
                'error'       => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'No se pudo provisionar el contenedor. Intenta de nuevo en unos segundos.',
                'errors'  => [
                    'container' => ['El motor de contenedores no respondió correctamente.'],
                ],
            ], 500);
        }
    }

    public function show(Request $request, Service $service): JsonResponse
    {
        $this->authorize('view', $service);
        return response()->json($service);
    }

    public function update(UpdateServiceRequest $request, Service $service): JsonResponse
    {
        $this->authorize('update', $service);
        $service->update($request->validated());
        return response()->json($service);
    }

    /**
     * Elimina un servicio. Si tiene contenedor asociado, lo destruye antes.
     *
     * Síncrono: la operación toma 2-5s en mediciones E2E. SLA aceptable.
     * Migración a job async documentada como deuda técnica con criterio:
     * si p95 supera 10s, refactorizar a estado 'destroying' + queue.
     */
    public function destroy(Request $request, Service $service): JsonResponse
    {
        $this->authorize('delete', $service);

        // Si el servicio tiene contenedor, lo destruimos primero.
        // ContainerManager::destroy es idempotente: si el contenedor ya
        // no existe en Docker, no lanza excepción.
        if ($service->container_id !== null) {
            try {
                $this->containerManager->destroy($service);
            } catch (RuntimeException $e) {
                // Si Docker falla al destruir, no eliminamos la fila:
                // el operador debe poder reintentar. Devolver 500 sin tocar BD.
                Log::error('ServiceController::destroy fallo Docker', [
                    'service_id'   => $service->id,
                    'container_id' => $service->container_id,
                    'error'        => $e->getMessage(),
                ]);

                return response()->json([
                    'message' => 'No se pudo destruir el contenedor. Intenta de nuevo.',
                    'errors'  => [
                        'container' => ['El motor de contenedores no respondió correctamente.'],
                    ],
                ], 500);
            }
        }

        $service->delete();

        return response()->json(['message' => 'Servicio eliminado.']);
    }

    /**
     * Inicia un contenedor detenido.
     */
    public function start(Request $request, Service $service): JsonResponse
    {
        $this->authorize('start', $service);

        if (!config('noctua.container_provisioning')) {
            return $this->provisioningDisabledResponse();
        }

        try {
            $this->containerManager->start($service);
        } catch (RuntimeException $e) {
            return $this->dockerErrorResponse('iniciar', $service, $e);
        }

        return response()->json([
            'service' => $service->fresh(),
            'message' => 'Servicio iniciándose.',
        ]);
    }

    /**
     * Detiene un contenedor en ejecución (sin destruirlo).
     */
    public function stop(Request $request, Service $service): JsonResponse
    {
        $this->authorize('stop', $service);

        if (!config('noctua.container_provisioning')) {
            return $this->provisioningDisabledResponse();
        }

        try {
            $this->containerManager->stop($service);
        } catch (RuntimeException $e) {
            return $this->dockerErrorResponse('detener', $service, $e);
        }

        return response()->json([
            'service' => $service->fresh(),
            'message' => 'Servicio detenido.',
        ]);
    }

    /**
     * Reinicia un contenedor.
     */
    public function restart(Request $request, Service $service): JsonResponse
    {
        $this->authorize('restart', $service);

        if (!config('noctua.container_provisioning')) {
            return $this->provisioningDisabledResponse();
        }

        try {
            $this->containerManager->restart($service);
        } catch (RuntimeException $e) {
            return $this->dockerErrorResponse('reiniciar', $service, $e);
        }

        return response()->json([
            'service' => $service->fresh(),
            'message' => 'Servicio reiniciándose.',
        ]);
    }

    /**
     * Helper para respuestas de error de Docker en operaciones runtime.
     * Centraliza el logging y el formato de respuesta.
     */
    private function dockerErrorResponse(string $action, Service $service, RuntimeException $e): JsonResponse
    {
        Log::error("ServiceController fallo Docker al {$action}", [
            'service_id'   => $service->id,
            'container_id' => $service->container_id,
            'error'        => $e->getMessage(),
        ]);

        return response()->json([
            'message' => "No se pudo {$action} el contenedor.",
            'errors'  => [
                'container' => ['El motor de contenedores no respondió correctamente.'],
            ],
        ], 500);
    }
}
