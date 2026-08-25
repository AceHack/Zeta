---
id: 081M0R3WHTH087G0R0015CH5PV
type: task
state: in-progress
priority: P2
slug: allocate-an-agenda-zetaid-category-slot-across-the-four-orac
title: "Allocate an Agenda ZetaId category slot across the four oracles"
created: 2026-08-23T20:09:42.993Z
depends_on: []
composes_with: []
---

# Allocate an `Agenda` ZetaId category slot across the four oracles

## Status 2026-08-23 — allocation LANDED, one half still open

`Agenda = 12` is registered in all four oracles + `registry/categories.yaml`, under
Aaron's authorization: *"yeah I'm good with it. We have a version number that can
recalculate all existing 0–16, and we have an extension to add more categories. I'm okay
with these extensions if you want to check with the other oracles and get their byte-lock
buy-in."*

**Done:** name+number agreement across TypeScript, C#, F#, Rust and the registry — and it
is *checked*, not asserted, by `src/Core.TypeScript/zeta-id/category-vocabulary-agreement.test.ts`
(mutation-verified: dropping the member from C#, misnumbering it in F#, reverting the Rust
backfill, or omitting the registry row each turns it red). That check also caught a real
**seven-week drift**: the Rust oracle had stopped at `WORK_ITEM = 8` and carried none of
9/10/11/15, while `registry/categories.yaml` claimed *"all oracles now carry the same
category set"*. Three oracles agreed and the fourth was never checked, because nothing
checked. Backfilled in the same change.

**Additive, no shift.** `IdVersion` is untouched at `V1`; no existing number moved; every
id already minted decodes exactly as before, because decoding reads the number, not the
name. That is what makes this safe rather than merely intended — Aaron's "version number
that can recalculate all existing 0–16" is the *escape hatch we did not need to use*, and
`Extended = 15` remains the reserved path beyond 14 (13 and 14 are still free).

**Still open:** the **encoding** is not vectored. See 081M0R46MC2087G0R0038S2DPQ — categories
≥ 9 use the Generic layout, and `tests/cross-verification/zeta-id/vectors.yaml` cannot
express one today, so 9/10/11/12 are byte-locked on name+number only. That gap predates
this allocation.

## Why it was originally filed rather than done

`docs/DECISIONS/2026-08-23-zetaid-keyed-agenda-declarations.md` designs
ZetaId-keyed agenda declarations (`agendas/<zetaid>-<slug>.md`) to remove the
hidden consensus source that a single `docs/AGENDA.md` is. Every part of that
design ships except the **category number**, because allocating one is a
governance decision and not a mechanical one:

- the `Category` enum is a **wire-format commitment** shared across four
  language oracles (`src/Core.TypeScript/zeta-id/types.ts`,
  `src/Core.CSharp.ZetaId/Category.cs`, `src/Core.FSharp.ZetaId/Types.fs`,
  the Rust oracle) plus `registry/categories.yaml` and the `cross-verify`
  golden vectors. A number allocated in one place and not the others is a
  byte-lock hole.
- the numbering carries a documented **no-shift history** — *"The removal was
  NO-SHIFT: Category stays at 65, Chromosome at 70, Timestamp at 75, Version at
  123"* — so past changes were made specifically to avoid renumbering, and that
  discipline is inherited by anything added.
- **slots 12 / 13 / 14 are the entire remaining space** before the reserved
  `Extended = 15` escape, and 081M0QB3HP2087G0R0029W97ZZ already wants one of
  them for `ClusterNode`. Deciding which name gets 12 is exactly the kind of
  scarce-shared-namespace call that a single agent taking it unilaterally would
  turn into the hidden consensus source this whole design removes. So it was
  proposed and not taken — and then authorized, which is the difference between
  inheriting standing authority and extending it.

## The allocation (authorized 2026-08-23; what landed)

