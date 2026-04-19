#!/usr/bin/env bash
# vault.sh — copy a file to _vault/<date>/<original-path> before destructive edits.
# Usage: bin/vault.sh path/to/file.html [path/to/another.js ...]
# Idempotent within the same day (skips if already vaulted today).

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <file> [file ...]" >&2
  exit 64
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATE="$(date +%Y-%m-%d)"
VAULT_DIR="$ROOT/_vault/$DATE"

for src in "$@"; do
  if [ ! -f "$src" ]; then
    echo "skip: $src (not a file)" >&2
    continue
  fi
  abs="$(cd "$(dirname "$src")" && pwd)/$(basename "$src")"
  rel="${abs#$ROOT/}"
  dest="$VAULT_DIR/$rel"
  if [ -f "$dest" ]; then
    echo "already vaulted today: $rel"
    continue
  fi
  mkdir -p "$(dirname "$dest")"
  cp -p "$src" "$dest"
  echo "vaulted: $rel → _vault/$DATE/$rel"
done
