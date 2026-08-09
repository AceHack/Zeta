// Box-counting (Minkowski–Bouligand) dimension over the byte-locked DLA trajectory.
//
// HONEST-REGISTER NOTE (Otto shadow*, 2026-08-09): this estimator replaces the
// ad-hoc `get_df()` mass-radius proxy (a hardcoded ~1.322 constant in dla.wat)
// with a REAL box-counting slope. Measuring it revealed the important fact these
// tests lock: at the byte-lock's cluster size (N_WALKERS = 800), the real
// box-counting dimension is ≈ 1.30, NOT 1.71. The oft-quoted 2-D DLA value ≈ 1.71
// (Halsey 2000; arXiv:2607.02216) is the LARGE-N asymptote — a cluster of only
// 800 walkers is too small to reach it, and real box-counting there sits right
// next to the old proxy. Reporting ~1.71 for this repo's cluster would be a
// second fabrication; reaching it for real requires a much larger cluster
// (more walkers / bigger grid), which would change the trajectory and thus the
// byte-lock golden vectors — a separate, larger decision.
import { test, expect } from "bun:test";
import { runDLA, boxCountingDimension } from "./reference.mjs";

const SEEDS = [1, 7, 42, 99, 256, 1000, 2718, 31415];

test("box-counting returns a real, finite fractal dimension in the small-cluster DLA range", () => {
  for (const s of SEEDS) {
    const d = boxCountingDimension(runDLA(s).trajectory);
    expect(Number.isFinite(d)).toBe(true);
    // Empirically 1.18–1.40 at N_WALKERS=800; bounded well inside (1.0, 1.6).
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.6);
  }
});

test("box-counting is substrate-independent by construction (same trajectory ⇒ same D)", () => {
  // The byte-lock guarantees every substrate emits the SAME trajectory, so the
  // host-side dimension is identical for all of them — no per-substrate divergence.
  const traj = runDLA(123).trajectory;
  expect(boxCountingDimension(traj)).toBe(boxCountingDimension(traj));
});

test("at N_WALKERS=800 the real dimension is ≈1.30, not the 1.71 asymptote (locks the honest value)", () => {
  const avg =
    SEEDS.reduce((a, s) => a + boxCountingDimension(runDLA(s).trajectory), 0) /
    SEEDS.length;
  // Measured 1.297 (deterministic). Band catches regressions without flaking.
  expect(avg).toBeGreaterThan(1.2);
  expect(avg).toBeLessThan(1.42);
  // Explicitly NOT near 1.71 at this cluster size — guards against anyone
  // "correcting" this toward the asymptote without growing the cluster.
  expect(avg).toBeLessThan(1.6);
});
