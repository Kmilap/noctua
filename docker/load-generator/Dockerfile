# Noctua Load Generator
#
# Genera trafico HTTP variable contra los servicios con plantilla que
# Noctua tiene corriendo. Sirve para que el dashboard se vea con vida
# (gráficas que se mueven, CPU que oscila, request_rate variable)
# durante la demo de Ingeniatic y sustentacion.
#
# Diseño:
#   - entrypoint.sh hace discovery cada 30s via /var/run/docker.sock,
#     buscando contenedores con label noctua.kind=template-service.
#   - Por cada servicio descubierto, lanza un proceso k6 en background
#     que sigue traffic-patterns.js (rota entre 4 patrones cada ~5min).
#   - Para servicios que ya no existen, mata el k6 correspondiente.
#
# Tamaño final: ~80MB (k6 incluye Go runtime).

FROM grafana/k6:latest

USER root

# bash, curl y jq son necesarios para el discovery loop.
# k6 base no los trae (es imagen scratch + binario k6).
RUN apk add --no-cache bash curl jq

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY traffic-patterns.js /usr/local/bin/traffic-patterns.js
RUN chmod +x /usr/local/bin/entrypoint.sh

LABEL org.opencontainers.image.title="Noctua Load Generator"
LABEL org.opencontainers.image.description="Genera trafico variable contra servicios provisionados de Noctua"
LABEL org.opencontainers.image.version="1.0"

# El entrypoint orquesta los procesos k6 hijos.
# k6 no se ejecuta directamente como entrypoint porque queremos
# discovery dinamico, no un solo target estatico.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
