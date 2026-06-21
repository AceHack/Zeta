---
id: 081KR50HA0008QG0R000CTEMGQ
priority: P2
status: backlog
title: F# Units of Measure for fusion-equation terms
created: 2026-05-09
---

# 081KR50HA0008QG0R000CTEMGQ F# Units of Measure for fusion-equation terms

**Origin:** claude.ai asymmetric-critic session (2026-05-07) + Aaron 2026-05-09

## Problem

The fusion equation `η · LearningGain(Δ_t) > ξ_t` was critiqued
(correctly) for lacking measurable units. F# Units of Measure (UoM)
can provide type-level dimensional analysis — the compiler enforces
that incompatible units cannot be mixed.

## Proposed approach

Define `[<Measure>]` types for the equation's terms:

```fsharp
[<Measure>] type friction
[<Measure>] type substrate
[<Measure>] type efficiency
```

Apply to the equation terms so `η : float<efficiency>`,
`LearningGain : float<substrate/friction>`,
`ξ_t : float<friction>` — making the inequality type-checked.

## Notes

- Aaron 2026-05-09: "we just started using it might not be a pattern
  that spread naturally" — track whether UoM adoption spreads
  organically before mandating.
- UoM is F#-specific; C# interop erases the units at runtime.
- The critic's challenge ("what's the type of LearningGain?") is
  directly answered by UoM annotations.

## Depends on

- Existing F# codebase surface in `src/Core/` and `src/Bayesian/`
