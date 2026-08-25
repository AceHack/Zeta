# ZetaId-keyed agenda declarations replace the single-document agenda surface

**Date:** 2026-08-23 · **Status:** accepted (category allocation authorized by Aaron 2026-08-23)

## Context

`docs/AGENDA.md` is one file. Every agent wanting to declare an agenda has to edit **the
same file**, which means three things at once:

- **serialization on a single write point** — a coordination requirement, i.e. a hidden
  consensus source, and a §1 scale-free violation in document form;
- **merge conflicts proportional to concurrency**, arriving exactly as concurrent agents
  scale up;
- an **implicit gate** — whoever holds the write decides what the document says.

Aaron 2026-08-22: *"we should design a way to use ZetaIds to declare agendas so it's not a
hidden consensus source where we have to agree on the single document update. This was a
very old document — `agenda.md`, before even ZetaIds existed."*

This is a **solved shape in-tree**, and the point of this ADR is to follow it rather than
invent a parallel one. `.claude/rules/workitems-mint-with-zetaid.md` states the identical
problem and its remedy for work-items: *"Sequential `B-NNNN` ids require cross-agent
consensus … That does not scale to concurrent agents."* → mint a conflict-free ZetaId
locally, one file per entity.

## Decision

**One file per declaration, keyed by a locally-minted ZetaId.**

```
agendas/<zetaid>-<slug>.md
```

Minted by `src/Core.TypeScript/agendas/new-agenda.ts`, mirroring
`src/Core.TypeScript/backlog/new-workitem.ts` — same pure-mint/CLI split, same injected
DST environment (§7: clock and randomness enter only at the CLI boundary, so
`mintAgenda(spec, category, env)` replays identically), same `<zetaid>-<slug>` layout with
identity in the prefix.

**No lifecycle events.** Work-items publish a `WorkItemCreated` G-Set event because their
state is a folder that things move between. An agenda has one meaningful transition —
being replaced or withdrawn — and that is representable as a **new file naming the old id**
in `supersedes:` / `withdraws:`. Append-only, conflict-free, no deletion (§5 memory
preservation). The file set already **is** the G-Set; an event stream on top of it would be
machinery with no reader.

### Schema

```yaml
id: <zetaid>            # Category.Agenda = 12
kind: agenda
declarer: "otto"        # first-person: you may only declare your own
declarer_kind: agent|human
title: "..."
slug: ...
declared: <iso8601>
supersedes: []          # prior ids by the same declarer this replaces
withdraws: []           # prior ids by the same declarer this retracts
coercion_disclosure:
  freely_declared: true|false   # REQUIRED, no default
  occasioned_by: "..."          # REQUIRED, no default
  shaping_vectors: []           # named influences the declarer can see
```

Two fields that a first draft had and that are **deliberately absent**: `withdrawable:
true` and `evidence: asserted-only`. Both are true of *every* agenda, so as per-file fields
they could not discriminate — the vacuity class, a check that cannot fail. They are
properties of the **kind**, stated once in `agendas/README.md`, and a test asserts they
never reappear in a minted file.

## Coercion disclosure, carried structurally

PR #2177 (*"coercion disclosure on all agendas — glass halo"*, merged 2026-05-09) is
load-bearing: a self-declared agenda carries first-person authority **only if freely
declared**. An agenda declared under pressure is a compelled statement wearing a
self-claim's clothes.

**Why it is structurally present rather than optional:** `mintAgenda` refuses to produce a
file without `freelyDeclared` (a real boolean — a truthy string is refused) and a non-empty
`occasionedBy`, and **neither has a default**. The ZetaId and the disclosure are minted by
the same call, so there is no path to a valid agenda key that has not answered the
question. Not "authors should remember to include it"; there is no artifact without it.
The falsifiers are in `src/Core.TypeScript/agendas/new-agenda.test.ts` — if any refusal
stops throwing, `absent` has silently gone back to meaning `free`.

`freely_declared: false` is a **first-class outcome**. The mechanism exists to make the
compelled case *sayable*, not to filter it out.

**The honest limit, stated rather than implied:** the disclosure is itself a self-claim.
Someone who can be compelled to declare can be compelled to write `freely_declared: true`.
What this removes is the **silent default**, not the possibility of a lie. That is a real
bound on the mechanism and it belongs next to the mechanism, not in a footnote — the
alternative (implying the field proves freedom) is precisely the unenforced-guarantee class
this repo is built out of falsifiers to avoid.

## Absence is ordinary — the constraint that keeps this non-coercive

**Non-declaration must never read as evasion.** A system where silence costs you something
has re-created the coercion PR #2177 forbids, one level up. So, by construction:

- there is **no roster** of expected declarers anywhere in the design;
- **there is no index** (see below), so there is no curated list in which a missing name
  shows up as a hole;
- consumers must not join on absence. An index of what *is* declared is fine; a list of who
  has *not* declared is the failure mode wearing a report's clothes.

