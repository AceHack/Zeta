/**
 * g-set.ts — a grow-only set (G-Set CRDT), the bottom rung of the Zeta algebra
 * ladder (**G-Set → Bag → Z-set**) made first-class instead of implicit.
 *
 * A G-Set is the Z-set restricted to non-negative multiplicity with no
 * retractions: every element is present exactly once, `union` is the only
 * combiner, and `union` is **idempotent, commutative, and associative** — the
 * three CRDT convergence laws (any two replicas that have seen the same
 * elements, in any order, converge to the same set with no coordination).
 *
 * This is the comms substrate of the git-native agent-bus (081KSXN940008QG0R00171YAZW): an
 * append-only `docs/agent-bus/` folder of ZetaId-keyed messages IS a G-Set —
 * re-observing the same message id is `union` and a no-op (the same reason the
 * observe-loop's `folderSink` treats an EEXIST write as success). The F# twin
 * lives in `src/Core/GSet.fs`; both produce the identical canonical array, so
 * the shared `golden-vectors.json` is byte-stable across languages.
 *
 * Canonical representation: an **ascending-sorted, duplicate-free** `readonly`
 * array under the provided `compare`. The canonical order makes `equals` a
 * plain array comparison and keeps cross-language golden-vectors stable. The
 * required `compare` is the TS analog of F#'s `'T : comparison` constraint.
 */

/** A total order on `T` (`< 0`, `0`, `> 0`), e.g. {@link stringCompare}. */
export type Compare<T> = (a: T, b: T) => number;

/**
 * A grow-only set: an ascending-sorted, duplicate-free run under some
 * `compare`. The invariant is held by every constructor here — never build one
 * by hand from an unsorted array; use {@link ofArray}.
 */
export type GSet<T> = readonly T[];

import { stringCompare as collationStringCompare } from "../collation/collation";

/** Ascending Unicode code-point order — the canonical comparator for the bus. */
export const stringCompare: Compare<string> = collationStringCompare;

/** The empty G-Set (the `union` identity). */
export function empty<T>(): GSet<T> {
  return [];
}

/** A one-element G-Set. */
export function singleton<T>(x: T): GSet<T> {
  return [x];
}

/** Canonicalize arbitrary input: sort ascending + drop duplicates. */
export function ofArray<T>(compare: Compare<T>, xs: readonly T[]): GSet<T> {
  const sorted = [...xs].sort(compare);
  const out: T[] = [];
  for (const x of sorted) {
    const last = out.length - 1;
    if (last < 0 || compare(out[last] as T, x) !== 0) out.push(x);
  }
  return out;
}

/** Membership via binary search on the sorted run. O(log n). */
export function contains<T>(compare: Compare<T>, g: GSet<T>, x: T): boolean {
  let lo = 0;
  let hi = g.length - 1;
  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1);
    const c = compare(g[mid] as T, x);
    if (c === 0) return true;
    if (c < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/**
 * The CRDT merge: the union of two sorted-unique runs, kept sorted-unique.
 * Idempotent, commutative, associative (verified by the law tests + the
 * cross-language golden vector).
 */
export function union<T>(compare: Compare<T>, a: GSet<T>, b: GSet<T>): GSet<T> {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const c = compare(a[i] as T, b[j] as T);
    if (c < 0) {
      out.push(a[i] as T);
      i += 1;
    } else if (c > 0) {
      out.push(b[j] as T);
      j += 1;
    } else {
      out.push(a[i] as T); // duplicate → keep one
      i += 1;
      j += 1;
    }
  }
  while (i < a.length) {
    out.push(a[i] as T);
    i += 1;
  }
  while (j < b.length) {
    out.push(b[j] as T);
    j += 1;
  }
  return out;
}

/** Add one element (`union` with a singleton); idempotent if already present. */
export function add<T>(compare: Compare<T>, x: T, g: GSet<T>): GSet<T> {
  return contains(compare, g, x) ? g : union(compare, g, [x]);
}

/** The elements in canonical (ascending) order — a defensive copy. */
export function toArray<T>(g: GSet<T>): T[] {
  return [...g];
}

export function count<T>(g: GSet<T>): number {
  return g.length;
}

export function isEmpty<T>(g: GSet<T>): boolean {
  return g.length === 0;
}

/** Equality of two canonical runs — plain element-wise comparison. */
export function equals<T>(compare: Compare<T>, a: GSet<T>, b: GSet<T>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (compare(a[i] as T, b[i] as T) !== 0) return false;
  }
  return true;
}

// ── generic-math additive-monoid surface (TS idiom: a Monoid record) ────────
// G-Set is an additive, commutative + idempotent monoid (identity + associative
// union, NO inverse). TS has no operator overloading or generic-math interfaces, so
// the additive-monoid surface is a small `{ empty, concat }` record — the TS analog
// of F#'s `Zero`+`(+)` / C#'s `IAdditiveIdentity`+`IAdditionOperators`. Exposes only
// empty+concat, never subtraction/negation/product.

/**
 * A monoid: an identity element (`empty`) + an associative binary combiner (`concat`).
 * The identity law holds by VALUE/semantic equality (not reference `===`): combining with
 * `empty` yields a value equal to the other operand — `concat(empty, x)` equals `x` equals
 * `concat(x, empty)`. (For {@link GSet}, `concat` = `union` returns a fresh array except for
 * the empty short-circuit, so compare with {@link equals}, never `===`.)
 */
export interface Monoid<T> {
  /** The identity element. */
  readonly empty: T;
  /** The associative combiner. */
  readonly concat: (a: T, b: T) => T;
}

/**
 * The additive-monoid surface of a G-Set under `compare`: `empty` (identity) + `concat`
 * (= {@link union}). Lets generic monoid code fold a collection of G-Sets — see
 * {@link concatAll}. G-Set's monoid is comparator-specific, so this is a factory over
 * `compare` (the F#/C#/Rust twins bake the comparer into the type / use a default).
 */
export function monoid<T>(compare: Compare<T>): Monoid<GSet<T>> {
  return {
    empty: empty<T>(),
    concat: (a, b) => union(compare, a, b),
  };
}

/**
 * Fold a collection of G-Sets through the monoid (identity + `concat`) — the
 * "generic code folds it for free" payoff (the TS analog of Rust's `Sum`).
 */
export function concatAll<T>(compare: Compare<T>, gs: readonly GSet<T>[]): GSet<T> {
  const m = monoid(compare);
  return gs.reduce(m.concat, m.empty);
}
