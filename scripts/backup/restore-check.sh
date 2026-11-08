#!/usr/bin/env bash
# Restore drill: prove a backup can actually be restored.
#
# Restores the dump into a THROWAWAY postgres container (same image as the
# compose `postgres` service, random name, no published ports, no volume kept)
# and runs sanity queries. It never connects to the real database.
#
# Usage: scripts/backup/restore-check.sh [DUMP] [options]
#   DUMP  hornero-*.dump or hornero-*.dump.enc (default: newest in BACKUP_DIR)
#
# Options:
#   --expect TABLE=N     row count the table must have after the restore (repeatable).
#                        Take them from the production database at the moment the dump
#                        was made (see docs/tfg/prueba-restauracion.md). A mismatch fails.
#   --expect-file FILE   same, one TABLE=N per line ('#' comments allowed)
#   --ms-image IMAGE     also verify the audit hash chain with the REAL verifier: starts
#                        this MS image (the one built from jar_hornero_ms) against the
#                        restored throwaway database and reads the verification it runs
#                        on startup. No hashing is reimplemented in shell.
#
# Config: ENV_FILE, BACKUP_DIR, BACKUP_PASSPHRASE (needed for .enc files),
#         RESTORE_PG_IMAGE (override the postgres image),
#         RESTORE_EXPECT ("usuarios=5 organizaciones=3", same as --expect),
#         RESTORE_MS_IMAGE (same as --ms-image), RESTORE_MS_TIMEOUT (seconds, default 300),
#         RESTORE_ALLOW_EMPTY=1 (accept a dump whose usuarios table is empty).
#
# Output: a human report, then a Markdown table row for docs/tfg/prueba-restauracion.md.
# Exit code 0 only if the restore succeeded and every check passed. A chain check that was
# not requested is reported as "no ejecutada" and does not fail the drill.

set -euo pipefail
umask 077

# shellcheck source=scripts/backup/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

DUMP=""
EXPECT_LIST="${RESTORE_EXPECT:-}"
MS_IMAGE="${RESTORE_MS_IMAGE:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --expect) [ $# -ge 2 ] || die "--expect needs TABLE=N"; EXPECT_LIST="$EXPECT_LIST $2"; shift 2 ;;
    --expect-file)
      [ $# -ge 2 ] && [ -f "$2" ] || die "--expect-file needs an existing file"
      EXPECT_LIST="$EXPECT_LIST $(sed -e 's/#.*//' -e 's/[[:space:]]//g' "$2" | tr '\n' ' ')"
      shift 2 ;;
    --ms-image) [ $# -ge 2 ] || die "--ms-image needs an image"; MS_IMAGE="$2"; shift 2 ;;
    -h|--help) sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d'; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) [ -z "$DUMP" ] || die "more than one DUMP given"; DUMP="$1"; shift ;;
  esac
done

# Expected counts: "table=N" pairs separated by spaces or commas. The table name goes into
# SQL, so it is restricted to identifier characters.
EXPECT_TABLES=""
for pair in $(printf '%s' "$EXPECT_LIST" | tr ',' ' '); do
  t="${pair%%=*}"; n="${pair#*=}"
  case "$t" in ''|*[!a-z0-9_]*) die "invalid table name in expectation: '$pair'" ;; esac
  case "$n" in ''|*[!0-9]*) die "invalid expected count in: '$pair' (need TABLE=N)" ;; esac
  EXPECT_TABLES="$EXPECT_TABLES $t"
  printf -v "EXP_$t" '%s' "$n"
done

expected_for() { # table -> expected count, or empty
  local var="EXP_$1"
  printf '%s' "${!var:-}"
}

cd "$REPO_ROOT"
command -v docker >/dev/null || die "docker not found"

if [ -z "$DUMP" ]; then
  # shellcheck disable=SC2012
  DUMP="$(ls -1t "$BACKUP_DIR"/hornero-*.dump "$BACKUP_DIR"/hornero-*.dump.enc 2>/dev/null | head -n 1 || true)"
  [ -n "$DUMP" ] || die "no dump given and none found in $BACKUP_DIR"
fi
[ -f "$DUMP" ] || die "dump not found: $DUMP"
[ -s "$DUMP" ] || die "dump is empty: $DUMP"
DUMP_BYTES="$(wc -c < "$DUMP" | tr -d ' ')"

