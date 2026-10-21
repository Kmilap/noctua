<?php

return [

    /*
     | Superficie de laboratorio (issue #9). La ruta vulnerable CWE-78 solo
     | existe cuando el entorno es "lab" Y esta bandera esta activa. Doble
     | condicion a proposito: evita exponer la superficie por un cambio de
     | entorno accidental. Se lee por config (nunca env() directo) para que
     | funcione con config:cache.
     */
    'lab_enabled' => env('UMBRA_LAB_ENABLED', false),

    /*
     | Detector de Umbra (repo activedefense-lab/umbra). Noctua y Umbra son
     | despliegues separados que se hablan por HTTP. El middleware consulta
     | este endpoint antes de permitir la superficie instrumentada.
     */
    'detector_url'     => env('UMBRA_DETECTOR_URL', 'http://detector:8001/analizar'),
    'detector_timeout' => (float) env('UMBRA_DETECTOR_TIMEOUT', 2.0),

    /*
     | Politica ante fallo del detector. "closed" bloquea la superficie
     | instrumentada si el detector no responde (decision del sprint 1).
     | Las rutas normales de Noctua no pasan por este middleware.
     */
    'fail_mode' => env('UMBRA_FAIL_MODE', 'closed'),

];
