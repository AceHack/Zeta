---
id: B-0359
priority: P2
status: open
title: "Probabilistic type system — language-level confidence primitives (Hejlsberg/Syme lineage)"
effort: XL
created: 2026-05-09
last_updated: 2026-05-16
depends_on: [B-0358]
classification: research
decomposition: decomposing
children: [B-0552]
owners: [architect]
type: feature
tags: [type-system, probabilistic, research, language-design, bayesian]
---

# B-0359 — Probabilistic type system research arc

## What

Research trajectory: make probability flow across the entire
type system so "sharp" (bool/certainty) becomes impossible
without explicitly opting into a degenerate distribution.

Aaron 2026-05-09: *"imagine bools don't exist, they are just a
special case of a distribution that is either 0 or 1"* +
*"this is the lineage of Anders Hejlsberg — what he wanted to
do with C#/F# with Don Syme but they have not done it yet,
across the board to anything sharp to make probability flow
and the entire language not possible of sharp."*

## Lineage

- **Anders Hejlsberg** (C# designer) + **Don Syme** (F# designer):
  the vision of probabilistic types at the language level
- **Probabilistic programming languages**: Pyro, Stan, Gen.jl,
  Church, Anglican, Edward — DSLs on top of existing type systems
- **Zeta's ZSet algebra**: weights already ARE the confidence
  primitive (weight 1 = sharp, weight 0.7 = round)
- **B-0358**: incremental step (API returns float instead of bool)

## Three-mode design (Aaron 2026-05-09)

| Mode | Effect | Use case |
| ---- | ------ | -------- |
| `probabilistic: strict` | Enforces roundness — sharp is a compile error unless explicitly derived from a distribution | API surfaces, quality scoring, veridicality gates |
| `probabilistic: normal` | Both sharp and round available, no enforcement | Default for most code |
| `probabilistic: disable` | Fast path — real bools, no distribution overhead | Hot-path SIMD kernels, spine compaction, merge loops |

Same pattern as F#'s `--strict` / default / optimization
pragmas. The `disable` mode is the performance escape hatch:
code that operates on concrete values where sharp IS correct
opts out of distribution tracking entirely.

## Research questions

1. Can F#'s type system express "all returns are distributions"
   without a language fork? (Computation expressions +
   custom operators may suffice)
2. What's the query-language surface? If Zeta ships a SQL-like
   frontend, do WHERE clauses return probability-weighted rows?
3. How does this compose with the DBSP retraction algebra?
   (Retractions as negative probabilities = signed measures)
4. What's the relationship to quantum type systems?
   (Superposition = distribution over basis states)
5. How does `probabilistic: disable` compose with the .NET JIT?
   The mode boundary is the ASSEMBLY boundary (Aaron: "likely
   a different assembly" like `System.Runtime.CompilerServices.Unsafe`).
   `Zeta.Core.Simd` doesn't carry distribution overhead;
   `Zeta.Core.SignalQuality` does. The JIT knows at link time.
6. In `normal` mode, can the AOT/JIT elide distribution wrappers
   when the value is provably degenerate (always 0 or 1)?
   Same pattern as nullable analysis — track flow, elide when
   proven. Aaron: "our AOT/JIT should be able in normal mode
   to do the right thing most of the time."

## Not in scope for B-0358

B-0358 is the incremental API fix (bool → float returns).
This item is the longer research arc — making the TYPE SYSTEM
itself probabilistic, not just the API layer.

## Composes with

- B-0358 (bool → float API returns — prerequisite)
- `src/Core/ZSet.fs` (weights as confidence primitive)
- `src/Core/SignalQuality.fs` (gradient falsifiability)
- `src/Core/Veridicality.fs` (provenance scoring)
- Measure-theory foundations in `src/Core/NovelMath.fs`
