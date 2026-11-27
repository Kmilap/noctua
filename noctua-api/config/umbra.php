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
     | Punto de entrada unico del framework (umbra ADR-003): POST /interceptar
     | del detector. Noctua y el framework son despliegues separados que se
     | hablan por HTTP en la red arya-lab. El tiempo de espera cubre la
     | generacion del senuelo con Ollama (ADR-003, decision 8); el presupuesto
     | de latencia se mide en el sprint 6.
     */
    'detector_url'     => env('UMBRA_DETECTOR_URL', 'http://detector:8001/interceptar'),
    'detector_timeout' => (float) env('UMBRA_DETECTOR_TIMEOUT', 30.0),

    /*
     | Politica ante fallo del detector. "closed" bloquea la superficie
     | instrumentada si el detector no responde (decision del sprint 1).
     | Las rutas normales de Noctua no pasan por este middleware.
     */
    'fail_mode' => env('UMBRA_FAIL_MODE', 'closed'),

];
