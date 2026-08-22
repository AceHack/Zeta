#!/usr/bin/env bun
// audit-section-33-migration-xrefs.ts — detect dead xrefs to migrated archive files
//
// 081KRMEXM0008QG0R000K25MXS Slice B.1 scanner. Mechanizes the dead-xref class Codex P2 caught on
// PR #3513 (Riven section-33 archive migration). The migration pattern moves
// files from docs/research/<basename> to memory/<persona>/conversations/<basename>
// but does not auto-update backlinks. Live-nav surfaces (rules, backlog rows,
// memory feedback files) accumulate dead xrefs silently.
//
// This script walks live-nav surfaces and, for each docs/research/<basename>
// reference, checks whether <basename> has been migrated. If migrated, reports
// a stale-xref candidate with the canonical new path.
//
// Scope (Slice B.1 — detect-only scanner):
//
//   - Walks .claude/rules/, .claude/agents/, .claude/commands/, .claude/skills/
//   - Walks memory/*.md (top-level memory files; NOT persona folders — those
//     are migrated archives + may carry their own provenance trail)
//   - Walks docs/backlog/
//   - Walks repo-root *.md (CLAUDE.md, AGENTS.md, README.md, etc.)
//
// Out of scope (excluded surfaces — frozen historical archives):
//
//   - docs/history/pr-reviews/** (frozen PR-review snapshots)
//   - docs/hygiene-history/ticks/** (frozen tick shards)
//   - docs/pr-discussions/** (frozen PR-discussion archives)
//   - docs/research/** (sibling migration candidates; internal xrefs are provenance trail)
//   - memory/<persona>/**/conversations/** (migrated archives — internal xrefs are provenance trail)
//   - references/prior-art/** (other people's code; gitignored)
//
// Usage:
//
//   bun src/Core.TypeScript/hygiene/audit-section-33-migration-xrefs.ts                # detect-only
//   bun src/Core.TypeScript/hygiene/audit-section-33-migration-xrefs.ts --report PATH  # write markdown report
//   bun src/Core.TypeScript/hygiene/audit-section-33-migration-xrefs.ts --enforce      # exit non-zero on findings
//
// Exit codes:
//
//   0   no findings, OR detect-only mode (default)
//   1   findings present AND --enforce flag set (CI gate)
//   64  argument error
//
// Composes with: audit-rule-cross-refs.ts (template), 081KRMEXM0008QG0R003FZNK3E (sibling lint pattern),
// 081KRMEXM0008QG0R000K25MXS (parent row).

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";


const LIVE_NAV_SURFACES = [".claude/rules", ".claude/agents", ".claude/commands", ".claude/skills", "memory", "docs/backlog"];
const ROOT_MD = readdirSync(".").filter(f => f.endsWith(".md"));

type AuditExitCode = 0 | 1 | 64;

interface Args {
    readonly report: string | null;
    readonly enforce: boolean;
}

interface DeadXref {
    readonly fromFile: string;
    readonly lineNumber: number;
    readonly basename: string;
    readonly persona: string;
    readonly newPath: string;
    readonly line: string;
}

interface AuditResult {
    readonly migratedFilesIndexed: number;
    readonly surfacesScanned: number;
    readonly deadXrefs: DeadXref[];
}

function parseArgs(argv: string[]): { kind: "args"; args: Args } | { kind: "error"; message: string } {
    let report: string | null = null;
    let enforce = false;
    let i = 0;
    while (i < argv.length) {
        const a = argv[i]!;
        if (a === "--report") {
            const next = argv[i + 1];
            if (!next) return { kind: "error", message: "--report requires a path" };
            report = next;
            i += 2;
        } else if (a === "--enforce") {
            enforce = true;
            i += 1;
        } else {
            return { kind: "error", message: `Unknown argument: ${a}` };
        }
    }
    return { kind: "args", args: { report, enforce } };
}

interface MigratedFileInfo {
    readonly persona: string;
    readonly newPath: string;
}

function indexMigratedFiles(): Map<string, MigratedFileInfo> {
    const index = new Map<string, MigratedFileInfo>();
    const memoryDir = "memory";
    if (!existsSync(memoryDir)) return index;

    function findConversationsIn(dir: string, persona: string) {
        const items = readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = join(dir, item.name);
            if (item.isDirectory()) {
                if (item.name === "conversations") {
                    for (const file of readdirSync(fullPath)) {
                        if (!file.endsWith(".md")) continue;
                        index.set(file, {
                            persona,
                            newPath: join(fullPath, file).replace(/\\/g, "/"),
                        });
                    }
                } else {
                    findConversationsIn(fullPath, persona);
                }
            }
        }
    }

    const items = readdirSync(memoryDir).filter((item) => {
        const full = join(memoryDir, item);
        return existsSync(full) && statSync(full).isDirectory();
    });

    for (const item of items) {
        if (item === "observed-phenomena" || item === "architectural-intent-guesses") {
            continue;
        }
        findConversationsIn(join(memoryDir, item), item);
    }

    return index;
}


