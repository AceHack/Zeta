/**
 * wset.ts — Ring-Generic Weighted Set (TypeScript Port of WSet.fs).
 *
 * The Generalized Distributive Law (Aji–McEliece 2000):
 *   sum-product (Bayesian probability), max-product (Viterbi/Tropical planning),
 *   and DBSP counting are ONE algorithm over different commutative semirings (*-rings).
 *
 *   WSet<K, W> = Array<{ key: K, weight: W }>
 *
 * Rings:
 *   - LogProbRing: Bayesian Probability Factor Graph (logsumexp, +)
 *   - TropicalRing: Least-Action Path Planning (min, +)
 *   - IntegerRing: DBSP Signed Counting (+, *)
 */

export interface StarRing<W> {
  readonly zero: W;
  readonly one: W;
  readonly add: (a: W, b: W) => W;
  readonly mul: (a: W, b: W) => W;
  readonly negate?: (a: W) => W;
}

export interface WElement<K, W> {
  readonly key: K;
  readonly weight: W;
}

export type WSet<K, W> = readonly WElement<K, W>[];

/**
 * Log-Space Bayesian Probability Ring:
 *   zero = -Infinity, one = 0.0
 *   add(a, b) = logsumexp(a, b)
 *   mul(a, b) = a + b
 */
export const LogProbRing: StarRing<number> = {
  zero: -Infinity,
  one: 0.0,
  add: (a: number, b: number) => {
    if (a === -Infinity) return b;
    if (b === -Infinity) return a;
    const maxVal = Math.max(a, b);
    return maxVal + Math.log(Math.exp(a - maxVal) + Math.exp(b - maxVal));
  },
  mul: (a: number, b: number) => a + b,
  negate: (a: number) => -a,
};

/**
 * Tropical Least-Action Planning Semiring:
 *   zero = +Infinity, one = 0.0
 *   add(a, b) = min(a, b)
 *   mul(a, b) = a + b
 */
export const TropicalRing: StarRing<number> = {
  zero: Infinity,
  one: 0.0,
  add: (a: number, b: number) => Math.min(a, b),
  mul: (a: number, b: number) => a + b,
};

/**
 * Classical DBSP Integer Ring:
 *   zero = 0, one = 1
 *   add(a, b) = a + b
 *   mul(a, b) = a * b
 *   negate(a) = -a
 */
export const IntegerRing: StarRing<number> = {
  zero: 0,
  one: 1,
  add: (a: number, b: number) => a + b,
  mul: (a: number, b: number) => a * b,
  negate: (a: number) => -a,
};

/**
 * Consolidate: sums weights per key under ring.add; drops keys where isZero(weight).
 */
export function consolidateWSet<K, W>(
  ring: StarRing<W>,
  isZero: (w: W) => boolean,
  keyToString: (k: K) => string,
  set: WSet<K, W>,
): WSet<K, W> {
  const grouped = new Map<string, { key: K; weight: W }>();

  for (const elem of set) {
    const kStr = keyToString(elem.key);
    const existing = grouped.get(kStr);
    if (existing) {
      grouped.set(kStr, {
        key: elem.key,
        weight: ring.add(existing.weight, elem.weight),
      });
    } else {
      grouped.set(kStr, { key: elem.key, weight: elem.weight });
    }
  }

  const result: WElement<K, W>[] = [];
  for (const elem of grouped.values()) {
    if (!isZero(elem.weight)) {
      result.push(elem);
    }
  }

  return result;
}

/**
 * Apply: WSet matrix multiplication / linear operator application.
 * Each key maps to a successor WSet; incoming weight multiplies through (ring.mul).
 */
export function applyWSet<K1, K2, W>(
  ring: StarRing<W>,
  op: (k: K1) => WSet<K2, W>,
  set: WSet<K1, W>,
): WSet<K2, W> {
  const result: WElement<K2, W>[] = [];
  for (const elem of set) {
    const successors = op(elem.key);
    for (const succ of successors) {
      result.push({
        key: succ.key,
        weight: ring.mul(elem.weight, succ.weight),
      });
    }
  }
  return result;
}

/**
 * Pointwise sum (union) of two WSets.
 */
export function plusWSet<K, W>(a: WSet<K, W>, b: WSet<K, W>): WSet<K, W> {
  return [...a, ...b];
}

/**
 * Kronecker Tensor product: (a (x) b)[(ka, kb)] = wa * wb.
 */
export function tensorWSet<A, B, W>(
  ring: StarRing<W>,
  setA: WSet<A, W>,
  setB: WSet<B, W>,
): WSet<[A, B], W> {
  const result: WElement<[A, B], W>[] = [];
  for (const a of setA) {
    for (const b of setB) {
      result.push({
        key: [a.key, b.key],
        weight: ring.mul(a.weight, b.weight),
      });
    }
  }
  return result;
}
