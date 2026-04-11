# noctua

Plataforma de monitoreo y alertas inteligentes para microservicios.

**Vigila mientras dormís.**

---

## Requisitos previos

Cada integrante del equipo necesita instalar esto en su computador:

| Herramienta | Descarga | Verificar instalación |
|---|---|---|
| **Git** | [git-scm.com](https://git-scm.com/downloads) | `git --version` |
| **Docker Desktop** | [docker.com](https://www.docker.com/products/docker-desktop/) | `docker --version` |

> **Nota:** No necesitan instalar PHP, PostgreSQL, ni Redis. Docker se encarga de todo.

---

## Primer setup (una sola vez)

```bash
git clone https://github.com/Kmilap/noctua.git
cd noctua
cp .env.example .env
docker compose up -d --build
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

Abrir en el navegador: [http://localhost:8000](http://localhost:8000)

### Usuarios de prueba

| Email | Contraseña | Rol |
|---|---|---|
| admin@noctua.dev | password | Admin |
| operator@noctua.dev | password | Operator |
| viewer@noctua.dev | password | Viewer |

---

## Comandos del día a día

```bash
docker compose up -d          # Levantar
docker compose down            # Apagar
docker compose logs -f app     # Ver logs
docker compose exec app php artisan migrate   # Correr migraciones
docker compose exec app php artisan tinker    # Consola interactiva
```

---

## Flujo de trabajo con Git

```
main           ← código estable, nunca se trabaja acá
  └── develop  ← rama de integración
       ├── feature/auth          ← ejemplo: autenticación
       ├── feature/api           ← ejemplo: API REST
       └── feature/dashboard     ← ejemplo: dashboard
```

### Antes de empezar a trabajar

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nombre-descriptivo
```

### Cuando terminás algo funcional

```bash
git add .
git commit -m "feat: descripción clara"
git push origin feature/nombre-descriptivo
# Ir a GitHub → crear Pull Request hacia develop
```

---

## Estructura del proyecto

```
noctua/
├── app/
│   ├── Http/Controllers/       ← controladores
│   ├── Http/Middleware/        ← middleware API key
│   ├── Http/Requests/         ← validaciones
│   ├── Jobs/                  ← ProcessMetricJob, EvaluateAlertRulesJob
│   ├── Models/                ← modelos Eloquent
│   ├── Notifications/         ← email, Slack
│   └── Services/              ← RuleEvaluator, IncidentManager
├── database/
│   ├── migrations/            ← las 12 tablas
│   └── seeders/               ← datos de prueba
├── resources/views/           ← Blade + Livewire
├── routes/
│   ├── web.php                ← rutas dashboard
│   └── api.php                ← rutas API REST
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## Equipo

| Integrante | Rol |
|---|---|
| Nicole Camila Niño Ariza | Lead / Backend |
| Noel Santiago Méndez Jaimes | Backend / API |
| Juan Diego Niño Solano | Frontend / Dashboard |

Proyecto académico — UNAB, 2026.
