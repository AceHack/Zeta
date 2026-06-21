import { describe, expect, test } from "bun:test";
import { rat, add, mul, max, div, merge3, forwardStep, viterbiStep } from "./probability-semiring";
import vectors from "./golden-vectors.json";
// Replays the shared golden seed through the TS oracle; the C#/F#/Rust oracles replay the same file.
const r = (x) => rat(x.n, x.d);
const vec = (xs) => xs.map(r);
const mat = (xs) => xs.map(vec);
describe("ProbabilitySemiring golden vectors", () => {
    test("normalize", () => {
        for (const v of vectors.normalize)
            expect(rat(v.n, v.d)).toEqual(r(v.result));
    });
    test("add (+,x)", () => {
        for (const v of vectors.add)
            expect(add(r(v.a), r(v.b))).toEqual(r(v.result));
    });
    test("mul", () => {
        for (const v of vectors.mul)
            expect(mul(r(v.a), r(v.b))).toEqual(r(v.result));
    });
    test("max (Viterbi +)", () => {
        for (const v of vectors.max)
            expect(max(r(v.a), r(v.b))).toEqual(r(v.result));
    });
    test("forwardStep (pi*P over +,x)", () => {
        for (const v of vectors.forwardStep)
            expect(forwardStep(vec(v.pi), mat(v.p))).toEqual(vec(v.result));
    });
    test("viterbiStep (max,x)", () => {
        for (const v of vectors.viterbiStep)
            expect(viterbiStep(vec(v.v), mat(v.p))).toEqual(vec(v.result));
    });
    test("div", () => {
        for (const v of vectors.div)
            expect(div(r(v.a), r(v.b))).toEqual(r(v.result));
    });
    test("merge3 (relative-observer reconciliation)", () => {
        for (const v of vectors.merge3)
            expect(merge3(vec(v.ancestor), vec(v.a), vec(v.b))).toEqual(vec(v.result));
    });
});
