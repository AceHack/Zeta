/**
 * indexed-z-set.ts — TS reference (oracle #1) for `IndexedZSet<K,V>`, the next
 * rung above the Z-set on the algebra ladder (G-Set ⊂ Bag ⊂ Z-set ⊂ IndexedZSet).
 *
 * An `IndexedZSet<K,V>` is conceptually `Z[K × V]` — a Z-set over (key, value)
 * pairs — but stored GROUPED BY KEY: an ascending-by-key run of `KeyGroup`s,
 * each holding the per-key `ZSet<V>`. That layout is what makes the bilinear
 * **join** (and key-wise aggregation) a linear merge over two sorted runs, which
 * is why it is the substrate DBSP incremental views are built on. It mirrors the
 * F# engine `src/Core/IndexedZSet.fs` (the originating oracle).
 *
 * Canonical form (the equality contract, so cross-oracle byte-diff works):
 *   - groups sorted ASCENDING by key under `compareK`, no key twice;
 *   - each group's `values` is a canonical `ZSet<V>` (sorted, weight != 0);
 *   - a group whose `values` becomes empty is DROPPED (so an all-cancelling key
 *     leaves no trace — the abelian-group inverse lifts to the indexed level).
 *
 * Everything here is a thin lift over the Z-set primitive: per-key merges are
 * `ZSet.union`, `neg` is per-group `ZSet.negate`, and `join` cross-products the
 * matching keys' value-Z-sets with weight-multiply + consolidate.
 */
import { empty as zEmpty, isEmpty as zIsEmpty, negate as zNegate, ofEntries as zOfEntries, toEntries as zToEntries, union as zUnion, } from "../z-set/z-set";
/** The empty indexed Z-set. */
export function empty() {
    return [];
}
export function isEmpty(i) {
    return i.length === 0;
}
/** Number of distinct keys (groups). */
export function keyCount(i) {
    return i.length;
}
/** Total number of (key, value) tuples = sum of per-group distinct values. */
export function tupleCount(i) {
    let n = 0;
    for (const g of i)
        n += g.values.length;
    return n;
}
/**
 * Build the canonical form from arbitrary groups: merge any duplicate keys
 * (via `ZSet.union`), drop keys whose merged values are empty, sort ascending
 * by key. The general-purpose constructor the fixture loader + `add` rely on.
 */
export function ofGroups(compareK, compareV, groups) {
    // Merge duplicate keys, then canonicalize.
    const merged = new Map();
    const order = [];
    for (const g of groups) {
        const prior = merged.get(g.key);
        if (prior === undefined) {
            order.push(g.key);
            merged.set(g.key, g.values);
        }
        else {
            merged.set(g.key, zUnion(compareV, prior, g.values));
        }
    }
    const out = [];
    for (const key of order) {
        const values = merged.get(key);
        if (!zIsEmpty(values))
            out.push({ key, values });
    }
    out.sort((a, b) => compareK(a.key, b.key));
    return out;
}
/**
 * Index a flat `ZSet<A>` by extracting a key and a value from each entry —
 * carrying that entry's weight onto the (key, value) tuple. The weight on a
 * tuple is the SUM over all source entries that map to it.
 */
export function indexWith(compareK, compareV, keyOf, valOf, z) {
    // Bucket each source entry under its key as a (value, weight) pair, then
    // canonicalize each bucket through the Z-set constructor (sum + drop-zero).
    const buckets = new Map();
    const order = [];
    for (const { e, w } of zToEntries(z)) {
        const k = keyOf(e);
        const v = valOf(e);
        let bucket = buckets.get(k);
        if (bucket === undefined) {
            bucket = [];
            buckets.set(k, bucket);
            order.push(k);
        }
        bucket.push({ e: v, w });
    }
    const out = [];
    for (const key of order) {
        const values = zOfEntries(compareV, buckets.get(key));
        if (!zIsEmpty(values))
            out.push({ key, values });
    }
    out.sort((a, b) => compareK(a.key, b.key));
    return out;
}
/** Look up a single key's `ZSet<V>` (empty if the key is absent). */
export function get(compareK, i, key) {
    let lo = 0;
    let hi = i.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const c = compareK(i[mid].key, key);
        if (c < 0)
            lo = mid + 1;
        else if (c > 0)
            hi = mid - 1;
        else
            return i[mid].values;
    }
    return zEmpty();
}
/**
 * Flatten to a `ZSet<C>` of mapped tuples — `combine(key, value)` names the
 * codomain element (e.g. `` (k, v) => `${k}|${v}` ``). The flat Z-set's
 * canonicalization (sum + drop-zero) applies, in case two (k,v) tuples map to
 * the same `C`.
 */
export function toZSet(compareC, combine, i) {
    const entries = [];
    for (const g of i) {
        for (const { e, w } of zToEntries(g.values)) {
            entries.push({ e: combine(g.key, e), w });
        }
    }
    return zOfEntries(compareC, entries);
}
/**
 * Group-wise addition: merge two sorted runs; on a shared key, `ZSet.union` the
 * per-key value-Z-sets (dropping the group if it cancels to empty). Linear in
 * the number of groups; the indexed analogue of `ZSet.union`.
 */
