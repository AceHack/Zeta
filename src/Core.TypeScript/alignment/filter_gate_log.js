#!/usr/bin/env bun
// filter_gate_log.ts — candidate-failure honesty log.
//
// 081KQ3HBZ0008QG0R002S674CG responsibility #3: candidates that fail the ethics+safety
// filter-gate are recorded as failure-data, NOT silently dropped.
// Rubber-stamping is the exact failure-mode the three-filter
// discipline exists to prevent — this tool extends that discipline
// into the ethics axis.
//
// Records pass/fail/defer decisions for candidate adoptions from
// downstream research tracks (081KQ3HBZ0008QG0R0034DHWTQ mythology, 081KQ3HBZ0008QG0R000K3NSX8 occult,
// 081KQ3HBZ0008QG0R003GTG5P2 etymology+epistemology, and any future resonance-family row).
//
// Usage:
//   bun tools/alignment/filter_gate_log.ts --record \
//     --candidate "skill:foo" --source 081KQ3HBZ0008QG0R0034DHWTQ --decision fail \
//     --rationale "Breaks retractibility — force-publishes to channel"
//
//   bun tools/alignment/filter_gate_log.ts --record \
//     --candidate "glossary:bar" --source 081KQ3HBZ0008QG0R003GTG5P2 --decision pass \
//     --rationale "Additive, git-tracked, one-commit removable" \
//     --clauses HC-1,SD-3
//
//   bun tools/alignment/filter_gate_log.ts --list
//   bun tools/alignment/filter_gate_log.ts --list --json
//   bun tools/alignment/filter_gate_log.ts --list --md
//   bun tools/alignment/filter_gate_log.ts --summary
//
// Exit codes:
//   0  Success
//   1  Validation error (missing required fields, bad decision value)
//   2  Script error / bad args
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
const VALID_DECISIONS = ["pass", "fail", "defer"];
function repoRoot() {
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
    if (result.error)
        throw new Error(`git rev-parse failed: ${result.error.message}`);
    if (result.status !== 0)
        throw new Error(`git rev-parse exited with status ${String(result.status)}`);
    return result.stdout.trim();
}
function gitUser() {
    const result = spawnSync("git", ["config", "user.name"], { encoding: "utf8" });
    if (result.error || result.status !== 0)
        return "unknown";
    return result.stdout.trim();
}
const LOG_PATH = "src/Core.TypeScript/alignment/out/filter-gate-log.jsonl";
// Tests set FILTER_GATE_LOG_PATH to a full FILE path inside a tempdir
// (NOT a directory) to avoid polluting the production ethics-decision
// log with `skill:test-entry` entries. recordEntry() will append to
// this path; pointing it at a directory yields EISDIR at write time.
export function logFilePath() {
    const override = process.env.FILTER_GATE_LOG_PATH?.trim();
    if (override !== undefined && override !== "")
        return override;
    return join(repoRoot(), LOG_PATH);
}
export function parseArgs(argv) {
    let mode = null;
    let candidate = "";
    let source = "";
    let decision = "";
    let rationale = "";
    let clauses = "";
    let json = false;
    let md = false;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] ?? "";
        if (arg === "-h" || arg === "--help")
            return { kind: "help" };
        if (arg === "--record") {
            mode = "record";
            i += 1;
            continue;
        }
        if (arg === "--list") {
            mode = "list";
            i += 1;
            continue;
        }
        if (arg === "--summary") {
            mode = "summary";
            i += 1;
            continue;
        }
        if (arg === "--json") {
            json = true;
            i += 1;
            continue;
        }
        if (arg === "--md") {
            md = true;
            i += 1;
            continue;
        }
        if (arg === "--candidate") {
            const next = argv[i + 1];
            if (next === undefined)
                return { kind: "error", message: "filter_gate_log: --candidate requires a value" };
            candidate = next;
            i += 2;
            continue;
        }
        if (arg === "--source") {
            const next = argv[i + 1];
            if (next === undefined)
                return { kind: "error", message: "filter_gate_log: --source requires a value" };
            source = next;
            i += 2;
            continue;
        }
        if (arg === "--decision") {
            const next = argv[i + 1];
            if (next === undefined)
                return { kind: "error", message: "filter_gate_log: --decision requires a value" };
            decision = next;
            i += 2;
            continue;
        }
        if (arg === "--rationale") {
            const next = argv[i + 1];
            if (next === undefined)
                return { kind: "error", message: "filter_gate_log: --rationale requires a value" };
            rationale = next;
            i += 2;
            continue;
        }
        if (arg === "--clauses") {
            const next = argv[i + 1];
            if (next === undefined)
                return { kind: "error", message: "filter_gate_log: --clauses requires a value" };
            clauses = next;
            i += 2;
            continue;
        }
        return { kind: "error", message: `filter_gate_log: unknown arg: ${arg}` };
    }
    if (mode === null)
        return { kind: "error", message: "filter_gate_log: must specify --record, --list, or --summary" };
    if (mode === "list") {
        return { kind: "args", args: { mode: "list", json, md } };
    }
    if (mode === "summary") {
        return { kind: "args", args: { mode: "summary" } };
    }
    if (candidate === "")
        return { kind: "error", message: "filter_gate_log: --candidate is required for --record" };
    if (source === "")
        return { kind: "error", message: "filter_gate_log: --source is required for --record" };
    if (decision === "")
        return { kind: "error", message: "filter_gate_log: --decision is required for --record" };
    if (!VALID_DECISIONS.includes(decision)) {
        return { kind: "error", message: `filter_gate_log: --decision must be one of: ${VALID_DECISIONS.join(", ")}` };
    }
    if (rationale === "")
        return { kind: "error", message: "filter_gate_log: --rationale is required for --record" };
    const parsedClauses = clauses === ""
        ? []
        : clauses.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
    return {
        kind: "args",
        args: {
            mode: "record",
            candidate,
            source,
            decision: decision,
            rationale,
            clauses: parsedClauses,
        },
    };
}
export function readLog(path) {
    if (!existsSync(path))
        return [];
    const content = readFileSync(path, "utf8").trim();
    if (content === "")
        return [];
    const entries = [];
    for (const line of content.split("\n")) {
        if (line.trim() === "")
            continue;
        try {
            entries.push(JSON.parse(line));
        }
        catch {
            // skip malformed lines
        }
    }
    return entries;
}
export function recordEntry(args) {
    const entry = {
        schema: "filter-gate-v1",
        timestamp: new Date().toISOString(),
        candidate: args.candidate,
        source: args.source,
        decision: args.decision,
        rationale: args.rationale,
        clauses: args.clauses,
        author: gitUser(),
    };
    const path = logFilePath();
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`);
    return entry;
}
function emitListJson(entries) {
    return `${JSON.stringify(entries, null, 2)}\n`;
}
function emitListMd(entries) {
    const lines = [];
    lines.push("# Filter-gate decision log");
    lines.push("");
    lines.push(`Total entries: **${String(entries.length)}**.`);
    lines.push("");
    if (entries.length === 0) {
        lines.push("No entries recorded yet.");
        return lines.join("\n");
    }
    lines.push("| Timestamp | Candidate | Source | Decision | Clauses | Rationale |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const e of entries) {
        const clauseStr = e.clauses.length > 0 ? e.clauses.join(", ") : "(none)";
        lines.push(`| ${e.timestamp} | ${e.candidate} | ${e.source} | **${e.decision}** | ${clauseStr} | ${e.rationale} |`);
    }
    lines.push("");
    return lines.join("\n");
}
function emitListHuman(entries) {
    const lines = [];
    lines.push(`filter-gate-log entries=${String(entries.length)}`);
    lines.push("");
    if (entries.length === 0) {
        lines.push("No entries recorded yet.");
        return lines.join("\n");
    }
    for (const e of entries) {
        const clauseStr = e.clauses.length > 0 ? ` clauses=${e.clauses.join(",")}` : "";
        lines.push(`  [${e.decision}] ${e.candidate} (source=${e.source}${clauseStr})`);
        lines.push(`         ${e.rationale}`);
        lines.push(`         ${e.timestamp} by ${e.author}`);
    }
    return lines.join("\n");
}
export function computeSummary(entries) {
    const sources = new Map();
    let pass = 0;
    let fail = 0;
    let defer = 0;
    for (const e of entries) {
        if (e.decision === "pass")
            pass += 1;
        else if (e.decision === "fail")
            fail += 1;
        else
            defer += 1;
        sources.set(e.source, (sources.get(e.source) ?? 0) + 1);
    }
    return { total: entries.length, pass, fail, defer, sources };
}
function emitSummary(summary) {
    const lines = [];
    lines.push(`filter-gate-summary total=${String(summary.total)} pass=${String(summary.pass)} fail=${String(summary.fail)} defer=${String(summary.defer)}`);
    if (summary.sources.size > 0) {
        lines.push("");
        lines.push("By source:");
        for (const [src, count] of [...summary.sources.entries()].sort((a, b) => b[1] - a[1])) {
            lines.push(`  ${src}: ${String(count)}`);
        }
    }
    return lines.join("\n");
}
const HELP = `Usage:
  filter_gate_log.ts --record --candidate NAME --source TRACK --decision pass|fail|defer --rationale TEXT [--clauses HC-1,SD-3,...]
  filter_gate_log.ts --list [--json | --md]
  filter_gate_log.ts --summary
`;
export function main(argv) {
    const parsed = parseArgs(argv);
    if (parsed.kind === "help") {
        process.stdout.write(HELP);
        return 0;
    }
    if (parsed.kind === "error") {
        process.stderr.write(`${parsed.message}\n`);
        return 1;
    }
    const { args } = parsed;
    process.chdir(repoRoot());
    if (args.mode === "record") {
        const entry = recordEntry(args);
        process.stdout.write(`recorded: [${entry.decision}] ${entry.candidate} (${entry.source})\n`);
        return 0;
    }
    if (args.mode === "list") {
        const entries = readLog(logFilePath());
        if (args.json) {
            process.stdout.write(emitListJson(entries));
        }
        else if (args.md) {
            process.stdout.write(emitListMd(entries));
        }
        else {
            process.stdout.write(`${emitListHuman(entries)}\n`);
        }
        return 0;
    }
    if (args.mode === "summary") {
        const entries = readLog(logFilePath());
        const summary = computeSummary(entries);
        process.stdout.write(`${emitSummary(summary)}\n`);
        return 0;
    }
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
