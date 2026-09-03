# Convenience targets for the dockerized stacks.
#
#   make <target>              (run `make help` to list everything)
#
# LOCAL  → docker-compose.local.yml   (your machine; publishes Postgres on 5433)
# PROD   → docker-compose.prod.yml    (the Hetzner server; no published ports,
#                                      reachable only through the Cloudflare Tunnel)
#
# Note: on Windows, run these from Git Bash, or use the raw docker compose
# commands shown in each recipe if `make` isn't installed.

COMPOSE = docker compose -f docker-compose.local.yml
PROD    = docker compose -f docker-compose.prod.yml

# Defaults for env-scp. SCP_ALIAS is meant to be a Host entry in ~/.ssh/config
# (e.g. "hetzner", so it carries its own user/hostname/key) — override with
#   make env-scp SCP_ALIAS=other-alias
SCP_ALIAS ?= hetzner
SCP_PATH  ?= /opt/poligiros

.DEFAULT_GOAL := help
.PHONY: help up down rebuild rebuild-backend logs logs-api seed ps restart migrate studio shell \
        env-check env-scp prod-deploy prod-up prod-down prod-build prod-ps prod-logs prod-logs-api \
        prod-logs-tunnel prod-restart prod-migrate prod-bootstrap prod-supervisor prod-health \
        prod-shell prod-psql prod-backup prod-seed-danger

# Hardcoded rather than piped through grep/awk so `help` also works under plain
# cmd.exe (no grep/awk in PATH) — not just Git Bash/WSL/Linux.
help: ## List available targets
	@echo "LOCAL:"
	@echo "  up                   Start the local stack (postgres + api + cloudflared)"
	@echo "  down                 Stop the local stack (data persists in the postgres volume)"
	@echo "  rebuild              Rebuild the api image after backend changes and recreate it"
	@echo "  logs                 Tail logs for all local services"
	@echo "  logs-api             Tail local api logs only"
	@echo "  seed                 Seed the local database with demo data (DESTRUCTIVE)"
	@echo "  migrate              Apply Prisma migrations locally"
	@echo "  ps                   Show local container status"
	@echo "  restart              Restart the local api container"
	@echo "  shell                Open a shell in the local api container"
	@echo "  studio               Prisma Studio against the dockerized DB"
	@echo "--------------------------------------------------------------------------"
	@echo "PROD (run on the server):"
	@echo "  env-check            Verify .env exists and has the required variables"
	@echo "  env-scp              Print the scp command to copy your local .env to the server"
	@echo "  prod-deploy          Pull latest code, rebuild, restart, prune, health-check"
	@echo "  prod-up              Build and start the prod stack"
	@echo "  prod-down            Stop the prod stack"
	@echo "  prod-build           Rebuild images without restarting"
	@echo "  prod-ps              Show prod container status"
	@echo "  prod-logs            Tail logs for all prod services"
	@echo "  prod-logs-api        Tail prod api logs only"
	@echo "  prod-logs-tunnel     Tail cloudflared logs"
	@echo "  prod-restart         Restart the prod api container"
	@echo "  prod-migrate         Apply Prisma migrations"
	@echo "  prod-migrate-status  Show which migrations applied, plus the live TestType enum"
	@echo "  prod-bootstrap       Set up a fresh DB: test catalog + supervisor login"
	@echo "  prod-supervisor      Create/update the supervisor login"
	@echo "  prod-health          Curl the API health endpoint from inside the container"
	@echo "  prod-shell           Open a shell in the prod api container"
	@echo "  prod-psql            Open psql against the prod database"
	@echo "  prod-backup          Dump the prod database to backup-DATE.sql"
	@echo "  prod-seed-danger     DESTRUCTIVE demo seed - wipes ALL data (needs CONFIRM=WIPE)"

# ══════════════════════════════════════════════════════════════════════════════
# LOCAL (docker-compose.local.yml)
# ══════════════════════════════════════════════════════════════════════════════

up: ## Start the local stack (postgres + api + cloudflared)
	$(COMPOSE) up -d

down: ## Stop the local stack (data persists in the postgres volume)
	$(COMPOSE) down

rebuild: rebuild-backend ## Alias for rebuild-backend

rebuild-backend: ## Rebuild the api image after backend changes and recreate it
	$(COMPOSE) up -d --build api

logs: ## Tail logs for all local services
	$(COMPOSE) logs -f

logs-api: ## Tail local api logs only
	$(COMPOSE) logs -f api

seed: ## Seed the local database with demo data (DESTRUCTIVE — wipes all tables)
	$(COMPOSE) exec api npm run db:seed

migrate: ## Apply Prisma migrations locally (also runs automatically on boot)
	$(COMPOSE) exec api npx prisma migrate deploy

ps: ## Show local container status
	$(COMPOSE) ps

restart: ## Restart the local api container
	$(COMPOSE) restart api

shell: ## Open a shell in the local api container
	$(COMPOSE) exec api sh

studio: ## Prisma Studio against the dockerized DB (host port 5433)
	cd backend && npx prisma studio

