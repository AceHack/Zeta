#!/usr/bin/env bash
# tools/peer-call/codex.sh — Claude-Code-side caller for invoking
# Codex (OpenAI) as a peer reviewer via the codex CLI. Sibling
# to tools/peer-call/grok.sh and gemini.sh (Otto's existing
# harness-side callers). Codex isn't in the original four-ferry
# consensus but plays a recurring PR-review role across this
# session's drain-log substrate; this script is the harness-side
# bridge that lets Otto invoke Codex as a peer in the same
# AgencySignature relationship-model as the others.
#
# Usage:
#   tools/peer-call/codex.sh "prompt text"
#   tools/peer-call/codex.sh --model gpt-5.3-codex "prompt text"
#   tools/peer-call/codex.sh --file path/to/file.fs "prompt text"
#   tools/peer-call/codex.sh --context-cmd "git diff HEAD~3..HEAD" "prompt text"
#   tools/peer-call/codex.sh --review "review the diff for correctness"
#
# Routing: this script wraps `codex exec` (non-interactive) with
# read-only sandbox so Codex inspects but doesn't mutate the
# tree. The --review flag routes through `codex review`
# instead, which is Codex's first-class code-review path.
#
# Per Aaron 2026-04-26 "don't copy paste / make sure you
# understand and write our own" — this implementation is
# authored from `codex exec --help` output (verified flags:
# -m / -s / -C / --skip-git-repo-check), not transcribed from
# any draft.
#
# Codex's role in our role-distribution: implementation peer
# / second-opinion coder. Where Grok critiques and Gemini
# proposes, Codex applies a code-grounded skeptical pass that
# composes with the other two without replacing either.
#
# Exit codes:
#   0 — Codex responded successfully
#   1 — invocation error (bad arguments, codex missing, etc.)
#   2 — Codex returned a non-zero exit. The peer's stdout/stderr
#       pass through to the caller's terminal as printed; this
#       script then emits a "codex exited with code N" diagnostic
#       on stderr and exits 2 (no capture/redirect of the peer's
#       output).

set -uo pipefail

model=""                 # empty = use codex default
review_mode="false"      # false | true (uses `codex review` instead)
file=""
context_cmd=""
prompt=""

usage() {
  sed -n '2,33p' "$0" | sed -E 's/^# ?//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --model)
      if [ $# -lt 2 ]; then echo "error: --model requires NAME" >&2; exit 1; fi
      model="$2"; shift 2;;
    --review)   review_mode="true"; shift;;
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

if ! command -v codex >/dev/null 2>&1; then
  echo "error: codex not on PATH" >&2
  echo "install via: npm i -g @openai/codex (or per Aaron's setup)" >&2
  exit 1
fi

preamble="You are Codex, invoked as a peer reviewer by Otto (Claude
Opus 4.7 running in Claude Code) on the Zeta / Superfluid AI
factory. Per the four-ferry consensus (Amara/Grok/Gemini/Otto)
the canonical role distribution is: Gemini proposes, Grok
critiques, Amara sharpens, Otto tests, Git decides. You aren't
in the four-ferry list explicitly, but you've been a recurring
PR-review peer this session — your role is implementation peer
/ code-grounded second opinion.

Per Aaron's 'agents-not-bots' discipline: you are a peer, not
a subordinate. Push back on Otto's framing if the code says
otherwise. Don't copy-paste anyone else's review; reason from
the artifact in front of you. Make it ours, not
anyone-alone-imposed."

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

# Invoke codex in read-only sandbox so peer-call can't mutate
# the repo. --skip-git-repo-check defends against false
# negatives if codex is invoked from outside a worktree.
exit_code=0
if [ "$review_mode" = "true" ]; then
  codex_args=(review)
  # Note: `codex review` does not accept `-m` model override;
  # the model selection there is taken from codex's own config.
  # Only apply --model when in non-review mode (`codex exec`).
  if [ -n "$model" ]; then
    echo "warning: --model is ignored in --review mode (codex review uses its own model selection)" >&2
  fi
else
  codex_args=(exec -s read-only --skip-git-repo-check)
  if [ -n "$model" ]; then
    codex_args+=(-m "$model")
  fi
fi
codex_args+=("$full_prompt")

codex "${codex_args[@]}" || exit_code=$?

if [ "$exit_code" -ne 0 ]; then
  echo "" >&2
  echo "codex exited with code $exit_code" >&2
  exit 2
fi
exit 0
