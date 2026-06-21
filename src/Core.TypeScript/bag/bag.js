/**
 * bag.ts — a Bag (multiset), the MIDDLE rung of the Zeta algebra ladder
 * (**G-Set → Bag → Z-set**) made first-class instead of implicit.
 *
 * A Bag is the Z-set restricted to NON-NEGATIVE multiplicity: every key carries
 * a count `n >= 1` (absent key ⇒ multiplicity 0), and the only combiner is
 * `union` = per-key **sum**. That is the precise contrast with the G-Set, whose
 * `union` is set-union and therefore idempotent: a Bag's `union` is a
 * commutative **monoid** — commutative, associative, with the empty bag as
 * identity — but it is **NOT** a semilattice, because `union(a, a)` DOUBLES
 * every count. That non-idempotence is exactly what makes the Bag the counting
 * structure (DORA / metrics / the LGTM "M") and the step toward the Z-set's
 * signed ℤ weights + retraction. Per the database-design ADR (2026-05-31):
 * Bag = ℕ / sum
 * (`docs/DECISIONS/2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md`).
 *
 * Like the G-Set, this is comms/counting substrate for the git-native stack:
 * the Z-set (signed) is one widening up; the G-Set (idempotent set) is one
 * narrowing down. The F#/C#/Rust twins join the shared `golden-vectors.json`
 * per the meet-in-the-middle 4-oracle; all impls produce the identical
 * canonical entry array, so the fixture is byte-stable across languages.
 *
 * Canonical representation: an **ascending-key-sorted** `readonly` array of
 * `{ e, n }` entries, every `n >= 1`, no key appearing twice. The canonical
 * order makes `equals` a plain element-wise comparison and keeps the
 * cross-language golden vector stable. The required `compare` is a total order
 * on the KEY only (the count never participates in ordering); it is the TS
 * analog of F#'s `'T : comparison` constraint.
 */
/**
 * Index a run whose bound is guaranteed by the surrounding loop. The cast
 * targets the bare element type parameter `E` — the same assertion-free-at-the-
 * call-site idiom the G-Set twin uses (`a[i] as T`) — because
 * `noUncheckedIndexedAccess` would otherwise widen every `arr[i]` to
 * `E | undefined` and force a non-null assertion at each access.
 */
function at(arr, i) {
    return arr[i];
}
/**
 * A multiplicity must be a safe integer — counts are ℕ, so a fraction / NaN /
 * Infinity / unsafe-magnitude value is not a natural count and cannot be
 * represented by the integer F#/C#/Rust oracles (it would also make `total` /
 * `multiplicity` stop being counts). Zero and negative integers ARE accepted as
 * input (the constructors drop them — a count `<= 0` is never stored), but a
 * non-integer is rejected at admission so a canonical bag always holds integer
 * counts `>= 1`.
 */
function assertCount(n) {
    if (!Number.isSafeInteger(n)) {
        throw new RangeError(`Bag multiplicity must be a safe integer (got ${String(n)})`);
    }
}
/**
 * Add two counts and re-assert the sum is still a safe integer before it is
 * stored. Two valid (safe-integer) counts can sum past `Number.MAX_SAFE_INTEGER`
 * — e.g. `MAX_SAFE_INTEGER + 2` rounds in JS — which would silently lose
 * precision where the int64 F#/C#/Rust oracles would not, so every summed count
 * (the `union` / `ofEntries` merge of a shared key, and the `total` aggregate)
 * is guarded.
 */
function addCounts(a, b) {
    const sum = a + b;
    assertCount(sum);
    return sum;
}
import { stringCompare as collationStringCompare } from "../collation/collation";
/**
 * Ascending Unicode code-point order.
 */
export const stringCompare = collationStringCompare;
/** The empty Bag (the `union` identity). */
export function empty() {
    return [];
}
/** A one-key Bag at count `n` (default 1, must be a safe integer); `n <= 0` yields the empty Bag. */
export function singleton(x, n = 1) {
    assertCount(n);
    return n > 0 ? [{ e: x, n }] : [];
}
/**
 * Canonicalize arbitrary entries: sum counts per key, drop any whose summed
 * count is `<= 0`, and sort ascending by key. This is the constructor that
 * re-establishes the invariant from unordered, possibly-duplicated input.
 */
