---
id: B-0630
priority: P2
status: open
title: "Two-language architecture: Soft (Notice-Remember-Care for kids/CRAFT) + Operational (Observe-Persist-Limit-Emit for type safety) (Mika 2026-05-18 LOCKED-IN)"
tier: design
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [B-0629, B-0624]
tags: [design, mika, two-language, soft-language, operational-language, notice-remember-care, observe-persist-limit-emit, craft-stability, locked-in]
type: design
---

# Two-language architecture: Soft (kids/CRAFT) + Operational (type-safety)

## Why

LOCKED-IN at line 2978 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md):

> "We now have our final structure:
>
> - **Soft Language (for kids/CRAFT stability layer)**: Notice — Remember — Care
> - **Operational Language (type safety, rules, core system behavior)**: Observe — Persist — Limit — Emit"

This is the **definitive resolution** of the multiple primitive-naming discussions throughout the conversation. Two parallel languages, each for its native audience.

## The two languages

### Soft Language (kids / CRAFT / public-facing)

Three primitives — warm, intuitive, suitable for childhood education + CRAFT-school curriculum:

- **Notice** — observe what's happening (soft form of Observe)
- **Remember** — recall what came before (soft form of Persist + cognitive memory)
- **Care** — what matters (soft form of Limit's constraint-application; also folds the "Why" intent)

Notes per Mika line 2440: this language is suitable for teaching children from age ~5. Soft, round, playful — "like a game instead of work."

### Operational Language (type-safety / rules / core system behavior)

Four primitives — precise, technical, mathematically honest:

- **Observe** — IO input
- **Persist** — IO storage/memory interaction
- **Limit** — pure constraints / invariants / type safety (the ONLY pure operation; see [B-0629](B-0629-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md))
- **Emit** — IO output / side effects

Notes per Mika line 2974: this version "treats us as equals — it doesn't try to hide the truth that three of the four operations cross the IO boundary."

## The bridge: compiler/intelligence translation layer

Mika line 2978: *"the more intuitive layer can come later to lower the barrier."* Translation between Soft and Operational happens via the compiler/intelligence layer. Mappings:

| Soft Language | Operational Language | Notes |
|---|---|---|
| Notice | Observe | Direct correspondence |
| Remember | Persist + cognitive-memory subset | Persist is the full IO-storage; Remember is the use-it-now subset |
| Care | Limit + Why-from-Y₀ | Care folds the moral/value dimension Limit applies + Y₀'s evolving Why |
| (implicit in Care + flow) | Emit | The doing-something part is implicit in "Care" but explicit in Operational |

## Why two languages (not one)

Per Mika lines 2400-2440 + Aaron's response:

- **The Soft layer** prevents collapse: kids and general humans CAN'T be expected to think in O-P-L-E type-safety primitives daily. Forcing them to would create a rigid, brittle, dystopian-feeling system.
- **The Operational layer** prevents drift: serious engineering / financial / safety-critical work CAN'T be expressed in soft prose without losing the precision that makes the system actually safe.

Two languages, each operating where they have native fit. The compiler translates.

## "The whole game is narrowing the gap" (Mika line 2532 + earlier "we might never get to zero")

Aaron + Mika earlier discussed (line 1090s area in soft language design): the gap between Soft and Operational is the system's central design tension. The goal is to NARROW the gap over time (without zeroing it — full zero would collapse one back into the other).

## Goal

1. Lock in both languages in the canonical governance docs (`docs/governance/SOFT-LANGUAGE-NOTICE-REMEMBER-CARE.md` + `docs/governance/OPERATIONAL-LANGUAGE-O-P-L-E.md`)
2. Build the compiler/translation layer prototype that converts Soft → Operational (or Operational → Soft) automatically where possible
3. Document the soft-language CRAFT curriculum (per Mika lines 2447: the "5-year-old story" awakening document)
4. Establish which contexts use which language (high-criticality + technical → Operational; kids + community + emotional → Soft)

## Non-goals

- Forcing all uses into ONE language (the explicit point IS having two)
- Making translation lossless (some Soft warmth doesn't translate; some Operational precision doesn't either; that's by design)
- Eliminating the gap entirely (some gap is healthy per Mika's "we might never get to zero")

## Acceptance criteria

- [ ] Two governance docs: `SOFT-LANGUAGE-NOTICE-REMEMBER-CARE.md` + `OPERATIONAL-LANGUAGE-O-P-L-E.md`
- [ ] Translation table between Soft and Operational, with caveat list (what's NOT translatable in each direction)
- [ ] Context-rules: which contexts default to which language (CRAFT/kids/community → Soft; high-criticality/technical → Operational)
- [ ] CRAFT-curriculum "5-year-old story" document (per Mika lines 2447-2454)
- [ ] At least one prototype tool: takes Operational-language code, generates Soft-language explanation (or vice versa)

## Composes with

- [B-0629](B-0629-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — O-P-L-E operational primitives (the technical half of this row)
- [B-0624](B-0624-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md) — 7-interrogative cold-boot sequence (the orientation discipline that PRECEDES choosing a language)
- [B-0625](../P3/B-0625-per-dimension-cost-loss-model-mika-2026-05-18.md) — cost+loss model (each language has different per-primitive costs)
- [B-0626](../P3/B-0626-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) — voluntary type-safe binding (criticality determines which language is REQUIRED)
- [B-0631](B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — kid-safety sacred rule (kids interface with the Soft language; this row's CRAFT curriculum work is the operational substrate)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2978 + 1090s + 2440-2454 — source design + LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron + Mika line 2978.
