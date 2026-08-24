---
id: 081M0T55Q09087G0R0039QASD1
type: task
state: backlog
priority: P2
slug: rx-joins-and-shivagc-wiring-stated-as-built-measured-absent
title: "Rx joins and ShivaGc wiring: stated as built, measured absent -- either build the seam or restate the claim"
created: 2026-08-24T15:10:40.649Z
depends_on: []
composes_with: []
---

# Rx joins and ShivaGc wiring: stated as built, measured absent -- either build the seam or restate the claim

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0T55Q09087G0R0039QASD1-*.md` glob. -->

## The gap

Aaron 2026-08-24 stated, as built: *"Rx-framework joins that are **GC-safe because of
ShivaGC**, and also **routable shapes** because of things like Reticulum protocol and
Orleans-like virtual actor routing and deactivation."*

Measured against `origin/main` @ `36c2ff55` (`git ls-tree` survey first, then targeted reads):

| stated | measured |
|---|---|
| Rx-framework **joins** | `src/Core/Rx.fs` is a ~120-line `OutputHandle -> IObservable` adapter plus an `IQbservable` skeleton. **No join operators at any definition site** (`join`/`combineLatest`/`zip`/`groupJoin`/`merge`/`withLatest`). The one file with "rx-join" in its name, `src/Core.TypeScript/observe/schema-rx-join.ts`, is schema-delta propagation to materialized views -- a different thing wearing the word |
| GC-safe **because of ShivaGC** | `Rx.fs` carries an explicit docstring headed *"WHY THERE IS NO SUBSCRIPTION-LEAK DISCIPLINE HERE"* whose answer is **room-scoped disposal**: the returned `IDisposable` tears down the whole pipeline. **`ShivaGc` is not mentioned and is not a dependency** |
| ShivaGc in service | `src/Core/ShivaGc.fs` has **zero non-test consumers** -- `Core.fsproj`, `Ephemeron.fs`, three test files, and one TS port (`shiva-weak-factor-graph.ts`) that is **self-labelled "ABANDONED - ZERO importers"** |
| Reticulum + Orleans deactivation | **both halves built, not wired.** `ShivaGc.rootsFromTraffic` / `deactivateIdle` is the Orleans idle-deactivation criterion, correctly anchored; `ReticulumLink.fs` / `reticulum-transport.ts` are the routing layer. **No call path takes a Reticulum destination to a `ShivaGc` grain activation** |

## Why this is a work-item and not a line in a research doc

A claim stated as **shipped** and measured as **absent** is exactly the class the meter exists to
separate (`toy-is-free-metered-must-be-earned`: unlabelled work is `unmetered`, never "real" by
default). Left only in prose, the sentence keeps circulating as an architectural fact and other
designs get built on top of it. Note that the repo's own surfaces are *not* at fault here -- `Rx.fs`
states its real guarantee precisely (*"NOT claimed: 'Rx can't leak.' Claimed: our lifetimes are
bounded above every subscription."*). The drift is between the code's honest docstring and the
spoken summary of it.

## Two acceptable dispositions -- both close this item

1. **Restate the claim** to what is built: *"Rx subscriptions are leak-bounded by room-scoped
   disposal; ShivaGc is a mark-sweep collector over reified `DynamicValue` heaps with no Rx
   consumer; Orleans-style deactivation is implemented and not yet routed over Reticulum."*
   Cheapest, honest, and probably correct for now.
2. **Build the seam**, with the precondition already measured. If Rx joins are added over
   regenerable (reclaim-bearing) values, their **duration windows must be driven by the injected
   phase / `VirtualTimeScheduler`, never `System.Reactive`'s wall-clock `Scheduler.Default`** --
   otherwise the join window is a choice context resolved by a wall clock, and silent regeneration
   becomes observable. That is a Semgrep-checkable rule, not a design opinion.

## Falsifier for disposition 2

A reclaim-bearing Rx pipeline, run under two memory envelopes, must produce the **same folded
conclusion** (value projection only -- not `ReferenceEquals`, not `Hits`/`Misses`, not wall-clock
latency), with a **mandatory negative control**: widening the observation to `ReferenceEquals` must
make the same test **fail**. A test that passes under both observation sets is not testing reclaim.

## Pointers

- `docs/research/2026-08-24-observably-infinite-nuf-is-already-observational-reclaim-is-a-weak-bisimulation-and-the-envelope-is-a-high-input.md` sections 8.2 / 8.3 / 6.1d -- the measurement and the precondition
- `src/Core/Rx.fs` -- the honest docstring this item defends
- `src/Core/ShivaGc.fs` -- `rootsFromTraffic` / `deactivateIdle` / `partition` / `resume`
- `src/Core/VirtualTimeScheduler.fs` -- the scheduler a reclaim-bearing Rx path must inherit
- `workitems/081M00SWEF0087G0R003C1TS8B-*` -- "name the reclamation-safety family"; this is the Rx corner of it
- `.claude/rules/toy-is-free-metered-must-be-earned.md`
