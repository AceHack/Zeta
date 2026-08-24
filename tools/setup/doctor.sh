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
# locations before install.sh existed. Since #8053 the canonical
# jars are COMMITTED to git at src/Core.TLA/tla2tools.jar and
# src/Core.Alloy/alloy.jar -- the paths every runner loads -- so a
# clone already has them and no install step fetches them. This
# doctor checks the committed jars are intact and flags copies
# elsewhere, which are the drift (081M001E114087G0R001AZF4KD).

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
echo "[2/6] Verifier jars (committed at the paths the runners load)"
for jar in "src/Core.TLA/tla2tools.jar" "src/Core.Alloy/alloy.jar"; do
  if [ -f "$REPO_ROOT/$jar" ]; then
    size=$(stat -f%z "$REPO_ROOT/$jar" 2>/dev/null || stat -c%s "$REPO_ROOT/$jar" 2>/dev/null || echo 0)
    if [ "$size" -lt 100000 ]; then
      warn "$jar exists but is suspiciously small (${size} B) — likely a broken checkout or an LFS-style placeholder"
    else
      pass "$jar ($(( size / 1024 / 1024 )) MB)"
    fi
  else
    fail "$jar missing — it is committed to git; restore with: git checkout -- $jar"
  fi
done

# Same derived-provenance check CI runs, so a laptop sees the identical
# verdict (three-way parity, GOVERNANCE §24). Reads the jars, no JVM.
if command -v bun >/dev/null 2>&1; then
  PROV="$REPO_ROOT/src/Core.TypeScript/hygiene/lint-verifier-jar-provenance.ts"
  if bun "$PROV" >/dev/null 2>&1; then
    pass "jar provenance: docs match the committed jars"
  else
    fail "jar provenance drift — run: bun $PROV"
  fi
else
  warn "bun unavailable — skipping jar provenance check"
fi
echo

# ── 3. Drift check: unused copies of the verifier jars ──────────────
echo "[3/6] Jar-location drift (jars outside the committed src/Core.* paths)"
DRIFT_FOUND=0
for stray in $(find "$REPO_ROOT" \
                    -name "tla2tools*.jar" -o -name "alloy*.jar" \
                    2>/dev/null \
                    | grep -vE "/src/Core\.(TLA|Alloy)/" \
                    | grep -vE "/\.git/"); do
  warn "stray verifier jar: ${stray#"$REPO_ROOT"/} -- the runners load the committed src/Core.TLA and src/Core.Alloy jars; this copy is unused (safe to delete)"
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
if command -v bun >/dev/null 2>&1 && [ -f "$REPO_ROOT/src/Core.TypeScript/lint/no-empty-dirs.ts" ]; then
  if bun "$REPO_ROOT/src/Core.TypeScript/lint/no-empty-dirs.ts" >/dev/null 2>&1; then
    pass "no-empty-dirs: OK"
  else
    # Re-run in list mode for actionable output.
    bun "$REPO_ROOT/src/Core.TypeScript/lint/no-empty-dirs.ts" --list \
      | sed 's/^/    /'
    fail "no-empty-dirs: unexpected empty directories — see list above"
  fi
else
  warn "bun or src/Core.TypeScript/lint/no-empty-dirs.ts unavailable — skipping"
fi
echo

# ── File-descriptor headroom for parallel builds ─────────────────────
# A 3-way parallel build died with "Too many open files IN SYSTEM" — the system-wide
# table, not `ulimit -n` (which was already 1048576 and irrelevant to that failure).
if [ -r "$(dirname "$0")/common/fd-limits.sh" ]; then
  # shellcheck source=common/fd-limits.sh
  # shellcheck disable=SC1091  # CI runs shellcheck without -x, so the source cannot be followed
  . "$(dirname "$0")/common/fd-limits.sh"
  _fd_cur=$(zeta_fd_system_max)
  if [ -z "$_fd_cur" ]; then
    warn "fd-limits: cannot read the system-wide file-descriptor max on this platform"
  elif zeta_fd_headroom_ok; then
    pass "fd-limits: system-wide max is $_fd_cur (>= $ZETA_FD_WANT_SYSTEM)"
  else
    warn "fd-limits: system-wide max is $_fd_cur, below $ZETA_FD_WANT_SYSTEM — parallel builds can die with 'Too many open files in system'"
    echo "    Raising it is a CEILING change, not a reservation — it costs nothing until used."
    echo "    Apply by hand (needs sudo; this script deliberately does not change system settings):"
    zeta_fd_remedy | sed 's/^/  /'
  fi
  echo
fi

# ── Touch ID for sudo: configured DURABLY? (macOS only) ─────────────
# Same shape as the fd-limits block above: read-only, reports, never applies.
#
# The failure this catches is a silent one. `pam_tid.so` added to
# /etc/pam.d/sudo works until the next macOS update REPLACES that file, at which
# point sudo drops to password-only with no announcement. Apple ships
# /etc/pam.d/sudo_local.template so the customisation can survive; the verifier
# checks that the durable file -- not the fragile edit -- is what is in force.
#
# It raises NO sudo or Touch ID prompt: it reads configuration and never
# exercises the gate. That matters because an operator trained to approve
# prompts reflexively is the weakness the biometric gate exists to avoid.
if [ "$(uname -s)" = "Darwin" ]; then
  echo "[extra] Touch ID for sudo (durable across OS updates)"
  if command -v bun >/dev/null 2>&1; then
    # `set -e` is on: a bare `var=$(cmd)` whose cmd exits non-zero would abort
    # the whole doctor. Capture the status directly on the same statement.
    touchid_rc=0
    touchid_out="$(bun "$(dirname "$0")/touchid-sudo.ts" --verify 2>&1)" || touchid_rc=$?
    if [ "$touchid_rc" -eq 0 ]; then
      pass "Touch ID sudo is configured in /etc/pam.d/sudo_local (survives OS updates)"
    else
      warn "Touch ID sudo is NOT durably configured"
      # Indent each line without `sed s/^/.../` (SC2001): read the captured
      # output line by line so the whole report stays attributable to this check.
      while IFS= read -r _touchid_line; do
        echo "    $_touchid_line"
      done <<EOF_TOUCHID
$touchid_out
EOF_TOUCHID
      echo "    Fix (needs sudo once; this script deliberately does not change system settings):"
      echo "      bun tools/setup/touchid-sudo.ts --apply"
    fi
  else
    warn "bun not on PATH — cannot check Touch ID sudo configuration"
  fi
  echo
fi

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
