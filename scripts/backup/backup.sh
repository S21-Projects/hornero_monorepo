#!/usr/bin/env bash
# Daily database backup for Hornero.
#
#   1. pg_dump (custom format, -Fc) of the running postgres compose service
#   2. integrity check (non-empty + `pg_restore --list` can read the archive)
#   3. optional encrypted offsite copy (only when BACKUP_S3_BUCKET is set)
#   4. prune local dumps older than BACKUP_RETENTION_DAYS
#
# Usage: scripts/backup/backup.sh [--no-upload]
#   --no-upload  still encrypts (if an offsite bucket is configured) but skips
#                the upload and keeps the .enc file; it logs the keys it would
#                have written. Used to test the pipeline.
#
# Configuration (env var or compose env file; see scripts/backup/common.sh):
#   ENV_FILE                     compose env file                  (default .env)
#   BACKUP_DIR                   local destination                 (default <repo>/backups)
#   BACKUP_RETENTION_DAYS        local retention                   (default 14)
#   BACKUP_S3_BUCKET             enables the offsite copy          (default unset)
#   BACKUP_S3_ENDPOINT           S3/R2 endpoint URL                (required with bucket)
#   BACKUP_AWS_ACCESS_KEY_ID     credentials of the BACKUP bucket  (required with bucket)
#   BACKUP_AWS_SECRET_ACCESS_KEY                                   (required with bucket)
#   BACKUP_PASSPHRASE            encryption passphrase             (required with bucket)
#   BACKUP_S3_PREFIX             key prefix in the bucket          (default hornero/)
#   BACKUP_WEEKLY_DAY            ISO weekday (1=Mon..7=Sun) whose backup is also
#                                kept as "weekly"                  (default 7)
#   BACKUP_AWS_CLI_IMAGE         docker image used to upload       (default amazon/aws-cli:2.27.50)
#   BACKUP_AWS_DOCKER_ARGS       extra `docker run` args for the upload (default none)
#
# Offsite layout (retention 7 daily / 4 weekly / 6 monthly):
#   <prefix>daily/<file>.enc     every run
#   <prefix>weekly/<file>.enc    additionally on BACKUP_WEEKLY_DAY (UTC)
#   <prefix>monthly/<file>.enc   additionally on day 01 of the month (UTC)
# Remote retention is NOT scripted and this script never deletes anything from a
# bucket: expiry is done by object lifecycle rules, one per prefix (see
# docs/tfg/seguridad-c5.md). The only deletion here is of LOCAL files.
#
# Dumps contain personal data (Ley 25.326): they are written 0600 and are NEVER
# uploaded to the images bucket (AWS_S3_BUCKET_NAME); the script refuses to.

set -euo pipefail
umask 077

# shellcheck source=scripts/backup/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

UPLOAD=1
for arg in "$@"; do
  case "$arg" in
    --no-upload) UPLOAD=0 ;;
    -h|--help) sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d'; exit 0 ;;
    *) die "unknown argument: $arg" ;;
  esac
done

cd "$REPO_ROOT"
require_env_file
command -v docker >/dev/null || die "docker not found"

RETENTION_DAYS="$(env_value BACKUP_RETENTION_DAYS 14)"
case "$RETENTION_DAYS" in ''|*[!0-9]*) die "BACKUP_RETENTION_DAYS must be a non-negative integer" ;; esac
S3_BUCKET="$(env_value BACKUP_S3_BUCKET)"
WEEKLY_DAY="$(env_value BACKUP_WEEKLY_DAY 7)"
case "$WEEKLY_DAY" in [1-7]) ;; *) die "BACKUP_WEEKLY_DAY must be a number from 1 (Monday) to 7 (Sunday)" ;; esac

