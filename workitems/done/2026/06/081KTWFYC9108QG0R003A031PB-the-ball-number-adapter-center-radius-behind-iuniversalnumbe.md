---
id: 081KTWFYC9108QG0R003A031PB
type: task
state: done
priority: P2
slug: the-ball-number-adapter-center-radius-behind-iuniversalnumbe
title: "The ball-number adapter — center±radius behind IUniversalNumber; lossy ops WIDEN (never silently round); ball comparisons return Tri"
created: 2026-06-11T23:23:00.000Z
depends_on: []
composes_with: []
---

# The ball-number adapter — center±radius behind IUniversalNumber

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTWFYC9108QG0R003A031PB-*.md` glob. -->

Migrated from the accidental legacy `081KTSZN10008QG0R003PHDV1C` row so the item lives on the current
ZetaId workitem surface instead of extending the frozen sequential backlog.

Owner note: open; home is Core.FSharp.TriBoolean for the Tri-returning compare,
with the adapter registered behind UniversalNumber's port.

Tags: universal-number, ball-arithmetic, triboolean, exactness, adapters, hexagonal.

## The metric register of knows what it does not know

Design (small, from the capture docs/research/2026-06-11-the-number-that-knows-*): Ball =
{ Center: bigint-or-milli; Radius: nonneg } as an `IUniversalNumber` adapter. Laws: (1) exact ⇔
radius 0 (`IsExact` honest); (2) add/sub: radii add exactly; (3) mul: |a|·rb + |b|·ra + ra·rb,
rounded UP only (widening is the only permitted loss); (4) compare a b → Tri: T/F when intervals
are disjoint, **N on overlap** (the TriBoolean tie — predicates refuse to lie); (5) differential
oracle: MPFR/BigDecimal per the port's own plan. Beacon: Moore 1966; Arb (Johansson 2017);
Gustafson unums/valids. Distinct from SoftValue (bound vs belief — both registers stay).

## DONE (2026-06-12) — Ball.fs ships in Core.FSharp.TriBoolean (Aaron: "i trust your judgement and love universal number")

All five designed laws landed with falsifiers + FsCheck properties (200 cases each):
(1) exact ⇔ radius 0; negative radius REFUSED never absorbed. (2) Moore add/mul exact at the
bigint carrier; CONTAINMENT property — points inside the inputs land inside the output, add and
mul. (3) `shed` = the lossy exemplar: center floors to the coarser grid, radius grows by EXACTLY
the distance moved (property: accounted loss + containment). (4) `lt`/`eq` return Tri — disjoint
decides, overlap and touching HOLD (Tri.N). Port adapter `Ball.universal`: IsExact honest;
BitsUsed = THE SIGNAL ABOVE THE NOISE (bitlen center − bitlen radius; exact ⇒ every bit; noise
taller than signal ⇒ 0). TriBoolean project gains its Zeta.Core reference (no cycle). Remaining
(port-wide, not this item): the MPFR/BigDecimal differential oracle.
