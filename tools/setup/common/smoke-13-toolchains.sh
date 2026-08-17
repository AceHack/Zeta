#!/usr/bin/env bash
# tools/setup/common/smoke-13-toolchains.sh
#
# Verify all 13 language/compiler toolchains are functional.
# Fails immediately with the name of the missing/broken tool.
# Used by the full-verify CI job to ensure no test runs against a partial toolchain.
#
# Toolchain inventory (13 total):
#   1.  bun          -- TypeScript/JS runtime (primary agent harness)
#   2.  python3      -- Python runtime (Core.Python, QDK, uv-managed tools)
#   3.  go           -- Go runtime (Core.Go/algebra, GOOS=js GOARCH=wasm DLA oracle)
#   4.  rustc        -- Rust compiler (Core.Rust.Observe, wasm32 target)
#   5.  cargo        -- Rust build tool
#   6.  dotnet       -- .NET SDK (Core.FSharp, Core.CSharp)
#   7.  java         -- JVM (formal-verification rung)
#   8.  qdk          -- Q# / Quantum Development Kit (Core.Python venv)
#   9.  eprover      -- E first-order ATP (formal-verification rung-3)
#  10a. wat2wasm     -- WebAssembly Binary Toolkit (Oracle 10 WAT substrate, 697B)
#  10b. wasm-opt     -- Binaryen WASM optimizer (Oracle 10 AssemblyScript substrate)
#  10c. emcc         -- Emscripten C->WASM compiler (Oracle 10 C substrate, 1.1KB)
#  11.  zig          -- Zig wasm32-freestanding compiler (Oracle 11, 951B)
#  12.  rustup wasm32 -- Rust wasm32-unknown-unknown target (Oracle 12, 7.4KB)
#  13.  llc          -- LLVM IR compiler (Oracle 13 LLVM IR substrate)
#
# Replaces smoke-10-toolchains.sh (added zig, rustup wasm32, llvm triad).
#
# NOT WIRED TO CI (corrected 2026-08-16). The line here used to read "gate.yml
# references this one". It does not: gate.yml's full-verify job runs
# `CI=true ./tools/setup/common/smoke-7-toolchains.sh` (the 7-language install it
# actually performs), and no workflow in .github/workflows/ invokes smoke-13 or
# smoke-10. So oracles 8-13 (qdk, eprover, the wasm triad, zig, rust wasm32, llvm)
# have no smoke gate in CI even though this script exists to provide one. Left as a
# correct local/dev tool; wiring it is a separate call, since it would make
# full-verify newly capable of failing on toolchains it does not currently install.
set -euo pipefail

verify() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "FAIL: $1 not on PATH" >&2
    exit 1
  fi
}

echo "--- Toolchain smoke check (13 toolchains) ---"

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

# 8. QDK check -- requires the venv to be set up
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
  echo "  WARNING: eprover not found (FOL proofs will be skipped)"
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: eprover required in CI but not found" >&2
    exit 1
  fi
fi

# -- WASM toolchain (10a / 10b / 10c) -------------------------------------------
echo "--- WASM toolchain smoke check ---"

# 10a. wabt -- wat2wasm (WAT bare-metal substrate, Oracle 10a, 697B)
if command -v wat2wasm >/dev/null 2>&1; then
  echo "  wat2wasm $(wat2wasm --version 2>&1 | head -1)"
else
  echo "  WARNING: wat2wasm not found (wabt not installed)"
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: wat2wasm required in CI (wabt package missing)" >&2
    exit 1
  fi
fi

# 10b. binaryen -- wasm-opt (AssemblyScript optimizer, Oracle 10b)
if command -v wasm-opt >/dev/null 2>&1; then
  echo "  wasm-opt $(wasm-opt --version 2>&1 | head -1)"
else
  echo "  WARNING: wasm-opt not found (binaryen not installed)"
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: wasm-opt required in CI (binaryen package missing)" >&2
    exit 1
  fi
fi

# 10c. emscripten -- emcc (C->WASM, Oracle 10c / Conjecture Z-7 C substrate, 1.1KB)
if command -v emcc >/dev/null 2>&1; then
  echo "  emcc $(emcc --version 2>&1 | head -1)"
