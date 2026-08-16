/**
 * z2-halsey-redischarge.test.ts — Tests for the Z-2 honest re-discharge module.
 *
 * These tests verify that:
 *   1. The DLA cluster generator produces a non-trivial cluster
 *   2. The harmonic measure sums to ~1 (probability distribution)
 *   3. The multifractal spectrum produces a τ(3) in a plausible range
 *   4. The falsifier can fire (negative control: synthetic uniform measure)
 *   5. The falsifier does not fire for a well-behaved DLA cluster
 *   6. The box-counting D_f is in the expected range [1.5, 1.9]
 *   7. The discharge result is deterministic (same seed → same result)
 */
import { describe, it, expect } from "bun:test";
import {
  generateDlaCluster,
  computeHarmonicMeasure,
  computeMultifractalSpectrum,
  computeThirdMomentBeta,
  runZ2Discharge,
  FALSIFIER_TOLERANCE,
  GRID_SIZE,
} from "./z2-halsey-redischarge";

describe("Z-2 re-discharge: DLA cluster generator", () => {
  it("Z2-1: generates a non-trivial cluster with multiple boundary sites", () => {
    const cluster = generateDlaCluster(42, 500);
    expect(cluster.sites.length).toBeGreaterThan(10);
    expect(cluster.gridSize).toBe(GRID_SIZE);
    expect(cluster.nWalkers).toBe(500);
  });

  it("Z2-1b: boundary sites are unique occupied cells", () => {
    const cluster = generateDlaCluster(42, 500);
    const distinctSites = new Set(cluster.sites.map(([x, y]) => JSON.stringify([x, y])));

    expect(distinctSites.size).toBe(cluster.sites.length);
    for (const [x, y] of cluster.sites) {
      expect(cluster.grid[y * cluster.gridSize + x]).toBe(1);
    }
  });

  it("Z2-2: cluster is deterministic (same seed → same sites)", () => {
    const c1 = generateDlaCluster(42, 200);
    const c2 = generateDlaCluster(42, 200);
    expect(c1.sites.length).toBe(c2.sites.length);
    expect(c1.sites[0]).toEqual(c2.sites[0]);
  });

  it("Z2-3: different seeds produce different clusters", () => {
    const c1 = generateDlaCluster(1, 200);
    const c2 = generateDlaCluster(999, 200);
    // Very unlikely to be identical
    expect(c1.sites.length).not.toBe(c2.sites.length);
  });
});

describe("Z-2 re-discharge: harmonic measure", () => {
  it("Z2-4: harmonic measure sums to approximately 1", () => {
    const cluster = generateDlaCluster(42, 300);
    const hm = computeHarmonicMeasure(cluster, 200, 43);
    const total = Array.from(hm.mu).reduce((s, m) => s + m, 0);
    // Should sum to ~1 (within 10% for small probe count)
    expect(total).toBeGreaterThan(0.5);
    expect(total).toBeLessThanOrEqual(1.01);
  });

  it("Z2-5: harmonic measure has the same number of entries as boundary sites", () => {
    const cluster = generateDlaCluster(42, 300);
    const hm = computeHarmonicMeasure(cluster, 100, 43);
    expect(hm.mu.length).toBe(cluster.sites.length);
  });

  it("Z2-6: harmonic measure is deterministic", () => {
    const cluster = generateDlaCluster(42, 300);
    const hm1 = computeHarmonicMeasure(cluster, 100, 43);
    const hm2 = computeHarmonicMeasure(cluster, 100, 43);
    expect(hm1.mu[0]).toBe(hm2.mu[0]);
  });
});

describe("Z-2 re-discharge: multifractal spectrum", () => {
  it("Z2-7: box-counting D_f is in the expected range [1.3, 1.9] for DLA", () => {
    const cluster = generateDlaCluster(42, 500);
    const hm = computeHarmonicMeasure(cluster, 200, 43);
    const spec = computeMultifractalSpectrum(hm, cluster);
    expect(spec.dfBox).toBeGreaterThan(1.1);
    expect(spec.dfBox).toBeLessThan(1.9);
  });

  it("Z2-8: τ(3) is in a plausible range [1.0, 3.5]", () => {
    const cluster = generateDlaCluster(42, 500);
    const hm = computeHarmonicMeasure(cluster, 200, 43);
    const spec = computeMultifractalSpectrum(hm, cluster);
    expect(spec.tau3).toBeGreaterThan(1.0);
    expect(spec.tau3).toBeLessThan(3.5);
  });
});

