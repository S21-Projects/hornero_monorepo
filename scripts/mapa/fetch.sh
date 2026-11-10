#!/usr/bin/env bash
# Download the Censo 2022 radios parquet into the gitignored cache, only if missing.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="$DIR/.cache"
DEST="$CACHE/radios.parquet"
URL="https://data.source.coop/nlebovits/censo-argentino/2022/radios.parquet"

if [ -s "$DEST" ]; then
  echo "cached: $DEST"
  exit 0
fi

mkdir -p "$CACHE"
echo "downloading $URL"
# --fail makes curl exit non-zero on HTTP errors; write to .part so a partial file is never kept.
curl --fail --location --show-error --output "$DEST.part" "$URL"
mv "$DEST.part" "$DEST"
echo "saved: $DEST"
