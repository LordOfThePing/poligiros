# Poligiros — Setup (dockerized backend + Cloudflare Pages frontend)

Frontend lives on **Cloudflare Pages**. The backend (Hono + Postgres) runs
**dockerized on your machine**, and a **Cloudflare Tunnel** gives it a public
HTTPS address so the Pages site can reach it. Later the backend moves to a
server with no change to the frontend.

```
Browser ─► apppoligiros.flynnpedroa.engineer   (Cloudflare Pages — static frontend)
        ─► apipoligiros.flynnpedroa.engineer   (Cloudflare Tunnel) ─► cloudflared ─► api:3001 ─► postgres:5432
                                                       └──────── docker compose (your machine) ───────┘
```

Why the tunnel (not localhost): a Pages site is HTTPS, so the browser blocks it
from calling `http://localhost`; localhost also only exists on your machine; and
the login cookie needs HTTPS. The tunnel solves all three.

> **Use two hostnames on one domain** (`apppoligiros.` + `apipoligiros.` on
> `flynnpedroa.engineer`). The login cookie is then first-party and "just works".
> Mixing `*.pages.dev` with `apipoligiros.flynnpedroa.engineer` makes it a
> third-party cookie that browsers increasingly block.

---

## Prerequisites

- [ ] **Docker Desktop** running (the engine, not just the CLI)
- [ ] **Node 20** (only for the one-time seed and optional local frontend dev)
- [ ] A **domain on Cloudflare** (e.g. `poligiros.com`). No domain yet? You can
      test with a quick tunnel (`cloudflared tunnel --url http://localhost:3001`)
      but the URL changes each run, which is painful since Pages bakes it in.

---

## Part 1 — Cloudflare (one-time)

### 1a. Create the Tunnel and grab its token

1. Cloudflare dashboard → **Zero Trust** → **Networks → Tunnels** → **Create a tunnel**.
2. Type: **Cloudflared**. Name it `poligiros-api`. Save.
3. On the connector screen choose **Docker** — you'll see a command containing
   `--token eyJ...`. Copy **just the token** (the long `eyJ...` string).
4. Add a **Public Hostname** to the tunnel:
   - Subdomain `apipoligiros`, Domain `flynnpedroa.engineer` → **`apipoligiros.flynnpedroa.engineer`**
   - Service: **Type** `HTTP`, **URL** `api:3001`  ← the docker service name, not localhost
5. Save. (DNS for `apipoligiros.flynnpedroa.engineer` is created automatically.)

### 1b. Deploy the frontend to Cloudflare Pages

> **Use the `Pages` tab, not "Import a repository" / Workers.** Deploying this
> Vite-5 app as a *Worker* fails with `The version of Vite … cannot be
> automatically configured … update to at least 6.0.0` (the Workers path forces
> the Cloudflare Vite plugin). Classic Pages just builds and serves `dist`, no
> Vite-version requirement. SPA routing is handled by `frontend/public/_redirects`.

1. Dashboard → **Workers & Pages → Create → `Pages` tab → Connect to Git** → pick this repo.
2. Branch: `phase2-fixes` (or `main` once merged). Build settings:

   | Setting | Value |
   |---|---|
   | Root directory | `frontend` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Environment variable | `VITE_API_URL` = `https://apipoligiros.flynnpedroa.engineer` |

3. After the first deploy, add the custom domain **`apppoligiros.flynnpedroa.engineer`**
   (Pages project → **Custom domains**).

---

## Part 2 — Configure `.env`

Copy `.env.example` to `.env` in the repo root and fill the **ROOT** section:

```bash
cp .env.example .env
```

| Variable | Required | What it is |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | no | Default `poligiros` / `poligiros`. Leave them. |
| `POSTGRES_PASSWORD` | **yes** | Any dev password. The DB container uses it. |
| `JWT_SECRET` | **yes** | Signs the login cookie. Generate: `openssl rand -base64 32`. |
| `FRONTEND_URL` | **yes** | `https://apppoligiros.flynnpedroa.engineer` — the only origin the API accepts (CORS). |
| `CLOUDFLARE_TUNNEL_TOKEN` | **yes** | The `eyJ...` token from step 1a. |
| `SUPERVISOR_EMAIL` / `SUPERVISOR_PASSWORD` | **yes** | Become Gaby's login (created by the seed). |
| `OPENAI_API_KEY` | no | Anclas AI insight only; blank = that card errors, rest works. |
| `RESEND_API_KEY` | no | Notification emails; blank = none sent (nothing breaks). |
| `CLOUDFLARE_R2_*` | no | Module-material uploads; blank = uploads fail, rest works. |

> `NODE_ENV=production` and `PORT=3001` are set by the compose file — you don't
> put them in `.env`. `NODE_ENV=production` is what makes the cookie `Secure`
> (required over the HTTPS tunnel).

---

## Part 3 — Run the dockerized backend

