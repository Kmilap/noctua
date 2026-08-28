#!/usr/bin/env bash
#
# provision-app.sh — despliegue de Noctúa sobre el stack nativo de noctua-lab.
#
# Reproduce desde cero lo que se hizo a mano en la Fase 5: rol y esquema de
# PostgreSQL, clonado del repo con la deploy key de solo lectura, `composer
# install`, `.env` desde el perfil de laboratorio, `key:generate`, `migrate`,
# `npm ci` + build del frontend, el bloque de Nginx, las unidades systemd de
# Horizon y del scheduler, y `config:cache` al final.
#
# Requiere que infra/provision-lab.sh ya haya corrido (PostgreSQL, Redis,
# PHP-FPM, Nginx, Composer, Node instalados y activos) — este script no
# instala el stack, solo despliega la aplicación sobre él.
# Contexto y decisiones: docs/decisiones/lab-arquitectura.md,
# docs/decisiones/ESTADO_LABORATORIO.md (Fase 5).
#
# Uso: sudo ./provision-app.sh
# Idempotente: puede correrse más de una vez sin efectos destructivos.
# La contraseña de la base de datos y APP_KEY se generan una sola vez, en el
# primer .env que este script crea, y se reutilizan en corridas posteriores.

set -euo pipefail

readonly VM_IP="192.168.56.101"
readonly APP_ROOT="/var/www/noctua"
readonly API_DIR="${APP_ROOT}/noctua-api"
readonly FRONTEND_DIR="${APP_ROOT}/noctua-app"
readonly DEPLOY_USER="noctua"
readonly DEPLOY_GROUP="www-data"
readonly REPO_URL="git@github.com:Kmilap/noctua.git"
readonly DEPLOY_KEY="/home/${DEPLOY_USER}/.ssh/id_ed25519_noctua"
readonly PHP_FPM_SOCK="/run/php/php8.4-fpm.sock"
readonly NGINX_SITE_AVAILABLE="/etc/nginx/sites-available/noctua"
readonly NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/noctua"
readonly NGINX_LAB_INFO_ENABLED="/etc/nginx/sites-enabled/noctua-lab-info"
readonly HORIZON_UNIT="/etc/systemd/system/noctua-horizon.service"
readonly SCHEDULER_UNIT="/etc/systemd/system/noctua-scheduler.service"

log() {
    printf '\n==> %s\n' "$1"
}

fail() {
    printf 'ERROR: %s\n' "$1" >&2
    exit 1
}

require_root() {
    if [[ "${EUID}" -ne 0 ]]; then
        fail "Este script debe ejecutarse como root (sudo $0)."
    fi
}

as_deploy_user() {
    runuser -u "${DEPLOY_USER}" -- "$@"
}

ensure_deploy_key() {
    log "Deploy key de solo lectura hacia GitHub (Decisión 4 de lab-arquitectura.md)"

    if [[ -f "${DEPLOY_KEY}" ]]; then
        log "Deploy key ya existe en ${DEPLOY_KEY}, se omite la generación"
        return
    fi

    as_deploy_user ssh-keygen -t ed25519 -N '' -C "noctua-lab deploy key" -f "${DEPLOY_KEY}"

    if [[ ! -f "/home/${DEPLOY_USER}/.ssh/config" ]] || ! grep -q '^Host github\.com$' "/home/${DEPLOY_USER}/.ssh/config" 2>/dev/null; then
        cat >> "/home/${DEPLOY_USER}/.ssh/config" <<EOF
Host github.com
    HostName github.com
    User git
    IdentityFile ${DEPLOY_KEY}
    IdentitiesOnly yes
EOF
        chown "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh/config"
        chmod 600 "/home/${DEPLOY_USER}/.ssh/config"
    fi

    log "ATENCIÓN: registrar esta clave pública como deploy key de SOLO LECTURA"
    log "(Settings -> Deploy keys del repo, sin marcar 'Allow write access') antes de continuar:"
    cat "${DEPLOY_KEY}.pub"
    fail "Deploy key generada y pendiente de registrar en GitHub. Vuelve a correr el script después de registrarla."
}

clone_or_update_repo() {
    log "Clonando/actualizando ${REPO_URL} en ${APP_ROOT}"

    if [[ -d "${APP_ROOT}/.git" ]]; then
        log "Repositorio ya clonado, actualizando con git pull"
        as_deploy_user git -C "${APP_ROOT}" pull --ff-only
    else
        # Solo se crea/toca ${APP_ROOT} (no /var/www completo, que es de root).
        install -d -m 0775 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${APP_ROOT}"
        as_deploy_user git clone "${REPO_URL}" "${APP_ROOT}"
    fi
}

