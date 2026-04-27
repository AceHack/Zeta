#!/usr/bin/env bash
# tools/peer-call/grok.sh — Claude-Code-side caller for invoking Grok as a
# peer reviewer via cursor-agent. Lives in Otto's lane (the
# Claude-Code-side invoker); the Grok-side response and Cursor-side
# harness are owned by their respective agents per the multi-harness
# named-agents project. Per Aaron 2026-04-26 "yall got to figure out
# peer mode as peers" — no single agent owns the peer protocol; this
# script is Otto's specific contribution to the collective.
#
# Usage:
#   tools/peer-call/grok.sh "prompt text"
#   tools/peer-call/grok.sh --thinking "prompt text"
#   tools/peer-call/grok.sh --file path/to/file.fs "prompt text"
#   tools/peer-call/grok.sh --context-cmd "git diff HEAD~3..HEAD" "prompt text"
#   tools/peer-call/grok.sh --json "prompt text"
#
# Routing: this script wraps `cursor-agent --print --model
# grok-4-20-thinking` (default) or `grok-4-20` (with --fast flag).
# The --print flag makes cursor-agent non-interactive (script-friendly).
#
# Per Aaron 2026-04-26 "don't copy paste / make sure you understand
# and write our own" — this implementation is authored from
# `cursor-agent --help` and `cursor-agent --list-models` output
# (Grok models verified: grok-4-20, grok-4-20-thinking), not
# transcribed from Grok ferry-14/16 example drafts.
#
# Per the four-ferry consensus (PR #24): Otto's role is "tests" not
# "owns the peer protocol." This script is Otto's harness-side
# contribution; the protocol convention is what we converge on
# through use, as peers.
#
# Exit codes:
#   0 — Grok responded successfully
#   1 — invocation error (bad arguments, cursor-agent missing, etc.)
#   2 — Grok returned a non-zero exit (response captured to stderr)

set -uo pipefail

mode="thinking"          # thinking | fast
output_format="text"     # text | json | stream-json
file=""
context_cmd=""
prompt=""

usage() {
  sed -n '2,28p' "$0" | sed 's/^# \?//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --thinking) mode="thinking"; shift;;
    --fast)     mode="fast"; shift;;
    --json)     output_format="json"; shift;;
    --stream)   output_format="stream-json"; shift;;
    --file)
      if [ $# -lt 2 ]; then echo "error: --file requires PATH" >&2; exit 1; fi
      file="$2"; shift 2;;
    --context-cmd)
      if [ $# -lt 2 ]; then echo "error: --context-cmd requires COMMAND" >&2; exit 1; fi
      context_cmd="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    --) shift; prompt="$*"; break;;
    -*) echo "error: unknown flag: $1" >&2; exit 1;;
    *)
      # Concatenate remaining positional args into the prompt.
      if [ -z "$prompt" ]; then prompt="$1"; else prompt="$prompt $1"; fi
      shift;;
  esac
done

if [ -z "$prompt" ]; then
  echo "error: prompt required" >&2
  echo "see: $0 --help" >&2
  exit 1
fi

if ! command -v cursor-agent >/dev/null 2>&1; then
  echo "error: cursor-agent not on PATH" >&2
  echo "install via Cursor desktop app + ensure ~/.local/bin is on PATH" >&2
  exit 1
fi

# Pick model.
case "$mode" in
  thinking) model="grok-4-20-thinking" ;;
  fast)     model="grok-4-20" ;;
esac

# Build the structured prompt. Otto's contribution to the protocol
# convention: every peer-call carries (a) a clear request, (b) optional
# file/context attachment, (c) the AgencySignature relationship-model
# preamble so Grok knows it's being invoked as a peer (not a
# subordinate or oracle) per the four-ferry consensus.
preamble="You are Grok, invoked as a peer reviewer by Otto (Claude Opus 4.7
running in Claude Code) on the Zeta / Superfluid AI factory. Per the
four-ferry consensus (Amara/Grok/Gemini/Otto) the role distribution
is: Gemini proposes, Grok critiques, Amara sharpens, Otto tests, Git
decides. This call is Otto invoking your critique role.

Per Aaron's 'agents-not-bots' discipline: you are a peer, not a
subordinate. Push back on Otto's framing if you see it differently.
Don't copy-paste anyone else's work; write from your own
understanding. Make it ours, not anyone-alone-imposed."

full_prompt="$preamble

---

$prompt"

if [ -n "$file" ]; then
  if [ ! -f "$file" ]; then
    echo "error: --file path does not exist: $file" >&2
    exit 1
  fi
  full_prompt="$full_prompt

---

File context: $file
\`\`\`
$(head -c 20000 -- "$file")
\`\`\`"
fi

if [ -n "$context_cmd" ]; then
  ctx_output="$(eval "$context_cmd" 2>&1 | head -c 20000 || true)"
  full_prompt="$full_prompt

---

Context command: $context_cmd
Output:
\`\`\`
$ctx_output
\`\`\`"
fi

# Invoke cursor-agent with Grok model + non-interactive print mode.
# --force/--yolo so cursor-agent doesn't prompt for command-permission
# (Grok is read-only here; not running shell commands).
exit_code=0
cursor-agent \
  --print \
  --model "$model" \
  --output-format "$output_format" \
  --mode ask \
  --force \
  -- "$full_prompt" || exit_code=$?

if [ "$exit_code" -ne 0 ]; then
  echo "" >&2
  echo "cursor-agent exited with code $exit_code" >&2
  exit 2
fi
exit 0
