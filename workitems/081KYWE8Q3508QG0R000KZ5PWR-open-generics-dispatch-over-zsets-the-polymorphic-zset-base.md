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

## STATUS — increment 2 LANDED (2026-08-13): the typed operator IR / plan node. Work-item stays OPEN

Shipped: `src/Core/ZPlan.fs` — the typed plan IR over `ZSet<ZAtom>` ("the plan
names an operator, the rows name their types, and the dictionary joins them" —
now joined TWICE, deliberately): a deliberately **Z-linear** grammar
(`Source`/`Dispatch`/`FilterType`/`Sum`/`Negate` — nonlinear nodes absent until
their integration story is stated, so plans-as-deltas stays a theorem);
`inferTypes`/`validate` = the plan-time TYPE-FLOW analysis (every `Dispatch`
node checked against the registry for every tag that can reach it — a plan that
could meet an unroutable row is rejected as a PLAN, all failures listed);
`run` = the all-or-nothing evaluator (errors from BOTH `Sum` branches surface
together); `validateAgainstLogs` = the SchemaLog bridge (a source's tag set is
the FOLD of its schema log — a migration event flips the plan gate with no code
change; the falsifier proves add→reject→revoke→accept). 15 tests incl. FsCheck
over random plan TREES: whole-plan Z-linearity `run p (a+b) = run p a + run p b`,
retraction-rides-through, flow-analysis soundness (output tags ⊆ inferred tags).
Full F# suite 4881 green.

STILL OPEN: registry beyond int64/string (additive, deliberately unregistered);
canon `string` → bytes; Roslyn C# per-ring generator (GATED per Aaron 2026-07-02:
first non-test consumer or NuGet publish — gate respected, not built); nonlinear
plan nodes (distinct/join) with their integration story; plan serialisation
(a stored proc as data needs a wire form — sequence after SchemaLogCodec's
pattern proves out).
