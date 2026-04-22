#!/usr/bin/env bash
#
# tools/hygiene/audit-missing-prevention-layers.sh — meta-hygiene.
#
# For every row in `docs/FACTORY-HYGIENE.md`, ask: does this row
# have a **prevention layer** (author-time / commit-time /
# trigger-time mechanism that blocks or warns the violation BEFORE
# it materialises), or is it **detection-only** (a cadenced audit
# that catches the violation after the fact)?
#
# A row that is detection-only without a principled reason is a
# gap: a prevention layer COULD be built and WOULD reduce the
# factory's reactive-cost. A row that is justifiably detection-only
# (e.g., cadence-history — you can only log AFTER a fire happens)
# is labelled as such and excluded from the gap list.
#
# This script doesn't compute the classification itself — that
# requires domain judgement per row. It produces the empty matrix
# for a human or agent to fill in, and diffs against the previous
# fill to surface newly-added rows that haven't been classified yet.
#
# Ships the detection side of FACTORY-HYGIENE row #47 (missing-
# prevention-layer meta-audit). The "prevention" side of THIS row
# is the factory-wide discipline that every new hygiene row
# landing in `docs/FACTORY-HYGIENE.md` should declare its
# prevention layer (or explicit detection-only rationale) in the
# "Checks / enforces" or "Durable output" column at author-time.
#
# Usage:
#   tools/hygiene/audit-missing-prevention-layers.sh [--classify FILE]
#
# With no arg, prints the list of every hygiene row and its
# currently-filled classification (read from
# `docs/hygiene-history/prevention-layer-classification.md` if
# present, blank otherwise). With `--classify FILE`, uses the
# given classification file instead.
#
# Exit codes:
#   0   all rows have a classification; no gap rows
#   1   usage error
#   2   one or more rows lack a classification OR are classified
#       as "detection-only (gap)"
#
# Self-referential note: this script is bash — exception label
# "bash scaffolding". Queued for bun+TS migration with the other
# tools/hygiene/ scripts.

set -euo pipefail

CLASSIFICATION_FILE="docs/hygiene-history/prevention-layer-classification.md"

case "${1:-}" in
  --classify)
    CLASSIFICATION_FILE="${2:-}"
    if [[ -z "$CLASSIFICATION_FILE" ]]; then
      echo "error: --classify requires a file path" >&2
      exit 1
    fi
    ;;
  -h|--help)
    sed -n '3,42p' "$0"
    exit 0
    ;;
  "") ;;
  *)
    echo "error: unknown arg: $1" >&2
    exit 1
    ;;
esac

HYGIENE_FILE="docs/FACTORY-HYGIENE.md"
if [[ ! -f "$HYGIENE_FILE" ]]; then
  echo "error: $HYGIENE_FILE not found" >&2
  exit 1
fi

# Extract row numbers + titles from the main hygiene table. The
# rows start with `| NN | <title> | ...`. Skip the header divider
# row and the adopter-facing projection table rows. Portable
# while-read form for bash 3.2.
ROWS=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  ROWS+=("$line")
done < <(awk -F'|' '
  /^## Ships to project-under-construction/ { in_main = 0 }
  /^## The list/ { in_main = 1; next }
  in_main && /^\| *[0-9]+ *\|/ {
    num = $2; gsub(/ /, "", num)
    title = $3
    sub(/^ +/, "", title); sub(/ +$/, "", title)
    print num "\t" title
  }
' "$HYGIENE_FILE")

# Load any existing classification into parallel arrays (bash 3.2
# does not support `declare -A`). Lookup is linear but the row
# count is small enough not to matter.
CLASSIFIED_NUMS=()
CLASSIFIED_LABELS=()
if [[ -f "$CLASSIFICATION_FILE" ]]; then
  while IFS=$'\t' read -r num label; do
    [[ -z "$num" ]] && continue
    CLASSIFIED_NUMS+=("$num")
    CLASSIFIED_LABELS+=("$label")
  done < <(awk -F'|' '
    /^\| *[0-9]+ *\|/ {
      num = $2; gsub(/ /, "", num)
      label = $4
      sub(/^ +/, "", label); sub(/ +$/, "", label)
      print num "\t" label
    }
  ' "$CLASSIFICATION_FILE")
fi

# lookup_label NUM -> prints the label for the given row number,
# or empty if no classification found.
lookup_label() {
  local want="$1" i
  for i in "${!CLASSIFIED_NUMS[@]}"; do
    if [[ "${CLASSIFIED_NUMS[$i]}" == "$want" ]]; then
      printf '%s' "${CLASSIFIED_LABELS[$i]}"
      return
    fi
  done
}

UNCLASSIFIED=()
GAPS=()
OK=()

echo "# Missing prevention-layer audit"
echo
echo "Run: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Classification source: $CLASSIFICATION_FILE"
echo
echo "## Matrix"
echo
echo "| Row # | Hygiene item | Classification |"
echo "|---|---|---|"
for r in "${ROWS[@]}"; do
  num=$(echo "$r" | cut -f1)
  title=$(echo "$r" | cut -f2)
  label=$(lookup_label "$num")

  if [[ -z "$label" ]]; then
    UNCLASSIFIED+=("$num — $title")
    label="**unclassified**"
  elif [[ "$label" == *"detection-only (gap)"* ]]; then
    GAPS+=("$num — $title")
  else
    OK+=("$num")
  fi

  # Truncate long titles for table readability.
  short_title=$(echo "$title" | cut -c1-80)
  echo "| $num | $short_title | $label |"
done

echo
echo "## Summary"
echo
printf -- '- prevention-bearing or detection-only-justified: %d\n' "${#OK[@]}"
printf -- '- detection-only-gap (prevention could exist but does not): %d\n' "${#GAPS[@]}"
printf -- '- unclassified (no entry in classification file): %d\n' "${#UNCLASSIFIED[@]}"

if [[ ${#UNCLASSIFIED[@]} -gt 0 ]]; then
  echo
  echo "## Unclassified rows (fill in classification file)"
  printf -- '- %s\n' "${UNCLASSIFIED[@]}"
fi

if [[ ${#GAPS[@]} -gt 0 ]]; then
  echo
  echo "## Gap rows (prevention layer candidate)"
  printf -- '- %s\n' "${GAPS[@]}"
  echo
  echo "Each gap row is a candidate for an author-time / commit-time /"
  echo "trigger-time prevention layer. Design ROI — prevention is"
  echo "cheaper than detection + fix per violation × violation-rate."
fi

if [[ ${#UNCLASSIFIED[@]} -gt 0 || ${#GAPS[@]} -gt 0 ]]; then
  exit 2
fi
exit 0