```bash
docker compose -f docker-compose.local.yml up -d --build
```

This starts three containers: `postgres`, `api`, `cloudflared`. On boot the `api`
container runs `prisma migrate deploy`, creating all tables from the committed
migration.

**Seed once** — `make seed` creates Gaby + 5 demo coaches + demo clients. The
runtime image carries the dev dependencies (`tsx`, the Prisma CLI), so the seed
runs *inside* the container; you don't need a host-side `DATABASE_URL`.

```bash
make seed          # docker compose exec api npm run db:seed
```

> ⚠️ `db:seed` **deletes every row in every table** before inserting demo data.
> That is fine locally, never on the server — see Part 6 for the safe
> (`db:bootstrap` / `db:set-supervisor`) path.

Check it's alive:

```bash
docker compose -f docker-compose.local.yml logs -f cloudflared   # should say "Registered tunnel connection"
curl https://apipoligiros.flynnpedroa.engineer/health                            # → {"ok":true}
```

---

## Part 4 — Verify end to end

- [ ] `https://apipoligiros.flynnpedroa.engineer/health` returns `{"ok":true}`
- [ ] Open **`https://apppoligiros.flynnpedroa.engineer`**, log in as `SUPERVISOR_EMAIL` / `SUPERVISOR_PASSWORD`
- [ ] Open a client → **assign a test** → copy the generated `https://apppoligiros.flynnpedroa.engineer/t/<token>` link
- [ ] Open that link in an incognito window → fill the test → submit → reopen → see read-only results

---

## Part 5 — Day to day

```bash
docker compose -f docker-compose.local.yml up -d        # start (keep your PC on for the site to work)
docker compose -f docker-compose.local.yml logs -f api  # tail backend logs
docker compose -f docker-compose.local.yml down         # stop (data persists in the postgres volume)
docker compose -f docker-compose.local.yml up -d --build # rebuild after backend code changes
```

Frontend changes deploy themselves: push to the connected branch and Cloudflare
Pages rebuilds.

---

## Part 6 — Run the backend on the server (Hetzner)

Nothing changes for the frontend — it keeps calling
`https://apipoligiros.flynnpedroa.engineer`. The server runs the same three
containers, using **`docker-compose.prod.yml`** (identical to the local file
except it publishes no host ports — the box is shared with other stacks, and
5432/5433 are already taken).

There is no `nginx` and no origin certificate: `cloudflared` dials *out* to
Cloudflare, so nothing has to listen on 80/443 and TLS terminates at the edge.

### 6a. First time, on a fresh server

```bash
ssh hetzner
git clone <repo-url> /opt/poligiros && cd /opt/poligiros

cp .env.example .env && nano .env        # fill the ROOT section (same values as local,
                                         # but FRONTEND_URL must be the Pages origin)
make prod-up                             # build + start; migrations run on boot
make prod-bootstrap                      # test catalog + Gaby's login (safe, idempotent)
make prod-health                         # → API: {"ok":true}
```

`make prod-up` refuses to start if `.env` is missing `POSTGRES_PASSWORD`,
`JWT_SECRET`, `FRONTEND_URL` or `CLOUDFLARE_TUNNEL_TOKEN`.

### 6b. Point the tunnel at the container

The tunnel is token-run, so its ingress lives in the dashboard, not in a file:
**Zero Trust → Networks → Tunnels → `poligiros-api` → Public Hostname**

| Field | Value |
|---|---|
| Subdomain / Domain | `apipoligiros` / `flynnpedroa.engineer` |
| Service type | `HTTP` |
| URL | `api:3001`  ← the compose service name, **not** localhost |

```bash
make prod-logs-tunnel     # want: "Registered tunnel connection" ×4
```

A **530 / error 1033** from the API hostname means no connector is registered —
the container is down or the token belongs to a deleted tunnel. A **502** means
the connector is up but the ingress URL is wrong.

### 6c. Gaby's login (supervisor)

Safe to run any time — it upserts one row and never touches anything else:

```bash
make prod-supervisor                                        # uses SUPERVISOR_* from .env
make prod-supervisor EMAIL=gaby@poligiros.com PASSWORD=unaClaveLarga
make prod-supervisor EMAIL=gaby@poligiros.com PASSWORD=x NAME="Gabriela Kyriazis"
```

If the email already exists it just resets the password (and promotes the account
to `SUPERVISOR`); otherwise it creates the user. Password must be ≥8 characters.

### 6d. Day to day

```bash
make prod-deploy      # git pull → rebuild → restart → prune → health check
make prod-logs-api    # tail the API
make prod-ps          # container status
make prod-backup      # pg_dump → backup-<timestamp>.sql
make prod-psql        # psql shell
```

> **Never run `make prod-seed-danger` on the server** unless you truly want to
> erase everything — it is the demo seed, and it wipes all tables. It refuses to
> run without `CONFIRM=WIPE` for exactly that reason.
