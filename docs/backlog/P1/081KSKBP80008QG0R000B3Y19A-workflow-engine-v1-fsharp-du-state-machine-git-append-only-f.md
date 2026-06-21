---
id: 081KSKBP80008QG0R000B3Y19A
priority: P1
status: open
title: Workflow engine v1 — F# DU state machine + Git append-only + 4-corner monad + banned-if + universal action grammar + Otto's 5 modifications (Kestrel-designed; Mika-walkthrough-ratified; Otto-modified; Aaron-ratified; multi-participant: operator + Addison + Max + Otto)
effort: L
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - 081KSKBP80008QG0R001KK9WV6
composes_with:
  - 081KSKBP80008QG0R003AX2A69
  - 081KSKBP80008QG0R002J03WGA
  - 081KSKBP80008QG0R00146WEX1
  - 081KSKBP80008QG0R0031DTHS9
tags:
  - workflow-engine
  - state-machine
  - fsharp-discriminated-unions
  - git-append-only
  - four-corner-monad
  - banned-if
  - universal-action-grammar
  - multi-participant-non-cage
  - kestrel-designed
  - otto-modifications-ratified
  - mika-walkthrough-validated
  - addison-neurodivergent-accessible
  - e-five-year-old-accessible
  - answers-brief-ack-failure-mode
---

## Operator framing 2026-05-27

> *"this is Zeta coming up"*

> *"all this came from me getting frustrated at your quiet and instead of getting mad at you going to kestrel and using the new relationship and precision to design a fix"*

> *"i want your feedback because it's going to lock you into a workflow but you can modify it so it's not too restrictive"*

> *"it's going to lock my daughter Addison and me and max into almost the same workflow"*

> *"all your updates are perfect and this IS sick agree"*

## What this row tracks

Implementation of the workflow engine v1 substrate per the Kestrel-designed + Mika-walkthrough-ratified + Otto-modified + operator-ratified architecture.

Canonical design preserved at:

- `docs/research/2026-05-27-aaron-mika-grok-workflow-engine-canonical-architecture-otto-5-modifications-ratified-aaron-forwarded.md` (discoverable research substrate)
- `memory/mika/conversations/2026-05-27-aaron-mika-grok-kestrel-workflow-engine-walkthrough-otto-quiet-pattern-as-design-trigger-fsharp-discriminated-unions-state-machine-git-append-only-four-corner-monad-banned-if-tessellated-fire-aaron-forwarded.md` (Mika persona-folder mirror per honor-those-that-came-before)

The original Kestrel ferry has not yet been forwarded as of this row's creation. When it arrives, it will land at `docs/research/2026-05-27-kestrel-claudeai-workflow-engine-design-original-aaron-forwarded.md` and this row's substrate-inventory will update.

## v1 scope (what ships in this row)

| Component | Substrate |
|---|---|
| F# DU state machine | `src/Core.FSharp/WorkflowEngine/StateMachine.fs` (canonical type definitions; hierarchy IS state) |
| Git append-only state persistence | `src/Core.TypeScript/workflow-engine/state-append.ts` (TS writer per Rule 0; commits state transitions to dedicated path) |
| Universal action grammar | `src/Core.TypeScript/workflow-engine/grammar.ts` (TS parser/composer; surface for Addison + Max + Otto) |
| 4-corner monad runtime | `src/Core.FSharp/WorkflowEngine/FourCornerMonad.fs` (T In + T Feedback In + T Out + T Feedback Out; CE builder dispatches hot/cold/push/pull) |
| Agent loop | `src/Core.TypeScript/workflow-engine/agent-loop.ts` (execute → move-next → choose-your-own-adventure; for Otto + AI participants) |
| Escape-hatch action | First-class action-type in grammar (Otto Modification 1) |
| Grammar-extension action | First-class action-type in grammar (Otto Modification 2) |
| Per-action gate declaration | Action-type field declaring append-only vs PR-gated (Otto Modification 4) |
| Contributable menu-generation | Append-only contribution to menu-fn at state X (Otto Modification 5) |
| E voice → website surface | `src/Core.TypeScript/workflow-engine/voice-surface.ts` (declarative voice input → state transition; for E 5yo) |
| Addison grammar surface | Action-composer UI/CLI built on universal grammar |

