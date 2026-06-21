import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findClauseReferences } from "./detect-clause-drift.js";
describe("findClauseReferences", () => {
    // Use a unique OS temp directory rather than a fixed relative path so a
    // changed CWD can never make the afterEach rmSync delete an unexpected dir.
    let testDir;
    beforeEach(() => {
        testDir = mkdtempSync(join(tmpdir(), "clause-ref-"));
        writeFileSync(join(testDir, "file1.md"), "This file references HC-1 and SD-2.");
        writeFileSync(join(testDir, "file2.ts"), "This file references DIR-3.");
        writeFileSync(join(testDir, "file3.txt"), "This file has no references.");
    });
    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });
    it("finds all references to valid alignment clauses in the directory", () => {
        const references = findClauseReferences(testDir);
        expect(references.size).toBe(3);
        expect(references.get("HC-1")).toEqual([join(testDir, "file1.md")]);
        expect(references.get("SD-2")).toEqual([join(testDir, "file1.md")]);
        expect(references.get("DIR-3")).toEqual([join(testDir, "file2.ts")]);
    });
    it("ignores out-of-range clause IDs (word boundaries + bounded ranges)", () => {
        writeFileSync(join(testDir, "bad.md"), "HC-0 and SD-99 and DIR-8 and XHC-1 are not valid clause refs.");
        const references = findClauseReferences(testDir);
        expect(references.has("HC-0")).toBe(false);
        expect(references.has("SD-99")).toBe(false);
        expect(references.has("DIR-8")).toBe(false);
    });
    it("matches multiple clauses on one line without skipping (no shared lastIndex)", () => {
        const dir = mkdtempSync(join(tmpdir(), "clause-multi-"));
        try {
            writeFileSync(join(dir, "multi.md"), "HC-1 HC-2 HC-3 on one line");
            const references = findClauseReferences(dir);
            expect(references.get("HC-1")).toEqual([join(dir, "multi.md")]);
            expect(references.get("HC-2")).toEqual([join(dir, "multi.md")]);
            expect(references.get("HC-3")).toEqual([join(dir, "multi.md")]);
        }
        finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
    it("skips ignored directories (e.g. node_modules)", () => {
        const nested = join(testDir, "node_modules");
        mkdirSync(nested, { recursive: true });
        writeFileSync(join(nested, "dep.md"), "Should be ignored: HC-7.");
        const references = findClauseReferences(testDir);
        expect(references.has("HC-7")).toBe(false);
    });
});
