#!/usr/bin/env bash
# tools/hygiene/counterweight-audit.sh
#
# Cadenced counterweight-memory audit (Otto-278).
#
# Memory-only counterweights are leaky without a cadenced
# audit that FORCES re-reading the memories + checks for
# rule-drift. "I'll remember to read the memory" is prayer.
# Otto-276 drifted within hours; Otto-277 re-tightened;
# Otto-278 named the gap.
#
# This is Phase 1: the shell tool. Phase 2 is the
# `.claude/skills/counterweight-audit/SKILL.md` that invokes
# this tool and prompts the agent with the emitted questions.
#
# Human-maintainer quote (autonomous-loop 2026-04-24, preserved
# in the originating memory file):
#
#   "memory is enough assuming you have a inspect memory for
#    missing balance and lessions on a cadence it's probably
#    enough, but you forget often when it's just in memory"
#
# What this tool does:
#   1. Enumerate counterweight memory files. Default glob:
#      `memory/*otto_*.md` (matches `feedback_*otto_*.md`,
#      `project_*otto_*.md`, etc. — any memory file whose
#      name carries the Otto-NNN convention).
#   2. For each file, extract:
#      - the Otto-NNN identifier from the filename
#      - the `name:` field from YAML frontmatter (rule summary)
#   3. Emit audit questions per counterweight.
#
# Quote extraction from the file body (the "### The rule" and
# maintainer-quote sections) is deliberately NOT automated
# here — the audit's point is forcing the agent to open each
# file and read it. Auto-extracting the quote into the audit
# output would let the agent skim the questions without
# opening the file, which is exactly the drift this tool
# exists to counter.
#
# What this tool does NOT do:
#   - Read an agent-behaviour log (no such log exists yet; the
#     agent self-scores).
#   - Automatically update counterweight memories. The
#     re-read IS the operation; human + agent judgement owns
#     the "did I drift" decision.
#   - Run on a schedule. Cadencing happens via
#     (a) autonomous-loop tick-open hook integration (Phase
#         3, separate BACKLOG row),
#     (b) on-demand invocation by a human or agent.
#
# Bash 3.2 compatible (GOVERNANCE §24 four-way-parity —
# macOS ships bash 3.2; no assoc arrays or mapfile here).
#
# Usage:
#   tools/hygiene/counterweight-audit.sh [--cadence quick|medium|long] [--count N]
#
#   --cadence quick   Top N most recently-modified counterweights only (default).
#   --cadence medium  Last 10 counterweights.
#   --cadence long    All counterweights, full re-read.
#   --count N         Override the per-cadence count (default 3 for quick,
#                     10 for medium, unbounded for long).
#
# Exit codes:
#   0  normal completion (clean or drift-flagged — both reported via
#      stdout; the tool doesn't pass/fail on content).
#   2  usage error (unknown flag, missing value, non-integer count,
#      invalid cadence, or memory/ dir not found).

set -euo pipefail

# -------- arg parsing -----------------------------------------------------

CADENCE="quick"
COUNT=""

usage_error() {
  echo "error: $1" >&2
  echo "run with --help for usage" >&2
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --cadence)
      # Guard against missing value: `$2` must be present or
      # `shift 2` trips under set -e.
      [ $# -ge 2 ] || usage_error "--cadence requires a value"
      CADENCE="$2"
      shift 2
      ;;
    --count)
      [ $# -ge 2 ] || usage_error "--count requires a value"
      COUNT="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '/^# Usage:/,/^$/p' "$0" | sed 's|^# \{0,1\}||'
      exit 0
      ;;
    *)
      usage_error "unknown argument '$1'"
      ;;
  esac
done

case "$CADENCE" in
  quick)  DEFAULT_COUNT=3 ;;
  medium) DEFAULT_COUNT=10 ;;
  long)   DEFAULT_COUNT=0 ;;  # 0 = unbounded
  *)
    usage_error "--cadence must be quick|medium|long (got '$CADENCE')"
    ;;
esac

if [ -z "$COUNT" ]; then
  COUNT="$DEFAULT_COUNT"
fi

# Validate COUNT as a non-negative integer before numeric
# comparisons. Rejects empty string (via regex anchor) and
# any non-digit content.
case "$COUNT" in
  ''|*[!0-9]*)
    usage_error "--count must be a non-negative integer (got '$COUNT')"
    ;;
esac

# -------- discover counterweight files ------------------------------------

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MEMORY_DIR="${REPO_ROOT}/memory"

if [ ! -d "$MEMORY_DIR" ]; then
  usage_error "memory/ not found at $MEMORY_DIR (run from a Zeta checkout)"
fi

