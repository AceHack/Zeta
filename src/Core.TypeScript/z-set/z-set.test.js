/**
 * z-set.test.ts — TS reference (oracle #1) for the Z-set (signed multiset) — the
 * TOP rung of the algebra ladder (G-Set ⊂ Bag ⊂ Z-set).
 *
 * Three duties:
 *   1. The abelian-GROUP laws hold (commutative, associative, identity, AND the
 *      inverse: union(a, negate(a)) == empty) — plus union is NOT idempotent
 *      (union(a, a) doubles weights, shared with the Bag) and NEGATIVE weights
 *      persist (drop rule is == 0, not <= 0 — the ℕ→ℤ widening from the Bag).
 *   2. Construction canonicalizes (sum per key, drop weight == 0, sort).
 *   3. The shared golden vector replays to the expected states — the
 *      cross-language parity lock the F#/C#/Rust twins also cast.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { abelianGroup, add, addW, concatAll, contains, distinctCount, empty, equals, isEmpty, monoid, negate, ofArray, ofEntries, singleton, stringCompare, toEntries, total, union, weight, } from "./z-set";
const cmp = stringCompare;
const entry = (e, w) => ({ e, w });
const zset = (...es) => ofEntries(cmp, es);
describe("Z-set — canonicalization", () => {
    it("ofArray counts occurrences, sorts ascending", () => {
        expect(toEntries(ofArray(cmp, ["c", "a", "b", "a", "c", "c"]))).toEqual([
            entry("a", 2),
            entry("b", 1),
            entry("c", 3),
        ]);
    });
    it("ofEntries sums per-key weights, drops weight == 0, KEEPS negatives", () => {
        // a: 1+2=3 ; b: 1+(-1)=0 → dropped ; c: -1 kept (the Bag would drop c)
        expect(toEntries(zset(entry("a", 1), entry("a", 2), entry("b", 1), entry("b", -1), entry("c", -1)))).toEqual([
            entry("a", 3),
            entry("c", -1),
        ]);
    });
    it("empty is empty; singleton has one key; singleton(_, 0) is empty; singleton accepts negatives", () => {
        expect(toEntries(empty())).toEqual([]);
        expect(toEntries(singleton("x", 4))).toEqual([entry("x", 4)]);
        expect(toEntries(singleton("x", -4))).toEqual([entry("x", -4)]);
        expect(toEntries(singleton("x", 0))).toEqual([]);
    });
    it("weight / contains agree (binary search; contains is weight != 0)", () => {
        const z = zset(entry("a", 2), entry("c", -5), entry("e", 1));
        expect(weight(cmp, z, "c")).toBe(-5);
        expect(weight(cmp, z, "d")).toBe(0);
        expect(contains(cmp, z, "c")).toBe(true); // negative weight still "contained"
        expect(contains(cmp, z, "z")).toBe(false);
    });
    it("distinctCount counts keys; total sums weights (may be negative)", () => {
        const z = zset(entry("a", 2), entry("b", -3));
        expect(distinctCount(z)).toBe(2);
        expect(total(z)).toBe(-1);
    });
    it("rejects non-integer / non-finite weights (weights are ℤ; integer F#/C#/Rust parity)", () => {
        expect(() => singleton("x", 0.5)).toThrow(RangeError);
        expect(() => addW(cmp, "x", 1.5, empty())).toThrow(RangeError);
        expect(() => ofEntries(cmp, [entry("x", Number.NaN)])).toThrow(RangeError);
        expect(() => ofEntries(cmp, [entry("x", Number.NEGATIVE_INFINITY)])).toThrow(RangeError);
        // safe integers (including 0, handled by the drop/no-op logic) are admitted
        expect(toEntries(singleton("x", 0))).toEqual([]);
        expect(equals(cmp, addW(cmp, "z", 0, zset(entry("a", 1))), zset(entry("a", 1)))).toBe(true);
    });
    it("guards SUMMED weights against safe-integer overflow (union + ofEntries dedup; both signs)", () => {
        const big = singleton("x", Number.MAX_SAFE_INTEGER);
        expect(() => union(cmp, big, singleton("x", 2))).toThrow(RangeError); // past MAX
        const negBig = singleton("x", Number.MIN_SAFE_INTEGER);
        expect(() => union(cmp, negBig, singleton("x", -2))).toThrow(RangeError); // below MIN
        expect(() => ofEntries(cmp, [entry("x", Number.MAX_SAFE_INTEGER), entry("x", 2)])).toThrow(RangeError);
        expect(toEntries(union(cmp, singleton("x", 2), singleton("x", 3)))).toEqual([entry("x", 5)]); // safe sum is fine
    });
    it("total throws if the aggregate sum overflows safe-integer range", () => {
        const z = zset(entry("a", Number.MAX_SAFE_INTEGER), entry("b", 1));
        expect(() => total(z)).toThrow(RangeError);
        expect(total(zset(entry("a", 2), entry("b", -3)))).toBe(-1);
    });
});
describe("Z-set — abelian-group laws (inverse + NON-idempotence + negatives persist)", () => {
    // Named off the `union(compare, a, b)` parameter names so the commutativity
    // test isn't misread as a swapped-argument bug by static analysis — the swap
    // IS the property.
    const zsetA = zset(entry("a", 1), entry("b", 2));
    const zsetB = zset(entry("b", -1), entry("c", 3));
    const zsetC = zset(entry("c", 1), entry("d", -4));
    it("commutative: union(a, b) == union(b, a)", () => {
        expect(equals(cmp, union(cmp, zsetA, zsetB), union(cmp, zsetB, zsetA))).toBe(true);
    });
    it("associative: union(union(a, b), c) == union(a, union(b, c))", () => {
        const left = union(cmp, union(cmp, zsetA, zsetB), zsetC);
        const right = union(cmp, zsetA, union(cmp, zsetB, zsetC));
        expect(equals(cmp, left, right)).toBe(true);
    });
    it("identity: union(a, empty) == a and union(empty, a) == a", () => {
        expect(equals(cmp, union(cmp, zsetA, empty()), zsetA)).toBe(true);
        expect(equals(cmp, union(cmp, empty(), zsetA), zsetA)).toBe(true);
    });
    it("inverse: union(a, negate(a)) == empty (the law the Bag cannot satisfy)", () => {
        expect(isEmpty(union(cmp, zsetA, negate(zsetA)))).toBe(true);
        // negate flips every sign and preserves the canonical invariant
        expect(toEntries(negate(zsetA))).toEqual([entry("a", -1), entry("b", -2)]);
        expect(toEntries(negate(negate(zsetA)))).toEqual(toEntries(zsetA)); // involution
    });
    it("NOT idempotent: union(a, a) doubles every weight (shared with the Bag, distinct from the G-Set)", () => {
        const doubled = union(cmp, zsetA, zsetA);
        expect(toEntries(doubled)).toEqual([entry("a", 2), entry("b", 4)]);
        expect(equals(cmp, doubled, zsetA)).toBe(false);
    });
    it("union sums overlapping keys, drops cancellations to 0, keeps surviving negatives", () => {
        // a: 1 (disjoint) ; b: 2+(-1)=1 ; c: 3 (disjoint) → none cancel here
        expect(toEntries(union(cmp, zsetA, zsetB))).toEqual([entry("a", 1), entry("b", 1), entry("c", 3)]);
        // explicit cancellation: b 2 + (-2) = 0 → dropped
        expect(toEntries(union(cmp, zsetA, zset(entry("b", -2))))).toEqual([entry("a", 1)]);
    });
    it("add increments by 1; addW adds signed weight; addW(_, 0) is a no-op; addW can retract to 0", () => {
        expect(toEntries(add(cmp, "a", zsetA))).toEqual([entry("a", 2), entry("b", 2)]);
        expect(toEntries(addW(cmp, "z", -3, zsetA))).toEqual([entry("a", 1), entry("b", 2), entry("z", -3)]);
        expect(equals(cmp, addW(cmp, "z", 0, zsetA), zsetA)).toBe(true);
        expect(toEntries(addW(cmp, "a", -1, zsetA))).toEqual([entry("b", 2)]); // a 1 + (-1) = 0 → retracted
    });
});
describe("Z-set — shared golden vector (cross-language parity lock)", () => {
    const gv = JSON.parse(readFileSync(join(import.meta.dir, "golden-vectors.json"), "utf-8"));
    const plain = (z) => toEntries(z).map((x) => ({ e: x.e, w: x.w }));
    it("replays the vector to expectedReplayStates + expectedFinalState", () => {
        let state = ofEntries(cmp, gv.initialZSet);
        const states = [];
        for (const op of gv.ops) {
            if (op.op === "add")
                state = add(cmp, op.arg, state);
            else if (op.op === "addW")
                state = addW(cmp, op.arg, op.w, state);
            else
                state = union(cmp, state, ofEntries(cmp, op.arg));
            states.push(plain(state));
        }
        expect(states).toEqual(gv.expectedReplayStates.map((s) => s.map((x) => ({ e: x.e, w: x.w }))));
        expect(plain(state)).toEqual(gv.expectedFinalState.map((x) => ({ e: x.e, w: x.w })));
    });
});
describe("Z-set — generic-math abelian-group surface (monoid / abelianGroup / concatAll)", () => {
    // TS has no operator overloading, so the dotnet-numerics interface is a record of
    // the operations: a Monoid (empty + concat) extended to an AbelianGroup with
    // invert + subtract. The twins are F# Zero/(+)/(~-)/(-), C# IWSAM, Rust std::ops.
    const a = zset(entry("a", 1), entry("b", 2));
    const b = zset(entry("b", 1), entry("c", 3));
    it("monoid: concat == union, empty is the identity", () => {
        const m = monoid(cmp);
        expect(m.concat(a, b)).toEqual(union(cmp, a, b));
        expect(m.concat(m.empty, a)).toEqual(a);
        expect(m.concat(a, m.empty)).toEqual(a);
        expect(m.empty).toEqual(empty());
    });
    it("abelianGroup: invert == negate, subtract == union(negate), and is a Monoid", () => {
        const g = abelianGroup(cmp);
        expect(g.invert(a)).toEqual(negate(a));
        expect(g.subtract(a, b)).toEqual(union(cmp, a, negate(b)));
        expect(g.concat(a, b)).toEqual(union(cmp, a, b)); // extends Monoid
        expect(g.empty).toEqual(empty());
    });
    it("inverse law: concat(a, invert(a)) == empty and subtract(a, a) == empty", () => {
        const g = abelianGroup(cmp);
        const z = zset(entry("a", 1), entry("b", -2), entry("c", 3));
        expect(g.concat(z, g.invert(z))).toEqual(empty()); // the law a Bag cannot satisfy
        expect(g.subtract(z, z)).toEqual(empty());
    });
    it("concat is NOT idempotent: concat(a, a) doubles every weight (Z-set, not G-Set)", () => {
        const g = abelianGroup(cmp);
        const z = zset(entry("a", 1), entry("b", -3));
        expect(g.concat(z, z)).toEqual(zset(entry("a", 2), entry("b", -6)));
    });
    it("concatAll folds a collection through the monoid (retraction-to-0 drops)", () => {
        const parts = [zset(entry("a", 1)), zset(entry("a", 1), entry("b", 2)), zset(entry("b", -2), entry("c", 5))];
        expect(concatAll(cmp, parts)).toEqual(zset(entry("a", 2), entry("c", 5)));
        expect(concatAll(cmp, [])).toEqual(empty());
    });
});
