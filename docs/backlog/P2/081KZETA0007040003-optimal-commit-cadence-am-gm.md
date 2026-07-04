---
id: 081KZETA0007040003
priority: P2
status: open
title: Optimal commit cadence (τ* = L/√α) — AM-GM scheduling hint in ferry-throttler
created: 2026-07-04
last_updated: 2026-07-04
depends_on: []
tags: [ferry-throttler, scheduling, thermodynamics, optimization]
type: task
---

# Optimal commit cadence (τ* = L/√α)

Soraya derived (2026-07-03): minimize total cost `L²/τ + α·τ` → optimal cadence
`τ* = L/√α` by AM-GM. Wire this as a scheduling hint in the ferry-throttler so
it auto-tunes the flush interval based on measured thermodynamic length L² and
queue pressure α.

## Acceptance criteria

- A `computeOptimalCadence(thermLength: number, queuePressure: number): number` function
- Integrates with PriorityFerryThrottler's drain scheduler
- The flush interval adapts toward τ* as the system measures L² and α empirically
- Tests verify: at τ*, total cost is minimized (any deviation increases cost)
- Z3 lemma for the AM-GM optimality (single-tool, P2 per Soraya's routing)
