# Análisis de vulnerabilidades de Noctúa — entorno del laboratorio

> **Tarea del codirector Yamit** (Marco Metodológico §11.5, hoja *Herramientas* del
> Planteamiento): ejecutar el análisis de vulnerabilidades sobre la aplicación del
> laboratorio **antes** de desplegar el framework, para no montar la solución sobre
> una aplicación que conserve entradas explotables ajenas al experimento.
>
> **Fecha:** 16 de septiembre de 2026
> **Objetivo:** Noctúa desplegada en `noctua-lab` (`http://192.168.56.101/`)
> **Ejecutado por:** Noel Santiago
> **Estado del repositorio:** `main` en `1de3506`

---

## 1. Propósito y criterio de clasificación

Este análisis **no busca dejar Noctúa sin vulnerabilidades.** La Decisión D-1 del
proyecto conserva a propósito las debilidades de la aplicación: son el objeto de
estudio del framework. El propósito es distinto y lo fija Yamit: **distinguir dos
categorías** para no contaminar el experimento.

| Categoría | Qué se hace | Por qué |
|---|---|---|
| **Superficie del experimento** | Se conserva | Es lo que el framework va a detectar y estudiar (inyección, escalada) |
| **Ruido ajeno al experimento** | Se corrige o se documenta | Si el atacante entra por aquí, la corrida mide el ruido, no el framework |

Sin este análisis, D-1 suena a "lo dejamos roto". Con él, D-1 es "inventariamos la
superficie de ataque y elegimos qué conservar, con justificación verificada".

---

## 2. Herramientas empleadas

| Herramienta | Tipo | Rol | Fuente |
|---|---|---|---|
| **OWASP ZAP 2.16.0** | DAST (escáner web activo) | Escaneo pasivo y activo de la superficie HTTP | Libre. Equivalente comunitario de Acunetix (§11.5) |
| **curl** | Cliente HTTP | Pruebas manuales de control de acceso y cabeceras | Base del sistema |
| **psql** | Cliente PostgreSQL | Verificación del modelo de datos (equipos, servicios) | Base del stack |
| **Lectura de código** | Revisión manual | Confirmación de hallazgos en `ServicePolicy`, `ServiceController`, `Service` | — |

> **Nota metodológica.** ZAP escanea la superficie HTTP, pero no autentica ni sigue
> la lógica REST de la API por sí solo. El escaneo automático cubrió las cabeceras y
> el frontend estático; el control de acceso y el hashing se verificaron a mano con
> `curl` y lectura de código, que es más preciso para lógica de aplicación. OpenVAS
> (§11.5) se descartó para esta pasada: escanea red y sistema, no la lógica de una
> aplicación web, que es donde vive la superficie del experimento.

---

## 3. Resultado principal: dos de tres vulnerabilidades "documentadas" ya no existen

La auditoría de consolidación del semestre pasado listaba tres debilidades de control
de acceso y manejo de secretos. **La verificación directa sobre el código y el
comportamiento en ejecución las corrige:**

| Hallazgo de la auditoría inicial | Verificación (16/09/2026) | Veredicto |
|---|---|---|
| `ServicePolicy` sin scoping por `team_id` | `ServicePolicy.php:16` verifica `$user->team_id === $service->team_id`; `ServiceController.php:51` filtra la lista por `$request->user()->team->services()` | **No se reproduce** — corregido |
| `api_key_hash` sin `$hidden`, se serializa en JSON | `Service.php:35-36` lo declara en `$hidden`; no aparece en la respuesta de `GET /api/services/1` | **No se reproduce** — corregido |
| `api_key_hash` en SHA-256 sin sal | `ServiceController.php:78` y `:104`: `hash('sha256', $plainKey)` | **Confirmado** — severidad media (ver §5.1) |

Esto es lo que distingue una auditoría real de copiar la lista vieja. El informe honesto
documenta que se verificaron y dos están corregidas, no que siguen abiertas.

---

## 4. Pruebas de control de acceso (evidencia)