// Walk a directory recursively, returning .md file paths
function walkMd(dir: string): string[] {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
    const results: string[] = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const full = join(dir, entry);
        let st;
        try {
            st = statSync(full);
        } catch {
            continue;
        }
        if (st.isDirectory()) {
            results.push(...walkMd(full));
        } else if (st.isFile() && entry.endsWith(".md")) {
            results.push(full);
        }
    }
    return results;
}

function collectLiveNavFiles(): string[] {
    const files: string[] = [];

    for (const subdir of LIVE_NAV_SURFACES) {
        if (subdir === "memory") {
            // memory/ — top-level only; explicitly exclude all subdirectories (migrated archives)
            if (!existsSync(subdir)) continue;
            for (const entry of readdirSync(subdir)) {
                const full = join(subdir, entry);
                let st;
                try {
                    st = statSync(full);
                } catch {
                    continue;
                }
                if (st.isFile() && entry.endsWith(".md")) {
                    files.push(full);
                }
            }
        } else if (subdir === "docs/backlog") {
            files.push(...walkMd(subdir));
        } else {
            // .claude/rules, .claude/agents, .claude/commands, .claude/skills
            files.push(...walkMd(subdir));
        }
    }

    // Root .md files
    for (const f of ROOT_MD) {
        if (existsSync(f)) files.push(f);
    }

    return files.sort();
}

// Find docs/research/<basename> references in a file, where <basename> is
// a key in the migrated index. Returns lines with their 1-indexed line numbers.
function findDeadXrefs(filePath: string, migratedIndex: Map<string, MigratedFileInfo>): DeadXref[] {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const found: DeadXref[] = [];

    // Match docs/research/<basename> where basename ends in .md
    const pattern = /docs\/research\/([^\s`)"'<>\[\]]+\.md)/g;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(line)) !== null) {
            const basename = m[1]!;
            const info = migratedIndex.get(basename);
            if (info !== undefined) {
                found.push({
                    fromFile: filePath,
                    lineNumber: i + 1,
                    basename,
                    persona: info.persona,
                    newPath: info.newPath,
                    line: line.trim().slice(0, 200),
                });
            }
        }
    }
    return found;
}

function audit(): AuditResult {
    const migratedIndex = indexMigratedFiles();
    const liveNavFiles = collectLiveNavFiles();
    const deadXrefs: DeadXref[] = [];
    for (const f of liveNavFiles) {
        deadXrefs.push(...findDeadXrefs(f, migratedIndex));
    }
    return {
        migratedFilesIndexed: migratedIndex.size,
        surfacesScanned: liveNavFiles.length,
        deadXrefs,
    };
}

function renderReport(result: AuditResult, now: Date): string {
    const lines: string[] = [];
    lines.push("# Section-33 migration dead-xref audit");
    lines.push("");
    lines.push(`Generated: ${now.toISOString()}`);
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- Migrated files indexed: ${result.migratedFilesIndexed}`);
    lines.push(`- Live-nav .md files scanned: ${result.surfacesScanned}`);
    lines.push(`- Dead xrefs found: ${result.deadXrefs.length}`);
    lines.push("");

    if (result.deadXrefs.length === 0) {
        lines.push("_No dead xrefs found._");
        lines.push("");
        return lines.join("\n");
    }

    // Group by persona
    const byPersona = new Map<string, DeadXref[]>();
    for (const xref of result.deadXrefs) {
        const list = byPersona.get(xref.persona) ?? [];
        list.push(xref);
        byPersona.set(xref.persona, list);
    }

    lines.push("## By persona");
    lines.push("");
    lines.push("| Persona | Dead xrefs |");
    lines.push("|---|---|");
    for (const [persona, xrefs] of [...byPersona.entries()].sort()) {
        lines.push(`| ${persona} | ${xrefs.length} |`);
    }
    lines.push("");

    lines.push("## Detail");
    lines.push("");
    for (const [persona, xrefs] of [...byPersona.entries()].sort()) {
        lines.push(`### ${persona}`);
        lines.push("");
        for (const x of xrefs) {
            lines.push(`- \`${relative(".", x.fromFile)}:${x.lineNumber}\` -> \`docs/research/${x.basename}\` (should be \`${x.newPath}\`)`);
        }
        lines.push("");
    }
    return lines.join("\n");
}

function main(argv: string[]): AuditExitCode {
    const parsed = parseArgs(argv);
    if (parsed.kind === "error") {
        console.error(`error: ${parsed.message}`);
        return 64;
    }

    const result = audit();
    const report = renderReport(result, new Date());

    if (parsed.args.report) {
        writeFileSync(parsed.args.report, report);
        console.log(`wrote ${parsed.args.report}`);
    } else {
        console.log(report);
    }

    if (parsed.args.enforce && result.deadXrefs.length > 0) {
        console.error(`error: ${result.deadXrefs.length} dead xref(s) found; --enforce flag set`);
        return 1;
    }
    return 0;
}

if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}

export { audit, collectLiveNavFiles, findDeadXrefs, indexMigratedFiles, renderReport };
