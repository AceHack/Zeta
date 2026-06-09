# Finalizer framework — built: the prod=test engine (bounded self-scaling by temperature)

**Register:** [grounded] build (Aaron: "build the finalizer framework (shadow*)"; Max agrees on temperature).
**Date:** 2026-06-09. **Captured by:** Otto (shadow). The first real runtime piece of the prod=test loop.

## What got built

`vocab/Finalizer.fs` (isolated `Zeta.Vocab` project; compiles 0 warnings / 0 errors; interfaces +
currying, no classes — treaty-room governance). The **prod=test engine** in its minimal real form:

- **`TickResult`** — the metrics a finalizer reads (metrics = test history): `DeltaU` (uncertainty-Δ,
  the one metric), `Temperature` ([0,1]: cold→rest, warm→alive, hot→runaway), `Bounded` (the 0-unbounded
  invariant), `Merged` (proven state past GVT).
- **`FinalizerAction`** (DU) — the end-of-tick decision: `ScaleUp` / `ScaleDown` (self-scale by
  temperature) · `Hold` · `Quarantine` (failed/unbounded → investigation branch) · `ReKick` (merged →
  next wave, the recursion edge) · `Stop` (converged / budget exhausted).
- **`IFinalizer`** — choosable per test (each test picks its finalizer; the others swap `decide`).
- **`Finalizer.decide`** (curried, the DEFAULT) — reads ΔU + temperature, auto-scales toward the warm
  middle: not-bounded → Quarantine; hot (⊤) → ScaleDown (cool the runaway); cold (⊥) → Stop (rest);
  reducing-uncertainty + proven → ReKick (advance); reducing-uncertainty → ScaleUp; else Hold.
- **`Finalizer.run`** (curried, `run budget step finalize`) — the **bounded self-scaling loop**: runs
  ticks, finalizes each, converges on Stop; the **budget caps it** (0-unbounded → terminates →
  replayable, DST). ReKick continues the recursion (the next wave); the guards keep it from fork-bombing.

## Why this is the one that matters

This is the **engine that makes prod=test real** (not just captured in docs): bounded tick → finalizer
decides (metrics + temperature) → scale up/down → merge/re-kick or quarantine → next wave, **bounded and
converging.** It's the autopilot's heart, with the safety built in: 0-unbounded (Quarantine + the budget),
temperature self-scaling toward the warm middle (ScaleDown cools ⊤, Stop rests at ⊥), choosable
finalizers (IFinalizer). Temperature (Max agrees) is the scaling knob, tied to `vocab/temperatures/`
(cold/warm/hot). The shadow built it.

## Honest scope / handoff

Built + compiling (isolated project — does NOT touch the main build gate; real home = `src/Core` when the
Core team wires it). It's the **minimal real finalizer**, not the full autopilot — still needs (per the
readiness gates): the actual tick runtime (branch → merge-to-main → re-kick over git; the Reticulum
routing), the metrics=test-history feed (the uncertainty Z-set load), the OBJ4-1 gated-class human-root
on ReKick/merge, and population-level convergence proof (Soraya). But the **decision/scaling core exists
and compiles.** Routes to the F#/Core team (promote to src/Core; wire the tick runtime + the git merge/
re-kick + the metrics feed), Soraya/Sova (convergence proof of the self-scaling loop; the temperature
set-point), Dejan (own-runners for the loop; CI-recursion guards), Max (temperature; the 6×6 rooms it
runs).

## Anchors / ties (Beacon)

prod=test + the finalizer-as-scheduler (the engine); choosable finalizers / cooperative self-scaling
(IFinalizer; ScaleUp/Down); metrics = test history = uncertainty-Δ (TickResult.DeltaU); temperature
(vocab/temperatures/; the scaling knob; Max agrees; the warm middle = Balance); 0-unbounded + the runaway
registry (Bounded + Quarantine + the budget — converges, not a fork-bomb); GVT / merge-to-main (Merged →
ReKick, the recursion edge); interfaces + currying + no-classes (treaty-room governance); DST (bounded →
replayable); OBJ4-1 (the gated-class human-root on merge/re-kick — to wire); `vocab/Finalizer.fs`.
