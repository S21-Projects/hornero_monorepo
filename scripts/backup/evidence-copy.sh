#!/usr/bin/env bash
# Weekly additive copy of the private evidence prefixes to a SECOND bucket.
#
# Why: Cloudflare R2 has no object versioning or replication (see docs/tfg/seguridad-c5.md),
# so an object overwritten or deleted in the images bucket is gone. This script keeps a
# second copy elsewhere.
#
# Safety properties:
#   * DISABLED unless EVIDENCE_COPY_ENABLED=true. Not scheduled by default.
#   * Uses `rclone copy`, never `rclone sync` or `move`: nothing is ever deleted, in the
#     source or in the destination. `--immutable` additionally makes rclone refuse to
#     overwrite a destination object whose source changed (evidence keys are UUIDs and are
#     never rewritten, so a change means something is wrong).
#   * Only the prefixes below are read; the public image prefixes are never copied.
#   * The source credentials only need read access. Nothing in this script can write to
#     the source bucket.
#
# Usage: scripts/backup/evidence-copy.sh [--dry-run]
#   --dry-run   passes --dry-run to rclone: lists what would be copied, copies nothing.
#
# Configuration (environment or compose env file, see common.sh):
#   EVIDENCE_COPY_ENABLED            must be "true"                          (default off)
#   EVIDENCE_COPY_SRC_BUCKET         bucket to read, e.g. the images bucket  (required)
#   EVIDENCE_COPY_SRC_ENDPOINT       S3/R2 endpoint of the source            (required)
#   EVIDENCE_COPY_SRC_ACCESS_KEY_ID / EVIDENCE_COPY_SRC_SECRET_ACCESS_KEY    (required, read-only token)
#   EVIDENCE_COPY_DST_BUCKET         bucket to write; must differ from the source (required)
#   EVIDENCE_COPY_DST_PREFIX         key prefix in the destination   (default evidencia-copia/)
#   EVIDENCE_COPY_DST_ENDPOINT / EVIDENCE_COPY_DST_ACCESS_KEY_ID / EVIDENCE_COPY_DST_SECRET_ACCESS_KEY (required)
#   EVIDENCE_COPY_PREFIXES           source prefixes, space separated  (default "org-evidencia reclamo-evidencia")
#   EVIDENCE_COPY_RCLONE_IMAGE       docker image used when RCLONE_BIN is unset (default rclone/rclone:1.68.2)
#   RCLONE_BIN                       use this rclone binary instead of docker
#
# Credentials reach rclone through environment variables (RCLONE_CONFIG_<remote>_*), never
# argv and never a config file.

set -euo pipefail
umask 077

# shellcheck source=scripts/backup/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

DRY=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=(--dry-run) ;;
    -h|--help) sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d'; exit 0 ;;
    *) die "unknown argument: $arg" ;;
  esac
done

if [ "$(env_value EVIDENCE_COPY_ENABLED false)" != "true" ]; then
  log "EVIDENCE_COPY_ENABLED is not 'true': nothing to do"
  exit 0
fi

for v in EVIDENCE_COPY_SRC_BUCKET EVIDENCE_COPY_SRC_ENDPOINT EVIDENCE_COPY_SRC_ACCESS_KEY_ID \
         EVIDENCE_COPY_SRC_SECRET_ACCESS_KEY EVIDENCE_COPY_DST_BUCKET EVIDENCE_COPY_DST_ENDPOINT \
         EVIDENCE_COPY_DST_ACCESS_KEY_ID EVIDENCE_COPY_DST_SECRET_ACCESS_KEY; do
  [ -n "$(env_value "$v")" ] || die "EVIDENCE_COPY_ENABLED is true but $v is empty"
done

SRC_BUCKET="$(env_value EVIDENCE_COPY_SRC_BUCKET)"
DST_BUCKET="$(env_value EVIDENCE_COPY_DST_BUCKET)"
[ "$SRC_BUCKET" != "$DST_BUCKET" ] || die "source and destination bucket are the same; the copy must go to a second bucket"

