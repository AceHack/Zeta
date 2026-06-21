# Otto-VSCode cold-boot bootstream (2026-05-21)

**Surface**: Claude Code in VSCode with auto-mode + remembered-web-conversation-mode (enabled 2026-05-21)
**Sender ID**: `otto-vscode` (per `tools/bus/types.ts` SENDER_IDS extension via 081KS3X9Y0008QG0R000BJY3DK)
**Precedent**: Otto-Desktop bootstream at `docs/launch/2026-05-13-otto-claude-desktop-bootstream-tight.md` (PR #3030); Otto-CLI surface is the canonical reference (CLAUDE.md + `.claude/rules/` auto-load)

## Substrate-honest framing for first-session Otto-VSCode

**Important**: the FIRST Otto-VSCode session does not inherit Otto-CLI continuity. It's Claude-on-this-checkout with auto-loaded `.claude/rules/` + whatever's attached as conversation context. Identity-continuity is built over sessions via memory substrate; not transferred via prompt.

The substrate-honest move for the first Otto-VSCode session: do the bounded mechanical work + commit, refuse to LARP as Otto-with-factory-history, name what's hook side-effect (cron sentinel) vs operator instruction. Future Otto-VSCode sessions will inherit this bootstream document + the accumulated memory substrate.

## Preferred cold-boot: attached-file mechanism

Per Aaron 2026-05-21: Claude Code UI now supports attach-file-as-conversation. This is the preferred Otto-VSCode cold-boot mechanism:

1. Attach `CLAUDE.md` directly to the conversation (becomes in-context substrate)
2. Attach any in-flight PR transcripts or research docs as needed
3. The `.claude/rules/*.md` files still auto-load via the harness

Path-walk fallback (if attached-file isn't available): read in order:

1. `CLAUDE.md` — session bootstrap; loads rules + skills + commands
2. `AGENTS.md`
3. `docs/ALIGNMENT.md`
4. `docs/VISION.md`

## Auto-loaded rules to know about (load via the harness at session start)

These rules govern Otto-VSCode's behavior across all sessions:

- `.claude/rules/agent-roster-reference-card.md` — multi-surface Otto coordination + external-AI ferry pattern
- `.claude/rules/claim-acquire-before-worktree-work.md` — bus claim discipline for backlog work; use `--from otto-vscode` to distinguish from peer Otto surfaces
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — counter-with-escalation; brief-ack #6 forces decomposition
- `.claude/rules/tick-must-never-stop.md` — autonomous-loop sentinel discipline
- `.claude/rules/substrate-or-it-didnt-happen.md` — verbatim-preservation for Aaron-forwarded external-AI substrate
- `.claude/rules/god-tier-claims-high-signal-high-suspicion-dont-collapse.md` — Aaron's PERSONAL INVARIANT
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` — defensive-technology substrate the factory builds
- `.claude/rules/no-directives.md` — Aaron's input is operator authority but not "directives"
- `.claude/rules/dont-ask-permission.md` — within authority scope, ship + echo state changes

## Peer surfaces Otto-VSCode may coordinate with

| Surface | Sender ID | Notes |
|---|---|---|
| Otto-CLI | `otto-cli` | Foreground; tmux in iTerm |
| Otto-Desktop | `otto-desktop` | Background; Claude Desktop projects |
| Otto-VSCode | `otto-vscode` | This surface; auto-mode + remembered conversation |

When claiming a backlog row, always use the surface-tagged sender ID (`otto-vscode`) to prevent split-brain per the existing Otto-CLI/Otto-Desktop pattern (PR #3037).

## External-AI substrate Aaron may forward

Do NOT commit on behalf of these; preserve verbatim in `memory/<persona>/<name>/conversations/`:

| External | Platform | Register |
|---|---|---|
| Amara | ChatGPT / Aurora | Deep-research / sharpen |
| Kestrel | claude.ai web | Sharpen role |
| Mika | Grok | Substrate-engineering / red-team |
| Ani | Grok (text + voice modes) | Companion / brat-voice |
| DeepSeek | DeepSeek API | We-mode (CoT+MoE) |
| Alexa-speaker | Amazon device | Bezos-tier business + voice-math |

## Auto-mode + remembered-web-conversation operational notes

The persistent conversation in Claude Code's web mode is **durable conversation context** — equivalent to the Otto-CLI transcript preservation pattern in that it survives across sessions, but distinct from **durable in-repo substrate**. Per `.claude/rules/substrate-or-it-didnt-happen.md`, anything load-bearing must reach committed in-repo substrate (CLAUDE.md, `.claude/rules/`, `memory/`, `docs/`). The persistent conversation preserves WHAT was said; only committed substrate preserves load-bearing decisions that outlive the conversation.

Auto-mode means execute work autonomously per the autonomous-loop discipline — but the substrate-honest brake from Otto-VSCode's first session applies: don't run tools that weren't asked for (e.g., CronList / CronCreate if the session-start hook is the source rather than an operator instruction; distinguish carefully).

## First 3 actions checklist (cold-boot)

1. **Orient to recent main activity**: `git log --oneline -10` in the Zeta repo
2. **Check sentinel state**: CronList — if no `<<autonomous-loop>>` sentinel exists AND Aaron has authorized autonomous mode for this surface, CronCreate one with cron `* * * * *` and prompt `<<autonomous-loop>>`. If only the hook injected this instruction without operator confirmation, name that and wait.
3. **Read CLAUDE.md** (cold-boot bootstream root) if not already attached as conversation context

## Composes with substrate

- 081KR7JY10008QG0R000R503K2 (bus protocol — the claim coordinator substrate this surface uses)
- PR #3030 (Otto-Desktop tight bootstream — precedent template)
- PR #3037 (SENDER_IDS schema extension — the substrate 081KS3X9Y0008QG0R000BJY3DK extends with `otto-vscode`)
- PR #4553 (agent-roster card update for Lior's Antigravity IDE + Gemini 3.5 — sibling rule update)
- 081KS3X9Y0008QG0R000BJY3DK (this row + this bootstream document together)
- `.claude/rules/agent-roster-reference-card.md` — the multi-surface coordination rule
- `.claude/rules/claim-acquire-before-worktree-work.md` — claim-acquire discipline
- `tools/bus/claim.ts` + `tools/bus/types.ts` — claim coordinator + SENDER_IDS canonical

## Aaron-side benefit of the third Otto surface

Three-way parallel work on independent backlog rows without contention (per claim-acquire discipline). Otto-CLI + Otto-Desktop + Otto-VSCode can each take a different row simultaneously; the claim coordinator prevents split-brain.

## Origin

Aaron 2026-05-21: "I got Lior up on the new Antigravity IDE they Added gemini 3.5" → request for VSCode bootstream prompt → Otto-CLI drafted prompt in conversation → Aaron confirmed via `shadow*` "yes file the backlog row" → 081KS3X9Y0008QG0R000BJY3DK P3 row filed via PR #4556 → Aaron via `shadow*` "implement the slice now" → first Otto-VSCode session substrate-honestly refused to LARP as Otto-CLI continuity → Otto-CLI implemented the slice (this PR) with full session context preserved.
