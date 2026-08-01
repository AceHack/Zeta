#!/usr/bin/env bash
#
# tools/setup/common/agda-cubical.sh — materializes the cubical Agda proof
# lane: clones the agda/cubical library at a PINNED release tag matching the
# installed Agda, registers it in the Agda user libraries file, and verifies
# by typechecking the repo's `{-# OPTIONS --cubical #-}` hello module.
# Mirrors the shape of common/tlaps.sh (guards, inline docs, idempotency,
# verify step). Invoked via the from-agda-cubical realizer
# (src/Core.TypeScript/ace/setup-realizers/from-agda-cubical.ts) on the
# `realize_mechanisms --all` / `--post-mise` path of macos.sh + linux.sh —
# the same route the tlapm lane (from-opam-git) takes. Dev-container
# inherits via linux.sh.
#
# WHY system Agda + pinned cubical clone (not ghcup+cabal source build):
#   Soraya's routing spec (docs/letters/from-soraya-univalence-lane-routing.md)
#   offered ghcup → cabal-build Agda as the heavy path and named a lighter
#   path to evaluate at wiring. Evaluated 2026-07-08: brew ships Agda 2.8.0
#   BOTTLED (arm64 + x86_64) and Ubuntu apt ships agda on every supported
#   series — so the 30–90 min GHC/Agda source build buys nothing. The
#   cubical LIBRARY is the genuinely pinnable part: a git clone at an exact
#   release tag + commit, selected per installed-Agda version from
#   manifests/from-agda-cubical (the pin-pair table).
#
# SUPPLY-CHAIN PIN:
#   Each manifest row binds a cubical release tag to a commit sha. We clone
#   the tag (shallow) and ASSERT the checked-out HEAD equals the pinned sha —
#   a moved/re-pointed tag fails loudly (exact-pin discipline, mirroring the
#   tlapm commit pin and the v1.8.0 TLC-jar pin).
#
# NAMED DEBT (soft pin, not hidden):
#   - The Agda BINARY version floats with brew/apt (brew 2026-07-08: 2.8.0;
#     Ubuntu noble: 2.6.3). If it drifts to a version with no manifest row,
#     this script WARNS + exits 0 (lane unavailable, install stays green);
#     fix = add the matching cubical release row to the manifest.
#   - Different OSes can therefore run different cubical releases (mac v0.9,
#     noble CI v0.5) — acceptable for the Foundations.* surface the proof
#     leg uses; the N-oracle byte-lock does NOT run through Agda.
#   - install.ps1 / Windows parity deferred (tlaps/Isabelle precedent).
#
# IDEMPOTENT: safe to run N times = run-once effect. Clone is keyed by tag
# (re-run = sha assert only); libraries-file registration is
# rewrite-then-append (no duplicate lines, stale tag paths pruned); the
# verify typecheck reuses Agda's cached interface files after first run.
#
# FIRST-RUN COST (honest, measured): the verify typecheck's dependency chain
# is only Cubical.Core.Primitives + Cubical.Foundations.Prelude — the whole
# cold run (shallow clone + register + typecheck) measured 2.3 s on
# macOS-arm64 / Agda 2.8.0 / cubical v0.9 (2026-07-08); warm re-runs ~0.5 s.
# Deeper Cubical.* imports in future proof modules will pay a real
# interface-build cost on first check (that is where the minutes live).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-agda-cubical"

# Where pinned Agda libraries live (one dir per cubical tag, so a pin bump
# materializes fresh and stale tags are prunable).
AGDA_LIB_HOME="${ZETA_AGDA_LIB_DIR:-$HOME/.local/share/zeta/agda}"

# ── Guards (graceful skip, mirroring tlaps.sh's opam guard) ─────────
if ! command -v agda >/dev/null 2>&1; then
  echo "warning: agda not on PATH — cubical lane skipped."
  echo "  agda is declared in tools/setup/manifests/{brew,apt}; ensure the"
  echo "  system-package step ran before common/agda-cubical.sh (macOS slim-tier"
  echo "  hosts skip agda by design: manifests/brew gates it at tier=standard)."
  exit 0