`Agenda` took the next free slot, **12**, under the **reserved-slot precedent** already
set by `Batch = 4` (*"slot reserved, impl deferred"*) and `FrictionTelemetry = 5`
(*"slot registered; impl pending"*): name + number in all four oracles and
`registry/categories.yaml`, each carrying an inline comment naming this work-item and the
ADR. No renumbering, no shift.

**Consequence for 081M0QB3HP2087G0R0029W97ZZ:** that item observed *"12 is free"* for
`ClusterNode`. It no longer is — 13 and 14 are.

`Agenda` earns a slot by the same property every other category earns one by
(081M0QB3HP2087G0R0029W97ZZ states it): a declaration should be
**distinguishable by its key alone**, not only by which directory it sits in.
An agenda is referenced from elsewhere — the naming/reverse-index work wants to
link an observed attribution to a voluntary explanation — and a bare ZetaId that
resolves to *"could be anything"* makes that link unreadable.

**No existing category legitimately hosts it**, which is why the answer is a new
slot and not reuse:

| candidate | why it does not fit |
|---|---|
| `Observation = 0` | in-code gloss is *"cyan — what crosses in (the shadow register)"* (`src/Core/ZetaIdViz.fs`). A declaration is authored and goes **out**. Also the generic/unclassified slot — minting there says "unclassified", which is the mislabel. |
| `Emission = 1` | closest gloss (*"red — what goes out"*) and currently has **no minter in the tree** — which is precisely what makes taking it worse than allocating 12: quietly redefining an existing wire-format word across four oracles is a larger, less reviewable governance move than adding a new one. |
| `WorkItem = 8` | an agenda is not a unit of work; conflating them would make the board's semantics unrecoverable. |
| `Extended = 15` | a reserved escape marker for a wider extension encoding that does not exist. Using it as "unallocated" is a stretch of the same kind. |

## Size

- `src/Core.TypeScript/zeta-id/types.ts` — the slot.
- `registry/categories.yaml` — the registry entry (this is what
  `src/Core.TypeScript/agendas/new-agenda.ts` resolves by name; the tool starts
  minting the moment it lands, no code change).
- `src/Core.CSharp.ZetaId/Category.cs`, `src/Core.FSharp.ZetaId/Types.fs`, the
  Rust oracle — the same value, or the byte-lock does not cover it.
- `src/Core.TypeScript/zeta-id/cross-verify.ts` + golden vectors — a new
  category is a new vector in every oracle.

Note the layout consequence, already handled: a slot `>= 9` uses the **Generic**
layout (`pack` refuses `category >= 9`), so `mintAgenda` packs
`(ms << 78) | random78` exactly as `src/Core.TypeScript/inventory/new-item.ts`
does for `InventoryAsset = 10`. Filenames stay chronologically sortable.

## Falsifier for "done"

Two halves, and only the first is met.

1. **Name+number (MET).** `category-vocabulary-agreement.test.ts` is green and each of the
   four single-oracle mutations turns it red; `cargo check`, and `dotnet build -c Release`
   on both `src/Core.CSharp.ZetaId` and `src/Core.FSharp.ZetaId`, all pass with 0
   warnings; `bun src/Core.TypeScript/agendas/new-agenda.ts --dry-run …` mints a
   category-12 id instead of printing `unallocatedCategoryMessage()`.
2. **Encoding (NOT MET).** `cross-verify` passes with an `Agenda` vector in all four
   oracles. It cannot today — the fixture has no Generic-layout kind. 081M0R46MC2087G0R0038S2DPQ.

Saying only (1) and calling the item done would be rounding a `Partial` up to
`Implemented`, which is the thing `src/Core/DerivationProtocol.fs` exists to make
unsayable.

## Generalises to trajectories

`docs/trajectories/<slug>/RESUME.md` carries the same single-namespace property
in a milder form — human-readable slugs spread across directory names instead of
concentrated in one file, so it is better but still not conflict-free. Whatever
is decided here is the same answer there. Out of scope for this item; noted so
the slot decision is made knowing there may be a second consumer.