Se obtuvieron tokens de los tres roles del seeder (`admin`, `operator`, `viewer`,
contraseña `password`) y se lanzaron ataques reales contra la API.

### 4.1 Control por rol — funciona

Un `viewer` (rol de solo lectura) intenta escribir:

```
GET    /api/services      -> 200   (leer: permitido, correcto)
POST   /api/services      -> 403   (crear: bloqueado, correcto)
DELETE /api/services/1    -> 403   (borrar: bloqueado, correcto)
```

El control de autorización por rol está bien implementado.

### 4.2 Aislamiento entre equipos (IDOR) — no reproducible con los datos actuales

El `operator` lista únicamente los servicios de su equipo: IDs `[1, 2, 3]`. Consulta a
la base de datos confirma que los tres pertenecen al `team_id = 1` (Noctua Team), que
es el equipo del operator. Los IDs 4 y 5 devuelven 404 (no existen).

**No se pudo demostrar un IDOR** porque el `LabSeeder` solo pobló un equipo — no hay
servicios de otro equipo a los que acceder indebidamente. Y la lectura de código
muestra que el scoping por `team_id` **sí está presente** tanto en la policy como en
el controlador. La vulnerabilidad que la auditoría inicial atribuía a este punto no
existe en el código actual.

### 4.3 Manejo del secreto de servicio — parcialmente correcto

- `api_key_hash` **no se serializa** en las respuestas JSON (`$hidden` activo).
- El hash usa **SHA-256 sin sal** — confirmado, es la única debilidad real de este bloque.

---

## 5. Hallazgos confirmados

### 5.1 `api_key_hash` con SHA-256 sin sal — MEDIA — CONSERVAR

**Qué.** Las claves de servicio se almacenan como `hash('sha256', $plainKey)` sin sal
(`ServiceController.php:78`, `:104`).

**Severidad matizada.** Un hash sin sal es vulnerable a rainbow tables **cuando el
valor de entrada es de baja entropía** (contraseñas humanas). Aquí las claves se
generan con `Str::random(40)` — 40 caracteres aleatorios. El riesgo práctico de
inversión es bajo, pero la ausencia de sal es una desviación real de buenas prácticas
(no permite defensa en profundidad si la generación cambiara a algo más débil).

**Veredicto: CONSERVAR.** Es una debilidad de diseño auténtica de Noctúa, documentada,
con causa raíz clara. Vale como caso de estudio. No es una entrada explotable que
comprometa el experimento: no da acceso, no permite inyección.

### 5.2 Nombre de ruta duplicado (`login`, `register`) — BAJA — CONSERVAR

**Qué.** `login` y `register` están registrados en `/api/...` y en la raíz con el
mismo nombre. Impide `php artisan route:cache`.

**Veredicto: CONSERVAR.** Defecto real de la aplicación. No es explotable; solo impide
una optimización. Documentado en la sesión del 28/08/2026.

---

## 6. Hallazgos de configuración del despliegue (ZAP)

Escaneo ZAP sobre `http://localhost/`: **3 Medium, 3 Low, 2 Informational.**

Todos son de **configuración del servidor**, no de la lógica de Noctúa. Se **corrigen**
antes de la fase de validación, porque son ruido que ensuciaría el registro que el
framework va a analizar y que un evaluador señalaría de inmediato.

| Alerta ZAP | Severidad | Categoría | Acción |
|---|---|---|---|
| Server Leaks Version Information (`Server: nginx/1.24.0 (Ubuntu)`) | Medium | Divulgación | Corregir: `server_tokens off` en Nginx |
| Content Security Policy Header Not Set | Medium | Cabecera ausente | Corregir: añadir CSP en el bloque `server` |
| Missing Anti-clickjacking Header (`X-Frame-Options`) | Medium | Cabecera ausente | Corregir |
| X-Content-Type-Options Header Missing | Low | Cabecera ausente | Corregir |
| Private IP Disclosure | Low | Divulgación | Revisar: puede ser inherente al laboratorio host-only |
| Information Disclosure - Suspicious Comments | Low | Código fuente | Revisar en el build de producción |
| Hidden File Found | Informational | Falso positivo | Descartado: `.env` y `.git` devuelven 403 (ver §7) |
| Modern Web Application | Informational | Informativo | Sin acción |

