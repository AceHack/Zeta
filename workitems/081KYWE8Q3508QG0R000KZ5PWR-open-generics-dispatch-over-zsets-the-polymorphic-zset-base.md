---
id: 081KYWE8Q3508QG0R000KZ5PWR
type: task
state: backlog
priority: P2
slug: open-generics-dispatch-over-zsets-the-polymorphic-zset-base
title: "Open-generics dispatch over ZSets — the polymorphic ZSet base atom"
created: 2026-07-31T15:56:41.445Z
depends_on: []
composes_with: []
---

# Open-generics dispatch over ZSets — the polymorphic ZSet base atom

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYWE8Q3508QG0R000KZ5PWR-*.md` glob. -->

## Context

Aaron 2026-07-31: *"open generics dispatch over zsets ... is our entire db stored-proc architecture long term."*
Source: [`docs/research/2026-07-01-the-polymorphic-zset-base-atom-open-generics-dispatch-and-schema-as-events-on-the-zset.md`](../docs/research/2026-07-01-the-polymorphic-zset-base-atom-open-generics-dispatch-and-schema-as-events-on-the-zset.md).
Push forward: open-generics dispatch over the polymorphic ZSet base atom — the runtime dispatch that lets ZSet operators specialize per stored type.

## STATUS — increment 1 LANDED (2026-08-01, PR #9841). Work-item stays OPEN

Design finding: the doc carries TWO open generics and one was ALREADY LANDED — the **weight** axis
(`'W` over `ISemiring`, struct-ring monomorphisation) lives in `ZSetW.fs`'s `*By` ops. The un-landed
axis, and the one this item names, is the **element/row** type; for a row typed only at RUNTIME, §4's
**path 1 (dictionary-passing, Wadler–Blott 1989)** is the CORRECT mechanism, not the demoted fallback
(it is demoted for the weight axis precisely because the ring is statically known there).

Shipped: `src/Core/ZAtom.fs` — type-tagged key `(TypeId, Canon)` (heterogeneous `ZSet<ZAtom>`, no boxed
`obj`, and **no registry lookup in the compare path** — a mutable global there would make sort order
depend on registration order: capture + DST hazard); `Collation.binary` not F#'s structural default;
`IZAtomType` (free, stateless) + immutable `ZAtomRegistry` (the dictionary made a value; duplicate
TypeId is an `Error`); two genuinely different impls (int64 canon ORDER-PRESERVING so codepoint order IS
numeric order; string `double` = concatenation, the same `x⊕x` in a different monoid); `mapValues` is
ALL-OR-NOTHING (a partial result would be a silent drop wearing an `Ok`). 29 tests incl. a guard that an
unregistered row hidden among succeeding rows still fails the call. Full suite 4458 passed.

STILL OPEN: only `int64` + `string` registered (float/bool/bytes/array/object unregistered ON PURPOSE,
absence is a tested loud error; extending is additive); typed operator IR / plan node; Roslyn-generated
C# specialisations (§4's C# half — belongs to the weight axis); §7's benchmark gate (path 1 is the cold
path by construction — no perf claim is made); canon is a `string` not bytes.
