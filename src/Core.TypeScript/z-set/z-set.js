/**
 * z-set.ts — a Z-set (signed multiset), the TOP rung of the Zeta algebra ladder
 * (**G-Set → Bag → Z-set**) made first-class.
 *
 * A Z-set widens the Bag from ℕ to **ℤ**: every key carries a NONZERO integer
 * `w` (the weight; absent key ⇒ weight 0), positive OR negative, and the only
 * combiner is `union` = per-key **sum**. Two axes of contrast pin it down:
 *
 *   - vs the **Bag** (ℕ / sum, commutative monoid): a Bag drops any key whose
 *     summed count is `<= 0`; a Z-set drops ONLY `== 0` — a negative weight is a
 *     valid stored value (a *retraction in flight*). That single change of the
 *     drop rule (`> 0` → `!= 0`) is the entire ℕ→ℤ widening, and it makes the
 *     monoid an abelian **group**: every Z-set has an inverse, {@link negate}
 *     (flip every sign), with `union(a, negate(a)) == empty`. That inverse is
 *     the law a Bag literally cannot have, and it is why the Z-set — not the
 *     Bag — is the substrate for retraction / undo / DBSP incremental views.
 *   - vs the **G-Set** (idempotent set-union semilattice): like the Bag, the
 *     Z-set's union is NOT idempotent — `union(a, a)` doubles every weight.
 *
 * Per the database-design ADR (2026-05-31): Z-set = ℤ / sum
 * (`docs/DECISIONS/2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md`).
 *
 * This is the same comms/counting substrate as the lower rungs: it matches the
 * existing F# `src/Core/ZSet.fs` engine semantics (an ascending-`(key, weight)`
 * run that consolidates duplicates and drops zero-weighted entries), so the
 * F#/C#/Rust twins join the shared `golden-vectors.json` per the
 * meet-in-the-middle 4-oracle — every impl produces the identical canonical
 * entry array, so the fixture is byte-stable across languages.
 *
 * Canonical representation: an **ascending-key-sorted** `readonly` array of
 * `{ e, w }` entries, every `w != 0`, no key appearing twice. The canonical
 * order makes `equals` a plain element-wise comparison and keeps the
 * cross-language golden vector stable. The required `compare` is a total order
 * on the KEY only (the weight never participates in ordering); it is the TS
 * analog of F#'s `'K : comparison` constraint.
 */
/**
 * Index a run whose bound is guaranteed by the surrounding loop. The cast
 * targets the bare element type parameter `E` — the same assertion-free-at-the-
 * call-site idiom the G-Set / Bag twins use — because `noUncheckedIndexedAccess`
 * would otherwise widen every `arr[i]` to `E | undefined`.
 */
function at(arr, i) {
    return arr[i];
}
/**
 * A weight must be a safe integer — weights are ℤ, so a fraction / NaN /
 * Infinity / unsafe-magnitude value is not an integer weight and cannot be
 * represented by the int64 F#/C#/Rust oracles. Zero IS accepted as input (the
 * constructors drop it — a `0` weight is never stored), and NEGATIVE integers
 * are accepted AND stored (the Bag→Z-set widening), so a canonical Z-set always
 * holds nonzero integer weights. `Number.isSafeInteger` bounds both signs
 * (`|w| <= 2^53 - 1`).
 */
function assertWeight(w) {
    if (!Number.isSafeInteger(w)) {
        throw new RangeError(`Z-set weight must be a safe integer (got ${String(w)})`);
    }
}
/**
 * Add two weights and re-assert the sum is still a safe integer before it is
 * stored. Two valid (safe-integer) weights can sum past `Number.MAX_SAFE_INTEGER`
 * (or below `Number.MIN_SAFE_INTEGER`) — which would silently lose precision
 * where the int64 oracles would not — so every summed weight (the `union` /
 * `ofEntries` merge of a shared key, and the `total` aggregate) is guarded.
 */
function addWeights(a, b) {
    const sum = a + b;
    assertWeight(sum);
    return sum;
}
import { stringCompare as collationStringCompare } from "../collation/collation";
/**
 * Ascending Unicode code-point order.
 */
export const stringCompare = collationStringCompare;
/** The empty Z-set (the `union` identity, and `negate(empty) == empty`). */
export function empty() {
    return [];
}
/** A one-key Z-set at weight `w` (default 1, must be a safe integer); `w == 0` yields the empty Z-set. `w` may be negative. */
export function singleton(x, w = 1) {
    assertWeight(w);
    return w !== 0 ? [{ e: x, w }] : [];
}
/**
 * Canonicalize arbitrary entries: sum weights per key, drop any whose summed
 * weight is `== 0`, and sort ascending by key. This is the constructor that
 * re-establishes the invariant from unordered, possibly-duplicated,
 * possibly-negative input. (Contrast the Bag, which drops `<= 0`; the Z-set
 * keeps negatives.)
 */
