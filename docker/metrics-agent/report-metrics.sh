#!/bin/bash
#
# Noctua Metrics Agent — reportador de CPU, memoria y HTTP health check.
#
# Variables de entorno requeridas:
#   NOCTUA_API_URL       URL base de la API de Noctua
#   NOCTUA_API_KEY       API key plain del servicio
#   TARGET_CONTAINER     Nombre o ID del contenedor a monitorear
#
# Variables opcionales:
#   REPORT_INTERVAL_SEC  Segundos entre reportes (default 30)
#   TARGET_INTERNAL_PORT Puerto interno del contenedor para health check (default: sin check)
#

set -euo pipefail

: "${NOCTUA_API_URL:?Falta NOCTUA_API_URL}"
: "${NOCTUA_API_KEY:?Falta NOCTUA_API_KEY}"
: "${TARGET_CONTAINER:?Falta TARGET_CONTAINER}"

INTERVAL="${REPORT_INTERVAL_SEC:-30}"
DOCKER_SOCK="/var/run/docker.sock"
TARGET_PORT="${TARGET_INTERNAL_PORT:-}"

echo "[noctua-agent] Started. Target=${TARGET_CONTAINER}, interval=${INTERVAL}s"
echo "[noctua-agent] Reporting to ${NOCTUA_API_URL}"
[ -n "$TARGET_PORT" ] && echo "[noctua-agent] HTTP health check on port ${TARGET_PORT}"

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

post_heartbeat() {
    local status_code="$1"
    local response_time_ms="$2"

    local payload
    payload=$(jq -nc \
        --argjson status_code "$status_code" \
        --argjson response_time_ms "$response_time_ms" \
        '{status_code: $status_code, response_time_ms: $response_time_ms}')

    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${NOCTUA_API_URL}/heartbeat" \
        -H "Authorization: Bearer ${NOCTUA_API_KEY}" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -d "$payload" || echo "000")

    if [[ "$response_code" != "200" && "$response_code" != "202" && "$response_code" != "204" ]]; then
        echo "[noctua-agent] WARN: heartbeat -> HTTP ${response_code}"
    fi
}

fetch_stats() {
    curl -s --unix-socket "${DOCKER_SOCK}" \
        "http://localhost/containers/${TARGET_CONTAINER}/stats?stream=false"
}

http_health_check() {
    local target_ip
    # Obtener IP del contenedor target en la red noctua
    target_ip=$(curl -s --unix-socket "${DOCKER_SOCK}" \
        "http://localhost/containers/${TARGET_CONTAINER}/json" \
        | jq -r '.NetworkSettings.Networks | to_entries[0].value.IPAddress // empty' 2>/dev/null || echo "")

    if [ -z "$target_ip" ]; then
        echo "[noctua-agent] WARN: no se pudo obtener IP del contenedor"
        post_heartbeat 0 0
        return
    fi

    local start_ms end_ms elapsed_ms http_code
    start_ms=$(date +%s%3N)

    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time 5 \
        --location \
        "http://${target_ip}:${TARGET_PORT}/" || echo "0")

    end_ms=$(date +%s%3N)
    elapsed_ms=$((end_ms - start_ms))

    echo "[noctua-agent] HTTP check ${target_ip}:${TARGET_PORT} -> ${http_code} (${elapsed_ms}ms)"

    # Convertir 0 (curl error) a status_code 0 para el heartbeat
    local numeric_code=${http_code:-0}
    post_heartbeat "$numeric_code" "$elapsed_ms"
}

while true; do
    # — Métricas CPU y memoria —
    if ! stats=$(fetch_stats); then
        echo "[noctua-agent] ERROR: stats unavailable for ${TARGET_CONTAINER}"
        sleep "$INTERVAL"
        continue
    fi

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

    mem_mb=$(echo "$stats" | jq -r '
        ((.memory_stats.usage // 0) / 1048576)
        | if . < 0 then 0 elif . > 65536 then 65536 else . end
        | . * 100 | round / 100
    ')

    post_metric "cpu_usage" "$cpu_pct" "%"
    post_metric "memory_usage" "$mem_mb" "MB"

    # — HTTP health check (solo si se configuró puerto) —
    if [ -n "$TARGET_PORT" ]; then
        http_health_check
    fi

    sleep "$INTERVAL"
done