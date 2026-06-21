---
id: 081KSNY2Z0008QG0R003206PFM
title: Agent-loop primitive-naming alignment — observe/emit/limit/simulate vs observe/persist/limit/emit vs observe/choose (operator architectural decision in flight)
status: open
priority: P2
created: 2026-05-28
attribution: aaron-2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A.5
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSKBP80008QG0R000B3Y19A.5
  - 081KSNY2Z0008QG0R0031490KZ
  - 081KSKBP80008QG0R0031DTHS9
tags:
  - architectural-decision
  - naming
  - workflow-engine
  - agent-loop
---

# 081KSNY2Z0008QG0R003206PFM — Agent-loop primitive-naming alignment

## The architectural question (operator 2026-05-28, in-flight)

> *"i guess to follow our pattern it should be observe.ts and emit.ts or choose if we like better i'm trying to figure out the mapping to observe emit limit simulate choose and our workflow i know you can treat it as the internal loop vs external multi agent coordination loop they compose but are independent, trying to map it directly to observable let me send you a conversation."*

Operator named the workflow-engine entry points as `observe.ts` + `choose.ts` per the initial direction (current Phase 1 skeleton draft in flight per [081KSKBP80008QG0R000B3Y19A.5](081KSKBP80008QG0R000B3Y19A.5-...) substrate). On reflection, operator surfaced the deeper question: how do the agent-loop entry-point tools map to the broader framework primitives the substrate has been building toward?

## Three naming conventions alive in substrate (as of 2026-05-28T04:50Z UTC)

| Convention | Source | Primitives |
|---|---|---|
| **OPLE** | [`.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md`](../../../.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md) + 081KSKBP80008QG0R0031DTHS9 | **O**bserve / **P**ersist / **L**imit / **E**mit |
| **OELS** | [081KSNY2Z0008QG0R0031490KZ](../P3/081KSNY2Z0008QG0R0031490KZ-observe-emit-limit-simulate-in-clifford-space-unified-algebra-for-three-primitive-substrate-aaron-2026-05-28.md) filename | **O**bserve / **E**mit / **L**imit / **S**imulate |
| **Operator initial direction** | This conversation 2026-05-28T~04:43Z | **Observe** / **Choose** (compressed 2-tool form, agent-loop entry-point only) |

## What's the same across all three

- **Observe** appears in every convention as the first primitive (refresh-then-read substrate freshness)
- **Limit** appears in OPLE + OELS (per 081KRW63S0008QG0R002ZRNDJ8 Limit-is-simulation-not-collapse — same construct, two namings)
- The agent-loop workflow IS one specific instantiation of these primitives — not the only one

## What's different

| Primitive | OPLE | OELS | observe/choose | Substrate where |
|---|---|---|---|---|
| Persist | yes | no | no | Persist = write to git append-only (per agent-loop SKILL.md "State persists in Git append-only") |
| Simulate | no | yes | implicit-in-choose | Simulate = Limit-as-pre-commit-dry-run (per 081KRW63S0008QG0R002ZRNDJ8); could be subsumed under Limit or named separately |
| Emit | yes | yes | implicit-in-choose | Emit = ship substrate / heartbeat / commit |
| Choose | no | no | yes | Choose = menu-generation + LLM-as-pure-selector (per agent-loop skill design) |

## Internal-loop vs external-coordination-loop framing (operator surfaced)

> *"you can treat it as the internal loop vs external multi agent coordiantion loop they compose but are independent"*

This is the deeper architectural question. Two distinct loops compose without being the same:

| Loop | Scope | Primitives that fit |
|---|---|---|
| **Internal agent loop** (single agent per tick) | Observe → Choose → Execute → Emit-result | observe.ts + choose.ts + executor.ts (per current SKILL.md v2 design) |
| **External multi-agent coordination loop** | Observe (cross-agent) → Negotiate / Limit-simulation → Emit (consensus / proposal) | OPLE or OELS at multi-agent BFT scope (per 081KS3X9Y0008QG0R00218150M + 081KRW63S0008QG0R001Z7NYMV NCI substrate) |

The agent-loop entry-point tools (`observe.ts` + `choose.ts`) may operate at the **internal-loop scope**; the OPLE/OELS primitives may operate at the **external-coordination-loop scope**. They compose (internal-loop emits substrate that external-loop observes; external-loop's consensus shapes what's available for internal-loop to choose) but are independent.

## Three viable resolutions

