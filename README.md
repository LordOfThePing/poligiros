# Poligiros

Plataforma de certificación en coaching de carrera para Gabriela Kyriazis.

## Setup local

### 1. Clonar e instalar dependencias

```bash
git clone <repo>
cd poligiros
npm install
```

### 2. Variables de entorno

Copiá `.env.example` a `.env` y completá los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión a PostgreSQL |
| `NEXTAUTH_SECRET` | Secreto para JWT (generá con `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL base de la app (ej: `http://localhost:3000`) |
| `SUPERVISOR_EMAIL` | Email de la supervisora |
| `SUPERVISOR_PASSWORD` | Contraseña inicial de la supervisora |
| `CLOUDFLARE_R2_ACCOUNT_ID` | ID de cuenta de Cloudflare |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Access key de R2 |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Secret key de R2 |
| `CLOUDFLARE_R2_BUCKET_NAME` | Nombre del bucket R2 |
| `CLOUDFLARE_R2_PUBLIC_URL` | URL pública del bucket |
| `OPENAI_API_KEY` | API key de OpenAI (para insights de Anclas de Carrera) |
| `RESEND_API_KEY` | API key de Resend (para emails de notificación) |

### 3. Base de datos

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

El seed crea:
- **Supervisora**: credenciales de `SUPERVISOR_EMAIL` / `SUPERVISOR_PASSWORD`
- **Demo alumna 1**: `alumna1@demo.com` / `alumna123`
- **Demo alumna 2**: `alumna2@demo.com` / `alumna123`
- **Demo cliente 1**: `cliente1@demo.com` / `cliente123`
- **Demo cliente 2**: `cliente2@demo.com` / `cliente123`

### 4. Iniciar

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000)

## Deploy en Railway

1. Crear un proyecto en Railway con PostgreSQL addon
2. Configurar todas las variables de entorno del `.env.example`
3. Conectar el repositorio — Railway usa `railway.toml` para el build y deploy

El build command corre automáticamente las migraciones de Prisma.

## Estructura del proyecto

```
app/
  api/           API routes
  supervisor/    Dashboard de supervisora
  student/       Dashboard de student coach
  client/        Portal del cliente
  login/         Página de login
components/
  ui/            Componentes shadcn/ui
  supervisor/    Sidebar de supervisora
  student/       Sidebar de student
  client/        Topbar de cliente
lib/
  auth.ts        Configuración NextAuth
  prisma.ts      Cliente Prisma singleton
  r2.ts          Upload a Cloudflare R2
  email.ts       Emails via Resend
  date.ts        Helpers de fechas
prisma/
  schema.prisma  Schema de la base de datos
  seed.ts        Script de seed
```

## Roles

- **SUPERVISOR**: Gaby — ve todo, revisa supervisiones, gestiona módulos y cohortes
- **STUDENT_COACH**: Alumnas — completan módulos, gestionan clientes, registran sesiones
- **CLIENT_USER**: Clientes — completan los tests diagnósticos
