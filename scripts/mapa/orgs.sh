#!/usr/bin/env bash
# Stage the organizaciones input of the vulnerability pipeline into scripts/mapa/out/.
#
# MAPA_ORGS is either a local JSON file path or an http(s):// URL of GET /organizaciones/mapa
# (the response envelope or a bare array of items). Default: the committed ReNaCoM fixture.
# Fetching a URL is an explicit operator decision: this script never guesses a host.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${MAPA_ORGS:-$DIR/fixtures/organizaciones-mapa.renacom.json}"
DEST="$DIR/out/organizaciones-mapa.json"

mkdir -p "$DIR/out"
case "$SRC" in
  http://*|https://*)
    echo "fetching $SRC"
    curl --fail --location --show-error --silent --max-time 120 --output "$DEST.part" "$SRC"
    mv "$DEST.part" "$DEST"
    ;;
  *://*)
    echo "unsupported MAPA_ORGS scheme: $SRC (use a file path or http(s)://)" >&2
    exit 1
    ;;
  *)
    [ -s "$SRC" ] || { echo "MAPA_ORGS file not found or empty: $SRC" >&2; exit 1; }
    echo "using $SRC"
    cp "$SRC" "$DEST"
    ;;
esac
