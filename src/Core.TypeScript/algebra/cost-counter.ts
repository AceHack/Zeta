/**
 * src/Core.TypeScript/algebra/cost-counter.ts — Injected cost-counting effect.
 *
 * The DST cost-counter: counts ring-ops deterministically and replayably.
 * NOT an ambient mutable — it's an injected effect (metered door), per §13.
 *
 * Design (Soraya's routing):
 * - Interface = upper-bound CONTRACT (demand on conforming impls)
 * - Instance = counted WITNESS (actual measured cost)
 * - Obligation: witness ≤ contract (Liskov substitutability for cost)
 *
 * The counter wraps any StarRing instance and counts each operation invocation.
 * After execution, the count is the WITNESS. Compare to the CONTRACT to verify.
 */

import type { StarRing } from "./star-ring";

// ─── Cost Vector ─────────────────────────────────────────────────────────

/** Cost vector: {time, space} tracked separately (they trade off). */
export interface CostVector {
  /** Number of ring-ops invoked (the time dimension). */
  time: number;
  /** Peak live entries during execution (the space dimension). */
  space: number;
}

// ─── Cost Contract ──────────────────────────────────────────────────────

/** A cost contract: upper bound on cost for a specific operation at input size n. */
export interface CostContract {
  op: string;
  /** The contract function: given input size n, returns the max allowed cost. */
  maxCost: (n: number) => CostVector;
  doc?: string;
}

// ─── Counted Ring (the injected effect) ──────────────────────────────────

/**
 * A StarRing wrapper that counts every operation invocation.
 * This IS the injected cost-counter effect — deterministic, replayable,
 * threaded through the computation (not an ambient global).
 *
 * Usage:
 *   const { ring, counter } = createCountedRing(realRing);
 *   // ... run computation using 'ring' ...
 *   console.log(counter.counts); // { add: 5, mul: 3, negate: 1, conj: 0 }
 */
export interface OpCounts {
  add: number;
  mul: number;
  negate: number;
  conj: number;
  /** Total = add + mul + negate + conj */
  total: number;
}

export interface CostCounter {
  readonly counts: OpCounts;
  reset(): void;
}

export function createCountedRing<T>(base: StarRing<T>): { ring: StarRing<T>; counter: CostCounter } {
  const counts: OpCounts = { add: 0, mul: 0, negate: 0, conj: 0, total: 0 };

  const ring: StarRing<T> = {
    zero: base.zero,
    one: base.one,
    add(a: T, b: T): T {
      counts.add++;
      counts.total++;
      return base.add(a, b);
    },
    mul(a: T, b: T): T {
      counts.mul++;
      counts.total++;
      return base.mul(a, b);
    },
    negate(a: T): T {
      counts.negate++;
      counts.total++;
      return base.negate(a);
    },
    conj(a: T): T {
      counts.conj++;
      counts.total++;
      return base.conj(a);
    },
  };

  const counter: CostCounter = {
    get counts() { return { ...counts }; },
    reset() {
      counts.add = 0;
      counts.mul = 0;
      counts.negate = 0;
      counts.conj = 0;
      counts.total = 0;
    },
  };

  return { ring, counter };
}

// ─── Consolidate Cost Counter (counts eq() calls) ────────────────────────

/**
 * Count equality comparisons in consolidate.
 * This is separate from ring-ops because eq() is the operation that
 * makes consolidate O(n²) — the thing we want to flag.
 */
export interface EqCounter {
  readonly eqCalls: number;
  reset(): void;
}

export function createCountedEq<K>(baseEq: (a: K, b: K) => boolean): { eq: (a: K, b: K) => boolean; counter: EqCounter } {
  let eqCalls = 0;

  const eq = (a: K, b: K): boolean => {
    eqCalls++;
    return baseEq(a, b);
  };

  const counter: EqCounter = {
    get eqCalls() { return eqCalls; },
    reset() { eqCalls = 0; },
  };

  return { eq, counter };
}

// ─── Verify: witness ≤ contract ──────────────────────────────────────────

export interface CostVerification {
  law: string;
  inputSize: number;
  witness: CostVector;
  contract: CostVector;
  holds: boolean;
}

export function verifyCost(
  lawId: string,
  inputSize: number,
  witness: CostVector,
  contract: CostContract,
): CostVerification {
  const maxAllowed = contract.maxCost(inputSize);
  const holds = witness.time <= maxAllowed.time && witness.space <= maxAllowed.space;
  return { law: lawId, inputSize, witness, contract: maxAllowed, holds };
}
