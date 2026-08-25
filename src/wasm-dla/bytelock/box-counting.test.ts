// Box-counting (Minkowski-Bouligand) dimension over the byte-locked DLA trajectory.
//
// HONEST-REGISTER NOTE (Otto shadow*, 2026-08-09; CORRECTED by Lumen 2026-08-25).
//
// The 2026-08-09 note said this estimator "replaces the ad-hoc get_df() mass-radius
// proxy (a hardcoded ~1.322 constant in dla.wat)". TWO CORRECTIONS, both measured:
//
//   1. There is NO 1.322 constant in dla.wat's executable path. The number appears
//      only in a COMMENT. `get_df()` actually returns `csize / (maxR*maxR)` -- a
//      number DENSITY, not a dimension -- which measures 0.248-0.450 on the eight
//      seeds below, a factor of 3-5 from the 1.322 its own comment claims.
//
//   2. The old note explained the ~1.30 reading as "800 walkers is too small to
//      reach the 1.71 asymptote". That diagnosis is WRONG, and the tests below now
//      prove it. Run this same estimator on a SIERPINSKI GASKET -- an exactly
//      self-similar object with NO finite-size physics whatsoever, true dimension
//      log3/log2 = 1.58496 -- subsampled to the same ~330 points the DLA cluster
//      occupies, and it returns 1.0001. The 0.585 error is pure ESTIMATOR ARTIFACT.
//
// The mechanism: at eps=2 the estimator finds ~292 boxes for ~330 points, so nearly
// every point is alone in its box and the small-eps end of the fit has SATURATED.
// Saturation drags the slope toward isolated-point behaviour. The window {2,4,8,16}
// puts half its fit points in that regime.
//
// The decisive mathematical fact (Falconer, *Fractal Geometry*, ss.2-3): the
// box-counting dimension of ANY finite point set is exactly 0. Every cluster here is
// ~330 lattice cells. So "the box dimension of the cluster" is not a well-posed
// quantity -- only "the slope over a stated window" is, and it is meaningful only
// inside the scaling regime.
//
// For contrast, the Witten-Sander mass-radius estimator (ln N / ln R) on these very
// same byte-locked clusters gives a mean of 1.668 -- within 2.5% of the accepted
// 2-D DLA value 1.71 (Witten & Sander 1981, Phys. Rev. Lett. 47, 1400; Halsey 2000,
// Physics Today 53(11), 36). The cluster IS scaling like DLA; the box-counting
// window was not.
//
// REGISTER (`.claude/rules/toy-is-free-metered-must-be-earned.md`):
//   * the ALGORITHM is `metered` -- the calibration tests below are its falsifier;
//   * the NUMBER ~1.30 as "the fractal dimension of this cluster" is `toy`.
//
// Full analysis, measurements and anchors:
//   docs/research/2026-08-25-does-the-dla-meter-measure-a-fractal-dimension-four-estimators-one-typed-in-constant-lumen.md
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

test("the {2,4,8,16} window reads ≈1.30 on these clusters (locks the READING, not a dimension)", () => {
  const avg =
    SEEDS.reduce((a, s) => a + boxCountingDimension(runDLA(s).trajectory), 0) /
    SEEDS.length;
  // Measured 1.297 (deterministic). Band catches regressions without flaking.
  expect(avg).toBeGreaterThan(1.2);
  expect(avg).toBeLessThan(1.42);
  // Explicitly NOT near 1.71 in this window — guards against anyone "correcting"
  // the number without either widening the window or growing the cluster.
  // NOTE (Lumen 2026-08-25): this locks what the ESTIMATOR READS in this window.
  // It is NOT a claim that the cluster's dimension is 1.30 — the calibration
  // tests below show this window reads 1.000 on a KNOWN 1.585 object at the same
  // occupancy, and mass-radius on these same clusters reads 1.668.
  expect(avg).toBeLessThan(1.6);
});

// ── CALIBRATION: the falsifier the estimator did not have ─────────────────────
// (Lumen 2026-08-25.) An estimator with no known-answer control is `unmetered` at
// best — you cannot tell a measurement from a coincidence. These four tests run
// the SAME `boxCountingDimension` code path (via its `scales` option and a
// synthetic trajectory) against objects whose dimension is known exactly.
//
// They are what promotes the ALGORITHM from `unmetered` to `metered`, and they are
// simultaneously what demotes the ~1.30 DLA READING to `toy`: test 4 shows this
// window returns 1.000 for an object that is exactly 1.58496.

import { GRID_SIZE, CENTER } from "./reference.mjs";

/** Pack (x,y) cells into the trajectory encoding boxCountingDimension consumes. */
function trajectoryOf(cells: Array<[number, number]>): Uint32Array {
  return Uint32Array.from(cells, ([x, y]) => ((x & 0xffff) << 16) | (y & 0xffff));
}

test("CALIB-1: a filled square reads D = 2 exactly (true D = 2)", () => {
  const cells: Array<[number, number]> = [];
  for (let y = 32; y < 96; y++) for (let x = 32; x < 96; x++) cells.push([x, y]);
  const d = boxCountingDimension(trajectoryOf(cells));
  // A space-filling set must read 2. If this drifts, the estimator is broken.
  expect(d).toBeGreaterThan(1.99);
  expect(d).toBeLessThan(2.01);
});

test("CALIB-2: a straight line reads D = 1 exactly (true D = 1)", () => {
  const cells: Array<[number, number]> = [];
  for (let x = 32; x < 96; x++) cells.push([x, CENTER]);
  const d = boxCountingDimension(trajectoryOf(cells));
  expect(d).toBeGreaterThan(0.99);
  expect(d).toBeLessThan(1.01);
});