export function add(compareK, compareV, a, b) {
    if (isEmpty(a))
        return b;
    if (isEmpty(b))
        return a;
    const out = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        const c = compareK(a[i].key, b[j].key);
        if (c < 0) {
            out.push(a[i]);
            i++;
        }
        else if (c > 0) {
            out.push(b[j]);
            j++;
        }
        else {
            const merged = zUnion(compareV, a[i].values, b[j].values);
            if (!zIsEmpty(merged))
                out.push({ key: a[i].key, values: merged });
            i++;
            j++;
        }
    }
    while (i < a.length)
        out.push(a[i++]);
    while (j < b.length)
        out.push(b[j++]);
    return out;
}
/** Negate every weight (the abelian-group inverse, lifted per group). */
export function neg(a) {
    return a.map((g) => ({ key: g.key, values: zNegate(g.values) }));
}
/** `a − b` = `add(a, neg(b))`. */
export function sub(compareK, compareV, a, b) {
    return add(compareK, compareV, a, neg(b));
}
/**
 * Bilinear **join** on the shared key: merge-join the two sorted runs, and for
 * each matching key cross-product the value-Z-sets — the output weight is the
 * PRODUCT of the two value weights (`combine(key, va, vb)` names the codomain
 * element). The flat `ZSet<C>` result is consolidated (sum + drop-zero), so a
 * cancellation across the cross-product disappears. This is the operator the
 * whole DBSP incremental-view story rests on.
 */
export function join(compareK, compareC, combine, a, b) {
    const out = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        const c = compareK(a[i].key, b[j].key);
        if (c < 0) {
            i++;
        }
        else if (c > 0) {
            j++;
        }
        else {
            const key = a[i].key;
            for (const va of zToEntries(a[i].values)) {
                for (const vb of zToEntries(b[j].values)) {
                    const w = va.w * vb.w;
                    if (w !== 0)
                        out.push({ e: combine(key, va.e, vb.e), w });
                }
            }
            i++;
            j++;
        }
    }
    return zOfEntries(compareC, out);
}
/** Structural equality (relies on the canonical form). */
export function equals(compareK, compareV, a, b) {
    if (a.length !== b.length)
        return false;
    for (let n = 0; n < a.length; n++) {
        if (compareK(a[n].key, b[n].key) !== 0)
            return false;
        const av = a[n].values;
        const bv = b[n].values;
        if (av.length !== bv.length)
            return false;
        for (let m = 0; m < av.length; m++) {
            if (compareV(av[m].e, bv[m].e) !== 0 || av[m].w !== bv[m].w) {
                return false;
            }
        }
    }
    return true;
}
// ── generic-math abelian-group surface (record idiom — TS has no operators) ──
// "numerics like dotnet as our interface, push to other langs if they don't
// have" (Aaron 2026-06-01). The last ladder rung. IndexedZSet (Z[K×V]) is an
// abelian GROUP — same surface as the Z-set rung (#6483): reuse the shared
// `Monoid` (g-set) + `AbelianGroup` (z-set) interfaces. NOT INumber — the ring
// product is the bilinear `join`, surfaced separately, not a numeric multiply.
// Factories are comparator-specific in BOTH key and value comparers (the per-key
// value-Z-set merge needs the value comparer), like the Z-set/Bag twins.
/**
 * The additive-monoid view of an IndexedZSet under `compareK` / `compareV`:
 * `empty` (identity) + `concat` (= group-wise {@link add}; the per-key value-Z-set
 * merge needs the value comparer). Matches the G-Set/Bag/Z-set `monoid` factories
 * so generic monoid code can fold a collection (see {@link concatAll}).
 */
export function monoid(compareK, compareV) {
    return {
        empty: empty(),
        concat: (a, b) => add(compareK, compareV, a, b),
    };
}
/**
 * The abelian-group surface of an IndexedZSet under `compareK` / `compareV`:
 * `empty` + `concat` (= {@link add}) + `invert` (= {@link neg}) + `subtract`
 * (= {@link sub}). The distinguishing surface over the Bag (no inverse);
 * `concat(a, invert(a))` is empty.
 */
export function abelianGroup(compareK, compareV) {
    return {
        empty: empty(),
        concat: (a, b) => add(compareK, compareV, a, b),
        invert: (a) => neg(a),
        subtract: (a, b) => sub(compareK, compareV, a, b),
    };
}
/**
 * Fold a collection of IndexedZSets through the monoid (identity + `concat`) — the
 * "generic code folds it for free" payoff (the TS analog of Rust's `Sum` / F#'s
 * `Seq.sum`). Keys whose value-Z-sets empty out (retraction-to-0) drop as it folds.
 */
export function concatAll(compareK, compareV, is) {
    const m = monoid(compareK, compareV);
    return is.reduce(m.concat, m.empty);
}