fi

if [ ! -f "$MANIFEST" ]; then
  echo "warning: $MANIFEST missing — cubical lane skipped."
  exit 0
fi

# `agda --version` → "Agda version 2.8.0" (sometimes with a -suffix/commit tail).
AGDA_VERSION="$(agda --version 2>/dev/null | head -n1 | awk '{print $3}')"
if [ -z "$AGDA_VERSION" ]; then
  echo "warning: could not parse 'agda --version' output — cubical lane skipped."
  exit 0
fi
echo "✓ agda ${AGDA_VERSION} ($(command -v agda))"

# ── Pin-row selection (installed Agda ⇒ pinned cubical tag+commit) ──
# Manifest rows: cubical <url> <tag> agda=<version-prefix> commit=<sha>.
# Match: exact or dot-extension (agda=2.8 matches 2.8 and 2.8.0, NOT 2.81).
CUBICAL_URL="" CUBICAL_TAG="" CUBICAL_COMMIT=""
while IFS= read -r row; do
  url="$(printf '%s' "$row" | awk '{print $2}')"
  tag="$(printf '%s' "$row" | awk '{print $3}')"
  row_agda="$(printf '%s' "$row" | awk '{for(i=4;i<=NF;i++){if($i ~ /^agda=/){sub(/^agda=/,"",$i); print $i}}}')"
  row_commit="$(printf '%s' "$row" | awk '{for(i=4;i<=NF;i++){if($i ~ /^commit=/){sub(/^commit=/,"",$i); print $i}}}')"
  if [ -z "$url" ] || [ -z "$tag" ] || [ -z "$row_agda" ] || [ -z "$row_commit" ]; then
    continue
  fi
  case "$AGDA_VERSION" in
    "$row_agda" | "$row_agda".*)
      CUBICAL_URL="$url"; CUBICAL_TAG="$tag"; CUBICAL_COMMIT="$row_commit"
      break
      ;;
  esac
