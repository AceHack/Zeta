// audit-user-scope-memory-index.test.ts — basic correctness tests for the
// MEMORY.md bloat auditor. Uses temp files; doesn't touch the real user-scope
// memory directory.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit, renderReport } from "./audit-user-scope-memory-index.ts";

function withTempMemory(content: string, fn: (path: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), "audit-memory-test-"));
    const path = join(dir, "MEMORY.md");
    try {
        writeFileSync(path, content);
        fn(path);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe("audit", () => {
    test("counts a tiny well-formed index correctly", () => {
        const content = [
            "# header",
            "",
            "- [Title A](a.md) — short hook.",
            "- [Title B](b.md) — short hook.",
            "",
        ].join("\n");
        withTempMemory(content, (path) => {
            const r = audit(path);
            expect(r.totalEntries).toBe(2);
            expect(r.entriesOverLimit).toBe(0);
            expect(r.truncationRisk).toBe(false);
            expect(r.linesPastCutoff).toBe(0);
        });
    });

    test("flags over-limit entries", () => {
        const longHook = "x".repeat(300);
        const content = [
            "- [Short Entry](a.md) — fine.",
            `- [Bloat Entry](b.md) — ${longHook}`,
        ].join("\n");
        withTempMemory(content, (path) => {
            const r = audit(path);
            expect(r.totalEntries).toBe(2);
            expect(r.entriesOverLimit).toBe(1);
            expect(r.bloatEntries).toHaveLength(1);
            expect(r.bloatEntries[0]!.chars).toBeGreaterThan(200);
        });
    });

    test("computes truncation risk when over 200 lines", () => {
        const lines: string[] = [];
        for (let i = 0; i < 250; i++) lines.push(`- [Entry ${i}](e${i}.md) — hook.`);
        const content = lines.join("\n");
        withTempMemory(content, (path) => {
            const r = audit(path);
            expect(r.totalEntries).toBe(250);
            expect(r.truncationRisk).toBe(true);
            expect(r.linesPastCutoff).toBeGreaterThan(0);
        });
    });

    test("only counts lines starting with `- [` as entries", () => {
        const content = [
            "# Heading",
            "",
            "Some prose paragraph.",
            "- [Entry A](a.md) — hook.",
            "- Just a regular bullet without bracket",
            "- [Entry B](b.md) — hook.",
            "",
        ].join("\n");
        withTempMemory(content, (path) => {
            const r = audit(path);
            expect(r.totalEntries).toBe(2);
        });
    });

    test("returns 0 entries for a content-free index", () => {
        const content = "# MEMORY.md\n\nNo entries yet.\n";
        withTempMemory(content, (path) => {
            const r = audit(path);
            expect(r.totalEntries).toBe(0);
            expect(r.avgEntryChars).toBe(0);
        });
    });
});

describe("renderReport", () => {
    test("renders a clean report with no bloat", () => {
        const fixed = new Date("2026-05-14T00:00:00Z");
        const md = renderReport(
            {
                memoryPath: "/tmp/MEMORY.md",
                totalLines: 50,
                totalBytes: 1500,
                totalEntries: 10,
                avgEntryChars: 80,
                entriesOverLimit: 0,
                bloatEntries: [],
                linesPastCutoff: 0,
                truncationRisk: false,
            },
            fixed,
        );
        expect(md).toContain("Total lines: 50");
        expect(md).toContain("Truncation risk: no");
        expect(md).toContain("_None — all entries under the limit._");
    });

    test("renders the bloat table for over-limit entries", () => {
        const fixed = new Date("2026-05-14T00:00:00Z");
        const md = renderReport(
            {
                memoryPath: "/tmp/MEMORY.md",
                totalLines: 300,
                totalBytes: 70_000,
                totalEntries: 200,
                avgEntryChars: 280,
                entriesOverLimit: 80,
                bloatEntries: [
                    { lineNumber: 5, chars: 620, preview: "- [Long entry](a.md) — ..." },
                ],
                linesPastCutoff: 100,
                truncationRisk: true,
            },
            fixed,
        );
        expect(md).toContain("Truncation risk: YES");
        expect(md).toContain("Lines past cutoff (truncation risk): 100");
        expect(md).toContain("| 5 | 620 |");
    });
});
