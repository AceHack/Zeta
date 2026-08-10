/**
 * sensor-fusion-oracle.test.ts — Tests for BNN+Worm mixing architecture.
 */
import { describe, test, expect } from "bun:test";
import {
  computePlv,
  ivFuse,
  detectTangle,
  fuseSensors,
  type OracleResult,
} from "./sensor-fusion-oracle";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeResult(df: number, sigma2: number, orderParameter = 1.0, variant: OracleResult["variant"] = "pure-bnn"): OracleResult {
  return { df, sigma2, orderParameter, n: 1000, variant };
}

describe("sensor-fusion-oracle", () => {
  // SF-1: PLV = 1 for identical series
  test("SF-1: PLV=1 for identical series", () => {
    const s = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
    expect(computePlv(s, s)).toBeCloseTo(1.0, 3);
  });

  // SF-2: PLV ≈ 0 for uncorrelated series
  test("SF-2: PLV ≈ 0 for uncorrelated series", () => {
    const a = [1.0, 1.2, 1.1, 1.3, 1.2, 1.4];
    const b = [1.5, 1.3, 1.6, 1.2, 1.7, 1.1];
    const plv = computePlv(a, b);
    expect(plv).toBeGreaterThanOrEqual(0);
    expect(plv).toBeLessThanOrEqual(1);
  });

  // SF-3: PLV = 0 for empty series
  test("SF-3: PLV=0 for empty/short series", () => {
    expect(computePlv([], [])).toBe(0);
    expect(computePlv([1.0], [1.0])).toBe(0);
  });

  // SF-4: IV fusion weights by precision
  test("SF-4: IV fusion weights by precision (lower sigma2 → higher weight)", () => {
    const bnn = makeResult(1.5, 0.01);   // high precision (low sigma2)
    const worm = makeResult(1.3, 0.09);  // low precision (high sigma2)
    const { df } = ivFuse(bnn, worm);
    // BNN has 9x higher precision → fused D_f should be much closer to BNN
    expect(df).toBeGreaterThan(1.45);
    expect(df).toBeLessThan(1.5);
  });

  // SF-5: IV fusion with equal precision gives midpoint
  test("SF-5: IV fusion with equal precision gives midpoint", () => {
    const bnn = makeResult(1.6, 0.04);
    const worm = makeResult(1.4, 0.04, 1.0, "pure-worm");
    const { df } = ivFuse(bnn, worm);
    expect(df).toBeCloseTo(1.5, 3);
  });

  // SF-6: Incoherent worm (r < ρ*) is downweighted
  test("SF-6: incoherent worm (r < ρ*=0.236) is downweighted", () => {
    const bnn = makeResult(1.5, 0.04);
    const worm = makeResult(1.0, 0.04, 0.1, "pure-worm");  // r=0.1 < ρ*
    const { df } = ivFuse(bnn, worm);
    // Worm is downweighted (coherenceFactor = r/ρ* = 0.1/0.236 ≈ 0.42)
    // Fused D_f is between 1.0 and 1.5, biased toward BNN
    expect(df).toBeGreaterThan(1.3);
    expect(df).toBeLessThan(1.5);
  });

  // SF-7: Tangle detected when PLV > 0.9
  test("SF-7: tangle detected when PLV > 0.9", () => {
    const result = detectTangle(0.95, 0.5);
    expect(result.tangled).toBe(true);
    if (result.tangled) expect(result.reason).toContain("phase-locked");
  });

  // SF-8: Tangle detected when rhoProxy > 0.8
  test("SF-8: tangle detected when rhoProxy > 0.8", () => {
    const result = detectTangle(0.5, 0.85);
    expect(result.tangled).toBe(true);
    if (result.tangled) expect(result.tangleBreak.adinkraCw).toEqual([0, 3, 4, 7]);
  });

  // SF-9 (negative): No tangle when PLV < 0.9 and rhoProxy < 0.8
  test("SF-9 (negative): no tangle when PLV < 0.9 and rhoProxy < 0.8", () => {
    const { tangled } = detectTangle(0.5, 0.5);
    expect(tangled).toBe(false);
  });

  // SF-10: fuseSensors blocks when tangle detected
  test("SF-10: fuseSensors blocks fusion when tangle detected", () => {
    const bnn = makeResult(1.5, 0.04);
    const worm = makeResult(1.3, 0.04, 1.0, "pure-worm");
    const s = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5];  // identical → PLV=1
    const result = fuseSensors(bnn, worm, s, s, 0.5);
    expect(result.blocked).toBe(true);
    expect(result.df).toBeCloseTo(bnn.df, 3);  // fallback to BNN
  });

  // SF-11: fuseSensors fuses when no tangle
  test("SF-11: fuseSensors fuses when no tangle", () => {
    const bnn = makeResult(1.5, 0.04);
    const worm = makeResult(1.3, 0.04, 1.0, "pure-worm");
    const a = [1.0, 1.2, 1.1, 1.3, 1.2, 1.4];
    const b = [1.5, 1.3, 1.6, 1.2, 1.7, 1.1];
    const result = fuseSensors(bnn, worm, a, b, 0.5);
    expect(result.blocked).toBe(false);
    // Fused D_f should be between BNN and Worm
    expect(result.df).toBeGreaterThan(1.3);
    expect(result.df).toBeLessThan(1.5);
  });

  // SF-12: Pure variants are never modified by fusion
  test("SF-12: pure variants are never modified by fusion", () => {
    const bnn = makeResult(1.5, 0.04);
    const worm = makeResult(1.3, 0.04, 1.0, "pure-worm");
    const a = [1.0, 1.2, 1.1, 1.3];
    const b = [1.5, 1.3, 1.6, 1.2];
    const result = fuseSensors(bnn, worm, a, b, 0.5);
    // Pure variants are returned unchanged in the result
    expect(result.bnn.df).toBe(bnn.df);
    expect(result.worm.df).toBe(worm.df);
    expect(result.bnn.variant).toBe("pure-bnn");
    expect(result.worm.variant).toBe("pure-worm");
  });
});