# Counterweight memories match `*otto_*.md` by convention.
# Collect path + mtime, sort newest-first, then take COUNT
# (or all if COUNT == 0).
TMP="$(mktemp -t zeta-counterweight-audit.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

# Portable stat: BSD (macOS) uses `stat -f "%m"`; GNU (Linux) uses
# `stat -c "%Y"`. Probe once, set a variable that controls which
# branch the loop takes — no eval on filename-sourced strings.
if stat -f "%m" "$MEMORY_DIR" >/dev/null 2>&1; then
  STAT_FLAVOR="bsd"
else
  STAT_FLAVOR="gnu"
fi

# Branch on STAT_FLAVOR, passing "$f" as a proper argument.
# Never pass the filename through `eval` — a crafted filename
# containing `$(...)` could otherwise be re-parsed as shell.
# shellcheck disable=SC2044
for f in "$MEMORY_DIR"/*otto_*.md; do
  [ -f "$f" ] || continue  # glob didn't match
  if [ "$STAT_FLAVOR" = "bsd" ]; then
    mtime=$(stat -f "%m" "$f")
  else
    mtime=$(stat -c "%Y" "$f")
  fi
  printf '%s\t%s\n' "$mtime" "$f"
done | sort -rn > "$TMP"

TOTAL=$(wc -l < "$TMP" | tr -d ' ')
if [ "$COUNT" -gt 0 ] && [ "$COUNT" -lt "$TOTAL" ]; then
  SHOWN="$COUNT"
else
  SHOWN="$TOTAL"
fi

# -------- emit header -----------------------------------------------------

echo "# Counterweight audit — $CADENCE cadence"
echo ""
echo "Reading $SHOWN of $TOTAL counterweight memories under"
echo "\`memory/*otto_*.md\` (newest first). For each one, open"
echo "the file and read the rule body + maintainer quote, then"
echo "answer the per-counterweight audit questions below."
echo ""
echo "_Tool: \`tools/hygiene/counterweight-audit.sh\` (Otto-278"
echo "cadenced-inspect Phase 1). Agent self-scores; no automatic"
echo "drift detection — the point is forcing the re-read._"
echo ""

# -------- extract + emit per-counterweight -------------------------------

i=0
while IFS="$(printf '\t')" read -r _mtime file; do
  i=$((i+1))
  if [ "$COUNT" -gt 0 ] && [ "$i" -gt "$COUNT" ]; then
    break
  fi

  # Extract Otto-NNN from filename like
  # `feedback_*_otto_NNN_YYYY_MM_DD.md`.
  base="$(basename "$file")"
  otto_id="$(printf '%s' "$base" | sed -n 's/.*otto_\([0-9][0-9]*\).*/Otto-\1/p')"
  [ -z "$otto_id" ] && otto_id="(no Otto-ID in filename)"

  # Extract the `name:` frontmatter field (first line starting
  # with `name:` inside the YAML fence). Body content
  # (direct maintainer quote, "### The rule" section) is
  # deliberately NOT auto-extracted — see header for why.
  name_line="$(awk '
    /^---[[:space:]]*$/ { fence = !fence; next }
    fence && /^name:/ {
      sub(/^name:[[:space:]]*/, "")
      print
      exit
    }
  ' "$file")"
  [ -z "$name_line" ] && name_line="(no name field)"

  rel="${file#"$REPO_ROOT"/}"

  echo "---"
  echo ""
  echo "## $otto_id — [\`$rel\`]($rel)"
  echo ""
  echo "**Rule (from \`name:\`):** $name_line"
  echo ""
  echo "**Audit questions:**"
  echo ""
  echo "1. In the last N ticks, did I exhibit the drift"
  echo "   this counter was filed for?"
  echo "2. If yes: is the right move to tighten THIS"
  echo "   counterweight (edit the memory), file a NEW"
  echo "   tighter counterweight (like Otto-276 → Otto-277),"
  echo "   or escalate to a skill / BP rule?"
  echo "3. Is the counter still needed at this cadence,"
  echo "   or can maintenance cadence stretch?"
  echo ""
done < "$TMP"

# -------- emit footer -----------------------------------------------------

echo "---"
echo ""
echo "## After the re-read"
echo ""
echo "Summary to log (if any drift was found):"
echo ""
echo "- Which counterweights drifted? (list Otto IDs)"
echo "- What's the next cadence for each?"
echo "- Did any counterweight get a follow-up memory or"
echo "  BACKLOG row out of this audit?"
echo ""
echo "If nothing drifted, log a \"clean tick\" short note:"
echo "the audit's signal value is as much in confirming"
echo "stability as in catching drift."
