// Noctua Load Generator — traffic-patterns.js
//
// k6 script que ataca un servicio con plantilla siguiendo 4 patrones
// que rotan en ciclos de ~5 minutos. Cada servicio empieza en una fase
// distinta del ciclo (offset basado en SERVICE_ID) para que el dashboard
// no muestre todos los servicios moviéndose en sincronía.
//
// Patrones (cada uno dura una "stage" k6):
//   - idle:       1-2 req/s    (60s)  — línea base
//   - rampa:      2 → 30 req/s (60s)  — subida gradual
//   - sostenido:  30 req/s     (120s) — plateau visible
//   - pico:       80 req/s     (60s)  — ráfaga
//
// Ciclo total: ~5 minutos. Después k6 termina y entrypoint.sh lo
// relanza en la siguiente iteración del discovery loop, lo que
// efectivamente lo hace correr "para siempre" con variación natural.
//
// Errores: ~7% de los requests apuntan a paths inexistentes (genera 404),
// para que error_rate en el dashboard no sea siempre 0. Los 5xx
// (que disparan alertas) NO salen de aquí — esos los genera el simulator
// agresivo de la Fase 2.

import http from 'k6/http';
import { sleep } from 'k6';

const TARGET_URL = __ENV.TARGET_URL;
const SERVICE_ID = parseInt(__ENV.SERVICE_ID || '0', 10);

if (!TARGET_URL) {
    throw new Error('TARGET_URL is required');
}

// Offset: cada servicio empieza en una fase distinta del ciclo.
// SERVICE_ID 1 → arranca en idle, ID 2 → arranca en rampa, etc.
// Esto se logra rotando el array de stages según el id.
const ALL_STAGES = [
    { duration: '60s',  target: 2  },  // idle
    { duration: '60s',  target: 30 },  // rampa
    { duration: '120s', target: 30 },  // sostenido
    { duration: '60s',  target: 80 },  // pico
];

function rotateStages(stages, offset) {
    const n = stages.length;
    const k = ((offset % n) + n) % n;
    return [...stages.slice(k), ...stages.slice(0, k)];
}

export const options = {
    stages: rotateStages(ALL_STAGES, SERVICE_ID),

    // No queremos que k6 marque "test failed" por nada de lo de adentro.
    // El propósito es generar tráfico, no validar el servicio.
    thresholds: {},

    // Logs minimos.
    summaryTrendStats: ['avg', 'p(95)', 'p(99)'],

    // Si una request individual se cuelga, no bloqueamos el VU.
    // 10 segundos es generoso pero evita memoria infinita.
    setupTimeout: '10s',
    teardownTimeout: '10s',
};

// Paths comunes en plantillas Laravel/WordPress/Nginx.
// La mayoría devuelven 200; los que empiezan con __noctua__ devuelven
// 404 deliberadamente para inyectar errores en el dashboard.
const HAPPY_PATHS = [
    '/',
    '/',
    '/',           // peso 3x para que / domine (es la landing real)
    '/favicon.ico',
];

const ERROR_PATHS = [
    '/__noctua__/no-existe',
    '/__noctua__/404-bait',
    '/api/no-existe',
];

export default function () {
    // 7% de las requests apuntan a paths inexistentes (genera 404).
    const isError = Math.random() < 0.07;
    const paths = isError ? ERROR_PATHS : HAPPY_PATHS;
    const path = paths[Math.floor(Math.random() * paths.length)];

    http.get(`${TARGET_URL}${path}`, {
        timeout: '5s',
        // Tags útiles si en el futuro mandamos métricas de k6 a algún lado.
        tags: {
            service_id: String(SERVICE_ID),
            expected_status: isError ? '404' : '200',
        },
    });

    // Pequeña pausa para no saturar instantáneamente. k6 escala los VUs
    // según el target del stage actual; este sleep solo afecta el ritmo
    // dentro de cada VU.
    sleep(0.1);
}
