#!/usr/bin/env bash
# build-book.sh — assemble the shareable book draft and build an EPUB (iPhone/e-reader).
#
# Reproducible pipeline for "You, Born at the Hinge". Consumed by the maintainer to
# produce a proofreading draft (English, or a translated source dir via --src).
# pandoc is declared in tools/setup/manifests/{brew,apt} (all OS shields).
#
# ── CONSENT SCOPE (load-bearing — do NOT widen without the per-file gates) ─────
# The book directory holds THREE kinds of file. This script ships only the first,
# and by default only the chapters + outline:
#   ✅ SHAREABLE  : OUTLINE.md, ch-NN-*.md  (the book proper; least sensitive)
#   ⚠ COMPANIONS : ALL-CAPS-prefixed essays — carry third-party material (Addison,
#                  parents, etc.); included ONLY with --with-companions, because
#                  sending them to an outside reader touches those people's
#                  pre-read gates (see CONSENT-LEDGER.md). Off by default.
#   ⛔ NEVER      : RAW-*.md (staging: CSAM allegation, self-disclosures, held
#                  sister material), CONSENT-LEDGER.md, INTAKE-LOG.md, RESUME.md,
#                  READINESS.md (internal ops). Hard-excluded below, always.
# See docs/books/you-born-at-the-hinge/CONSENT-LEDGER.md for the per-person gates.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOOK_DIR="${REPO_ROOT}/docs/books/you-born-at-the-hinge"
OUT_DIR="${REPO_ROOT}/dist/book"      # gitignored — build output, never committed
SRC_DIR="${BOOK_DIR}"                 # override with --src for a translated source
LANG_TAG="en"
WITH_COMPANIONS=0
TITLE="You, Born at the Hinge"
AUTHOR="Aaron Stainback"

while [ $# -gt 0 ]; do
  case "$1" in
    --src) SRC_DIR="$2"; shift 2 ;;                 # a dir of translated .md (same filenames)
    --lang) LANG_TAG="$2"; shift 2 ;;               # e.g. zh-Hans (Mandarin, Simplified)
    --with-companions) WITH_COMPANIONS=1; shift ;;  # ⚠ see CONSENT SCOPE above
    --title) TITLE="$2"; shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v pandoc >/dev/null 2>&1 || { echo "pandoc not found — run tools/setup (manifests/{brew,apt} declare it)"; exit 1; }
mkdir -p "$OUT_DIR"
ASSEMBLED="${OUT_DIR}/book.${LANG_TAG}.md"

# ── assemble in reading order: OUTLINE, then chapters, then (optionally) companions
: > "$ASSEMBLED"
add() { [ -f "$1" ] && { cat "$1" >> "$ASSEMBLED"; printf '\n\n' >> "$ASSEMBLED"; }; }

add "${SRC_DIR}/OUTLINE.md"
for ch in "${SRC_DIR}"/ch-*.md; do add "$ch"; done

if [ "$WITH_COMPANIONS" -eq 1 ]; then
  echo "⚠ including companions — confirm the third-party pre-read gates (CONSENT-LEDGER)." >&2
  # ALL-CAPS-prefixed companions only; hard-exclude ops docs + RAWs (belt and suspenders).
  for comp in "${SRC_DIR}"/[A-Z]*.md; do
    base="$(basename "$comp")"
    case "$base" in
      RAW-*|CONSENT-LEDGER.md|INTAKE-LOG.md|RESUME.md|READINESS.md|OUTLINE.md) continue ;;
    esac
    add "$comp"
  done
fi

# ── build EPUB (iPhone Books / any e-reader) ──────────────────────────────────
EPUB="${OUT_DIR}/you-born-at-the-hinge.${LANG_TAG}.epub"
pandoc "$ASSEMBLED" -o "$EPUB" \
  --metadata title="$TITLE" --metadata author="$AUTHOR" --metadata lang="$LANG_TAG" \
  --toc --toc-depth=1 --split-level=1

echo "✅ assembled: $ASSEMBLED"
echo "✅ EPUB:      $EPUB"
echo
echo "Translation: this script does not translate. Produce a translated copy of the"
echo "SHAREABLE files into a dir (same filenames), then re-run with --src <dir> --lang zh-Hans."
echo "Full-book memoir translation should be reviewed before external sharing (meaning-drift)."
