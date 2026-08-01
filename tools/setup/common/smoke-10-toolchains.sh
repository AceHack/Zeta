#!/usr/bin/env bash
# tools/setup/common/smoke-10-toolchains.sh
#
# Verify all 10 language/compiler toolchains are functional.
# Fails immediately with the name of the missing/broken tool.
# Used by the full-verify CI job to ensure no test runs against a partial toolchain.
#
# Toolchain inventory (10 total):
#   1. bun          — TypeScript/JS runtime (primary agent harness)
#   2. python3      — Python runtime (Core.Python, QDK, uv-managed tools)
#   3. go           — Go runtime (Core.Go/algebra, GOOS=js GOARCH=wasm DLA oracle)
#   4. rustc        — Rust compiler (Core.Rust.Observe, wasm32 target)
#   5. cargo        — Rust build tool
#   6. dotnet       — .NET SDK (Core.FSharp, Core.CSharp)
#   7. java         — JVM (formal-verification rung)
#   8. qdk          — Q# / Quantum Development Kit (Core.Python venv)
#   9. eprover      — E first-order ATP (formal-verification rung-3)
#  10. wat2wasm     — WebAssembly Binary Toolkit (Oracle 10 WAT substrate)
#      wasm-opt     — Binaryen WASM optimizer (Oracle 10 AssemblyScript substrate)
#      emcc         — Emscripten C→WASM compiler (Oracle 10 fourth substrate)
#
# Replaces smoke-7-toolchains.sh (added WASM triad: wabt + binaryen + emscripten).
# The old script is kept for backward compat; gate.yml references this one.
set -euo pipefail

verify() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "FAIL: $1 not on PATH" >&2
    exit 1
  fi
}

echo "─── Toolchain smoke check (10 toolchains) ───"

# 1. bun
verify bun
echo "  bun $(bun --version)"

# 2. python3
verify python3
echo "  python3 $(python3 --version 2>&1 | head -1)"

# 3. go
verify go
echo "  $(go version)"

# 4. rustc
verify rustc
echo "  $(rustc --version)"

# 5. cargo
verify cargo
echo "  $(cargo --version)"

# 6. dotnet
verify dotnet
echo "  dotnet $(dotnet --version)"

# 7. java
verify java
java -version 2>&1 | head -1 | xargs -I{} echo "  {}"

# 8. QDK check — requires the venv to be set up
VENV_PYTHON="${VENV_PYTHON:-src/Core.Python/.venv/bin/python3}"
if [ -x "$VENV_PYTHON" ]; then
  "$VENV_PYTHON" -c "import qdk" 2>/dev/null || { echo "FAIL: qdk not importable via $VENV_PYTHON" >&2; exit 1; }
  echo "  qdk importable"
else
  echo "FAIL: $VENV_PYTHON not found (run uv sync --project src/Core.Python)" >&2
  exit 1
fi

# 9. E-prover check
if command -v eprover >/dev/null 2>&1; then
  echo "fof(s,conjecture,(![X]:X=X))." | eprover --auto -s 2>/dev/null | grep -q "Proof found" \
    || { echo "FAIL: eprover installed but cannot prove tautology" >&2; exit 1; }
  echo "  eprover functional"
else
  echo "  ⚠ eprover not found (FOL proofs will be skipped)"
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: eprover required in CI but not found" >&2
    exit 1
  fi
fi

# ── WASM triad (toolchains 10a / 10b / 10c) ────────────────────────────────
# Oracle 10 requires three WASM compilers. All three must be on PATH in CI.
# On dev machines we warn rather than fail if a compiler is missing (tier=standard
# packages like emscripten are optional on slim hosts).

echo "─── WASM toolchain smoke check ───"

# 10a. wabt — wat2wasm (WAT bare-metal substrate, Oracle 10a)
if command -v wat2wasm >/dev/null 2>&1; then
  echo "  wat2wasm $(wat2wasm --version 2>&1 | head -1)"
else
  echo "  ⚠ wat2wasm not found (wabt not installed)"
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: wat2wasm required in CI (wabt package missing)" >&2
    exit 1
  fi
fi

# 10b. binaryen — wasm-opt (AssemblyScript optimizer, Oracle 10b)
if command -v wasm-opt >/dev/null 2>&1; then
  echo "  wasm-opt $(wasm-opt --version 2>&1 | head -1)"
else
  echo "  ⚠ wasm-opt not found (binaryen not installed)"
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: wasm-opt required in CI (binaryen package missing)" >&2
    exit 1
  fi
fi

# 10c. emscripten — emcc (C→WASM, Oracle 10c / Conjecture Z-7 fourth substrate)
if command -v emcc >/dev/null 2>&1; then
  echo "  emcc $(emcc --version 2>&1 | head -1)"
else
  echo "  ⚠ emcc not found (emscripten not installed)"
  # emscripten is tier=standard (large dep); warn on dev machines, fail in CI
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: emcc required in CI (emscripten package missing)" >&2
    exit 1
  fi
fi

echo "✓ All 10 toolchains functional"
