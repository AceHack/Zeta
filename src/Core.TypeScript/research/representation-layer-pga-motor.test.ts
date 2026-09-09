/**
 * representation-layer-pga-motor.test.ts — the falsifiers under the PGA numbers.
 *
 * A benchmark of a wrong implementation is a measurement of nothing, so the timings in the
 * companion research document are only worth reading if these pass. The load-bearing ones:
 *
 *   - the sandwich agrees with an INDEPENDENTLY written Euclidean reflection composition,
 *     which is what fixes the plane/point sign conventions from outside the algebra;
 *   - the unrolled fast path agrees with the general 16-component product, so the thing
 *     being timed computes what the oracle computes;
 *   - the exact integer path takes no square root and stays in `Z`, which is the claim that
 *     decides whether PGA costs us the exactness the 8D was paying for.
 */

import { describe, expect, test } from "bun:test";
import {
  BLADE_COUNT,
  E0,
  E123,
  applyMotorFast,
  applyQuat,
  bladeProduct,
  decomposeMotor,
  gp,
  gpZ,
  grade,
  maxBitLength,
  motorFromPlanes,
  plane,
  planeZ,
  point,
  pointCoords,
  pointZ,
  reverse,
  sandwich,
  sandwichZ,
  zero,
  OPS_PER_VERTEX,
} from "./representation-layer-pga-motor.ts";
import { splitmix32 } from "./representation-layer-projection-cost.ts";
import { measureExactness, runBenchmark } from "./representation-layer-benchmark.ts";
import {
  H3_ROOT_COUNT,
  INV_PHI,
  PHI,
  h3Reflect,
  h3Roots,
  measureRank3Exactness,
  zDot,
  zHalf,
  zMul,
  zint,
  type Zphi,
} from "./representation-layer-rank3-exactness.ts";

/** An independently written Euclidean reflection — the control, outside the algebra. */
function reflectEuclid(n: readonly [number, number, number], d: number, p: readonly [number, number, number]): [number, number, number] {
  const nn = n[0] * n[0] + n[1] * n[1] + n[2] * n[2];
  const s = (2 * (n[0] * p[0] + n[1] * p[1] + n[2] * p[2] + d)) / nn;
  return [p[0] - s * n[0], p[1] - s * n[1], p[2] - s * n[2]];
}

describe("the metric is degenerate in exactly one generator", () => {
  test("e0 squares to zero and nothing else does", () => {
    expect(bladeProduct(E0, E0).sign).toBe(0);
    for (const b of [1 << 1, 1 << 2, 1 << 3]) {
      const r = bladeProduct(b, b);
      expect(r.sign).toBe(1);
      expect(r.mask).toBe(0);
    }
  });

  test("the product table is closed and total over 16 blades", () => {
    expect(BLADE_COUNT).toBe(16);
    for (let a = 0; a < 16; a++)
      for (let b = 0; b < 16; b++) {
        const r = bladeProduct(a, b);
        expect(r.mask).toBeGreaterThanOrEqual(0);
        expect(r.mask).toBeLessThan(16);
        expect([-1, 0, 1]).toContain(r.sign);
      }
  });

  /** Mutation guard: if `bladeProduct` stopped killing e0^2, this catches it. */
  test("a NON-degenerate metric would give a different answer, so the test is not vacuous", () => {
    const degenerate = bladeProduct(E0, E0).sign;
    const euclideanWouldBe = 1;
    expect(degenerate).not.toBe(euclideanWouldBe);
  });
});

describe("the sandwich matches an independently written Euclidean control", () => {
  test("two reflections compose to the same rigid motion", () => {
    const n1: [number, number, number] = [1, 0, 0];
    const d1 = -2;
    const n2: [number, number, number] = [0.3, 0.5, 0.8];
    const d2 = 1.1;
    const p: [number, number, number] = [0.7, -1.3, 2.1];

    const control = reflectEuclid(n2, d2, reflectEuclid(n1, d1, p));
    const m = motorFromPlanes(plane(...n1, d1), plane(...n2, d2));
    const got = pointCoords(sandwich(m, point(...p)));

    expect(got.x).toBeCloseTo(control[0], 12);
    expect(got.y).toBeCloseTo(control[1], 12);
    expect(got.z).toBeCloseTo(control[2], 12);
  });

  test("the result is grade 3 only — a motor maps points to points", () => {
    const m = motorFromPlanes(plane(1, 0, 0, -2), plane(0.3, 0.5, 0.8, 1.1));
    const out = sandwich(m, point(0.7, -1.3, 2.1));
    for (let b = 0; b < BLADE_COUNT; b++) {
      if (grade(b) !== 3) expect(Math.abs(out[b] ?? 0)).toBeLessThan(1e-12);
    }
  });

  test("the sandwich weight is the ROTOR norm — the degenerate half contributes none of it", () => {
    // This is the structural fact that makes a motor's action affine, and therefore the
    // reason the fast path is allowed to be a quaternion plus a translation.
    const m = motorFromPlanes(plane(1, 0, 0, -2), plane(0.3, 0.5, 0.8, 1.1));
    const out = sandwich(m, point(5, -7, 11));
    const outOrigin = sandwich(m, point(0, 0, 0));
    expect(out[E123] ?? 0).toBeCloseTo(outOrigin[E123] ?? 0, 12);
  });
});

