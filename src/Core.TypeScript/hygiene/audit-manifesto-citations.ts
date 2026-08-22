#!/usr/bin/env bun
// audit-manifesto-citations.ts — count manifesto citations across the repo
//
// Mechanizes 081KRHWGX0008QG0R0016T9408 "concrete next step #1": define mechanical adoption signals.
// Produces a citation-count snapshot used by the constitutional-promotion gate
// (per docs/governance/MANIFESTO.md V2.1 + 081KRHWGX0008QG0R0007FG84X verbatim-extraction follow-up).
//
// Scope (first slice — count-only):
//
//   - Scan committed substrate surfaces (rules, skills, agents, governance,
//     trajectories, agendas, research, backlog, memory, hygiene-history)
//   - Count references to docs/governance/MANIFESTO.md (path-form + manifesto-
//     name-form + V1/V2/V2.1 version-tag-form + constraint-N-form)
//   - Report per-surface + total counts
//
// Out of scope (later slices, future 081KRHWGX0008QG0R0016T9408 children):
//
//   - Time-series tracking (citation count over weeks/months — needs persistent
//     snapshot file)
//   - Cross-AI citation detection in external surfaces (Twitter, ChatGPT, etc;
//     requires external substrate ingestion)
//   - PR-description citation count from gh api (requires GraphQL pagination)
//   - Mechanical adoption-gate decision logic (this script reports signals;
//     the gate decision is the human maintainer's call per 081KRHWGX0008QG0R0016T9408)
//
// Usage:
//
//   bun src/Core.TypeScript/hygiene/audit-manifesto-citations.ts                # detect-only, exit 0 always
//   bun src/Core.TypeScript/hygiene/audit-manifesto-citations.ts --report PATH  # write markdown report
//   bun src/Core.TypeScript/hygiene/audit-manifesto-citations.ts --json         # machine-readable
//   bun src/Core.TypeScript/hygiene/audit-manifesto-citations.ts --snapshot     # write today's snapshot
//                                                                   to docs/hygiene-history/
//                                                                   manifesto-citations/YYYY-MM-DD.json
//   bun src/Core.TypeScript/hygiene/audit-manifesto-citations.ts --snapshot --date 2026-05-23  # override date
//   bun src/Core.TypeScript/hygiene/audit-manifesto-citations.ts --delta        # delta vs most-recent prior snapshot
//   bun src/Core.TypeScript/hygiene/audit-manifesto-citations.ts --delta --json # machine-readable delta
//
// Exit codes:
//
//   0   always (detect-only; no enforcement; constitutional-promotion is the
//       human maintainer's call per 081KRHWGX0008QG0R0016T9408 substrate-honest framing)
//   64  argument error
//
// DST-friendliness:
//
//   Read-only audit. "Generated" timestamp in markdown is the only non-
//   deterministic surface. Per `typescript.md` universal-DST gate.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MANIFESTO_PATH = "docs/governance/MANIFESTO.md";
const SNAPSHOT_DIR = "docs/hygiene-history/manifesto-citations";

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
    readonly snapshot: boolean;
    readonly delta: boolean;
    readonly date: string | null;
}