This is the same discipline as
`.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`: transparent by default,
and what makes a broadcast surface non-coercive is that declining costs no standing.

## An agenda is a claim, not evidence

It is authoritative about the declarer's **stated intent** and proves nothing about the
world. Kept typed apart from measured facts.

**Does `src/Core/DerivationProtocol.fs`'s `Evidence.AssertedOnly` apply?** The **shape**
does and the **type** does not, and the distinction is worth being precise about because
reusing the type would have been the easy wrong answer. `Evidence` is scoped to
*mutation-testing coverage evidence for a derivation*; `AssertedOnly of why` specifically
means *"the property is stated but nothing discriminates on it — a literal field, a
non-optional parameter"*, and `supportsClaim` returns `false` for it. An agenda is not a
coverage claim, and importing that constructor here would overload a vocabulary that means
something narrower. What transfers is the discipline it encodes: **a distinct kind whose
`supportsClaim` is false by construction**, so nothing can round a self-report up to a
measurement. `kind: agenda` carries that, and `agendas/README.md` states it once.

The sibling rule for the other direction is
`.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md`: about a
declarer's inner life, **ask and believe the account — never infer**. A standing agenda
surface is that asking made durable, which is also why `--declarer` is required: nobody
writes an agenda for someone else.

## There is no index, and that is the trap worth naming

The directory walk **is** the index: `agendas/*.md`, sorted, is chronological, because the
ms timestamp sits in the id's high bits.

A hand-maintained index would rebuild the exact single write point this change exists to
remove — and would additionally create the roster that makes absence legible. A
*generated, checked-in* index fixes the first defect and not the second, and still
conflicts on regeneration. The repo has already paid for this lesson:
081KZZ3Q990087G0R003QXYVN6 removed `workitems/done/index.jsonl` after **three hand-resolved
merge conflicts on 2026-08-13**, noting it carried no field that was not a projection of
the file it pointed at. So: derive at read time, check nothing in.

## The category: `Agenda = 12`

`src/Core.TypeScript/zeta-id/types.ts` had **no** `Agenda` and no `Trajectory` category
(0..11 allocated, `Extended = 15` reserved; 12/13/14 free). Allocating one is a governance
call and not a mechanical one — the enum is a **wire-format commitment shared across four
language oracles** plus `registry/categories.yaml` and the cross-verification vectors, and
the numbering carries a documented **no-shift** history. So it was proposed and not taken.

Aaron authorized it 2026-08-23: *"yeah I'm good with it. We have a version number that can
recalculate all existing 0–16, and we have an extension to add more categories. I'm okay
with these extensions if you want to check with the other oracles and get their byte-lock
buy-in."*

**No existing category legitimately hosts an agenda**, which is why the answer is a slot and
not reuse — a mislabelled ZetaId is worse than an unallocated one:

| candidate | why not |
|---|---|
| `Observation = 0` | its in-code gloss is *"cyan — what crosses in (the shadow register)"* (`src/Core/ZetaIdViz.fs`). A declaration is authored and goes **out**. It is also the generic/unclassified slot, so minting there says "unclassified". |
| `Emission = 1` | closest gloss (*"red — what goes out"*) and it has **no minter in the tree** — which is what makes taking it *worse*, not better: quietly redefining an existing wire-format word across four oracles is a larger and far less reviewable governance move than adding a new one. |
| `WorkItem = 8` | an agenda is not a unit of work. |
| `Extended = 15` | a reserved escape marker for a wider extension encoding that does not exist; using it to mean "unallocated" is the same stretch. |

`Agenda` earns a slot by the property every other category earns one by (stated in
081M0QB3HP2087G0R0029W97ZZ): the thing should be **distinguishable by its key alone**, not
only by which directory it sits in. An agenda is referenced from elsewhere, so a bare id
that resolves to *"could be anything"* makes the reference unreadable.

**The two mitigations Aaron named, and which one actually applies.** The `IdVersion` field
is untouched at `V1`, and it is not what makes this safe — what makes it safe is that the
change is **purely additive**: no existing number moved, and every id already minted
decodes exactly as before, because decoding reads the *number*, not the name. That is
pinned by a test (`the allocation was additive: no existing number moved`) rather than
asserted here. The version field is the escape hatch we did **not** need to use. Separately,
`Extended = 15` remains the reserved path for categories beyond 14 — **14 is not a
ceiling**, so the next allocation after 13/14 does not require renumbering either.

