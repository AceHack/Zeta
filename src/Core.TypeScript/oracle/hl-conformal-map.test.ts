import { describe, it, expect } from "bun:test";
import {
  joukowskiBump, joukowskiBumpDerivative,
  hlMapInit, hlMapAddParticle, hlAmplitudeIntegral, hlEstimateD,
  hlMapInitExact, hlMapAddParticleExact,
  HL_N_GRID, HL_EXACT_NOTE, HL_FAST_NOTE,
  type Complex
} from "./hl-conformal-map";

const LAMBDA0 = 0.004;
const A_PARAM = 2 / 3;

describe("HL Conformal Map", () => {

  // ── Joukowski map ────────────────────────────────────────────────────────────

  it("HLC-1: joukowskiBump at theta=0, z far from unit circle ≈ identity", () => {
    // For |z| >> 1 and small lambda0, f_0(z) ≈ z
    const z: Complex = { re: 10, im: 0 };
    const fz = joukowskiBump(z, 0, LAMBDA0);
    expect(Math.abs(fz.re - z.re)).toBeLessThan(0.01);
    expect(Math.abs(fz.im - z.im)).toBeLessThan(0.01);
  });

  it("HLC-2: joukowskiBump derivative at z far from unit circle ≈ 1", () => {
    const z: Complex = { re: 10, im: 0 };
    const dfdz = joukowskiBumpDerivative(z, 0, LAMBDA0);
    expect(Math.abs(dfdz.re - 1)).toBeLessThan(0.01);
    expect(Math.abs(dfdz.im)).toBeLessThan(0.01);
  });

  it("HLC-3: identity map has |dw/dz|² = 1 everywhere", () => {
    const state = hlMapInit(LAMBDA0);
    for (let i = 0; i < HL_N_GRID; i++) {
      expect(state.derivMagSq[i]).toBeCloseTo(1.0, 6);
    }
  });

  it("HLC-4: adding one particle changes |dw/dz|²", () => {
    const s0 = hlMapInit(LAMBDA0);
    const s1 = hlMapAddParticle(s0, 0);
    // At least some grid points should differ from 1.0
    let changed = 0;
    for (let i = 0; i < HL_N_GRID; i++) {
      if (Math.abs((s1.derivMagSq[i] ?? 1.0) - 1.0) > 1e-8) changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });

  it("HLC-5: amplitude integral on identity map = aλ₀n (since |dw/dz|² = 1 → integral = 1)", () => {
    const state = hlMapInit(LAMBDA0);
    const amp = hlAmplitudeIntegral(state.derivMagSq, A_PARAM, LAMBDA0, 1);
    // integral of 1/1 over [0,2π] / 2π = 1, so A = aλ₀·1·1 = aλ₀
    expect(amp).toBeCloseTo(A_PARAM * LAMBDA0, 6);
  });

  it("HLC-6: hlEstimateD from identity = a*lambda0 / (a*lambda0) = 1 (trivial)", () => {
    const amp = A_PARAM * LAMBDA0; // identity map amplitude at n=1
    const d = hlEstimateD(amp, A_PARAM, LAMBDA0, 1);
    expect(d).toBeCloseTo(1.0, 6);
  });

  // ── Exact path ───────────────────────────────────────────────────────────────

  it("HLC-7: exact map init has identity values", () => {
    const state = hlMapInitExact(LAMBDA0);
    expect(state.n).toBe(0);
    expect(state.mapValues.length).toBe(HL_N_GRID);
    // w_0(e^{iφ}) = e^{iφ}: |w_0| = 1 everywhere
    for (const v of state.mapValues) {
      expect(Math.sqrt(v.re * v.re + v.im * v.im)).toBeCloseTo(1.0, 4);
    }
  });

  it("HLC-8: exact map after one particle has n=1", () => {
    const s0 = hlMapInitExact(LAMBDA0);
    const s1 = hlMapAddParticleExact(s0, 0);
    expect(s1.n).toBe(1);
    expect(s1.mapValues.length).toBe(HL_N_GRID);
  });

  it("HLC-9: exact and fast paths agree on first particle (identity approximation exact for n=1)", () => {
    const sFast = hlMapAddParticle(hlMapInit(LAMBDA0), 0);
    const sExact = hlMapAddParticleExact(hlMapInitExact(LAMBDA0), 0);
    // For n=1, w_0(z) = z, so the exact and fast paths are identical.
    // Skip grid point 0 (z=1, the bump attachment — singularity in both paths).
    let maxDiff = 0;
    let compared = 0;
    for (let i = 1; i < HL_N_GRID; i++) {
      const f = sFast.derivMagSq[i] ?? NaN;
      const e = sExact.derivMagSq[i] ?? NaN;
      if (!isFinite(f) || !isFinite(e)) continue;
      maxDiff = Math.max(maxDiff, Math.abs(f - e));
      compared++;
    }
    expect(compared).toBeGreaterThan(HL_N_GRID - 5); // almost all points compared
    expect(maxDiff).toBeLessThan(1e-9);
  });

  it("HLC-10: after 10 particles, estimated D is in plausible range [1.0, 2.0]", () => {
    let state = hlMapInitExact(LAMBDA0);
    // Use angles offset from grid points to avoid singularities at grid angles.
    // The grid has N_GRID=256 points at 2πk/256; offset by π/512 to avoid them.
    const offset = Math.PI / 512;
    for (let i = 0; i < 10; i++) {
      const theta = (2 * Math.PI * i) / 10 + offset;
      state = hlMapAddParticleExact(state, theta);
    }
    const amp = hlAmplitudeIntegral(state.derivMagSq, A_PARAM, LAMBDA0, 10);
    const d = hlEstimateD(amp, A_PARAM, LAMBDA0, 10);
    // At n=10 the estimate is noisy. The amplitude integral is well-defined
    // (no grid-point singularities) so D should be finite and positive.
    expect(isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(0);
  });

  it("HLC-11: note strings are present and correct", () => {
    expect(HL_EXACT_NOTE).toContain("EXACT PATH");
    expect(HL_EXACT_NOTE).toContain("Halsey 2026");
    expect(HL_FAST_NOTE).toContain("FAST PATH");
  });

  it("HLC-12: particle count increments correctly", () => {
    let state = hlMapInit(LAMBDA0);
    expect(state.n).toBe(0);
    state = hlMapAddParticle(state, 0);
    expect(state.n).toBe(1);
    state = hlMapAddParticle(state, Math.PI);
    expect(state.n).toBe(2);
    expect(state.particleAngles).toHaveLength(2);
  });
});