interface Snapshot {
    readonly date: string;
    readonly totalCitations: number;
    readonly totalFilesWithCitation: number;
    readonly totalFilesScanned: number;
    readonly surfaces: SurfaceResult[];
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
    let snapshot = false;
    let delta = false;
    let date: string | null = null;
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
        } else if (a === "--snapshot") {
            snapshot = true;
            i += 1;
        } else if (a === "--delta") {
            delta = true;
            i += 1;
        } else if (a === "--date") {
            const next = argv[i + 1];
            if (!next || !/^\d{4}-\d{2}-\d{2}$/.test(next)) {
                return { kind: "error", message: "--date requires YYYY-MM-DD" };
            }
            date = next;
            i += 2;
        } else {
            return { kind: "error", message: `Unknown argument: ${a}` };
        }
    }
    // Mode mutual-exclusion: --snapshot and --delta are mutually exclusive;
    // --report applies only to the default-report mode (not snapshot/delta).
    if (snapshot && delta) {
        return { kind: "error", message: "--snapshot and --delta are mutually exclusive" };
    }
    if (report !== null && (snapshot || delta)) {
        return { kind: "error", message: "--report is not compatible with --snapshot or --delta" };
    }
    return { kind: "args", args: { report, json, snapshot, delta, date } };
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
    lines.push("This audit reports **signals**, not gate decisions. Per 081KRHWGX0008QG0R0016T9408:");
    lines.push("constitutional-promotion is the human maintainer's call, gated on critical-mass");
    lines.push("adoption. Otto-CLI's role is wiring the measurement infrastructure + citing the");
    lines.push("manifesto in load-bearing decisions; promotion-readiness emerges from accumulated");
    lines.push("signal over time, not from a single snapshot.");
    lines.push("");
    lines.push("Composes with `src/Core.TypeScript/hygiene/audit-rule-cross-refs.ts` pattern (count-then-classify");
    lines.push("discipline). False positives (e.g., 'Constraint N' from non-manifesto contexts)");
    lines.push("are bounded by per-surface visibility — the human-classifiable layer is the");
    lines.push("snippet column in the JSON output.");
    lines.push("");
    return lines.join("\n");
}

function toSnapshot(result: AuditResult, date: string): Snapshot {
    return {
        date,
        totalCitations: result.totalCitations,
        totalFilesWithCitation: result.totalFilesWithCitation,
        totalFilesScanned: result.totalFilesScanned,
        surfaces: result.surfaces,
    };
}

function snapshotDate(now: Date): string {
    return now.toISOString().slice(0, 10);
}

function snapshotPath(date: string): string {
    return join(SNAPSHOT_DIR, `${date}.json`);
}

function writeSnapshot(snap: Snapshot): string {
    if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const path = snapshotPath(snap.date);
    writeFileSync(path, JSON.stringify(snap, null, 2) + "\n");
    return path;
}

function readSnapshot(path: string): Snapshot {
    return JSON.parse(readFileSync(path, "utf8")) as Snapshot;
}

function listSnapshots(): string[] {
    if (!existsSync(SNAPSHOT_DIR)) return [];
    return readdirSync(SNAPSHOT_DIR)
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .sort();
}

function mostRecentPriorSnapshot(currentDate: string): Snapshot | null {
    const prior = listSnapshots().filter((f) => f.slice(0, 10) < currentDate);
    if (prior.length === 0) return null;
    return readSnapshot(join(SNAPSHOT_DIR, prior[prior.length - 1]!));
}

interface SurfaceDelta {
    readonly surface: string;
    readonly filesWithCitationDelta: number;
    readonly citationCountDelta: number;
    readonly byFormDelta: Readonly<Record<CitationForm, number>>;
}

interface DeltaResult {
    readonly priorDate: string;
    readonly currentDate: string;
    readonly totalCitationsDelta: number;
    readonly totalFilesWithCitationDelta: number;
    readonly surfaceDeltas: SurfaceDelta[];
}

function computeDelta(prior: Snapshot, current: Snapshot): DeltaResult {
    const priorBySurface = new Map(prior.surfaces.map((s) => [s.surface, s]));
    const currentBySurface = new Map(current.surfaces.map((s) => [s.surface, s]));
    // Union of surface keys — preserves order of current first, then any
    // removed-in-current surfaces from prior (so removals show as negative
    // deltas instead of being silently dropped).
    const surfaceOrder: string[] = [];
    for (const cur of current.surfaces) surfaceOrder.push(cur.surface);
    for (const prv of prior.surfaces) {
        if (!currentBySurface.has(prv.surface)) surfaceOrder.push(prv.surface);
    }

    const surfaceDeltas: SurfaceDelta[] = [];
    for (const surface of surfaceOrder) {
        const cur = currentBySurface.get(surface);
        const prv = priorBySurface.get(surface);
        const curByForm = cur?.byForm ?? { path: 0, name: 0, "version-tag": 0, "constraint-N": 0 };
        const prvByForm = prv?.byForm ?? { path: 0, name: 0, "version-tag": 0, "constraint-N": 0 };
        const byFormDelta: Record<CitationForm, number> = {
            path: curByForm.path - prvByForm.path,
            name: curByForm.name - prvByForm.name,
            "version-tag": curByForm["version-tag"] - prvByForm["version-tag"],
            "constraint-N": curByForm["constraint-N"] - prvByForm["constraint-N"],
        };
        surfaceDeltas.push({
            surface,
            filesWithCitationDelta: (cur?.filesWithCitation ?? 0) - (prv?.filesWithCitation ?? 0),
            citationCountDelta: (cur?.citationCount ?? 0) - (prv?.citationCount ?? 0),
            byFormDelta,
        });
    }
    return {
        priorDate: prior.date,
        currentDate: current.date,
        totalCitationsDelta: current.totalCitations - prior.totalCitations,
        totalFilesWithCitationDelta: current.totalFilesWithCitation - prior.totalFilesWithCitation,
        surfaceDeltas,
    };
}