| Option | Tool names | Tradeoff |
|---|---|---|
| **A: observe + choose** (operator's initial direction) | `observe.ts` + `choose.ts` | Cleanest cognitive grammar ("look then decide") at internal-loop scope; doesn't map 1:1 to primitive 4-tuple. Sub-tools (`simulate.ts`, `emit.ts`) can be added later as `choose.ts` decomposes. |
| **B: observe + emit (per OPLE alignment)** | `observe.ts` + `emit.ts` | Maps to OPLE primitive naming. `choose` becomes a step inside `emit` (or a separate planning helper). |
| **C: 4 separate primitives** | `observe.ts` + `persist.ts` + `limit.ts` + `emit.ts` (OPLE) OR + `simulate.ts` (OELS) | Maximally primitive-aligned; more files; more composition. Multiple options Aaron can pre-arrange in sentinel. |

## Current state of work-in-flight

- `observe.ts` (~270 lines) authored locally at `~/.zeta/agents/otto-cli/observe-choose-skeleton-0512z/tools/agent-loop/observe.ts` per Option A
- `choose.ts` (~220 lines) authored alongside
- **Both un-committed** — operator architectural decision pending; rename/restructure cheap from current draft
- Tests not yet written

## Composes with

- [081KSKBP80008QG0R000B3Y19A.5](081KSKBP80008QG0R000B3Y19A.5-...) — agent-loop substrate (parent direction)
- [081KSKBP80008QG0R000B3Y19A](081KSKBP80008QG0R000B3Y19A-...) — workflow engine v1 (umbrella)
- [081KSNY2Z0008QG0R0031490KZ](../P3/081KSNY2Z0008QG0R0031490KZ-observe-emit-limit-simulate-in-clifford-space-unified-algebra-for-three-primitive-substrate-aaron-2026-05-28.md) — OELS substrate (Clifford-space-unified-algebra angle)
- [081KSKBP80008QG0R0031DTHS9](081KSKBP80008QG0R0031DTHS9-...) — OPLE T-TFeedback implementation (framework primitive scope)
- [081KS3X9Y0008QG0R00218150M](081KS3X9Y0008QG0R00218150M-...) — multi-oracle BFT (external-coordination-loop substrate)
- [081KRW63S0008QG0R001Z7NYMV](081KRW63S0008QG0R001Z7NYMV-...) — NCI HC-8 (constitutional floor for coordination-loop)
- [081KRW63S0008QG0R002ZRNDJ8](081KRW63S0008QG0R002ZRNDJ8-...) — Limit-is-simulation-not-collapse (Simulate ≅ Limit composition substrate)
- `.claude/skills/agent-loop/SKILL.md` — workflow-engine substrate (consumer of decision)
- `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md` — OPLE rule

## Acceptance criteria

1. Operator forwards / completes architectural conversation re: OPLE/OELS/observe-choose mapping
2. Decision recorded: which tool-naming convention applies at agent-loop-entry-point scope
3. Whether internal-loop vs external-coordination-loop split is load-bearing (and which loop the agent-loop tools belong to)
4. Local `observe.ts` + `choose.ts` draft refactored / renamed per decision
5. Tests authored (deferred from Phase 1 pending naming)
6. Ship as Phase 1 substrate per [081KSKBP80008QG0R000B3Y19A.5](081KSKBP80008QG0R000B3Y19A.5-...)

## Substrate-honest framing

This row does NOT decide the naming convention. It captures the architectural question so that:

- If operator gets pulled away, the question is preserved as substrate for resumption
- Future-Otto cold-booting can read this row before resuming agent-loop work
- The three viable resolutions are documented; the decision space is bounded
- Local draft work isn't lost (path documented at `~/.zeta/agents/otto-cli/observe-choose-skeleton-0512z/`)

The row exists because the conversation may continue across context boundaries; substrate preservation lets the decision survive any context loss.

## Full reasoning

Operator 2026-05-28T04:50Z verbatim (preserved above). Conversation thread:

1. Operator 04:42Z: *"we need to change your sential to just call observe.ts that's our workflow and then choose.ts to choose the action based on the results observe can ensure current state is fresh enough before looking up current DU state machine state"*
2. Otto: reads agent-loop substrate; surfaces missing observe.ts + choose.ts entry points; AskUserQuestion on scope + state source
3. Operator: Phase 1 only (skeletons) + state source = both (heartbeat primary + git fallback)
4. Otto: authors observe.ts + choose.ts skeletons
5. Operator 04:50Z (this conversation): surfaces OPLE/OELS/observe-choose mapping question; promises to forward a conversation
6. Otto: holds work un-committed; files THIS row at brief-ack #6 per holding-without-named-dependency rule forced-escalation per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`

This row IS the Phase 1 brief-ack-#6 forced decomposition. Counter resets cleanly. Operator's forwarded conversation arrives → resume agent-loop substrate work per the decision recorded above.
