# Superficie de laboratorio CWE-78 (issue #9)

Endpoint deliberadamente vulnerable a inyeccion de comandos del SO, aislado,
como aplicacion objetivo del framework Umbra. **No es codigo de produccion.**

## Que es
- `POST /api/lab/connectivity-check` con `{"host": "..."}`: ejecuta `ping`
  por shell. Vulnerable a proposito (CWE-78). Decision D-1: no se corrige.
- Middleware `lab.deception:host`: puerta del laboratorio + derivacion al
  punto de entrada unico del framework, `POST /interceptar` (umbra ADR-003),
  con fallo cerrado.

## Aislamiento (doble capa)
1. La ruta responde 404 salvo `APP_ENV=lab` Y `UMBRA_LAB_ENABLED=true`.
2. Corre solo en el contenedor `lab-target` (perfil Compose `lab`): sin socket
   de Docker, usuario `www-data`, `cap_drop: ALL`, `no-new-privileges`, limites
   de CPU/memoria/PIDs, sin puerto publicado al host.

## Flujo (umbra ADR-003)
- `accion=permitir` -> ejecuta el ping real (200).
- `accion=senuelo` -> 200 con la misma forma JSON (`host`, `exit_code`,
  `output`) y la salida generada por el senuelo; el comando no se ejecuta.
- Tiempo agotado, error o decision invalida -> 503 (fallo cerrado).

## Levantar en desarrollo (Docker, WSL)
Orden obligatorio: primero el framework, que crea la red `arya-lab`
(umbra ADR-003); `lab-target` se une a ella como red externa y desde ahi
alcanza solo al detector (`http://detector:8001`), no al senuelo ni a su base.
```bash
# En el repo activedefense-lab/umbra
infra/scripts/esqueleto.sh arriba
# En este repo
cp noctua-api/.env.lab-docker.example noctua-api/.env.lab
docker compose exec app php artisan key:generate --env=lab   # genera APP_KEY en .env.lab
docker compose --profile lab up -d --build lab-target
```
`.env.lab` esta en .gitignore (contiene APP_KEY).

**Importante:** con `php artisan serve`, los valores de `.env.lab` prevalecen
sobre `environment:` del Compose (verificado el 2026-11-27: un `.env.lab`
antiguo seguia enviando a `/analizar`). Si el archivo es anterior a umbra#15,
actualizar `UMBRA_DETECTOR_URL=http://detector:8001/interceptar` y
`UMBRA_DETECTOR_TIMEOUT=30`. El detector real vive en el
repo activedefense-lab/umbra; sin el, el endpoint responde 503 por diseno.

## Pruebas
```bash
docker compose exec app php artisan test --filter=ConnectivityCheckTest
```
Cubre: contrato enviado al framework, permitir (ping real), senuelo (salida
generada, sin ejecutar el comando), framework caido, con error o con
decision invalida (503) y ruta ausente fuera de lab (404).

## Pendiente
La integracion real con `/interceptar` (detector + senuelo + registro) se
verifica en umbra#15; la demostracion con commix es umbra#16.
