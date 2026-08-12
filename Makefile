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

.DEFAULT_GOAL := help
.PHONY: help up down rebuild rebuild-backend logs logs-api seed ps restart migrate studio shell \
        env-check prod-deploy prod-up prod-down prod-build prod-ps prod-logs prod-logs-api \
        prod-logs-tunnel prod-restart prod-migrate prod-bootstrap prod-supervisor prod-health \
        prod-shell prod-psql prod-backup prod-seed-danger

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

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

prod-bootstrap: ## Set up a fresh DB: test catalog + supervisor login
	@$(PROD) exec -T api npx tsx prisma/bootstrap.ts
	@$(MAKE) prod-supervisor

# Reads SUPERVISOR_EMAIL / SUPERVISOR_PASSWORD from .env unless EMAIL=/PASSWORD= are given.
prod-supervisor: ## Create/update Gaby's login. Usage: make prod-supervisor EMAIL=x@y.com PASSWORD=secret
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
