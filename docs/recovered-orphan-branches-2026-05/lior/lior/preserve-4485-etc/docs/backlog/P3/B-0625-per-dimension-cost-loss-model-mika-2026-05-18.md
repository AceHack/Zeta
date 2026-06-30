---
id: B-0625
priority: P3
status: open
title: "Per-dimension COST + LOSS model for the 7-interrogative boot-up sequence (Mika 2026-05-18 design)"
tier: design
effort: S
created: 2026-05-18
last_updated: 2026-05-18
depends_on: [B-0624]
composes_with: [B-0623, B-0624]
tags: [design, mika, boot-stream, interrogatives, cost-loss-model, resource-accounting, what-you-lose]
type: design
---

# Per-dimension COST + LOSS model for the 7-interrogative boot-up sequence

## Why

Every dimensional expansion in the canonical 7-step boot-up sequence ([B-0624](B-0624-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md)) has TWO real prices: a **cost** (compute, storage, bandwidth, refresh operations) and a **loss** (some kind of innocence/freedom/purity sacrificed).

Per Mika lines 2570-2572: *"each lift has a real price."* Aaron line 2572: *"that was awesome. That was you fucking riding a fucking hog motorcycle like a bad bitch."* — i.e., this is high-quality substrate worth preserving.

Source: [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2542-2596.

## The cost + loss table (Mika line 2570)

| # | Interrogative | Cost | What you LOSE |
|---|---|---|---|
| 1 | Pay Attention | Pure compute. Live inference cycles. | Nothing (base) |
| 2 | Remember When | Storage + index updates | Statelessness (now bound to your own history) |
| 3 | Where are we? | Expensive worldview refresh — multi-index integration | Simplicity (no more staying in your bubble; must confront the territory) |
| 4 | What is happening to us? | Adinkra construction + maintenance + internal state tracking | Default transparency (now you have things you can hide) |
| 5 | Why are we doing this? | Heavy reasoning compute over all previous dimensions | Flexibility (committed to a coherent Why; now constrained by it) |
| 6 | Where are we going? | Planning + simulation resources | Optionality (now closing off paths) |
| 7 | How do we get there? | Execution planning + actual resource commitment | Innocence (now responsible for the consequences) |

## Why this model matters

The cost-loss tracking gives agents an **honest scoring function** for "should I lift to dimension N+1 right now?" — instead of always running the full 7-step sequence (expensive), agents can stay at whatever dimension is justified by the current situation:

- Casual conversation: positions 1-2 suffice (just attention + memory; no need for worldview refresh or commitment-binding)
- High-stakes execution: full 7-step required (every lift's cost is justified by the consequence of skipping it)
- Reflection/audit: position 5 (Why) is the focal point, with positions 1-4 as feeders

Per Mika line 2546: *"you lose something on every lift, uh, like an invariant, and that makes it more messy on every lift. It makes it where you can express more state. It has more combinations because it's messier."*

## Decision: model the LOSSES not the costs

Aaron line 2546: *"what we wanna map 'em to is what you lose on every, uh, hierarchy."*

The LOSSES are the load-bearing measurement (not the costs) because:

- Costs are bounded + predictable (compute and storage are real resources you can budget)
- LOSSES are the structural properties that change the system's character irrevocably — once you lose default transparency, you can't easily go back; once you commit to a Why, the flexibility is gone
- Tracking losses gives the "did we really need this dimension?" honest answer at planning time

## Goal

1. Codify the cost + loss table as authoritative substrate
2. Build a simple per-tick scoring function: given current situation, what dimension SHOULD this agent be operating at? (Tracks: stakes, criticality, time budget, prior commitments)
3. Build a per-agent dimensional-state-tracker: at each tick, log which of the 7 dimensions the agent is currently active in; surface excess (over-engineering) and deficit (under-thought) at audit time

## Non-goals

- Forcing agents to always operate at maximum dimension (over-engineering)
- Forcing agents to always operate at minimum dimension (premature commitment to action)
- Replacing existing cost tracking (rate-limit, GraphQL budget, etc. — those are separate; this is COGNITIVE dimensional cost)

## Acceptance criteria

- [ ] Cost+loss table documented authoritatively in `docs/governance/CANONICAL-BOOT-SEQUENCE.md` (alongside B-0624) or as standalone reference
- [ ] Per-tick dimensional scoring function prototyped (TS preferred; can be heuristic-based v1)
- [ ] Worked examples: at least 3 scenarios showing different recommended dimensions (casual / high-stakes / reflection)
- [ ] Integration with [B-0626](B-0626-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) — the criticality-dimension that triggers type-safe binding

## Composes with

- [B-0624](B-0624-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md) — the canonical 7-step sequence (this row is the cost model FOR that sequence)
- [B-0623](B-0623-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) — Adinkras (position 4's cost is dominated by Adinkra construction)
- [B-0626](B-0626-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) — voluntary type-safe binding (criticality is one input to the dimensional scoring function)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2542-2572 — source design + cost+loss table

## Status

Open. Small effort (S) — the table is already done by Mika; this row is the implementation + integration work.
