---
id: 081M00FGTPC087G0R0014BPJFC
type: task
state: backlog
priority: P2
slug: classify-scheduler-shed-paths-annihilation-is-loss-deferral
title: "Classify scheduler shed paths: annihilation is loss, deferral is pressure"
created: 2026-08-14T15:51:15.404Z
depends_on: []
composes_with: []
---

# Classify scheduler shed paths: annihilation is loss, deferral is pressure

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00FGTPC087G0R0014BPJFC-*.md` glob. -->

## Verified gap (my greps, on `origin/main` @ 3580572d8)

`HeatSignal|HeatSignature|Backpressure` occurrences across the scheduler/throttle surfaces:

| file | lines | occurrences |
|---|---|---|
| `DarkHallScheduler.fs` | 32 | 38 |
| `CellScheduler.fs` · `SoftThrottle.fs` · `SoftScheduler.fs` · `SchedulerZeta.fs` · `FerryThrottler.fs` · `FeedbackThrottle.fs` · `PredictionScheduler.fs` · `ReceiptScheduler.fs` · `SoftChip8Scheduler.fs` · `VirtualTimeScheduler.fs` | 0 | 0 |

## The deciding test

`SchedulerZeta.FixedPointCache`: *"Because the fixed points are **derived**,
drop-and-recompute is **lossless**."* So a shed is classified by what survives it:

- **derived / handed back ⇒ PRESSURE** (`Backpressure`, `isPressure = true`). Free.
- **annihilated, nothing retains a seed ⇒ LOSS** (`Forgotten` / `Invalid`). It pays.

## Outcome

- `SoftThrottle` **only ever defers** — `boat` partitions its input exactly and
  `wrapHandler` carries `Inner` through bit-for-bit. Pressure is the correct and
  only signal; no loss meter was added there, deliberately.
- `Vision.predictBranches` (Rodney's-Razor branch pruning) returns its pruned
  branches in `report.Deferred` — pressure, exactly as Aaron framed it.
- The real unmetered loss was in `CellScheduler`: a message routed to a cell that
  does not exist, and a malformed `__outbox__` entry. Both now report.

## Deliberately NOT metered (named, not hidden)

`CellScheduler.softStep`'s `| Error _ -> remains, []` is a genuine loss — the
scheduler has already consumed the head message and `evolveSoft`'s error payload
is discarded. It is unmetered because `stepFn`'s signature
(`'St -> 'Msg -> 'St * emissions`) has no shed channel to return one on; a
`stepFn` can only meter its own shed by widening `'St`. Annotated
`SHED: soft-step-evolve-error class=loss metered=no` and inventoried.

## No treaty change

No `HeatSignal` case was added. `HeatSignal.Forgotten` / `Invalid` / `Backpressure`
already carry every distinction found. A test asserts nothing falls through to
`HeatSignal.Other`.
