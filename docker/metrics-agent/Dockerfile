# Noctua Metrics Agent — sidecar liviano que reporta CPU y memoria
# del contenedor principal a la API de Noctua.
#
# Tamaño final: ~10MB. Footprint en runtime: ~3-5MB RAM.

FROM alpine:3.19

# Dependencias minimas:
#   - bash: shell para el script
#   - curl: HTTP client para llamar a Docker socket y a Noctua API
#   - jq: parsear JSON de Docker stats
RUN apk add --no-cache bash curl jq

COPY report-metrics.sh /usr/local/bin/report-metrics.sh
RUN chmod +x /usr/local/bin/report-metrics.sh

# Labels OCI estándar para identificar la imagen
LABEL org.opencontainers.image.title="Noctua Metrics Agent"
LABEL org.opencontainers.image.description="Sidecar reportador de metricas CPU/memoria"
LABEL org.opencontainers.image.version="1.0"

ENTRYPOINT ["/usr/local/bin/report-metrics.sh"]
