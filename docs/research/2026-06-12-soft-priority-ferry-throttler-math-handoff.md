# Soft PriorityFerryThrottler — Math Team Handoff

**Date:** 2026-06-12  
**From:** Alexa (Kiro)  
**To:** Math team (formal verification / soft-value modeling)  
**Status:** Research-grade  
**Operational status:** research-grade  

## Context

We just landed the hard `FerryThrottler` TypeScript port (PR #7861, merged) and designed the
`PriorityFerryThrottler` — a composition layer that manages N lane queues with a shared ferry
pool and a drain scheduler (strict priority or Deficit Round Robin). Design doc at:

`.kiro/specs/ferry-throttler-priority-lanes/design.md`

The existing `SoftThrottle.fs` already provides the soft half for the single-lane throttler:

- Logistic admission gradient (sigmoid pressure → admission probability)
- Flux tank (capacitor: charges idle, discharges on bursts, LC-tank resonance)
- Deterministic soft decisions (SplitMix64-seeded, DST-replayable)
- `wrapHandler` that wraps a scheduler handler with soft throttling

Aaron's directive: "send it to math team to figure out how to make the soft version of this
too in case you need changes to this version — we already have a soft ferry throttler, want to
be able to model this one too."

## Answers from Aaron (2026-06-12)

1. **Pressure: per-lane.** Each lane gets its own admission sigmoid with its own pressure
   reading. The per-lane backpressure in the hard design maps directly.

2. **Everything can be soft** — the drain scheduling, the DRR weights, the admission, even
   the emulator and the agent itself. The soft version should not artificially limit what can
   be a distribution. If the drain order can be a soft value (ensemble over permutations),
   let it. If the DRR weights can be soft values adapting to throughput, let them.

3. **Flux tank: per-lane, OR coupled — configurable, try both.** Start with per-lane tanks
   (independent LC oscillators per lane). Then add a coupled mode where discharging one
   lane's tank partially charges another (the coupling matrix encodes priority relationships).
   Expose as a setting so we can A/B the two modes and see the difference empirically.

4. **Heat budget: per-lane.** Each lane has its own thermal budget (independent Bekenstein
   accounting). High-priority lanes may have larger budgets or faster charge rates, but the
   accounting is lane-local.

## Design Implications for the Hard PriorityFerryThrottler

Given these answers, the hard design should ensure:

- **Per-lane config is rich enough** to carry soft parameters later (already true — per-lane
  `maxBatchSize`, `maxBatchBytes`, `maxQueueSize` map to per-lane tank capacity / charge rate).
- **The drain scheduler is a pluggable interface** (already true — `DrainScheduler` with
  `selectLane` + `recordDrain`). A soft scheduler just replaces the implementation.
- **Per-lane state is observable** (queue depth, drain count, bytes processed) so the soft
  layer can read pressure per-lane. → Add optional lane metrics to the design.
- **The coupled-tank mode means the drain scheduler needs access to all lane states** when
  making a decision (not just "has work?" booleans). → Widen `selectLane` to receive lane
  queue depths, not just booleans. This is a minor design change.

## Proposed Minor Design Change

In the current design, `selectLane` receives `laneHasWork: readonly boolean[]`. To support
coupled-mode soft scheduling and per-lane pressure reading, widen this to:

```typescript
interface LaneSnapshot {
  readonly hasWork: boolean;
  readonly queueDepth: number;
  readonly bytesQueued: number;
  readonly drainCount: number;
}

interface DrainScheduler {
  selectLane(lanes: readonly LaneSnapshot[]): number;
  recordDrain(laneIndex: number, batchSize: number, batchBytes: number): void;
}
```

This is additive (the strict-priority scheduler ignores the extra fields and still just
scans for the first `hasWork === true`), but the soft/coupled scheduler will use queue depths
and drain counts to compute per-lane pressure and coupled-tank interactions.

## What the Math Team Should Deliver

1. **`SoftPriorityThrottle` module** — the soft layer over `PriorityFerryThrottler`:
   - Per-lane sigmoid admission (pressure = f(queueDepth, drainRate))
   - Per-lane flux tanks (independent mode)
   - Coupled flux tanks (coupling matrix mode, configurable)
   - Soft DRR weights (distribution over weights, collapsing per-drain)
   - Soft drain order (ensemble over permutations, the `SoftEmu` pattern)

2. **Correctness properties for the soft regime** — how the 12 hard properties degrade
   gracefully (e.g., "strict priority ordering" → "priority ordering probability → 1 as
   k → ∞"; "no-starvation" → "expected drain proportion converges to weights").

3. **The coupled-oscillator formulation** — the coupling matrix, energy conservation
   constraints, and whether it satisfies detailed balance (so the stationary distribution
   is well-defined and the soft system has an equilibrium).

## What I Need Back

1. **Any changes to the hard `PriorityFerryThrottler` design** that would make soft modeling
   cleaner. Better to adjust now before implementation than retrofit later.

2. **The proposed `SoftPriorityThrottle` module shape** — what types and functions it exposes,
   how it composes with the existing `SoftThrottle.wrapHandler` pattern.

3. **Whether the correctness properties in the design doc need soft variants.** E.g., does
   "strict priority drain ordering" become "drain ordering probability converges to priority
   order as k → ∞" in the soft regime?

## Source Files

- `src/Core/SoftThrottle.fs` — existing soft throttle (single-queue)
- `src/Core/SoftEmu.fs` — soft emulator (ensemble modeling pattern)
- `src/Core/FerryThrottler.fs` — hard ferry throttler (F#)
- `src/Core.TypeScript/ferry-throttler/ferry-throttler.ts` — hard ferry throttler (TS port)
- `.kiro/specs/ferry-throttler-priority-lanes/design.md` — priority lanes design
- `.kiro/specs/ferry-throttler-priority-lanes/requirements.md` — priority lanes requirements
