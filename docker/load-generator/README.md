# Noctua Load Generator

Genera tráfico HTTP variable contra los servicios con plantilla que
Noctua tiene corriendo. Existe para que el dashboard se vea con vida
(gráficas que oscilan, CPU variable, request_rate no en 0) durante la
demo y la sustentación.

## Por qué existe

Las plantillas que Noctua provisiona (Laravel, WordPress, Nginx) son
landings estáticas. Sin tráfico real, sus métricas son planas:
`response_time=0`, `cpu_usage=0%`, `request_rate=0`. El dashboard se
ve técnicamente correcto pero visualmente muerto.

Este componente es un sidecar de infraestructura (igual que el
`metrics-agent`) que ataca cada servicio con tráfico variable. NO toca
el código de Noctua, NO depende de la API, solo lee `/var/run/docker.sock`.

## Diseño

El `entrypoint.sh` consulta el socket de Docker buscando contenedores
con la label `noctua.kind=template-service`. Por cada uno, lanza un
proceso `k6` en background que ejecuta `traffic-patterns.js`.

Cada `k6` corre un ciclo de ~5 minutos con 4 stages:

| Stage      | Duración | Target req/s |
|------------|----------|--------------|
| Idle       | 60s      | 2            |
| Rampa      | 60s      | 2 → 30       |
| Sostenido  | 120s     | 30           |
| Pico       | 60s      | 80           |

Cada servicio arranca en una fase distinta (offset basado en
`service_id`) para que el dashboard no muestre todo sincronizado.

Aproximadamente 7% de los requests apuntan a paths inexistentes para
generar 404s, alimentando `error_rate` en el dashboard. Los 5xx que
disparan alertas e incidentes salen del simulator agresivo (Fase 2),
no de aquí.

## Cómo se descubren los servicios

`ContainerManager::buildDockerContainer()` aplica estas labels al crear
cada contenedor de plantilla:

- `noctua.kind=template-service`
- `noctua.service_id=<id>`
- `noctua.internal_port=<port>`

El load-generator filtra por la primera y construye la URL como
`http://<container_name>:<internal_port>`. Ambos viven en la red
`noctua-network` y se resuelven por DNS interno.

## Uso

**Arranque normal**: viene incluido en `docker compose up -d`.

**Apagarlo temporalmente**:

    docker compose stop load-generator

**Re-encenderlo**:

    docker compose start load-generator

**Ver qué está atacando**:

    docker logs -f noctua-load-generator

**Ver tráfico hacia un servicio específico**:

    docker exec noctua-load-generator cat /tmp/k6-svc-225.log

## Troubleshooting

**Síntoma**: dashboard sigue mostrando métricas planas.

1. ¿El load-generator está corriendo? `docker ps | grep load-generator`
2. ¿Está descubriendo el servicio? `docker logs noctua-load-generator | tail -20`. Debería ver `Spawning k6 for service_id=...`.
3. ¿El contenedor target tiene las labels? Si fue creado **antes** del fix de labels en `ContainerManager`, no las tiene. Solución: borrarlo desde la UI de Noctua y crear uno nuevo.

       docker inspect noctua-svc-<id> --format '{{json .Config.Labels}}' | jq

   Debe incluir `noctua.kind=template-service`.

## Stack técnico

- **Base**: `grafana/k6:latest` (oficial, gratis, sin telemetría).
- **Discovery**: bash + curl + jq sobre `/var/run/docker.sock`.
- **Tráfico**: k6 con stages declarativos.
