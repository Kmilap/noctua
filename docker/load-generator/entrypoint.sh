#!/bin/bash
#
# Noctua Load Generator — discovery loop
#
# Cada DISCOVERY_INTERVAL_SEC segundos:
#   1. Consulta Docker socket por contenedores con label noctua.kind=template-service.
#   2. Por cada servicio nuevo, lanza un proceso k6 que ataca su URL interna
#      Y reporta response_time a la API de Noctua.
#   3. Por cada k6 corriendo cuyo servicio ya no existe, lo mata.
#
# Convenciones de labels en los contenedores target:
#   - noctua.kind=template-service     (filtro)
#   - noctua.service_id=<id>           (identifica el servicio)
#   - noctua.internal_port=<port>      (puerto interno para construir URL)
#
# La API key se extrae del env var NOCTUA_API_KEY del contenedor target
# via docker inspect — ya la pone ContainerManager al provisionar.
#
# La URL target se construye como http://<container_name>:<internal_port>
# porque ambos viven en la misma red noctua-network y se resuelven por DNS.

set -euo pipefail

DOCKER_SOCK="/var/run/docker.sock"
DISCOVERY_INTERVAL_SEC="${DISCOVERY_INTERVAL_SEC:-30}"
SCRIPT_PATH="/usr/local/bin/traffic-patterns.js"
NOCTUA_API_URL="${NOCTUA_API_URL:-http://app:8000/api}"

# Directorio donde guardamos PIDs de los k6 hijos.
PID_DIR="/tmp/noctua-load-gen"
mkdir -p "$PID_DIR"

echo "[load-gen] Started. Discovery interval=${DISCOVERY_INTERVAL_SEC}s"
echo "[load-gen] Noctua API: ${NOCTUA_API_URL}"
echo "[load-gen] Watching for containers with label noctua.kind=template-service"

# Limpia procesos k6 hijos al recibir SIGTERM/SIGINT.
cleanup() {
    echo "[load-gen] Shutting down, killing all k6 children..."
    for pidfile in "$PID_DIR"/svc-*.pid; do
        [ -f "$pidfile" ] || continue
        local pid
        pid=$(cat "$pidfile")
        kill "$pid" 2>/dev/null || true
        rm -f "$pidfile"
    done
    exit 0
}
trap cleanup SIGTERM SIGINT

# Consulta Docker socket. Devuelve líneas: <service_id>|<container_name>|<internal_port>
discover_targets() {
    curl -s --unix-socket "$DOCKER_SOCK" \
        "http://localhost/containers/json?filters=%7B%22label%22%3A%5B%22noctua.kind%3Dtemplate-service%22%5D%7D" \
        | jq -r '.[] | "\(.Labels["noctua.service_id"])|\(.Names[0] | ltrimstr("/"))|\(.Labels["noctua.internal_port"])"' \
        2>/dev/null || true
}

# Lee NOCTUA_API_KEY del env del contenedor vía docker inspect.
# ContainerManager ya la inyecta al provisionar — no necesitamos cambiar el PHP.
get_api_key() {
    local container_name="$1"
    curl -s --unix-socket "$DOCKER_SOCK" \
        "http://localhost/containers/${container_name}/json" \
        | jq -r '(.Config.Env // [])[] | select(startswith("NOCTUA_API_KEY=")) | ltrimstr("NOCTUA_API_KEY=")' \
        2>/dev/null || echo ""
}

# Lanza k6 en background. Pasa TARGET_URL, SERVICE_ID, NOCTUA_API_KEY y NOCTUA_API_URL.
spawn_k6() {
    local service_id="$1"
    local target_url="$2"
    local container_name="$3"
    local pidfile="$PID_DIR/svc-${service_id}.pid"

    local api_key
    api_key=$(get_api_key "$container_name")

    if [ -z "$api_key" ]; then
        echo "[load-gen] WARN: no NOCTUA_API_KEY for service_id=${service_id} (${container_name}) — traffic only, no metrics reporting"
    else
        echo "[load-gen] Spawning k6 for service_id=${service_id} target=${target_url} (metrics reporting enabled)"
    fi

    TARGET_URL="$target_url" \
    SERVICE_ID="$service_id" \
    NOCTUA_API_KEY="$api_key" \
    NOCTUA_API_URL="$NOCTUA_API_URL" \
        K6_NO_SUMMARY=1 k6 run --quiet "$SCRIPT_PATH" \
        > "/tmp/k6-svc-${service_id}.log" 2>&1 &

    echo $! > "$pidfile"
}

kill_k6() {
    local service_id="$1"
    local pidfile="$PID_DIR/svc-${service_id}.pid"
    [ -f "$pidfile" ] || return 0
    local pid
    pid=$(cat "$pidfile")
    echo "[load-gen] Killing k6 for service_id=${service_id} (pid=${pid})"
    kill "$pid" 2>/dev/null || true
    rm -f "$pidfile"
    rm -f "/tmp/k6-svc-${service_id}.log"
}

is_alive() {
    local pid="$1"
    kill -0 "$pid" 2>/dev/null
}

while true; do
    declare -A current_services
    declare -A current_containers

    while IFS='|' read -r service_id container_name internal_port; do
        if [ -z "$service_id" ] || [ "$service_id" = "null" ] \
            || [ -z "$container_name" ] || [ "$container_name" = "null" ] \
            || [ -z "$internal_port" ] || [ "$internal_port" = "null" ]; then
            continue
        fi
        current_services["$service_id"]="http://${container_name}:${internal_port}"
        current_containers["$service_id"]="$container_name"
    done < <(discover_targets)

    # Spawn para servicios nuevos.
    for service_id in "${!current_services[@]}"; do
        pidfile="$PID_DIR/svc-${service_id}.pid"

        if [ -f "$pidfile" ]; then
            pid=$(cat "$pidfile")
            if ! is_alive "$pid"; then
                echo "[load-gen] k6 for service_id=${service_id} died, will respawn"
                rm -f "$pidfile"
            fi
        fi

        if [ ! -f "$pidfile" ]; then
            spawn_k6 "$service_id" "${current_services[$service_id]}" "${current_containers[$service_id]}"
        fi
    done

    # Kill de k6 huérfanos.
    for pidfile in "$PID_DIR"/svc-*.pid; do
        [ -f "$pidfile" ] || continue
        basename=$(basename "$pidfile" .pid)
        service_id="${basename#svc-}"
        if [ -z "${current_services[$service_id]:-}" ]; then
            kill_k6 "$service_id"
        fi
    done

    unset current_services
    unset current_containers
    declare -A current_services
    declare -A current_containers

    sleep "$DISCOVERY_INTERVAL_SEC"
done
