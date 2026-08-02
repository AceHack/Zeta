/**
 * exact-weight.test.ts — Property tests for the middle-out float WSet weight ring.
 *
 * The proof it works: 100-permutation byte-lock test passes WITHOUT canonical sort
 * when 'W is ExactWeight. The sabotage control (fixedPrecisionRing) FAILS it —
 * proving the expansion is load-bearing.
 *
 * Ring laws asserted as EXACT (===), not toBeCloseTo.
 */

import { describe, test, expect } from "bun:test";
import {
  ExactProbRing,
  fixedPrecisionRing,
  exact,
  fromNumber,
  toNumber,
  exactEquals,
  isExactZero,
  serializeExact,
  type ExactWeight,
} from "./exact-weight";
import { consolidateWSet, type WSet } from "./wset";

// ═══ Ring Law Tests (exact equality) ═════════════════════════════════════════

describe("ExactProbRing — ring laws (exact, not approximate)", () => {
  const R = ExactProbRing;
  const a = exact(1n, 3n);   // 1/3
  const b = exact(1n, 7n);   // 1/7
  const c = exact(2n, 5n);   // 2/5

  test("additive commutativity: a + b === b + a", () => {
    expect(exactEquals(R.add(a, b), R.add(b, a))).toBe(true);
  });

  test("additive associativity: (a + b) + c === a + (b + c)", () => {
    expect(exactEquals(R.add(R.add(a, b), c), R.add(a, R.add(b, c)))).toBe(true);
  });

  test("multiplicative commutativity: a * b === b * a", () => {
    expect(exactEquals(R.mul(a, b), R.mul(b, a))).toBe(true);
  });

  test("multiplicative associativity: (a * b) * c === a * (b * c)", () => {
    expect(exactEquals(R.mul(R.mul(a, b), c), R.mul(a, R.mul(b, c)))).toBe(true);
  });

  test("distributivity: a * (b + c) === a*b + a*c", () => {
    const left = R.mul(a, R.add(b, c));
    const right = R.add(R.mul(a, b), R.mul(a, c));
    expect(exactEquals(left, right)).toBe(true);
  });

  test("additive identity: a + 0 === a", () => {
    expect(exactEquals(R.add(a, R.zero), a)).toBe(true);
  });

  test("multiplicative identity: a * 1 === a", () => {
    expect(exactEquals(R.mul(a, R.one), a)).toBe(true);
  });

  test("zero annihilation: a * 0 === 0", () => {
    expect(exactEquals(R.mul(a, R.zero), R.zero)).toBe(true);
  });

  test("negate: a + (-a) === 0", () => {
    expect(exactEquals(R.add(a, R.negate!(a)), R.zero)).toBe(true);
  });
});

// ═══ fromNumber round-trip ═══════════════════════════════════════════════════

describe("ExactWeight construction", () => {
  test("fromNumber(0.5) is exactly 1/2", () => {
    const w = fromNumber(0.5);
    expect(w.num).toBe(1n);
    expect(w.den).toBe(2n);
  });

  test("fromNumber(0.1) round-trips through toNumber", () => {
    const w = fromNumber(0.1);
    expect(toNumber(w)).toBe(0.1);
  });

  test("exact(6, 4) normalizes to 3/2", () => {
    const w = exact(6n, 4n);
    expect(w.num).toBe(3n);
    expect(w.den).toBe(2n);
  });

  test("exact(-3, -5) normalizes to 3/5 (positive denominator)", () => {
    const w = exact(-3n, -5n);
    expect(w.num).toBe(3n);
    expect(w.den).toBe(5n);
  });

  test("isExactZero identifies zero", () => {
    expect(isExactZero(exact(0n, 7n))).toBe(true);
    expect(isExactZero(exact(1n, 7n))).toBe(false);
  });

  test("serializeExact is canonical", () => {
    expect(serializeExact(exact(3n, 1n))).toBe("3");
    expect(serializeExact(exact(1n, 3n))).toBe("1/3");
    expect(serializeExact(exact(6n, 4n))).toBe("3/2"); // normalized
  });
});

// ═══ The 100-Permutation Byte-Lock Test (THE PROOF) ══════════════════════════

