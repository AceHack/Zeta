#!/usr/bin/env bash
#
# Mechanism: from-uv-venv — importable PyPI libraries into repo .venv (uv pip install).
# Manifest: tools/setup/manifests/from-uv-venv

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-uv-venv"
VENV="$REPO_ROOT/.venv"
PY_BIN="$VENV/bin/python"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ no quantum manifest at $MANIFEST; skipping"
  exit 0
fi

if [ "${ZETA_INSTALL_QUANTUM:-0}" != "1" ] && [ "${ZETA_INSTALL_FULL:-0}" != "1" ]; then
  echo "✓ from-uv-venv: skipping (set ZETA_INSTALL_QUANTUM=1 or ZETA_INSTALL_FULL=1)"
  exit 0
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "warn: uv not on PATH; skipping quantum oracle deps" >&2
  exit 0
fi
UV_BIN="$(command -v uv)"

SPECS="$(awk '
  { sub(/#.*$/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, "") }
  NF > 0 && !/ecosystem=npm/ { print $1 }
' "$MANIFEST")"

if [ -z "$SPECS" ]; then
  echo "✓ quantum manifest empty; skipping"
  exit 0
fi

echo "↓ ensuring project Python env at .venv for quantum oracle deps..."
if ! "$UV_BIN" venv "$VENV" >/dev/null; then
  echo "warn: uv venv failed; skipping quantum oracle deps" >&2
  exit 0
fi

echo "↓ installing quantum oracle deps from $(basename "$MANIFEST")..."
while IFS= read -r spec; do
  [ -z "$spec" ] && continue
  echo "  uv pip install $spec"
  if ! "$UV_BIN" pip install --python "$PY_BIN" "$spec"; then
    echo "warn: failed to install quantum oracle dep '$spec'; continuing" >&2
    exit 0
  fi
done <<< "$SPECS"

if "$PY_BIN" - <<'PY'
import importlib

importlib.import_module("qdk")
try:
    from qdk import qsharp  # noqa: F401
except Exception:
    importlib.import_module("qsharp")
PY
then
  echo "✓ quantum oracle deps ready"
else
  echo "warn: quantum deps installed but QDK/Q# import probe failed; continuing" >&2
fi
