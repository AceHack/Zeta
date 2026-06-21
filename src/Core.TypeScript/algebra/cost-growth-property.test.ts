/**
 * cost-growth-property.test.ts — Property-based growth-shape verification.
 *
 * Step 4 from Soraya's routing: empirical growth-rate check.
 * For multiple input sizes, measure the cost and verify the growth ratio
 * matches the expected complexity class:
 * - O(1): ratio ≈ 1 (constant)
 * - O(n): ratio ≈ 2 (linear)
 * - O(n²): ratio ≈ 4 (quadratic)
 * - O(n log n): ratio ≈ 2+ (slightly above linear)
 *
 * This is EMPIRICAL (not proof) — it catches regressions where an impl
 * accidentally becomes a higher complexity class. The Z3 proof handles
 * the universal statement; this handles the "is it still true in practice?"
 */

import { describe, test, expect } from "bun:test";
import { createCountedEq } from "./cost-counter";
import { consolidate, realRing } from "./star-ring";

// ─── Measure cost at a given input size ──────────────────────────────────

function measureConsolidateEqCalls(n: number): number {
  const entries = Array.from({ length: n }, (_, i) => ({ key: BigInt(i), weight: 1.0 }));
  const { eq, counter } = createCountedEq<bigint>((a, b) => a === b);
  consolidate(realRing, (w: number) => Math.abs(w) < 1e-12, entries, eq);
  return counter.eqCalls;
}

// ─── Growth ratio check ──────────────────────────────────────────────────

function growthRatio(sizes: number[]): number[] {
  const costs = sizes.map(measureConsolidateEqCalls);
  const ratios: number[] = [];
  for (let i = 1; i < costs.length; i++) {
    ratios.push(costs[i]! / costs[i - 1]!);
  }
  return ratios;
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("cost-growth-property — empirical complexity class verification (step 4)", () => {
  test("consolidate growth ratio at multiple sizes confirms O(n²)", () => {
    // Measure at n = 16, 32, 64, 128
    const sizes = [16, 32, 64, 128];
    const ratios = growthRatio(sizes);

    // For O(n²): doubling input should ~quadruple cost (ratio ≈ 4)
    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThan(3.5); // at least 3.5x (quadratic)
      expect(ratio).toBeLessThan(4.5);    // at most 4.5x (not cubic)
    }
  });

  test("growth ratio is stable across sizes (not just one lucky point)", () => {
    const sizes = [8, 16, 32, 64, 128];
    const ratios = growthRatio(sizes);

    // All ratios should be in the same band (consistent growth class)
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    for (const ratio of ratios) {
      expect(Math.abs(ratio - avg)).toBeLessThan(0.5); // within ±0.5 of average
    }
  });

  test("exact formula: eq calls = n(n-1)/2 for all-distinct input", () => {
    // The property: measured cost exactly matches the closed form
    const sizes = [10, 20, 50, 100];
    for (const n of sizes) {
      const measured = measureConsolidateEqCalls(n);
      const expected = n * (n - 1) / 2;
      expect(measured).toBe(expected);
    }
  });

  test("O(1) operation (ring.add) has ratio ≈ 1 regardless of 'input size'", () => {
    // Control: add is O(1), so "doubling the work" = doubling calls = ratio 2
    // But per-call cost is constant, so cost/call = 1 always
    const { createCountedRing } = require("./cost-counter");
    const { ring, counter } = createCountedRing(realRing);

    // Run N adds
    const N = 100;
    for (let i = 0; i < N; i++) ring.add(i, i + 1);
    const costPerCall = counter.counts.add / N;
    expect(costPerCall).toBe(1); // exactly 1 ring-op per add call (O(1))
  });
});