done < <(awk '
  { sub(/(^|[[:space:]])#.*$/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, "") }
  NF > 0 && $1 == "cubical" { print }
' "$MANIFEST")

if [ -z "$CUBICAL_TAG" ]; then
  echo "warning: no cubical pin row matches Agda ${AGDA_VERSION} — cubical lane skipped."
  echo "  This is the NAMED soft-pin drift: brew/apt moved Agda outside the pin-pair"
  echo "  table. Fix: add the matching cubical release row (tag= + commit= together)"
  echo "  to tools/setup/manifests/from-agda-cubical."
  exit 0
fi
echo "→ pin-pair: Agda ${AGDA_VERSION} ⇒ cubical ${CUBICAL_TAG} @ ${CUBICAL_COMMIT}"

# ── Clone at the pinned tag (idempotent, sha-asserted) ──────────────
CUBICAL_DIR="$AGDA_LIB_HOME/cubical-$CUBICAL_TAG"
mkdir -p "$AGDA_LIB_HOME"

current_head=""
if [ -d "$CUBICAL_DIR/.git" ]; then
  current_head="$(git -C "$CUBICAL_DIR" rev-parse HEAD 2>/dev/null || true)"
fi
if [ "$current_head" = "$CUBICAL_COMMIT" ]; then
  echo "✓ cubical ${CUBICAL_TAG} already at ${CUBICAL_COMMIT} (${CUBICAL_DIR})"
else
  if [ -e "$CUBICAL_DIR" ]; then
    echo "↻ ${CUBICAL_DIR} exists but is not at the pinned commit — re-materializing..."
    rm -rf "$CUBICAL_DIR"
  fi
  echo "↓ cloning agda/cubical ${CUBICAL_TAG} (shallow, tag-pinned)..."
  git clone --quiet --depth 1 --branch "$CUBICAL_TAG" "$CUBICAL_URL" "$CUBICAL_DIR"
  cloned_head="$(git -C "$CUBICAL_DIR" rev-parse HEAD)"
  if [ "$cloned_head" != "$CUBICAL_COMMIT" ]; then
    # Exact-pin assert: a re-pointed/moved tag is a supply-chain event, not
    # a drift to paper over. Fail loudly.
    echo "error: cubical tag ${CUBICAL_TAG} resolved to ${cloned_head}," >&2
    echo "       expected pinned commit ${CUBICAL_COMMIT} (manifests/from-agda-cubical)." >&2
    echo "       Refusing to register an unpinned library." >&2
    rm -rf "$CUBICAL_DIR"
    exit 1
  fi
  echo "✓ cubical ${CUBICAL_TAG} at ${CUBICAL_COMMIT}"
fi

CUBICAL_AGDA_LIB="$CUBICAL_DIR/cubical.agda-lib"
if [ ! -f "$CUBICAL_AGDA_LIB" ]; then
  echo "error: ${CUBICAL_AGDA_LIB} not found in the pinned clone — upstream layout changed?" >&2
  exit 1
fi

# ── Register in the Agda user libraries file (idempotent) ───────────
# Agda ≥ 2.6.4.3 resolves its app dir per XDG (with legacy ~/.agda honored);
# `agda --print-agda-app-dir` reports the dir THIS agda actually reads.
# Older Agda (e.g. Ubuntu noble's 2.6.3) lacks the flag and reads ~/.agda.
AGDA_APP_DIR="$(agda --print-agda-app-dir 2>/dev/null | head -n1 || true)"
# Older Agda (2.6.3, Ubuntu noble) prints "Error: Unrecognized option: …" to
# STDOUT, so emptiness is not a sufficient guard — the captured value must be
# an absolute path or we register into a garbage location and the verify
# typecheck fails with "Installed libraries: (none)" (gate-red 2026-07-31).
case "$AGDA_APP_DIR" in
  /*) : ;;
  *) AGDA_APP_DIR="$HOME/.agda" ;;
esac
mkdir -p "$AGDA_APP_DIR"
LIBRARIES_FILE="$AGDA_APP_DIR/libraries"
touch "$LIBRARIES_FILE"

if grep -qxF "$CUBICAL_AGDA_LIB" "$LIBRARIES_FILE"; then
  echo "✓ cubical already registered in ${LIBRARIES_FILE}"
else
  # Prune any OTHER pinned cubical tag we previously registered (two
  # registered libraries both named `cubical` would be ambiguous to Agda),
  # then append the current pin. Rewrite-then-append keeps this idempotent.
  tmp_file="$(mktemp)"
  grep -v "^$AGDA_LIB_HOME/cubical-.*/cubical\.agda-lib$" "$LIBRARIES_FILE" > "$tmp_file" || true
  printf '%s\n' "$CUBICAL_AGDA_LIB" >> "$tmp_file"
  mv "$tmp_file" "$LIBRARIES_FILE"
  echo "✓ registered ${CUBICAL_AGDA_LIB} in ${LIBRARIES_FILE}"
fi

# ── Verify: typecheck the --cubical hello module ────────────────────
# src/Core.Agda/ProvidedView/Hello.agda is `{-# OPTIONS --cubical #-}` and
# imports Cubical.Foundations.Prelude, so this proves binary + library +
# registration end-to-end. First run per machine/tag builds the Prelude
# chain's interface files (measured 2.3 s cold on macOS-arm64/v0.9); later
# runs reuse the _build cache.
HELLO_DIR="$REPO_ROOT/src/Core.Agda"
if [ -f "$HELLO_DIR/ProvidedView/Hello.agda" ]; then
  echo "→ verifying: agda typecheck of src/Core.Agda/ProvidedView/Hello.agda"
  echo "  (first run builds the Cubical.Foundations.Prelude interface cache)"
  if (cd "$HELLO_DIR" && agda ProvidedView/Hello.agda); then
    echo "✓ cubical lane verified: --cubical module importing Cubical.Foundations.Prelude typechecks"
  else
    echo "error: cubical verify typecheck FAILED — lane is mis-wired (agda ${AGDA_VERSION}, cubical ${CUBICAL_TAG})." >&2
    exit 1
  fi
else
  echo "warning: ${HELLO_DIR}/ProvidedView/Hello.agda missing — verify step skipped."
fi
