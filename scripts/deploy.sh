#!/usr/bin/env bash
# Deploy latest `main` on the Hetzner VPS.
#
# Runs as the `deploy-poligiros` user, from ~/poligiros. GitHub Actions triggers
# it over SSH: the Actions key is restricted in authorized_keys to exactly this
# command, and passes the commit SHA it tested. It can also be run by hand:
#
#   ~/poligiros/scripts/deploy.sh           # deploy whatever main is now
#   ~/poligiros/scripts/deploy.sh <sha>     # deploy a specific commit on main
#
# Steps: fetch main -> hard reset -> `docker compose up -d --build` (migrations
# run on boot via the image CMD) -> prune -> health check.
#
# Settings: uses the `.env` copied into the checkout (see `make env-scp`). Git
# never touches it.
#
# Everything lives inside main() so bash reads the whole file before running it:
# the `git reset` below rewrites this very file.

set -euo pipefail

BRANCH="main"
LOCK_FILE="${XDG_RUNTIME_DIR:-/tmp}/poligiros-deploy.lock"
COMPOSE_FILE="docker-compose.prod.yml"

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

main() {
  local script repo stage="update" expected=""
  script="$(readlink -f "${BASH_SOURCE[0]}")"
  repo="$(dirname "$(dirname "$script")")"
  cd "$repo"

  if [[ "${1:-}" == "--after-update" ]]; then
    stage="build"
    shift
  fi
  # From GitHub Actions the SHA arrives as the SSH command (forced command).
  expected="${1:-${SSH_ORIGINAL_COMMAND:-}}"
  if [[ -n "$expected" && ! "$expected" =~ ^[0-9a-f]{40}$ ]]; then
    die "expected a 40-character commit SHA, got: $expected"
  fi

  if [[ "$stage" == "update" ]]; then
    # One deploy at a time. The lock is held on fd 9, which survives the exec.
    exec 9>"$LOCK_FILE"
    flock -n 9 || die "another deploy is running"

    log "fetching $BRANCH"
    git fetch --prune --quiet origin "$BRANCH"
    if [[ -n "$expected" ]] && ! git merge-base --is-ancestor "$expected" "origin/$BRANCH"; then
      die "commit $expected is not on origin/$BRANCH"
    fi
    git reset --hard --quiet "origin/$BRANCH"
    log "checked out $(git log -1 --format='%h %s')"

    # Continue with the version of this script we just checked out.
    exec bash "$script" --after-update "$expected"
  fi

  docker compose version >/dev/null 2>&1 \
    || die "'docker compose' (Compose v2 plugin) is not available to $(id -un)"

  [[ -f .env ]] || die "no $repo/.env: copy it from your machine (make env-scp)"
  chmod 600 .env
  grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.' .env \
    || die "CLOUDFLARE_TUNNEL_TOKEN is empty in .env"

  log "building and starting containers"
  if ! docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans; then
    docker compose -f "$COMPOSE_FILE" ps
    docker compose -f "$COMPOSE_FILE" logs --tail 50
    die "docker compose up failed"
  fi
  docker image prune -f >/dev/null

  log "waiting for api to answer /health"
  local ok=""
  for _ in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" exec -T api node -e "fetch('http://localhost:3001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 2
  done
  [[ -n "$ok" ]] || { docker compose -f "$COMPOSE_FILE" logs --tail 80 api; die "api did not become healthy"; }

  docker compose -f "$COMPOSE_FILE" ps
  log "deployed $(git rev-parse --short HEAD)"
}

main "$@"; exit
