<?php

namespace App\Http\Controllers\Lab;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\Process\Process;

/*
 | Endpoint de laboratorio (issue #9) — SUPERFICIE CWE-78 DELIBERADA.
 |
 | Simula una funcion de "probar conectividad" de un servicio monitoreado:
 | recibe un host y lanza un ping. La vulnerabilidad es intencional y es el
 | objeto de estudio del framework (Decision D-1). NO se corrige.
 |
 | Aislamiento (no depende de este archivo, se exige fuera):
 |  - La ruta solo existe con APP_ENV=lab Y UMBRA_LAB_ENABLED=true.
 |  - Corre en el contenedor lab-target: sin socket de Docker, usuario
 |    no-root, con limites de CPU/memoria/PIDs, sin puerto publico.
 |  - El middleware lab.deception consulta al detector antes de llegar aqui
 |    (fail-closed). Este controlador solo se ejecuta si el detector dio paso.
 */
class ConnectivityCheckController extends Controller
{
    public function check(Request $request): JsonResponse
    {
        $host = (string) $request->input('host', '');

        if ($host === '') {
            return response()->json(['message' => 'El parametro host es obligatorio.'], 422);
        }

        // VULNERABLE A PROPOSITO (CWE-78): el host entra a un shell sin
        // sanear. Un valor como "8.8.8.8; id" ejecuta el comando inyectado.
        // Es la superficie que el framework debe detectar y contener.
        $comando = "ping -c 1 -W 2 {$host}";

        $process = Process::fromShellCommandline($comando);
        $process->setTimeout(10);
        $process->run();

        return response()->json([
            'host'     => $host,
            'exit_code' => $process->getExitCode(),
            'output'    => $process->getOutput(),
        ]);
    }
}
