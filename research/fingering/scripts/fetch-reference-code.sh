#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ARCHIVE="$ROOT/vendor/SourceCode_v190921.zip"
EXPECTED="e2c15638794a71ab8e4aed0ffaa89d38bf86b56f6c64c602b54531673eeaf26c"

mkdir -p "$ROOT/vendor"
curl -fsSL https://statpianofingering.github.io/data/SourceCode_v190921.zip -o "$ARCHIVE"
printf '%s  %s\n' "$EXPECTED" "$ARCHIVE" | sha256sum --check
unzip -oq "$ARCHIVE" -d "$ROOT/vendor"
rm -rf "$ROOT/vendor/__MACOSX"
printf 'Code de référence extrait dans %s\n' "$ROOT/vendor/SourceCode"
