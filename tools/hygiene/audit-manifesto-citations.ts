#!/usr/bin/env bun
// audit-manifesto-citations.ts — count manifesto citations across the repo
//
// Mechanizes B-0525 "concrete next step #1": define mechanical adoption signals.
// Produces a citation-count snapshot used by the constitutional-promotion gate
// (per docs/governance/MANIFESTO.md V2.1 + B-0524 verbatim-extraction follow-up).
//
// Scope (first slice — count-only):
//
//   - Scan committed substrate surfaces (rules, skills, agents, governance,
//     trajectories, agendas, research, backlog, memory, hygiene-history)
//   - Count references to docs/governance/MANIFESTO.md (path-form + manifesto-
//     name-form + V1/V2/V2.1 version-tag-form + constraint-N-form)
//   - Report per-surface + total counts
//
// Out of scope (later slices, future B-0525 children):
//
//   - Time-series tracking (citation count over weeks/months — needs persistent
//     snapshot file)
//   - Cross-AI citation detection in external surfaces (Twitter, ChatGPT, etc;
//     requires external substrate ingestion)
//   - PR-description citation count from gh api (requires GraphQL pagination)
//   - Mechanical adoption-gate decision logic (this script reports signals;
//     the gate decision is the human maintainer's call per B-0525)
//
// Usage:
//
//   bun tools/hygiene/audit-manifesto-citations.ts             # detect-only, exit 0 always
//   bun tools/hygiene/audit-manifesto-citations.ts --report PATH  # write markdown report
//   bun tools/hygiene/audit-manifesto-citations.ts --json         # machine-readable
//
// Exit codes:
//
//   0   always (detect-only; no enforcement; constitutional-promotion is the
//       human maintainer's call per B-0525 substrate-honest framing)
//   64  argument error
//
// DST-friendliness:
//
//   Read-only audit. "Generated" timestamp in markdown is the only non-
//   deterministic surface. Per `typescript.md` universal-DST gate.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MANIFESTO_PATH = "docs/governance/MANIFESTO.md";

const SURFACES: ReadonlyArray<{ name: string; dir: string; recurse: boolean }> = [
    { name: "rules", dir: ".claude/rules", recurse: false },
    { name: "skills", dir: ".claude/skills", recurse: true },
    { name: "agents", dir: ".claude/agents", recurse: true },
    { name: "commands", dir: ".claude/commands", recurse: true },
    { name: "governance", dir: "docs/governance", recurse: true },
    { name: "trajectories", dir: "docs/trajectories", recurse: true },
    { name: "agendas", dir: "docs/agendas", recurse: true },
    { name: "research", dir: "docs/research", recurse: false },
    { name: "backlog", dir: "docs/backlog", recurse: true },
    { name: "memory", dir: "memory", recurse: true },
    { name: "hygiene-history", dir: "docs/hygiene-history", recurse: true },
];

type AuditExitCode = 0 | 64;

interface Args {
    readonly report: string | null;
    readonly json: boolean;
}

interface Citation {
    readonly file: string;
    readonly surface: string;
    readonly form: CitationForm;
    readonly snippet: string;
}

type CitationForm = "path" | "name" | "version-tag" | "constraint-N";

interface SurfaceResult {
    readonly surface: string;
    readonly filesScanned: number;
    readonly filesWithCitation: number;
    readonly citationCount: number;
    readonly byForm: Readonly<Record<CitationForm, number>>;
}

interface AuditResult {
    readonly surfaces: SurfaceResult[];
    readonly totalCitations: number;
    readonly totalFilesWithCitation: number;
    readonly totalFilesScanned: number;
    readonly citations: Citation[];
}

function parseArgs(argv: string[]): { kind: "args"; args: Args } | { kind: "error"; message: string } {
    let report: string | null = null;
    let json = false;
    let i = 0;
    while (i < argv.length) {
        const a = argv[i]!;
        if (a === "--report") {
            const next = argv[i + 1];
            if (!next) return { kind: "error", message: "--report requires a path" };
            report = next;
            i += 2;
        } else if (a === "--json") {
            json = true;
            i += 1;
        } else {
            return { kind: "error", message: `Unknown argument: ${a}` };
        }
    }
    return { kind: "args", args: { report, json } };
}

// Citation patterns — priority order; earlier-priority matches win for overlaps.
const PATH_PATTERN = /\b(?:docs\/governance\/)?MANIFESTO\.md\b/gi;
const VERSION_PATTERN = /\bManifesto\s+V[12](?:\.[0-9]+)?\b/gi;
const NAME_PATTERN = /\b(?:Root\s+Discipline\s+)?[Mm]anifesto\b/g;
const CONSTRAINT_PATTERN = /\b[Cc]onstraint\s+(?:#)?(?:1[0-1]|[1-9])\b/g;

function scanFile(filePath: string, surface: string, content: string): Citation[] {
    const spans: Array<{ start: number; end: number; form: CitationForm }> = [];

    const passes: ReadonlyArray<readonly [RegExp, CitationForm]> = [
        [PATH_PATTERN, "path"],
        [VERSION_PATTERN, "version-tag"],
        [NAME_PATTERN, "name"],
        [CONSTRAINT_PATTERN, "constraint-N"],
    ];

    for (const [re, form] of passes) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
            const start = m.index;
            const end = m.index + m[0].length;
            if (spans.some((s) => start < s.end && end > s.start)) continue;
            spans.push({ start, end, form });
        }
    }

    spans.sort((a, b) => a.start - b.start);
    const cites: Citation[] = [];
    for (const s of spans) {
        const lineStart = content.lastIndexOf("\n", s.start) + 1;
        const lineEnd = content.indexOf("\n", s.end);
        const snippet = content
            .slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
            .trim()
            .slice(0, 120);
        cites.push({ file: filePath, surface, form: s.form, snippet });
    }

    return cites;
}

