import { describe, test, expect } from "bun:test";
import { createCountedRing, createCountedEq, verifyCost, type CostContract } from "./cost-counter";
import { realRing, consolidate } from "./star-ring";

describe("cost-counter — injected effect (metered door)", () => {
  test("counts ring ops correctly", () => {
    const { ring, counter } = createCountedRing(realRing);
    ring.add(1, 2);
    ring.add(3, 4);
    ring.mul(5, 6);
    expect(counter.counts.add).toBe(2);
    expect(counter.counts.mul).toBe(1);
    expect(counter.counts.total).toBe(3);
  });

  test("reset clears all counts", () => {
    const { ring, counter } = createCountedRing(realRing);
    ring.add(1, 2);
    ring.mul(3, 4);
    counter.reset();
    expect(counter.counts.total).toBe(0);
  });

  test("counted ring produces same results as base ring", () => {
    const { ring } = createCountedRing(realRing);
    expect(ring.add(3, 4)).toBe(7);
    expect(ring.mul(3, 4)).toBe(12);
    expect(ring.negate(5)).toBe(-5);
    expect(ring.conj(7)).toBe(7); // real conj = identity
  });

  test("counter is deterministic (same ops → same count)", () => {
    const run = () => {
      const { ring, counter } = createCountedRing(realRing);
      for (let i = 0; i < 10; i++) ring.add(i, i + 1);
      for (let i = 0; i < 5; i++) ring.mul(i, i);
      return counter.counts;
    };
    const r1 = run();
    const r2 = run();
    expect(r1).toEqual(r2);
  });
});

describe("cost-counter — consolidate O(n²) flag (the failing demo)", () => {
  test("consolidate eq() count on all-distinct input = n(n-1)/2 (quadratic)", () => {
    // All-distinct keys: worst case for consolidate's nested find
    const n = 20;
    const entries = Array.from({ length: n }, (_, i) => ({ key: BigInt(i), weight: 1.0 }));

    const { eq, counter } = createCountedEq<bigint>((a, b) => a === b);
    // Run consolidate with our counted eq
    consolidate(realRing, (w: number) => Math.abs(w) < 1e-12, entries, eq);

    // Worst case: each entry scans the accumulated result → 0+1+2+...+(n-1) = n(n-1)/2
    const worstCase = n * (n - 1) / 2;
    // The actual count should be close to this (implementation-dependent exact value)
    expect(counter.eqCalls).toBeGreaterThan(0);
    expect(counter.eqCalls).toBeLessThanOrEqual(worstCase);
  });

  test("consolidate violates O(n) contract (the flag)", () => {
    const n = 64;
    const entries = Array.from({ length: n }, (_, i) => ({ key: BigInt(i), weight: 1.0 }));

    const { eq, counter } = createCountedEq<bigint>((a, b) => a === b);
    consolidate(realRing, (w: number) => Math.abs(w) < 1e-12, entries, eq);

    // O(n) contract: eq calls should be ≤ c*n for some small constant c
    const linearContract: CostContract = {
      op: "consolidate.eq",
      maxCost: (size) => ({ time: size * 2, space: size }), // generous: 2n
      doc: "consolidate should be O(n) for eq comparisons",
    };

    const result = verifyCost(
      "consolidate-eq-linear",
      n,
      { time: counter.eqCalls, space: n },
      linearContract,
    );

    // THIS SHOULD FAIL — consolidate is O(n²), not O(n)
    // The flag demonstrates the checker catching a real performance lie.
    expect(result.holds).toBe(false);
    expect(result.witness.time).toBeGreaterThan(result.contract.time);
  });

  test("numberSemiring.add satisfies O(1) contract (the passing case)", () => {
    const { ring, counter } = createCountedRing(realRing);

    // Run add N times
    const N = 100;
    for (let i = 0; i < N; i++) ring.add(i, i + 1);

    // O(1) per call: total should be exactly N
    const contract: CostContract = {
      op: "add",
      maxCost: (size) => ({ time: size, space: 0 }),
      doc: "add is O(1) — one arithmetic instruction per call",
    };

    const result = verifyCost("semiring-add-O1", N, { time: counter.counts.add, space: 0 }, contract);
    expect(result.holds).toBe(true);
    expect(result.witness.time).toBe(N); // exactly N add ops
  });

  test("growth check: consolidate at n vs 2n (quadratic growth)", () => {
    const measure = (size: number): number => {
      const entries = Array.from({ length: size }, (_, i) => ({ key: BigInt(i), weight: 1.0 }));
      const { eq, counter } = createCountedEq<bigint>((a, b) => a === b);
      consolidate(realRing, (w: number) => Math.abs(w) < 1e-12, entries, eq);
      return counter.eqCalls;
    };

    const n = 32;
    const costN = measure(n);
    const cost2N = measure(n * 2);

    // For O(n²): cost(2n)/cost(n) ≈ 4
    // For O(n): cost(2n)/cost(n) ≈ 2
    const ratio = cost2N / costN;
    expect(ratio).toBeGreaterThan(3); // should be ~4 (quadratic)
    expect(ratio).toBeLessThan(5);    // sanity check
  });
});
