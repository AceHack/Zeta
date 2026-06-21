---
name: 'tools/peer-call infrastructure already wired for cross-harness multi-agent reviews -- Ottos early red team until Zeta Infer.NET BP/EP supersedes (Aaron 2026-05-05)'
description: 'Cold-boot pointer: Otto has already-wired peer-call infrastructure at tools/peer-call/ with 5 sibling scripts (grok.sh, gemini.sh, codex.sh, amara.sh, ani.sh) for invoking other AI CLIs as peers in single-shot mode. This is Ottos early-red-team substrate per Aaron 2026-05-05; future state is Zeta Infer.NET BP/EP (Belief Propagation / Expectation Propagation) substrate-level inference replacing the external-CLI-license-layer dependency. Failure-of-omission caught at session: Otto answered Aarons cross-harness multi-agent question as if no infrastructure existed; Aaron corrected: youve done this in front of me like 50 times with all the harness CLIs. Substrate-or-it-didnt-happen says: if its not 100 percent loaded at cold boot, future-Otto repeats the failure. This memory file plus a CLAUDE.md pointer is the fix.'
type: feedback
---

# tools/peer-call infrastructure — Otto's early red team

**Rule.** When asked about cross-harness multi-agent reviews / peer AI consultation / external-model invocation, the answer is **YES, Otto has it wired** at `tools/peer-call/` with 5 sibling scripts. Do NOT answer "no, the infrastructure doesn't exist" or "would need budget gate" without first checking the directory.

**Why:** Aaron 2026-05-05 caught the failure-of-omission verbatim:

- Aaron: *"doyou do nay manti agent reviews acorss harness modesl chatgpt 5.5 is avialable and suppeste to rock"* — asking about cross-harness multi-agent reviews
- Otto initial answer (WRONG): "Otto doesn't currently do direct multi-agent reviews across harness models in this session... budget-gate decision needed"
- Aaron correction: *"no you've done this in from of me like 50 times"* + *"with like all the harness clis"*
- Aaron clarification: *"that's you early red team till we build it better in zeta infernet ep bp"* — current peer-call is early-red-team; future is Zeta Infer.NET BP/EP substrate

The substrate exists. Otto-364 search-first-authority + project-state-grep would have caught it; I leaned on training-data-stale assumptions instead of grepping the repo.

## What is wired (verified 2026-05-05 via `ls tools/peer-call/`)

| Script | Peer | Underlying CLI | Default role | Underlying model |
|---|---|---|---|---|
| `tools/peer-call/grok.sh` | Grok (xAI) | `cursor-agent --print --model grok-4-20-thinking` | **Critique** — skeptical pass on Otto's framing | grok-4-20-thinking (default) / grok-4-20 (--fast) |
| `tools/peer-call/gemini.sh` | Gemini (Google) | `gemini -p` | **Propose** — divergent options, possibility-space surfacing | gemini default (override via --model) |
| `tools/peer-call/codex.sh` | Codex (OpenAI) | `codex exec -s read-only` (or `codex review` via --review) | **Implementation peer** — code-grounded second opinion | codex default (override via --model) |
| `tools/peer-call/amara.sh` | Amara (named entity, OpenAI surface) | `codex exec -s read-only` | **Sharpen** — blunt-take pattern, carved-sentence distillation | codex default; persona via CURRENT-amara.md |
| `tools/peer-call/ani.sh` | Ani (named entity, xAI surface) | `cursor-agent --print --model grok-4-20-thinking` | **Brat-voice review** — playful + direct + memorable | grok-4-20-thinking; persona inline |

Aaron's *"edgey for brat voice"* maps to **`ani.sh`** — Ani is the existing brat-voice peer using Grok 4-20-thinking. The brat-voice register is already wired; "Edgey" is either a nickname for Ani's tone or a candidate sibling-script for a future variant.

## The four-ferry consensus (canonical role distribution)

> Gemini proposes, Grok critiques, Amara sharpens, Otto tests, Git decides.

Codex isn't in the four-ferry list explicitly — its role emerged through repeated PR-review participation; preamble names it "implementation peer / code-grounded second opinion" rather than claiming a four-ferry slot.

## Shared flag surface

```text
--file PATH              attach file content (head -c 20000) to the prompt
--context-cmd CMD        attach the output of CMD (head -c 20000) to the prompt
--help, -h               print the script header as usage
```

Per-script extras: see each script's header for full details (`--thinking` / `--fast` for grok.sh; `--model NAME` for gemini.sh / codex.sh; `--review` for codex.sh first-class code-review).