function renderDelta(d: DeltaResult): string {
    const lines: string[] = [];
    lines.push("# Manifesto citation delta");
    lines.push("");
    lines.push(`Prior: ${d.priorDate}`);
    lines.push(`Current: ${d.currentDate}`);
    lines.push("");
    lines.push("## Totals");
    lines.push("");
    lines.push(`- Citations delta: ${signedNum(d.totalCitationsDelta)}`);
    lines.push(`- Files-with-citation delta: ${signedNum(d.totalFilesWithCitationDelta)}`);
    lines.push("");
    lines.push("## Per-surface deltas");
    lines.push("");
    lines.push("| Surface | Δ Files w/ Citation | Δ Citations | Δ path | Δ name | Δ version-tag | Δ constraint-N |");
    lines.push("|---------|---------------------|-------------|--------|--------|---------------|----------------|");
    for (const s of d.surfaceDeltas) {
        lines.push(
            `| \`${s.surface}\` | ${signedNum(s.filesWithCitationDelta)} | ${signedNum(s.citationCountDelta)} | ${signedNum(s.byFormDelta.path)} | ${signedNum(s.byFormDelta.name)} | ${signedNum(s.byFormDelta["version-tag"])} | ${signedNum(s.byFormDelta["constraint-N"])} |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

function signedNum(n: number): string {
    return n > 0 ? `+${n}` : `${n}`;
}

function main(argv: string[]): AuditExitCode {
    const parsed = parseArgs(argv);
    if (parsed.kind === "error") {
        console.error(`error: ${parsed.message}`);
        return 64;
    }

    const result = audit();
    const now = new Date();
    const date = parsed.args.date ?? snapshotDate(now);

    if (parsed.args.snapshot) {
        const path = writeSnapshot(toSnapshot(result, date));
        console.log(`wrote snapshot ${path}`);
        return 0;
    }

    if (parsed.args.delta) {
        const prior = mostRecentPriorSnapshot(date);
        if (prior === null) {
            if (parsed.args.json) {
                console.log(
                    JSON.stringify(
                        {
                            kind: "no-prior-snapshot",
                            snapshotDir: SNAPSHOT_DIR,
                            currentDate: date,
                            message: "no prior snapshot found; run with --snapshot first to create the first baseline",
                        },
                        null,
                        2,
                    ),
                );
            } else {
                console.log("# No prior snapshot found");
                console.log("");
                console.log(`Snapshot directory: ${SNAPSHOT_DIR}`);
                console.log("Run with --snapshot first to create the first baseline.");
            }
            return 0;
        }
        const current = toSnapshot(result, date);
        const delta = computeDelta(prior, current);
        console.log(parsed.args.json ? JSON.stringify(delta, null, 2) : renderDelta(delta));
        return 0;
    }

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

export {
    audit,
    computeDelta,
    listMarkdownFiles,
    listSnapshots,
    mostRecentPriorSnapshot,
    parseArgs,
    renderDelta,
    renderReport,
    scanFile,
    signedNum,
    snapshotDate,
    snapshotPath,
    toSnapshot,
};
export type { DeltaResult, Snapshot, SurfaceDelta };