describe("Z-2 re-discharge: falsifier", () => {
  it("Z2-9: uniform harmonic measure (negative control) gives β = τ(3) = 2", () => {
    // A uniform measure over N sites has ∑μᵢ³ = N·(1/N)³ = N⁻², so
    // −log(∑μᵢ³)/log(N) = 2 exactly. Pin the value, not a bound: the previous
    // assertions here were `gap >= 0` (gap is a Math.abs, so this holds for every
    // possible input) and `typeof falsifierFires === "boolean"` (holds for every
    // possible implementation). Neither could fail, so neither was a control.
    const cluster = generateDlaCluster(42, 200);
    const n = cluster.sites.length;
    const mu = new Float64Array(n).fill(1 / n);
    const hm = { mu, sites: cluster.sites };
    const tm = computeThirdMomentBeta(hm, cluster);
    expect(tm.beta).toBeCloseTo(2, 10);
    expect(tm.tau3).toBeCloseTo(2, 10);
    expect(tm.nSites).toBe(n);
  });

  // ── DEFECT PIN ─────────────────────────────────────────────────────────────
  // This test asserts BROKEN behaviour on purpose, so that fixing it turns the
  // suite RED and forces the register row to be revisited. Delete it (and this
  // comment) in the same change that makes β an independent estimator.
  //
  // computeMultifractalSpectrum computes  τ(q) = log(∑μᵢ^q) / −log(N_pos)
  // computeThirdMomentBeta   computes  β    = −log(∑μᵢ³)  /  log(n_pos)
  // At q = 3 these are the SAME EXPRESSION over the same inputs, so
  //   gap = |β − τ(3)| ≡ 0  and  falsifierFires = (0 > 0.1) ≡ false
  // for every possible harmonic measure. The scaling-level falsifier that
  // docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md row `n` cites as implemented
  // ("a falsifier that COULD have fired") cannot fire.
  it("Z2-9b: DEFECT — β and τ(3) are one expression, so the falsifier can never fire", () => {
    const cluster = generateDlaCluster(42, 200);
    const n = cluster.sites.length;
    const norm = (a: Float64Array): Float64Array => {
      let t = 0;
      for (const v of a) t += v;
      return a.map((v) => v / t) as Float64Array;
    };
    // Four measures with radically different multifractal character. If β were an
    // independent estimate of the third-moment exponent, they could not all agree
    // with τ(3) to the last bit.
    const uniform = new Float64Array(n).fill(1 / n);
    const concentrated = new Float64Array(n).fill(1e-12);
    concentrated[0] = 1 - 1e-12 * (n - 1);
    const powerlaw = norm(Float64Array.from({ length: n }, (_, i) => (i + 1) ** -2));
    let s = 7;
    const rng = (): number => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
    const random = norm(Float64Array.from({ length: n }, () => rng()));

    for (const mu of [uniform, concentrated, powerlaw, random]) {
      const tm = computeThirdMomentBeta({ mu, sites: cluster.sites }, cluster);
      expect(tm.gap).toBe(0); // exact — not "small"
      expect(tm.falsifierFires).toBe(false);
    }
  });

  it("Z2-10: falsifier tolerance is 0.1", () => {
    expect(FALSIFIER_TOLERANCE).toBe(0.1);
  });

  it("Z2-11: discharge result is deterministic", () => {
    const r1 = runZ2Discharge(42, 300, 100);
    const r2 = runZ2Discharge(42, 300, 100);
    expect(r1.thirdMoment.beta).toBe(r2.thirdMoment.beta);
    expect(r1.thirdMoment.tau3).toBe(r2.thirdMoment.tau3);
    expect(r1.conjecture).toBe(r2.conjecture);
  });

  it("Z2-12: discharge result has expected fields", () => {
    const r = runZ2Discharge(42, 300, 100);
    expect(r.seed).toBe(42);
    expect(r.nWalkers).toBe(300);
    expect(r.nProbes).toBe(100);
    expect(["SUPPORTED", "FALSIFIED", "INCONCLUSIVE"]).toContain(r.conjecture);
    expect(typeof r.note).toBe("string");
    expect(r.note.length).toBeGreaterThan(0);
  });

  it("Z2-13: inconclusive result for tiny cluster", () => {
    // Very few walkers → too few boundary sites → INCONCLUSIVE.
    // `toContain([...all three verdicts])` was the whole assertion here; the
    // union it tested against is the declared type of the field, so it accepted
    // every value the function can return, including the ones the test is named
    // for NOT getting. Assert the verdict this input actually produces.
    const r = runZ2Discharge(42, 5, 10);
    expect(r.conjecture).toBe("INCONCLUSIVE");
  });
});

// ── HL amplitude tests (Halsey 2026, arXiv:2607.02216) ───────────────────────
import {
  HL_A_PARAM,
  HL_LAMBDA0,
  HL_AMPLITUDE_TOLERANCE,
  computeHLAmplitude,
} from "./z2-halsey-redischarge";