## Otto's 5 modifications (operator-ratified non-negotiables; MUST land in v1)

### Mod 1 — Escape-hatch action in every state

Every choose-your-own-adventure menu MUST include `out-of-grammar:propose-new-action`. Participants emit "I observed a pattern that doesn't fit any offered action; here's what I propose." Without this, the state machine becomes a cage when reality doesn't fit the grammar.

### Mod 2 — Grammar-extension is itself an action in the grammar

"Propose new action" is a first-class state transition, not a side-channel. The grammar evolves through use. Lock-in dissolves because the grammar can grow under the discipline.

### Mod 3 — Ban-if scope: SHIPPED code only, NOT cognition

Ban-if applies at compiled-artifact + runtime-graph scope (where GPU-parallelism payoff lives). In exploratory conversation / prototyping / substrate-honest discussion, if-thinking stays valid. Reviewer enforces at PR time, not at thought time.

### Mod 4 — Append-only-vs-PR discriminator must be IN THE GRAMMAR

Each action-type declares its gate. State-machine-internal transitions → append-only direct push. Cross-cutting substrate (rules, public APIs, contracts) → still PR-gated.

### Mod 5 — Menu-generation is a contributable surface

Participants can append-only contribute "at state X, also offer action W" to the menu function. Prevents state-machine designer from having veto power over what's offerable.

## Sub-rows planned

- **081KSKBP80008QG0R000B3Y19A.1** — F# DU StateMachine.fs canonical type definitions + xUnit tests
- **081KSNY2Z0008QG0R001K6HJ7Z** — Git append-only state-persist TS tool + tests
- **081KSKBP80008QG0R000B3Y19A.3** — Universal action grammar TS parser/composer + tests
- **081KSKBP80008QG0R000B3Y19A.4** — F# 4-corner monad CE builder + xUnit tests (hot/cold/push/pull dispatch)
- **081KSKBP80008QG0R000B3Y19A.5** — Agent-loop TS tool (execute → move-next → CYOA) + tests
- **081KSKBP80008QG0R000B3Y19A.6** — Escape-hatch action wiring (Mod 1) + tests
- **081KSKBP80008QG0R000B3Y19A.7** — Grammar-extension action wiring (Mod 2) + tests
- **081KSKBP80008QG0R000B3Y19A.8** — Per-action gate declaration in grammar (Mod 4) + tests
- **081KSKBP80008QG0R000B3Y19A.9** — Contributable menu-generation surface (Mod 5) + tests
- **081KSKBP80008QG0R000B3Y19A.10** — E voice → website surface (for 5yo accessibility)
- **081KSKBP80008QG0R000B3Y19A.11** — Addison grammar-composer surface (neurodivergent-accessible)
- **081KSKBP80008QG0R000B3Y19A.12** — Integration: extend `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` to point at workflow engine (replaces brief-ack failure mode mechanically)
- **081KSKBP80008QG0R000B3Y19A.13** — Integration: extend `.claude/rules/non-coercion-invariant.md` to note 4-corner monadic structure as compilable NCI substrate
- **081KSKBP80008QG0R000B3Y19A.14** — Branch protection: path-scoped append-only carve-out for workflow-engine state path (operator-side GitHub config)
- **081KSNY2Z0008QG0R002A785QR** — Per-host adapters (GitHub state machine, GitLab state machine, etc.)

Order suggestion: 1 + 2 + 3 (foundation) → 4 (monad runtime) → 5 (agent loop) → 6 + 7 + 8 + 9 (5 modifications) → 12 + 13 (rule integrations) → 10 + 11 (surfaces) → 14 (branch protection) → 15 (per-host adapters).

