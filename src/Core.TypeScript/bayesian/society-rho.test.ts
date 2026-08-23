import { describe, expect, test } from "bun:test";
import { pearson, societyRho } from "./society-rho";

describe("society ρ", () => {
  test("identical members read ρ = 1 (the collapse the display exists to catch)", () => {
    const v = [0.1, 0.4, -0.2, 0.9, 0.0];
    const r = societyRho([v, [...v], [...v]]);
    expect(r.pairs).toBe(3);
    expect(r.mean).toBeCloseTo(1, 6);
    expect(r.max).toBeCloseTo(1, 6);
  });

  test("anti-correlated pair reads −1; orthogonal-ish members read near 0", () => {
    const a = [1, 2, 3, 4];
    const b = [4, 3, 2, 1];
    expect(pearson(a, b)).toBeCloseTo(-1, 6);
    // A vector uncorrelated with a: r should be far from ±1.
    const c = [1, -1, 1, -1];
    expect(Math.abs(pearson(a, c))).toBeLessThan(0.5);
  });

  test("degenerate input (constant vectors, singleton society) reports 0 over its pairs", () => {
    expect(pearson([2, 2, 2], [1, 5, 9])).toBe(0);
    expect(societyRho([[1, 2, 3]])).toEqual({ mean: 0, max: 0, pairs: 0 });
    expect(societyRho([])).toEqual({ mean: 0, max: 0, pairs: 0 });
  });

  test("max surfaces the closest pair even when the mean is moderate", () => {
    const a = [1, 2, 3, 4, 5];
    const twin = [1.01, 2.02, 2.99, 4.01, 5.0]; // near-copy of a
    const other = [3, 1, 4, 1, 5]; // unrelated
    const r = societyRho([a, twin, other]);
    expect(r.max).toBeGreaterThan(0.99);
    expect(r.mean).toBeLessThan(r.max);
  });
});