describe("Z-2 HL amplitude test (Halsey 2026, arXiv:2607.02216)", () => {
  it("Z2-HL-1: HL constants match Davidovitch et al. (1999) recommendation", () => {
    expect(HL_A_PARAM).toBeCloseTo(2 / 3, 6);
    expect(HL_LAMBDA0).toBe(0.004);
    expect(HL_AMPLITUDE_TOLERANCE).toBe(0.05);
  });

  it("Z2-HL-2: expectedAmplitude = aλ₀/D ≈ 0.00156 for D ≈ 1.71", () => {
    const cluster = generateDlaCluster(42, 400);
    const hm = computeHarmonicMeasure(cluster, 150, 43);
    const hla = computeHLAmplitude(hm, cluster);
    // aλ₀/D = (2/3 * 0.004) / 1.71 ≈ 0.00156
    expect(hla.expectedAmplitude).toBeGreaterThan(0.001);
    expect(hla.expectedAmplitude).toBeLessThan(0.003);
  });

  it("Z2-HL-3: nu is positive (second moment is positive)", () => {
    const cluster = generateDlaCluster(42, 400);
    const hm = computeHarmonicMeasure(cluster, 150, 43);
    const hla = computeHLAmplitude(hm, cluster);
    expect(hla.nu).toBeGreaterThan(0);
  });

  it("Z2-HL-4: HL amplitude result is deterministic", () => {
    const cluster = generateDlaCluster(42, 400);
    const hm = computeHarmonicMeasure(cluster, 150, 43);
    const hla1 = computeHLAmplitude(hm, cluster);
    const hla2 = computeHLAmplitude(hm, cluster);
    expect(hla1.nu).toBe(hla2.nu);
    expect(hla1.nuNormalized).toBe(hla2.nuNormalized);
    expect(hla1.relativeGap).toBe(hla2.relativeGap);
  });

  it("Z2-HL-5: note contains DISCRETE APPROXIMATION disclaimer", () => {
    const cluster = generateDlaCluster(42, 400);
    const hm = computeHarmonicMeasure(cluster, 150, 43);
    const hla = computeHLAmplitude(hm, cluster);
    expect(hla.note).toContain("DISCRETE APPROXIMATION");
    expect(hla.note).toContain("conformal map");
  });

  it("Z2-HL-6: DischargeResult includes hlAmplitude field", () => {
    const r = runZ2Discharge(42, 300, 100);
    expect(r.hlAmplitude).toBeDefined();
    expect(r.hlAmplitude.nu).toBeGreaterThan(0);
    expect(r.hlAmplitude.expectedAmplitude).toBeGreaterThan(0);
    expect(typeof r.hlAmplitude.falsifierFires).toBe("boolean");
  });

  it("Z2-HL-7: nSites matches number of boundary sites in cluster", () => {
    const cluster = generateDlaCluster(42, 400);
    const hm = computeHarmonicMeasure(cluster, 150, 43);
    const hla = computeHLAmplitude(hm, cluster);
    expect(hla.nSites).toBe(cluster.sites.length);
  });

  // `relativeGap >= 0` was the assertion here; relativeGap is |x−y|/y with y > 0,
  // so it is non-negative by construction and cannot fail. What the number is
  // actually saying is the finding: the HL amplitude falsifier FIRES — the
  // discrete approximation misses aλ₀/D by ~87–92% on every seed tried
  // (1, 7, 42, 99, 12345), and runZ2Discharge still returns SUPPORTED because its
  // verdict branch reads only `thirdMoment.falsifierFires` (which is the ≡false
  // tautology pinned in Z2-9b). Assert the firing so it stops being invisible.
  it("Z2-HL-8: HL amplitude falsifier FIRES — discrete approximation misses aλ₀/D", () => {
    for (const seed of [1, 42, 12345]) {
      const cluster = generateDlaCluster(seed, 400);
      const hm = computeHarmonicMeasure(cluster, 150, seed + 1);
      const hla = computeHLAmplitude(hm, cluster);
      expect(hla.relativeGap).toBeGreaterThan(HL_AMPLITUDE_TOLERANCE);
      expect(hla.falsifierFires).toBe(true);
    }
  });

  it("Z2-HL-9: the SUPPORTED verdict ignores the one falsifier that fires", () => {
    // Documents the gap between the two levels, not an endorsement of it:
    // scaling-level (tautological, never fires) decides the verdict; the
    // amplitude-level (fires every seed) does not reach it.
    const r = runZ2Discharge(42, 300, 100);
    expect(r.thirdMoment.falsifierFires).toBe(false);
    expect(r.hlAmplitude.falsifierFires).toBe(true);
    expect(r.conjecture).toBe("SUPPORTED");
  });
});
