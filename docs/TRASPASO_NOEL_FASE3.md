# Traspaso a Noel — cierre del 25 de agosto de 2026

> Léelo entero antes de tocar el repositorio. La sección 5 es lo que tienes que
> hacer tú; el resto es el contexto que necesitas para no repetir trabajo ni
> deshacer decisiones.
>
> Si se lo pasas a Claude Code, dile explícitamente: **lee este documento
> completo y no ejecutes nada hasta que yo te lo pida**. Trae contexto de varios
> días y no es una lista de tareas para hoy.

---

## 1. Qué pasó y por qué

La tarea de Fabián es: **VM Linux + Noctúa sobre Nginx sin Docker + Ollama +
demonio Python**. Ninguno de esos cuatro puntos está hecho todavía.

Lo que se hizo primero fue preparar Noctúa para que sea *instalable* en esa VM.
No era trabajo opcional: con la Noctúa del lunes, la VM no habría arrancado.
Tres cosas lo impedían, y las tres están resueltas:

- El frontend tenía la URL de la API escrita a mano en 50 sitios apuntando a
  `localhost:8000`. Es el mismo fallo que bloqueó el despliegue en Hetzner.
- La configuración estaba acoplada a la red de Docker Compose (`DB_HOST=db`,
  `REDIS_HOST=redis`), nombres que no existen fuera de Compose.
- El scheduler llama a Docker cada 30 segundos vía `ContainerManager`. Sin Docker
  en la VM, eso falla en bucle y llena los logs.

Antes de todo eso hubo una auditoría del repositorio, porque había cuatro
versiones divergentes y nadie sabía cuál era la buena.

---

## 2. Resultados de la auditoría

Los informes completos están en `docs/auditoria/` (`ESTADO_NOCTUA.md` y
`REQUISITOS.md`), ya en `main`. Resumen de lo que importa:

**La versión canónica es `main`.** La copia de Camila era idéntica a
`origin/main` (cero commits de diferencia). No había trabajo perdido salvo lo de
Hetzner. `feature/templates` está 86 commits atrás sin commits propios —
obsoleta. `origin/main-old-backup` no tiene nada de valor único.

**Noctúa arranca.** Los 7 servicios levantan con `docker compose up --build`, la
API responde 200, Horizon procesa jobs. Las 22 migraciones y los seeders corren
limpios **contra una base de datos vacía**: 26 tablas, 7 plantillas de servicio.
Eso significa que una VM con PostgreSQL virgen va a funcionar.

**La base de datos de Noctúa es PostgreSQL 17, no MySQL.** El servicio `mysql`
del compose no pertenece a Noctúa: es la base del template "WordPress" que
`ContainerManager` provisiona. No tiene ningún `depends_on` desde los servicios
de Noctúa.

| Es Noctúa (va a la VM) | No es Noctúa (flota simulada, se queda fuera) |
|---|---|
| `app` — API Laravel 13.4 / PHP 8.4 | `mysql` |
| `horizon` — colas | `load-generator` |
| `scheduler` — cron | `docker/laravel-template` |
| `db` — PostgreSQL 17 | `docker/metrics-agent` |
| `redis` — Redis 7 | |
| frontend React/Vite (fuera del compose) | |

**Hoy no hay Nginx ni PHP-FPM en el proyecto.** El servicio `app` corre con
`php artisan serve`, que es el servidor de desarrollo de Laravel: un proceso, sin
concurrencia, no apto para producción. Migrar a Nginx no es reconfigurar algo
existente — es construir cinco piezas desde cero.

---

## 3. Hallazgos de seguridad — documentados, NO corregidos

Esto es deliberado y no hay que "arreglarlo". La aplicación objetivo del
laboratorio debe conservar sus debilidades, o el ataque controlado no demuestra
nada.

| Hallazgo | Dónde |
|---|---|
| Divulgación de versión sin autenticar | `GET /` devuelve `{"Laravel":"13.4.0"}`; cabecera `X-Powered-By: PHP/8.4.24` |
| `ContainerManager` monta `/var/run/docker.sock` y crea contenedores en el host | `app/Services/ContainerManager.php` — intencional desde el Sprint 5 |
| `ServicePolicy` sin scoping por `team_id` | Deuda del Sprint 4. **Es la escalada de privilegios conocida** |
| `api_key_hash` con SHA-256 sin sal en vez de bcrypt | `ApiKeyAuth` — optimización O(n)→O(1) que degradó la seguridad |
| `api_key_hash` sin `$hidden`, se serializa en JSON | Modelo `Service` |
| Comandos `Smoke*` que invocan Docker directamente | `app/Console/Commands/` — manuales, no programados |

