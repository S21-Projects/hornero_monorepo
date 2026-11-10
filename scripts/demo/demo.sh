#!/usr/bin/env bash
# Guarded demo stack for recording the thesis demo.
#
#   scripts/demo/demo.sh up | seed | reset | down | verify <email>     (see `make demo-*`)
#
# Safety model (this is what makes `reset` destructive-but-contained):
#   * The demo is a DEDICATED compose project (default `hornero-demo`) with its OWN volumes
#     (`<project>_hornero_pgdata`, `<project>_hornero_minio`). Compose namespaces volumes by project,
#     so `down -v` here can never touch the volumes of `make up` / `make up-local` / the Pi.
#   * Compose runs with a scrubbed environment and only `.env.demo`, a generated file with random
#     secrets, local MinIO and no real credentials. The root `.env` and `.env.local` are never read,
#     and variables exported in the author's shell (AWS_*, RESEND_*...) cannot leak into the stack.
#   * Every command except `up` runs `guard` first: BFF URL is localhost, the env file carries the demo
#     marker, the project's database holds the `demo_marker` table that only `up` creates, the published
#     BFF port is the one in the URL, and bff + ms point at the local MinIO.
#   * `reset` deletes nothing in any bucket: it drops the project's own volumes. Objects a seed uploaded to a
#     remote bucket (only possible with the risky override below) would stay there as orphans.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DEMO_PROJECT="${DEMO_PROJECT:-hornero-demo}"
DEMO_ENV_FILE="${DEMO_ENV_FILE:-$ROOT/.env.demo}"
DEMO_BFF_URL="${DEMO_BFF_URL:-http://localhost:3001}"
DEMO_MARKER_LINE="# HORNERO_DEMO_STACK=1"
DEMO_DB="hornero_demo"
LOCAL_S3="http://minio:9000"
RISKY_OVERRIDE="I-UNDERSTAND-THIS-WRITES-TO-A-REAL-BUCKET"
# Fictional logins printed at the end of `seed`. Not secrets: they only exist inside the demo stack.
DEMO_PASSWORD="Luna-Pampa-Rio-2026!"
DEMO_ADMIN_EMAIL="admin.demo@example.com"

die() { echo "demo: $*" >&2; exit 1; }
say() { echo "demo: $*"; }

# Compose with a scrubbed environment, the demo project and only the demo env file.
dc() {
  env -i PATH="$PATH" HOME="$HOME" ${USER:+USER="$USER"} ${TMPDIR:+TMPDIR="$TMPDIR"} \
    ${DOCKER_HOST:+DOCKER_HOST="$DOCKER_HOST"} ${DOCKER_CONTEXT:+DOCKER_CONTEXT="$DOCKER_CONTEXT"} \
    ${DOCKER_CONFIG:+DOCKER_CONFIG="$DOCKER_CONFIG"} \
    docker compose -p "$DEMO_PROJECT" --env-file "$DEMO_ENV_FILE" --profile minio "$@"
}
psql_demo() { dc exec -T postgres sh -c 'PGOPTIONS=--client-min-messages=warning psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -tA'; }

require_local_url() {
  local host=""
  [[ "$DEMO_BFF_URL" =~ ^[a-z]+://(\[[^]]+\]|[^/:]+) ]] && host="${BASH_REMATCH[1]}"
  case "$host" in
    localhost | 127.0.0.1 | '[::1]') ;;
    *) die "refusing: BFF URL '$DEMO_BFF_URL' is not localhost. The demo targets only a local stack." ;;
  esac
}

require_project_name() {
  [[ "$DEMO_PROJECT" =~ ^hornero-[a-z0-9-]+$ ]] || die "refusing: DEMO_PROJECT '$DEMO_PROJECT' must look like hornero-<name>."
  case "$DEMO_PROJECT" in
    hornero-prod* | hornero-pi* | hornero-live*) die "refusing: DEMO_PROJECT '$DEMO_PROJECT' looks like a real deployment." ;;
  esac
}

require_env_file() {
  [ -f "$DEMO_ENV_FILE" ] || die "$DEMO_ENV_FILE not found. Run: make demo-up"
  [ "$(head -n1 "$DEMO_ENV_FILE")" = "$DEMO_MARKER_LINE" ] || die "refusing: $DEMO_ENV_FILE is not a generated demo env file (marker missing)."
  local body
  body=$'\n'"$(<"$DEMO_ENV_FILE")"$'\n'
  [[ "$body" == *$'\n'"DB_NAME=$DEMO_DB"$'\n'* ]] || die "refusing: $DEMO_ENV_FILE does not set DB_NAME=$DEMO_DB."
  [[ "$body" != *$'\n'RESEND_API_KEY=?* && "$body" != *$'\n'TUNNEL_TOKEN=?* ]] || die "refusing: $DEMO_ENV_FILE carries real-service credentials."
}

