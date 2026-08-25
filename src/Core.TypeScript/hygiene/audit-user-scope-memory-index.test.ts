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

// CodeQL `js/incomplete-sanitization` on the preview cell: it escaped `|` but not the
// BACKSLASH, so a preview whose window ends in `\` emitted `\\|` -- markdown reads that
// as a literal backslash followed by an UNESCAPED separator, and the row splits.

/**
 * The cells markdown actually sees. A `|` is escaped only when preceded by an ODD run of
 * backslashes; splitting on `" | "` would pass under both escapes and prove nothing.
 */
function markdownCells(row: string): string[] {
    const cells: string[] = [];
    let cur = "";
    let slashes = 0;
    for (const ch of row) {
        if (ch === "\\") { slashes += 1; cur += ch; continue; }
        if (ch === "|" && slashes % 2 === 0) { cells.push(cur); cur = ""; slashes = 0; continue; }
        cur += ch;
        slashes = 0;
    }
    cells.push(cur);
    return cells;
}

describe("renderReport — a preview cannot break the markdown table", () => {
    test("a backslash before a pipe stays inside its cell", () => {
        // The 100-char preview window ends with `\` immediately before a `|`.
        const hook = "x".repeat(64) + "\\" + "|" + "y".repeat(140);
        const content = ["# header", "", `- [T](a.md) \u2014 ${hook}`, ""].join("\n");
        withTempMemory(content, (path) => {
            const md = renderReport(audit(path), new Date("2026-08-24T00:00:00Z"));
            const rows = md.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| ---"));
            expect(rows.length).toBeGreaterThan(0);
            // Three columns => leading and trailing empty cell plus three, on EVERY row.
            for (const row of rows) expect(markdownCells(row).length).toBe(5);
        });
    });
});