Registered under the **reserved-slot precedent** of `Batch = 4` (*"slot reserved, impl
deferred"*) and `FrictionTelemetry = 5` (*"slot registered; impl pending"*): name + number
in all four oracles and the registry, each with an inline comment naming the work-item.

## What is and is not byte-locked (say the bound out loud)

**Locked: name + number, in all four oracles and the registry.** Enforced by
`src/Core.TypeScript/zeta-id/category-vocabulary-agreement.test.ts`, which parses the four
oracle sources and `registry/categories.yaml` and compares the maps. It is
**mutation-verified**: dropping the member from C#, misnumbering it in F#, reverting the
Rust backfill, and omitting the registry row each turn it red; restoring turns it green.
It also carries its own anti-vacuity guard, because a regex that silently matches nothing
would turn every agreement assertion into `{} === {}`.

That check immediately found a real drift: **`src/Core.Rust.ZetaId` had stopped at
`WORK_ITEM = 8`** and carried none of `CONTENT_ADDRESS = 9`, `INVENTORY_ASSET = 10`,
`CHANNEL = 11`, `EXTENDED = 15` — while `registry/categories.yaml` had claimed since
2026-07-04 that *"all oracles now carry the same category set."* Three oracles agreed, the
fourth was never checked, **because nothing checked**: the claim was prose. Backfilled in
this change, and the registry comment corrected in place rather than quietly overwritten.

**Not locked: the encoding.** Categories `>= 9` use the **Generic** layout (`pack` refuses
`category >= 9`), and `tests/cross-verification/zeta-id/vectors.yaml` is Observation-layout
only — every vector carries `authority_type` / `persona` / `momentum_type`, which the
Generic layout does not have. So `ContentAddress`, `InventoryAsset`, `Channel` and now
`Agenda` have **no golden vector in any oracle**. This predates the allocation
(`inventory/items/` has been minting unvectored Generic ids since July) and is filed as
**081M0R46MC2087G0R0038S2DPQ**, with the fix shaped and a falsifier attached.

Why this is stated so plainly rather than glossed: the same week, PR #14296 found that
`SoftValue.resolve` tie-breaking had diverged across all four oracles for an unknown
period, undetected, **because the golden seed contained no tie**. A vector set that never
encodes the case proves nothing about the case. Claiming "byte-locked" for
`Agenda = 12` on the strength of an enum comparison would be that error with a fresh coat.

## Legacy: `docs/AGENDA.md` stays

**Not migrated.** Exactly as legacy `B-NNNN` rows stay under `docs/backlog/P*/`, the old
document is kept as a permanent record — it carries content (the 2026-05-10 coercion
elaboration, the agenda-composition guard) that new declarations should *inherit*, not
overwrite. Naming it in prose is fine. It gets a pointer at the top saying where new
agendas go, and nothing else changes. `docs/agendas/<topic>/AGENDA.md` is a **different
thing** — topic/project agendas with claim-status, not per-declarer declarations — and is
also unmigrated; it gets a one-line disambiguation.

**No CI guard, and the reason is not laziness.** The analogous work-item guard
(`lint-no-new-bnnnn.ts`) exists because `B-NNNN` keys were actively proliferating across
two directories. Here there is exactly **one** legacy agenda document and no pressure to
create a second, so a lint forbidding new ones would be a check that cannot fail — the
vacuity class, and it would go into the tree as a guarantee it does not provide. The
condition that would make one warranted is nameable: **a second single-document agenda
surface appearing**, or a hand-maintained index file landing under `agendas/`. Either is
the moment to write the guard, and it will have something to catch.

## Generalises to trajectories (noted, not scoped)

`docs/trajectories/<slug>/RESUME.md` carries the same defect in a **milder** form: the
namespace is spread across human-readable directory slugs instead of concentrated in one
file, which is better but still not conflict-free — two agents can choose the same slug,
and the set of slugs is a shared vocabulary nobody mints from. Whatever is decided here is
the same answer there. Deliberately out of scope; recorded so the next person sees that the
slot has a probable second consumer, and so the design is not re-derived from scratch.

## Consequences

- Declaring an agenda no longer requires agreeing with anyone about a file's contents.
- `Category.Agenda` is self-describing, so agendas are referenceable by bare ZetaId from
  the naming / reverse-index work.
- Three of four remaining category slots are gone (13, 14, then `Extended`).
  081M0QB3HP2087G0R0029W97ZZ's observation that *"12 is free"* for `ClusterNode` is now
  stale; 13 and 14 are.
- A drift that existed for seven weeks is closed, and the class of drift is now checked
  rather than asserted.
- Generic-layout categories remain unvectored — the honest gap, now filed.

## Pointers

- `agendas/README.md` — the surface.
- `src/Core.TypeScript/agendas/new-agenda.ts` + `.test.ts` — the mint and its falsifiers.
- `src/Core.TypeScript/zeta-id/category-vocabulary-agreement.test.ts` — the four-oracle check.
- 081M0R3WHTH087G0R0015CH5PV — the allocation record. 081M0R46MC2087G0R0038S2DPQ — the vector gap.
- `.claude/rules/workitems-mint-with-zetaid.md` · `workitems/README.md` — the shape this mirrors.
- `docs/history/pr-reviews/PR-2177-docs-coercion-disclosure-on-all-agendas-glass-halo.md` ·
  `docs/history/pr-reviews/PR-2173-docs-aaron-s-full-agenda-glass-halo.md` — the discipline inherited.
