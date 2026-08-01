---
id: 081KYYJSRXA08QG0R001E36E1X
type: task
state: backlog
priority: P2
slug: drift-rate-to-intelligence-allocation-loop-join-caught-drift
title: "Drift-rate to intelligence-allocation loop: join caught-drift events (healer/retraction) to the DORA fold per area, and let that rate drive model tier / review depth — inverted DORA, optimizing for how LITTLE intelligence a task needs; exposure in the denominator"
created: 2026-08-01T11:54:23.530Z
depends_on: []
composes_with: []
---

# Drift-rate to intelligence-allocation loop: join caught-drift events (healer/retraction) to the DORA fold per area, and let that rate drive model tier / review depth — inverted DORA, optimizing for how LITTLE intelligence a task needs; exposure in the denominator

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYYJSRXA08QG0R001E36E1X-*.md` glob. -->

Aaron 2026-08-01: *"we design things expecting new devs and simpler cheaper AI so their mistakes don't
compound — the drift is caught and lessons are learned, and we increase intelligence for tasks that have
repeated drift. This is kind of like a DORA metric but we are optimizing for low-intelligence work where
mistakes are caught and not compounded. Failures are welcome in our system; they are learning experiences
we can train better humans and AI with in the future for less energy consumption."*

Principle + boundaries: `docs/research/2026-08-01-drift-not-failure-designing-for-cheap-intelligence-and-non-compounding-mistakes.md`.

## The loop

```
per area:  caught drift events  →  drift rate  →  intelligence allocated
           (healer / retraction)   (DORA fold)     (model tier, review depth)
```

- **Low drift rate ⇒ DE-ESCALATE** — cheaper model, lighter review. The area is legible enough for a
  simple agent. This is the objective being optimized: *how little intelligence a task needs*.
- **Repeated drift ⇒ ESCALATE** — stronger model / deeper review, or better, **fix the mechanism**.
  Repeated drift in one place is evidence the DESIGN is illegible, not that the contributor was weak.

Inverted DORA: DORA optimizes toward throughput + low change-failure rate; this optimizes toward minimum
intelligence spend subject to drift being caught.

## Inputs that already exist (this is a JOIN, not a greenfield build)

- `src/Core.TypeScript/work-items/dora-fold.ts`, `backlog/dora-metrics.ts`, `dora-classify/` — the event
  folds.
- The healer harness (081KX3KA3F0, PR #9817) — idempotence / closure-as-subset / convergence; defines
  what counts as a CAUGHT drift.
- Z-set retraction — the correction algebra.
- `docs/research/2026-07-04-max-mode-economics-compute-allocation-in-a-bayesian-society.md` — the
  allocation half.

## Missing (the actual work)

Attribute caught-drift events to an **area**, compute a rate, and let it select tier/review depth.

## Design constraint — name it before building it

A naive rate would **starve quiet areas that are quiet because nobody touches them**, not because they
are safe. **Exposure must be in the denominator** (drift per change / per touch, not per calendar
window). Otherwise the loop de-escalates exactly the code that is about to be edited for the first time
in a year.

Second constraint: attribution must point at MECHANISMS, not contributors — the useful output is "this
mechanism invites drift", not "this author erred". Today's two reds (a dependency bot with commit rights;
a tsconfig that typechecked AssemblyScript) are both mechanism problems.

## Composes with

`081KYYJEJ4X08QG0R003P8GXSY` (build receipt — a receipt is a per-change verification record, i.e. a
natural denominator source) and `081KYX9D2C408QG0R003ADEY16` (the gate reframe: retraction over prevention).