### Verificación de exposición de archivos sensibles

```
GET /.env         -> 403
GET /.git/config  -> 403
```

El bloque `location ~ /\.` de Nginx protege los archivos ocultos. El "Hidden File
Found" de ZAP es un falso positivo.

---

## 7. Decisión sobre las cabeceras de seguridad

Las cuatro cabeceras ausentes (versión del servidor, CSP, X-Frame-Options,
X-Content-Type-Options) se corrigen en el bloque `server` de Nginx y la corrección va
a `provision-app.sh`, no aplicada a mano.

**Matización para la fase de validación:** algunas de estas cabeceras cambian el
comportamiento observable de la aplicación. Como Noctúa es el señuelo que el atacante
va a sondear, hay que decidir con Fabián y Yamit **cuáles se aplican**: un señuelo con
cabeceras de seguridad perfectas puede resultar menos verosímil que uno con la
configuración descuidada típica de una aplicación real. La corrección técnica está
lista; su aplicación es una decisión de diseño del señuelo, no solo de seguridad.

---

## 8. Conclusión

**El entorno del laboratorio está limpio de entradas explotables ajenas al
experimento.** No se encontró ninguna vulnerabilidad que permita a un atacante entrar
por una vía distinta a la que el framework va a estudiar:

- El control de acceso por rol funciona.
- El scoping por equipo está implementado en policy y controlador.
- Los secretos no se filtran en las respuestas.
- Los archivos sensibles están protegidos.

Las debilidades que **se conservan** (SHA-256 sin sal, ruta duplicada) son de estudio,
no de acceso: ninguna abre una puerta trasera al experimento.

Las de **configuración** (cabeceras, versión del servidor) se corrigen antes de la
validación, con la salvedad del §7 sobre la verosimilitud del señuelo.

**Se puede proceder al despliegue del framework** una vez aplicadas las correcciones de
cabeceras. La superficie que el framework atacará —`/login`, los endpoints de la API—
es la del experimento, no la de una configuración descuidada.

---

## 9. Pendientes derivados de este análisis

1. **Añadir las cabeceras de seguridad a `provision-app.sh`** (§7), tras decidir con
   Fabián/Yamit cuáles no restan verosimilitud al señuelo.
2. **`server_tokens off`** en la configuración de Nginx.
3. **Poblar un segundo equipo en el `LabSeeder`** si se quiere una prueba de IDOR
   concluyente — hoy no se puede demostrar ni descartar del todo por falta de datos,
   aunque el código sugiere que el scoping funciona.
4. **Documentar la corrección de las dos vulnerabilidades** que la auditoría inicial
   daba por abiertas, para que el traspaso no las siga arrastrando.

---

## 10. Anexo — evidencia recolectada

Archivos en `~/auditoria/` de la VM:

| Archivo | Contenido |
|---|---|
| `cabeceras-raiz.txt` | Cabeceras HTTP de `/` |
| `cabeceras-api.txt` | Cabeceras HTTP de `/api/login` |
| `evidencia-acceso.txt` | Resultados de las pruebas de control de acceso |
| `zap-raiz.html` | Informe completo de ZAP sobre `/` |
| `zap-api.html` | Intento de ZAP sobre `/api/` (404, la API no tiene raíz) |

Los tokens de sesión usados en las pruebas se eliminaron con `shred` al terminar: esta
es la máquina objetivo del laboratorio y no deben quedar credenciales en disco.

---

*Análisis ejecutado el 16 de septiembre de 2026. Todos los códigos HTTP, referencias a
líneas de código y conteos de alertas están tomados de la ejecución real sobre
`noctua-lab`.*
