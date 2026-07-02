#!/usr/bin/env bash
# tools/setup/common/smoke-7-toolchains.sh — verify all 7 language toolchains are functional.
# Fails immediately with the name of the missing/broken tool.
# Used by the full-verify CI job to ensure no test runs against a partial toolchain.
set -euo pipefail

verify() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "FAIL: $1 not on PATH" >&2
    exit 1
  fi
}

echo "─── Toolchain smoke check ───"

verify bun
echo "  bun $(bun --version)"

verify python3
echo "  python3 $(python3 --version 2>&1 | head -1)"

verify go
echo "  $(go version)"

verify rustc
echo "  $(rustc --version)"

verify cargo
echo "  $(cargo --version)"

verify dotnet
echo "  dotnet $(dotnet --version)"

verify java
java -version 2>&1 | head -1 | xargs -I{} echo "  {}"

# QDK check — requires the venv to be set up
VENV_PYTHON="${VENV_PYTHON:-src/Core.Python/.venv/bin/python3}"
if [ -x "$VENV_PYTHON" ]; then
  "$VENV_PYTHON" -c "import qdk" 2>/dev/null || { echo "FAIL: qdk not importable via $VENV_PYTHON" >&2; exit 1; }
  echo "  qdk importable"
else
  echo "FAIL: $VENV_PYTHON not found (run uv sync --project src/Core.Python)" >&2
  exit 1
fi

# E-prover check
if command -v eprover >/dev/null 2>&1; then
  echo "fof(s,conjecture,(![X]:X=X))." | eprover --auto -s 2>/dev/null | grep -q "Proof found" \
    || { echo "FAIL: eprover installed but cannot prove tautology" >&2; exit 1; }
  echo "  eprover functional"
else
  echo "  ⚠ eprover not found (FOL proofs will be skipped)"
  # Note: E-prover is best-effort on macOS dev machines (brew install eprover).
  # CI MUST have it — the full-verify job fails if missing.
  # On dev machines we warn rather than fail to not block local dev.
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: eprover required in CI but not found" >&2
    exit 1
  fi
fi

echo "✓ All toolchains functional"