# ══════════════════════════════════════════════════════════════════════════════
# PRODUCTION (docker-compose.prod.yml) — run these ON THE SERVER
#
# First time on a fresh server:
#   git clone <repo> /opt/poligiros && cd /opt/poligiros
#   cp .env.example .env && nano .env          # fill the ROOT section
#   make prod-up
#   make prod-bootstrap                        # test catalog + Gaby's login
#   make prod-health
# ══════════════════════════════════════════════════════════════════════════════

env-scp: ## Print the scp command to copy your local .env to the server. Usage: make env-scp [SCP_ALIAS=hetzner] [SCP_PATH=/opt/poligiros]
	@echo "scp .env $(SCP_ALIAS):$(SCP_PATH)/.env"

env-check: ## Verify .env exists and has the required variables
	@test -f .env || { echo "❌ Falta .env — copiá .env.example y completá la sección ROOT."; exit 1; }
	@missing=""; \
	for v in POSTGRES_PASSWORD JWT_SECRET FRONTEND_URL CLOUDFLARE_TUNNEL_TOKEN; do \
	  grep -qE "^$$v=.+" .env || missing="$$missing $$v"; \
	done; \
	if [ -n "$$missing" ]; then echo "❌ Variables vacías o ausentes en .env:$$missing"; exit 1; fi
	@echo "✅ .env OK"

prod-deploy: ## Pull latest code, rebuild, restart, prune, health-check
	git pull --ff-only
	$(MAKE) prod-up
	@docker image prune -f
	@$(MAKE) prod-health

prod-up: env-check ## Build and start the prod stack (migrations run on boot)
	$(PROD) up -d --build --remove-orphans

prod-build: env-check ## Rebuild images without restarting
	$(PROD) build --pull

prod-down: ## Stop the prod stack (data persists in the postgres volume)
	$(PROD) down

prod-ps: ## Show prod container status
	$(PROD) ps

prod-logs: ## Tail logs for all prod services
	$(PROD) logs -f

prod-logs-api: ## Tail prod api logs only
	$(PROD) logs -f api

prod-logs-tunnel: ## Tail cloudflared logs (look for "Registered tunnel connection")
	$(PROD) logs -f cloudflared

prod-restart: ## Restart the prod api container
	$(PROD) restart api

prod-migrate: ## Apply Prisma migrations (also runs automatically on boot)
	$(PROD) exec -T api npx prisma migrate deploy

prod-migrate-status: ## Show which migrations applied, plus the live TestType enum
	@$(PROD) exec -T api npx prisma migrate status || true
	@echo "--- TestType values actually in the DB ---"
	@$(PROD) exec -T postgres sh -c 'psql -U $${POSTGRES_USER:-poligiros} $${POSTGRES_DB:-poligiros} -Atc "SELECT unnest(enum_range(NULL::\"TestType\"))"'
	@echo "--- _prisma_migrations ---"
	@$(PROD) exec -T postgres sh -c 'psql -U $${POSTGRES_USER:-poligiros} $${POSTGRES_DB:-poligiros} -c "SELECT migration_name, applied_steps_count, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at"'

prod-bootstrap: ## Set up a fresh DB: test catalog + supervisor login
	@$(PROD) exec -T api npx tsx prisma/bootstrap.ts
	@$(MAKE) prod-supervisor

# Reads SUPERVISOR_EMAIL / SUPERVISOR_PASSWORD from .env unless EMAIL=/PASSWORD= are given.
prod-supervisor: ## Create/update the supervisor login. Usage: make prod-supervisor EMAIL='<email>' PASSWORD='<contraseña>'
	@$(PROD) exec -T api npx tsx prisma/setSupervisor.ts \
	  $(if $(EMAIL),--email "$(EMAIL)") \
	  $(if $(PASSWORD),--password "$(PASSWORD)") \
	  $(if $(NAME),--name "$(NAME)")

prod-health: ## Curl the API health endpoint from inside the container
	@$(PROD) exec -T api node -e "fetch('http://localhost:3001/health').then(r=>r.text()).then(t=>console.log('API:',t)).catch(e=>{console.error('API DOWN:',e.message);process.exit(1)})"

prod-shell: ## Open a shell in the prod api container
	$(PROD) exec api sh

prod-psql: ## Open psql against the prod database
	$(PROD) exec postgres sh -c 'psql -U $${POSTGRES_USER:-poligiros} $${POSTGRES_DB:-poligiros}'

prod-backup: ## Dump the prod database to backup-<date>.sql
	@$(PROD) exec -T postgres sh -c 'pg_dump -U $${POSTGRES_USER:-poligiros} $${POSTGRES_DB:-poligiros}' > backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "✅ Backup escrito en $$(ls -t backup-*.sql | head -1)"

prod-seed-danger: ## DESTRUCTIVE demo seed — wipes ALL data. Requires CONFIRM=WIPE
	@test "$(CONFIRM)" = "WIPE" || { echo "❌ Esto BORRA todos los datos. Si estás seguro: make prod-seed-danger CONFIRM=WIPE"; exit 1; }
	$(PROD) exec -T api npm run db:seed
