#!/usr/bin/env bash
# deploy.sh — SSH into Hetzner VPS and deploy/update the Poligiros API stack.
#
# Usage:
#   ./deploy.sh [user@host]
#
# Defaults to DEPLOY_HOST env var or "root@api.poligiros.com".
# Requires SSH key-based auth to the server.

set -euo pipefail

HOST="${1:-${DEPLOY_HOST:-root@api.poligiros.com}}"
REMOTE_DIR="/opt/poligiros"

echo "==> Deploying Poligiros API to ${HOST}…"

# 1. Copy updated docker-compose + nginx config + backend source to the server
rsync -az --exclude='node_modules' --exclude='.git' \
  docker-compose.prod.yml \
  backend/ \
  nginx/ \
  "${HOST}:${REMOTE_DIR}/"

# 2. SSH: build images and restart services
ssh "${HOST}" bash -s <<EOF
set -euo pipefail
cd ${REMOTE_DIR}

echo "--> Building images…"
docker compose -f docker-compose.prod.yml build --pull

echo "--> Starting services (zero-downtime recreate)…"
docker compose -f docker-compose.prod.yml up -d --remove-orphans

echo "--> Pruning dangling images…"
docker image prune -f

echo "--> Health check…"
sleep 5
curl -sf http://localhost:3001/health | grep '"ok":true' && echo "API is healthy ✓" || echo "WARNING: health check failed"
EOF

echo "==> Deploy complete."