export function ofEntries(compare, entries) {
    const sorted = [...entries].sort((a, b) => compare(a.e, b.e));
    const out = [];
    for (const entry of sorted) {
        assertWeight(entry.w);
        const last = out.length - 1;
        if (last >= 0 && compare(at(out, last).e, entry.e) === 0) {
            const prev = at(out, last);
            out[last] = { e: prev.e, w: addWeights(prev.w, entry.w) };
        }
        else {
            out.push({ e: entry.e, w: entry.w });
        }
    }
    return out.filter((entry) => entry.w !== 0);
}
/** Build a Z-set by counting occurrences in a list — each occurrence adds weight 1. */
export function ofArray(compare, xs) {
    return ofEntries(compare, xs.map((x) => ({ e: x, w: 1 })));
}
/** The weight of `x` (0 if absent — including a key that retracted to 0). Binary search on the sorted keys. O(log n). */
export function weight(compare, z, x) {
    let lo = 0;
    let hi = z.length - 1;
    while (lo <= hi) {
        const mid = lo + ((hi - lo) >> 1);
        const e = at(z, mid);
        const c = compare(e.e, x);
        if (c === 0)
            return e.w;
        if (c < 0)
            lo = mid + 1;
        else
            hi = mid - 1;
    }
    return 0;
}
/** Membership: whether `x` has a NONZERO weight (positive or negative). */
export function contains(compare, z, x) {
    return weight(compare, z, x) !== 0;
}
/**
 * The combiner: the per-key SUM of two sorted Z-sets, kept sorted and
 * weight-nonzero (a shared key whose weights cancel to 0 is DROPPED — that drop
 * is retraction). Commutative, associative, with the empty Z-set as identity,
 * and — unlike the Bag — every Z-set has an inverse {@link negate}, so this is
 * an abelian GROUP. It is NOT idempotent: `union(a, a)` doubles every weight.
 */
export function union(compare, a, b) {
    if (a.length === 0)
        return b;
    if (b.length === 0)
        return a;
    const out = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        const ea = at(a, i);
        const eb = at(b, j);
        const c = compare(ea.e, eb.e);
        if (c < 0) {
            out.push(ea);
            i += 1;
        }
        else if (c > 0) {
            out.push(eb);
            j += 1;
        }
        else {
            const sum = addWeights(ea.w, eb.w); // same key → weights add (guarded against overflow)
            if (sum !== 0)
                out.push({ e: ea.e, w: sum }); // == 0 ⇒ retracted, dropped
            i += 1;
            j += 1;
        }
    }
    while (i < a.length) {
        out.push(at(a, i));
        i += 1;
    }
    while (j < b.length) {
        out.push(at(b, j));
        j += 1;
    }
    return out;
}
/**
 * The abelian-group inverse: flip the sign of every weight. `union(a, negate(a))
 * == empty` (the law a Bag cannot satisfy). Preserves the canonical invariant —
 * a nonzero weight negates to a nonzero weight, and key order is unchanged.
 */
export function negate(z) {
    return z.map((entry) => ({ e: entry.e, w: -entry.w }));
}
/** Increment `x`'s weight by 1 (`union` with a singleton). NOT idempotent. */
export function add(compare, x, z) {
    return union(compare, z, [{ e: x, w: 1 }]);
}
/** Add signed weight `w` to `x` (a safe integer, may be negative; `w == 0` is a no-op). A key driven to 0 is retracted. */
export function addW(compare, x, w, z) {
    assertWeight(w);
    return w !== 0 ? union(compare, z, [{ e: x, w }]) : z;
}
/** The entries in canonical (ascending-key) order — a defensive copy. */
export function toEntries(z) {
    return z.map((entry) => ({ e: entry.e, w: entry.w }));
}
/** The number of DISTINCT keys with nonzero weight (the support size). */
export function distinctCount(z) {
    return z.length;
}
/** The sum of all weights (may be negative or zero); throws if the running sum overflows safe-integer range. */
export function total(z) {
    let s = 0;
    for (const entry of z)
        s = addWeights(s, entry.w); // guarded: the running sum stays a safe integer
    return s;
}
/** Whether the Z-set has no keys. */
export function isEmpty(z) {
    return z.length === 0;
}
/** Equality of two canonical Z-sets — element-wise key + weight comparison. */
export function equals(compare, a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i += 1) {
        const ea = at(a, i);
        const eb = at(b, i);
        if (compare(ea.e, eb.e) !== 0 || ea.w !== eb.w)
            return false;
    }
    return true;
}
/**
 * The additive-monoid view of a Z-set under `compare`: `empty` (identity) +
 * `concat` (= {@link union}). The Z-set's full surface is {@link abelianGroup};
 * this matches the G-Set/Bag `monoid` factories so generic monoid code can fold a
 * collection of Z-sets uniformly (see {@link concatAll}).
 */
export function monoid(compare) {
    return {
        empty: empty(),
        concat: (a, b) => union(compare, a, b),
    };
}
/**
 * The abelian-group surface of a Z-set under `compare`: `empty` + `concat`
 * (= {@link union}) + `invert` (= {@link negate}) + `subtract`. The Z-set's
 * distinguishing surface over the Bag (which has no inverse).
 */
export function abelianGroup(compare) {
    return {
        empty: empty(),
        concat: (a, b) => union(compare, a, b),
        invert: (a) => negate(a),
        subtract: (a, b) => union(compare, a, negate(b)),
    };
}
/**
 * Fold a collection of Z-sets through the monoid (identity + `concat`) — the
 * "generic code folds it for free" payoff (the TS analog of Rust's `Sum` /
 * F#'s `Seq.sum`). Retraction-to-0 keys drop as the fold proceeds.
 */
export function concatAll(compare, zs) {
    const m = monoid(compare);
    return zs.reduce(m.concat, m.empty);
}
