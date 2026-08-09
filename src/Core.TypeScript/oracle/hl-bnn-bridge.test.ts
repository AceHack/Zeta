import { describe, it, expect } from "bun:test";
import {
  createDBnn, updateDBnn, inferDBnn,
  fastObservation, exactObservation,
  hasConverged, credibleInterval, isConsistentWithHalsey2026,
  HALSEY_2026_D, HALSEY_2026_D_ERROR,
  type HLObservation
} from "./hl-bnn-bridge";

const A = 2 / 3;
const LAMBDA0 = 0.004;

describe("HL-BNN Bridge", () => {

  it("HLB-1: createDBnn has correct prior", () => {
    const bnn = createDBnn();
    expect(bnn.muD).toBeCloseTo(1.71, 6);
    expect(bnn.sigma2D).toBeCloseTo(0.01, 6);
    expect(bnn.obsCount).toBe(0);
  });

  it("HLB-2: updateDBnn with exact D observation converges to true D", () => {
    let bnn = createDBnn(1.71, 0.01, 0.001);
    // Simulate 50 observations at D = 1.703 (Halsey 2026 value)
    const trueD = 1.703;
    for (let n = 1; n <= 50; n++) {
      const amplitude = (A * LAMBDA0) / trueD; // A_n = aλ₀/D (exact)
      const obs = fastObservation(n, amplitude, A, LAMBDA0);
      bnn = updateDBnn(bnn, obs);
    }
    expect(bnn.muD).toBeCloseTo(trueD, 1);
    expect(bnn.obsCount).toBe(50);
  });

  it("HLB-3: posterior variance decreases monotonically", () => {
    let bnn = createDBnn();
    let prevSigma2 = bnn.sigma2D;
    for (let n = 1; n <= 10; n++) {
      const obs = fastObservation(n, (A * LAMBDA0) / 1.71, A, LAMBDA0);
      bnn = updateDBnn(bnn, obs);
      expect(bnn.sigma2D).toBeLessThan(prevSigma2);
      prevSigma2 = bnn.sigma2D;
    }
  });

  it("HLB-4: NaN amplitude is ignored (no update)", () => {
    const bnn = createDBnn();
    const obs = fastObservation(1, NaN, A, LAMBDA0);
    const updated = updateDBnn(bnn, obs);
    expect(updated.muD).toBe(bnn.muD);
    expect(updated.sigma2D).toBe(bnn.sigma2D);
    expect(updated.obsCount).toBe(bnn.obsCount);
  });

  it("HLB-5: inferDBnn folds a stream of observations", () => {
    const bnn = createDBnn();
    const obs: HLObservation[] = Array.from({ length: 20 }, (_, i) => {
      const n = i + 1;
      return fastObservation(n, (A * LAMBDA0) / 1.703, A, LAMBDA0);
    });
    const result = inferDBnn(obs, bnn);
    expect(result.bnn.obsCount).toBe(20);
    expect(result.observations).toHaveLength(20);
  });

  it("HLB-6: hasConverged returns false for fresh prior", () => {
    const bnn = createDBnn();
    expect(hasConverged(bnn)).toBe(false); // σ = 0.1 > 0.01
  });

  it("HLB-7: hasConverged returns true after many observations", () => {
    let bnn = createDBnn(1.71, 0.01, 0.001);
    for (let n = 1; n <= 200; n++) {
      const obs = fastObservation(n, (A * LAMBDA0) / 1.703, A, LAMBDA0);
      bnn = updateDBnn(bnn, obs);
    }
    expect(hasConverged(bnn)).toBe(true);
  });

  it("HLB-8: credibleInterval contains true D after convergence", () => {
    let bnn = createDBnn(1.71, 0.01, 0.001);
    for (let n = 1; n <= 100; n++) {
      const obs = fastObservation(n, (A * LAMBDA0) / 1.703, A, LAMBDA0);
      bnn = updateDBnn(bnn, obs);
    }
    const [lo, hi] = credibleInterval(bnn);
    expect(lo).toBeLessThan(1.703);
    expect(hi).toBeGreaterThan(1.703);
  });

  it("HLB-9: isConsistentWithHalsey2026 after convergence to 1.703", () => {
    let bnn = createDBnn(1.71, 0.01, 0.001);
    for (let n = 1; n <= 100; n++) {
      const obs = fastObservation(n, (A * LAMBDA0) / 1.703, A, LAMBDA0);
      bnn = updateDBnn(bnn, obs);
    }
    expect(isConsistentWithHalsey2026(bnn)).toBe(true);
  });

  it("HLB-10: isConsistentWithHalsey2026 false after convergence to wrong D", () => {
    let bnn = createDBnn(1.5, 0.0001, 0.0001); // very tight prior at wrong D
    for (let n = 1; n <= 200; n++) {
      const obs = fastObservation(n, (A * LAMBDA0) / 1.5, A, LAMBDA0);
      bnn = updateDBnn(bnn, obs);
    }
    expect(isConsistentWithHalsey2026(bnn)).toBe(false);
  });

  it("HLB-11: exact and fast paths produce same derivedD for same amplitude", () => {
    const amp = 0.0025;
    const fast = fastObservation(100, amp, A, LAMBDA0);
    const exact = exactObservation(100, amp, A, LAMBDA0);
    expect(fast.derivedD).toBeCloseTo(exact.derivedD, 10);
    expect(fast.path).toBe("fast");
    expect(exact.path).toBe("exact");
  });

  it("HLB-12: HALSEY_2026_D and error constants are correct", () => {
    expect(HALSEY_2026_D).toBeCloseTo(1.703, 3);
    expect(HALSEY_2026_D_ERROR).toBeCloseTo(0.001, 3);
  });
});
