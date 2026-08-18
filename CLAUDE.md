# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture at a glance

Poligiros is a **split app**, not a Next.js monolith (the old Next.js app was
removed — do not look for `app/`, `middleware.ts`, root `lib/`/`prisma/`):

```
frontend/   Vite 5 + React 18 + React Router v6   → Cloudflare Pages (static)
backend/    Hono API on Node 20 + Prisma          → Hetzner (Docker, port 3001)
              │
            PostgreSQL
```

The frontend calls the backend over HTTP with `credentials: "include"`. They
deploy independently. In prod a Cloudflare Tunnel reaches the API directly —
there is no nginx and no published port.

## Commands

```bash
# Postgres (dev)
docker compose up -d                 # root docker-compose.yml — local Postgres only

# Backend (cd backend)
npm install
npm run db:generate                  # prisma generate (REQUIRED before tsc — the client
                                     #   is generated into backend/node_modules)
npm run db:migrate                   # prisma migrate dev
npm run db:seed                      # demo data (supervisor + 2 students + 2 clients)
npm run dev                          # tsx watch src/index.ts → http://localhost:3001
npm run build                        # tsc → dist/
npm test                             # vitest run (JWT/auth tests)
npx tsc --noEmit                     # type-check (run db:generate first!)

# Frontend (cd frontend)
npm install
npm run dev                          # vite → http://localhost:5173
npm run build                        # tsc --noEmit && vite build → dist/
npm test                             # vitest run (Anclas tier-logic tests)
```

> Vitest is pinned to **v3** in both apps because the dev Node is 20.10 and
> Vitest 4's rolldown needs Node ≥20.12. Bump Node before bumping Vitest.

## Auth — two tiers

**Coaches & supervisors log in. Clients (coachees) do NOT.** There is no
`CLIENT_USER` role.

1. **Coach / Supervisor — httpOnly cookie JWT** (`backend/src/lib/auth.ts`):
   - `POST /auth/login` → `Set-Cookie: token=<JWT>; HttpOnly; SameSite=None; Secure`
   - `GET /auth/me` hydrates the frontend (`frontend/src/lib/auth.tsx`) on mount,
     since the token is not readable from JS.
   - `POST /auth/logout` clears it.
   - `authMiddleware` reads the cookie → `jwtVerify` (jose) → `c.set("user", ...)`.
     `/supervisor/*` and `/student/*` are guarded by `authMiddleware` +
     `requireRole(...)` in `backend/src/index.ts`.
   - `loginUser` lazy-imports prisma so the JWT path stays DB-free and testable.

2. **Client — magic link, no session** (the A1 model):
   - A `TestAssignment` carries `accessToken` (random), `completeBy`,
     `resultsViewableUntil` — both driven by `AppSettings` (14/365 days by
     default, editable in the UI). The coach's assign route mints these and
     returns `${FRONTEND_URL}/t/<token>`.
   - `/client/t/:token` routes are NOT behind auth — the token IS the credential.
   - Token **state machine** (`backend/src/routes/client.ts` → `getAssignmentState`):
     ```
     completedAt == null & now > completeBy            → "expired" (410)
     completedAt == null                               → "form"    (200) take the test
     completedAt != null & now > resultsViewableUntil  → "expired" (410)
     completedAt != null                               → "results" (200) read-only
     ```
   - Frontend `/t/:token` (`frontend/src/pages/client/TokenPage.tsx`) renders the
     test (form), a read-only results view, or an "expired" message off that state.

## Data flow: test lifecycle

```
Coach assigns test to client   →  TestAssignment + accessToken/completeBy/resultsViewableUntil
                                   → returns magic link  (POST /student/clients/:id/assign)
Client opens /t/:token         →  state machine: form | results | expired
Client submits                 →  TestResponse (JSON) + completedAt set
Coach sends to supervision     →  SupervisionRequest (PENDING)
Supervisor reviews             →  SupervisionRequest (REVIEWED)
                                   + supervisorNotes (INTERNAL) + coachFeedback (CLIENT-VISIBLE)
```

