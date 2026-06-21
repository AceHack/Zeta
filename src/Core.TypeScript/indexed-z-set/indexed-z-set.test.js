/**
 * indexed-z-set.test.ts — TS reference (oracle #1) for `IndexedZSet<K,V>`, the
 * rung above the Z-set on the algebra ladder.
 *
 * Three duties (mirroring the Z-set oracle):
 *   1. The grouped abelian-group laws hold — `add` is commutative / associative
 *      with `empty` identity and `neg` inverse (`add(a, neg(a)) == empty`), and
 *      an all-cancelling key DROPS its group (the inverse lifts to the index).
 *   2. Construction canonicalizes — `indexWith` buckets by key then Z-set-sums
 *      each bucket (sum + drop-zero), groups sort ascending, empties drop.
 *   3. The shared golden vector replays to the expected states — the
 *      cross-language parity lock the F#/C#/Rust twins also cast (`join` is the
 *      bilinear cross-product with weight-MULTIPLY + consolidate).
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { equals as zEquals, ofEntries as zOfEntries, stringCompare, } from "../z-set/z-set";
import { abelianGroup, add, concatAll, empty, equals, get, indexWith, isEmpty, join, keyCount, monoid, neg, ofGroups, sub, toZSet, tupleCount, } from "./indexed-z-set";
const cmp = stringCompare;
const eqI = (a, b) => equals(cmp, cmp, a, b);
const golden = JSON.parse(readFileSync(pathJoin(import.meta.dir, "golden-vectors.json"), "utf8"));
// (k, v) pair order: ascending by k, then by v — the source Z-set's element order.
const pairCompare = (a, b) => {
    const c = cmp(a.k, b.k);
    return c !== 0 ? c : cmp(a.v, b.v);
};
/** A JSON indexed-state is already authored in canonical form — cast it. */
const toIndexed = (gs) => gs.map((g) => ({ key: g.k, values: g.values }));
const expectedA = toIndexed(golden.expectedA);
const operandB = ofGroups(cmp, cmp, toIndexed(golden.operandB));
// A is built the real way: a source Z-set, then indexWith.
const sourceZ = zOfEntries(pairCompare, golden.indexInput);
const A = indexWith(cmp, cmp, (p) => p.k, (p) => p.v, sourceZ);
// --- 3. golden-vector replay (the cross-language parity lock) --------------
describe("IndexedZSet — golden vector (oracle #1 / parity lock)", () => {
    it("indexWith builds the expected canonical A (sum per (k,v), drop-zero, sorted)", () => {
        expect(eqI(A, expectedA)).toBe(true);
    });
    it("keyCount / tupleCount of A", () => {
        expect(keyCount(A)).toBe(golden.expectedKeyCountA);
        expect(tupleCount(A)).toBe(golden.expectedTupleCountA);
    });
    it("add(A, B) — shared-key ZSet.union, drop the cancelled group", () => {
        expect(eqI(add(cmp, cmp, A, operandB), toIndexed(golden.expectedAddAB))).toBe(true);
    });
    it("neg(A) — per-group negation", () => {
        expect(eqI(neg(A), toIndexed(golden.expectedNegA))).toBe(true);
    });
    it("sub(A, B) = add(A, neg(B)) — negatives persist", () => {
        expect(eqI(sub(cmp, cmp, A, operandB), toIndexed(golden.expectedSubAB))).toBe(true);
    });
    it("join(A, B) — merge-join on key × cross-product values, weight MULTIPLY", () => {
        const out = join(cmp, cmp, (k, va, vb) => `${k}|${va}|${vb}`, A, operandB);
        expect(zEquals(cmp, out, golden.expectedJoinAB)).toBe(true);
    });
    it("toZSet(A) — flatten (k,v) tuples to a Z-set<string>", () => {
        const out = toZSet(cmp, (k, v) => `${k}|${v}`, A);
        expect(zEquals(cmp, out, golden.expectedToZSetA)).toBe(true);
    });
});
// --- 1. grouped abelian-group laws ----------------------------------------
describe("IndexedZSet — abelian-group laws (grouped over the Z-set)", () => {
    const e = empty();
    it("empty is the identity: add(A, empty) == add(empty, A) == A", () => {
        expect(eqI(add(cmp, cmp, A, e), A)).toBe(true);
        expect(eqI(add(cmp, cmp, e, A), A)).toBe(true);
    });
    it("inverse: add(A, neg(A)) == empty (every group cancels and DROPS)", () => {
        const cancelled = add(cmp, cmp, A, neg(A));
        expect(isEmpty(cancelled)).toBe(true);
    });
    it("commutative: add(A, B) == add(B, A)", () => {
        expect(eqI(add(cmp, cmp, A, operandB), add(cmp, cmp, operandB, A))).toBe(true);
    });
    it("associative: add(add(A,B),A) == add(A,add(B,A))", () => {
        const left = add(cmp, cmp, add(cmp, cmp, A, operandB), A);
        const right = add(cmp, cmp, A, add(cmp, cmp, operandB, A));
        expect(eqI(left, right)).toBe(true);
    });
});
// --- 2. construction / lookup invariants ----------------------------------
describe("IndexedZSet — construction + lookup", () => {
    it("get returns a key's Z-set, empty for an absent key", () => {
        // A has keys a, b; A.a = {x:2, y:2}
        const ax = get(cmp, A, "a");
        expect(ax.length).toBe(2);
        expect(get(cmp, A, "zzz").length).toBe(0);
    });
    it("indexWith drops a group whose values fully cancel to empty", () => {
        // (k1, p): +1 then -1 → the only key's value-Z-set is empty → no group.
        const src = zOfEntries(pairCompare, [
            { e: { k: "k1", v: "p" }, w: 1 },
            { e: { k: "k1", v: "p" }, w: -1 },
        ]);
        const idx = indexWith(cmp, cmp, (p) => p.k, (p) => p.v, src);
        expect(isEmpty(idx)).toBe(true);
    });
});
describe("IndexedZSet — generic-math abelian-group surface (monoid / abelianGroup / concatAll)", () => {
    // TS has no operator overloading, so the dotnet-numerics interface is a record:
    // a Monoid (empty + concat) extended to an AbelianGroup with invert + subtract
    // (reusing the shared interfaces from g-set/z-set). Twins: F# Zero/(+)/(~-)/(-),
    // C# IWSAM, Rust std::ops. The last ladder rung.
    const ixz = (triples) => indexWith(cmp, cmp, (p) => p.k, (p) => p.v, zOfEntries(pairCompare, triples.map(([k, v, w]) => ({ e: { k, v }, w }))));
    const a = ixz([
        ["k1", "a", 1],
        ["k2", "b", 2],
    ]);
    const b = ixz([
        ["k2", "b", 1],
        ["k3", "c", 3],
    ]);
    it("monoid: concat == add, empty is the identity", () => {
        const m = monoid(cmp, cmp);
        expect(eqI(m.concat(a, b), add(cmp, cmp, a, b))).toBe(true);
        expect(eqI(m.concat(m.empty, a), a)).toBe(true);
        expect(eqI(m.concat(a, m.empty), a)).toBe(true);
        expect(isEmpty(m.empty)).toBe(true);
    });
    it("abelianGroup: invert == neg, subtract == sub, and is a Monoid", () => {
        const g = abelianGroup(cmp, cmp);
        expect(eqI(g.invert(a), neg(a))).toBe(true);
        expect(eqI(g.subtract(a, b), sub(cmp, cmp, a, b))).toBe(true);
        expect(eqI(g.concat(a, b), add(cmp, cmp, a, b))).toBe(true); // extends Monoid
        expect(isEmpty(g.empty)).toBe(true);
    });
    it("inverse law: concat(a, invert(a)) == empty and subtract(a, a) == empty", () => {
        const g = abelianGroup(cmp, cmp);
        const z = ixz([
            ["k1", "a", 1],
            ["k2", "b", -2],
            ["k2", "c", 3],
        ]);
        expect(isEmpty(g.concat(z, g.invert(z)))).toBe(true); // the law a Bag cannot satisfy
        expect(isEmpty(g.subtract(z, z))).toBe(true);
    });
    it("concat is NOT idempotent: concat(a, a) doubles every value-weight", () => {
        const g = abelianGroup(cmp, cmp);
        const z = ixz([
            ["k", "a", 1],
            ["k", "b", -3],
        ]);
        expect(eqI(g.concat(z, z), ixz([
            ["k", "a", 2],
            ["k", "b", -6],
        ]))).toBe(true);
    });
    it("concatAll folds a collection (key empties out and drops; [] => empty)", () => {
        const parts = [
            ixz([["k1", "a", 1]]),
            ixz([
                ["k1", "a", 1],
                ["k2", "b", 2],
            ]),
            ixz([["k2", "b", -2]]),
        ];
        expect(eqI(concatAll(cmp, cmp, parts), ixz([["k1", "a", 2]]))).toBe(true);
        expect(isEmpty(concatAll(cmp, cmp, []))).toBe(true);
    });
});
