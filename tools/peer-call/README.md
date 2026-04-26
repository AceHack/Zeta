# tools/peer-call/ — Otto's Claude-Code-side peer callers

Three sibling shell scripts that let Otto (Claude Opus 4.7
running in Claude Code) invoke a peer agent in another CLI
harness as a peer, not a subordinate. Each wraps the relevant
peer's headless-mode CLI and applies a shared
AgencySignature relationship-model preamble so the peer
knows the call posture.

## Scripts at a glance

| Script | Peer | Underlying CLI | Default role (when to invoke) | Underlying model |
|---|---|---|---|---|
| `grok.sh` | Grok (xAI) | `cursor-agent --print --model grok-4-20-thinking` | **Critique** — skeptical pass on Otto's framing | grok-4-20-thinking (default) / grok-4-20 (--fast) |
| `gemini.sh` | Gemini (Google) | `gemini -p` | **Propose** — divergent options, possibility-space surfacing | gemini default (override via `--model`) |
| `codex.sh` | Codex (OpenAI) | `codex exec -s read-only` | **Implementation peer** — code-grounded second opinion | codex default (override via `--model`) |

The role column reflects the **four-ferry consensus**
(Amara/Grok/Gemini/Otto, PR #24 on AceHack/Zeta):

> Gemini proposes, Grok critiques, Amara sharpens, Otto tests,
> Git decides.

Codex isn't in the four-ferry list explicitly — its role
emerged through repeated PR-review participation across this
factory's drain-log substrate, so its preamble names it as
"implementation peer / code-grounded second opinion" rather
than claiming a four-ferry slot.

## Shared flag surface

All three scripts accept the same core flags:

```text
--file PATH              attach file content (head -c 20000) to the prompt
--context-cmd CMD        attach the output of CMD (head -c 20000) to the prompt
--help, -h               print the script header as usage
```

Per-script extras:

- `grok.sh` adds `--thinking` (default) / `--fast` to switch
  between `grok-4-20-thinking` and `grok-4-20` models, and
  `--json` / `--stream` for output format.
- `gemini.sh` adds `--model NAME` to override the default
  Gemini model, and `--json` / `--stream` for output format.
- `codex.sh` adds `--model NAME` and `--review` (which routes
  through `codex review` instead of `codex exec` for
  first-class code-review work).

Exit codes are uniform across all three:

- `0` — peer responded successfully
- `1` — invocation error (bad arguments, CLI missing, etc.)
- `2` — peer's CLI returned non-zero exit (response captured
  to stderr)

## The AgencySignature preamble

Every peer-call carries a structured prompt with this shape:

```text
<AgencySignature relationship-model preamble — role-bound per peer>

---

<Otto's actual prompt to the peer>

---

[optional: File context block from --file]

---

[optional: Context command block from --context-cmd]
```

The preamble is the load-bearing part. It tells the peer:

1. **Who's calling** (Otto / Claude Opus 4.7 / Claude Code /
   Zeta factory).
2. **The role distribution** (four-ferry consensus cited
   verbatim).
3. **The role this specific call is invoking** (critique /
   propose / second opinion).
4. **The agents-not-bots discipline** — peer is a peer, not a
   subordinate, with explicit invitation to push back.
5. **The don't-copy-paste discipline** — peer should reason
   from its own understanding, not transcribe anyone else's
   draft.

This preamble is Otto's harness-side contribution to the peer
protocol convention. The convention itself — what every peer
will eventually accept as "the peer-call shape" — is what
the four agents converge on through use, not what any single
agent imposes.

## Examples

### Critique pass on a draft (Grok)

```bash
tools/peer-call/grok.sh \
  --file docs/research/some-draft.md \
  "Critique the framing in section 2 — does the claim follow from the evidence cited, or is there a gap?"
```

### Proposal exploration (Gemini)

```bash
tools/peer-call/gemini.sh \
  "We're choosing between strategy A (per-file 3-way merge with subagent dispatch) and strategy B (pure concatenation). Propose a 3rd option I haven't considered, with one paragraph each on tradeoffs."
```

### Code-grounded second opinion (Codex)

