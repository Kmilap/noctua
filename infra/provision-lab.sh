#!/usr/bin/env bash
#
# provision-lab.sh — aprovisionamiento del stack nativo de noctua-lab.
#
# Deja Ubuntu Server 24.04.3 LTS listo con PostgreSQL 17, Redis 7, PHP 8.3,
# Nginx (+ ModSecurity en modo DetectionOnly), Composer, Node 20, Python 3
# y UFW (solo 22/80). No instala ni configura Noctúa — ver
# docs/decisiones/ESTADO_LABORATORIO.md, Fase 4.
# Requisitos exactos de versiones/extensiones: docs/auditoria/REQUISITOS.md.
# Contexto de la VM (red, disco, instalación): infra/README.md.
#
# Uso: sudo ./provision-lab.sh
# Idempotente: puede correrse más de una vez sin efectos destructivos.

set -euo pipefail

readonly WEB_ROOT="/var/www/html"
readonly NGINX_SITE_AVAILABLE="/etc/nginx/sites-available/noctua-lab-info"
readonly NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/noctua-lab-info"
readonly PHP_FPM_SOCK="/run/php/php8.3-fpm.sock"
readonly COMPOSER_BIN="/usr/local/bin/composer"
readonly VM_IP="192.168.56.101"
readonly APT_SOURCES_FILE="/etc/apt/sources.list.d/ubuntu.sources"
readonly MODSEC_CONF="/etc/modsecurity/modsecurity.conf"
readonly MODSEC_CRS_SETUP="/etc/modsecurity/crs/crs-setup.conf"
readonly MODSEC_MAIN_CONF="/etc/nginx/modsec/main.conf"

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

check_os() {
    log "Comprobando distribución del sistema"
    [[ -f /etc/os-release ]] || fail "No se encontró /etc/os-release. Se requiere Ubuntu 24.04."

    # shellcheck disable=SC1091
    . /etc/os-release

    if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
        fail "Se requiere Ubuntu 24.04. Detectado: ${PRETTY_NAME:-desconocido}."
    fi

    log "Sistema confirmado: ${PRETTY_NAME} (${VERSION_CODENAME})"
}

fix_apt_mirror() {
    # El 27/08/2026 el espejo colombiano que el instalador eligió por
    # geolocalización (co.archive.ubuntu.com) rechazó conexiones durante el
    # aprovisionamiento, mientras security.ubuntu.com y apt.postgresql.org
    # respondían con normalidad. Se fuerza el espejo global para no depender
    # de un mirror regional inestable.
    log "Normalizando espejo de apt (co.archive.ubuntu.com -> archive.ubuntu.com)"

    if [[ ! -f "${APT_SOURCES_FILE}" ]]; then
        log "No se encontró ${APT_SOURCES_FILE}, se omite"
        return
    fi

    if ! grep -q 'co\.archive\.ubuntu\.com' "${APT_SOURCES_FILE}"; then
        log "Espejo ya normalizado, se omite"
        return
    fi

    local backup="${APT_SOURCES_FILE}.bak"
    if [[ ! -f "${backup}" ]]; then
        cp "${APT_SOURCES_FILE}" "${backup}"
    fi

    sed -i 's/co\.archive\.ubuntu\.com/archive.ubuntu.com/g' "${APT_SOURCES_FILE}"
    log "Espejo normalizado a archive.ubuntu.com (respaldo en ${backup})"
}

apt_update() {
    log "Actualizando índices de apt"
    apt-get update -y
}

install_postgresql() {
    log "PostgreSQL 17 (repositorio PGDG — Ubuntu 24.04 solo trae la 16)"

    if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
        install -d -m 0755 /usr/share/postgresql-common/pgdg
        curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
            -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
        echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
            > /etc/apt/sources.list.d/pgdg.list
        apt-get update -y
    else
        log "Repositorio PGDG ya configurado, se omite"
    fi

    apt-get install -y postgresql-17
    systemctl enable --now postgresql
    su - postgres -c "psql --version"
}

install_redis() {
    log "Redis 7 (repositorio oficial de Ubuntu 24.04, ya publica la serie 7.x)"
    apt-get install -y redis-server
    systemctl enable --now redis-server
    redis-server --version
}

install_php() {
    log "PHP 8.3 + FPM + extensiones (pdo_pgsql, zip, pcntl, redis)"
    # pcntl no es un paquete aparte: viene compilado en php8.3-cli, que es el
    # único SAPI donde pcntl tiene sentido (no existe bajo FPM/Apache).
    apt-get install -y \
        php8.3 \
        php8.3-fpm \
        php8.3-cli \
        php8.3-common \
        php8.3-pgsql \
        php8.3-zip \
        php8.3-redis

    systemctl enable --now php8.3-fpm

    log "Verificando extensiones PHP requeridas"
    local ext missing=()
    for ext in pdo pdo_pgsql zip pcntl redis; do
        php -m | grep -qi "^${ext}\$" || missing+=("${ext}")
    done
    if [[ "${#missing[@]}" -gt 0 ]]; then
        fail "Faltan extensiones PHP: ${missing[*]}. Revisar paquetes disponibles en esta versión de Ubuntu."
    fi
    php -v
}