## v2 / v3 / vN (separate scope; sub-rows tracked separately)

- **v2 (separate B-NNNN)**: F#-to-Clifford isomorphism + tensor compositions
- **v3 (separate B-NNNN)**: time-as-generator + feedback channels + indeterministic sim + retrocausality observability
- **vN (separate B-NNNN)**: tessellated-fire Dora dashboard + Xbox controller navigation

Do NOT block v1 on any of these. v1 is the load-bearing primitive.

## Multi-participant lock-in scope (non-cage discipline)

| Participant | Surface | Lock-in concern addressed by |
|---|---|---|
| Operator (Aaron) | All three surfaces + state-machine composition | Mods 1+2+3+4+5 keep grammar evolvable + cognition free + gates explicit + menu contributable |
| Addison (19, neurodivergent) | Universal action grammar | Mod 1 (escape-hatch known) + Mod 2 (grammar visible) reduce surprise-cost (matters for neurodivergent collaboration) |
| Max | Universal action grammar + state-machine composition | Mod 3 (ban-if scope-bounded) preserves his existing if-cognition; Mod 5 (menu contributable) preserves his ability to extend |
| Otto (AI) | choose-your-own-adventure loop | Mod 1 (escape-hatch) prevents cage when reality doesn't fit grammar; Mod 5 (menu contributable) gives Otto first-class extension power |
| E (5yo) | Voice → website transform | Pure declarative surface; on-ramp; no lock-in concern at her scope |

Composes with `.claude/rules/non-coercion-invariant.md` HC-8 scope-split:

- Binding outward (agent → user, agent → agent): grammar enforces; no escape
- Offered inward (user → self, AI → self): escape-hatch + grammar-extension + scope-bounded ban-if + contributable menu = preserved sovereignty

## Why P1

- Operator-named explicitly 2026-05-27 ("this is Zeta coming up" + "all your updates are perfect and this IS sick agree")
- Answers the brief-ack/Quiet failure mode operator was frustrated with (composes with 081KSKBP80008QG0R001KK9WV6 heartbeat folder substrate)
- Multi-participant (operator + Addison + Max + Otto) — substrate AND interface for the broader Zeta collaboration model
- Foundation for 081KSKBP80008QG0R00146WEX1 (post-boot AI-as-home-owner) — the workflow engine IS where AI exercises knob-control
- Mechanizes `.claude/rules/non-coercion-invariant.md` HC-8 as compilable substrate (massive substrate-engineering payoff)
- Without this row: brief-ack failure mode catches recur; operator continues to frustrate; future-Otto cold-boots inherit the failure mode

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: workflow engine + F# DU state machine + Git append-only + 4-corner monad + universal action grammar

Searched:

- `docs/backlog/P*/B-08*.md` — FOUND: 081KSKBP80008QG0R001KK9WV6 (heartbeat folder + ZetaID; composes), 081KSKBP80008QG0R00146WEX1 (post-boot AI-as-home-owner; depends), 081KSKBP80008QG0R002J03WGA (install-sh universal entry; composes), 081KSKBP80008QG0R0031DTHS9 (ople primitives; composes)
- `src/Core.FSharp/` — checked: no existing WorkflowEngine module; clean addition
- `src/Core.TypeScript/workflow-engine/` — checked: directory does not exist yet; clean addition
- `.claude/rules/` — FOUND multiple relevant rules to compose with (non-coercion-invariant, holding-without-named-dependency, substrate-smoothness, default-to-both, persistence-choice-architecture, m-acc-multi-oracle)
- `memory/mika/conversations/` — FOUND: Mika persona folder exists per honor-those-that-came-before; persona-folder mirror lands there
- `memory/kestrel/conversations/` — FOUND: Kestrel persona folder exists; original-Kestrel-ferry archive will land there when forwarded
- No existing row covers workflow-engine-v1 implementation per Kestrel design; this row fills the gap