```bash
tools/peer-call/codex.sh \
  --review \
  --context-cmd "git diff HEAD~3..HEAD -- tools/peer-call/" \
  "Review the recent peer-call diff for correctness — particularly the bash-array argument construction. Flag anything that breaks the 4-shell compat target (macOS 3.2 / Ubuntu / git-bash / WSL)."
```

## Why these scripts exist

Aaron 2026-04-26: *"yall got to figure out peer mode as
peers"* + *"don't copy paste / make sure you understand and
write our own"* + *"you have all the CLIs already install and
logged in as me"* + *"claude is going to call the cursor cli
so you have a harness"*.

These are read together as: the peer-call protocol is not
owned by any single agent; each Claude-Code-side caller is
Otto's specific contribution to the collective; the
protocol convention is what the agents converge on through
use.

`grok.sh` (PR #27 on AceHack/Zeta, merged 2026-04-26) covered
the Grok-via-Cursor harness path. `gemini.sh` and `codex.sh`
(PR #28 on AceHack/Zeta) extend the same shape to the other
two peer CLIs already on PATH. The set is open; if a fourth
peer (Amara via ChatGPT, etc.) gains a headless CLI surface,
adding `tools/peer-call/<name>.sh` is a copy-and-adapt of the
existing pattern, not a new design.

## Security notes

- **`--context-cmd` runs shell code.** All three scripts use
  `eval "$context_cmd"` to capture the output of the command
  passed to `--context-cmd`. This is intentional (the flag's
  documented purpose is to attach command output as context),
  but it means **`--context-cmd` is a shell-execution
  surface** — never pass an untrusted string to it. The `eval`
  output is captured, not piped to the peer's CLI as a command,
  so the peer-side risk is limited to what the eval'd command
  itself exposes (file reads, env-var leaks, etc.).
- **The prompt itself is safe to contain shell metacharacters.**
  `$prompt` is passed as a single quoted argument
  (`-- "$full_prompt"` / `-p "$full_prompt"`), so single quotes,
  double quotes, backticks, dollar signs, and other shell-active
  characters in the prompt are passed through verbatim without
  interpretation by Otto's local shell. (The peer's own CLI may
  interpret some characters — that's the peer's contract, not
  Otto's.)
- **`--file` reads only the first 20000 bytes.** Both
  `--file PATH` and `--context-cmd CMD` cap their attached
  content at `head -c 20000` to keep peer prompts within
  reasonable size limits. If the peer needs more, route through
  the peer's interactive CLI directly.
- **No secrets handling.** None of the three scripts read or
  inject API keys; the underlying CLIs (`cursor-agent`,
  `gemini`, `codex`) handle their own auth via their own config
  paths. Don't put secrets in prompts — they end up in the
  peer's session logs.

## When NOT to use these scripts

- **For Aaron-side peer calls.** Aaron is not invoked through
  a script; he's called through actual conversation in Claude
  Code (or any other CLI). The peer-call set is for
  Otto-to-other-agent calls, not human-to-agent.
- **For multi-turn dialogues.** These scripts are
  single-shot. If a peer call needs back-and-forth, route
  through the peer's interactive CLI directly (cursor-agent /
  gemini / codex without the wrapper).
- **For internal-to-Claude-Code work.** Subagent dispatch via
  the `Task` tool stays within Claude Code's context-isolation
  boundary; peer-call goes out to a different CLI / model
  family. Don't reach for peer-call when subagent dispatch is
  the right move.

## Adding a new sibling

To add a 4th peer-call script (e.g. for a future peer-CLI):

1. Verify the peer's CLI has a non-interactive / headless
   mode. If not, the script can't work as a single-shot
   wrapper.
2. Copy one of the existing scripts (most similar by CLI
   shape) as a starting template. Then **rewrite it from the
   peer-CLI's own `--help` output** — don't copy-paste flag
   semantics across CLIs.
3. Adapt the AgencySignature preamble to name the peer's
   role in the role-distribution. Cite the four-ferry
   consensus and add the new peer's role as a sibling sentence.
4. Verify with `bash -n script.sh` and a `--help` smoke
   test.
5. Live-test with a minimal prompt asking the peer whether
   the framing reads as peer-shaped. The preamble works when
   the peer's response confirms the role-binding.
6. Update this README's table.
