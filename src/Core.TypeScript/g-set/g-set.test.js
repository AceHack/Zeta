/**
 * g-set.test.ts — TS reference (oracle #1) for the G-Set CRDT.
 *
 * Two duties:
 *   1. The three CRDT laws + identity hold (idempotent, commutative,
 *      associative, identity) — the reason a G-Set converges without
 *      coordination.
 *   2. The shared golden vector replays to the expected states — the
 *      cross-language parity lock the F# twin (oracle #2) also casts.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { add, concatAll, contains, empty, equals, monoid, ofArray, stringCompare, toArray, union } from "./g-set";
const cmp = stringCompare;
const g = (...xs) => ofArray(cmp, xs);
describe("G-Set — canonicalization", () => {
    it("ofArray sorts ascending and drops duplicates", () => {
        expect(toArray(g("c", "a", "b", "a", "c"))).toEqual(["a", "b", "c"]);
    });
    it("empty is empty; singleton-via-ofArray has one element", () => {
        expect(toArray(empty())).toEqual([]);
        expect(toArray(g("x"))).toEqual(["x"]);
    });
    it("contains agrees with membership (binary search)", () => {
        const s = g("a", "c", "e");
        expect(contains(cmp, s, "c")).toBe(true);
        expect(contains(cmp, s, "d")).toBe(false);
        expect(contains(cmp, empty(), "a")).toBe(false);
    });
});
describe("G-Set — CRDT convergence laws", () => {
    // Named off the `union(compare, a, b)` parameter names so the commutativity
    // test (`union(setA, setB)` vs `union(setB, setA)`) isn't misread as a
    // swapped-argument bug by static analysis — the swap IS the property.
    const setA = g("a", "b");
    const setB = g("b", "c");
    const setC = g("c", "d");
    it("idempotent: union(a, a) == a", () => {
        expect(equals(cmp, union(cmp, setA, setA), setA)).toBe(true);
    });
    it("commutative: union(a, b) == union(b, a)", () => {
        expect(equals(cmp, union(cmp, setA, setB), union(cmp, setB, setA))).toBe(true);
    });
    it("associative: union(union(a, b), c) == union(a, union(b, c))", () => {
        const left = union(cmp, union(cmp, setA, setB), setC);
        const right = union(cmp, setA, union(cmp, setB, setC));
        expect(equals(cmp, left, right)).toBe(true);
    });
    it("identity: union(a, empty) == a and union(empty, a) == a", () => {
        expect(equals(cmp, union(cmp, setA, empty()), setA)).toBe(true);
        expect(equals(cmp, union(cmp, empty(), setA), setA)).toBe(true);
    });
    it("add is idempotent for a present element", () => {
        expect(equals(cmp, add(cmp, "a", setA), setA)).toBe(true);
        expect(toArray(add(cmp, "z", setA))).toEqual(["a", "b", "z"]);
    });
});
describe("G-Set — additive-monoid surface (empty + concat)", () => {
    const m = monoid(cmp);
    const setA = g("a", "b");
    const setB = g("b", "c");
    const setC = g("c", "d");
    it("concat produces the explicit union (not just delegation)", () => {
        expect(toArray(m.concat(setA, setB))).toEqual(["a", "b", "c"]);
    });
    it("empty is the identity: concat(empty, a) == a and concat(a, empty) == a", () => {
        expect(toArray(m.empty)).toEqual([]);
        expect(equals(cmp, m.concat(m.empty, setA), setA)).toBe(true);
        expect(equals(cmp, m.concat(setA, m.empty), setA)).toBe(true);
    });
    it("monoid laws: idempotent + commutative + associative via concat", () => {
        expect(equals(cmp, m.concat(setA, setA), setA)).toBe(true);
        expect(equals(cmp, m.concat(setA, setB), m.concat(setB, setA))).toBe(true);
        const left = m.concat(m.concat(setA, setB), setC);
        const right = m.concat(setA, m.concat(setB, setC));
        expect(equals(cmp, left, right)).toBe(true);
    });
    it("concatAll folds a collection through the monoid", () => {
        expect(toArray(concatAll(cmp, [g("a"), g("b", "a"), g("c")]))).toEqual(["a", "b", "c"]);
    });
});
describe("G-Set — shared golden vector (cross-language parity lock)", () => {
    const gv = JSON.parse(readFileSync(join(import.meta.dir, "golden-vectors.json"), "utf-8"));
    it("replays the vector to expectedReplayStates + expectedFinalState", () => {
        let state = ofArray(cmp, gv.initialSet);
        const states = [];
        for (const op of gv.ops) {
            state = op.op === "add" ? add(cmp, op.arg, state) : union(cmp, state, ofArray(cmp, op.arg));
            states.push(toArray(state));
        }
        expect(states).toEqual(gv.expectedReplayStates.map((s) => [...s]));
        expect(toArray(state)).toEqual([...gv.expectedFinalState]);
    });
});