La combinación del socket de Docker con `ServicePolicy` sin scoping da la cadena:
*usuario común → admin → crear contenedores → control del host*. En la VM queda
inerte porque no habrá Docker y la bandera de provisioning estará apagada.

---

## 4. Decisiones de arquitectura del laboratorio

Las tres se tomaron verificando el código antes de decidir, no por intuición. Si
tu Claude quiere discutirlas, aquí está el razonamiento completo.

### Mismo origen — Nginx reparte por ruta

- `/` → archivos estáticos del build de Vite, con `try_files … /index.html`
- `/api`, `/horizon`, `/up`, `/storage`, `/vendor` → PHP-FPM

**Por qué:** todo el tráfico atraviesa un único `access_log`, que es la fuente de
verdad del framework de engaño. Con orígenes separados habría dos puertas de
entrada y el demonio vigilaría una mientras la otra queda ciega. Elimina además
la configuración de CORS y hace imposible por construcción el bug de URLs
absolutas.

**Trampa:** los estilos y scripts del panel de Horizon se publican en
`public/vendor/horizon/`. Si `/vendor` no va a Laravel, el panel carga en blanco.

### Provisioning de contenedores apagado; el realismo lo aporta el simulador

`ContainerManager` no puede funcionar sin Docker. En vez de dejarlo fallar, se
apaga con `NOCTUA_CONTAINER_PROVISIONING=false`, y los datos realistas los genera
`scripts/simulator.py`, que **no necesita Docker en absoluto**.

**Por qué:** el Marco Metodológico exige "organización simulada poblada con datos
sintéticos realistas". Una Noctúa sin contenedores mostraría un dashboard vacío y
sería un objetivo poco creíble. El simulador ya existía en el repo desde mayo y
nadie lo había conectado a esto.

### Dos VMs en red host-only

- **`noctua-lab`** — Nginx, PHP-FPM, PostgreSQL, Redis, Noctúa, simulador **y el
  demonio Python** (tiene que ser local: lee logs y sistema de archivos)
- **`noctua-motor`** — solo Ollama, escuchando únicamente en la red privada

**Por qué, en orden de peso:**

1. **Validez de la medición.** El objetivo específico 4 promete medir latencia de
   detección. Si el motor de inferencia compite por CPU con la aplicación que se
   está midiendo, esas cifras miden contención de recursos, no el framework.
2. **Modelo de amenaza.** Si el atacante compromete el anfitrión y el cerebro del
   framework vive en esa misma máquina, puede manipularlo o apagarlo.
3. **Es la arquitectura de la industria.** EDR, XDR, SIEM: agente ligero en el
   equipo, motor de análisis centralizado.

### Y una que ya estaba decidida: cada uno levanta su par de VMs

No se sincronizan copiando archivos `.vdi`. Se sincronizan por **script
versionado en Git**: `provision-lab.sh` y `provision-motor.sh`. Si una máquina se
pierde, se reconstruye en veinte minutos. Si se configura a mano, es
irreproducible y uno de los dos queda atrás por definición.

Esto además es evidencia de reproducibilidad para la fase de validación del
proyecto, que Jorge va a pedir.

---

## 5. Lo que tienes que hacer tú

### Paso 1 — Sincronizar

```bash
cd ~/noctua
git status                    # si hay cambios sin commitear, PARA y avisa
git fetch origin --prune
git checkout main && git pull
```

Van a llegar dos PR para revisar (ver sección 6). Cuando estén fusionados,
vuelve a hacer `pull` antes de empezar la VM.

### Paso 2 — Fase 3: VM base

- **Ubuntu Server LTS**, dos instancias: `noctua-lab` y `noctua-motor`
- Red **host-only** entre ambas
- Usuario no-root, SSH, `ufw` permitiendo 22 y 80
- **Todo escrito como `provision-lab.sh` y `provision-motor.sh`**, versionados en
  una rama `infra/provision`. Nada configurado a mano.
- **Snapshot de cada VM apenas terminen.** Cuando algo falle en la Fase 4, se
  vuelve al snapshot en vez de reinstalar.

**Y antes que nada, el chequeo que puede cambiar el diseño** (sección 7):

```bash
ls /dev/kvm
grep -c -E '(vmx|svm)' /proc/cpuinfo
```

### Paso 3 — Fase 4: stack nativo

PostgreSQL 17, Redis 7, PHP 8.3+ con `pdo_pgsql`, `zip`, `pcntl`, `redis`,
PHP-FPM, **Nginx**, Composer, Node 20, Python 3 con `venv`.

**Criterio de aceptación: una página PHP de prueba responde a través de Nginx,
antes de meter Noctúa.** Si algo falla en ese punto, sabes que es la tubería y no
Laravel. No te saltes este paso.