# Effective bucket endpoint and name inside a container; prints only those two values.
bucket_of() { dc exec -T "$1" sh -c 'printf "%s %s" "$AWS_ENDPOINT_URL" "$AWS_S3_BUCKET_NAME"'; }

guard() {
  local what="${1:-seed}"
  require_project_name
  require_local_url
  require_env_file
  [ -n "$(dc ps -q postgres 2>/dev/null)" ] || die "the demo stack is not running (project $DEMO_PROJECT). Run: make demo-up"
  [ "$(psql_demo <<<"SELECT current_database();")" = "$DEMO_DB" ] || die "refusing: the project's database is not $DEMO_DB."
  [ "$(psql_demo <<<"SELECT to_regclass('public.demo_marker') IS NOT NULL;")" = "t" ] \
    || die "refusing: no demo_marker in the database. Only 'make demo-up' on a fresh project creates it."
  local mapped url_port=""
  mapped="$(dc port bff 3001 2>/dev/null | tail -n1)"
  [[ "$DEMO_BFF_URL" =~ :([0-9]+)/?$ ]] && url_port="${BASH_REMATCH[1]}"
  [ "${mapped##*:}" = "$url_port" ] || die "refusing: $DEMO_BFF_URL is not the BFF port of project $DEMO_PROJECT (published: '${mapped:-none}')."
  local svc got
  for svc in bff ms; do
    got="$(bucket_of "$svc")"
    say "$svc storage: endpoint and bucket = $got"
    if [ "${got%% *}" != "$LOCAL_S3" ]; then
      if [ "$what" = "seed" ] && [ "${DEMO_ALLOW_REMOTE_BUCKET:-}" = "$RISKY_OVERRIDE" ]; then
        say "WARNING: DEMO_ALLOW_REMOTE_BUCKET set; the seed will upload evidence files to '${got%% *}'."
      else
        die "refusing: $svc is not using the local MinIO ($LOCAL_S3)."
      fi
    fi
  done
}

wait_ms() {
  local i
  for i in $(seq 1 90); do
    dc exec -T ms wget -qO- http://localhost:8081/v3/api-docs >/dev/null 2>&1 && return 0
    sleep 3
  done
  die "ms did not become healthy"
}
wait_bff() {
  local i
  for i in $(seq 1 60); do
    curl -fsS "$DEMO_BFF_URL/necesidades?size=1" >/dev/null 2>&1 && return 0
    sleep 2
  done
  die "BFF did not answer at $DEMO_BFF_URL"
}

generate_env() {
  [ -f "$DEMO_ENV_FILE" ] && return 0
  command -v openssl >/dev/null || die "openssl is required to generate secrets"
  ( umask 077
    cat >"$DEMO_ENV_FILE" <<ENV
$DEMO_MARKER_LINE
# Generated by scripts/demo/demo.sh. Random local secrets, local MinIO, no real services. Gitignored.
JWT_SECRET=$(openssl rand -hex 32)
DB_NAME=$DEMO_DB
DB_USERNAME=hornero
DB_PASSWORD=$(openssl rand -hex 16)
NODE_ENV=development
SEED_DEMO_DATA=false
SUPER_ADMIN_EMAIL=$DEMO_ADMIN_EMAIL
SUPER_ADMIN_PASSWORD=$DEMO_PASSWORD
MAIL_LOG_ONLY=true
RONDAS_AUTO_ENABLED=false
EVIDENCIA_BORRADO_ENABLED=false
EVIDENCIA_RETENCION_ENABLED=false
AUDITORIA_ANCLA_ENABLED=false
AWS_ENDPOINT_URL=$LOCAL_S3
AWS_S3_BUCKET_NAME=hornero-demo-images
MINIO_ROOT_USER=hornero
MINIO_ROOT_PASSWORD=$(openssl rand -hex 12)
ENV
  )
  say "generated $DEMO_ENV_FILE"
}

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

