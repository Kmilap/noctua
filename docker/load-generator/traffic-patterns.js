// Noctua Load Generator — traffic-patterns.js
//
// Genera tráfico HTTP contra un servicio con plantilla con 4 patrones
// que rotan en ciclos de ~5 minutos (ver ALL_STAGES).
//
// Además de generar tráfico, reporta métricas a la API de Noctua:
//   - response_time (ms)   → cada VU reporta max 1 vez cada METRIC_THROTTLE_MS
//   - heartbeat             → incluye status_code real + response_time
//
// Esto conecta el load-generator al pipeline de métricas de Noctua sin
// necesitar un agente separado para latencia y tráfico.

import http from 'k6/http';
import { sleep } from 'k6';

const TARGET_URL     = __ENV.TARGET_URL;
const SERVICE_ID     = parseInt(__ENV.SERVICE_ID || '0', 10);
const NOCTUA_API_KEY = __ENV.NOCTUA_API_KEY || '';
const NOCTUA_API_URL = __ENV.NOCTUA_API_URL || 'http://app:8000/api';

if (!TARGET_URL) {
    throw new Error('TARGET_URL is required');
}

// Throttle: cada VU envía métricas a Noctua a lo sumo cada N ms.
// Con 30 VUs y 10s de throttle = 3 reportes/s como máximo al Noctua API.
const METRIC_THROTTLE_MS     = 10_000;   // response_time: 1 por VU cada 10s
const HEARTBEAT_THROTTLE_MS  = 30_000;  // heartbeat:     1 por VU cada 30s

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
    thresholds: {},
    summaryTrendStats: ['avg', 'p(95)', 'p(99)'],
    setupTimeout: '10s',
    teardownTimeout: '10s',
};

const HAPPY_PATHS = ['/', '/', '/', '/favicon.ico'];
const ERROR_PATHS = ['/__noctua__/no-existe', '/__noctua__/404-bait', '/api/no-existe'];

// Cabeceras para el Noctua API (reutilizamos el objeto para no recrearlo).
const noctuaHeaders = NOCTUA_API_KEY
    ? { 'Authorization': `Bearer ${NOCTUA_API_KEY}`, 'Content-Type': 'application/json' }
    : {};

// Estado por VU (k6 ejecuta cada VU en un coroutine independiente).
let _lastMetricAt    = 0;
let _lastHeartbeatAt = 0;

function reportMetric(metricName, value, unit) {
    if (!NOCTUA_API_KEY) return;
    http.post(
        `${NOCTUA_API_URL}/metrics`,
        JSON.stringify({ metric_name: metricName, value, metadata: { unit } }),
        { headers: noctuaHeaders, timeout: '3s', tags: { noctua_internal: '1' } }
    );
}

function reportHeartbeat(statusCode, responseTimeMs) {
    if (!NOCTUA_API_KEY) return;
    http.post(
        `${NOCTUA_API_URL}/heartbeat`,
        JSON.stringify({ status_code: statusCode, response_time_ms: responseTimeMs }),
        { headers: noctuaHeaders, timeout: '3s', tags: { noctua_internal: '1' } }
    );
}

export default function () {
    const isError = Math.random() < 0.07;
    const paths   = isError ? ERROR_PATHS : HAPPY_PATHS;
    const path    = paths[Math.floor(Math.random() * paths.length)];

    const res = http.get(`${TARGET_URL}${path}`, {
        timeout: '5s',
        tags: { service_id: String(SERVICE_ID) },
    });

    const now = Date.now();
    const rt  = Math.round(res.timings.duration);

    // Reportar response_time al API de Noctua (throttled).
    if (NOCTUA_API_KEY && (now - _lastMetricAt) >= METRIC_THROTTLE_MS) {
        _lastMetricAt = now;
        reportMetric('response_time', rt, 'ms');
    }

    // Reportar heartbeat (throttled — complementa al sidecar agent cada 30s).
    if (NOCTUA_API_KEY && (now - _lastHeartbeatAt) >= HEARTBEAT_THROTTLE_MS) {
        _lastHeartbeatAt = now;
        reportHeartbeat(res.status, rt);
    }

    sleep(0.1);
}