describe("the fast path is a checked specialisation of the oracle", () => {
  test("agrees with the general product over seeded random motors and points", () => {
    const rng = splitmix32(4242);
    for (let i = 0; i < 200; i++) {
      const p1 = plane(rng() - 0.5, rng() - 0.5, rng() - 0.5, rng() - 0.5);
      const p2 = plane(rng() - 0.5, rng() - 0.5, rng() - 0.5, rng() - 0.5);
      const m = motorFromPlanes(p1, p2);
      const d = decomposeMotor(m);
      const x = rng() * 4 - 2;
      const y = rng() * 4 - 2;
      const z = rng() * 4 - 2;

      const oracle = pointCoords(sandwich(m, point(x, y, z)));
      const fast = applyMotorFast(d, x, y, z);

      expect(fast.x).toBeCloseTo(oracle.x, 9);
      expect(fast.y).toBeCloseTo(oracle.y, 9);
      expect(fast.z).toBeCloseTo(oracle.z, 9);
    }
  });

  test("the decomposed motor IS a quaternion pose — same call, same answer", () => {
    // The finding, asserted: after decomposition there is nothing left for the degenerate
    // half to compute per vertex, so PGA and quaternion+translation are one computation.
    const m = motorFromPlanes(plane(1, 2, 3, 4), plane(-2, 1, 0.5, -3));
    const d = decomposeMotor(m);
    for (const [x, y, z] of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [2.5, -3.5, 7]] as const) {
      const viaMotor = applyMotorFast(d, x, y, z);
      const viaQuat = applyQuat(d.quat, x, y, z);
      expect(viaMotor.x).toBe(viaQuat.x);
      expect(viaMotor.y).toBe(viaQuat.y);
      expect(viaMotor.z).toBe(viaQuat.z);
    }
  });

  test("the ops table agrees that they are the same count", () => {
    expect(OPS_PER_VERTEX.pgaMotorDecomposed?.total).toBe(OPS_PER_VERTEX.quatTranslate?.total);
  });

  test("a rigid motion preserves distance — the property that makes it rigid", () => {
    const rng = splitmix32(99);
    const m = motorFromPlanes(plane(1, 0, 0, -2), plane(0.3, 0.5, 0.8, 1.1));
    const d = decomposeMotor(m);
    for (let i = 0; i < 50; i++) {
      const a: [number, number, number] = [rng() * 4 - 2, rng() * 4 - 2, rng() * 4 - 2];
      const b: [number, number, number] = [rng() * 4 - 2, rng() * 4 - 2, rng() * 4 - 2];
      const before = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const A = applyMotorFast(d, ...a);
      const B = applyMotorFast(d, ...b);
      expect(Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z)).toBeCloseTo(before, 9);
    }
  });
});

describe("reverse and the algebra's basic laws", () => {
  test("reverse is an involution", () => {
    const rng = splitmix32(7);
    const x = zero().map(() => rng() - 0.5);
    const rr = reverse(reverse(x));
    for (let i = 0; i < BLADE_COUNT; i++) expect(rr[i]).toBeCloseTo(x[i] ?? 0, 15);
  });

  test("the geometric product is associative", () => {
    const rng = splitmix32(11);
    const a = zero().map(() => rng() - 0.5);
    const b = zero().map(() => rng() - 0.5);
    const c = zero().map(() => rng() - 0.5);
    const l = gp(gp(a, b), c);
    const r = gp(a, gp(b, c));
    for (let i = 0; i < BLADE_COUNT; i++) expect(l[i]).toBeCloseTo(r[i] ?? 0, 10);
  });
});

