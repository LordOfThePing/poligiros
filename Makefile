# Convenience targets for the dockerized local stack (docker-compose.local.yml).
# Usage: `make <target>`  (run `make help` to list).
# Note: on Windows, run these from Git Bash, or use the raw docker compose
# commands shown in each recipe if `make` isn't installed.

COMPOSE = docker compose -f docker-compose.local.yml

.DEFAULT_GOAL := help
.PHONY: help up down rebuild rebuild-backend logs logs-api seed ps restart migrate studio shell

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Start the stack (postgres + api + cloudflared)
	$(COMPOSE) up -d

down: ## Stop the stack (data persists in the postgres volume)
	$(COMPOSE) down

rebuild: rebuild-backend ## Alias for rebuild-backend

rebuild-backend: ## Rebuild the api image after backend changes and recreate it
	$(COMPOSE) up -d --build api

logs: ## Tail logs for all services
	$(COMPOSE) logs -f

logs-api: ## Tail api logs only
	$(COMPOSE) logs -f api

seed: ## Seed the database (runs inside the api container)
	$(COMPOSE) exec api npm run db:seed

migrate: ## Apply Prisma migrations (also runs automatically on boot)
	$(COMPOSE) exec api npx prisma migrate deploy

ps: ## Show container status
	$(COMPOSE) ps

restart: ## Restart the api container
	$(COMPOSE) restart api

shell: ## Open a shell in the api container
	$(COMPOSE) exec api sh

studio: ## Prisma Studio against the dockerized DB (host port 5433)
	cd backend && npx prisma studio