WORK="$(mktemp -d)"
CONTAINER="hornero-restore-check-$$-$RANDOM"
MS_CONTAINER="$CONTAINER-ms"
NETWORK="$CONTAINER-net"
cleanup() {
  docker rm -f -v "$MS_CONTAINER" >/dev/null 2>&1 || true
  docker rm -f -v "$CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
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

docker network create "$NETWORK" >/dev/null
log "starting throwaway $IMAGE as $CONTAINER"
docker run -d --rm --name "$CONTAINER" --network "$NETWORK" \
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
T0="$(date +%s)"
docker exec -i "$CONTAINER" pg_restore -U postgres -d restorecheck \
  --no-owner --no-privileges --exit-on-error < "$RESTORE_FILE" \
  || die "pg_restore failed"
RESTORE_SECONDS=$(( $(date +%s) - T0 ))

q() { docker exec "$CONTAINER" psql -U postgres -d restorecheck -tAX -v ON_ERROR_STOP=1 -c "$1"; }

REQUIRED="usuarios organizaciones necesidades donaciones refresh_tokens"
OPTIONAL="articulos donacion_lineas necesidad_articulos asignaciones rondas codigos_verificacion codigos_entrega organizacion_evidencia organizacion_evento actividad"
FAIL=0
REPORT=""
COUNTS_CELL=""

note_count() { COUNTS_CELL="$COUNTS_CELL${COUNTS_CELL:+; }$1"; }

check_table() { # name required(1/0)
  local t="$1" req="$2" present n want
  present="$(q "select to_regclass('public.$t') is not null")"
  if [ "$present" != "t" ]; then
    if [ "$req" = 1 ]; then REPORT="$REPORT$(printf '  %-24s MISSING (required)\n' "$t")"$'\n'; FAIL=1
    else REPORT="$REPORT$(printf '  %-24s absent\n' "$t")"$'\n'; fi
    want="$(expected_for "$t")"
    if [ -n "$want" ]; then
      REPORT="$REPORT  ^ expected $want rows but the table is not in the dump"$'\n'
      note_count "$t ausente (esperado $want)"; FAIL=1
    fi
    return
  fi
  n="$(q "select count(*) from public.$t")"
  want="$(expected_for "$t")"
  if [ -n "$want" ]; then
    if [ "$n" = "$want" ]; then
      REPORT="$REPORT$(printf '  %-24s %s rows (expected %s: match)\n' "$t" "$n" "$want")"$'\n'
    else
      REPORT="$REPORT$(printf '  %-24s %s rows (expected %s: MISMATCH)\n' "$t" "$n" "$want")"$'\n'
      FAIL=1
    fi
    note_count "$t $n/$want"
  else
    REPORT="$REPORT$(printf '  %-24s %s rows\n' "$t" "$n")"$'\n'
    case " $REQUIRED " in *" $t "*) note_count "$t $n/-" ;; esac
  fi
  if [ "$t" = usuarios ] && [ "$n" = 0 ] && [ "${RESTORE_ALLOW_EMPTY:-0}" != 1 ]; then
    REPORT="$REPORT  ^ usuarios is empty: a real database always has the seeded admin"$'\n'
    FAIL=1
  fi
}

for t in $REQUIRED; do check_table "$t" 1; done
for t in $OPTIONAL; do check_table "$t" 0; done
# Tables named only in the expectations are checked as well.
for t in $EXPECT_TABLES; do
  case " $REQUIRED $OPTIONAL " in *" $t "*) ;; *) check_table "$t" 0 ;; esac
done

PGVER="$(q 'show server_version')"
NTABLES="$(q "select count(*) from information_schema.tables where table_schema='public'")"

# --- Hash chain, part 1: link check in SQL. Read-only and it hashes nothing: it only
# verifies that each sealed event's prev_hash equals the hash of the previous event of the
# same organization. Detects deleted, inserted and reordered rows. Content tampering is
# detected only by part 2, which uses the real verifier.
LINKS="no aplica"
HAS_HASH="$(q "select count(*) from information_schema.columns where table_schema='public' and table_name='organizacion_evento' and column_name in ('hash','prev_hash')")"
if [ "$HAS_HASH" = 2 ]; then
  BROKEN_LINKS="$(q "select count(*) from (
      select hash, prev_hash,
             lag(hash) over (partition by organizacion_id order by id) as anterior
      from public.organizacion_evento) e
    where e.hash is not null and e.prev_hash is distinct from coalesce(e.anterior, repeat('0', 64))")"
  UNSEALED="$(q "select count(*) from public.organizacion_evento where hash is null")"
  if [ "$BROKEN_LINKS" = 0 ]; then LINKS="enlaces OK ($UNSEALED sin sellar)"; else LINKS="$BROKEN_LINKS enlaces rotos"; FAIL=1; fi
elif [ "$(q "select to_regclass('public.organizacion_evento') is not null")" = t ]; then
  LINKS="dump anterior a la cadena (sin columnas hash)"
