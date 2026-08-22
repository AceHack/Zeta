---
id: 081M08802CZ087G0R0010ZE6FQ
type: task
state: backlog
priority: P2
slug: sim-as-the-room-runner-z-set-g-set-uncertainty-measurement-o
title: "sim as the room runner: Z-set/G-set uncertainty measurement over the injected-source seam"
created: 2026-08-17T16:13:41.663Z
depends_on: []
composes_with: []
---

# sim as the room runner: Z-set/G-set uncertainty measurement over the injected-source seam

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M08802CZ087G0R0010ZE6FQ-*.md` glob. -->

Aaron 2026-08-17: *"sim should be our room runner eventually … zsets/gsets over our rooms
uncertainty … inject real or deterministic simulation dependencies."* Plus the reframe: rooms are
the programming interface for non-technical humans, so the DI seam is the product thesis — one
artifact that is both the user's test and their production system.

Design + first increment: `docs/research/2026-08-17-sim-as-the-room-runner-the-injected-dependency-seam-is-the-product-thesis-not-a-test-harness.md`

## The headline finding

**The room runner already existed.** `src/Core/SimLoop.fs` is the `sim → mea → cut → loop` runner,
bounded by three finite rails, with an injected clock and a live consumer (`DarkHallScheduler.fs:473`);
`SimFramework.fs` is its hexagonal port; `SoftScheduler.Source` is the flag-free real-vs-simulated
seam. `ISim` in `clis/Verbs.fs` adds nothing over them and **cannot be implemented as written** —
`ISimVerb.Sim` returns `unit` while `IMeaVerb.Mea` consumes an `ISim<'a>` nothing produces, so the
documented `sim |> mea |> cut` does not typecheck. Undetected because `clis/` is in no project.

**The real gap was `mea`**, whose `'M` is unconstrained (its one consumer instantiates it as
`string list` — a log line, not a measurement).

**And a larger gap:** Addison Cooper's published definition of a Room (*Genesis Concepts*, 2026-06-20)
is an *"uncertainty engine"* holding *"known, unknown, assumed, disputed, and decided"*. Before this
work, **that five-way state had zero representation in the tree** (`Disputed`: no hits anywhere;
`Assumed`: two hits, both the unrelated *Assumed Density Filtering*).

## Shipped

- `src/Core/SimVerb.fs` — `Epistemic` (the five-way state, first in the tree), `Claim`/`Uncertainty`
  as a Z-set, the G-set `mea` fold, `AttributedBudget` (hidden-oracle guard), injected
  `ResolutionOracle` (§11 — the collapse is chosen, never baked in), and the first real `sim`
  implementation, as an object expression over the existing `SimLoop.run`.
- `tests/Tests.FSharp/SimVerb.Tests.fs` — 12 tests, two of them mutation-hardened.

## Not built (deliberate)

Reticulum-in-simulation (Aaron's own gate: *"once we can measure it accurate enough"*); reconciling
or retiring `clis/Verbs.fs`; Vault/room nesting; the bridge from the in-memory G-set to
`db/uncertainty/` via `measure.ts`.

## Honest registers

- **unmetered** — no claim that entropy metering is accurate enough for anything. **I searched for a
  measurement of current metering accuracy and found none — not a poor number, no number.**
- Both mutants **survived their first attempt** and exposed vacuous assertions of mine (a byte-lock
  is only as discriminating as the lens it measures through; a rail assertion matching all three
  rails accepts the mutant). Recorded in the doc §8.3 and at the test sites.
- `SimLoop.defaultBudget` is three unattributed constants — named, not changed (live consumer).
  Candidate #113 for the gating-constant audit.