export function ofEntries(compare, entries) {
    const sorted = [...entries].sort((a, b) => compare(a.e, b.e));
    const out = [];
    for (const entry of sorted) {
        assertCount(entry.n);
        const last = out.length - 1;
        if (last >= 0 && compare(at(out, last).e, entry.e) === 0) {
            const prev = at(out, last);
            out[last] = { e: prev.e, n: addCounts(prev.n, entry.n) };
        }
        else {
            out.push({ e: entry.e, n: entry.n });
        }
    }
    return out.filter((entry) => entry.n > 0);
}
/** Build a Bag by counting occurrences in a list — each occurrence adds 1. */
export function ofArray(compare, xs) {
    return ofEntries(compare, xs.map((x) => ({ e: x, n: 1 })));
}
/** The multiplicity of `x` (0 if absent). Binary search on the sorted keys. O(log n). */
export function multiplicity(compare, g, x) {
    let lo = 0;
    let hi = g.length - 1;
    while (lo <= hi) {
        const mid = lo + ((hi - lo) >> 1);
        const e = at(g, mid);
        const c = compare(e.e, x);
        if (c === 0)
            return e.n;
        if (c < 0)
            lo = mid + 1;
        else
            hi = mid - 1;
    }
    return 0;
}
/** Membership: whether `x` has a positive multiplicity. */
export function contains(compare, g, x) {
    return multiplicity(compare, g, x) > 0;
}
/**
 * The combiner: the per-key SUM of two sorted bags, kept sorted and
 * count-positive. Commutative, associative, and the empty bag is the identity —
 * but NOT idempotent: `union(a, a)` doubles every count. This commutative
 * monoid is the step the Z-set completes into an abelian group (signed ℤ
 * weights, where retraction is the inverse).
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
            out.push({ e: ea.e, n: addCounts(ea.n, eb.n) }); // same key → counts add (guarded against overflow)
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
/** Increment `x`'s count by 1 (`union` with a singleton). NOT idempotent. */
export function add(compare, x, g) {
    return union(compare, g, [{ e: x, n: 1 }]);
}
/** Increment `x`'s count by `n` (a safe integer; `n <= 0` is a no-op — the Bag is grow-only over ℕ). */
export function addN(compare, x, n, g) {
    assertCount(n);
    return n > 0 ? union(compare, g, [{ e: x, n }]) : g;
}
/** The entries in canonical (ascending-key) order — a defensive copy. */
export function toEntries(g) {
    return g.map((entry) => ({ e: entry.e, n: entry.n }));
}
/** The number of DISTINCT keys (the support size). */
export function distinctCount(g) {
    return g.length;
}
/** The sum of all multiplicities (the total count across keys); throws if the sum overflows safe-integer range. */
export function total(g) {
    let s = 0;
    for (const entry of g)
        s = addCounts(s, entry.n); // guarded: the running sum stays a safe integer
    return s;
}
/** Whether the Bag has no keys. */
export function isEmpty(g) {
    return g.length === 0;
}
/** Equality of two canonical bags — element-wise key + count comparison. */
export function equals(compare, a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i += 1) {
        const ea = at(a, i);
        const eb = at(b, i);
        if (compare(ea.e, eb.e) !== 0 || ea.n !== eb.n)
            return false;
    }
    return true;
}
// ── generic-math additive-monoid surface (TS idiom: a Monoid record) ────────
// Bag is an additive, commutative monoid (identity + associative per-key-sum union, NO
// inverse) — but, unlike a G-Set, NOT idempotent (concat(a, a) doubles every count). The
// TS additive-monoid surface is a `{ empty, concat }` record (the analog of F# Zero+(+) /
// C# IAdditiveIdentity+operator+ / Rust Add+Default). Exposes empty+concat only — never
// subtraction/negation (the abelian-group step is the Z-set, where retraction is the inverse).
/**
 * The additive-monoid surface of a Bag under `compare`: `empty` (identity) + `concat`
 * (= {@link union}, the per-key sum). Lets generic monoid code fold a collection of Bags —
 * see {@link concatAll}. Bag's monoid is comparator-specific, so this is a factory over
 * `compare`. Identity holds by VALUE equality (compare with {@link equals}, not `===`).
 */
export function monoid(compare) {
    return {
        empty: empty(),
        concat: (a, b) => union(compare, a, b),
    };
}
/**
 * Fold a collection of Bags through the monoid (identity + `concat`, the per-key sum) — the
 * "generic code folds it for free" payoff (the TS analog of Rust's `Sum`).
 */
export function concatAll(compare, bs) {
    const m = monoid(compare);
    return bs.reduce(m.concat, m.empty);
}
