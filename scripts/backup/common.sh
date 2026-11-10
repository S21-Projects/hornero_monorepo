#!/usr/bin/env bash
# Shared helpers for backup.sh and restore-check.sh. Sourced, never executed.
#
# Config precedence for every BACKUP_* / RESTORE_* / AWS_S3_BUCKET_NAME value:
#   1. environment variable already set in the caller
#   2. the compose env file (ENV_FILE, default .env), parsed line by line
#   3. the documented default
# The env file is never `source`d (values may contain shell metacharacters) and
# no value is ever echoed.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-.env}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"

# compose warns about this unrelated variable on every invocation when unset.
export TUNNEL_TOKEN="${TUNNEL_TOKEN:-}"

# Key-derivation parameters for the encrypted copy. backup.sh and
# restore-check.sh MUST agree, which is why they live here. Changing them makes
# older .enc files undecryptable with this script.
CRYPTO_ITER=600000

log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

# env_value NAME [DEFAULT]: environment first, then ENV_FILE, then DEFAULT.
env_value() {
  local name="$1" default="${2:-}" value
  if [ -n "${!name:-}" ]; then
    printf '%s' "${!name}"
    return
  fi
  if [ -f "$ENV_FILE" ]; then
    value="$(awk -v key="$name" '
      /^[[:space:]]*#/ { next }
      {
        line = $0
        sub(/^[[:space:]]*(export[[:space:]]+)?/, "", line)
        if (index(line, key "=") == 1) { v = substr(line, length(key) + 2) }
      }
      END { if (v != "") print v }' "$ENV_FILE" | tail -n 1)"
    # Strip one pair of surrounding quotes and a trailing CR.
    value="${value%$'\r'}"
    case "$value" in
      \"*\") value="${value#\"}"; value="${value%\"}" ;;
      \'*\') value="${value#\'}"; value="${value%\'}" ;;
    esac
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return
    fi
  fi
  printf '%s' "$default"
}

# retention_tiers WEEKDAY DAY_OF_MONTH WEEKLY_DAY
# Prints, one per line, the offsite tiers a backup taken on that date belongs to.
# WEEKDAY is ISO (1 = Monday ... 7 = Sunday). Every backup is "daily"; the one taken on
# WEEKLY_DAY is also "weekly"; the one taken on day 01 of the month is also "monthly".
# Each tier is a separate key prefix so the bucket lifecycle rules (which can only
# filter by prefix and age) can keep 7 daily, 4 weekly and 6 monthly copies.
retention_tiers() {
  local weekday="$1" dom="$2" weekly_day="$3"
  echo daily
  if [ "$weekday" = "$weekly_day" ]; then echo weekly; fi
  if [ "$dom" = 01 ]; then echo monthly; fi
}

compose() { docker compose --env-file "$ENV_FILE" "$@"; }

require_env_file() {
  [ -f "$ENV_FILE" ] || die "env file '$ENV_FILE' not found (set ENV_FILE=...)"
}

# encrypt_file IN OUT PASSPHRASE / decrypt_file IN OUT PASSPHRASE
# The passphrase travels through the process environment, never argv.
encrypt_file() {
  BACKUP_CRYPTO_PASS="$3" openssl enc -aes-256-cbc -pbkdf2 -iter "$CRYPTO_ITER" -salt \
    -pass env:BACKUP_CRYPTO_PASS -in "$1" -out "$2"
}
decrypt_file() {
  BACKUP_CRYPTO_PASS="$3" openssl enc -d -aes-256-cbc -pbkdf2 -iter "$CRYPTO_ITER" \
    -pass env:BACKUP_CRYPTO_PASS -in "$1" -out "$2"
}
