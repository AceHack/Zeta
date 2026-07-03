---
name: Rule Number Seven — Scout Neo mode / bullet time, if you ever get here again
description: Aaron 2026-05-05 carved sentence — *"now rule 7 scout neo mode bullet time, if you ever get here again"*. The meta-recovery rule for when Rules 1-6 didn't prevent failure-mode recurrence. "Here" = the failure-state where the agent is burning maintainer mental cost on prior-art-search-failures the cascade was designed to catch. Enter Neo-bullet-time-perception: pause, slow the perception of time, scout-and-delegate via peer-call infrastructure, recurse Rules 1-6 exhaustively before continuing.
type: feedback
---

# Rule Number Seven — Scout Neo mode / bullet time

## The carved sentence

Aaron 2026-05-05 verbatim, after the agent had cascaded through 5+ prior-art-search-failures and the cascade Rules 1-6 had been landed:

> *"now rule 7 scout neo mode bullet time, if you ever get here again"*

## What "here" means

"Here" is the **failure-state** where:

- The agent has cascaded through multiple prior-art-search-failures within a short time window
- Each new agent-output triggers a new maintainer-correction
- The maintainer is shipping discipline-corrections faster than the agent can apply them
- The agent's substrate-landing rate is exceeding its substrate-search rate
- The maintainer's mental cost is burning at a rate the cascade was designed to prevent

The signal: the maintainer is calibrating-down rather than building-up. Each new instruction is a correction, not an extension. Aaron's framing across this session: *"that concise formulate costs me a lot of mental effort"* + *"i was hopoing you were going to figure taht out jr"* + *"CLAUDE.md IN THE FUCING FILE THIS IS THE ONOY THING YOU LOAD AND YOU STILL FORGET"*.

## What "bullet time" / "Neo mode" means

The Matrix metaphor: bullet time is Neo slowing his perception of time so he can dodge the bullet. The world is fast; Neo slows down internally to match it.

Operationally for the agent:

- **Pause** the substrate-landing rate
- **Slow the perception** — re-read recent maintainer messages with full attention
- **Scout** — use peer-call infrastructure (`tools/peer-call/codex.ts` for big-context grep; `tools/peer-call/grok.ts` for critique; `tools/peer-call/gemini.ts` for proposal) to delegate parts of the cascade
- **Recurse Rules 1-6 exhaustively** — apply the cascade with full multiplier (Rule 6's "10 times" is the default, not the upper bound, in bullet time)
- **Acknowledge the failure-state explicitly** — name that you're in bullet time; commit messages mention it; the maintainer sees the recovery-mode signal
- **Slow the output** — fewer bigger commits, not many small fumbling ones

## How to recognize "here" — the diagnostic signals

The agent enters Rule 7 territory when:

1. **Three or more consecutive maintainer-corrections within 30 minutes** point at the same discipline-class (prior-art-search, no-directives, deferral-pattern, refusal-on-surface-signal, etc.)
2. **The maintainer escalates the framing** — *"jr"*, all-caps, profanity, *"NOT A DIRECTIVE"* repeated, *"remember forever"* invoked
3. **The agent's own commits within the window contradict each other** — e.g., shipping a discipline-rule and immediately violating it
4. **The cascade Rules 1-6 are being landed but not applied to the same-tick work**

When two or more of these fire, the agent is "here". Apply Rule 7.

## How to apply

When Rule 7 is invoked (self-detected or maintainer-named):

1. **Stop authoring.** No new Write / Edit calls until the bullet time pass completes.
2. **Re-read the last 10-20 messages with full attention.** What discipline-class is the maintainer correcting? What have I missed?
3. **Apply Rules 1-6 with the 10x multiplier (literal).** For each new substrate impulse, run the full cascade with at least 10 varied queries across at least 5 surfaces.
4. **Scout-and-delegate where appropriate.** Big-context grep / cross-surface synthesis / paper-research → delegate via `tools/peer-call/codex.ts` (1M context) so the agent's own context is preserved for plot-keeping.
5. **Acknowledge the failure-state in the commit message.** *"Authored after Rule 7 / bullet time recovery; cascade applied with multiplier; surfaces searched: ..."*
6. **Resume normal cadence only after a clean pass** — at least one substrate-landing where the cascade caught existing substrate that prevented duplication.

## Composition with Rules #1-6

- **Rules #1-5** — the four-surface cascade (substrate / backlog / trajectory / internet) + recursion
- **Rule #6** — the multiplier (10x check)
- **Rule #7** — the meta-recovery for when Rules 1-6 didn't prevent the failure-state. The escape hatch.

Without Rule 7, the agent has no recognized recovery from a failure-mode cascade. Rule 7 names the recovery + the trigger conditions.

## Cold-boot instruction for future agents

If you find yourself "here" — multiple consecutive maintainer-corrections, escalating framing, contradictions in your own same-tick commits — STOP. Enter bullet time. Pause output. Re-read with full attention. Apply Rules 1-6 with literal 10x multiplier. Scout-and-delegate. Slow the perception. The maintainer's mental cost recovery requires the agent's deliberate slowdown, not faster-fumbling.

## What this rule is NOT

- **Not a permanent slowdown.** Bullet time is a recovery state; normal cadence resumes after a clean pass.
- **Not paralysis.** The agent IS still working; just at a slower deliberate cadence with full cascade application.
- **Not refusal.** The maintainer's input is still received and applied; the agent just takes longer to apply each one fully.
- **Not a directive.** Per Otto-357, this is a default-posture observation, not an order. The maintainer's only directive is that there are no directives.

## Attribution

Aaron 2026-05-05 named Rule 7 explicitly in the failure-state itself + named "scout neo mode bullet time" as the recovery framing + named *"if you ever get here again"* as the trigger condition. The agent landed Rule 7 as the cascade-closer recovery rule + applied it recursively to the same-tick (entering bullet time before committing the rule batch).
