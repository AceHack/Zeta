/**
 * representation-layer-benchmark.ts — THE NUMBERS, ON ONE NAMED MACHINE.
 *
 * Aaron 2026-09-09: *"route the PGA evaluation and let's see the numbers."*
 *
 * Five transform paths over the real derived vertex set, same task, same data, same process,
 * warm-up excluded, median of repeated trials. Run with `bun` and it prints a table; the
 * hardware and runtime it was run on are recorded in the companion research document, and a
 * number quoted without that pairing is `unmetered` by this file's own standard.
 *
 * ## What is being compared, and the fairness note that decides how to read it
 *
 *   1. `8d-then-project` — an 8x8 orthogonal transform of the root followed by the rank-3
 *      projection. **This is not today's per-frame cost.** The shipped ladder projects once
 *      at load and then animates the 3D result, so today's projection is amortised to zero.
 *      This row is the cost of the regime Aaron's phrase *"using the 8d to do calculations
 *      we needed"* describes — animating IN 8D — and it is the only regime in which the
 *      projection is a per-frame expense at all.
 *   2. `mat4` — the 4x4 affine matrix every engine actually ships.
 *   3. `quat+t` — a unit quaternion plus a translation. Aaron named this one.
 *   4. `pga-motor` — a `Cl(3,0,1)` motor, decomposed once per motor, applied per vertex.
 *   5. `pga-naive` — the same motor through the general 16-component geometric product,
 *      twice, with no specialisation. Included because it is what an off-the-shelf GA call
 *      costs and it is the number that gets quoted when people say GA is slow.
 *
 * Rows 3 and 4 are expected to be equal to within noise, and that expectation is the
 * *finding* rather than a defect of the benchmark: the even subalgebra of `Cl(3,0,1)` is the
 * dual quaternions, and a motor's action on a point is affine with the rotor as its linear
 * part, so after decomposition there is nothing left for the degenerate half to compute.
 * If they diverge materially, something is wrong with this harness and not with the algebra.
 *
 * ## Honest limits of this harness, stated because a microbenchmark without them is a story
 *
 * - Single-threaded scalar JavaScript on one runtime. No SIMD, no GPU, no `v128` inner loop.
 *   The ratios between rows are the transferable part; the absolute ns/vertex is not.
 * - JIT warm-up is excluded by discarding the first trials, but tiered compilation and
 *   inlining decisions still differ between a five-line kernel and a nested-loop one, which
 *   structurally favours rows 2-4 over rows 1 and 5 by an amount this harness cannot isolate.
 *   That is named rather than corrected, and it is why `OPS_PER_VERTEX` is reported next to
 *   the timings: an operation count survives the machine and a nanosecond does not.
 * - Results are written into preallocated arrays so allocation does not enter the loop, and
 *   a checksum is accumulated and printed so dead-code elimination cannot delete the work
 *   being measured. A benchmark whose body can be optimised away is the vacuity class with a
 *   stopwatch.
 */

import { e8Roots } from "./clifford-e8-coxeter-projection.ts";
import { eigenProjection, randomProjection, splitmix32 } from "./representation-layer-projection-cost.ts";
import {
  OPS_PER_VERTEX,
  MOTOR_FLOATS,
  MATRIX_FLOATS,
  QUAT_TRANSLATION_FLOATS,
  apply8dThenProject,
  applyMat4,
  applyQuat,
  applyMotorFast,
  decomposeMotor,
  motorFromPlanes,
  plane,
  point,
  sandwich,
  pointCoords,
  planeZ,
  pointZ,
  sandwichZ,
  gpZ,
  maxBitLength,
  type Mat4,
  type QuatPose,
} from "./representation-layer-pga-motor.ts";

/** Trials discarded before measurement, to let the JIT settle. */
export const WARMUP_TRIALS = 20;

/** Measured trials; the median is reported, never the mean. */
export const MEASURED_TRIALS = 41;

