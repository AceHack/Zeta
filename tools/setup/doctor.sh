#!/usr/bin/env bash
#
# tools/setup/doctor.sh — health check for Zeta's three-way-parity
# toolchain. Reports drift between what `install.sh` installed and
# what's actually on the machine. Read-only; never mutates.
#
# Usage:
#   tools/setup/doctor.sh           # walk checks; exit 0 iff all OK
#   tools/setup/doctor.sh --json    # machine-readable output (future)
#
# Born round 32 after Aaron noted his jars ended up in random
# locations before install.sh existed. The fix is to run
# `tools/setup/install.sh` (which canonizes them at
# tools/tla/tla2tools.jar + tools/alloy/alloy.jar); this doctor
# script tells you whether that's actually happened, and where
# drift exists.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

OK=0
WARN=0
FAIL=0

pass() { echo "  ✓ $1"; OK=$((OK+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Zeta toolchain doctor (round-32) ==="
echo "Repo root: $REPO_ROOT"
echo

# ── 1. Required executables on PATH ────────────────────────────────
echo "[1/6] Required executables on PATH"
for cmd in dotnet java git curl mise; do
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "$cmd: $(command -v "$cmd")"
  else
    fail "$cmd not on PATH — run tools/setup/install.sh"
  fi
done
echo

# ── 2. Verifier jars at canonical locations ─────────────────────────
echo "[2/6] Verifier jars (canonical locations per manifest)"
for jar in "tools/tla/tla2tools.jar" "tools/alloy/alloy.jar"; do
  if [ -f "$REPO_ROOT/$jar" ]; then
    size=$(stat -f%z "$REPO_ROOT/$jar" 2>/dev/null || stat -c%s "$REPO_ROOT/$jar" 2>/dev/null || echo 0)
    if [ "$size" -lt 100000 ]; then
      warn "$jar exists but is suspiciously small (${size} B) — may be a partial download"
    else
      pass "$jar ($(( size / 1024 / 1024 )) MB)"
    fi
  else
    fail "$jar missing — run tools/setup/install.sh (or ace-realize for just the jars)"
  fi
done
echo

# ── 3. Drift check: jars outside canonical locations? ───────────────
echo "[3/6] Jar-location drift (jars outside canonical tools/)"
DRIFT_FOUND=0
for stray in $(find "$REPO_ROOT" \
                    -name "tla2tools*.jar" -o -name "alloy*.jar" \
                    2>/dev/null \
                    | grep -vE "/tools/(tla|alloy)/" \
                    | grep -vE "/\.git/"); do
  warn "jar at non-canonical location: ${stray#"$REPO_ROOT"/} (move to tools/tla/ or tools/alloy/ or delete)"
  DRIFT_FOUND=1
done
if [ "$DRIFT_FOUND" -eq 0 ]; then
  pass "no stray jars inside repo"
fi

# Also check the user's HOME for jars that install.sh didn't put there
# but that might have accumulated during manual testing. We don't fail
# on these — Aaron's laptop has them from pre-install.sh days — but we
# report so the user can tidy up.
HOME_DRIFT=0
for stray in $(find "$HOME" -maxdepth 4 \
                    \( -name "tla2tools*.jar" -o -name "org.alloytools.alloy*.jar" -o -name "alloy*.jar" \) \
                    2>/dev/null \
                    | grep -vE "\.mise/|\.local/share/mise/" \
                    | head -5); do
  warn "jar outside repo (laptop drift): $stray (safe to delete once tools/ has canonical copies)"
  HOME_DRIFT=$((HOME_DRIFT+1))
done
if [ "$HOME_DRIFT" -eq 0 ]; then
  pass "no stray jars in \$HOME"
fi
echo

# ── 3b. TLAPS (tlapm) proof manager — optional, opam source-build ────
# Formal-verification rung 3. tlapm is built from source via opam
# (mechanisms/from-opam-git.sh) only on a full install (ZETA_INSTALL_FULL=1) — it
# is heavy and not part of the minimal toolchain. So its ABSENCE is a
# WARN, never a FAIL: a minimal install legitimately lacks it. We probe
# both PATH and the dedicated opam build switch.
echo "[3b/6] TLAPS (tlapm) — optional formal-verification rung 3"
TLAPM_VER=""
if command -v tlapm >/dev/null 2>&1; then
  TLAPM_VER="$(tlapm --version 2>&1 | head -n1)"
elif command -v opam >/dev/null 2>&1 \
     && opam exec --switch=tlaps-build -- tlapm --version >/dev/null 2>&1; then
  TLAPM_VER="$(opam exec --switch=tlaps-build -- tlapm --version 2>&1 | head -n1) (opam switch tlaps-build)"
fi
if [ -n "$TLAPM_VER" ]; then
  pass "tlapm: $TLAPM_VER"
else
  warn "tlapm not found — optional; build with ZETA_INSTALL_FULL=1 tools/setup/install.sh"
fi
echo

# ── 3c. Cubical Agda proof lane — optional, pin-paired library clone ─
# Provided-view univalence obligation lane (081KX1VE4G808QG0R003DCK3GV).
# The agda binary comes from manifests/{brew,apt} (brew gates it at
# tier=standard), and common/agda-cubical.sh registers the pinned
# agda/cubical release in the Agda user libraries file. Both are optional:
# a slim host legitimately lacks them, so absence is a WARN, never a FAIL.
echo "[3c/6] Cubical Agda proof lane — optional formal-verification"
if command -v agda >/dev/null 2>&1; then
  pass "agda: $(agda --version 2>&1 | head -n1)"
  AGDA_APP_DIR="$(agda --print-agda-app-dir 2>/dev/null | head -n1 || true)"
  [ -z "$AGDA_APP_DIR" ] && AGDA_APP_DIR="$HOME/.agda"
  if [ -f "$AGDA_APP_DIR/libraries" ] \
     && grep -q "cubical\.agda-lib$" "$AGDA_APP_DIR/libraries" 2>/dev/null; then
    pass "cubical registered: $(grep "cubical\.agda-lib$" "$AGDA_APP_DIR/libraries" | head -n1)"
  else
    warn "cubical library not registered in $AGDA_APP_DIR/libraries — run tools/setup/common/agda-cubical.sh (or tools/setup/install.sh)"
  fi
else
  warn "agda not found — optional; installed by tools/setup/install.sh via manifests/{brew,apt} (brew: tier=standard hosts)"
fi
echo

# ── 4. Mise runtimes match .mise.toml ───────────────────────────────
echo "[4/6] mise runtimes match .mise.toml"
if command -v mise >/dev/null 2>&1 && [ -f .mise.toml ]; then
  if mise current >/dev/null 2>&1; then
    while IFS= read -r line; do
      pass "mise: $line"
    done < <(mise current 2>&1)
  else
    warn "mise current errored — try: mise install (or tools/setup/common/mise.sh)"
  fi
else
  warn "mise or .mise.toml missing — skipping"
fi
echo

# ── 5. Managed shellenv present ─────────────────────────────────────
echo "[5/6] Managed shellenv"
ZETA_ENV_FILE="$HOME/.config/zeta/shellenv.sh"
if [ -f "$ZETA_ENV_FILE" ]; then
  pass "shellenv at $ZETA_ENV_FILE"
else
  warn "shellenv missing — run tools/setup/common/shellenv.sh"
fi
echo

# ── 6. Repo structure: no unexpected empty directories ──────────────
# Born round 35. An empty directory in the tracked tree is almost
# always a forgotten artefact (an agent-created skill folder without a
# SKILL.md, a research folder with no report). Full check is in
# `tools/lint/no-empty-dirs.ts`; doctor just runs it and reports.
echo "[6/6] Repo structure: no unexpected empty directories"
if command -v bun >/dev/null 2>&1 && [ -f "$REPO_ROOT/tools/lint/no-empty-dirs.ts" ]; then
  if bun "$REPO_ROOT/tools/lint/no-empty-dirs.ts" >/dev/null 2>&1; then
    pass "no-empty-dirs: OK"
  else
    # Re-run in list mode for actionable output.
    bun "$REPO_ROOT/tools/lint/no-empty-dirs.ts" --list \
      | sed 's/^/    /'
    fail "no-empty-dirs: unexpected empty directories — see list above"
  fi
else
  warn "bun or tools/lint/no-empty-dirs.ts unavailable — skipping"
fi
echo

# ── Summary ─────────────────────────────────────────────────────────
echo "=== Summary ==="
echo "✓ ok: $OK   ⚠ warn: $WARN   ✗ fail: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo
  echo "Fix suggestion: tools/setup/install.sh"
  exit 1
fi
if [ "$WARN" -gt 0 ]; then
  echo
  echo "Warnings don't fail the doctor; review + resolve at your cadence."
fi
