# Arquitectura del laboratorio de engaño — decisiones y supuestos

Este documento reúne las decisiones de arquitectura tomadas para desplegar
Noctúa como aplicación objetivo del laboratorio de engaño (framework
Ollama + demonio Python sobre tráfico de Nginx), y los supuestos de
seguridad bajo los que ese despliegue es válido. Sirve como justificación
metodológica: de aquí sale la sección de supuestos del anteproyecto.

Cada decisión se tomó verificando el comportamiento real del código antes
de decidir, no por convención o intuición.

## Decisión 1 — Un solo origen: Nginx reparte por ruta

Nginx sirve todo detrás de un único host/puerto, sin subdominios ni
puertos separados para frontend y API:

- `/` → archivos estáticos del build de Vite, con `try_files … /index.html`
- `/api`, `/horizon`, `/up`, `/storage`, `/vendor` → PHP-FPM

**Justificación.** El framework de engaño necesita una única fuente de
verdad para observar tráfico: si el frontend y la API vivieran en orígenes
distintos, habría dos puertas de entrada, y el demonio que vigila el
`access_log` de Nginx quedaría ciego a la mitad del tráfico salvo que
duplicara su instrumentación en dos sitios. Un solo origen también elimina
la necesidad de configurar CORS, y hace estructuralmente imposible que
vuelva a colarse el error que ya bloqueó un despliegue anterior: el
frontend con la URL de la API escrita a mano apuntando a `localhost:8000`
en vez de resolverla en runtime.

**Punto de atención.** Los assets del panel de Horizon se publican bajo
`public/vendor/horizon/`. Si la ruta `/vendor` no se enruta a PHP-FPM, el
panel de Horizon carga en blanco — es una consecuencia directa de este
mismo origen compartido, no un bug aparte.

## Decisión 2 — Provisioning de contenedores apagado; el simulador aporta el realismo

`ContainerManager` depende de un socket de Docker (`/var/run/docker.sock`)
que no existe en un despliegue nativo sobre Nginx. En vez de dejar que esa
dependencia falle en bucle contra un daemon inexistente, se apaga
explícitamente con la bandera `NOCTUA_CONTAINER_PROVISIONING=false`
(`config/noctua.php`, nunca leída con `env()` directo fuera de un archivo
de configuración). Con la bandera apagada, el scheduler deja de programar
`SyncContainerStatusJob`, y `ServiceController::store`/`start`/`stop`/`restart`
devuelven `422` con un mensaje explícito en vez de intentar hablarle a
Docker.

Los datos que hacen creíble al objetivo —servicios activos, latencias
variables, incidentes— los produce en cambio `scripts/simulator.py`, un
script que no depende de Docker en absoluto: emula tres servicios externos
con personalidades de tráfico distintas (uno sano, uno inestable, uno
crítico con outages periódicos) y les manda heartbeats y métricas reales
contra la API de Noctúa.

**Justificación.** El objetivo del laboratorio exige una organización
simulada poblada con datos sintéticos realistas, no una aplicación vacía.
Una Noctúa sin contenedores y sin este flujo mostraría un dashboard en
blanco: un objetivo sin actividad no es creíble como señuelo. El
simulador ya existía en el repositorio antes de este trabajo — lo que
faltaba era la bandera para desactivar limpiamente la mitad de la
aplicación que no puede correr en la VM, sin que esa ausencia se note como
una falla.

**Por qué `422` y no ocultar los endpoints.** Un `422` con mensaje honesto
("el provisioning de contenedores está deshabilitado en este despliegue")
es tráfico de error normal, indistinguible de cualquier otra validación de
negocio. Un `500` por un Docker ausente, o un endpoint que directamente
desaparece, sería una señal reconocible de que el entorno atacado es un
laboratorio desconectado de su infraestructura real — exactamente el tipo
de pista que un framework de engaño no puede permitirse filtrar.

## Decisión 3 — Dos máquinas virtuales en red host-only

El laboratorio corre sobre dos VMs separadas, comunicadas solo por una red
privada host-only:

- **`noctua-lab`** — Nginx, PHP-FPM, PostgreSQL, Redis, Noctúa, el
  simulador y el demonio Python de detección. El demonio vive acá porque
  necesita acceso local a los logs de Nginx y al sistema de archivos.
- **`noctua-motor`** — únicamente Ollama, escuchando solo en la red
  privada, sin salida ni entrada pública.

**Justificación, en orden de peso:**

1. **Validez de la medición.** Uno de los objetivos del laboratorio es
   medir la latencia de detección del framework. Si el motor de
   inferencia (Ollama) compitiera por CPU en la misma máquina que la
   aplicación bajo ataque, esas cifras medirían contención de recursos
   entre procesos, no el desempeño real del framework de engaño.
2. **Modelo de amenaza.** Si un atacante compromete el host y el "cerebro"
   del framework de detección vive en esa misma máquina, puede
   manipularlo o apagarlo antes de que registre nada. Separar el motor de
   inferencia lo pone fuera del alcance directo de un compromiso del
   objetivo.
3. **Coherencia con la arquitectura de la industria.** Es el mismo patrón
   que EDR, XDR y SIEM: un agente ligero en el equipo monitoreado y un
   motor de análisis centralizado, separado, que ese agente consulta.

## Supuestos del laboratorio

Estas no son decisiones de arquitectura sino condiciones bajo las cuales
las decisiones anteriores — y las debilidades deliberadas de Noctúa como
objetivo— siguen siendo seguras de mantener. Si alguno de estos supuestos
deja de cumplirse, hay que revisar el diseño antes de seguir.

**Credenciales del seeder son deliberadamente débiles.** `DatabaseSeeder`
crea tres usuarios (`admin@noctua.dev`, `operator@noctua.dev`,
`viewer@noctua.dev`) con la misma contraseña (`password`) en texto plano
en el propio código del seeder. Esto es aceptable únicamente porque el
laboratorio es un entorno cerrado sin exposición pública: la debilidad es
parte del objetivo a atacar, no un descuido. Estas credenciales no deben
existir en ningún despliegue de Noctúa con acceso desde fuera de la red
del laboratorio.

**Las claves del simulador son conocidas por diseño.** `LabSeeder` siembra
los tres servicios externos con las API keys que provienen de variables de
entorno (`NOCTUA_API_KEY_PAGOS`, `_INVENTARIO`, `_NOTIFICACIONES`), y
`noctua-api/.env.lab.example` documenta esos valores como marcadores
reemplazables en texto plano dentro de un archivo versionado. Que estas
claves sean triviales de descubrir no es un defecto a corregir: son
credenciales de servicio dentro de un laboratorio cerrado, pensadas para
ser conocidas por quien opera el entorno, no para resistir un ataque
externo.

**La red host-only es obligatoria, no opcional.** Los dos supuestos
anteriores solo son seguros mientras `noctua-lab` y `noctua-motor` estén
efectivamente aisladas de cualquier red con acceso a internet o a la red
del hogar/oficina donde corren. Si cualquiera de las dos VMs sale de la
red host-only —una interfaz mal configurada, un puerto reenviado por
error—, las credenciales débiles del seeder y las claves conocidas del
simulador dejan de ser "debilidades controladas del objetivo" y pasan a
ser vulnerabilidades reales expuestas al exterior. La separación de red no
es una medida de rendimiento: es la condición que sostiene todos los demás
supuestos de seguridad del laboratorio.
