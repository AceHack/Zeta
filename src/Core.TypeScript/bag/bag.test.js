/**
 * bag.test.ts — TS reference (oracle #1) for the Bag (multiset) — the middle
 * rung of the algebra ladder (G-Set ⊂ Bag ⊂ Z-set).
 *
 * Three duties:
 *   1. The commutative-monoid laws hold (commutative, associative, identity) —
 *      AND, crucially, union is NOT idempotent: union(a, a) doubles counts.
 *      That non-idempotence is the precise distinction from the G-Set (whose
 *      union is set-union) and the reason the Bag counts.
 *   2. Construction canonicalizes (sum per key, drop count <= 0, sort).
 *   3. The shared golden vector replays to the expected states — the
 *      cross-language parity lock the F#/C#/Rust twins also cast.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { add, addN, concatAll, contains, distinctCount, empty, equals, monoid, multiplicity, ofArray, ofEntries, singleton, stringCompare, toEntries, total, union, } from "./bag";
const cmp = stringCompare;
const entry = (e, n) => ({ e, n });
const bag = (...es) => ofEntries(cmp, es);
describe("Bag — canonicalization", () => {
    it("ofArray counts occurrences, sorts ascending", () => {
        expect(toEntries(ofArray(cmp, ["c", "a", "b", "a", "c", "c"]))).toEqual([
            entry("a", 2),
            entry("b", 1),
            entry("c", 3),
        ]);
    });
    it("ofEntries sums per-key counts and drops counts <= 0", () => {
        expect(toEntries(bag(entry("a", 1), entry("a", 2), entry("b", 0), entry("c", -1)))).toEqual([entry("a", 3)]);
    });
    it("empty is empty; singleton has one key; singleton(_, 0) is empty", () => {
        expect(toEntries(empty())).toEqual([]);
        expect(toEntries(singleton("x", 4))).toEqual([entry("x", 4)]);
        expect(toEntries(singleton("x", 0))).toEqual([]);
    });
    it("multiplicity / contains agree (binary search)", () => {
        const b = bag(entry("a", 2), entry("c", 5), entry("e", 1));
        expect(multiplicity(cmp, b, "c")).toBe(5);
        expect(multiplicity(cmp, b, "d")).toBe(0);
        expect(contains(cmp, b, "a")).toBe(true);
        expect(contains(cmp, b, "z")).toBe(false);
    });
    it("distinctCount counts keys; total sums multiplicities", () => {
        const b = bag(entry("a", 2), entry("b", 3));
        expect(distinctCount(b)).toBe(2);
        expect(total(b)).toBe(5);
    });
    it("rejects non-integer / non-finite multiplicities (counts are ℕ; integer F#/C#/Rust parity)", () => {
        expect(() => singleton("x", 0.5)).toThrow(RangeError);
        expect(() => addN(cmp, "x", 1.5, empty())).toThrow(RangeError);
        expect(() => ofEntries(cmp, [entry("x", Number.NaN)])).toThrow(RangeError);
        expect(() => ofEntries(cmp, [entry("x", Number.POSITIVE_INFINITY)])).toThrow(RangeError);
        // safe integers (including 0, handled by the drop/no-op logic) are admitted
        expect(toEntries(singleton("x", 0))).toEqual([]);
        expect(equals(cmp, addN(cmp, "z", 0, bag(entry("a", 1))), bag(entry("a", 1)))).toBe(true);
    });
    it("guards SUMMED counts against safe-integer overflow (union + ofEntries dedup)", () => {
        const big = singleton("x", Number.MAX_SAFE_INTEGER);
        // union summing a shared key past MAX_SAFE_INTEGER would silently lose precision in JS
        expect(() => union(cmp, big, singleton("x", 2))).toThrow(RangeError);
        // same path while canonicalizing duplicate entries
        expect(() => ofEntries(cmp, [entry("x", Number.MAX_SAFE_INTEGER), entry("x", 2)])).toThrow(RangeError);
        // a sum that stays safe is fine
        expect(toEntries(union(cmp, singleton("x", 2), singleton("x", 3)))).toEqual([entry("x", 5)]);
    });
    it("total throws if the aggregate sum overflows safe-integer range", () => {
        const b = bag(entry("a", Number.MAX_SAFE_INTEGER), entry("b", 1));
        expect(() => total(b)).toThrow(RangeError);
        expect(total(bag(entry("a", 2), entry("b", 3)))).toBe(5); // safe total is fine
    });
});
describe("Bag — commutative-monoid laws (and NON-idempotence)", () => {
    // Named off the `union(compare, a, b)` parameter names so the commutativity
    // test (`union(bagA, bagB)` vs `union(bagB, bagA)`) isn't misread as a
    // swapped-argument bug by static analysis — the swap IS the property.
    const bagA = bag(entry("a", 1), entry("b", 2));
    const bagB = bag(entry("b", 1), entry("c", 3));
    const bagC = bag(entry("c", 1), entry("d", 4));
    it("commutative: union(a, b) == union(b, a)", () => {
        expect(equals(cmp, union(cmp, bagA, bagB), union(cmp, bagB, bagA))).toBe(true);
    });
    it("associative: union(union(a, b), c) == union(a, union(b, c))", () => {
        const left = union(cmp, union(cmp, bagA, bagB), bagC);
        const right = union(cmp, bagA, union(cmp, bagB, bagC));
        expect(equals(cmp, left, right)).toBe(true);
    });
    it("identity: union(a, empty) == a and union(empty, a) == a", () => {
        expect(equals(cmp, union(cmp, bagA, empty()), bagA)).toBe(true);
        expect(equals(cmp, union(cmp, empty(), bagA), bagA)).toBe(true);
    });
    it("NOT idempotent: union(a, a) doubles every count (the Bag/G-Set distinction)", () => {
        const doubled = union(cmp, bagA, bagA);
        expect(toEntries(doubled)).toEqual([entry("a", 2), entry("b", 4)]);
        expect(equals(cmp, doubled, bagA)).toBe(false);
    });
    it("union sums overlapping keys, carries disjoint keys through", () => {
        expect(toEntries(union(cmp, bagA, bagB))).toEqual([entry("a", 1), entry("b", 3), entry("c", 3)]);
    });
    it("add increments by 1 (not idempotent); addN increments by n; addN(_, <=0) is a no-op", () => {
        expect(toEntries(add(cmp, "a", bagA))).toEqual([entry("a", 2), entry("b", 2)]);
        expect(toEntries(addN(cmp, "z", 3, bagA))).toEqual([entry("a", 1), entry("b", 2), entry("z", 3)]);
        expect(equals(cmp, addN(cmp, "z", 0, bagA), bagA)).toBe(true);
    });
});
describe("Bag — additive-monoid surface (empty + concat)", () => {
    const m = monoid(cmp);
    const a = bag(entry("a", 1), entry("b", 2));
    const b = bag(entry("b", 1), entry("c", 3));
    const c = bag(entry("c", 5));
    it("concat is the explicit per-key sum (not just delegation)", () => {
        expect(toEntries(m.concat(a, b))).toEqual([entry("a", 1), entry("b", 3), entry("c", 3)]);
    });
    it("empty is the identity: concat(empty, a) == a and concat(a, empty) == a", () => {
        expect(toEntries(m.empty)).toEqual([]);
        expect(equals(cmp, m.concat(m.empty, a), a)).toBe(true);
        expect(equals(cmp, m.concat(a, m.empty), a)).toBe(true);
    });
    it("monoid laws: commutative + associative but NOT idempotent (the Bag distinction)", () => {
        expect(equals(cmp, m.concat(a, b), m.concat(b, a))).toBe(true);
        expect(equals(cmp, m.concat(m.concat(a, b), c), m.concat(a, m.concat(b, c)))).toBe(true);
        expect(toEntries(m.concat(a, a))).toEqual([entry("a", 2), entry("b", 4)]); // doubles
    });
    it("concatAll folds a collection through the monoid (per-key sums)", () => {
        expect(toEntries(concatAll(cmp, [bag(entry("a", 1)), bag(entry("a", 2), entry("b", 1)), bag(entry("b", 3))]))).toEqual([
            entry("a", 3),
            entry("b", 4),
        ]);
    });
});
describe("Bag — shared golden vector (cross-language parity lock)", () => {
    const gv = JSON.parse(readFileSync(join(import.meta.dir, "golden-vectors.json"), "utf-8"));
    const plain = (b) => toEntries(b).map((x) => ({ e: x.e, n: x.n }));
    it("replays the vector to expectedReplayStates + expectedFinalState", () => {
        let state = ofEntries(cmp, gv.initialBag);
        const states = [];
        for (const op of gv.ops) {
            if (op.op === "add")
                state = add(cmp, op.arg, state);
            else if (op.op === "addN")
                state = addN(cmp, op.arg, op.n, state);
            else
                state = union(cmp, state, ofEntries(cmp, op.arg));
            states.push(plain(state));
        }
        expect(states).toEqual(gv.expectedReplayStates.map((s) => s.map((x) => ({ e: x.e, n: x.n }))));
        expect(plain(state)).toEqual(gv.expectedFinalState.map((x) => ({ e: x.e, n: x.n })));
    });
});