fi

# --- Hash chain, part 2: the real verifier (VerificadorCadena). The MS runs it on startup
# (VerificacionCadenaJob, ApplicationReadyEvent), so starting the MS image against the
# restored throwaway database is enough; no JWT or HTTP call is needed. Nothing here has
# any S3 credentials, so the MS builds the no-op stores and cannot touch a bucket.
CHAIN="no ejecutada"
if [ -n "$MS_IMAGE" ]; then
  command -v openssl >/dev/null || die "openssl not found (needed to generate throwaway secrets)"
  TIMEOUT="$(env_value RESTORE_MS_TIMEOUT 300)"
  case "$TIMEOUT" in ''|*[!0-9]*) die "RESTORE_MS_TIMEOUT must be an integer" ;; esac
  log "starting $MS_IMAGE against the restored database (chain verification)"
  JWT_SECRET="$(openssl rand -hex 32)"
  SUPER_ADMIN_PASSWORD="Rc-$(openssl rand -hex 8)-Zz9!"
  export JWT_SECRET SUPER_ADMIN_PASSWORD
  docker run -d --name "$MS_CONTAINER" --network "$NETWORK" \
    -e DB_HOST="$CONTAINER" -e DB_PORT=5432 -e DB_NAME=restorecheck \
    -e DB_USERNAME=postgres -e DB_PASSWORD=throwaway \
    -e JWT_SECRET -e SUPER_ADMIN_PASSWORD \
    -e SUPER_ADMIN_EMAIL=restore-check@example.invalid \
    -e SEED_DEMO_DATA=false -e MAIL_LOG_ONLY=true -e NOTIFICACIONES_ENABLED=false \
    -e RONDAS_AUTO_ENABLED=false -e SERVER_PORT=8081 \
    "$MS_IMAGE" >/dev/null
  unset JWT_SECRET SUPER_ADMIN_PASSWORD
  CHAIN="sin resultado en ${TIMEOUT}s"
  for _ in $(seq 1 "$TIMEOUT"); do
    LOGS="$(docker logs "$MS_CONTAINER" 2>&1 || true)"
    if line="$(printf '%s\n' "$LOGS" | grep -m1 'hash chain verified:')"; then
      CHAIN="OK (${line#*hash chain verified: })"; break
    fi
    if line="$(printf '%s\n' "$LOGS" | grep -m1 'HASH CHAIN BROKEN')"; then
      line="${line#*HASH CHAIN BROKEN: }"
      CHAIN="ROTA (${line%%), *})"; FAIL=1; break
    fi
    if printf '%s\n' "$LOGS" | grep -q 'hash chain verification could not run'; then
      CHAIN="ERROR del verificador"; FAIL=1; break
    fi
    if [ "$(docker inspect -f '{{.State.Running}}' "$MS_CONTAINER" 2>/dev/null || echo false)" != true ]; then
      CHAIN="el MS no arrancó"; FAIL=1; break
    fi
    sleep 1
  done
  case "$CHAIN" in "sin resultado"*) FAIL=1 ;; esac
fi

DATE_UTC="$(date -u +%Y-%m-%d)"
echo "== Restore check report =="
echo "dump:       $(basename "$DUMP") ($DUMP_BYTES bytes)"
echo "postgres:   $IMAGE (server $PGVER)"
echo "tables:     $NTABLES in schema public"
echo "restore:    ${RESTORE_SECONDS}s (pg_restore only)"
printf '%s' "$REPORT"
echo "chain:      $LINKS; verificador: $CHAIN"
if [ -z "$EXPECT_TABLES" ]; then echo "warning:    no expected counts given (--expect TABLE=N); only presence was checked"; fi
if [ "$FAIL" = 0 ]; then RESULT="OK"; else RESULT="FALLO"; fi
echo "RESULT: $([ "$FAIL" = 0 ] && echo OK || echo FAILED)"

COUNTS_OUT="${COUNTS_CELL:-sin datos}"
[ -n "$EXPECT_TABLES" ] || COUNTS_OUT="$COUNTS_OUT (sin conteos esperados)"
echo
echo "== Fila para docs/tfg/prueba-restauracion.md =="
echo "| Fecha (UTC) | Archivo | Tamaño (bytes) | Duración (s) | Conteos restaurado/esperado | Cadena de hashes | Resultado |"
echo "|---|---|---|---|---|---|---|"
echo "| $DATE_UTC | $(basename "$DUMP") | $DUMP_BYTES | $RESTORE_SECONDS | $COUNTS_OUT | $LINKS; verificador: $CHAIN | $RESULT |"
[ "$FAIL" = 0 ]