cmd_up() {
  require_project_name
  require_local_url
  generate_env
  require_env_file
  local existing
  existing="$( (dc ps -aq; docker volume ls -q --filter "label=com.docker.compose.project=$DEMO_PROJECT") 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$existing" != "0" ]; then
    # An existing project is only reused when its database already carries the demo marker.
    dc up -d postgres
    local i
    for i in $(seq 1 30); do dc exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1 && break; sleep 2; done
    [ "$(psql_demo <<<"SELECT to_regclass('public.demo_marker') IS NOT NULL;" 2>/dev/null)" = "t" ] \
      || die "refusing: project $DEMO_PROJECT already exists and is not a demo project (no demo_marker). Use another DEMO_PROJECT."
  else
    local p
    for p in 3001 8081 5173 4321 5432; do
      ! port_busy "$p" || die "port $p is busy (another stack running?). Stop it first, e.g. 'make down'."
    done
    # Brand-new project: its postgres is created from the demo env, empty. Mark it before anything else
    # so a failed first start can be retried, and so only a database born here ever carries the marker.
    dc up -d postgres
    local i
    for i in $(seq 1 30); do dc exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1 && break; sleep 2; done
    [ "$(psql_demo <<<"SELECT current_database();")" = "$DEMO_DB" ] || die "unexpected database; refusing to mark it as demo."
    [ "$(psql_demo <<<"SELECT count(*) FROM pg_tables WHERE schemaname = 'public';")" = "0" ] \
      || die "refusing: the new project's database is not empty."
    psql_demo >/dev/null <<<"CREATE TABLE demo_marker (creado_en timestamptz NOT NULL DEFAULT now()); INSERT INTO demo_marker DEFAULT VALUES;"
  fi
  dc up --build -d
  wait_ms
  say "applying scripts/sql/V*.sql (idempotent)"
  local f
  for f in scripts/sql/V*.sql; do psql_demo -q <"$f" >/dev/null; done
  dc restart ms >/dev/null
  wait_ms
  wait_bff
  say "demo stack is up: BFF $DEMO_BFF_URL, admin http://localhost:5173, public site http://localhost:4321"
  say "next: make demo-seed"
}

cmd_seed() {
  guard seed
  [ -d e2e/node_modules ] || (cd e2e && npm install --no-audit --no-fund >/dev/null)
  cd e2e
  DEMO_STACK_VERIFIED="$DEMO_PROJECT" DEMO_PROJECT="$DEMO_PROJECT" DEMO_ENV_FILE="$DEMO_ENV_FILE" \
    DEMO_PASSWORD="$DEMO_PASSWORD" DEMO_ADMIN_EMAIL="$DEMO_ADMIN_EMAIL" E2E_BFF_URL="$DEMO_BFF_URL" \
    npx tsx scenarios/demo-seed.ts
}

cmd_reset() {
  guard reset
  local vols
  vols="$(docker volume ls -q --filter "label=com.docker.compose.project=$DEMO_PROJECT")"
  local v
  for v in $vols; do
    case "$v" in "${DEMO_PROJECT}_"*) ;; *) die "refusing: volume '$v' does not belong to project $DEMO_PROJECT." ;; esac
  done
  say "reset will DELETE the demo project's own volumes and recreate them empty:"
  printf '  %s\n' $vols
  if [ "${DEMO_YES:-}" != "1" ]; then
    read -r -p "demo: type the project name ($DEMO_PROJECT) to confirm: " answer
    [ "$answer" = "$DEMO_PROJECT" ] || die "aborted."
  fi
  dc down -v --remove-orphans
  cmd_up
  cmd_seed
}

cmd_down() {
  require_project_name
  require_env_file
  dc down --remove-orphans
}

cmd_verify() {
  local email="${1:-}"
  [[ "$email" =~ ^[A-Za-z0-9._+-]+@example\.com$ ]] || die "usage: demo.sh verify <address@example.com> (fictional demo addresses only)"
  guard verify
  local n
  n="$(psql_demo <<<"WITH u AS (UPDATE usuarios SET email_verificado = true WHERE email = '$email' RETURNING 1) SELECT count(*) FROM u;")"
  [ "$n" = "1" ] || die "no demo user with that email"
  say "marked $email as verified (stands in for the OTP email, which MAIL_LOG_ONLY never sends)"
}

case "${1:-}" in
  up) cmd_up ;;
  seed) cmd_seed ;;
  reset) cmd_reset ;;
  down) cmd_down ;;
  verify) shift; cmd_verify "${1:-}" ;;
  *) die "usage: demo.sh up | seed | reset | down | verify <email>" ;;
esac
