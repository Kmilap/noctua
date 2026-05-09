#!/bin/bash
#
# Noctua Metrics Agent — reportador de CPU y memoria en patron sidecar.
#
# Lee stats del contenedor target via Docker socket (DooD), las parsea
# con jq y POSTea a /api/metrics con la API key del servicio.
#
# Variables de entorno requeridas (todas inyectadas por ContainerManager):
#   NOCTUA_API_URL       URL base de la API de Noctua
#   NOCTUA_API_KEY       API key plain del servicio
#   TARGET_CONTAINER     Nombre o ID del contenedor a monitorear
#
# Variables opcionales:
#   REPORT_INTERVAL_SEC  Segundos entre reportes (default 30)
#

set -euo pipefail

: "${NOCTUA_API_URL:?Falta NOCTUA_API_URL}"
: "${NOCTUA_API_KEY:?Falta NOCTUA_API_KEY}"
: "${TARGET_CONTAINER:?Falta TARGET_CONTAINER}"

INTERVAL="${REPORT_INTERVAL_SEC:-30}"
DOCKER_SOCK="/var/run/docker.sock"

echo "[noctua-agent] Started. Target=${TARGET_CONTAINER}, interval=${INTERVAL}s"
echo "[noctua-agent] Reporting to ${NOCTUA_API_URL}"

post_metric() {
    local name="$1"
    local value="$2"
    local unit="$3"

    local payload
    payload=$(jq -nc \
        --arg name "$name" \
        --argjson value "$value" \
        --arg unit "$unit" \
        '{metric_name: $name, value: $value, metadata: {unit: $unit, source: "metrics-agent"}}')

    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${NOCTUA_API_URL}/metrics" \
        -H "Authorization: Bearer ${NOCTUA_API_KEY}" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "$payload" || echo "000")

    if [[ "$response_code" != "202" ]]; then
        echo "[noctua-agent] WARN: ${name}=${value}${unit} -> HTTP ${response_code}"
    fi
}

fetch_stats() {
    curl -s --unix-socket "${DOCKER_SOCK}" \
        "http://localhost/containers/${TARGET_CONTAINER}/stats?stream=false"
}

while true; do
    if ! stats=$(fetch_stats); then
        echo "[noctua-agent] ERROR: stats unavailable for ${TARGET_CONTAINER}"
        sleep "$INTERVAL"
        continue
    fi

    # CPU% segun formula oficial Docker, con clamp 0-100 hecho en jq
    cpu_pct=$(echo "$stats" | jq -r '
        (
            if .cpu_stats.system_cpu_usage and .precpu_stats.system_cpu_usage
            then
                ((.cpu_stats.cpu_usage.total_usage - .precpu_stats.cpu_usage.total_usage) /
                 (.cpu_stats.system_cpu_usage - .precpu_stats.system_cpu_usage)) *
                 (.cpu_stats.online_cpus // 1) * 100
            else 0 end
        )
        | if . < 0 then 0 elif . > 100 then 100 else . end
        | . * 100 | round / 100
    ')

    # Memoria en MB con cap de seguridad en 65536 (rango de StoreMetricRequest)
    mem_mb=$(echo "$stats" | jq -r '
        ((.memory_stats.usage // 0) / 1048576)
        | if . < 0 then 0 elif . > 65536 then 65536 else . end
        | . * 100 | round / 100
    ')

    post_metric "cpu_usage" "$cpu_pct" "%"
    post_metric "memory_usage" "$mem_mb" "MB"

    sleep "$INTERVAL"
done
