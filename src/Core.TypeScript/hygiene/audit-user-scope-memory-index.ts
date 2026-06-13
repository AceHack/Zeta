#!/usr/bin/env bun
// audit-user-scope-memory-index.ts — detect bloat in the user-scope MEMORY.md.
//
// Mechanizes B-0517 Phase 2 (MEMORY.md index audit) — parallel in shape to
// audit-rule-cross-refs.ts. See B-0517 for the empirical state that prompted
// this tool: 242 lines / 66KB / 237 entries, ~15% past the cold-boot cutoff,
// avg entry size 275 chars vs 200-char guidance.
//
// What this does:
//
//   - Reads the user-scope `~/.claude/projects/<slug>/memory/MEMORY.md` index
//   - Counts total lines / bytes / entries
//   - Flags entries exceeding the 200-char guidance
//   - Computes truncation risk (lines past 200 are silently dropped at fast-path)
//
// Out of scope:
//
//   Bulk-trim execution — this tool is detect-only. B-0517 Phase 1 is the
//   one-time bulk cleanup; this Phase 2 tool prevents recurrence by surfacing
//   the bloat metrics for human / Otto triage.
//
// Usage:
//
//   bun tools/hygiene/audit-user-scope-memory-index.ts                # detect-only
//   bun tools/hygiene/audit-user-scope-memory-index.ts --report PATH  # write markdown report
//   bun tools/hygiene/audit-user-scope-memory-index.ts --memory PATH  # override MEMORY.md location
//
// Exit codes:
//
//   0   always (detect-only; no enforcement; humans triage bloat)
//   64  argument error
//   128 MEMORY.md not found
//
// DST-friendliness:
//
//   Read-only audit. The "Generated" timestamp in markdown reports is the
//   only non-deterministic surface. Per `typescript.md` universal-DST gate.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const COLD_BOOT_CUTOFF_LINES = 200;
const ENTRY_LENGTH_LIMIT_CHARS = 200;

type AuditExitCode = 0 | 64 | 128;

interface Args {
    readonly report: string | null;
    readonly memoryPath: string | null;
}

interface BloatEntry {
    readonly lineNumber: number;
    readonly chars: number;
    readonly preview: string;
}

interface AuditResult {
    readonly memoryPath: string;
    readonly totalLines: number;
    readonly totalBytes: number;
    readonly totalEntries: number;
    readonly avgEntryChars: number;
    readonly entriesOverLimit: number;
    readonly bloatEntries: BloatEntry[]; // top 10 by char count
    readonly linesPastCutoff: number;
    readonly truncationRisk: boolean;
}

function defaultMemoryPath(): string {
    const home = process.env.HOME ?? homedir();
    return join(home, ".claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/MEMORY.md");
}

function parseArgs(argv: string[]): { kind: "args"; args: Args } | { kind: "error"; message: string } {
    let report: string | null = null;
    let memoryPath: string | null = null;
    let i = 0;
    while (i < argv.length) {
        const a = argv[i]!;
        if (a === "--report") {
            const next = argv[i + 1];
            if (!next) return { kind: "error", message: "--report requires a path" };
            report = next;
            i += 2;
        } else if (a === "--memory") {
            const next = argv[i + 1];
            if (!next) return { kind: "error", message: "--memory requires a path" };
            memoryPath = next;
            i += 2;
        } else {
            return { kind: "error", message: `Unknown argument: ${a}` };
        }
    }
    return { kind: "args", args: { report, memoryPath } };
}

function audit(memoryPath: string): AuditResult {
    const content = readFileSync(memoryPath, "utf8");
    const lines = content.split("\n");
    const totalLines = lines.length;
    const totalBytes = Buffer.byteLength(content, "utf8");

    const bloat: BloatEntry[] = [];
    let entryCount = 0;
    let entryCharsTotal = 0;
    let overLimitCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!line.startsWith("- [")) continue;
        entryCount++;
        const chars = line.length;
        entryCharsTotal += chars;
        if (chars > ENTRY_LENGTH_LIMIT_CHARS) {
            overLimitCount++;
            bloat.push({
                lineNumber: i + 1,
                chars,
                preview: line.slice(0, 100),
            });
        }
    }

    const top10 = bloat.sort((a, b) => b.chars - a.chars).slice(0, 10);
    const linesPastCutoff = Math.max(0, totalLines - COLD_BOOT_CUTOFF_LINES);

    return {
        memoryPath,
        totalLines,
        totalBytes,
        totalEntries: entryCount,
        avgEntryChars: entryCount === 0 ? 0 : Math.round(entryCharsTotal / entryCount),
        entriesOverLimit: overLimitCount,
        bloatEntries: top10,
        linesPastCutoff,
        truncationRisk: totalLines > COLD_BOOT_CUTOFF_LINES,
    };
}

function renderReport(result: AuditResult, now: Date): string {
    const lines: string[] = [];
    lines.push("# user-scope MEMORY.md bloat audit");
    lines.push("");
    lines.push(`Generated: ${now.toISOString()}`);
    lines.push(`Source: \`${result.memoryPath}\``);
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- Total lines: ${result.totalLines}`);
    lines.push(`- Total bytes: ${result.totalBytes.toLocaleString()}`);
    lines.push(`- Total entries: ${result.totalEntries}`);
    lines.push(`- Average entry size: ${result.avgEntryChars} chars`);
    lines.push(`- Entries over ${ENTRY_LENGTH_LIMIT_CHARS} chars: ${result.entriesOverLimit}`);
    lines.push(`- Cold-boot cutoff: line ${COLD_BOOT_CUTOFF_LINES}`);
    lines.push(`- Lines past cutoff (truncation risk): ${result.linesPastCutoff}`);
    lines.push(`- Truncation risk: ${result.truncationRisk ? "YES" : "no"}`);
    lines.push("");
    if (result.bloatEntries.length === 0) {
        lines.push("## Top bloat entries");
        lines.push("");
        lines.push("_None — all entries under the limit._");
    } else {
        lines.push("## Top 10 bloat entries (sorted by char count)");
        lines.push("");
        lines.push("| Line | Chars | Preview |");
        lines.push("|------|-------|---------|");
        for (const e of result.bloatEntries) {
            const preview = e.preview.replace(/\|/g, "\\|");
            lines.push(`| ${e.lineNumber} | ${e.chars} | ${preview}... |`);
        }
    }
    lines.push("");
    lines.push("## Cleanup procedure");
    lines.push("");
    lines.push("Per B-0517 Phase 1: for each over-limit entry,");
    lines.push("");
    lines.push("1. Read the underlying topic file (`memory/<filename>`)");
    lines.push("2. Verify the topic file's body + frontmatter `description:` contain the full detail");
    lines.push("3. Rewrite the MEMORY.md entry to a short hook (~50-100 chars):");
    lines.push("   `- [Short Title](filename.md) — one-line hook.`");
    lines.push("");
    return lines.join("\n");
}

function main(argv: string[]): AuditExitCode {
    const parsed = parseArgs(argv);
    if (parsed.kind === "error") {
        console.error(`error: ${parsed.message}`);
        return 64;
    }

    const memoryPath = parsed.args.memoryPath ?? defaultMemoryPath();
    if (!existsSync(memoryPath)) {
        console.error(`MEMORY.md not found at ${memoryPath}`);
        return 128;
    }

    const result = audit(memoryPath);
    const report = renderReport(result, new Date());

    if (parsed.args.report) {
        writeFileSync(parsed.args.report, report);
        console.log(`wrote ${parsed.args.report}`);
    } else {
        console.log(report);
    }

    return 0;
}

if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}

export { audit, renderReport };