/** Sierpinski gasket by chaos game — exactly self-similar, D = log3/log2 = 1.58496. */
function sierpinski(nPoints: number, keep?: number): Array<[number, number]> {
  const V: Array<[number, number]> = [[CENTER, 8], [8, 120], [120, 120]];
  let px = CENTER, py = CENTER, s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const seen = new Set<number>(); const out: Array<[number, number]> = [];
  for (let i = 0; i < nPoints; i++) {
    const v = V[Math.floor(rnd() * 3)]!;
    px = Math.round((px + v[0]) / 2); py = Math.round((py + v[1]) / 2);
    if (i < 100) continue;
    const key = py * GRID_SIZE + px;
    if (!seen.has(key)) { seen.add(key); out.push([px, py]); }
    if (keep !== undefined && out.length >= keep) break;
  }
  return out;
}

test("CALIB-3: a DENSELY sampled Sierpinski gasket recovers D ≈ 1.585 (true 1.58496)", () => {
  const cells = sierpinski(200_000);
  expect(cells.length).toBeGreaterThan(2000); // densely sampled, not point-limited
  const d = boxCountingDimension(trajectoryOf(cells));
  // Measured 1.530 — 3.5% low from lattice discretisation. In-window behaviour.
  expect(d).toBeGreaterThan(1.45);
  expect(d).toBeLessThan(1.62);
});

test("CALIB-4: the SAME gasket at DLA occupancy (~330 pts) collapses to ≈1.0 — the artifact", () => {
  // THE LOAD-BEARING TEST. Identical object, identical true dimension (1.58496),
  // no finite-size physics of any kind — only fewer sample points. If the ~1.30
  // DLA reading were really "a small cluster's honest dimension", this control
  // would still read ≈1.585. It reads ≈1.000, so the deficit is the ESTIMATOR.
  const sparse = sierpinski(200_000, 330);
  expect(sparse.length).toBe(330);
  const d = boxCountingDimension(trajectoryOf(sparse));
  expect(d).toBeLessThan(1.15);   // fails if the saturation bias ever disappears
  expect(d).toBeGreaterThan(0.85);

  // And the gap versus the dense sampling of the same object is the artifact size.
  const dense = boxCountingDimension(trajectoryOf(sierpinski(200_000)));
  expect(dense - d).toBeGreaterThan(0.3);
});

// ── The second, independent estimator: mass-radius (Witten & Sander 1981) ──────
// Two estimators disagreeing by 0.37 on the same data is the signal that one is out
// of window. CALIB-4 above says which. This pins the in-window one so the
// disagreement cannot be quietly "fixed" by changing only the box-counting side.

/** Witten-Sander mass-radius estimator: N ~ R^D  =>  D = ln N / ln R. */
export function massRadiusDimension(trajectory: Uint32Array | number[]): number {
  let n = 1, maxR2 = 0; // the centre seed counts
  for (const v of trajectory) {
    if (v === 0xffffffff) continue;
    const x = (v >>> 16) & 0xffff, y = v & 0xffff;
    n++;
    const dx = x - CENTER, dy = y - CENTER;
    const r2 = dx * dx + dy * dy;
    if (r2 > maxR2) maxR2 = r2;
  }
  if (maxR2 <= 1 || n < 2) return 1;
  return Math.log(n) / Math.log(Math.sqrt(maxR2));
}

test("mass-radius on the SAME clusters reads ≈1.67 — near Witten-Sander 1.71, not 1.30", () => {
  const ds = SEEDS.map((s) => massRadiusDimension(runDLA(s).trajectory));
  const avg = ds.reduce((a, b) => a + b, 0) / ds.length;
  // Measured 1.668 (deterministic). Accepted 2-D DLA value is 1.71
  // (Witten & Sander 1981, PRL 47 1400; Halsey 2000, Physics Today 53(11) 36).
  expect(avg).toBeGreaterThan(1.60);
  expect(avg).toBeLessThan(1.74);
  // The whole point: this is NOT the ~1.30 the box window reports on the same data.
  const box =
    SEEDS.reduce((a, s) => a + boxCountingDimension(runDLA(s).trajectory), 0) / SEEDS.length;
  expect(avg - box).toBeGreaterThan(0.25);
});

test("get_df()'s actual expression is a DENSITY (N/R²), nowhere near its comment's 1.322", () => {
  // dla.wat's get_df() body is `csize / (maxR*maxR)` — the `* 1.322` in its comment
  // is not in the code. N/R² = R^(D−2) decays as the cluster grows, so it is not
  // scale-invariant and cannot be a dimension. This test pins what it really is.
  for (const s of SEEDS) {
    const { trajectory } = runDLA(s);
    let n = 1, maxR2 = 0;
    for (const v of trajectory) {
      if (v === 0xffffffff) continue;
      const x = (v >>> 16) & 0xffff, y = v & 0xffff;
      n++;
      const dx = x - CENTER, dy = y - CENTER;
      if (dx * dx + dy * dy > maxR2) maxR2 = dx * dx + dy * dy;
    }
    const density = n / maxR2;
    // Measured range 0.248–0.450 across all eight seeds. A factor of 3–5 from 1.322.
    expect(density).toBeGreaterThan(0.2);
    expect(density).toBeLessThan(0.5);
    expect(Math.abs(density - 1.322)).toBeGreaterThan(0.8); // never was 1.322
  }
});
