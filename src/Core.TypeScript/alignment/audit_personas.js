#!/usr/bin/env bun
// audit_personas.ts — per-round persona runtime observability.
//
// TypeScript+Bun port of audit_personas.sh, slice 3 of the TS+Bun
// migration. See `docs/best-practices/repo-scripting.md`.
//
// What it measures:
//
//   NOTEBOOK-LAST-ROUND   round number of the most recent entry in
//                         memory/<persona>/NOTEBOOK.md
//   NOTEBOOK-STALENESS    current round minus NOTEBOOK-LAST-ROUND
//   COMMIT-MENTIONS       count of commits in the audited range whose
//                         message body references the persona by name
//   ROSTER-COVERAGE       fraction of the roster that shows either a
//                         notebook-touch or a commit-mention this round
//
// Roster = union of `memory/<persona>/` directories.
//
// Usage:
//   bun tools/alignment/audit_personas.ts                   # main..HEAD
//   bun tools/alignment/audit_personas.ts HEAD~20..HEAD     # explicit range
//   bun tools/alignment/audit_personas.ts --json
//   bun tools/alignment/audit_personas.ts --md
//   bun tools/alignment/audit_personas.ts --out DIR
//   bun tools/alignment/audit_personas.ts --gate FRAC
//   bun tools/alignment/audit_personas.ts --round LABEL
//
// Exit codes:
//   0  Clean run; coverage >= gate (or no gate)
//   1  Coverage below gate
//   2  Script error / missing dependency / bad args
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync, } from "node:child_process";
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const ROUND_RE = /^## Round (\d+)/gm;
function classifyFailure(cmd, args, result) {
    if (result.error) {
        return `Failed to start '${cmd} ${args.join(" ")}': ${result.error.message}`;
    }
    if (result.status === null) {
        return `'${cmd} ${args.join(" ")}' terminated before reporting an exit code`;
    }
    if (result.status !== 0) {
        return `'${cmd} ${args.join(" ")}' exited ${String(result.status)}`;
    }
    return null;
}
function repoRoot() {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    const failure = classifyFailure("git", ["rev-parse"], result);
    if (failure !== null)
        throw new Error(failure);
    return result.stdout.trim();
}
function gitLogBodies(range) {
    // git is repo-pinned via .mise.toml; args are an explicit string array (no shell interpolation).
    const result = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    "git", ["log", "--pretty=format:%H%n%B%n---END---", range], { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER });
    if (result.status !== 0)
        return "";
    return result.stdout;
}
function reduceFlag(arg, next, state) {
    if (arg === "--json") {
        state.json = true;
        return { ok: true, consumed: 1 };
    }
    if (arg === "--md") {
        state.md = true;
        return { ok: true, consumed: 1 };
    }
    if (arg === "--out") {
        if (next === undefined) {
            return { ok: false, message: "audit_personas: --out requires a directory" };
        }
        state.outDir = next;
        return { ok: true, consumed: 2 };
    }
    if (arg === "--gate") {
        if (next === undefined) {
            return { ok: false, message: "audit_personas: --gate requires a fraction" };
        }
        state.gate = next;
        return { ok: true, consumed: 2 };
    }
    if (arg === "--round") {
        if (next === undefined) {
            return { ok: false, message: "audit_personas: --round requires a label" };
        }
        state.roundLabel = next;
        return { ok: true, consumed: 2 };
    }
    // Treat any non-flag positional as the range (matches bash original).
    if (!arg.startsWith("--")) {
        state.range = arg;
        state.rangeSet = true;
        return { ok: true, consumed: 1 };
    }
    return { ok: false, message: `audit_personas: unknown arg: ${arg}` };
}
function parseArgs(argv) {
    const state = {
        range: "main..HEAD",
        json: false,
        md: false,
        outDir: null,
        gate: null,
        roundLabel: null,
        rangeSet: false,
    };
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] ?? "";
        if (arg === "-h" || arg === "--help")
            return { kind: "help" };
        const r = reduceFlag(arg, argv[i + 1], state);
        if (!r.ok)
            return { kind: "error", message: r.message };
        i += r.consumed;
    }
    return {
        kind: "args",
        args: {
            range: state.range,
            json: state.json,
            md: state.md,
            outDir: state.outDir,
            gate: state.gate,
            roundLabel: state.roundLabel,
        },
    };
}
function listPersonas() {
    const memoryDir = "memory";
    const out = [];
    try {
        const items = readdirSync(memoryDir, { withFileTypes: true });
        for (const item of items) {
            if (item.isDirectory()) {
                const personaPath = join(memoryDir, item.name);
                if (item.name === "observed-phenomena" || item.name === "architectural-intent-guesses") {
                    continue;
                }
                const hasNotebook = existsSync(join(personaPath, "NOTEBOOK.md")) ||
                    existsSync(join(personaPath, "MEMORY.md")) ||
                    existsSync(join(personaPath, "PERSONA.md"));
                if (hasNotebook) {
                    out.push({ name: item.name, path: personaPath });
                }
            }
        }
    }
    catch {
        return [];
    }
    out.sort((a, b) => byteCompare(a.name, b.name));
    return out;
}
function byteCompare(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
function maxRoundIn(notebook) {
    let content;
    try {
        content = readFileSync(notebook, "utf8");
    }
    catch {
        return 0;
    }
    let max = 0;
    for (const m of content.matchAll(ROUND_RE)) {
        const n = m[1];
        if (n !== undefined) {
            const parsed = Number(n);
            if (parsed > max)
                max = parsed;
        }
    }
    return max;
}
function currentRound(personas) {
    let max = 0;
    for (const p of personas) {
        for (const f of ["NOTEBOOK.md", "MEMORY.md", "PERSONA.md"]) {
            const r = maxRoundIn(join(p.path, f));
            if (r > max)
                max = r;
        }
    }
    return max;
}
function commitMentions(name, bodies) {
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    const re = new RegExp(`\\b${cap}\\b`, "g");
    let count = 0;
    while (re.exec(bodies) !== null)
        count += 1;
    return count;
}
function buildRow(p, cr, bodies) {
    let lastRound = 0;
    for (const f of ["NOTEBOOK.md", "MEMORY.md", "PERSONA.md"]) {
        const r = maxRoundIn(join(p.path, f));
        if (r > lastRound)
            lastRound = r;
    }
    const staleness = lastRound === 0 ? "-" : String(cr - lastRound);
    const mentions = commitMentions(p.name, bodies);
    const touched = lastRound === cr || mentions > 0;
    return { name: p.name, lastRound, staleness, commitMentions: mentions, touched };
}
export function audit(args) {
    const personas = listPersonas();
    const cr = args.roundLabel !== null && /^\d+$/.test(args.roundLabel)
        ? Number(args.roundLabel)
        : currentRound(personas);
    const roundLabel = args.roundLabel ?? String(cr);
    const bodies = gitLogBodies(args.range);
    const rows = personas.map((p) => buildRow(p, cr, bodies));
    const total = rows.length;
    const touched = rows.filter((r) => r.touched).length;
    const coverage = total > 0 ? (touched / total).toFixed(2) : "0.00";
    return {
        roundLabel,
        range: args.range,
        rosterTotal: total,
        rosterTouched: touched,
        coverage,
        rows,
    };
}
function emitJson(r) {
    const personas = r.rows.map((row) => ({
        name: row.name,
        last_round: row.lastRound,
        staleness_rounds: row.staleness,
        commit_mentions: row.commitMentions,
        touched_this_round: row.touched ? 1 : 0,
    }));
    // Match bash's hand-rolled shape: top-level keys + personas array.
    // Use JSON.stringify with 2-space indent; bash version had the same
    // 2-space indent.
    const payload = {
        round: r.roundLabel,
        range: r.range,
        roster_total: r.rosterTotal,
        roster_touched: r.rosterTouched,
        roster_coverage: Number(r.coverage),
        personas,
    };
    return `${JSON.stringify(payload, null, 2)}\n`;
}
function emitMd(r) {
    const lines = [];
    lines.push(`# Persona runtime audit — round ${r.roundLabel}`);
    lines.push("");
    lines.push(`Range audited: \`${r.range}\`.`);
    lines.push("");
    lines.push(`Roster coverage: **${String(r.rosterTouched)} / ${String(r.rosterTotal)}** (${r.coverage}).`);
    lines.push("");
    lines.push("| Persona | Last round | Staleness | Commit mentions | Touched this round |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const row of r.rows) {
        const mark = row.touched ? "yes" : "no";
        const lrCell = row.lastRound === 0 ? "(none)" : String(row.lastRound);
        lines.push(`| ${row.name} | ${lrCell} | ${row.staleness} | ${String(row.commitMentions)} | ${mark} |`);
    }
    lines.push("");
    lines.push(`Source of truth: \`memory/<persona>/<name>/NOTEBOOK.md\` for last-round signal; \`git log ${r.range}\` for commit mentions. Both are git-tracked text — no external DB.`);
    return lines.join("\n");
}
function emitHumanSummary(r) {
    const lines = [];
    lines.push(`round=${r.roundLabel} range=${r.range} coverage=${String(r.rosterTouched)}/${String(r.rosterTotal)} (${r.coverage})`);
    for (const row of r.rows) {
        const lrCell = row.lastRound === 0 ? "-" : `r${String(row.lastRound)}`;
        lines.push(`  ${row.name.padEnd(12)} last=${lrCell.padEnd(5)} stale=${row.staleness.padEnd(3)} mentions=${String(row.commitMentions).padEnd(2)} touched=${row.touched ? "1" : "0"}`);
    }
    return lines.join("\n");
}
function gateOk(coverage, gate) {
    return Number(coverage) >= Number(gate);
}
export function main(argv) {
    const parsed = parseArgs(argv);
    if (parsed.kind === "help") {
        process.stdout.write("Usage: audit_personas.ts [RANGE] [--json | --md] [--out DIR] [--gate FRAC] [--round LABEL]\n");
        return 0;
    }
    if (parsed.kind === "error") {
        process.stderr.write(`${parsed.message}\n`);
        return 2;
    }
    const { args } = parsed;
    process.chdir(repoRoot());
    const result = audit(args);
    if (args.outDir !== null) {
        mkdirSync(args.outDir, { recursive: true });
        writeFileSync(join(args.outDir, `round-${result.roundLabel}-personas.json`), emitJson(result));
        writeFileSync(join(args.outDir, `round-${result.roundLabel}-personas.md`), `${emitMd(result)}\n`);
        process.stdout.write(`audit_personas: wrote ${args.outDir}/round-${result.roundLabel}-personas.{json,md}\n`);
    }
    else if (args.json) {
        process.stdout.write(emitJson(result));
    }
    else if (args.md) {
        process.stdout.write(`${emitMd(result)}\n`);
    }
    else {
        process.stdout.write(`${emitHumanSummary(result)}\n`);
    }
    if (args.gate !== null && !gateOk(result.coverage, args.gate)) {
        process.stderr.write(`audit_personas: coverage ${result.coverage} below gate ${args.gate}\n`);
        return 1;
    }
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
// re-export for parity with bash original's directory-check guard
