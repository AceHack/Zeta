// audit_external_anchors.test.ts — B-0311
//
// Tests for the external-anchor coverage scanner.
// Run: bun test src/Core.TypeScript/alignment/audit_external_anchors.test.ts
import { describe, expect, test } from "bun:test";
import { audit, classifyUrl, extractUrlsFromWindow, main, } from "./audit_external_anchors.js";
describe("classifyUrl", () => {
    test("arxiv.org → paper", () => {
        expect(classifyUrl("https://arxiv.org/abs/1234.5678")).toBe("paper");
    });
    test("doi.org → paper", () => {
        expect(classifyUrl("https://doi.org/10.1145/1234567")).toBe("paper");
    });
    test("dl.acm.org → paper", () => {
        expect(classifyUrl("https://dl.acm.org/doi/10.1145/123")).toBe("paper");
    });
    test("tools.ietf.org → rfc", () => {
        expect(classifyUrl("https://tools.ietf.org/html/rfc7231")).toBe("rfc");
    });
    test("w3.org → rfc", () => {
        expect(classifyUrl("https://www.w3.org/TR/json-ld/")).toBe("rfc");
    });
    test("stackoverflow.com → so-se", () => {
        expect(classifyUrl("https://stackoverflow.com/questions/12345")).toBe("so-se");
    });
    test("stackexchange.com → so-se", () => {
        expect(classifyUrl("https://cs.stackexchange.com/questions/12345")).toBe("so-se");
    });
    test("youtube.com → talk", () => {
        expect(classifyUrl("https://www.youtube.com/watch?v=abc")).toBe("talk");
    });
    test("youtu.be → talk", () => {
        expect(classifyUrl("https://youtu.be/abc")).toBe("talk");
    });
    test("github.com → blog", () => {
        expect(classifyUrl("https://github.com/some/repo")).toBe("blog");
    });
    test("example.com → blog", () => {
        expect(classifyUrl("https://example.com/post/foo")).toBe("blog");
    });
    test("malformed URL → other", () => {
        expect(classifyUrl("not-a-url")).toBe("other");
    });
});
describe("extractUrlsFromWindow", () => {
    const content = [
        "Line 0: preamble",
        "Line 1: HC-1 is defined here",
        "Line 2: see [Pearl 2009](https://doi.org/10.1017/CBO9780511803161)",
        "Line 3: also https://arxiv.org/abs/2401.00001",
        "Line 4: unrelated",
        "Line 100: far away SD-1 https://example.com/far",
    ].join("\n");
    test("returns empty array when concept ID not found", () => {
        expect(extractUrlsFromWindow(content, "HC-99", 5)).toHaveLength(0);
    });
    test("finds markdown link URL near concept", () => {
        const entries = extractUrlsFromWindow(content, "HC-1", 5);
        const urls = entries.map((e) => e.url);
        expect(urls).toContain("https://doi.org/10.1017/CBO9780511803161");
    });
    test("classifies doi.org as paper", () => {
        const entries = extractUrlsFromWindow(content, "HC-1", 5);
        const doi = entries.find((e) => e.url.startsWith("https://doi.org/"));
        expect(doi?.kind).toBe("paper");
    });
    test("captures markdown link title", () => {
        const entries = extractUrlsFromWindow(content, "HC-1", 5);
        const doi = entries.find((e) => e.url.startsWith("https://doi.org/"));
        expect(doi?.title).toBe("Pearl 2009");
    });
    test("finds bare URL near concept", () => {
        const entries = extractUrlsFromWindow(content, "HC-1", 5);
        const urls = entries.map((e) => e.url);
        expect(urls).toContain("https://arxiv.org/abs/2401.00001");
    });
    test("bare URL has empty title", () => {
        const entries = extractUrlsFromWindow(content, "HC-1", 5);
        const arxiv = entries.find((e) => e.url.startsWith("https://arxiv.org/"));
        expect(arxiv?.title).toBe("");
    });
    test("excludes URL too far from concept (small window)", () => {
        // SD-1 is on line 5 (index 5); HC-1 is on line 1 (index 1).
        // With windowLines=2, SD-1 at line 5 should NOT capture the HC-1 URLs.
        const entries = extractUrlsFromWindow(content, "SD-1", 1);
        const urls = entries.map((e) => e.url);
        expect(urls).not.toContain("https://doi.org/10.1017/CBO9780511803161");
        expect(urls).toContain("https://example.com/far");
    });
    test("deduplicates repeated URLs", () => {
        const repeated = [
            "HC-2 intro",
            "https://doi.org/10.1/dup https://doi.org/10.1/dup",
        ].join("\n");
        const entries = extractUrlsFromWindow(repeated, "HC-2", 5);
        const urls = entries.map((e) => e.url);
        expect(urls.filter((u) => u === "https://doi.org/10.1/dup")).toHaveLength(1);
    });
});
describe("audit() integration", () => {
    test("returns a valid AuditResult shape", () => {
        const result = audit();
        expect(result.schema).toBe("external-anchor-coverage-v1");
        expect(typeof result.generated).toBe("string");
        expect(typeof result.totalConcepts).toBe("number");
        expect(typeof result.anchored).toBe("number");
        expect(typeof result.pending).toBe("number");
        expect(Array.isArray(result.concepts)).toBe(true);
    });
    test("anchored + pending == totalConcepts", () => {
        const result = audit();
        expect(result.anchored + result.pending).toBe(result.totalConcepts);
    });
    test("every concept has required fields", () => {
        const result = audit();
        for (const c of result.concepts) {
            expect(typeof c.id).toBe("string");
            expect(c.id.length).toBeGreaterThan(0);
            expect(typeof c.conceptClass).toBe("string");
            expect(typeof c.source).toBe("string");
            expect(["anchored", "anchor-pending"]).toContain(c.status);
            expect(Array.isArray(c.anchors)).toBe(true);
        }
    });
    test("anchored status iff anchors array is non-empty", () => {
        const result = audit();
        for (const c of result.concepts) {
            if (c.status === "anchored") {
                expect(c.anchors.length).toBeGreaterThan(0);
            }
            else {
                expect(c.anchors).toHaveLength(0);
            }
        }
    });
    test("returns at least one concept", () => {
        const result = audit();
        expect(result.totalConcepts).toBeGreaterThan(0);
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
    test("returns 2 when --out has no value", () => {
        expect(main(["--out"])).toBe(2);
    });
});