DST_PREFIX="$(env_value EVIDENCE_COPY_DST_PREFIX evidencia-copia/)"
case "$DST_PREFIX" in ''|*/) ;; *) DST_PREFIX="$DST_PREFIX/" ;; esac
PREFIXES="$(env_value EVIDENCE_COPY_PREFIXES "org-evidencia reclamo-evidencia")"

# Only private evidence prefixes may be copied: refuse anything else (for example the
# public images) and any path that tries to climb out.
for p in $PREFIXES; do
  case "$p" in
    org-evidencia|reclamo-evidencia) ;;
    *) die "refusing to copy prefix '$p' (allowed: org-evidencia, reclamo-evidencia)" ;;
  esac
done

if [ -n "${RCLONE_BIN:-}" ]; then
  RCLONE=("$RCLONE_BIN")
else
  command -v docker >/dev/null || die "docker not found (or set RCLONE_BIN)"
  RCLONE=(docker run --rm
    -e RCLONE_CONFIG_SRC_TYPE -e RCLONE_CONFIG_SRC_PROVIDER -e RCLONE_CONFIG_SRC_ENDPOINT
    -e RCLONE_CONFIG_SRC_ACCESS_KEY_ID -e RCLONE_CONFIG_SRC_SECRET_ACCESS_KEY -e RCLONE_CONFIG_SRC_NO_CHECK_BUCKET
    -e RCLONE_CONFIG_DST_TYPE -e RCLONE_CONFIG_DST_PROVIDER -e RCLONE_CONFIG_DST_ENDPOINT
    -e RCLONE_CONFIG_DST_ACCESS_KEY_ID -e RCLONE_CONFIG_DST_SECRET_ACCESS_KEY -e RCLONE_CONFIG_DST_NO_CHECK_BUCKET
    "$(env_value EVIDENCE_COPY_RCLONE_IMAGE rclone/rclone:1.68.2)")
fi

export RCLONE_CONFIG_SRC_TYPE=s3 RCLONE_CONFIG_SRC_PROVIDER=Cloudflare RCLONE_CONFIG_SRC_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_SRC_ENDPOINT RCLONE_CONFIG_SRC_ACCESS_KEY_ID RCLONE_CONFIG_SRC_SECRET_ACCESS_KEY
export RCLONE_CONFIG_DST_TYPE=s3 RCLONE_CONFIG_DST_PROVIDER=Cloudflare RCLONE_CONFIG_DST_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_DST_ENDPOINT RCLONE_CONFIG_DST_ACCESS_KEY_ID RCLONE_CONFIG_DST_SECRET_ACCESS_KEY
RCLONE_CONFIG_SRC_ENDPOINT="$(env_value EVIDENCE_COPY_SRC_ENDPOINT)"
RCLONE_CONFIG_SRC_ACCESS_KEY_ID="$(env_value EVIDENCE_COPY_SRC_ACCESS_KEY_ID)"
RCLONE_CONFIG_SRC_SECRET_ACCESS_KEY="$(env_value EVIDENCE_COPY_SRC_SECRET_ACCESS_KEY)"
RCLONE_CONFIG_DST_ENDPOINT="$(env_value EVIDENCE_COPY_DST_ENDPOINT)"
RCLONE_CONFIG_DST_ACCESS_KEY_ID="$(env_value EVIDENCE_COPY_DST_ACCESS_KEY_ID)"
RCLONE_CONFIG_DST_SECRET_ACCESS_KEY="$(env_value EVIDENCE_COPY_DST_SECRET_ACCESS_KEY)"

for p in $PREFIXES; do
  log "copying $SRC_BUCKET/$p/ -> $DST_BUCKET/$DST_PREFIX$p/ ${DRY[*]:-}"
  "${RCLONE[@]}" copy "SRC:$SRC_BUCKET/$p" "DST:$DST_BUCKET/$DST_PREFIX$p" \
    --immutable --checksum --transfers 4 ${DRY[@]+"${DRY[@]}"}
done
log "evidence copy finished"
