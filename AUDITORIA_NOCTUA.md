# Auditoría y consolidación de Noctúa

> Brief para Claude Code. Ejecutar desde la raíz del repositorio local de Noctúa.

## Contexto

Noctúa es una aplicación de monitoreo de microservicios desarrollada el semestre
pasado. Hoy se reutiliza con un propósito distinto: será la **aplicación web
objetivo** de un laboratorio de seguridad. No es el producto del proyecto actual;
es mobiliario de laboratorio.

Existen (o existieron) cuatro versiones divergentes:

- La rama publicada en GitHub.
- La copia local de Camila (esta máquina).
- La copia local de Noel.
- Una copia en un VPS de Hetzner — **dada por perdida, no intentar recuperarla**.

Se sabe además que la aplicación tiene un fallo de control de acceso: un usuario
sin privilegios puede convertirse en administrador.

## Objetivo

Producir un diagnóstico que permita decidir, con evidencia, **cuál versión se
convierte en la única canónica**, y dejar la aplicación en estado desplegable
sobre Nginx sin Docker.

## Reglas no negociables

- **Nunca** ejecutar `git push --force`, `git reset --hard` sobre trabajo no
  respaldado, ni borrar ramas remotas.
- Todo trabajo de consolidación va en una rama nueva, jamás directo a `main`.
- No modificar código en esta fase salvo que se indique explícitamente en la
  Fase 4. Primero diagnosticar, después intervenir.
- Si algo es ambiguo, preguntar antes de actuar.

---

## Fase 1 — Forense de Git

Determinar el estado real del repositorio antes de mirar una sola línea de código.

- ¿Es esta carpeta un repositorio Git? ¿Tiene remoto configurado y apunta a dónde?
- ¿Hay cambios sin commitear o archivos sin trackear? Listarlos y clasificarlos
  (código fuente / configuración / dependencias / basura).
- ¿Cuánto diverge esta copia del remoto? Cuántos commits adelante, cuántos atrás.
- Fecha del último commit local y del último commit remoto.
- ¿Hay ramas locales sin publicar? ¿Hay stashes olvidados?
- ¿Existen archivos sensibles versionados por error (`.env`, credenciales, claves,
  volcados de base de datos)? Reportarlos sin imprimir su contenido.

**Entregable:** una tabla que compare copia local vs. remoto, y un veredicto
explícito: *la versión más completa es X, y estas son las razones*.

## Fase 2 — Inventario técnico

- Lenguaje, framework y versión exacta (confirmar si es Laravel y qué versión).
- Gestor de dependencias y estado del archivo de bloqueo (`composer.lock`,
  `package-lock.json`, etc.).
- Requisitos de tiempo de ejecución: versión de PHP/Node, extensiones necesarias,
  motor de base de datos.
- Variables de entorno requeridas: listar los nombres leyendo `.env.example` o
  el código. **No imprimir valores.**
- ¿Cómo se sirve hoy la aplicación? Buscar `Dockerfile`, `docker-compose.yml`,
  `Procfile`, configuración de servidor embebido. Documentarlo — hay que
  reemplazarlo por Nginx.
- Migraciones y semillas de base de datos: ¿existen? ¿corren limpias desde cero?

**Entregable:** un `REQUISITOS.md` con todo lo que la aplicación necesita para
arrancar en una máquina virgen.

## Fase 3 — Prueba de arranque

Intentar levantar la aplicación localmente y documentar el resultado real, sin
maquillarlo.

- Instalar dependencias. Registrar cada error.
- Correr migraciones contra una base de datos limpia.
- Arrancar la aplicación y comprobar que responde.
- Si no arranca: identificar la causa raíz exacta y estimar el esfuerzo de
  arreglo. **No arreglarla todavía.**

**Entregable:** veredicto binario — *arranca* / *no arranca*, con la lista de
bloqueadores ordenada por esfuerzo.

## Fase 4 — Auditoría del control de acceso

La aplicación tiene un fallo conocido de escalada de privilegios. Esta fase es
**defensiva**: localizar el fallo y corregirlo.

- Mapear cómo se representa el rol de administrador (columna, tabla, enum,
  política, middleware).
- Identificar **todos** los puntos donde ese rol puede asignarse o modificarse:
  registro de usuario, edición de perfil, endpoints de API, asignación masiva de
  atributos, comandos de consola, semillas.
- Determinar cuáles de esos puntos carecen de verificación de autorización.
- Revisar si hay otros fallos del mismo tipo: acceso a recursos ajenos por
  identificador, rutas administrativas sin middleware, endpoints sin protección.

**Entregable:** un `HALLAZGOS_ACCESO.md` que describa cada fallo, el archivo y
la línea, y la corrección propuesta. Aplicar las correcciones en una rama
`hardening-control-acceso`, con un commit por hallazgo.

> **Nota de alcance:** no escribir código de explotación ni pruebas de
> penetración. El objetivo es cerrar los fallos y dejarlos documentados.

## Fase 5 — Ruta a Nginx sin Docker

Determinar qué hace falta para servir la aplicación directamente sobre Nginx en
un servidor Linux, sin contenedores.

- ¿Qué proceso debe correr detrás de Nginx (PHP-FPM, un servidor de aplicación,
  un servicio systemd)?
- ¿Qué directorio es la raíz pública?
- ¿Qué reglas de reescritura y cabeceras necesita el framework?
- ¿Qué permisos de archivo requieren los directorios de escritura?

**Entregable:** un borrador de bloque `server` de Nginx y la lista de servicios
systemd necesarios. No hace falta que esté probado — hace falta que esté escrito.

---

## Salida final

Al terminar, generar `ESTADO_NOCTUA.md` con:

1. **Recomendación de consolidación** — qué versión se adopta como canónica y
   qué se hace con las demás. Una sola frase, sin ambigüedad.
2. **Estado de arranque** — funciona / no funciona, y por qué.
3. **Fallos de control de acceso** — cuántos, cuáles, cuáles quedaron corregidos.
4. **Requisitos de despliegue** — lo mínimo que necesita una VM limpia.
5. **Riesgos abiertos** — lo que quedó sin resolver y por qué importa.

Al final, listar de forma explícita **qué se supuso** y **qué no se pudo
verificar**. La honestidad sobre los huecos vale más que un informe completo
pero adornado.