# --- Offsite preconditions, checked BEFORE dumping so misconfiguration fails fast.
if [ -n "$S3_BUCKET" ]; then
  IMAGES_BUCKET="$(env_value AWS_S3_BUCKET_NAME hornero-images)"
  [ "$S3_BUCKET" != "$IMAGES_BUCKET" ] \
    || die "BACKUP_S3_BUCKET equals the images bucket; dumps must never go there"
  [ -n "$(env_value BACKUP_PASSPHRASE)" ] \
    || die "BACKUP_S3_BUCKET is set but BACKUP_PASSPHRASE is empty"
  if [ "$UPLOAD" = 1 ]; then
    for v in BACKUP_S3_ENDPOINT BACKUP_AWS_ACCESS_KEY_ID BACKUP_AWS_SECRET_ACCESS_KEY; do
      [ -n "$(env_value "$v")" ] || die "BACKUP_S3_BUCKET is set but $v is empty"
    done
  fi
  command -v openssl >/dev/null || die "openssl not found"
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$BACKUP_DIR/hornero-$STAMP.dump"
TMP="$DUMP.partial"
trap 'rm -f "$TMP"' EXIT

# --- 1. Dump. The credentials are the container's own POSTGRES_* variables.
log "dumping database to $DUMP"
# shellcheck disable=SC2016  # expanded inside the container, on purpose
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$TMP"

# --- 2. Verify before the file can be mistaken for a good backup.
[ -s "$TMP" ] || die "dump is empty"
compose exec -T postgres pg_restore --list < "$TMP" > /dev/null \
  || die "dump is not a readable pg_dump archive"
mv "$TMP" "$DUMP"
chmod 600 "$DUMP"
log "dump ok: $(wc -c < "$DUMP" | tr -d ' ') bytes"

# --- 3. Encrypted offsite copy.
if [ -n "$S3_BUCKET" ]; then
  ENC="$DUMP.enc"
  encrypt_file "$DUMP" "$ENC" "$(env_value BACKUP_PASSPHRASE)"
  [ -s "$ENC" ] || die "encryption produced an empty file"
  chmod 600 "$ENC"
  PREFIX="$(env_value BACKUP_S3_PREFIX hornero/)"
  case "$PREFIX" in ''|*/) ;; *) PREFIX="$PREFIX/" ;; esac
  # Tiers are decided from the UTC date, the same clock as the file name.
  TIERS="$(retention_tiers "$(date -u +%u)" "$(date -u +%d)" "$WEEKLY_DAY")"
  if [ "$UPLOAD" = 1 ]; then
    for tier in $TIERS; do
      KEY="$PREFIX$tier/$(basename "$ENC")"
      log "uploading $(basename "$ENC") to s3://$S3_BUCKET/$KEY"
      # Credentials are exported only for this command and passed to the container
      # by NAME (-e VAR), so they never appear in argv or the process list.
      # shellcheck disable=SC2046,SC2086
      AWS_ACCESS_KEY_ID="$(env_value BACKUP_AWS_ACCESS_KEY_ID)" \
      AWS_SECRET_ACCESS_KEY="$(env_value BACKUP_AWS_SECRET_ACCESS_KEY)" \
      AWS_DEFAULT_REGION=auto \
      AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
      AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
        docker run --rm \
          -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION \
          -e AWS_REQUEST_CHECKSUM_CALCULATION -e AWS_RESPONSE_CHECKSUM_VALIDATION \
          $(env_value BACKUP_AWS_DOCKER_ARGS) \
          -v "$BACKUP_DIR:/backups:ro" \
          "$(env_value BACKUP_AWS_CLI_IMAGE amazon/aws-cli:2.27.50)" \
          s3 cp "/backups/$(basename "$ENC")" "s3://$S3_BUCKET/$KEY" \
          --endpoint-url "$(env_value BACKUP_S3_ENDPOINT)" --no-progress
    done
    rm -f "$ENC"
    log "offsite copy uploaded"
  else
    for tier in $TIERS; do
      log "--no-upload: would upload to s3://$S3_BUCKET/$PREFIX$tier/$(basename "$ENC")"
    done
    log "--no-upload: encrypted copy kept at $ENC"
  fi
else
  log "BACKUP_S3_BUCKET not set: no offsite copy (local disk only)"
fi

# --- 4. Prune local dumps (only after a successful new backup).
if [ "$RETENTION_DAYS" -gt 0 ]; then
  find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name 'hornero-*.dump' -o -name 'hornero-*.dump.enc' \) \
    -mtime +"$RETENTION_DAYS" -print -delete | sed 's/^/pruned: /' >&2 || true
fi

printf '%s\n' "$DUMP"
