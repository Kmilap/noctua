#!/bin/bash
#
# Noctua Load Generator — discovery loop
#
# Cada DISCOVERY_INTERVAL_SEC segundos:
#   1. Consulta Docker socket por contenedores con label noctua.kind=template-service.
#   2. Por cada servicio nuevo, lanza un proceso k6 que ataca su URL interna.
#   3. Por cada k6 corriendo cuyo servicio ya no existe, lo mata.
#
# Convenciones de labels en los contenedores target:
#   - noctua.kind=template-service     (filtro)
#   - noctua.service_id=<id>           (identifica el servicio)
#   - noctua.internal_port=<port>      (puerto interno para construir URL)
#
# La URL target se construye como http://<container_name>:<internal_port>
# porque ambos viven en la misma red noctua-network y se resuelven por DNS.

set -euo pipefail

DOCKER_SOCK="/var/run/docker.sock"
DISCOVERY_INTERVAL_SEC="${DISCOVERY_INTERVAL_SEC:-30}"
SCRIPT_PATH="/usr/local/bin/traffic-patterns.js"

# Directorio donde guardamos PIDs de los k6 hijos.
# Convención: $PID_DIR/svc-<service_id>.pid
PID_DIR="/tmp/noctua-load-gen"
mkdir -p "$PID_DIR"

echo "[load-gen] Started. Discovery interval=${DISCOVERY_INTERVAL_SEC}s"
echo "[load-gen] Watching for containers with label noctua.kind=template-service"

# Limpia procesos k6 hijos al recibir SIGTERM/SIGINT (docker stop).
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

# Consulta Docker socket por contenedores que matchean el filtro.
# Devuelve líneas: <service_id>|<container_name>|<internal_port>
discover_targets() {
    curl -s --unix-socket "$DOCKER_SOCK" \
        "http://localhost/containers/json?filters=%7B%22label%22%3A%5B%22noctua.kind%3Dtemplate-service%22%5D%7D" \
        | jq -r '.[] | "\(.Labels["noctua.service_id"])|\(.Names[0] | ltrimstr("/"))|\(.Labels["noctua.internal_port"])"' \
        2>/dev/null || true
}

# Lanza un proceso k6 en background contra una URL dada.
# Guarda el PID en $PID_DIR/svc-<id>.pid para gestionarlo después.
spawn_k6() {
    local service_id="$1"
    local target_url="$2"
    local pidfile="$PID_DIR/svc-${service_id}.pid"

    echo "[load-gen] Spawning k6 for service_id=${service_id} target=${target_url}"

    # Variables que el script k6 leerá:
    #   TARGET_URL   — URL base a atacar
    #   SERVICE_ID   — para logs y para offset random (cada servicio
    #                  empieza en una fase distinta del ciclo).
    TARGET_URL="$target_url" SERVICE_ID="$service_id" \
        K6_NO_SUMMARY=1 k6 run --quiet "$SCRIPT_PATH" \
        > "/tmp/k6-svc-${service_id}.log" 2>&1 &

    echo $! > "$pidfile"
}

# Mata un proceso k6 dado el service_id.
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

# Indica si un proceso sigue vivo (true) o murió (false).
is_alive() {
    local pid="$1"
    kill -0 "$pid" 2>/dev/null
}

# Loop principal de discovery + reconciliación.
while true; do
    # 1. Conjunto de servicios actualmente desplegados (de Docker).
    declare -A current_services
    while IFS='|' read -r service_id container_name internal_port; do
        # Validación defensiva: si algún campo viene vacío o "null", skip.
        if [ -z "$service_id" ] || [ "$service_id" = "null" ] \
            || [ -z "$container_name" ] || [ "$container_name" = "null" ] \
            || [ -z "$internal_port" ] || [ "$internal_port" = "null" ]; then
            continue
        fi

        current_services["$service_id"]="http://${container_name}:${internal_port}"
    done < <(discover_targets)

    # 2. Spawn de k6 para servicios nuevos (existen en Docker pero no en PIDs).
    for service_id in "${!current_services[@]}"; do
        pidfile="$PID_DIR/svc-${service_id}.pid"

        if [ -f "$pidfile" ]; then
            # Validar que el proceso siga vivo. Si murió (k6 crasheó),
            # limpia y vuelve a lanzar en la próxima iteración.
            pid=$(cat "$pidfile")
            if ! is_alive "$pid"; then
                echo "[load-gen] k6 for service_id=${service_id} died, will respawn"
                rm -f "$pidfile"
            fi
        fi

        if [ ! -f "$pidfile" ]; then
            spawn_k6 "$service_id" "${current_services[$service_id]}"
        fi
    done

    # 3. Kill de k6 huérfanos (PID file existe pero el servicio ya no).
    for pidfile in "$PID_DIR"/svc-*.pid; do
        [ -f "$pidfile" ] || continue

        # Extraer service_id del nombre del archivo.
        basename=$(basename "$pidfile" .pid)
        service_id="${basename#svc-}"

        if [ -z "${current_services[$service_id]:-}" ]; then
            kill_k6 "$service_id"
        fi
    done

    # Limpia el array para la próxima iteración.
    unset current_services
    declare -A current_services

    sleep "$DISCOVERY_INTERVAL_SEC"
done
