---
id: B-1037
title: The ball-number adapter — center±radius behind IUniversalNumber; lossy ops WIDEN (never silently round); ball comparisons return Tri
priority: P2
status: open
tier: substrate
tags: [universal-number, ball-arithmetic, triboolean, exactness, adapters, hexagonal]
created: 2026-06-11
owner: open (home: Core.FSharp.TriBoolean for the Tri-returning compare; adapter registered behind UniversalNumber's port)
---

# B-1037 — the metric register of "knows what it doesn't know" (Aaron 2026-06-11)

Design (small, from the capture docs/research/2026-06-11-the-number-that-knows-*): Ball =
{ Center: bigint-or-milli; Radius: nonneg } as an `IUniversalNumber` adapter. Laws: (1) exact ⇔
radius 0 (`IsExact` honest); (2) add/sub: radii add exactly; (3) mul: |a|·rb + |b|·ra + ra·rb,
rounded UP only (widening is the only permitted loss); (4) compare a b → Tri: T/F when intervals
are disjoint, **N on overlap** (the TriBoolean tie — predicates refuse to lie); (5) differential
oracle: MPFR/BigDecimal per the port's own plan. Beacon: Moore 1966; Arb (Johansson 2017);
Gustafson unums/valids. Distinct from SoftValue (bound vs belief — both registers stay).
