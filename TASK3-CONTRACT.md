# Task 3 — Migration Contract (shared by both worktree lanes)

This is the single source of truth both lanes build against. If something here is
ambiguous, STOP and flag it rather than guessing — a wrong guess makes the other
lane's work wrong too.

Two lanes, disjoint directories (no merge conflicts):
- **Lane A — Backend** owns `backend/` (Hono API, Prisma, Docker, deploy).
- **Lane B — Frontend** owns `frontend/` (Vite + React Router).

Both lanes are **additive**: create your new top-level dir, do NOT delete the old
Next.js `app/`, `middleware.ts`, root `lib/`, or root `prisma/`. The destructive
cleanup happens in a separate integration step after both lanes merge and the
stack is verified.

---

## Architecture

```
Cloudflare Pages (frontend/, Vite static)  ──HTTPS──▶  nginx ──▶ Hono API (backend/, Hetzner Docker)
                                                                      │
                                                                 PostgreSQL
```

- Coaches & supervisors LOG IN (httpOnly cookie JWT).
- Clients (coachees) DO NOT log in. They use a per-assignment magic link
  (`/t/:token`). This is the A1 decision — there is no `CLIENT_USER` role anymore.

---

## Schema changes (Lane A owns; Lane B builds to the resulting API shapes)

Apply to `backend/prisma/schema.prisma` (moved from root):

```prisma
enum Role {
  SUPERVISOR
  STUDENT_COACH
  // CLIENT_USER  ← REMOVED (clients no longer have accounts)
}

model User {
  // remove the "ClientUser" relation field that pointed back from Client.userId
  // (keep everything else: clients[], enrollments, etc.)
}

model Client {
  id          String           @id @default(cuid())
  studentId   String
  student     User             @relation(fields: [studentId], references: [id])
  name        String
  email       String
  // userId / linkedUser  ← REMOVED
  assignments TestAssignment[]
  sessions    SessionRecord[]
  createdAt   DateTime         @default(now())
}

model TestAssignment {
  id          String   @id @default(cuid())
  testId      String
  test        Test     @relation(fields: [testId], references: [id])
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id])
  assignedBy  String
  assignedAt  DateTime @default(now())
  completedAt DateTime?

  // A1 magic-link fields:
  accessToken          String?   @unique   // 32-byte base64url, generated on assign
  completeBy           DateTime?            // ~14 days after assign — completion deadline
  resultsViewableUntil DateTime?            // long window (assign + 365d) — results access

  response    TestResponse?
  supervision SupervisionRequest?
  @@unique([testId, clientId])
}

model SupervisionRequest {
  // ... existing fields ...
  supervisorNotes String?   // INTERNAL — supervisor↔coach only, never sent to client
  coachFeedback   String?   // CLIENT-VISIBLE — shown on the results link (A1 decision)
}
```

`prisma/seed.ts`: stop creating `CLIENT_USER` accounts. A `Client` is now just a
record owned by a coach (name + email, no linked user).

Token generation: `crypto.randomBytes(32).toString("base64url")`.
On assign: `completeBy = now + 14d`, `resultsViewableUntil = now + 365d`.

### Token state machine (the heart of A1)

```
GET assignment by accessToken:
  not found                                   → 404  { error: "invalid" }
  completedAt == null:
      now > completeBy                        → 410  { state: "expired" }      // missed the window
      else                                    → 200  { state: "form", ... }    // take the test
  completedAt != null:
      resultsViewableUntil && now > that      → 410  { state: "expired" }      // results window closed
      else                                    → 200  { state: "results", ... } // read-only results
```

---

## Auth model

**Coach / Supervisor (httpOnly cookie, T2):**
- `POST /auth/login` `{ email, password }` → bcrypt check → set
  `Set-Cookie: token=<JWT>; HttpOnly; SameSite=None; Secure; Path=/`. JWT payload
  `{ id, role }`, `HS256`, `jose`, `JWT_SECRET`, 7-day expiry. Body: `{ user }`.
- `POST /auth/logout` → clear the cookie.
- `GET /auth/me` → `{ id, name, email, role }` from the cookie (frontend hydrates
  on mount since the token is not readable from JS).
- Auth middleware: read cookie → `jwtVerify` → `c.set("user", payload)` → 401 if
  missing/invalid. Applied to `/supervisor/*` and `/student/*`.
- `@hono/cors`: `credentials: true`, `origin: process.env.FRONTEND_URL` (+ localhost:5173).

**Client (token in URL, NO session):**
- `GET /client/t/:token` → run the state machine. For `form`: return
  `{ state, testType, assignmentId, title }`. For `results`: return
  `{ state, testType, responses, coachFeedback, completedAt }`.
- `POST /client/t/:token/submit` `{ responses }` → only if `state == "form"`;
  set `completedAt = now`; 409 if already completed, 410 if window passed.