`PLAN_VITAL` is a permanent placeholder — the assign route skips it.
`POST /student/assignments/:id/resend` mints a fresh token + resets `completeBy`.

`MODELO_NEGOCIO` ("Modelo de Negocio") is a normal assignable test like the others
(its own catalog row + magic link), not a post-test add-on. Its form
(`frontend/src/pages/client/tests/ModeloNegocioTest.tsx`) lets the client pick a
**Canvas** (Business Model Canvas) or **JOB** (job research) mode and fill it in,
then `submit`. The idea field **pre-fills from the client's latest completed
Tablero** — the form-state endpoints return `prefillIdea` via `latestTableroIdea()`
in `backend/src/routes/client.ts` (reused by `student.ts`), but it's freely
editable. The canvas pages render at `max-w-6xl` (the rest stay `max-w-2xl`).

**Feedback visibility:** `SupervisionRequest.supervisorNotes` is internal
(supervisor↔coach). `SupervisionRequest.coachFeedback` is shown to the client on
their results link. Do not surface `supervisorNotes` to clients.

## TestResponse JSON shapes

`TestResponse.responses` is an untyped `Json` column. Each test type writes a
different shape:

| Test | Key fields in `responses` |
|------|--------------------------|
| `ANCLAS_CARRERA` | `rawAnswers[40]`, `bonusItems[3]`, `finalAnswers[40]`, `scores{TF,GG,AU,SE,CE,SC,PD,EV}`, `ranking[8]`, `aiInsight` |
| `TABLERO_IDEAS` | `saber[]`, `saberPassion[]` (parallel bool), `saberRanking[]` (strings), `querer[]`, `quererRanking[]`, `sonar[]`, `sonarRanking[]`, `brainstormIdeas[]`, `aiIdeas[]`, `selectedIdea` |
| `PIRAMIDE_PROPOSITO` | `rol`, `valores`, `fortalezas`, `contextos`, `especialidad`, `propositoFinal` |
| `MODELO_NEGOCIO` | `kind` (`"CANVAS"` \| `"JOB"`), `selectedIdea`, `content{}` (keyed by canvas-block or job-field key) |

The supervisor's `ResponseViewer` (`frontend/src/pages/supervisor/SupervisionDetailPage.tsx`)
branches on `testType`. The Tablero branch prefers the `*Ranking` arrays and
falls back to the raw lists for legacy responses. The `MODELO_NEGOCIO` branch
renders read-only via `ModeloNegocioResult` (same component used on the client's
results page).

## Anclas de Carrera scoring

Step 2 offers "bonus candidates" via `selectBonusCandidates` in
`frontend/src/lib/anclas.ts` (a pure, unit-tested tier walk: start at score 6,
drop a tier at a time until ≥3 items qualify). The user picks 3; each gets `+4`
before anchor scoring. Scores are averages of 5 items per anchor. The AI insight
comes from `POST /client/t/:token/ai-insight` (top-3 anchors) and is saved into
`responses.aiInsight`.

## Tablero de Ideas — multi-step flow

`frontend/src/pages/client/tests/TableroTest.tsx` is a 3-step flow: fill three
dynamic columns → mark passions + drag-rank (via `frontend/src/components/tablero/SortableList.tsx`)
→ brainstorming. Rankings are stored as **strings** (not indices). Draft auto-saves
the step-1 columns to `localStorage` (`tablero-ideas-draft-{assignmentId}`); the
loader tolerates the old `{saber,querer,sonar,brainstorming}` format.

## Modelo de Negocio — Business Model Canvas

`frontend/src/components/canvas/` holds the canvas pieces, all driven by
`canvasModel.ts` (the single source of truth):

| File | Purpose |
|------|---------|
| `canvasModel.ts` | `CANVAS_BLOCKS` (key/label/guiding-question/tint/grid-area), `CANVAS_GRID_AREAS`, `JOB_FIELDS`, `INSTRUCTIONS` |
| `BusinessModelCanvas.tsx` | Presentational canvas; editable (`onChange`) **or** `readOnly`. Layout via the `.bmc-grid` class in `index.css` (stacks on mobile, reference grid at `lg`) |
| `InfoHint.tsx` | Dependency-free per-block `(i)` hint (hover + tap); no Radix Tooltip is installed |
| `ModeloNegocioResult.tsx` | Read-only view of a submitted response; branches on `kind` (canvas vs job) |