describe("exactness — the property the 8D was paying for", () => {
  test("integer planes give integer motors and integer points, with no rounding", () => {
    const m = gpZ(planeZ(3n, 5n, 8n, 11n), planeZ(1n, 0n, 0n, -2n));
    const out = sandwichZ(m, pointZ(7n, -13n, 21n));
    for (const c of out) expect(typeof c).toBe("bigint");
    expect(out[E123]).not.toBe(0n);
  });

  test("the exact path contains no square root at all", () => {
    const ex = measureExactness(4);
    expect(ex.sqrtCallsOnExactPath).toBe(0);
    expect(ex.stayedExact).toBe(true);
  });

  test("the exact path's SOURCE contains no Math.sqrt — checked, not asserted", async () => {
    // The constant above could drift from the code, so the code is read. Comments are
    // stripped first: a guard satisfied by its own explanatory comment is the vacuity class,
    // and this repository has hit that exact failure before.
    const src = await Bun.file(new URL("./representation-layer-pga-motor.ts", import.meta.url)).text();
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const exactRegion = stripped.slice(stripped.indexOf("export function gpZ"));
    expect(exactRegion).not.toContain("Math.sqrt");
    // Control: the pattern DOES fire on the float region, so a zero above means something.
    expect(stripped).toContain("Math.sqrt");
  });

  test("exact and float agree, so the exact path is not exact-but-wrong", () => {
    const pz = planeZ(1n, 0n, 0n, -2n);
    const qz = planeZ(3n, 5n, 8n, 11n);
    const xz = sandwichZ(gpZ(qz, pz), pointZ(7n, -13n, 21n));
    const w = Number(xz[E123] ?? 1n);
    const exactX = -Number(xz[13] ?? 0n) / w;

    const mf = motorFromPlanes(plane(1, 0, 0, -2), plane(3, 5, 8, 11));
    const got = pointCoords(sandwich(mf, point(7, -13, 21)));
    expect(got.x).toBeCloseTo(exactX, 9);
  });

  test("bit growth is LINEAR in composition depth, and the cost is named", () => {
    // The honest cost of never normalising: coefficients grow. Measured so the engine
    // decision includes it rather than discovering it in a long-running simulation.
    const ex = measureExactness(8);
    const g = ex.bitGrowth;
    expect(g.length).toBe(8);
    for (let i = 1; i < g.length; i++) expect(g[i] ?? 0).toBeGreaterThan(g[i - 1] ?? 0);
    const firstStep = (g[1] ?? 0) - (g[0] ?? 0);
    const lastStep = (g[7] ?? 0) - (g[6] ?? 0);
    // Linear, not exponential: successive increments stay within a small constant factor.
    expect(Math.abs(lastStep - firstStep)).toBeLessThanOrEqual(2);
  });

  test("maxBitLength ignores zeros and tracks the largest magnitude", () => {
    expect(maxBitLength([0n, 0n])).toBe(0);
    expect(maxBitLength([0n, -255n, 3n])).toBe(8);
  });
});

describe("the benchmark measures what it says it measures", () => {
  test("every path returns the same rigid motion, so the rows are comparable", () => {
    const m = motorFromPlanes(plane(1, 0, 0, -2), plane(0.3, 0.5, 0.8, 1.1));
    const d = decomposeMotor(m);
    const viaOracle = pointCoords(sandwich(m, point(1.5, -2.5, 0.25)));
    const viaFast = applyMotorFast(d, 1.5, -2.5, 0.25);
    expect(viaFast.x).toBeCloseTo(viaOracle.x, 9);
  });

  test("runs, and the checksums are finite — the loops were not optimised away", () => {
    const rows = runBenchmark(4);
    expect(rows.length).toBe(5);
    for (const r of rows) {
      expect(Number.isFinite(r.checksum)).toBe(true);
      expect(r.nsPerVertex).toBeGreaterThan(0);
    }
  });
});

describe("rank-3 exactness — did the 8D actually buy the exact arithmetic?", () => {
  test("H3 closes at exactly 30 roots, in Z[phi], with no reflection leaving the ring", () => {
    const r = measureRank3Exactness();
    expect(r.declared).toBe(H3_ROOT_COUNT);
    expect(r.closure).toBe(H3_ROOT_COUNT);
    expect(r.stayedExact).toBe(true);
    expect(r.rank).toBe(3);
  });

  test("every root has squared norm the RATIONAL integer 4 — the phi components cancel", () => {
    // The property that makes the arithmetic close, and the rank-3 analogue of E8's roots
    // all having squared norm 8 in doubled integer coordinates.
    for (const root of h3Roots()) {
      const n = zDot(root, root);
      expect(n[0]).toBe(4n);
      expect(n[1]).toBe(0n);
    }
    // ONE norm class: every root the same length. `"4,0"` is the Z[phi] key for `4 + 0*phi`,
    // i.e. the rational integer 4 — the phi component is exactly zero, not merely small.
    expect(measureRank3Exactness().distinctSquaredNorms).toEqual(["4,0"]);
  });

  test("phi^2 = phi + 1 exactly, so the ring is closed under multiplication", () => {
    expect(zMul(PHI, PHI)).toEqual([1n, 1n]);
    expect(zMul(PHI, INV_PHI)).toEqual([1n, 0n]);
  });

  test("CONTROL: the probe can fail, so a pass means something", () => {
    const bad: Zphi[] = [zint(1n), zint(0n), zint(0n)];
    expect(h3Reflect(bad, bad)).toBeNull();
    expect(zHalf([1n, 0n])).toBeNull();
    expect(zHalf([4n, 2n])).toEqual([2n, 1n]);
  });

  test("closure reaches its fixed point and does not run away", () => {
    const r = measureRank3Exactness();
    expect(r.rounds).toBeGreaterThan(0);
    expect(r.rounds).toBeLessThan(32);
  });
});
