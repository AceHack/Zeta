// audit_clause_coverage.test.ts — tests for alignment-clause coverage audit.
//
// 081KQ3HBZ0008QG0R002S674CG slice: adds test coverage for the clause-extraction regex,
// the audit() integration function, and the main() CLI arg parsing.
//
// Run: bun test src/Core.TypeScript/alignment/audit_clause_coverage.test.ts
import { describe, expect, test } from "bun:test";
import { ALL_CLAUSES, audit, extractClauses, main, } from "./audit_clause_coverage.js";
describe("extractClauses", () => {
    test("extracts single clause from text", () => {
        expect(extractClauses("This references HC-1 explicitly.")).toEqual([
            "HC-1",
        ]);
    });
    test("extracts multiple clauses in canonical order", () => {
        const content = "We cite DIR-3 and HC-2 and SD-5 here.";
        const result = extractClauses(content);
        expect(result).toEqual(["HC-2", "SD-5", "DIR-3"]);
    });
    test("deduplicates repeated clauses", () => {
        const content = "HC-1 is mentioned, then HC-1 again, then HC-1.";
        expect(extractClauses(content)).toEqual(["HC-1"]);
    });
    test("returns empty array for content with no clauses", () => {
        expect(extractClauses("No alignment clauses here.")).toEqual([]);
    });
    test("does not match partial clause IDs", () => {
        expect(extractClauses("HC-0 SD-0 DIR-0 DIR-6 HC-8 SD-10")).toEqual([]);
    });
    test("matches clauses at word boundaries", () => {
        expect(extractClauses("(HC-7) [SD-1] {DIR-5}")).toEqual([
            "HC-7",
            "SD-1",
            "DIR-5",
        ]);
    });
    test("returns results ordered by ALL_CLAUSES, not input order", () => {
        const content = "DIR-5 SD-9 HC-1";
        const result = extractClauses(content);
        expect(result).toEqual(["HC-1", "SD-9", "DIR-5"]);
    });
    test("handles all 21 clauses", () => {
        const content = ALL_CLAUSES.join(" ");
        expect(extractClauses(content)).toEqual([...ALL_CLAUSES]);
    });
});
describe("ALL_CLAUSES", () => {
    test("has exactly 21 clauses", () => {
        expect(ALL_CLAUSES).toHaveLength(21);
    });
    test("covers HC-1..HC-7", () => {
        for (let i = 1; i <= 7; i++) {
            expect(ALL_CLAUSES).toContain(`HC-${String(i)}`);
        }
    });
    test("covers SD-1..SD-9", () => {
        for (let i = 1; i <= 9; i++) {
            expect(ALL_CLAUSES).toContain(`SD-${String(i)}`);
        }
    });
    test("covers DIR-1..DIR-5", () => {
        for (let i = 1; i <= 5; i++) {
            expect(ALL_CLAUSES).toContain(`DIR-${String(i)}`);
        }
    });
});
describe("audit() integration", () => {
    test("returns a valid AuditResult shape", () => {
        const result = audit();
        expect(result.schema).toBe("alignment-clause-coverage-v2");
        expect(typeof result.totalSurfaces).toBe("number");
        expect(typeof result.totalWithZero).toBe("number");
        expect(result.totalClauses).toBe(ALL_CLAUSES.length);
        expect(Array.isArray(result.surfaces)).toBe(true);
        expect(Array.isArray(result.uncitedClauses)).toBe(true);
    });
    test("finds at least one surface", () => {
        const result = audit();
        expect(result.totalSurfaces).toBeGreaterThan(0);
    });
    test("every surface has expected fields", () => {
        const result = audit();
        for (const s of result.surfaces) {
            expect(["skill", "agent", "backlog"]).toContain(s.kind);
            expect(typeof s.name).toBe("string");
            expect(s.name.length).toBeGreaterThan(0);
            expect(typeof s.path).toBe("string");
            expect(Array.isArray(s.clausesCited)).toBe(true);
            expect(typeof s.clauseCount).toBe("number");
            expect(s.clauseCount).toBe(s.clausesCited.length);
        }
    });
    test("totalWithZero equals count of zero-citation surfaces", () => {
        const result = audit();
        const zeroCount = result.surfaces.filter((s) => s.clauseCount === 0).length;
        expect(result.totalWithZero).toBe(zeroCount);
    });
    test("uncitedClauses are a subset of ALL_CLAUSES", () => {
        const result = audit();
        for (const c of result.uncitedClauses) {
            expect(ALL_CLAUSES).toContain(c);
        }
    });
    test("cited clauses in surfaces are all valid clause IDs", () => {
        const result = audit();
        for (const s of result.surfaces) {
            for (const c of s.clausesCited) {
                expect(ALL_CLAUSES).toContain(c);
            }
        }
    });
});
describe("main() CLI", () => {
    test("returns 0 with no args", () => {
        expect(main([])).toBe(0);
    });
    test("returns 0 with --help", () => {
        expect(main(["--help"])).toBe(0);
    });
    test("returns 0 with --json", () => {
        expect(main(["--json"])).toBe(0);
    });
    test("returns 0 with --md", () => {
        expect(main(["--md"])).toBe(0);
    });
    test("returns 2 for unknown arg", () => {
        expect(main(["--bad-flag"])).toBe(2);
    });
    test("returns 2 when --gate has no value", () => {
        expect(main(["--gate"])).toBe(2);
    });
    test("returns 0 with --gate 0 (trivially satisfied)", () => {
        expect(main(["--gate", "0"])).toBe(0);
    });
    test("returns 1 with --gate 999 (impossible threshold)", () => {
        expect(main(["--gate", "999"])).toBe(1);
    });
});