The canvas-block keys (`sociosClave`, `actividadesClave`, `recursosClave`,
`propuestaValor`, `relacionClientes`, `canales`, `segmentos`, `estructuraCostos`,
`fuentesIngresos`) are also the keys written into `responses.content`. The coach &
supervisor can edit a submitted Modelo via `ModeloNegocioEditor` in
`EditableResult.tsx`.

> History: this began as a post-Tablero workspace (the F7 `IdeaDevelopment` model
> + `DevelopIdea` component + `/develop` routes). That was removed when it became a
> standalone test — don't look for `IdeaDevelopment`, `DevelopIdea`, or `/develop`.

## Shared utilities

| File | Purpose |
|------|---------|
| `backend/src/lib/prisma.ts` | Prisma singleton |
| `backend/src/lib/auth.ts` | `signJWT`/`verifyJWT`/`authMiddleware`/`requireRole`/`loginUser` |
| `backend/src/lib/r2.ts` | Cloudflare R2 helpers + `isR2Configured()` |
| `backend/src/lib/uploads.ts` | Upload allowlist, size cap, object-key builder |
| `backend/src/lib/cohort.ts` | `getCoachAccess` — per-cohort permissions for a coach |
| `backend/src/lib/settings.ts` | `getSettings` — configurable link lifetimes (singleton row) |
| `backend/src/lib/email.ts` | Resend helpers (fire-and-forget) |
| `frontend/src/lib/api.ts` | fetch wrapper: `credentials: include`, 401 → `/login` (skips `/login` & `/t/`) |
| `frontend/src/lib/auth.tsx` | `AuthContext` + `useAuth()` |
| `frontend/src/lib/anclas.ts` | `selectBonusCandidates` (pure, tested) |
| `frontend/src/lib/date.ts` | es-AR date helpers |

## Email notifications

Three fire-and-forget triggers in `backend/src/lib/email.ts`
(`sendSupervisionSubmittedEmail`, `sendSupervisionReviewedEmail`,
`sendSessionRecordedEmail`). The supervisor address is fetched via
`prisma.user.findFirst({ where: { role: "SUPERVISOR" } })`.

## Environment variables

Backend `.env` (see `.env.example` → backend section): `DATABASE_URL` and
`JWT_SECRET` are required; `FRONTEND_URL` drives CORS; `PORT` defaults to 3001;
`OPENAI_API_KEY`, `RESEND_API_KEY`, `CLOUDFLARE_R2_*` fail gracefully if blank.
Generate the secret with `openssl rand -base64 32`.

Frontend `.env`: `VITE_API_URL` (default `http://localhost:3001`).

## Deploy

Live URLs: frontend `https://apppoligiros.flynnpedroa.engineer`, API
`https://apipoligiros.flynnpedroa.engineer`.

- **Frontend** → Cloudflare Pages: build `npm run build` in `frontend/`, output
  `dist`, env `VITE_API_URL=https://apipoligiros.flynnpedroa.engineer`.
  Auto-deploys on push.
- **Backend** → Hetzner Docker, `docker-compose.prod.yml` = **postgres + api +
  cloudflared**. There is no nginx and no published port: the Cloudflare Tunnel
  dials out, and its ingress (set in the Zero Trust dashboard) maps the API
  hostname to `http://api:3001` on the compose network. TLS terminates at
  Cloudflare, so no origin certificate is involved.
- **Deploying is `git pull` + `make` on the server** (there is no `deploy.sh`;
  the repo is checked out at `/opt/poligiros`):

  ```bash
  make prod-deploy      # git pull → rebuild → restart → prune → health check
  make prod-bootstrap   # fresh DB only: test catalog + supervisor login
  make prod-supervisor EMAIL=... PASSWORD=...   # create/reset Gaby's login
  make prod-logs-tunnel # "Registered tunnel connection" = tunnel is up
  ```

