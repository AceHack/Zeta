#!/usr/bin/env bun
// daily-cost-report.ts — daily cost-monitoring entry point.
//
// TypeScript+Bun port of daily-cost-report.sh, slice 18 of the
// TS+Bun migration. Wraps snapshot-burn.ts + project-runway.ts and
// writes the human-readable projection to docs/budget-history/
// latest-report.md. Designed to be the single entry point for the
// daily /schedule remote-trigger routine (task #287 visibility
// surface for the human maintainer).
//
// Usage:
//   bun src/Core.TypeScript/budget/daily-cost-report.ts                  # full run, writes report
//   bun src/Core.TypeScript/budget/daily-cost-report.ts --dry-run        # snapshot dry-run
//   bun src/Core.TypeScript/budget/daily-cost-report.ts --skip-snapshot  # only regenerate report
//
// Exit codes:
//   0 success
//   1 if any wrapped step fails (snapshot-burn or project-runway)
//   2 on CLI-argument errors
//
// Composes with:
//   - src/Core.TypeScript/budget/snapshot-burn.ts (data-capture primitive)
//   - src/Core.TypeScript/budget/project-runway.ts (projection primitive)
//   - docs/budget-history/snapshots.jsonl (append-only data store)
//   - docs/budget-history/latest-report.md (visibility surface;
//     OVERWRITTEN each run, not append-only)
import { statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
function parseArgs(argv) {
    let dryRun = false;
    let skipSnapshot = false;
    for (const a of argv) {
        if (a === "--dry-run")
            dryRun = true;
        else if (a === "--skip-snapshot")
            skipSnapshot = true;
        else if (a === "-h" || a === "--help")
            return { help: true };
        else
            return { error: `error: unknown argument '${a}'`, exitCode: 2 };
    }
    return { dryRun, skipSnapshot };
}
function emitHelp() {
    process.stdout.write(`daily-cost-report.ts — daily cost-monitoring entry point.\n` +
        `\n` +
        `Usage:\n` +
        `  bun src/Core.TypeScript/budget/daily-cost-report.ts                  # full run, writes report\n` +
        `  bun src/Core.TypeScript/budget/daily-cost-report.ts --dry-run        # snapshot dry-run\n` +
        `  bun src/Core.TypeScript/budget/daily-cost-report.ts --skip-snapshot  # only regenerate report\n`);
}
function scriptDir() {
    return dirname(fileURLToPath(import.meta.url));
}
function repoRoot() {
    return resolve(scriptDir(), "..", "..");
}
function nowIsoUtc() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
function gitHeadSha(root) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["-C", root, "rev-parse", "HEAD"], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    return result.status === 0 ? result.stdout.trim() : "unknown";
}
function classifySpawnFailure(status, signal, error) {
    // 4-case helper (status set / ENOENT / signal / other) reused from
    // PRs #887, #898, #900. Distinguishes ENOENT/permission/signal from
    // a normal non-zero exit so callers see the actual failure mode.
    if (status !== null)
        return { status, note: "" };
    if (error?.code === "ENOENT") {
        return { status: 127, note: "command not found on PATH (ENOENT)" };
    }
    if (error?.code !== undefined) {
        return { status: 1, note: `spawn failed (${error.code})` };
    }
    if (signal !== null) {
        return { status: 1, note: `terminated by signal ${signal}` };
    }
    return { status: 1, note: "terminated without exit code" };
}
function runSnapshotBurn(dryRun) {
    const args = dryRun ? ["--dry-run"] : [];
    const argsSuffix = args.length > 0 ? ` ${args.join(" ")}` : "";
    process.stdout.write(`==> snapshot-burn.ts${argsSuffix}\n`);
    const path = resolve(scriptDir(), "snapshot-burn.ts");
    const result = spawnSync("bun", [path, ...args], {
        stdio: "inherit",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    const classified = classifySpawnFailure(result.status, result.signal, result.error);
    return { exitCode: classified.status, note: classified.note };
}
function runProjectRunway() {
    const path = resolve(scriptDir(), "project-runway.ts");
    const result = spawnSync("bun", [path], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
        stdio: ["inherit", "pipe", "pipe"],
    });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const output = result.stdout ?? "";
    const classified = classifySpawnFailure(result.status, result.signal, result.error);
    return {
        exitCode: classified.status,
        output,
        note: classified.note,
    };
}
function buildReport(args) {
    return `# Latest cost projection — auto-generated

**Generated:** \`${args.ts}\`
**Factory git SHA:** \`${args.gitSha}\`
**Source:** \`src/Core.TypeScript/budget/daily-cost-report.ts\` (wraps snapshot-burn.ts + project-runway.ts)

This file is **OVERWRITTEN** on each daily run. Historical snapshots live in
\`docs/budget-history/snapshots.jsonl\` (append-only); historical projections
can be reconstructed from any snapshot subset via \`src/Core.TypeScript/budget/project-runway.ts\`.

---

## Projection text

\`\`\`text
${args.projection}
\`\`\`

---

## How to read this

- **\`Actions billable_ms cumulative\`** — cumulative GitHub-Actions billable runtime across captured snapshots. On public repos this is typically 0 (included minutes); meaningful for macOS / private-repo / Enterprise-plan accounts.
- **\`Per-PR Actions ms (naive)\`** — rolling-window estimate of per-merged-PR Actions cost. Caveats in the projection text below; treat as proxy until \`N \\geq 3\` cumulative snapshots exist.
- **\`Actions fit\`** — whether projected Stages 1-4 burn fits the configured free-tier allowance. If \`EXCEEDS\`, the gate-conditions section names escape valves.
- **\`Copilot projected USD\`** — assumed-30-day span at the current seat count and rate. Re-run with \`--copilot-rate\` to model rate changes.

---

## Source data

- Snapshots: \`docs/budget-history/snapshots.jsonl\`
- Methodology: \`docs/budget-history/README.md\`
- Wrapper: \`src/Core.TypeScript/budget/daily-cost-report.ts\` (this run)
- Capture script: \`src/Core.TypeScript/budget/snapshot-burn.ts\`
- Projection script: \`src/Core.TypeScript/budget/project-runway.ts\`
`;
}
function isRegularFileSafe(path) {
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
function runSnapshotStep(skipSnapshot, dryRun) {
    if (skipSnapshot) {
        process.stdout.write("==> snapshot-burn.ts SKIPPED per --skip-snapshot\n");
        return { ok: true };
    }
    const burn = runSnapshotBurn(dryRun);
    if (burn.exitCode !== 0) {
        if (burn.note.length > 0) {
            process.stderr.write(`snapshot-burn.ts: ${burn.note}\n`);
        }
        process.stderr.write(`error: snapshot-burn.ts failed (exit ${String(burn.exitCode)})\n`);
        return { ok: false };
    }
    return { ok: true };
}
const BOOTSTRAP_PROJECTION = "No snapshots captured yet. The first snapshot-burn.ts run will append a baseline row to docs/budget-history/snapshots.jsonl. Once N >= 2 snapshots exist across LFG merges, projection becomes available.";
function runProjectionStep(snapshotsPath) {
    if (!isRegularFileSafe(snapshotsPath)) {
        process.stdout.write("==> project-runway.ts SKIPPED (no snapshots yet); writing bootstrap report\n");
        return { ok: true, projection: BOOTSTRAP_PROJECTION };
    }
    process.stdout.write("==> project-runway.ts\n");
    const runway = runProjectRunway();
    if (runway.exitCode !== 0) {
        if (runway.note.length > 0) {
            process.stderr.write(`project-runway.ts: ${runway.note}\n`);
        }
        process.stderr.write(`error: project-runway.ts failed (exit ${String(runway.exitCode)})\n`);
        return { ok: false };
    }
    return { ok: true, projection: runway.output };
}
export function main(argv) {
    const parsed = parseArgs(argv);
    if ("help" in parsed) {
        emitHelp();
        return 0;
    }
    if ("error" in parsed) {
        process.stderr.write(`${parsed.error}\n`);
        return parsed.exitCode;
    }
    const root = repoRoot();
    const reportPath = resolve(root, "docs", "budget-history", "latest-report.md");
    const snapshotsPath = resolve(root, "docs", "budget-history", "snapshots.jsonl");
    const snapshotStep = runSnapshotStep(parsed.skipSnapshot, parsed.dryRun);
    if (!snapshotStep.ok)
        return 1;
    const projectionStep = runProjectionStep(snapshotsPath);
    if (!projectionStep.ok)
        return 1;
    const projection = projectionStep.projection ?? "";
    // Step 3 — write the report (overwrite, not append)
    const report = buildReport({
        ts: nowIsoUtc(),
        gitSha: gitHeadSha(root),
        projection,
    });
    writeFileSync(reportPath, report);
    process.stdout.write(`==> wrote ${reportPath}\n`);
    process.stdout.write("OK: daily cost report regenerated\n");
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
