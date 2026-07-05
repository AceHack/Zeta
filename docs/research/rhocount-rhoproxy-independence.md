# rhoCount and rhoProxy are Independent Metrics

**Date:** 2026-07-05
**Status:** Confirmed by numerical sweep (N=8 cells, 200 rounds, 30 trials, 7 delay-spread values)

## Summary

`rhoCount` (temporal decorrelation) and `rhoProxy` (spatial decorrelation) are **independent
metrics** — they measure fundamentally different things and are not duals of each other.

| Metric | What it measures | Bus-delay sensitive? | Correct for Reticulum? |
|--------|-----------------|---------------------|----------------------|
| `rhoProxy` | Variance of posterior means across cells | **No** | No |
| `rhoCount` | CV of AccumulatedIV across cells | **Yes** | **Yes** |

## The Key Finding

In a homogeneous-signal environment (all cells observe the same signal, possibly at different
rates), `rhoProxy` converges to 1.0 regardless of bus delay. The reason is algebraic:

> If all cells observe the same signal with mean μ, then every cell's posterior mean converges
> to μ as the number of observations grows. The variance of the posterior means across cells
> therefore collapses to zero, making `rhoProxy = 1 - 0/max_var = 1.0`.

This means **rhoProxy cannot detect bus delay** in homogeneous environments. It is the wrong
metric for Reticulum networks, where bus delay is the primary decorrelation mechanism.

`rhoCount`, by contrast, measures the coefficient of variation of the per-cell observation
counts. When cells receive observations at different rates (bus delay), their counts diverge,
and `rhoCount` decreases. This is exactly the decorrelation we want to detect.

## Numerical Evidence

Sweep over bus delay spread ∈ {0, 0.1, 0.3, 0.5, 1.0, 2.0, 5.0} with N=8 cells,
heterogeneous signals (each cell has a distinct signal mean drawn from N(0, 4)):

| delay_spread | mean rhoCount | mean rhoProxy | corr(rhoCount, rhoProxy) |
|-------------|--------------|--------------|--------------------------|
| 0.0 | 1.0000 | 0.5999 | — (no variance) |
| 0.1 | 0.8995 | 0.5998 | 0.49 |
| 0.5 | 0.7010 | 0.6183 | 0.50 |
| 1.0 | 0.5723 | 0.5743 | 0.48 |
| 5.0 | 0.3166 | 0.5766 | 0.12 |

**Linear fit (final round, all trials):** rhoProxy ≈ 0.019 · rhoCount + 0.580, **R² = 0.004**.

The near-zero R² confirms that rhoProxy and rhoCount are essentially independent in the
long run. rhoProxy stabilizes around 0.58–0.62 regardless of delay spread, while rhoCount
decreases monotonically with delay spread.

## Interpretation

**rhoProxy** measures whether cells currently hold different beliefs. It is high when cells
agree (same posterior mean) and low when cells disagree. In a homogeneous environment, all
cells eventually agree (they all see the same signal), so rhoProxy → 1.0. In a heterogeneous
environment, cells may permanently disagree (different signals), so rhoProxy stabilizes at
some intermediate value that depends on the signal diversity, not the bus delay.

**rhoCount** measures whether cells are at different points in their belief trajectories. It
is high when cells have processed the same number of observations (synchronized) and low when
cells have processed different numbers (bus delay present). It is insensitive to signal content
— only the observation counts matter.

## Design Consequence

The Tsirelson reseed threshold (ρ_T = 1/(3√2) ≈ 0.2357) applies to **rhoCount**, not
rhoProxy, for Reticulum-style networks. The reseed trigger is:

```
isCollapsedTemporal tsirelsonThreshold ensemble
```

which fires when `rhoCount > 0.2357` (i.e., when the cells are too synchronized temporally).
The `isCollapsed` / `rhoProxy` path is retained for environments where bus delay is not the
primary decorrelation mechanism (e.g., a local in-memory ensemble where all cells are
synchronized by construction).

## Connection to the Egg/Bus-Delay Research Note

This finding is consistent with the earlier research note
(`the-egg-bus-delay-and-distributed-consciousness.md`): the bus delay is the "egg" that
keeps the cells decorrelated. When the bus delay collapses (all cells synchronized), the
ensemble collapses to a single voter. `rhoCount` is the correct metric for detecting this
collapse because it directly measures the bus delay's effect on the observation count
distribution.

## Open Question

Is there a regime where rhoProxy and rhoCount are correlated? The sweep suggests moderate
correlation (r ≈ 0.49) at low delay spreads in heterogeneous environments. This is because:

- Low delay spread → cells are nearly synchronized → rhoCount ≈ 1 → cells have similar counts
- Similar counts → cells have processed similar amounts of each signal → similar beliefs
- Similar beliefs → rhoProxy ≈ 1 (cells agree)

But this correlation breaks down at high delay spreads (r ≈ 0.12 at spread=5), because
cells at very different stages of their belief trajectories can still have similar posterior
means if the signal is strong enough to dominate the prior.

**Conjecture (open):** In the limit N_rounds → ∞ with a stationary signal, rhoProxy → 1.0
regardless of delay spread (all cells eventually converge to the true mean), while rhoCount
remains at its steady-state value determined by the delay spread. This would make rhoProxy
a lagging indicator (eventually collapses) and rhoCount a leading indicator (immediately
reflects bus delay).
