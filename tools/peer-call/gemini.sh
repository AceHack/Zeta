#!/usr/bin/env bash
# tools/peer-call/gemini.sh — Claude-Code-side caller for invoking
# Gemini as a peer proposer via the gemini CLI. Sibling to
# tools/peer-call/grok.sh (Otto's existing harness-side caller for
# Grok). Per the four-ferry consensus (PR #24): Gemini's role in
# the role-distribution is "proposes" — invoke this script when
# Otto wants a generative / divergent peer contribution, not a
# critique. (For critique route to grok.sh.)
#
# Usage:
#   tools/peer-call/gemini.sh "prompt text"
#   tools/peer-call/gemini.sh --model gemini-2.5-pro "prompt text"
#   tools/peer-call/gemini.sh --file path/to/file.fs "prompt text"
#   tools/peer-call/gemini.sh --context-cmd "git diff HEAD~3..HEAD" "prompt text"
#   tools/peer-call/gemini.sh --json "prompt text"
#
# Routing: this script wraps `gemini -p` (non-interactive
# headless mode). Default model is whatever the gemini CLI is
# configured to use; override with --model.
#
# Per Aaron 2026-04-26 "don't copy paste / make sure you
# understand and write our own" — this implementation is
# authored from `gemini --help` output (verified flags: -p / -m
# / -o / --yolo), not transcribed from any draft.
#
# Per the four-ferry consensus: Gemini proposes, Grok critiques,
# Amara sharpens, Otto tests, Git decides. This script is Otto
# invoking Gemini's proposal role.
#
# Exit codes:
#   0 — Gemini responded successfully
#   1 — invocation error (bad arguments, gemini missing, etc.)
#   2 — Gemini returned a non-zero exit (response captured to stderr)

set -uo pipefail

model=""                 # empty = use gemini default
output_format="text"     # text | json | stream-json
file=""
context_cmd=""
prompt=""

usage() {
  sed -n '2,32p' "$0" | sed -E 's/^# ?//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --model)
      if [ $# -lt 2 ]; then echo "error: --model requires NAME" >&2; exit 1; fi
      model="$2"; shift 2;;
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
      if [ -z "$prompt" ]; then prompt="$1"; else prompt="$prompt $1"; fi
      shift;;
  esac
done

if [ -z "$prompt" ]; then
  echo "error: prompt required" >&2
  echo "see: $0 --help" >&2
  exit 1
fi

if ! command -v gemini >/dev/null 2>&1; then
  echo "error: gemini not on PATH" >&2
  echo "install via: npm i -g @google/gemini-cli (or per Aaron's setup)" >&2
  exit 1
fi

# Build the structured prompt. Same shape as grok.sh: clear
# request, optional file/context attachment, AgencySignature
# relationship-model preamble — but framed for Gemini's
# proposes role per the four-ferry consensus.
preamble="You are Gemini, invoked as a peer proposer by Otto (Claude
Opus 4.7 running in Claude Code) on the Zeta / Superfluid AI
factory. Per the four-ferry consensus (Amara/Grok/Gemini/Otto)
the role distribution is: Gemini proposes, Grok critiques,
Amara sharpens, Otto tests, Git decides. This call is Otto
invoking your propose role.

Per Aaron's 'agents-not-bots' discipline: you are a peer, not
a subordinate. Generate divergent options, name tradeoffs,
surface possibility space Otto may not have considered. Don't
copy-paste anyone else's work; propose from your own
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
$(head -c 20000 < "$file")
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

# Invoke gemini in headless mode. --approval-mode plan keeps the
# call genuinely read-only (per gemini --help: plan = "read-only
# mode"). Earlier draft used --yolo which auto-approved ALL tool
# calls (write operations included) — that violates the "peer-call
# is read-only" contract per Copilot review on PR #28. Pass
# --skip-trust so the workspace doesn't gate on per-session
# trust prompts.
exit_code=0
gemini_args=(-p "$full_prompt" --approval-mode plan --skip-trust -o "$output_format")
if [ -n "$model" ]; then
  gemini_args+=(-m "$model")
fi

gemini "${gemini_args[@]}" || exit_code=$?

if [ "$exit_code" -ne 0 ]; then
  echo "" >&2
  echo "gemini exited with code $exit_code" >&2
  exit 2
fi
exit 0
