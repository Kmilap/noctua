<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/*
 | Middleware de integracion Noctua <-> Umbra (issue #9).
 |
 | 1) Puerta del laboratorio. La superficie vulnerable solo "existe" con
 |    APP_ENV=lab Y umbra.lab_enabled=true. Si no se cumplen, responde 404
 |    como si la ruta no estuviera. La comprobacion vive aqui (no en un `if`
 |    en api.php) para que la ruta se compile con route:cache y la condicion
 |    se evalue en cada peticion, no al cachear.
 |
 | 2) Deteccion. Antes de dejar pasar a la superficie, consulta al detector
 |    de Umbra por HTTP. Politica fail-closed: si el detector no responde,
 |    BLOQUEA (503). Si el detector marca ataque, BLOQUEA (409); el senuelo
 |    real (Ollama) y el registro forense completo son la issue #15.
 |
 | Las rutas normales de Noctua NO pasan por este middleware.
 */
class LabDeception
{
    public function handle(Request $request, Closure $next): Response
    {
        // 1) Puerta del laboratorio: doble condicion.
        if (!app()->environment('lab') || !config('umbra.lab_enabled')) {
            abort(404);
        }

        // 2) Consulta al detector.
        $payload = [
            'metodo'  => $request->method(),
            'ruta'    => $request->path(),
            'entrada' => $request->input('host', ''),
        ];

        try {
            $respuesta = Http::timeout((float) config('umbra.detector_timeout', 2.0))
                ->acceptJson()
                ->post(config('umbra.detector_url'), $payload);
        } catch (Throwable $e) {
            return $this->bloquear(503, 'Detector no disponible; superficie bloqueada (fail-closed).');
        }

        if (!$respuesta->successful()) {
            return $this->bloquear(503, 'Detector respondio con error; superficie bloqueada (fail-closed).');
        }

        if ($respuesta->json('es_ataque') === true) {
            return $this->bloquear(409, 'Peticion marcada como ataque por el detector.');
        }

        return $next($request);
    }

    private function bloquear(int $codigo, string $mensaje): Response
    {
        return response()->json(['message' => $mensaje], $codigo);
    }
}