setup_env() {
    log "Configurando ${API_DIR}/.env desde el perfil de laboratorio"

    if [[ -f "${API_DIR}/.env" ]]; then
        log ".env ya existe, se omite (evita regenerar DB_PASSWORD/APP_KEY ya en uso)"
        return
    fi

    [[ -f "${API_DIR}/.env.lab.example" ]] || fail "No se encontró ${API_DIR}/.env.lab.example"

    cp "${API_DIR}/.env.lab.example" "${API_DIR}/.env"

    local db_password api_key_pagos api_key_inventario api_key_notificaciones
    db_password="$(openssl rand -base64 32)"
    api_key_pagos="lab_pagos_$(openssl rand -hex 8)"
    api_key_inventario="lab_inv_$(openssl rand -hex 8)"
    api_key_notificaciones="lab_notif_$(openssl rand -hex 8)"

    sed -i \
        -e "s#CAMBIAR_POR_IP_DE_LA_VM#${VM_IP}#g" \
        -e "s#CAMBIAR_GENERAR_ALEATORIA#${db_password}#" \
        -e "s#CAMBIAR_API_KEY_PAGOS#${api_key_pagos}#" \
        -e "s#CAMBIAR_API_KEY_INVENTARIO#${api_key_inventario}#" \
        -e "s#CAMBIAR_API_KEY_NOTIFICACIONES#${api_key_notificaciones}#" \
        "${API_DIR}/.env"

    chown "${DEPLOY_USER}:${DEPLOY_USER}" "${API_DIR}/.env"
    chmod 640 "${API_DIR}/.env"

    log ".env generado. APP_URL/FRONTEND_URL/SANCTUM_STATEFUL_DOMAINS apuntan a ${VM_IP}."
}

read_env_var() {
    local key="$1"
    grep -m1 "^${key}=" "${API_DIR}/.env" | cut -d= -f2-
}

setup_database() {
    log "Rol y esquema de PostgreSQL"

    local db_name db_user db_password
    db_name="$(read_env_var DB_DATABASE)"
    db_user="$(read_env_var DB_USERNAME)"
    db_password="$(read_env_var DB_PASSWORD)"

    [[ -n "${db_name}" && -n "${db_user}" && -n "${db_password}" ]] \
        || fail "DB_DATABASE/DB_USERNAME/DB_PASSWORD vacíos en ${API_DIR}/.env"

    # db_name/db_user vienen de .env.lab.example (noctua/noctua), no de
    # entrada arbitraria: se usan sin comillas dobles en el SQL (identificador
    # simple en minúsculas, sin necesidad de plegado de mayúsculas).
    if su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${db_user}'\"" | grep -q 1; then
        log "Rol '${db_user}' ya existe, sincronizando contraseña con .env"
        su - postgres -c "psql -c \"ALTER ROLE ${db_user} WITH PASSWORD '${db_password}'\"" >/dev/null
    else
        log "Creando rol '${db_user}'"
        su - postgres -c "psql -c \"CREATE ROLE ${db_user} WITH LOGIN PASSWORD '${db_password}'\"" >/dev/null
    fi

    if su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${db_name}'\"" | grep -q 1; then
        log "Base de datos '${db_name}' ya existe, se omite"
    else
        log "Creando base de datos '${db_name}' (owner '${db_user}')"
        su - postgres -c "psql -c \"CREATE DATABASE ${db_name} OWNER ${db_user}\"" >/dev/null
    fi
}

install_backend() {
    log "composer install --no-dev"
    as_deploy_user bash -c "cd '${API_DIR}' && composer install --no-dev --no-interaction --optimize-autoloader"

    log "key:generate (solo si APP_KEY está vacío)"
    if [[ -z "$(read_env_var APP_KEY)" ]]; then
        as_deploy_user bash -c "cd '${API_DIR}' && php artisan key:generate --force"
    else
        log "APP_KEY ya definido, se omite"
    fi

    # --seed: la Fase 5 real corrió con seed (verificado en la VM, User::count()=3
    # — admin/operator/viewer). Sin esto no hay con qué hacer login. --force
    # porque APP_ENV=production exige saltar el prompt de confirmación.
    log "migrate --seed --force"
    as_deploy_user bash -c "cd '${API_DIR}' && php artisan migrate --seed --force"
}

install_frontend() {
    log "npm ci + build del frontend"
    as_deploy_user bash -c "cd '${FRONTEND_DIR}' && npm ci"
    as_deploy_user bash -c "cd '${FRONTEND_DIR}' && npm run build"

    [[ -d "${FRONTEND_DIR}/dist" ]] || fail "npm run build no generó ${FRONTEND_DIR}/dist"
}