/** One benchmark row. */
export interface BenchRow {
  readonly name: string;
  readonly nsPerVertex: number;
  readonly opsPerVertex: number;
  readonly stateFloats: number;
  readonly checksum: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/**
 * Run one kernel `trials` times over `n` vertices, discarding warm-up, returning ns/vertex.
 *
 * The kernel must accumulate into and return a checksum; the caller prints it. That is the
 * dead-code guard, and it is the reason every row below returns a number nobody reads for
 * its value.
 */
function timeKernel(n: number, kernel: () => number): { ns: number; checksum: number } {
  let checksum = 0;
  for (let t = 0; t < WARMUP_TRIALS; t++) checksum += kernel();
  const times: number[] = [];
  for (let t = 0; t < MEASURED_TRIALS; t++) {
    const t0 = performance.now();
    checksum += kernel();
    times.push((performance.now() - t0) * 1e6);
  }
  return { ns: median(times) / n, checksum };
}

/** Build the benchmark's input: the 240 derived roots, as flat `Float64Array`s. */
export function benchmarkInputs(): { roots8: Float64Array[]; pts3: Float64Array } {
  const roots = e8Roots();
  const roots8 = roots.map((r) => Float64Array.from(r));
  const proj = eigenProjection();
  const pts3 = new Float64Array(roots.length * 3);
  roots.forEach((r, i) => {
    for (let k = 0; k < 3; k++) {
      let s = 0;
      const row = proj[k] as readonly number[];
      for (let j = 0; j < 8; j++) s += (row[j] ?? 0) * (r[j] ?? 0);
      pts3[i * 3 + k] = s;
    }
  });
  return { roots8, pts3 };
}

/**
 * Run every path. `repeat` multiplies the vertex count so the loop is long enough to time;
 * `240 * repeat` vertex-transforms per trial.
 */
export function runBenchmark(repeat = 252): BenchRow[] {
  const { roots8, pts3 } = benchmarkInputs();
  const n = roots8.length * repeat;

  // ── inputs, all derived from one seed so the run replays ──
  const rng = splitmix32(20260909);
  const rot = new Float64Array(64);
  const rp = randomProjection(7);
  const projFlat = new Float64Array(24);
  for (let k = 0; k < 3; k++) for (let j = 0; j < 8; j++) projFlat[k * 8 + j] = (rp[k] as readonly number[])[j] ?? 0;
  // An orthogonal 8x8 is not needed for a TIMING measurement — the arithmetic is identical
  // for any dense matrix — so a seeded dense one is used and the fact is stated here rather
  // than a Gram-Schmidt being run to make the benchmark look more principled than it is.
  for (let i = 0; i < 64; i++) rot[i] = rng() - 0.5;
  const scratch = new Float64Array(8);

  const mat: Mat4 = new Float64Array(16);
  for (let i = 0; i < 12; i++) mat[i] = rng() - 0.5;

  // A motor from two rational planes, and the quaternion pose that agrees with it.
  const m = motorFromPlanes(plane(1, 0, 0, -2), plane(0.3, 0.5, 0.8, 1.1));
  const dm = decomposeMotor(m);
  const qp: QuatPose = dm.quat;

  const out = new Float64Array(3);
  const rows: BenchRow[] = [];

  const push = (name: string, ops: number, floats: number, r: { ns: number; checksum: number }): void => {
    rows.push({ name, nsPerVertex: r.ns, opsPerVertex: ops, stateFloats: floats, checksum: r.checksum });
  };

  push(
    "8d-then-project",
    OPS_PER_VERTEX.eightDThenProject?.total ?? 0,
    64 + 24,
    timeKernel(n, () => {
      let c = 0;
      for (let r = 0; r < repeat; r++)
        for (let i = 0; i < roots8.length; i++) {
          const p = apply8dThenProject(rot, projFlat, roots8[i] as Float64Array, scratch);
          c += p.x + p.y + p.z;
        }
      return c;
    }),
  );

  push(
    "mat4",
    OPS_PER_VERTEX.mat4Affine?.total ?? 0,
    MATRIX_FLOATS,
    timeKernel(n, () => {
      let c = 0;
      for (let r = 0; r < repeat; r++)
        for (let i = 0; i < pts3.length; i += 3) {
          const p = applyMat4(mat, pts3[i] ?? 0, pts3[i + 1] ?? 0, pts3[i + 2] ?? 0);
          c += p.x + p.y + p.z;
        }
      return c;
    }),
  );

  push(
    "quat+t",
    OPS_PER_VERTEX.quatTranslate?.total ?? 0,
    QUAT_TRANSLATION_FLOATS,
    timeKernel(n, () => {
      let c = 0;
      for (let r = 0; r < repeat; r++)
        for (let i = 0; i < pts3.length; i += 3) {
          const p = applyQuat(qp, pts3[i] ?? 0, pts3[i + 1] ?? 0, pts3[i + 2] ?? 0);
          c += p.x + p.y + p.z;
        }
      return c;
    }),
  );

  push(
    "pga-motor",
    OPS_PER_VERTEX.pgaMotorDecomposed?.total ?? 0,
    MOTOR_FLOATS,
    timeKernel(n, () => {
      let c = 0;
      for (let r = 0; r < repeat; r++)
        for (let i = 0; i < pts3.length; i += 3) {
          const p = applyMotorFast(dm, pts3[i] ?? 0, pts3[i + 1] ?? 0, pts3[i + 2] ?? 0);
          c += p.x + p.y + p.z;
        }
      return c;
    }),
  );

  // The naive path is ~200x slower per vertex, so it runs a reduced repeat and is scaled.
  const naiveRepeat = Math.max(1, Math.floor(repeat / 32));
  const naiveN = roots8.length * naiveRepeat;
  push(
    "pga-naive",
    OPS_PER_VERTEX.pgaMotorNaive?.total ?? 0,
    MOTOR_FLOATS,
    timeKernel(naiveN, () => {
      let c = 0;
      for (let r = 0; r < naiveRepeat; r++)
        for (let i = 0; i < pts3.length; i += 3) {
          const p = pointCoords(sandwich(m, point(pts3[i] ?? 0, pts3[i + 1] ?? 0, pts3[i + 2] ?? 0)));
          c += p.x + p.y + p.z;
        }
      return c;
    }),
  );

  void out;
  return rows;
}

// ── exactness ───────────────────────────────────────────────────────────────

/** What the exactness probe found. */
export interface ExactnessResult {
  /** Composed rigid motions applied, each from a pair of integer planes. */
  readonly compositions: number;
  /** Bit length of the largest integer coefficient after each composition. */
  readonly bitGrowth: readonly number[];
  /** True if every intermediate stayed an exact integer — no rounding, no roots. */
  readonly stayedExact: boolean;
  /** Square-root call sites on the exact path. Zero is the claim. */
  readonly sqrtCallsOnExactPath: number;
  /** The exact rational readout of the final point, as `[num, den]` per coordinate. */
  readonly finalPoint: readonly (readonly [bigint, bigint])[];
}

/**
 * Compose `k` rigid motions over the integers and report whether exactness survives.
 *
 * The question this answers is the one that decides whether PGA costs us the property the
 * 8D was paying for. Today's ladder is integer-valued with a single named `sqrt(6)` at the
 * shading readout. If a PGA engine needed a square root per rotor, that would be a real
 * regression and it belongs on the page.
 *
 * It does not, and the reason is structural rather than lucky: **a projective algebra never
 * has to normalise.** A motor built from unnormalised integer planes is an integer
 * multivector; the sandwich is two geometric products, which are sums of products; and the
 * homogeneous point that comes out is read by dividing through by its own weight. So the
 * whole rigid-motion pipeline is `Z`, and the only division in it is the final readout,
 * which is exactly the boundary `Tsirelson.fs` already uses for `S^2 = 8`.
 *
 * The honest cost, and it is measured rather than waved at: **coefficient bit-length grows**
 * with composition depth, because nothing reduces the scale. `bitGrowth` is that curve.
 */
export function measureExactness(k = 8): ExactnessResult {
  // Integer planes; the coefficients are arbitrary small integers, not a special family.
  const planes: bigint[][] = [
    planeZ(1n, 0n, 0n, -2n),
    planeZ(3n, 5n, 8n, 11n),
    planeZ(0n, 1n, 0n, 4n),
    planeZ(2n, -3n, 7n, -5n),
  ];

  let x = pointZ(7n, -13n, 21n);
  const bitGrowth: number[] = [];
  let stayedExact = true;

  for (let i = 0; i < k; i++) {
    const p = planes[i % planes.length] as bigint[];
    const q = planes[(i + 1) % planes.length] as bigint[];
    const m = gpZ(q, p);
    x = sandwichZ(m, x);
    for (const c of x) if (typeof c !== "bigint") stayedExact = false;
    bitGrowth.push(maxBitLength(x));
  }

  const w = x[14] ?? 0n; // E123
  const finalPoint: Array<readonly [bigint, bigint]> = [
    [-(x[13] ?? 0n), w],
    [x[11] ?? 0n, w],
    [-(x[7] ?? 0n), w],
  ];

  return {
    compositions: k,
    bitGrowth,
    stayedExact,
    // Counted from the exact path's own source: `gpZ`, `reverseZ`, `sandwichZ`, `planeZ`,
    // `pointZ` contain no `Math.sqrt`. The test re-derives this by scanning the source with
    // comments stripped, so this constant cannot drift away from the code silently.
    sqrtCallsOnExactPath: 0,
    finalPoint,
  };
}

/** Print the table. Entry point for `bun run`. */
export function main(): void {
  const rows = runBenchmark();
  const base = rows.find((r) => r.name === "mat4")?.nsPerVertex ?? 1;
  console.log("path             ns/vertex   ops/vertex   state(floats)   x mat4");
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(16)} ${r.nsPerVertex.toFixed(3).padStart(9)}   ${String(r.opsPerVertex).padStart(10)}   ${String(r.stateFloats).padStart(13)}   ${(r.nsPerVertex / base).toFixed(2).padStart(6)}`,
    );
  }
  const ex = measureExactness();
  console.log("\nexactness: stayedExact =", ex.stayedExact, " sqrt on exact path =", ex.sqrtCallsOnExactPath);
  console.log("bit growth over", ex.compositions, "compositions:", ex.bitGrowth.join(" -> "));
}

if (import.meta.main) main();
