# Superficie de laboratorio CWE-78 (issue #9)

Endpoint deliberadamente vulnerable a inyeccion de comandos del SO, aislado,
como aplicacion objetivo del framework Umbra. **No es codigo de produccion.**

## Que es
- `POST /api/lab/connectivity-check` con `{"host": "..."}`: ejecuta `ping`
  por shell. Vulnerable a proposito (CWE-78). Decision D-1: no se corrige.
- Middleware `lab.deception`: puerta del laboratorio + consulta al detector
  de Umbra (fail-closed).

## Aislamiento (doble capa)
1. La ruta responde 404 salvo `APP_ENV=lab` Y `UMBRA_LAB_ENABLED=true`.
2. Corre solo en el contenedor `lab-target` (perfil Compose `lab`): sin socket
   de Docker, usuario `www-data`, `cap_drop: ALL`, `no-new-privileges`, limites
   de CPU/memoria/PIDs, sin puerto publicado al host.

## Flujo
- Detector dice no-ataque -> ejecuta el ping (200).
- Detector dice ataque -> bloquea (409); el comando no se ejecuta.
- Detector no responde -> bloquea (503, fail-closed).

## Levantar en desarrollo (Docker, WSL)
```bash
cp noctua-api/.env.lab-docker.example noctua-api/.env.lab
docker compose exec app php artisan key:generate --env=lab   # genera APP_KEY en .env.lab
docker compose --profile lab up -d --build lab-target
```
`.env.lab` esta en .gitignore (contiene APP_KEY). El detector real vive en el
repo activedefense-lab/umbra; sin el, el endpoint responde 503 por diseno.

## Pruebas
```bash
docker compose exec app php artisan test --filter=ConnectivityCheckTest
```
Cubre: peticion legitima deriva, ataque se bloquea (409), detector caido
(503), detector con error (503), ruta ausente fuera de lab (404).

## Fuera de alcance de #9
El senuelo real con Ollama y el registro forense completo son la issue #15.
La demostracion con commix es la #16.