> `prisma migrate deploy` runs automatically in the container's `CMD` on every
> boot, so `backend/prisma/migrations/` **must stay committed**.
>
> `npm run db:seed` (`make prod-seed-danger`) **wipes every table** — it is demo
> data only. On a live DB use `db:bootstrap` / `db:set-supervisor`, which upsert.

## CIC (cohorts), module release and signup

"CIC" = Certificación en Coaching de Carrera y Bienestar Laboral. It is the
user-facing name for a `Cohort` (the model and the `/supervisor/cohortes` route
keep the old name). The term "SIC" is gone.

**Module content is shared; visibility is per cohort.** A `Module` (a CLASE)
holds `ModuleItem` cards — mirroring the Trello board it replaces — and each card
holds `ModuleLink`s. A `ModuleLink` is either a plain external link (Drive, Zoom,
an article) or an **uploaded document living in R2**, told apart by `storageKey`:
when it is set, the row owns a blob and deleting the link/card/module also
deletes the object (`deleteFromR2`), otherwise the URL just points somewhere we
do not own. The old flat `Material` model was replaced by these two tables.

Uploads go through `POST /supervisor/module-items/:itemId/files` and are limited
by `backend/src/lib/uploads.ts`: an **extension allowlist** (documents + images;
video and audio are rejected on purpose) and a 25 MB cap. The stored MIME is
derived from the extension, never taken from the browser, so the bucket cannot be
made to serve active content. R2 is optional — `isR2Configured()` makes the route
answer 503 with a clear message instead of an SDK stack trace when the
`CLOUDFLARE_R2_*` vars are blank.

Card consignas and module descriptions are **markdown**, rendered by
`frontend/src/components/Markdown.tsx` (react-markdown + remark-gfm, raw HTML NOT
enabled). `MarkdownEditor.tsx` gives the supervisor a toolbar and a preview tab,
and `stripMarkdown()` flattens the text for one-line list previews.

```
Module (CLASE 1)  ──<  ModuleItem ("TAREA 1", kind + consigna)  ──<  ModuleLink (título + url)
   │
   └──<  ModuleRelease (moduleId + cohortId, released, availableFrom?)
```

A coach sees a module when it is `published` (not a draft) **and** a
`ModuleRelease` for one of their cohorts has `released = true` and no future
`availableFrom`. There is no sequential lock any more — the supervisor releasing
a class *is* the gate.

**Per-cohort permissions** live on `Cohort`: `clientsEnabled` (may load coachees)
and `testsEnabled` (may assign tests), both defaulting to **false** — a coach
first takes the course. `getCoachAccess` (`backend/src/lib/cohort.ts`) returns the
union across a coach's enrollments and is enforced on `POST /student/clients`,
`POST /student/clients/:id/assign` and `.../resend`. The frontend mirrors it via
`GET /student/access` + `useCoachAccess()`, but the backend is the authority.
`Cohort.zoomUrl` is shown to enrolled coaches on Mi Programa, and
`GET /supervisor/cohorts/:id/emails` returns the roster ready to paste into a
Zoom invite.

**Self-signup is link-gated and expiring.** The supervisor generates a
`SignupLink` (optionally bound to a CIC) that has an `expiresAt` and can be
revoked. `/inscripcion/:token` accepts an application into `SignupRequest`
(status `PENDING`); **no `User` row exists until approval**, so the chosen
password is stored hashed on the request and copied over when the supervisor
approves. The public form deliberately returns the same success message for an
email that already exists, so it cannot be used to enumerate coaches.

**Link lifetimes are configurable**, not hardcoded: `AppSettings` is a single row
(`id = "singleton"`) with `testCompleteDays` (14), `testResultsDays` (365) and
`signupLinkDays` (30), edited from the Inscripciones page. Changing them affects
links minted afterwards; already-issued links keep their dates.

> `frontend/src/lib/api.ts` — `api`/`apiRaw` **throw** on a non-2xx response, so
> an `if (!res.ok)` after them is dead code. Use **`apiTry`** whenever you want to
> show the API's error message to the user, and **`apiUpload`** for multipart
> (it sets no `Content-Type`, so the browser can add the multipart boundary).
