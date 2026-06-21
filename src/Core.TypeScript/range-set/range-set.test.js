/**
 * range-set.test.ts — TS reference (oracle #1) for RangeSet. Two duties:
 *   1. The shared golden vectors replay: parse(input) -> Ok, render == canonical (the
 *      cross-language byte lock the F#/C#/Rust twins also cast), and contains agrees; the
 *      rejection vectors decline the SPECIFIC feedback variant (rejection-vector contract).
 *   2. Structural laws: render(parse(canonical)) is a fixed point; union/add re-normalize;
 *      contains/size are consistent.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { add, contains, parse, render, size, union } from "./range-set";
const golden = JSON.parse(readFileSync(join(import.meta.dir, "golden-vectors.json"), "utf8"));
function parseOk(input) {
    const r = parse(input);
    if (!r.ok)
        throw new Error(`expected Ok for ${JSON.stringify(input)}, got ${r.error.kind}`);
    return r.value;
}
describe("RangeSet — shared golden vectors", () => {
    it("has cases + rejections", () => {
        expect(golden.cases.length).toBeGreaterThan(0);
        expect(golden.rejections.length).toBeGreaterThan(0);
    });
    for (const c of golden.cases) {
        it(`case ${c.name}: render(parse(input)) == canonical + contains agrees`, () => {
            const rs = parseOk(c.input);
            expect(render(rs)).toBe(c.canonical);
            // the canonical form is a fixed point of parse->render
            expect(render(parseOk(c.canonical))).toBe(c.canonical);
            for (const [n, expected] of c.contains) {
                expect(contains(rs, n)).toBe(expected);
            }
        });
    }
    for (const r of golden.rejections) {
        it(`rejection ${r.name}: parse declines ${r.feedback}`, () => {
            const res = parse(r.input);
            expect(res.ok).toBe(false);
            if (!res.ok)
                expect(res.error.kind).toBe(r.feedback);
        });
    }
});
describe("RangeSet — structural laws", () => {
    it("union re-normalizes (coalesces across the two sets)", () => {
        expect(render(union(parseOk("1-3"), parseOk("4-6")))).toBe("1-6");
        expect(render(union(parseOk("1-5,10-12"), parseOk("6,13-14")))).toBe("1-6,10-14");
        expect(render(union(parseOk(""), parseOk("8")))).toBe("8");
    });
    it("add inserts + coalesces", () => {
        expect(render(add(parseOk("1-3,5-7"), 4))).toBe("1-7");
        expect(render(add(parseOk("1-3"), 10))).toBe("1-3,10");
        expect(render(add(parseOk("1-3"), 2))).toBe("1-3"); // already present
    });
    it("size counts covered integers", () => {
        expect(size(parseOk(""))).toBe(0);
        expect(size(parseOk("1-5,8,10-17"))).toBe(5 + 1 + 8);
    });
    it("contains is consistent with size for a dense range", () => {
        const rs = parseOk("3-9");
        let counted = 0;
        for (let n = 0; n <= 12; n++)
            if (contains(rs, n))
                counted++;
        expect(counted).toBe(size(rs));
    });
});