### Paso 4 — Fase 5: despliegue (los dos juntos, en llamada)

- Clonar, `composer install --no-dev`, `npm run build`
- `.env` a partir de `noctua-api/.env.lab.example`
- `key:generate`, `migrate --seed`, y después `db:seed --class=LabSeeder`
- Permisos de `storage/` y `bootstrap/cache`
- Unidades systemd: Horizon, scheduler, y el simulador (con venv y
  `scripts/requirements.txt`)
- `config:cache`

> **Anota esto en el runbook:** con `config:cache` activo, cambiar
> `NOCTUA_CONTAINER_PROVISIONING` en el `.env` **no tiene efecto** hasta correr
> `php artisan config:clear && php artisan config:cache`. Es un fallo silencioso:
> la aplicación no da error, simplemente ignora el cambio.

### Paso 5 — Fase 6: Ollama y demonio

Ollama en `noctua-motor`. Demonio Python mínimo en `noctua-lab` que cierre el
circuito: lee el `access_log` de Nginx → consulta a Ollama → escribe una línea.

> Tailear el `access_log` sirve **como andamio**, no como solución final. Nginx lo
> escribe en la fase de log, después de que la respuesta ya salió, así que no
> sirve para engaño en tiempo real (< 5 ms según los requisitos). Para interceptar
> hay que estar en la ruta de la petición: `auth_request`, njs u OpenResty. Es una
> decisión de arquitectura pendiente con Fabián.

---

## 6. Qué cambió en el código

### Ya en `main` (PR #42)

**Frontend desacoplado.** Nuevo `noctua-app/src/lib/api.ts` con una instancia
única de axios (`baseURL: import.meta.env.VITE_API_URL ?? '/api'`) y un
interceptor que adjunta el token. Las 50 URLs absolutas migradas en 19 archivos,
y el `fetch` de `ServicesTable` convertido. `vite.config.ts` no se tocó: ya tenía
el proxy `/api → localhost:8000`.

*Impacto para ti:* después del pull, las llamadas van por `api.get('/services')`
en vez de `axios.get('http://localhost:8000/api/services')`. Si tenías trabajo
local sobre esos archivos, va a haber conflicto — avisa antes de resolverlo.

### Pendiente de fusionar: `feat/perfil-laboratorio`

1. **`noctua-api/.env.lab.example`** — perfil para VM sin Docker:
   `APP_ENV=production`, `APP_DEBUG=false`, `DB_HOST=127.0.0.1`,
   `REDIS_HOST=127.0.0.1`, `MAIL_MAILER=log`, variables de Docker comentadas.

   > `APP_DEBUG=false` no es cosmético: con debug activo, un error de SQL devuelve
   > la consulta completa y la traza al navegador. La inyección SQL sería trivial
   > y no demostraría nada. Con debug apagado el atacante trabaja a ciegas.

2. **Bandera `NOCTUA_CONTAINER_PROVISIONING`** — entrada en `config/noctua.php`
   (nunca `env()` directo) y tres cortes: el scheduler omite
   `SyncContainerStatusJob`; `ServiceController::store` devuelve 422 si llega
   `template_id`; `start`/`stop`/`restart` devuelven el mismo 422.

   422 y no ocultar los endpoints, a propósito: un 422 con mensaje honesto es
   tráfico normal, un 500 por Docker ausente sería una pista de que el entorno
   está desconectado.

3. **`database/seeders/LabSeeder.php`** — crea tres servicios externos (API
   Pagos, API Inventario, API Notificaciones) bajo el equipo `noctua-team`,
   tomando las claves del entorno. Idempotente. Aborta si falta una variable o si
   dos claves son iguales. **No** está en `DatabaseSeeder`: se invoca con
   `--class=LabSeeder`.

4. **`scripts/requirements.txt`** — declara `httpx~=0.27.0`. Sin esto,
   `provision.sh` no sabe qué instalar para el simulador.

**Verificado:** el simulador alimentó los tres servicios y el dashboard pasó de
*1 servicio, última señal hace 3 meses* a **4/4 activos** con latencias
diferenciadas (89 ms, 159 ms, 454 ms) y uptime heterogéneo.

### Pendiente de fusionar: `fix/frontend-url-config`

Añade `frontend_url` a `config/app.php` y reemplaza los `env('FRONTEND_URL')` que
estaban fuera de `config/` (`IncidentTriggeredNotification.php` y
`welcome.blade.php`). Con `config:cache` esos `env()` devuelven `null` y los
enlaces caen a `/` sin dar error. En la Fase 5 sí se hace `config:cache`, así que
esto muerde.

---

## 7. El problema abierto que puede cambiar el diseño

