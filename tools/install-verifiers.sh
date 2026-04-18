#!/usr/bin/env bash
# Installs the formal-verification and static-analysis tools referenced
# in `docs/REVIEW-AGENTS.md` and `docs/MATH-SPEC-TESTS.md`. Idempotent —
# re-run safely; skips anything already installed.
#
# Targets macOS (Homebrew) + Linux (apt / direct download). Windows
# users can install these via `winget` equivalents.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TLA_DIR="$REPO_ROOT/tools/tla"
ALLOY_DIR="$REPO_ROOT/tools/alloy"

echo "=== Dbsp verifier toolchain installer ==="
echo "Repo root: $REPO_ROOT"

# ── 1. Java (required by TLC + Alloy) ──────────────────────────────
if ! command -v java >/dev/null 2>&1; then
  echo "✗ java not found — install JDK 17+ first:"
  echo "    brew install openjdk@21      # macOS"
  echo "    sudo apt install default-jdk # Linux"
  exit 1
fi
echo "✓ java: $(java -version 2>&1 | head -n1)"

# ── 2. TLA+ tools (tla2tools.jar) ──────────────────────────────────
mkdir -p "$TLA_DIR"
if [ ! -f "$TLA_DIR/tla2tools.jar" ]; then
  echo "↓ downloading tla2tools.jar..."
  curl -sL -o "$TLA_DIR/tla2tools.jar" \
    https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar
fi
echo "✓ tla2tools.jar at $TLA_DIR/tla2tools.jar"

# ── 3. Alloy (bounded model checker) ───────────────────────────────
mkdir -p "$ALLOY_DIR"
if [ ! -f "$ALLOY_DIR/alloy.jar" ]; then
  echo "↓ downloading alloy.jar..."
  curl -sL -o "$ALLOY_DIR/alloy.jar" \
    https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar
fi
echo "✓ alloy.jar at $ALLOY_DIR/alloy.jar"

# ── 4. Lean 4 via elan ─────────────────────────────────────────────
if ! command -v lean >/dev/null 2>&1; then
  echo "↓ installing Lean 4 via elan..."
  curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh \
    | sh -s -- -y --default-toolchain stable
  # shellcheck disable=SC1090
  source "$HOME/.elan/env"
fi
if command -v lean >/dev/null 2>&1; then
  echo "✓ lean: $(lean --version)"
else
  echo "⚠ lean install attempted — add \$HOME/.elan/bin to PATH and re-run"
fi

# ── 5. Semgrep ─────────────────────────────────────────────────────
if ! command -v semgrep >/dev/null 2>&1; then
  echo "↓ installing semgrep..."
  if command -v brew >/dev/null 2>&1; then
    brew install semgrep
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 install --user semgrep
  else
    echo "⚠ skipping semgrep — no brew or pip3 found"
  fi
fi
command -v semgrep >/dev/null 2>&1 && echo "✓ semgrep: $(semgrep --version)"

# ── 6. Stryker.NET (dotnet global tool) ────────────────────────────
if ! dotnet tool list -g 2>/dev/null | grep -q dotnet-stryker; then
  echo "↓ installing dotnet-stryker global tool..."
  dotnet tool install -g dotnet-stryker || true
fi
echo "✓ dotnet-stryker ready (dotnet tool run dotnet-stryker --help)"

# ── 7. CodeQL CLI (bash auto-install) ──────────────────────────────
# (CodeQL is heavy; skip automatic install. Document instead.)
cat <<'EOF'

ℹ CodeQL is heavy (~500 MB). Install manually if needed:
    brew install codeql            # macOS
    # or download https://github.com/github/codeql-action/releases

All other tools are installed. Run:
    cd $(pwd)
    java -cp tools/tla/tla2tools.jar tlc2.TLC docs/SmokeCheck
    java -jar tools/alloy/alloy.jar --help
    dotnet test

EOF
echo "✓ Done."