fix_permissions() {
    log "Permisos de storage/ y bootstrap/cache (noctua:www-data, setgid 2775)"
    chown -R "${DEPLOY_USER}:${DEPLOY_GROUP}" "${API_DIR}/storage" "${API_DIR}/bootstrap/cache"
    find "${API_DIR}/storage" "${API_DIR}/bootstrap/cache" -type d -exec chmod 2775 {} \;
    find "${API_DIR}/storage" "${API_DIR}/bootstrap/cache" -type f -exec chmod 664 {} \;
}

configure_nginx() {
    log "Bloque de Nginx (mismo origen: / a la SPA, /api /horizon /up /storage /sanctum a PHP-FPM)"

    cat > "${NGINX_SITE_AVAILABLE}" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root ${FRONTEND_DIR}/dist;
    index index.html;

    charset utf-8;
    client_max_body_size 20M;

    access_log /var/log/nginx/noctua-access.log;
    error_log  /var/log/nginx/noctua-error.log;

    # SPA: cualquier ruta desconocida devuelve index.html.
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Rutas de Laravel: van directas a PHP-FPM, sin pasar por el
    # manejador de archivos estaticos (que rechaza POST con 405).
    location ^~ /api      { try_files /dev/null @laravel; }
    location ^~ /horizon  { try_files /dev/null @laravel; }
    location ^~ /up       { try_files /dev/null @laravel; }
    location ^~ /storage  { try_files /dev/null @laravel; }
    location ^~ /sanctum  { try_files /dev/null @laravel; }

    location @laravel {
        fastcgi_pass unix:${PHP_FPM_SOCK};
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME ${API_DIR}/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param DOCUMENT_ROOT ${API_DIR}/public;
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

    ln -sf "${NGINX_SITE_AVAILABLE}" "${NGINX_SITE_ENABLED}"

    # El sitio de aceptación de provision-lab.sh (noctua-lab-info) también
    # reclama "listen 80 default_server" — con los dos habilitados, nginx -t
    # falla por default server duplicado.
    if [[ -L "${NGINX_LAB_INFO_ENABLED}" ]]; then
        log "Desactivando sitio de aceptación de provision-lab.sh (default_server duplicado)"
        rm -f "${NGINX_LAB_INFO_ENABLED}"
    fi

    nginx -t
    systemctl reload nginx
}

configure_systemd() {
    log "Unidades systemd: noctua-horizon y noctua-scheduler"

    cat > "${HORIZON_UNIT}" <<EOF
[Unit]
Description=Noctua Horizon (colas)
After=network.target redis-server.service postgresql.service

[Service]
Type=simple
User=${DEPLOY_USER}
Group=${DEPLOY_GROUP}
Restart=always
RestartSec=5
WorkingDirectory=${API_DIR}
ExecStart=/usr/bin/php artisan horizon
ExecStop=/usr/bin/php artisan horizon:terminate

[Install]
WantedBy=multi-user.target
EOF

    cat > "${SCHEDULER_UNIT}" <<EOF
[Unit]
Description=Noctua scheduler
After=network.target postgresql.service

[Service]
Type=simple
User=${DEPLOY_USER}
Group=${DEPLOY_GROUP}
Restart=always
RestartSec=5
WorkingDirectory=${API_DIR}
ExecStart=/usr/bin/php artisan schedule:work

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable --now noctua-horizon.service
    systemctl enable --now noctua-scheduler.service
}

config_cache() {
    log "config:cache"
    as_deploy_user bash -c "cd '${API_DIR}' && php artisan config:cache"

    # route:cache falla por un nombre de ruta duplicado (login/register) —
    # defecto conocido de Noctúa que se conserva (ver ESTADO_LABORATORIO.md,
    # Fase 5, hallazgo 5). No se ejecuta aquí a propósito.
    log "route:cache NO se ejecuta (defecto conocido: nombre de ruta duplicado). Usando route:clear."
    as_deploy_user bash -c "cd '${API_DIR}' && php artisan route:clear" >/dev/null

    log "Recordatorio: cambiar NOCTUA_CONTAINER_PROVISIONING exige config:clear && config:cache."
}

main() {
    require_root
    ensure_deploy_key
    clone_or_update_repo
    setup_env
    setup_database
    install_backend
    install_frontend
    fix_permissions
    configure_nginx
    configure_systemd
    config_cache

    log "Noctúa desplegada. Comprobar en: http://${VM_IP}/"
}

main "$@"