function listMarkdownFiles(dir: string, recurse: boolean): string[] {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (recurse) out.push(...listMarkdownFiles(full, true));
        } else if (entry.endsWith(".md")) {
            out.push(full);
        }
    }
    return out;
}

function audit(): AuditResult {
    const surfaces: SurfaceResult[] = [];
    const allCitations: Citation[] = [];
    let totalFilesScanned = 0;
    let totalFilesWithCitation = 0;
    let totalCitations = 0;

    for (const { name, dir, recurse } of SURFACES) {
        const files = listMarkdownFiles(dir, recurse);
        let filesWithCitation = 0;
        let citationCount = 0;
        const byForm: Record<CitationForm, number> = { path: 0, name: 0, "version-tag": 0, "constraint-N": 0 };

        for (const f of files) {
            if (f === MANIFESTO_PATH) continue;
            const content = readFileSync(f, "utf8");
            const cites = scanFile(f, name, content);
            if (cites.length > 0) {
                filesWithCitation++;
                citationCount += cites.length;
                for (const c of cites) byForm[c.form]++;
                allCitations.push(...cites);
            }
        }

        surfaces.push({
            surface: name,
            filesScanned: files.length,
            filesWithCitation,
            citationCount,
            byForm,
        });

        totalFilesScanned += files.length;
        totalFilesWithCitation += filesWithCitation;
        totalCitations += citationCount;
    }

    return {
        surfaces,
        totalCitations,
        totalFilesWithCitation,
        totalFilesScanned,
        citations: allCitations,
    };
}

function renderReport(result: AuditResult, now: Date): string {
    const lines: string[] = [];
    lines.push("# Manifesto citation audit");
    lines.push("");
    lines.push(`Generated: ${now.toISOString()}`);
    lines.push("");
    lines.push(`Target: \`${MANIFESTO_PATH}\``);
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- Surfaces scanned: ${result.surfaces.length}`);
    lines.push(`- Files scanned: ${result.totalFilesScanned}`);
    lines.push(`- Files with citation: ${result.totalFilesWithCitation}`);
    lines.push(`- Total citations: ${result.totalCitations}`);
    lines.push("");
    lines.push("## Per-surface breakdown");
    lines.push("");
    lines.push("| Surface | Files | With Citation | Citations | path | name | version-tag | constraint-N |");
    lines.push("|---------|-------|---------------|-----------|------|------|-------------|--------------|");
    for (const s of result.surfaces) {
        lines.push(
            `| \`${s.surface}\` | ${s.filesScanned} | ${s.filesWithCitation} | ${s.citationCount} | ${s.byForm.path} | ${s.byForm.name} | ${s.byForm["version-tag"]} | ${s.byForm["constraint-N"]} |`,
        );
    }
    lines.push("");
    lines.push("## Citation forms");
    lines.push("");
    lines.push("- **path**: direct `MANIFESTO.md` path reference (strongest signal — explicit link)");
    lines.push("- **version-tag**: `Manifesto V1` / `Manifesto V2` / `Manifesto V2.1` (versioning awareness)");
    lines.push("- **name**: `manifesto` / `Manifesto` / `Root Discipline Manifesto` (substrate-vocabulary adoption)");
    lines.push("- **constraint-N**: `Constraint 1`..`Constraint 11` (specific-clause citation; finest grain)");
    lines.push("");
    lines.push("## Substrate-honest framing");
    lines.push("");
    lines.push("This audit reports **signals**, not gate decisions. Per B-0525:");
    lines.push("constitutional-promotion is the human maintainer's call, gated on critical-mass");
    lines.push("adoption. Otto-CLI's role is wiring the measurement infrastructure + citing the");
    lines.push("manifesto in load-bearing decisions; promotion-readiness emerges from accumulated");
    lines.push("signal over time, not from a single snapshot.");
    lines.push("");
    lines.push("Composes with `tools/hygiene/audit-rule-cross-refs.ts` pattern (count-then-classify");
    lines.push("discipline). False positives (e.g., 'Constraint N' from non-manifesto contexts)");
    lines.push("are bounded by per-surface visibility — the human-classifiable layer is the");
    lines.push("snippet column in the JSON output.");
    lines.push("");
    return lines.join("\n");
}

function main(argv: string[]): AuditExitCode {
    const parsed = parseArgs(argv);
    if (parsed.kind === "error") {
        console.error(`error: ${parsed.message}`);
        return 64;
    }

    const result = audit();

    if (parsed.args.json) {
        console.log(JSON.stringify(result, null, 2));
        return 0;
    }

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

export { audit, listMarkdownFiles, parseArgs, renderReport, scanFile };
