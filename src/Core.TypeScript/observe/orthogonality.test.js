import { test, expect } from "bun:test";
import { shingles, jaccard, containment, assessOrthogonality } from "./orthogonality";
// 081KT7YW00008QG0R002T1XNWT orthogonality core — the overlap measure + corpus check. The measure's
// axioms are proven in F# (Jaccard.Laws.Tests.fs); these are the operational
// example/edge tests + the corpus assessment.
test("identical surfaces are fully overlapping (self = 1)", () => {
    const a = shingles("the carved sentence points to the doc one hop away");
    expect(jaccard(a, a)).toBe(1);
    expect(containment(a, a)).toBe(1);
});
test("disjoint surfaces are orthogonal (overlap = 0)", () => {
    const a = shingles("alpha beta gamma delta epsilon");
    const b = shingles("one two three four five six");
    expect(jaccard(a, b)).toBe(0);
    expect(containment(a, b)).toBe(0);
});
test("jaccard is symmetric", () => {
    const a = shingles("the quick brown fox jumps over the lazy dog");
    const b = shingles("the quick brown cat sleeps under the lazy log");
    expect(jaccard(a, b)).toBeCloseTo(jaccard(b, a), 12);
});
test("containment catches a small surface subsumed in a big one", () => {
    const small = shingles("alpha beta gamma");
    const big = shingles("prefix words alpha beta gamma suffix words and more text here");
    // small's only shingle is fully contained in big → containment 1, jaccard low
    expect(containment(small, big)).toBe(1);
    expect(jaccard(small, big)).toBeLessThan(0.5);
});
test("assessOrthogonality flags an overlapping pair and passes a disjoint one", () => {
    const surfaces = [
        { path: "a", text: "the carved sentence points to the doc one hop away from here" },
        { path: "b", text: "the carved sentence points to the doc one hop away from here too" },
        { path: "c", text: "completely unrelated content about turtles swimming in deep oceans" },
    ];
    const pairs = assessOrthogonality(surfaces, { jaccard: 0.2, containment: 0.5 });
    const ab = pairs.find((p) => (p.a === "a" && p.b === "b") || (p.a === "b" && p.b === "a"));
    const ac = pairs.find((p) => (p.a === "a" && p.b === "c") || (p.a === "c" && p.b === "a"));
    expect(ab.overlaps).toBe(true);
    expect(ac.overlaps).toBe(false);
});
