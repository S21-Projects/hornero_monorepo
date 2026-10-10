#!/usr/bin/env bash
# Restore drill: prove a backup can actually be restored.
#
# Restores the dump into a THROWAWAY postgres container (same image as the
# compose `postgres` service, random name, no published ports, no volume kept)
# and runs sanity queries. It never connects to the real database.
#
# Usage: scripts/backup/restore-check.sh [DUMP]
#   DUMP  hornero-*.dump or hornero-*.dump.enc (default: newest in BACKUP_DIR)
#
# Config: ENV_FILE, BACKUP_DIR, BACKUP_PASSPHRASE (needed for .enc files),
#         RESTORE_PG_IMAGE (override the postgres image),
#         RESTORE_ALLOW_EMPTY=1 (accept a dump whose usuarios table is empty).
#
# Exit code 0 only if the restore succeeded and every sanity check passed.

set -euo pipefail
umask 077

# shellcheck source=scripts/backup/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

cd "$REPO_ROOT"
command -v docker >/dev/null || die "docker not found"

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  # shellcheck disable=SC2012
  DUMP="$(ls -1t "$BACKUP_DIR"/hornero-*.dump "$BACKUP_DIR"/hornero-*.dump.enc 2>/dev/null | head -n 1 || true)"
  [ -n "$DUMP" ] || die "no dump given and none found in $BACKUP_DIR"
fi
[ -f "$DUMP" ] || die "dump not found: $DUMP"
[ -s "$DUMP" ] || die "dump is empty: $DUMP"

WORK="$(mktemp -d)"
CONTAINER="hornero-restore-check-$$-$RANDOM"
cleanup() {
  docker rm -f -v "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# --- Decrypt if needed.
RESTORE_FILE="$DUMP"
case "$DUMP" in
  *.enc)
    PASS="$(env_value BACKUP_PASSPHRASE)"
    [ -n "$PASS" ] || die "$DUMP is encrypted but BACKUP_PASSPHRASE is empty"
    RESTORE_FILE="$WORK/dump"
    decrypt_file "$DUMP" "$RESTORE_FILE" "$PASS" 2>/dev/null \
      || die "decryption failed (wrong passphrase or corrupt file)"
    ;;
esac
[ -s "$RESTORE_FILE" ] || die "decrypted dump is empty"

# --- Same postgres image as production, so the major version matches.
IMAGE="$(env_value RESTORE_PG_IMAGE)"
if [ -z "$IMAGE" ]; then
  require_env_file
  IMAGE="$(compose config 2>/dev/null | awk '/^  postgres:/{f=1; next} f && /^  [a-z]/{f=0} f && $1=="image:"{print $2; exit}')"
fi
[ -n "$IMAGE" ] || die "could not determine the postgres image (set RESTORE_PG_IMAGE)"

log "starting throwaway $IMAGE as $CONTAINER"
docker run -d --rm --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=throwaway -e POSTGRES_DB=restorecheck \
  "$IMAGE" >/dev/null

# TCP readiness only becomes true after the init-phase temporary server stops.
ready=0
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres -d restorecheck >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 1
done
[ "$ready" = 1 ] || die "throwaway postgres did not become ready"

log "restoring $(basename "$DUMP")"
docker exec -i "$CONTAINER" pg_restore -U postgres -d restorecheck \
  --no-owner --no-privileges --exit-on-error < "$RESTORE_FILE" \
  || die "pg_restore failed"

q() { docker exec "$CONTAINER" psql -U postgres -d restorecheck -tAX -v ON_ERROR_STOP=1 -c "$1"; }

REQUIRED="usuarios organizaciones necesidades donaciones refresh_tokens"
OPTIONAL="articulos donacion_lineas necesidad_articulos asignaciones rondas codigos_verificacion codigos_entrega"
FAIL=0
REPORT=""

check_table() { # name required(1/0)
  local t="$1" req="$2" present n
  present="$(q "select to_regclass('public.$t') is not null")"
  if [ "$present" != "t" ]; then
    if [ "$req" = 1 ]; then REPORT="$REPORT$(printf '  %-24s MISSING (required)\n' "$t")"$'\n'; FAIL=1
    else REPORT="$REPORT$(printf '  %-24s absent\n' "$t")"$'\n'; fi
    return
  fi
  n="$(q "select count(*) from public.$t")"
  REPORT="$REPORT$(printf '  %-24s %s rows\n' "$t" "$n")"$'\n'
  if [ "$t" = usuarios ] && [ "$n" = 0 ] && [ "${RESTORE_ALLOW_EMPTY:-0}" != 1 ]; then
    REPORT="$REPORT  ^ usuarios is empty: a real database always has the seeded admin"$'\n'
    FAIL=1
  fi
}

for t in $REQUIRED; do check_table "$t" 1; done
for t in $OPTIONAL; do check_table "$t" 0; done

PGVER="$(q 'show server_version')"
NTABLES="$(q "select count(*) from information_schema.tables where table_schema='public'")"

echo "== Restore check report =="
echo "dump:       $(basename "$DUMP") ($(wc -c < "$DUMP" | tr -d ' ') bytes)"
echo "postgres:   $IMAGE (server $PGVER)"
echo "tables:     $NTABLES in schema public"
printf '%s' "$REPORT"
if [ "$FAIL" = 0 ]; then echo "RESULT: OK"; else echo "RESULT: FAILED"; exit 1; fi
