# TODOS

Deferred work captured during the Phase 2 eng review (2026-06-02). Each item has
enough context to pick up cold in 3 months.

---

## A1 — Magic-link client access (no coachee login) — ✅ DECIDED, in Task 3

**Decided 2026-06-02:** Adopt magic-links. Token lifecycle = short completion window
(`completeBy` ~14d) + long results window (`resultsViewableUntil` ~365d). Client-facing
feedback via a new `coachFeedback` field; `supervisorNotes` stays internal. Folded into
the Task 3 migration — see [TASK3-CONTRACT.md](TASK3-CONTRACT.md). Original analysis below.

---


**What:** Replace client (coachee) login accounts with unique, expiring access links.
Only SUPERVISOR and STUDENT_COACH log in. Coaches generate a per-assignment link;
the coachee clicks it to complete a test and later view results + AI insight + coach
feedback. No signup, no password for clients.

**Why:** Removes signup friction for the people least invested in the tooling; shrinks
the auth attack surface to two roles; and the token state machine subsumes the test-retake
bug (T1) instead of patching it.

**Design (token-per-assignment):**
- Add to `TestAssignment`: `accessToken String? @unique`, `tokenExpiresAt DateTime?`
- State machine:
  - valid + `completedAt == null` → show test form
  - valid + `completedAt != null` → read-only results + coach feedback
  - expired → "link caducado, pedile uno nuevo a tu coach"
- `/api/client/*` validates the token (from URL), not a session.
- Drop `Role.CLIENT_USER` + `Client.userId` / `linkedUser` relation (schema.prisma:103-104).

**Pros:** Deletes the T1 retake bug (token state replaces the 409 + useEffect check);
client never touches a JWT; less code, smaller security surface; far simpler coachee UX.

**Cons:** Schema migration (add token fields, drop CLIENT_USER linkage); the link IS the
credential, so leakage exposes that one assignment's data (mitigated by per-assignment
scope + expiry); reshapes T1 and the client half of Task 3.

**Open decisions:**
1. **Results-viewing window** — recommend one token per assignment, 60–90 day expiry, plus
   a coach "resend / extend" action (one token, not a separate results link).
2. **Client-facing feedback** — add a separate `coachFeedback` field (client-visible);
   keep `SupervisionRequest.supervisorNotes` internal.

**Depends on / blocked by:** Should be decided BEFORE Task 3 (it changes Task 3's client
auth) and ideally folds T1 into it. Affects schema, `/api/client/*`, middleware, Task 3.

---

## A2 — Backend CI/CD (GitHub Actions → GHCR → Watchtower)

**What:** Auto-deploy the Hetzner backend on push, matching Cloudflare Pages' frontend flow.
**Why:** deploy.sh (T8) is manual SSH; a pipeline removes that step as cadence rises.
**Pros:** Push-to-deploy parity with the frontend. **Cons:** GHCR token, Watchtower
container, Actions secrets — ~2h setup, overkill until deploy frequency justifies it.
**Context:** Deferred in D8 in favor of T8 deploy.sh. Revisit when you deploy weekly+.
**Depends on:** Task 3 backend + deploy.sh (T8) landed first.

## A3 — CSP headers (XSS mitigation)

**What:** Add Content-Security-Policy headers on the frontend.
**Why:** Defense-in-depth for the auth cookie/token; reduces XSS blast radius.
**Pros:** Cheap, broadly protective. **Cons:** CSP tuning can break inline scripts/styles;
needs testing against the Vite build. **Context:** Noted in the D2 cookie discussion as the
real XSS mitigation regardless of storage choice. **Depends on:** Task 3 frontend skeleton.

## A4 — E2E / integration tests (Playwright)

**What:** Browser-level tests for the test lifecycle (assign → complete → supervise → review).
**Why:** Unit tests (T7) cover pure logic only; full flows stay manual QA today.
**Pros:** Catches integration breaks unit tests miss. **Cons:** Heavier infra; at 20-25 users
manual QA is usually enough. **Context:** Deferred in D7 (chose Vitest unit tests). Revisit if
regressions start slipping through manual QA. **Depends on:** Task 3 stable.

## A5 — Migrate Pirámide & Plan Vital to multi-step

**What:** Apply the Task 2 multi-step treatment to the other two tests if desired.
**Why:** Consistency once Tablero's pattern proves out. **Pros:** Uniform UX. **Cons:** Plan
Vital is an intentional placeholder; Pirámide already has its own SVG-driven flow. **Context:**
Only Anclas (Task 1) + Tablero (Task 2) were in the Phase 2 request. **Depends on:** Task 2 done.

## A6 — Refresh-token rotation

**What:** Add refresh tokens so coaches/supervisors aren't forced to re-login at day 7.
**Why:** Smoother long sessions. **Pros:** No mid-work logout. **Cons:** More auth surface and
state. **Context:** Deferred in D3 — 7-day JWT + graceful 401 redirect (T3) is acceptable at this
scale. **Depends on:** Task 3 auth (T2/T3).
