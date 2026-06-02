# Poligiros — Setup (dockerized backend + Cloudflare Pages frontend)

Frontend lives on **Cloudflare Pages**. The backend (Hono + Postgres) runs
**dockerized on your machine**, and a **Cloudflare Tunnel** gives it a public
HTTPS address so the Pages site can reach it. Later the backend moves to a
server with no change to the frontend.

```
Browser ─► app.poligiros.com   (Cloudflare Pages — static frontend)
        ─► api.poligiros.com   (Cloudflare Tunnel) ─► cloudflared ─► api:3001 ─► postgres:5432
                                                       └──────── docker compose (your machine) ───────┘
```

Why the tunnel (not localhost): a Pages site is HTTPS, so the browser blocks it
from calling `http://localhost`; localhost also only exists on your machine; and
the login cookie needs HTTPS. The tunnel solves all three.

> **Use subdomains of one domain** (`app.` + `api.` on `poligiros.com`). The login
> cookie is then first-party and "just works". Mixing `*.pages.dev` with
> `api.poligiros.com` makes it a third-party cookie that browsers increasingly block.

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
   - Subdomain `api`, Domain `poligiros.com` → **`api.poligiros.com`**
   - Service: **Type** `HTTP`, **URL** `api:3001`  ← the docker service name, not localhost
5. Save. (DNS for `api.poligiros.com` is created automatically.)

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
   | Environment variable | `VITE_API_URL` = `https://api.poligiros.com` |

3. After the first deploy, add the custom domain **`app.poligiros.com`**
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
| `FRONTEND_URL` | **yes** | `https://app.poligiros.com` — the only origin the API accepts (CORS). |
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

**Seed once** (creates Gaby + 2 demo coaches + 2 demo clients). The runtime image
is dev-dependency-free, so run the seed from the host against the exposed DB port:

```bash
cd backend
npm install
# backend/.env must have DATABASE_URL=postgresql://poligiros:<password>@localhost:5432/poligiros
npm run db:seed
```

Check it's alive:

```bash
docker compose -f docker-compose.local.yml logs -f cloudflared   # should say "Registered tunnel connection"
curl https://api.poligiros.com/health                            # → {"ok":true}
```

---

## Part 4 — Verify end to end

- [ ] `https://api.poligiros.com/health` returns `{"ok":true}`
- [ ] Open **`https://app.poligiros.com`**, log in as `SUPERVISOR_EMAIL` / `SUPERVISOR_PASSWORD`
- [ ] Open a client → **assign a test** → copy the generated `https://app.poligiros.com/t/<token>` link
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

## Part 6 — Later: move the backend to a server

Nothing changes for the frontend (it keeps calling `https://api.poligiros.com`).
On the server, either:

- run this same `docker-compose.local.yml` (the tunnel works identically from anywhere), or
- use the repo's `docker-compose.prod.yml` + `nginx/` and point `api.poligiros.com`'s
  DNS at the server's IP instead of the tunnel.

Then stop the tunnel on your laptop. Done.
