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
deploy independently. `nginx/` reverse-proxies TLS to the API in prod.

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
   - A `TestAssignment` carries `accessToken` (random), `completeBy` (~14d),
     `resultsViewableUntil` (~365d). The coach's assign route mints these and
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

**Feedback visibility:** `SupervisionRequest.supervisorNotes` is internal
(supervisor↔coach). `SupervisionRequest.coachFeedback` is shown to the client on
their results link. Do not surface `supervisorNotes` to clients.

## TestResponse JSON shapes

`TestResponse.responses` is an untyped `Json` column. Each test type writes a
different shape:

| Test | Key fields in `responses` |
|------|--------------------------|
| `ANCLAS_CARRERA` | `rawAnswers[40]`, `bonusItems[3]`, `finalAnswers[40]`, `scores{TF,GG,AU,SE,CE,SC,PD,EV}`, `ranking[8]`, `aiInsight` |
| `TABLERO_IDEAS` | `saber[]`, `saberPassion[]` (parallel bool), `saberRanking[]` (strings), `querer[]`, `quererRanking[]`, `sonar[]`, `sonarRanking[]`, `brainstorming` |
| `PIRAMIDE_PROPOSITO` | `rol`, `valores`, `fortalezas`, `contextos`, `especialidad`, `propositoFinal` |

The supervisor's `ResponseViewer` (`frontend/src/pages/supervisor/SupervisionDetailPage.tsx`)
branches on `testType`. The Tablero branch prefers the `*Ranking` arrays and
falls back to the raw lists for legacy responses.

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

## Shared utilities

| File | Purpose |
|------|---------|
| `backend/src/lib/prisma.ts` | Prisma singleton |
| `backend/src/lib/auth.ts` | `signJWT`/`verifyJWT`/`authMiddleware`/`requireRole`/`loginUser` |
| `backend/src/lib/r2.ts` | Cloudflare R2 upload helpers |
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

- **Frontend** → Cloudflare Pages: build `npm run build` in `frontend/`, output
  `dist`, env `VITE_API_URL=https://api.poligiros.com`. Auto-deploys on push.
- **Backend** → Hetzner Docker: `docker-compose.prod.yml` (api + postgres + nginx).
  `./deploy.sh` SSHes in and runs `docker compose -f docker-compose.prod.yml build && up -d`.
  TLS via a Cloudflare Origin Certificate in `nginx/`.