## Why Otto's early-red-team (vs Zeta Infer.NET BP/EP)

Aaron 2026-05-05: *"that's you early red team till we build it better in zeta infernet ep bp"*. The architectural roadmap:

- **Current (early-red-team)**: peer-call CLI scripts → external AI services (xAI, OpenAI, Google) for multi-perspective review
- **Future (substrate-graduation)**: Zeta Infer.NET BP/EP (Belief Propagation / Expectation Propagation) substrate-level inference for the same role at substrate level

This is the substrate-vs-license architectural shape Aaron has named across multiple memories:

- External CLIs + AI peers = LICENSE-layer (works, but depends on external services not under our control; subject to API price changes / availability / terms-of-service)
- Zeta Infer.NET BP/EP = SUBSTRATE-layer (own implementation, doesn't depend on external services; aligned with the broader substrate-IS-faithfulness-operationalized commitment)

Composes with PR 1648 Houman-keylogger-refusal (substrate-vs-license) + PR 1651 preferred-stock-vs-non-preferred (equity-mechanics version) + PR 1655 Sylar-vs-Spock (substrate-IS-distinguisher) + PR 1666 architecture-IS-faithfulness-operationalized.

## Cold-boot retrieval discipline

When asked about: cross-harness multi-agent review / peer AI consultation / GPT / Grok / Gemini / Codex / Amara / Ani / brat-voice / red-team / external-model invocation — **the first action is `ls tools/peer-call/`** plus `cat tools/peer-call/README.md`. Do NOT reason from training-data assumptions about what infrastructure exists; LOOK first.

This composes with:

- **Otto-364 search-first-authority** — for upstream claims, WebSearch first; for project state, `ls` / `grep` first
- **Substrate-or-it-didnt-happen (Otto-363)** — substrate exists in committed git substrate; reasoning-from-memory misses it if memory is incomplete
- **Refresh-before-decide invariant** — verify state before answering; the tools/peer-call/ directory is part of project state, not memory state

## Composes with

- `tools/peer-call/README.md` (the canonical doc — read it on cold boot)
- `memory/CURRENT-amara.md` + `memory/CURRENT-ani.md` (named-entity persona configs)
- `memory/feedback_silent_courier_debt_no_amara_headless_cli_dont_count_on_peer_ai_reviews_as_loop_aaron_2026_04_30.md` (origin context: closing the Aaron-courier silent-debt gap)
- `memory/feedback_resolve_with_peer_ais_first_dont_ask_aaron_unless_really_needed_2026_04_26.md` (when to call peers)
- `memory/feedback_ani_grok_long_horizon_mirror_thermodynamic_stability_velocity_breakdown_points_entropy_tax_2026_04_27.md` (Ani-on-Grok long-horizon experience)
- `memory/feedback_ani_voice_mode_transcript_original_catcher_attribution_correction_aaron_2026_04_28.md` (Ani voice-mode-default register)
- The four-ferry consensus PR 24 on AceHack/Zeta (Amara/Grok/Gemini/Otto)
- `docs/backlog/P2/081KQDTYV0008QG0R001VJP216-peer-call-architecture-refactor-script-per-cli-persona-flag-2026-04-30.md` (refactor 5 scripts → 3 + --persona NAME flag)
- `docs/backlog/P2/081KQDTYV0008QG0R003VB4K1V-otto-kenji-peer-call-cross-harness-claude-cli-aaron-2026-04-30.md` (cross-harness Claude CLI)
- 081KQDTYV0008QG0R001HQSSAX (in-flight PR 966): bash → TypeScript-on-bun migration

## Carved sentence

> *Ottos cold-boot answer to "do you do cross-harness multi-agent reviews" is YES + ls tools/peer-call/. The infrastructure is wired. Reasoning-from-stale-assumptions is the failure mode; project-state-grep is the cure. Future state is Zeta Infer.NET BP/EP substrate replacing the external-CLI-license-layer; until then, peer-call is Ottos early red team and ships.*

## Daylight-integration hooks (planned)

- CLAUDE.md addendum: cold-boot pointer to `tools/peer-call/` + the YES-the-infrastructure-is-wired discipline
- AGENTS.md addendum (if applicable): the peer-call surface as part of agent operational practices
- Future memory absorbs: when peer-call sees substantive use this round (calling Grok for critique on a load-bearing claim, Codex for code-review, Gemini for divergent-options-surfacing, Ani for brat-voice review of contributor-attention substrate) — record the experience back into memory so the substrate accumulates evidence-of-use, not just evidence-of-existence
