/**
 * range-set.ts — TS reference (oracle #1) for **RangeSet**: a sparse integer set in
 * compact range notation (`"1-5,8,10-17"`). The TS oracle authors the shared golden vectors
 * (`golden-vectors.json`); F#/C#/Rust ferry and replay them byte-for-byte: `render(parse(input))`
 * equals the **canonical** form, and `contains` agrees. "The compilers don't lie."
 *
 * Canonical form (the cross-oracle byte-diff contract): ranges **sorted**, **disjoint**, and
 * **non-adjacent** (auto-merged: overlapping AND touching ranges coalesce, `1-3,4-6 → 1-6`),
 * each emitted as `n` when start==end else `start-end`, joined by `,` with no spaces; the empty
 * set renders `""`. Non-negative JS-safe integers only.
 *
 * Result over throw: `parse` returns `Result<RangeSet, RangeSetFeedback>` (the rejection-vector
 * contract — a malformed token declines the SPECIFIC variant, matching across oracles).
 */
const ok = (value) => ({ ok: true, value });
const err = (error) => ({ ok: false, error });
const MAX_SAFE = 9007199254740991; // 2^53 - 1 — the shared safe-int ceiling (matches the other primitives)
/** Parse a non-negative integer token strictly: digits only, within the safe-int range. */
function parseNat(token) {
    if (!/^[0-9]+$/.test(token))
        return null;
    const n = Number(token);
    return Number.isSafeInteger(n) && n <= MAX_SAFE ? n : null;
}
/** Normalize raw ranges into the canonical invariant: sort, then coalesce overlapping/adjacent. */
function normalize(ranges) {
    if (ranges.length === 0)
        return [];
    const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged = [];
    for (const [lo, hi] of sorted) {
        const last = merged[merged.length - 1];
        // coalesce when the next range overlaps OR touches the previous (lo <= last.hi + 1)
        if (last && lo <= last[1] + 1) {
            last[1] = Math.max(last[1], hi);
        }
        else {
            merged.push([lo, hi]);
        }
    }
    return merged;
}
/** Parse compact range notation into a canonical {@link RangeSet}. Empty string → empty set. */
export function parse(s) {
    const trimmed = s.trim();
    if (trimmed === "")
        return ok([]);
    const ranges = [];
    for (const raw of trimmed.split(",")) {
        const token = raw.trim();
        if (token === "")
            return err({ kind: "Malformed", token: raw });
        const parts = token.split("-");
        if (parts.length === 1) {
            const n = parseNat(parts[0]);
            if (n === null)
                return err({ kind: "NotInteger", token });
            ranges.push([n, n]);
        }
        else if (parts.length === 2) {
            // an empty sub-token ("-3", "5-") is structurally missing, not a bad number
            if (parts[0] === "" || parts[1] === "")
                return err({ kind: "Malformed", token });
            const lo = parseNat(parts[0]);
            const hi = parseNat(parts[1]);
            if (lo === null)
                return err({ kind: "NotInteger", token: parts[0] });
            if (hi === null)
                return err({ kind: "NotInteger", token: parts[1] });
            if (lo > hi)
                return err({ kind: "InvertedRange", lo, hi });
            ranges.push([lo, hi]);
        }
        else {
            // more than one dash (e.g. "1-2-3") — structurally malformed
            return err({ kind: "Malformed", token });
        }
    }
    return ok(normalize(ranges));
}
/** Render a {@link RangeSet} to its canonical compact string. */
export function render(rs) {
    return rs.map(([lo, hi]) => (lo === hi ? `${lo}` : `${lo}-${hi}`)).join(",");
}
/** Whether `n` is a member of the set (ranges are sorted, so the scan early-exits). */
export function contains(rs, n) {
    for (const [lo, hi] of rs) {
        if (n < lo)
            return false;
        if (n <= hi)
            return true;
    }
    return false;
}
/** The union of two range sets, re-normalized to canonical form. */
export function union(a, b) {
    return normalize([...a, ...b]);
}
/** Add a single integer to the set (returns a new canonical set). */
export function add(rs, n) {
    return normalize([...rs, [n, n]]);
}
/** The total count of integers covered by the set. */
export function size(rs) {
    let total = 0;
    for (const [lo, hi] of rs)
        total += hi - lo + 1;
    return total;
}