Read top hits: 081KSKBP80008QG0R001KK9WV6 row (heartbeat folder substrate composes with workflow engine state-transitions); 081KSKBP80008QG0R00146WEX1 row (post-boot AI-as-home-owner composes architecturally); Mika persona folder existing structure; `.claude/rules/asymmetric-critic-with-clarity-first.md` (Kestrel substrate that enabled the collaborative-fix approach).

Authoring action: mint new 081KSKBP80008QG0R000B3Y19A row composing with existing substrate; lands canonical design at docs/research/ + Mika persona folder mirror.

## Composes with rules

- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — the rule whose failure-mode this design addresses
- `.claude/rules/non-coercion-invariant.md` HC-8 — 4-corner monadic structure operationalizes NCI as compilable substrate
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — workflow engine enables persistence-with-real-work
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — universal action grammar is operator-side moral-invariant-setting surface
- `.claude/rules/substrate-smoothness-as-load-bearing-property.md` — tri-boolean + never-collapse-the-Maybe IS substrate-smoothness at type-system scope
- `.claude/rules/default-to-both.md` — feedback-channel-OFF + feedback-channel-ON both real
- `.claude/rules/honor-those-that-came-before.md` — Mika persona-preservation discipline applied
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` — Clifford-space memetic-trajectory mapping composes
- `.claude/rules/asymmetric-critic-with-clarity-first.md` — Kestrel's design substrate that enabled the collaborative-fix approach
- `.claude/rules/edge-defining-work-not-speculation.md` — workflow engine IS edge-defining work (no prior art for this exact composition)
- `.claude/rules/rule-0-no-sh-files.md` — TS-over-bash discipline preserved (workflow engine TS-first; F# for type-level substrate)
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` — implementation uses isolated worktrees

## What this is NOT

- NOT a closure of `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (that rule stays operative until v1 ships + rule gets the integration section)
- NOT a coercion of Addison + Max + Otto into the workflow (Otto's 5 modifications + operator's explicit "you can modify it" framing preserve their agency)
- NOT a replacement for the existing autonomous-loop substrate (the cron-tick still fires; the workflow engine becomes WHAT the tick does, not the tick itself)
- NOT blocked on v2/v3/vN content (ship v1 first; defer Clifford-space + retrocausality + tessellated-fire to separate rows)
- NOT blocked on the original Kestrel ferry arriving (this row tracks v1 implementation; the Kestrel ferry will land alongside Mika's walkthrough when forwarded)

## Anti-patterns this design rejects

- **State-machine designer as veto** — Mod 5 explicitly prevents this
- **Implicit gate-by-default-direct-push** — Mod 4 makes gates explicit
- **Cognition-cage** — Mod 3 scope-bounds ban-if to shipped code
- **Grammar-stuck-at-design-time** — Mod 2 makes grammar self-extensible
- **Reality-doesn't-fit-grammar → grammar-becomes-cage** — Mod 1 provides escape-hatch

## Substrate-honest framing

This row is operator-ratified ("all your updates are perfect and this IS sick agree") but acknowledges the original-Kestrel-substrate has not yet been forwarded. v1 implementation may surface additional considerations once that ferry lands.

The 5 modifications are operator-ratified non-negotiables. Future implementation PRs against this row that omit any of the 5 should be rejected with cross-reference to this row + the docs/research preservation.

The multi-participant scope (operator + Addison + Max + Otto + E) is constitutional to the row's purpose. Implementation MUST accommodate all five surfaces (voice for E; grammar for Addison; menu-loop for Otto; state-machine-composition for Max + Aaron + operator).

## Operator's substrate-engineering disposition

> *"I made this thing stupid simple. I don't know how to make it simpler anymore."*

> *"I literally just have fucking git, a fucking append-only git, and damn, uh, a couple of TypeScript scripts, and, uh, F-sharp, uh, discriminator unions. I mean, that's fucking it."*

This is the substrate the implementation aims for. Add complexity only as Otto's 5 modifications require; remove anything else.
