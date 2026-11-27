<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/*
 | Middleware de integracion Noctua <-> framework ARYA (umbra ADR-003).
 |
 | 1) Puerta del laboratorio. La superficie vulnerable solo "existe" con
 |    APP_ENV=lab Y umbra.lab_enabled=true. Si no se cumplen, responde 404
 |    como si la ruta no estuviera. La comprobacion vive aqui (no en un `if`
 |    en api.php) para que la ruta se compile con route:cache y la condicion
 |    se evalue en cada peticion, no al cachear.
 |
 | 2) Interceptacion. Envia la peticion al punto de entrada unico del
 |    framework (POST /interceptar del detector) con el contrato Peticion de
 |    ADR-002: origen, ruta, parametro, valor. El framework decide:
 |      - accion=permitir -> la peticion sigue al controlador real.
 |      - accion=senuelo  -> se devuelve la respuesta generada por el senuelo
 |        con la misma forma JSON del endpoint real; el controlador NO corre.
 |
 | 3) Fallo cerrado (ADR-003, decision 5). Tiempo agotado, error HTTP o cuerpo
 |    invalido -> 503. Invariante: la peticion llega al controlador solo si
 |    el framework respondio accion=permitir.
 |
 | El nombre del parametro vigilado llega como argumento del middleware
 | (p. ej. 'lab.deception:host'). Las rutas normales de Noctua no pasan por
 | este middleware.
 */
class LabDeception
{
    public function handle(Request $request, Closure $next, string $parametro = 'host'): Response
    {
        // 1) Puerta del laboratorio: doble condicion.
        if (!app()->environment('lab') || !config('umbra.lab_enabled')) {
            abort(404);
        }

        $valor = (string) $request->input($parametro, '');

        // 2) Contrato Peticion (ADR-002): sin campos adicionales.
        $peticion = [
            'origen'    => hash('sha256', (string) $request->ip()),
            'ruta'      => '/' . ltrim($request->path(), '/'),
            'parametro' => $parametro,
            'valor'     => $valor,
        ];

        try {
            $respuesta = Http::timeout((float) config('umbra.detector_timeout', 30.0))
                ->acceptJson()
                ->post(config('umbra.detector_url'), $peticion);
        } catch (Throwable $e) {
            return $this->bloquear('Framework no disponible; superficie bloqueada (fallo cerrado).');
        }

        if (!$respuesta->successful()) {
            return $this->bloquear('El framework respondio con error; superficie bloqueada (fallo cerrado).');
        }

        $accion = $respuesta->json('accion');

        if ($accion === 'permitir') {
            return $next($request);
        }

        $salida = $respuesta->json('respuesta');

        if ($accion === 'senuelo' && is_string($salida)) {
            // Misma forma que ConnectivityCheckController::check. No se expone
            // sesion_id: es dato forense, no parte de la respuesta al atacante.
            return response()->json([
                'host'      => $valor,
                'exit_code' => 0,
                'output'    => $salida,
            ], 200);
        }

        return $this->bloquear('Decision del framework invalida; superficie bloqueada (fallo cerrado).');
    }

    private function bloquear(string $mensaje): Response
    {
        return response()->json(['message' => $mensaje], 503);
    }
}
