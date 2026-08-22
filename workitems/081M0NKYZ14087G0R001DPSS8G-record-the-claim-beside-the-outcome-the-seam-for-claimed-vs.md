---
id: 081M0NKYZ14087G0R001DPSS8G
type: task
state: backlog
priority: P2
slug: record-the-claim-beside-the-outcome-the-seam-for-claimed-vs
title: "Record the CLAIM beside the outcome — the seam for claimed-vs-measured divergence"
created: 2026-08-22T20:52:55.972Z
depends_on: []
composes_with: []
---

# Record the CLAIM beside the outcome — the seam for claimed-vs-measured divergence

> **NOT BUILT IN THIS PR, ON PURPOSE.** This item names a seam so it is not
> re-derived from scratch later. It is not authorization to build a divergence meter.

## The target

Aaron, verbatim: *"our measurements over different models and how much they diverge
from self-claimed objectives are the key things we hope to formalize."*

`drift-rate` measures **outcomes**. The instrument Aaron is describing measures the
**gap between what an agent said it did and what is measurable** — per model, per
agent. Outcomes are the easy half; the claim is the half nobody records, and you
cannot fold a difference against a quantity you never stored.

## Why the seam is here specifically

`data/ci-runs.jsonl` is already the append-only log of what *happened*, keyed on a
`CheckId` shared with `db/drift-dashboard/roster.json`. It is the natural place for a
paired *claim* record, because a claim and its outcome must share a key or the
divergence is unjoinable. The minimal honest hook is one optional field on the record —
what the producer **asserted** at the moment it acted — stored beside what was
**observed**, never merged into it.

Two registers, never crossed, which is the same discipline as
`.claude/rules/local-time-never-enters-the-shared-fold.md`: the claim is testimony and
the outcome is evidence, and a fold that lets testimony into the evidence set has
already lost the measurement.

## The raw material this is derived from (2026-08-22, all in one day)

Not hypothetical. Each of these is a claim that a checkable record contradicts:

- a PR recording a decision as *"accepted by #13805"* when that PR never touched the field;
- three agents independently claiming the same fix;
- a test named `THE REGRESSION` that was reporting a **timeout**, not a regression;
- and the one this PR fixed: a workflow step that claimed to record telemetry, was green
  on every tick for its whole life, and landed nothing — `data/ci-runs.jsonl` has never
  existed on `main`.

That last one is the shape in miniature: the **claim** was "outcome recorded", the
**measurement** was `git log -- data/ci-runs.jsonl` returning empty, and the divergence
sat unmeasured because nothing joined the two.

## What must NOT be built casually

A divergence meter is a **classifier over agents**, which makes it a governance surface,
not a telemetry one:

- **Pigeonhole by self-claim, never by assumption** — the subject supplies the category.
  A meter that infers what an agent *meant* to claim is unfalsifiable by construction.
- **Detection is dual-use** (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`).
  Report the neutral fact (`ClaimUnsupportedByRecord`), never the verdict (`Lied`). A
  divergence has at least two honest readings — a wrong claim, and a measurement that
  looked in the wrong place. Today's material contains both.
- **`insufficient-data` must be its default too.** Divergence over three claims is the
  same numerology this PR removed from the trend, wearing a more consequential hat.

## Falsifier this item must ship with, when it ships

An agent that claims nothing must be indistinguishable from an agent that claims
correctly — i.e. silence must never score as honesty. If it does, the meter pays agents
to stop saying what they did, which destroys the very signal it measures.

## Pointers

- `src/Core.TypeScript/observe/drift-rate.ts` — the outcome log and its `CIRun` shape.
- `src/Core.TypeScript/drift-dashboard/fold.ts` — the state instrument; `CheckObservation`
  already separates *what a producer established* from *what it saw while looking*
  (`attempts`), which is the closest existing precedent for the two-register split.
- `src/Core/DerivationProtocol.fs` — `Evidence.AssertedOnly` / `supportsClaim`: this
  refusal already exists, typed, on the F# side. Reuse the vocabulary, do not re-coin it.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — a claim is `unmetered` until
  something can refute it; that IS the quantity this item proposes to measure.