El Marco Metodológico compromete **Kata Containers sobre Firecracker** como
mecanismo de contención, en diecisiete menciones. La Tabla 5 dice textualmente:
*"MicroVM con núcleo Linux propio **sobre virtualización KVM**"*. Descarta gVisor
por escrito, y hay un requisito no funcional colgando —"aislamiento verificable a
nivel de microVM"— más un argumento de responsabilidad legal que lo usa como
mitigación.

**Firecracker necesita `/dev/kvm`.** El anfitrión es Windows con WSL2, y WSL2
exige el hipervisor de Hyper-V activo, que se apropia de las extensiones de
virtualización del procesador. La hipótesis —sin verificar todavía— es que
VirtualBox en ese modo no expone virtualización anidada al huésped, y por tanto
`/dev/kvm` no va a existir dentro de la VM.

**Nada de las Fases 3 a 6 necesita KVM.** Nginx, PHP-FPM, PostgreSQL, Redis,
Noctúa, Ollama y el demonio corren perfectamente sin él. El tema solo muerde
cuando lleguen al plugin de contención, en meses.

Por eso la decisión es **seguir con VirtualBox**, que es lo que ambos conocen, y
verificar. La elección es reversible precisamente por el `provision.sh`: si hace
falta migrar a Hyper-V o a metal desnudo, se corre el mismo script en la máquina
nueva.

**Chequeos que valen diez minutos y dan el pronóstico:**

1. En Windows, `winver` → ¿Pro o Home? (Hyper-V no existe en Home)
2. En PowerShell, `systeminfo` → línea de *Hyper-V Requirements*. Si dice que se
   detectó un hipervisor, WSL2 ya se apropió de las extensiones.
3. ¿El procesador es Intel o AMD?
4. En VirtualBox, crea una VM de prueba → System → Processor → ¿la casilla
   *Enable Nested VT-x/AMD-V* está disponible o gris? **Si está gris, ya saben la
   respuesta sin instalar nada.**

Si resulta que no hay KVM, la consecuencia no es técnica sino documental, y no la
deciden ustedes: va a Fabián planteada así — *"la contención por microVM exige
KVM; nuestro anfitrión es Windows con WSL2 y VirtualBox; verificamos y este es el
resultado. ¿Migramos el anfitrión o revisamos el mecanismo de aislamiento?"*

Carta a tener en el bolsillo antes de esa conversación: tienen dos máquinas
idénticas. Una podría quedar en arranque dual con Linux nativo como "metal del
laboratorio" cuando llegue la fase de contención, con KVM real y sin anidación.

---

## 8. Datos operativos

**Credenciales del seeder** (texto plano en `DatabaseSeeder.php`, laboratorio
cerrado, decisión consciente):

- `admin@noctua.dev` / `password` — Nicole Camila, admin
- `operator@noctua.dev` / `password` — Noel Santiago, operator
- `viewer@noctua.dev` / `password` — Juan Diego, viewer

**Levantar el entorno de desarrollo:**

```bash
cd ~/noctua && docker compose up -d
cd ~/noctua/noctua-app && npm run dev     # otra terminal, puerto 5173
```

**Correr el simulador sin instalar nada en el sistema:**

```bash
docker run --rm --network noctua_noctua-network \
  -v ~/noctua/scripts:/app -w /app \
  -e NOCTUA_API_KEY_PAGOS=<clave> \
  -e NOCTUA_API_KEY_INVENTARIO=<clave> \
  -e NOCTUA_API_KEY_NOTIFICACIONES=<clave> \
  -e NOCTUA_API_URL=http://noctua-app:8000/api \
  python:3.12-slim sh -c "pip install --quiet httpx && python simulator.py"
```

**Regla que evita un dolor de cabeza:** antes de suspender el equipo, `docker
compose stop`. Suspender con contenedores vivos rompe el canal de WSL y obliga a
reinstalar Docker Desktop. Ya pasó una vez.

**Método de trabajo:** rama por tarea, nunca commits directos a `main`, PR
revisado por el otro, nunca `push --force`. Con Claude Code, modo Plan y
aprobación manual. Y la regla que más ha valido esta semana: **verificar leyendo
el código antes de decidir** — evitó tres decisiones equivocadas en dos días.

---

## 9. Cabos sueltos menores

- **Servicio `laravel` (id 230)** en la base de datos: residuo del provisioning
  con Docker, sin señal desde hace meses. En la VM no debería existir.
- **`scripts/.env` local** define `NOCTUA_API_KEY` en singular; el `.env.example`
  y el código piden tres claves por servicio. Solo afecta a configuraciones
  locales viejas.
- **Juan Diego** aparece en el seeder y en los colaboradores del repositorio.
  Nadie le ha preguntado si tiene contexto del semestre pasado.
