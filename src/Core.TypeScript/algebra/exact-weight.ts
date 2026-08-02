/**
 * exact-weight.ts — Middle-out expanding-precision float as a WSet 'W weight ring.
 *
 * Provides an exact arithmetic weight type where add/mul are TRULY commutative and
 * associative — no canonical sort needed for byte-lock commutativity.
 *
 * Representation: a rational number (bigint numerator / bigint denominator) with
 * exact arithmetic. In the sum-product domain, Bayesian factor accumulation is
 * pure +/× over rationals — no transcendentals, no underflow, no IEEE-754
 * non-associativity.
 *
 * WHY RATIONAL (not interval/ball): in the sum-product domain the operations are
 * purely {+, ×, negate} — all closed over Q. An interval/ball representation adds
 * complexity for tracking uncertainty that doesn't exist when the arithmetic is exact.
 * The transcendental-refinement policy (for exp/log) is edge-case-only and deferred.
 *
 * ANTI-CONFLATION: this makes ACCUMULATION order-independent (exact +/×). It does
 * NOT recover lost information — that is ECC (ErasureDistance.lean, Singleton-bounded).
 *
 * Composes with:
 * - src/Core.TypeScript/algebra/wset.ts (the StarRing<W> interface)
 * - src/Core.TypeScript/bayesian/categorical-bayesian-planner.ts (the byte-lock test target)
 * - Lior's canonical sort stays the shipped default; this is OPT-IN.
 *
 * Spec: docs/research/2026-08-02-alexa-implementation-handoff-…-middle-out-float-wset-weight.md
 */

import type { StarRing } from "./wset";

// ═══ ExactWeight — rational with normalized representation ═══════════════════

/**
 * An exact rational number: numerator / denominator, always in lowest terms,
 * denominator always positive. This is the 'W that makes WSet commutativity intrinsic.
 */
export interface ExactWeight {
  readonly num: bigint;   // signed numerator
  readonly den: bigint;   // positive denominator (always > 0)
}

/** GCD for normalization (Euclidean algorithm over bigint). */
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/** Create a normalized ExactWeight. */
export function exact(num: bigint, den: bigint = 1n): ExactWeight {
  if (den === 0n) throw new Error("ExactWeight: denominator cannot be zero");
  // Normalize sign: denominator always positive
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  // Reduce to lowest terms
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

/** Create from a JavaScript number (converts to rational via power-of-2 denominator). */
export function fromNumber(x: number): ExactWeight {
  if (x === 0) return { num: 0n, den: 1n };
  if (!Number.isFinite(x)) throw new Error(`ExactWeight: cannot represent ${x}`);

  // Decompose IEEE-754 double into exact rational
  // x = mantissa * 2^exponent where mantissa is an integer
  const MANTISSA_BITS = 53;
  const abs = Math.abs(x);
  const exp = Math.floor(Math.log2(abs)) - MANTISSA_BITS + 1;
  const mantissa = BigInt(Math.round(abs * 2 ** -exp));
  const sign = x < 0 ? -1n : 1n;

  if (exp >= 0) {
    return exact(sign * mantissa * (2n ** BigInt(exp)), 1n);
  } else {
    return exact(sign * mantissa, 2n ** BigInt(-exp));
  }
}

/** Convert back to a JavaScript number (lossy — for display/comparison only). */
export function toNumber(w: ExactWeight): number {
  return Number(w.num) / Number(w.den);
}

/** Structural equality (exact — the whole point). */
export function exactEquals(a: ExactWeight, b: ExactWeight): boolean {
  return a.num === b.num && a.den === b.den;
}

/** Check if the weight is exactly zero. */
export function isExactZero(w: ExactWeight): boolean {
  return w.num === 0n;
}

// ═══ Ring operations (exact, commutative, associative by construction) ═══════

function addExact(a: ExactWeight, b: ExactWeight): ExactWeight {
  // a.num/a.den + b.num/b.den = (a.num*b.den + b.num*a.den) / (a.den*b.den)
  return exact(a.num * b.den + b.num * a.den, a.den * b.den);
}

function mulExact(a: ExactWeight, b: ExactWeight): ExactWeight {
  return exact(a.num * b.num, a.den * b.den);
}

function negateExact(a: ExactWeight): ExactWeight {
  return { num: -a.num, den: a.den }; // already normalized if a was
}

// ═══ The StarRing<ExactWeight> — plug into WSet ══════════════════════════════

/**
 * ExactProbRing: sum-product domain exact arithmetic.
 *
 * In the probability (sum-product) domain:
 *   add = addition of probabilities (union of mutually exclusive events)
 *   mul = multiplication of probabilities (conjunction of independent events)
 *
 * Both are EXACTLY commutative + associative over Q. No IEEE-754 rounding,
 * no canonical sort needed, order-independent by construction.
 */
export const ExactProbRing: StarRing<ExactWeight> = {
  zero: { num: 0n, den: 1n },
  one: { num: 1n, den: 1n },
  add: addExact,
  mul: mulExact,
  negate: negateExact,
};

// ═══ Fixed-precision variant (sabotage control) ══════════════════════════════

/**
 * A DELIBERATELY broken ring that truncates to fixed precision after each op.
 * Used as the sabotage control: the 100-permutation byte-lock test MUST FAIL
 * with this ring (proving the expansion is load-bearing, not decorative).
 *
 * Truncation: after each add/mul, round to `precision` significant decimal digits.
 * This reintroduces the IEEE-754-style non-associativity the exact ring removes.
 */
export function fixedPrecisionRing(precision: number): StarRing<ExactWeight> {
  function truncate(w: ExactWeight): ExactWeight {
    // Convert to float, round, convert back — deliberately lossy
    const f = toNumber(w);
    const factor = 10 ** precision;
    const rounded = Math.round(f * factor) / factor;
    return fromNumber(rounded);
  }

  return {
    zero: { num: 0n, den: 1n },
    one: { num: 1n, den: 1n },
    add: (a, b) => truncate(addExact(a, b)),
    mul: (a, b) => truncate(mulExact(a, b)),
    negate: negateExact,
  };
}

// ═══ Serialization (for byte-lock comparison) ════════════════════════════════

/** Canonical string representation: "num/den" in lowest terms. Deterministic. */
export function serializeExact(w: ExactWeight): string {
  if (w.den === 1n) return `${w.num}`;
  return `${w.num}/${w.den}`;
}