describe("100-permutation byte-lock: ExactProbRing passes WITHOUT sort", () => {
  // Build a WSet with values that would produce different IEEE-754 results
  // depending on accumulation order (the classic non-associativity case)
  const factors: WSet<string, ExactWeight>[] = Array.from({ length: 8 }, (_, i) => [
    { key: "state-A", weight: fromNumber(0.1 + i * 0.017) },
    { key: "state-B", weight: fromNumber(0.3 - i * 0.013) },
    { key: "state-C", weight: fromNumber(0.05 + i * 0.0091) },
  ]);

  function fuseAll(orderedFactors: WSet<string, ExactWeight>[]): string {
    // Fuse by consolidating all factors together — NO SORT
    const allEntries = orderedFactors.flat();
    const consolidated = consolidateWSet(
      ExactProbRing,
      isExactZero,
      (k) => k,
      allEntries,
    );
    // Serialize to a deterministic string for byte-lock comparison
    return consolidated
      .map((e) => `${e.key}:${serializeExact(e.weight)}`)
      .sort() // sort the OUTPUT for comparison only (not the accumulation)
      .join("|");
  }

  test("reference fusion produces a deterministic result", () => {
    const ref = fuseAll(factors);
    expect(ref.length).toBeGreaterThan(0);
    expect(ref).toContain("state-A:");
  });

  test("100 random permutations produce byte-identical results (no sort in accumulation)", () => {
    const reference = fuseAll(factors);

    for (let perm = 0; perm < 100; perm++) {
      // Shuffle factor arrival order
      const shuffled = [...factors].sort(() => Math.random() - 0.5);
      const result = fuseAll(shuffled);
      expect(result).toBe(reference);
    }
  });
});

// ═══ Sabotage Control: fixedPrecisionRing FAILS the permutation test ═════════

describe("sabotage control: fixedPrecisionRing FAILS byte-lock without sort", () => {
  const brokenRing = fixedPrecisionRing(4); // 4 decimal digits — aggressive truncation

  // More entries per key to amplify truncation differences across orderings
  const factors: WSet<string, ExactWeight>[] = Array.from({ length: 12 }, (_, i) => [
    { key: "state-A", weight: fromNumber(0.000123 * (i + 1) + 0.000007 * i * i) },
    { key: "state-B", weight: fromNumber(0.000456 * (i + 1) - 0.0000031 * i) },
  ]);

  function fuseAllBroken(orderedFactors: WSet<string, ExactWeight>[]): string {
    // Accumulate ONE ENTRY AT A TIME in the given order — this is where
    // truncation order matters. consolidateWSet processes in array order,
    // so shuffling the input array changes the truncation sequence.
    let accumulated: WSet<string, ExactWeight> = [];
    for (const factor of orderedFactors) {
      accumulated = [...accumulated, ...factor];
    }
    const consolidated = consolidateWSet(
      brokenRing,
      isExactZero,
      (k) => k,
      accumulated,
    );
    return consolidated
      .map((e) => `${e.key}:${serializeExact(e.weight)}`)
      .sort()
      .join("|");
  }

  test("fixed-precision ring produces DIFFERENT results for different orders (proving expansion is load-bearing)", () => {
    const reference = fuseAllBroken(factors);

    let foundDifference = false;
    for (let perm = 0; perm < 200; perm++) {
      const shuffled = [...factors].sort(() => Math.random() - 0.5);
      const result = fuseAllBroken(shuffled);
      if (result !== reference) {
        foundDifference = true;
        break;
      }
    }

    // The sabotage control MUST find at least one permutation that differs.
    // If it doesn't, the truncation precision is too generous — the test
    // isn't proving what it claims. Tighten `precision` until it breaks.
    expect(foundDifference).toBe(true);
  });
});

// ═══ WSet consolidation with ExactProbRing ═══════════════════════════════════

describe("WSet operations with ExactProbRing", () => {
  test("consolidation sums weights exactly", () => {
    const set: WSet<string, ExactWeight> = [
      { key: "x", weight: exact(1n, 3n) },
      { key: "x", weight: exact(1n, 6n) },
      { key: "y", weight: exact(2n, 5n) },
    ];

    const result = consolidateWSet(ExactProbRing, isExactZero, (k) => k, set);
    const x = result.find((e) => e.key === "x");
    const y = result.find((e) => e.key === "y");

    // 1/3 + 1/6 = 1/2 exactly
    expect(x).toBeDefined();
    expect(exactEquals(x!.weight, exact(1n, 2n))).toBe(true);

    // 2/5 unchanged
    expect(y).toBeDefined();
    expect(exactEquals(y!.weight, exact(2n, 5n))).toBe(true);
  });

  test("consolidation drops zero-weight entries", () => {
    const set: WSet<string, ExactWeight> = [
      { key: "x", weight: exact(1n, 3n) },
      { key: "x", weight: exact(-1n, 3n) }, // cancels
    ];

    const result = consolidateWSet(ExactProbRing, isExactZero, (k) => k, set);
    expect(result.length).toBe(0);
  });
});