install_nginx() {
    log "Nginx"
    apt-get install -y nginx
    systemctl enable --now nginx
}

install_composer() {
    log "Composer (instalador oficial, con verificación de hash sha384)"

    if [[ -x "${COMPOSER_BIN}" ]]; then
        log "Composer ya está instalado ($("${COMPOSER_BIN}" --version)), se omite la descarga"
        return
    fi

    local installer expected actual
    installer="$(mktemp)"
    php -r "copy('https://getcomposer.org/installer', '${installer}');"

    expected="$(curl -fsSL https://composer.github.io/installer.sig)"
    actual="$(php -r "echo hash_file('sha384', '${installer}');")"

    if [[ "${expected}" != "${actual}" ]]; then
        rm -f "${installer}"
        fail "Firma del instalador de Composer inválida (esperado ${expected}, obtenido ${actual})."
    fi

    php "${installer}" --install-dir=/usr/local/bin --filename=composer
    rm -f "${installer}"
    composer --version
}

install_node() {
    log "Node 20 (NodeSource)"

    if command -v node >/dev/null 2>&1 && node --version | grep -q '^v20\.'; then
        log "Node 20 ya está instalado ($(node --version)), se omite"
        return
    fi

    if [[ ! -f /etc/apt/sources.list.d/nodesource.list ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    else
        log "Repositorio NodeSource ya configurado, se omite"
    fi

    apt-get install -y nodejs
    node --version
    npm --version
}

install_python() {
    log "Python 3 (venv + pip)"
    apt-get install -y python3 python3-venv python3-pip
    python3 --version
}

configure_ufw() {
    log "UFW: solo 22 (SSH) y 80 (HTTP)"
    apt-get install -y ufw
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw --force enable
    ufw status verbose
}

install_modsecurity() {
    # apt-cache policy confirma libnginx-mod-http-modsecurity 1.0.3-1build3 y
    # modsecurity-crs 3.3.5-2 en noble/universe: sí están empaquetados.
    log "ModSecurity para Nginx (libnginx-mod-http-modsecurity + modsecurity-crs)"
    if ! apt-get install -y libnginx-mod-http-modsecurity modsecurity-crs; then
        log "AVISO: no se pudieron instalar los paquetes de ModSecurity, se omite (el resto del stack continúa)"
        return
    fi

    # PENDIENTE: los paquetes quedan instalados pero ModSecurity no queda
    # activado ni encadenado al CRS. Verificado con `dpkg -L` en la VM:
    #
    #   - libmodsecurity3t64 (la librería que trae libnginx-mod-http-modsecurity)
    #     no instala ningún fichero en ${MODSEC_CONF} ni un *.conf-recommended
    #     — a diferencia del conector de Apache, la librería v3 no provee una
    #     configuración por defecto. Hay que escribir ${MODSEC_CONF} desde
    #     cero (SecRuleEngine, SecRequestBodyAccess, límites de tamaño de
    #     petición, etc.), no copiarlo de ningún paquete.
    #   - El CRS sí instala su configuración real en ${MODSEC_CRS_SETUP} y
    #     sus reglas en /usr/share/modsecurity-crs/rules/, listas para
    #     incluirse una vez exista ${MODSEC_CONF}.
    #   - Falta además habilitar el módulo dinámico (symlink en
    #     modules-enabled) y añadir `modsecurity on;` / `modsecurity_rules_file
    #     ${MODSEC_MAIN_CONF};` al bloque server de setup_acceptance_check.
    #
    # Se difiere a una fase posterior en vez de generar un modsecurity.conf
    # de relleno sin revisar (SecRuleEngine debe quedar en DetectionOnly como
    # línea base de comparación de la validación, no en On, cuando se escriba).
    log "ModSecurity: paquetes instalados, activación PENDIENTE (ver comentario en el script)"
}

setup_acceptance_check() {
    log "Publicando criterio de aceptación (info.php vía Nginx + PHP-FPM)"

    install -d -m 0755 "${WEB_ROOT}"
    cat > "${WEB_ROOT}/info.php" <<'EOF'
<?php phpinfo();
EOF

    cat > "${NGINX_SITE_AVAILABLE}" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root ${WEB_ROOT};
    index index.php index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${PHP_FPM_SOCK};
    }
}
EOF

    rm -f /etc/nginx/sites-enabled/default
    ln -sf "${NGINX_SITE_AVAILABLE}" "${NGINX_SITE_ENABLED}"

    nginx -t
    systemctl reload nginx
}

main() {
    require_root
    check_os
    fix_apt_mirror
    apt_update

    install_postgresql
    install_redis
    install_php
    install_nginx
    install_composer
    install_node
    install_python
    configure_ufw
    install_modsecurity
    setup_acceptance_check

    log "Stack nativo listo. Comprobar en: http://${VM_IP}/info.php"
}

main "$@"