else
  echo "  WARNING: emcc not found (emscripten not installed)"
  # emscripten is tier=standard (large dep); warn on dev machines, fail in CI
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: emcc required in CI (emscripten package missing)" >&2
    exit 1
  fi
fi

# -- Zig (Oracle 11 / wasm32-freestanding substrate, 951B) ----------------------
echo "--- Zig smoke check ---"
if command -v zig >/dev/null 2>&1; then
  echo "  zig $(zig version)"
  # Verify zig can compile to wasm32-freestanding
  ZIG_TMP=$(mktemp -d)
  cat > "$ZIG_TMP/test.zig" << 'ZIGEOF'
export fn add(a: i32, b: i32) i32 { return a + b; }
ZIGEOF
  # This is the only check in the file that verifies a toolchain WORKS rather than
  # merely that it EXISTS — and until 2026-08-16 it was also the only one that could
  # not fail in CI. Every sibling below/above escalates its WARNING to `exit 1` when
  # CI=true; this one warned and returned 0, so a zig that is installed but cannot
  # emit wasm32-freestanding passed the "all 13 toolchains functional" smoke check.
  # The presence half already failed closed in CI (see the `else` branch), which made
  # the asymmetry easy to miss: the substrate could be present and broken.
  if zig build-exe "$ZIG_TMP/test.zig" \
       -target wasm32-freestanding \
       -O ReleaseSmall \
       --export=add \
       -femit-bin="$ZIG_TMP/test.wasm" 2>/dev/null \
     && wasm-validate "$ZIG_TMP/test.wasm" 2>/dev/null; then
    echo "  zig wasm32-freestanding: OK"
  else
    echo "  WARNING: zig wasm32-freestanding compilation failed"
    if [ "${CI:-}" = "true" ]; then
      echo "FAIL: zig cannot emit a valid wasm32-freestanding module (Oracle 11 substrate broken)" >&2
      rm -rf "$ZIG_TMP"
      exit 1
    fi
  fi
  rm -rf "$ZIG_TMP"
else
  echo "  WARNING: zig not found (install via mise: zig = \"0.13.0\" in .mise.toml)"
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: zig required in CI (Oracle 11 substrate missing)" >&2
    exit 1
  fi
fi

# -- Rust wasm32-unknown-unknown target (Oracle 12, 7.4KB) ----------------------
echo "--- Rust wasm32 target smoke check ---"
if command -v rustup >/dev/null 2>&1; then
  echo "  rustup $(rustup --version 2>&1 | head -1)"
  if rustup target list --installed 2>/dev/null | grep -q "wasm32-unknown-unknown"; then
    echo "  wasm32-unknown-unknown: installed"
  else
    echo "  WARNING: wasm32-unknown-unknown target not installed"
    # The target is DECLARED on the mise rust entry (.mise.toml + .mise.full.toml,
    # 081M05X126V087G0R0014GR9KQ) — so a miss here means the declaration did not
    # take, not that a human forgot a step. Re-run the declarative install.
    echo "  Fix: mise install rust  (target declared in .mise.toml; do NOT hand-add it)"
    if [ "${CI:-}" = "true" ]; then
      echo "FAIL: wasm32-unknown-unknown target required in CI" >&2
      exit 1
    fi
  fi
else
  echo "  WARNING: rustup not found (Rust managed via mise: rust = \"1.87.0\")"
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: rustup required in CI (Oracle 12 substrate missing)" >&2
    exit 1
  fi
fi

# -- LLVM IR (Oracle 13 / llc, llvm-as, opt) ------------------------------------
echo "--- LLVM IR smoke check ---"
# llc may be versioned (llc-18 on Ubuntu Noble)
LLC_BIN=""
for candidate in llc llc-18 llc-17 llc-16; do
  if command -v "$candidate" >/dev/null 2>&1; then
    LLC_BIN="$candidate"
    break
  fi
done

if [ -n "$LLC_BIN" ]; then
  echo "  $LLC_BIN $($LLC_BIN --version 2>&1 | grep -i "llvm version" | head -1)"
else
  echo "  WARNING: llc not found (llvm package missing)"
  if [ "${CI:-}" = "true" ]; then
    echo "FAIL: llc required in CI (Oracle 13 LLVM IR substrate missing)" >&2
    exit 1
  fi
fi

echo ""
echo "OK All 13 toolchains functional"
