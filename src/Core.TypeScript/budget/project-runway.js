#!/usr/bin/env bun
// project-runway.ts — read docs/budget-history/snapshots.jsonl and
// project Stages 1-4 three-repo-split burn against remaining
// free-credit runway. Companion to snapshot-burn.ts.
//
// TypeScript+Bun port of project-runway.sh, slice 19 of the TS+Bun
// migration. Self-contained: works with N=1 (reports "insufficient
// data for delta; baseline only"), grows more useful as cadence
// accumulates. Last bash sibling in the budget cluster — once this
// lands, daily-cost-report.ts can switch to spawning the .ts versions.
//
// Human maintainer note, 2026-04-22: *"i want evidence based
// budgiting ... we want some amount of price history in git ...
// If i need more credits i can buy enterprise"*. This script is
// the projection layer that turns persisted history into a
// decision-ready summary for the human maintainer. It never
// initiates an upgrade — it only surfaces the projection so the
// human maintainer's call is evidence-driven.
//
// Usage:
//   bun src/Core.TypeScript/budget/project-runway.ts
//   bun src/Core.TypeScript/budget/project-runway.ts --stages 20
//   bun src/Core.TypeScript/budget/project-runway.ts --json
//   bun src/Core.TypeScript/budget/project-runway.ts --file docs/budget-history/snapshots.jsonl
//
// Defaults (rationale in docs/budget-history/README.md):
//   --stages 20            estimated extra PRs for Stages 1-4 of
//                          the three-repo split.
//   --copilot-rate 19      Copilot Business monthly seat rate USD.
//   --actions-free-ms 180000000  GitHub Team plan includes 3000
//                                min/month = 180 000 000 ms.
//
// Exit codes: 0 success, 2 on CLI-argument errors, 1 if the history
// file is missing or malformed.
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";
const DEFAULT_STAGES = 20;
const DEFAULT_COPILOT_RATE = 19;
const DEFAULT_ACTIONS_FREE_MS = 180_000_000;
const ASSUMED_DAYS = 30;
function requireInt(flag, val) {
    // Match bash `case "$val" in ''|*[!0-9]*) ...` — non-empty,
    // digits-only, non-negative integer. Used for --stages,
    // --copilot-rate, --actions-free-ms (Codex P2 NM59qF00 + NM59qH2H,
    // Copilot P1 NM59qGJ- on the bash original).
    if (val === undefined || val.length === 0) {
        return { error: `error: ${flag} requires a non-negative integer (got: '')`, exitCode: 2 };
    }
    if (!/^[0-9]+$/.test(val)) {
        return { error: `error: ${flag} requires a non-negative integer (got: '${val}')`, exitCode: 2 };
    }
    return Number.parseInt(val, 10);
}
function applyIntFlag(flag, next, setter) {
    if (next === undefined) {
        return { kind: "error", message: `error: ${flag} requires INT` };
    }
    const parsed = requireInt(flag, next);
    if (typeof parsed !== "number") {
        return { kind: "error", message: parsed.error };
    }
    setter(parsed);
    return { kind: "advance", skip: 2 };
}
function classifyFlag(a, next, state) {
    if (a === "--file") {
        if (next === undefined)
            return { kind: "error", message: "error: --file requires PATH" };
        state.file = next;
        return { kind: "advance", skip: 2 };
    }
    if (a === "--stages")
        return applyIntFlag("--stages", next, (n) => { state.stages = n; });
    if (a === "--copilot-rate")
        return applyIntFlag("--copilot-rate", next, (n) => { state.copilotRate = n; });
    if (a === "--actions-free-ms")
        return applyIntFlag("--actions-free-ms", next, (n) => { state.actionsFreeMs = n; });
    if (a === "--json") {
        state.emitJson = true;
        return { kind: "advance", skip: 1 };
    }
    if (a === "-h" || a === "--help")
        return { kind: "help" };
    return { kind: "error", message: `error: unknown argument '${a}'` };
}
function parseArgs(argv, defaultFile) {
    const state = {
        file: defaultFile,
        stages: DEFAULT_STAGES,
        copilotRate: DEFAULT_COPILOT_RATE,
        actionsFreeMs: DEFAULT_ACTIONS_FREE_MS,
        emitJson: false,
    };
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] ?? "";
        const step = classifyFlag(a, argv[i + 1], state);
        if (step.kind === "help")
            return { help: true };
        if (step.kind === "error")
            return { error: step.message, exitCode: 2 };
        i += step.skip;
    }
    return {
        file: state.file,
        stages: state.stages,
        copilotRate: state.copilotRate,
        actionsFreeMs: state.actionsFreeMs,
        emitJson: state.emitJson,
    };
}
function emitHelp() {
    process.stdout.write(`project-runway.ts — projection layer for budget snapshots.\n` +
        `\n` +
        `Usage:\n` +
        `  bun src/Core.TypeScript/budget/project-runway.ts\n` +
        `  bun src/Core.TypeScript/budget/project-runway.ts --stages 20\n` +
        `  bun src/Core.TypeScript/budget/project-runway.ts --json\n` +
        `  bun src/Core.TypeScript/budget/project-runway.ts --file PATH\n` +
        `\n` +
        `Defaults:\n` +
        `  --stages ${String(DEFAULT_STAGES)}\n` +
        `  --copilot-rate ${String(DEFAULT_COPILOT_RATE)} (USD/seat/month)\n` +
        `  --actions-free-ms ${String(DEFAULT_ACTIONS_FREE_MS)} (Team plan: 3000 min/month)\n`);
}
function scriptDir() {
    return dirname(fileURLToPath(import.meta.url));
}
function repoRoot() {
    return resolve(scriptDir(), "..", "..");
}
function isRegularFileSafe(path) {
    // Match bash `-f` semantics: regular file AND exists. `existsSync`
    // returns true for directories too (bash `-f` does not). Mirror of
    // the slice-18 fix on daily-cost-report.ts.
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
function readSnapshotLines(path) {
    const raw = readFileSync(path, "utf8");
    // Match bash `wc -l` semantics over JSONL: count non-empty lines.
    // Empty trailing newline shouldn't inflate the count.
    return raw.split("\n").filter((line) => line.length > 0);
}
function sumOptional(values) {
    // Match jq `// 0` per-element default and `add // 0` empty-array default.
    return values.reduce((acc, v) => acc + (v ?? 0), 0);
}
function parseSnapshot(line) {
    // JSON.parse + structural projection. Throws on malformed JSONL,
    // which the caller catches and surfaces as "malformed snapshot file"
    // (matches bash exit code 1 on jq failure).
    const obj = JSON.parse(line);
    const repos = obj.repos ?? [];
    const totalMs = sumOptional(repos.map((r) => r.agg?.total_duration_ms));
    const billableMs = sumOptional(repos.flatMap((r) => [
        r.agg?.billable_ubuntu_ms,
        r.agg?.billable_macos_ms,
        r.agg?.billable_windows_ms,
    ]));
    const recentMerged = sumOptional(repos.map((r) => r.pr?.recent_merged));
    return {
        ts: obj.ts ?? "",
        factoryGitSha: obj.factory_git_sha ?? "",
        copilotSeats: obj.copilot_billing?.seat_breakdown?.total ?? 0,
        copilotPlan: obj.copilot_billing?.plan_type ?? "unknown",
        totalMs,
        billableMs,
        recentMerged,
    };
}
function computeProjection(args) {
    let deltaAvailable = false;
    let perPrMs = null;
    let prDelta = 0;
    let projectedActionsMs = 0;
    let actionsFit = "unknown (N<2)";
    const remainingFreeMs = args.actionsFreeMs - args.last.billableMs;
    if (args.n >= 2) {
        const totalMsDelta = args.last.totalMs - args.first.totalMs;
        if (totalMsDelta > 0) {
            // Match bash: use rolling-window merged delta as proxy; if delta
            // is non-positive, clamp to 1 to avoid divide-by-zero. This is
            // the documented naive-proxy caveat in the bash original.
            let mergedDelta = args.last.recentMerged - args.first.recentMerged;
            if (mergedDelta < 1)
                mergedDelta = 1;
            prDelta = mergedDelta;
            perPrMs = Math.trunc(totalMsDelta / prDelta);
            deltaAvailable = true;
            projectedActionsMs = perPrMs * args.stages;
            if (projectedActionsMs <= remainingFreeMs) {
                actionsFit = `fits (with margin ${String(remainingFreeMs - projectedActionsMs)} ms)`;
            }
            else {
                actionsFit = `EXCEEDS by ${String(projectedActionsMs - remainingFreeMs)} ms`;
            }
        }
    }
    // Match bash: `seats * rate * 30 / 30` simplifies to `seats * rate`,
    // but keep the form to mirror the assumed-30-day-window framing.
    const copilotProjectedUsd = Math.trunc((args.last.copilotSeats * args.copilotRate * ASSUMED_DAYS) / 30);
    return {
        deltaAvailable,
        perPrMs,
        prDelta,
        projectedActionsMs,
        remainingFreeMs,
        actionsFit,
        copilotProjectedUsd,
    };
}
function emitJsonOutput(args) {
    const out = {
        input: {
            file: args.file,
            samples: args.n,
            first_ts: args.first.ts,
            last_ts: args.last.ts,
        },
        parameters: {
            stages_extra_prs: args.stages,
            copilot_rate_usd: args.copilotRate,
            actions_free_ms: args.actionsFreeMs,
            assumed_migration_days: ASSUMED_DAYS,
        },
        latest_snapshot: {
            ts: args.last.ts,
            factory_git_sha: args.last.factoryGitSha,
            copilot: { seats: args.last.copilotSeats, plan: args.last.copilotPlan },
            actions: { total_ms_last_20_runs: args.last.totalMs, billable_ms: args.last.billableMs },
        },
        projection: {
            delta_available: args.projection.deltaAvailable,
            per_pr_ms: args.projection.perPrMs,
            pr_delta_window: args.projection.prDelta,
            actions_projected_ms: args.projection.projectedActionsMs,
            actions_remaining_free_ms: args.projection.remainingFreeMs,
            actions_fit: args.projection.actionsFit,
            copilot_projected_usd_for_window: args.projection.copilotProjectedUsd,
        },
    };
    // Match bash `jq -n ... | <stdout>` shape: two-space indented JSON.
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}
function relativeToRepo(file, root) {
    // Match bash `${file#"$repo_root"/}` — strip "$repo_root/" prefix
    // when present, otherwise leave the path verbatim.
    const rel = relative(root, file);
    if (rel.length > 0 && !rel.startsWith(".."))
        return rel;
    return file;
}
function emitProjectionLines(projection) {
    if (projection.deltaAvailable) {
        return (`  Per-PR Actions ms (naive, from rolling window): ${String(projection.perPrMs ?? 0)}\n` +
            `  Projected Stages 1-4 Actions ms:                ${String(projection.projectedActionsMs)}\n` +
            `  Remaining free-tier ms:                         ${String(projection.remainingFreeMs)}\n` +
            `  Actions fit:                                    ${projection.actionsFit}\n`);
    }
    return (`  Per-PR Actions ms:         insufficient data (N<2 or no duration delta)\n` +
        `  Projected Actions ms:      unavailable\n` +
        `  Gate status:               cannot project — accumulate more snapshots\n`);
}
function emitDecisionLines(args) {
    if (args.n < 3) {
        return (`  N=${String(args.n)}; BACKLOG row requires N>=3 across >=2 LFG merges before\n` +
            `  projection is considered decision-ready. Keep accumulating.\n`);
    }
    if (!args.projection.deltaAvailable) {
        return (`  N=${String(args.n)} but no duration delta observed — cadence is hitting the\n` +
            `  same 20-run window. Accumulate across more merges or extend\n` +
            `  the snapshot window.\n`);
    }
    return (`  Gate conditions (see ADR §Blockers):\n` +
        `    (1) N>=3 samples:                 ${args.n >= 3 ? "yes" : "no"}\n` +
        `    (2) projection computed:          yes\n` +
        `    (3) human maintainer has seen projection:    (surface via Architect)\n` +
        `\n` +
        `  If Actions projection shows EXCEEDS, the escape valves are:\n` +
        `    - Shrink Stage 1-4 workload (reduce --stages parameter)\n` +
        `    - Wait for next free-credit cycle\n` +
        `    - Human-maintainer decision: Enterprise upgrade (Trigger B per memory\n` +
        `      feedback_lfg_paid_copilot_teams_throttled_experiments_allowed.md)\n`);
}
function emitTextOutput(args) {
    const fileRel = relativeToRepo(args.file, args.root);
    process.stdout.write(`Budget projection — three-repo-split Stages 1-4\n` +
        `================================================\n` +
        `\n` +
        `Evidence source:   ${fileRel}\n` +
        `Samples (N):       ${String(args.n)}\n` +
        `First snapshot:    ${args.first.ts}\n` +
        `Latest snapshot:   ${args.last.ts}\n` +
        `Latest factory SHA: ${args.last.factoryGitSha}\n` +
        `\n` +
        `Latest state\n` +
        `------------\n` +
        `  Copilot plan:    ${args.last.copilotPlan}\n` +
        `  Copilot seats:   ${String(args.last.copilotSeats)}\n` +
        `  Actions total_duration_ms (last 20 runs, all repos):  ${String(args.last.totalMs)}\n` +
        `  Actions billable_ms cumulative:  ${String(args.last.billableMs)}\n` +
        `\n` +
        `Projection parameters\n` +
        `---------------------\n` +
        `  Estimated extra PRs for Stages 1-4:  ${String(args.stages)}\n` +
        `  Copilot Business seat rate (USD/mo): $${String(args.copilotRate)}\n` +
        `  Actions free-tier allowance (ms):    ${String(args.actionsFreeMs)}\n` +
        `  Assumed migration span (days):       ${String(ASSUMED_DAYS)}\n` +
        `\n` +
        `Projection\n` +
        `----------\n` +
        emitProjectionLines(args.projection) +
        `  Copilot projected USD (single span):           $${String(args.projection.copilotProjectedUsd)}\n` +
        `\n` +
        `Human-maintainer-decision surface\n` +
        `----------------------\n` +
        emitDecisionLines({ n: args.n, projection: args.projection }) +
        `\n` +
        `Caveats\n` +
        `-------\n` +
        `  * recent_merged is a rolling-window count (last 10 closed PRs),\n` +
        `    not a cumulative counter. Per-PR-ms uses it as a proxy —\n` +
        `    introduces error when the 20-run window doesn't roll forward\n` +
        `    between snapshots. A cumulative PR counter would be a\n` +
        `    substrate improvement (BACKLOG follow-up).\n` +
        `  * last_billable_ms on public repos is typically 0 (included\n` +
        `    minutes). Projection still meaningful for macOS runs and\n` +
        `    any future private-repo work.\n` +
        `  * Copilot projection assumes constant seat count over the span.\n` +
        `    Seat-count changes require rerunning projection.\n`);
}
export function main(argv) {
    const root = repoRoot();
    const defaultFile = resolve(root, "docs", "budget-history", "snapshots.jsonl");
    const parsed = parseArgs(argv, defaultFile);
    if ("help" in parsed) {
        emitHelp();
        return 0;
    }
    if ("error" in parsed) {
        process.stderr.write(`${parsed.error}\n`);
        return parsed.exitCode;
    }
    if (!isRegularFileSafe(parsed.file)) {
        process.stderr.write(`error: snapshot file not found: ${parsed.file}\n`);
        return 1;
    }
    let lines;
    try {
        lines = readSnapshotLines(parsed.file);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`error: failed to read snapshot file: ${message}\n`);
        return 1;
    }
    const n = lines.length;
    if (n < 1) {
        process.stderr.write(`error: snapshot file is empty: ${parsed.file}\n`);
        return 1;
    }
    let first;
    let last;
    try {
        first = parseSnapshot(lines[0] ?? "");
        last = parseSnapshot(lines[n - 1] ?? "");
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`error: malformed snapshot file: ${message}\n`);
        return 1;
    }
    const projection = computeProjection({
        first,
        last,
        n,
        stages: parsed.stages,
        copilotRate: parsed.copilotRate,
        actionsFreeMs: parsed.actionsFreeMs,
    });
    if (parsed.emitJson) {
        emitJsonOutput({
            file: parsed.file,
            n,
            first,
            last,
            stages: parsed.stages,
            copilotRate: parsed.copilotRate,
            actionsFreeMs: parsed.actionsFreeMs,
            projection,
        });
    }
    else {
        emitTextOutput({
            file: parsed.file,
            root,
            n,
            first,
            last,
            stages: parsed.stages,
            copilotRate: parsed.copilotRate,
            actionsFreeMs: parsed.actionsFreeMs,
            projection,
        });
    }
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
