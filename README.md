# Poligiros

Plataforma de certificación en coaching de carrera para Gabriela Kyriazis.

Arquitectura **dividida** en dos apps independientes:

- **`frontend/`** — Vite + React 18 + React Router → Cloudflare Pages
- **`backend/`** — Hono API + Prisma (Node 20) → Hetzner (Docker)

Coaches y supervisora **inician sesión**; los clientes (coachees) **no**: acceden
a cada test mediante un **enlace mágico** único y temporal (`/t/:token`).

## Setup local

### 1. Base de datos (Postgres)

```bash
docker compose up -d        # levanta Postgres local (docker-compose.yml)
```

### 2. Backend

```bash
cd backend
npm install
cp ../.env.example .env      # completá la sección BACKEND (ver abajo)
npm run db:generate          # genera el cliente Prisma
npm run db:migrate           # aplica migraciones
npm run db:seed              # datos demo
npm run dev                  # API en http://localhost:3001
```

El seed crea:

- **Supervisora**: `SUPERVISOR_EMAIL` / `SUPERVISOR_PASSWORD`
- **Alumna 1**: `alumna1@demo.com` / `alumna123`
- **Alumna 2**: `alumna2@demo.com` / `alumna123`
- **Cliente 1**: Carlos López — *sin login, solo enlace mágico*
- **Cliente 2**: María Fernández — *sin login, solo enlace mágico*

### 3. Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:3001" > .env
npm run dev                  # app en http://localhost:5173
```

Abrí [http://localhost:5173](http://localhost:5173) e iniciá sesión como supervisora.

## Variables de entorno

Ver [`.env.example`](.env.example) — está dividido en una sección **BACKEND**
(`backend/.env`) y una **FRONTEND** (`frontend/.env`).

| App | Variable | Descripción |
|-----|----------|-------------|
| backend | `DATABASE_URL` | Conexión a PostgreSQL (requerida) |
| backend | `JWT_SECRET` | Secreto JWT — `openssl rand -base64 32` (requerida) |
| backend | `FRONTEND_URL` | Origen permitido para CORS |
| backend | `PORT` | Puerto de la API (default 3001) |
| backend | `SUPERVISOR_EMAIL` / `SUPERVISOR_PASSWORD` | Credenciales iniciales de la supervisora (seed) |
| backend | `OPENAI_API_KEY` | Insights de Anclas (opcional en dev) |
| backend | `RESEND_API_KEY` | Emails de notificación (opcional en dev) |
| backend | `CLOUDFLARE_R2_*` | Storage de materiales (opcional en dev) |
| frontend | `VITE_API_URL` | URL base de la API |

## Tests

```bash
cd backend  && npm test      # auth/JWT
cd frontend && npm test      # lógica de scoring de Anclas
```

## Deploy

- **Frontend → Cloudflare Pages**: build `npm run build` en `frontend/`, output
  `dist`, variable `VITE_API_URL=https://api.poligiros.com`. Auto-deploy en cada push.
- **Backend → Hetzner (Docker)**: `docker-compose.prod.yml` (api + postgres + nginx),
  TLS con un Cloudflare Origin Certificate en `nginx/`. Para desplegar:

  ```bash
  ./deploy.sh
  ```

## Estructura del proyecto

```
backend/
  src/
    index.ts          App Hono + registro de rutas + CORS
    lib/              auth (JWT/cookie), prisma, r2, email, date
    routes/           auth · client (token) · student · supervisor
  prisma/             schema.prisma + seed.ts
  Dockerfile
frontend/
  src/
    App.tsx           Árbol de rutas (React Router)
    lib/              api · auth · anclas · date
    components/       ui (shadcn) · tablero/SortableList
    pages/            login · supervisor/* · student/* · client/ (token flow)
nginx/                Config TLS de producción
docker-compose.prod.yml
deploy.sh
```

## Roles

- **SUPERVISOR**: Gaby — ve todo, revisa supervisiones, gestiona módulos y cohortes.
- **STUDENT_COACH**: Alumnas — completan módulos, gestionan clientes, registran sesiones, generan enlaces de test.
- **Clientes (coachees)**: sin cuenta — completan los tests y ven sus resultados vía enlace mágico temporal.