- `POST /client/t/:token/ai-insight` `{ ranking, scores }` → Anclas insight
  (token-scoped replacement for the old `/api/client/test/ai-insight`).
- These routes are NOT behind the auth middleware (token IS the credential).

**Coach link management (under `/student/*`, authed):**
- `POST /student/clients/:id/assign` `{ testId }` → create TestAssignment with a
  fresh `accessToken`, `completeBy`, `resultsViewableUntil`. Return
  `{ assignment, link: "${FRONTEND_URL}/t/<token>" }`. (skip PLAN_VITAL)
- `POST /student/assignments/:id/resend` → regenerate `accessToken` + reset
  `completeBy = now + 14d`. Return the new link.
- Existing `/student/*` and `/supervisor/*` routes migrate 1:1 (see below).

---

## Route migration (Lane A): `app/api/**/route.ts` → Hono handlers, 1:1

Mechanical conversion, queries identical:
- `getServerSession(authOptions)` → `c.get("user")`
- `session.user.id` / `.role` → `user.id` / `user.role`
- `NextResponse.json(data, { status })` → `c.json(data, status)`
- `params.id` → `c.req.param("id")`
- body → `await c.req.json()`

The `/api/client/*` session-based routes (assignments, submit, ai-insight) are
REPLACED by the token routes above — do not port their `CLIENT_USER` session checks.

Register all routes in `backend/src/index.ts`. Health: `GET /health` → `{ ok: true }`.

Env (backend): `DATABASE_URL`, `JWT_SECRET` (replaces NEXTAUTH_SECRET),
`FRONTEND_URL`, plus existing `CLOUDFLARE_R2_*`, `OPENAI_API_KEY`, `RESEND_API_KEY`.

Deliver: `backend/Dockerfile` (multi-stage node:20-alpine, entrypoint
`prisma migrate deploy && node dist/index.js`), `docker-compose.prod.yml`
(api + postgres + nginx), `nginx/default.conf` (TLS via Cloudflare Origin cert,
proxy_pass to api:3001), and `deploy.sh` (T8: SSH + `docker compose -f
docker-compose.prod.yml build && up -d`).

---

## Page migration (Lane B): `app/**/page.tsx` → Vite + React Router

- `frontend/src/lib/api.ts`: fetch wrapper. Prepends `VITE_API_URL`, always
  `credentials: "include"`. On 401 → toast "Sesión expirada" + redirect `/login`
  (T3). Skip that redirect when already on `/login` or the URL is `/t/...`
  (clients have no session — a 401 there is not a session expiry).
- `frontend/src/lib/auth.tsx`: `AuthContext` + `useAuth()`. On mount call
  `GET /auth/me` to hydrate. `login()` → POST /auth/login then /auth/me.
  `logout()` → POST /auth/logout + clear + navigate `/login`. `user` null when out.
- Conversion pattern: `next/navigation` → `react-router-dom`; `useRouter().push`
  → `useNavigate()`; `useParams` → react-router `useParams`; `<Link href>` →
  `<Link to>`; `useSession` → `useAuth`; remove `"use client"`; `next/image` → `<img>`.
- `App.tsx` route tree: `/login` (public), `/t/:token` (public — client test/results,
  NO ProtectedRoute), `/supervisor/*` + `/student/*` behind `<ProtectedRoute roles>`.
- **Client flow (A1):** the old `/client/*` pages and `app/client/test/*` become a
  single token-driven route `/t/:token`. It calls `GET /client/t/:token`, then:
  - `state: "form"` → render the matching test component (Anclas/Tablero/Pirámide)
    driven by token; submit via `POST /client/t/:token/submit`.
  - `state: "results"` → render a read-only results view (answers + `aiInsight`
    from responses + `coachFeedback`).
  - `state: "expired"` → "Este enlace caducó. Pedile uno nuevo a tu coach."
  Reuse the existing test UIs from `app/client/test/*` (including the new Tablero
  3-step flow and SortableList, and lib/anclas.ts) — port them, don't rewrite.
- Env (frontend, not committed): `VITE_API_URL=http://localhost:3001`. Prod on
  Cloudflare Pages: `VITE_API_URL=https://api.poligiros.com`, build `npm run build`,
  output `dist`.

---

## Shared response shapes (keep identical across lanes)

TestResponse `responses` JSON is unchanged from Phase 2:
- ANCLAS_CARRERA: `rawAnswers[40]`, `bonusItems[3]`, `finalAnswers[40]`, `scores`, `ranking[8]`, `aiInsight`
- TABLERO_IDEAS: `saber[]`, `saberPassion[]`, `saberRanking[]`, `querer[]`, `quererRanking[]`, `sonar[]`, `sonarRanking[]`, `brainstorming`
- PIRAMIDE_PROPOSITO: `rol`, `valores`, `fortalezas`, `contextos`, `especialidad`, `propositoFinal`

The client `GET /client/t/:token` (results) returns `{ responses, coachFeedback }`
using these exact shapes so the ported test components render unchanged.
