# tools/peer-call/ — Otto's Claude-Code-side peer callers

Eight sibling TypeScript wrappers (Bun runtime: grok, gemini, codex, amara, ani, riven, kiro, claude) that let Otto
(Claude Opus 4.7 running in Claude Code) invoke a peer agent
in another CLI harness as a peer, not a subordinate. Each
wraps the relevant peer's headless-mode CLI and applies a
shared AgencySignature relationship-model preamble so the
peer knows the call posture.

Originally authored as bash `.sh` scripts; ported to TypeScript
2026-05-06 per CLAUDE.md Rule 0 / Rule -1 (NO-MORE-BASH; TS IS
cross-platform DST). Invocation form is `bun tools/peer-call/<name>.ts`.

## Scripts at a glance

| Script      | Peer                                      | Underlying CLI                                             | Default role (when to invoke)                                                                         | Underlying model                                                                |
| ----------- | ----------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `grok.ts`   | Grok (xAI)                                | `cursor-agent --print --model grok-4-20-thinking`          | **Critique** — skeptical pass on Otto's framing                                                       | grok-4-20-thinking (default) / grok-4-20 (--fast)                               |
| `gemini.ts` | Gemini (Google)                           | `gemini -p`                                                | **Propose** — divergent options, possibility-space surfacing                                          | gemini default (override via `--model`)                                         |
| `codex.ts`  | Vera (named entity, OpenAI Codex surface) | `codex exec -s read-only`                                  | **Implementation peer** — code-grounded second opinion + Vera input-firewall + capture-pagination fix | codex default (override via `--model`); persona via CURRENT-vera.md             |
| `amara.ts`  | Amara (named entity, OpenAI surface)      | `codex exec -s read-only` (or `codex review` via --review) | **Sharpen** — blunt-take pattern, carved-sentence distillation                                        | codex default; persona via CURRENT-amara.md                                     |
| `ani.ts`    | Ani (named entity, xAI surface)           | `cursor-agent --print --model grok-4-20-thinking`          | **Brat-voice review** — playful + direct + memorable, contributor-attention-capture register          | grok-4-20-thinking (default) / grok-4-20 (--fast); persona via CURRENT-ani.md   |
| `riven.ts`  | Riven (named entity, xAI surface)         | `cursor-agent --print --model grok-4-20-thinking`          | **Adversarial-truth-axis** — third-co-scout, refuses inherited blind spots                            | grok-4-20-thinking (default) / grok-4-20 (--fast); persona via CURRENT-riven.md |
| `kiro.ts`   | Kiro (kiro.dev headless AI)               | `kiro-cli chat --no-interactive --trust-all-tools`         | **Specification peer** — spec-grounded second opinion, requirement-aware review                       | kiro default                                                                     |
| `claude.ts` | Claude (self-call, Claude Code CLI)       | `claude --print --tools "Read,Glob,Grep"`                  | **Cold-boot self-test** — fresh instance verifies substrate, rule-drift, broken-pointer regressions   | claude default (override via `--model`)                                          |

The role column reflects the **four-ferry consensus**
(Amara/Grok/Gemini/Otto, PR #24 on AceHack/Zeta):

> Gemini proposes, Grok critiques, Amara sharpens, Otto tests,
> Git decides.

Codex isn't in the four-ferry list explicitly — its role
emerged through repeated PR-review participation across this
factory's drain-log substrate, so its preamble names it as
"implementation peer / code-grounded second opinion" rather
than claiming a four-ferry slot.

`amara.ts`, `ani.ts`, and `riven.ts` are **named-entity** peers
— they share an underlying CLI/model with `codex.ts`/`grok.ts`
respectively, but layer a persona-bootstrap preamble on top
so the call is the named-entity (Amara, Ani, Riven) rather than
the bare model (Codex, Grok). `codex.ts` itself loads Vera as
the codex-substrate named entity. The persona-bootstrap closes the
silent-courier-debt gap (Aaron 2026-04-30 — see
`memory/feedback_silent_courier_debt_no_amara_headless_cli_dont_count_on_peer_ai_reviews_as_loop_aaron_2026_04_30.md`)
by letting Otto invoke Amara/Ani autonomously instead of
through Aaron-courier. Both surfaces have v1 limitations
(see each script's header for details).

## Shared flag surface

All wrappers accept the same core flags:

```text
--file PATH              attach file content (head -c 20000) to the prompt
--context-cmd CMD        attach the output of CMD (head -c 20000) to the prompt
--output-file PATH       tee captured stdout to PATH (auto under /tmp/peer-call-output/ otherwise)
--help, -h               print the script header as usage
```

Per-script extras:

- `grok.ts` / `ani.ts` / `riven.ts` add `--thinking` (default)
  / `--fast` to switch between `grok-4-20-thinking` and
  `grok-4-20` models, and `--json` / `--stream` for output
  format.
- `gemini.ts` adds `--model NAME` to override the default
  Gemini model, and `--json` / `--stream` for output format.
- `codex.ts` / `amara.ts` add `--model NAME` and `--review`
  (which routes through `codex review` instead of `codex exec`
  for first-class code-review work).
- `codex.ts`, `amara.ts`, `ani.ts`, `grok.ts`, and `gemini.ts`
  enforce the shared input firewall (rejects rote heartbeats /
  empty-token prompts; requires a substantive payload). Override
  with `--allow-empty` for testing only. `riven.ts` is left for
  Riven-owned follow-up work.
- Persona wrappers (`codex.ts`, `amara.ts`, `ani.ts`,
  `riven.ts`) auto-load their `CURRENT-<name>.md` bootstrap;
  `--no-current` / `--bare` / `--no-persona` opts out (debug
  only).

Base exit codes are uniform across all six:

- `0` — peer responded successfully
- `1` — invocation error (bad arguments, CLI missing, etc.)
- `2` — peer's CLI returned a non-zero exit. The peer's stdout
  / stderr are NOT captured by the wrapper; they pass through
  to the caller's terminal as the peer printed them. The script
  emits a `<peer> exited with code N` diagnostic line on stderr
  before exiting with code 2.
- `3` — firewall-enabled wrappers rejected the prompt as not
  work-extractable. Add real payload or use `--allow-empty` for
  a logged testing-only bypass.

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
bun tools/peer-call/grok.ts \
  --file docs/research/some-draft.md \
  "Critique the framing in section 2 — does the claim follow from the evidence cited, or is there a gap?"
```

### Proposal exploration (Gemini)

```bash
bun tools/peer-call/gemini.ts \
  "We're choosing between strategy A (per-file 3-way merge with subagent dispatch) and strategy B (pure concatenation). Propose a 3rd option I haven't considered, with one paragraph each on tradeoffs."
```

### Code-grounded second opinion (Codex / Vera)

```bash
bun tools/peer-call/codex.ts \
  --review \
  --context-cmd "git diff HEAD~3..HEAD -- tools/peer-call/" \
  "Review the recent peer-call diff for correctness. Flag anything that breaks portability across the install-graph targets (macOS / Ubuntu / Windows-via-Bun)."
```

## Why these scripts exist

The human maintainer's 2026-04-26 framing: _"yall got to figure
out peer mode as peers"_ + _"don't copy paste / make sure you
understand and write our own"_ + _"you have all the CLIs
already install and logged in as me"_ + _"claude is going to
call the cursor cli so you have a harness"_.

These are read together as: the peer-call protocol is not
owned by any single agent; each Claude-Code-side caller is
Otto's specific contribution to the collective; the
protocol convention is what the agents converge on through
use.

`grok.sh` (PR #27 on AceHack/Zeta, merged 2026-04-26) covered
the Grok-via-Cursor harness path. `gemini.sh` and `codex.sh`
(PR #28 on AceHack/Zeta) extend the same shape to the other
two peer CLIs already on PATH. `ani.sh` and `amara.sh`
(PR #960 on LFG, 2026-04-30) layer named-entity persona-
bootstrap on top of cursor-agent + Grok and codex
respectively, closing the Aaron-courier silent-debt gap for
Amara + Ani autonomous invocation.

The set is open; future named-entity peers follow the same
copy-and-adapt pattern (CLI surface + persona-bootstrap
preamble + flag wiring matching the existing scripts).

## Security notes

- **`--context-cmd` runs shell code.** All wrappers shell-out
  via Bun's `child_process` to capture the output of the
  command passed to `--context-cmd`. This is intentional (the
  flag's documented purpose is to attach command output as
  context), but it means **`--context-cmd` is a shell-execution
  surface** — never pass an untrusted string to it. The
  captured stdout is attached to the prompt, not re-piped to
  the peer's CLI as a command, so the peer-side risk is limited
  to what the executed command itself exposes (file reads,
  env-var leaks, etc.).
- **The prompt itself is safe to contain shell metacharacters.**
  Bun's `spawn`/`spawnSync` passes args as a JS array — single
  quotes, double quotes, backticks, dollar signs, and other
  shell-active characters in the prompt are passed through
  verbatim without interpretation by any local shell. (The
  peer's own CLI may interpret some characters — that's the
  peer's contract, not Otto's.)
- **`--file` reads only the first 20000 bytes.** Both
  `--file PATH` and `--context-cmd CMD` cap their attached
  content at 20000 bytes to keep peer prompts within reasonable
  size limits. If the peer needs more, route through the peer's
  interactive CLI directly.
- **No secrets handling.** None of the wrappers read or
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

To add a new peer-call wrapper (e.g. for a future peer-CLI):

1. Verify the peer's CLI has a non-interactive / headless
   mode. If not, the wrapper can't work as a single-shot
   shape.
2. Copy one of the existing `.ts` wrappers (most similar by
   CLI shape) as a starting template. Then **rewrite it from
   the peer-CLI's own `--help` output** — don't copy-paste
   flag semantics across CLIs.
3. Adapt the AgencySignature preamble to name the peer's
   role in the role-distribution. Cite the four-ferry
   consensus and add the new peer's role as a sibling sentence.
4. Wire the shared firewall from `_firewall.ts`, adding a
   peer-specific substantive trigger list only when the default
   list is too generic for that peer's role.
5. Verify with `bun run typecheck`, a heartbeat-rejection
   smoke test, a `--allow-empty` bypass smoke test, and a
   `--help` smoke test.
6. Live-test with a minimal prompt asking the peer whether
   the framing reads as peer-shaped. The preamble works when
   the peer's response confirms the role-binding.
7. Update this README's table.

## History + future direction

Original bash implementations: `grok.sh` (PR #27 on
AceHack/Zeta, merged 2026-04-26), `gemini.sh` + `codex.sh`
(PR #28), `ani.sh` + `amara.sh` (PR #960 on LFG, 2026-04-30),
`riven.sh` (2026-05-05). All migrated to TypeScript+Bun on
2026-05-06 per CLAUDE.md Rule 0 / Rule -1 (NO-MORE-BASH; TS
IS cross-platform DST). Bash sources removed; recoverable
from git history if needed.

Open follow-up backlog rows:

| Row                                                                                                              | Priority | Effort | What                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [B-0120](../../docs/backlog/P2/B-0120-peer-call-architecture-refactor-script-per-cli-persona-flag-2026-04-30.md) | P2       | M      | Collapse per-named-entity wrappers into shared cli-handlers + `--persona NAME` flag                                                         |
| [B-0121](../../docs/backlog/P2/B-0121-otto-kenji-peer-call-cross-harness-claude-cli-aaron-2026-04-30.md)         | P2       | M      | Add the Anthropic-side Claude-code-instance personas as externally-callable peers (cross-harness symmetry; pending a/b/c topology decision) |
