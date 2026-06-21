#!/usr/bin/env bun
// snapshot-burn.ts — capture a point-in-time LFG cost/burn snapshot
// and append it to docs/budget-history/snapshots.jsonl as a single
// JSON line. Append-only; git is the time-series storage.
//
// TypeScript+Bun port of snapshot-burn.sh, slice 14 of the TS+Bun
// migration. See docs/best-practices/repo-scripting.md.
//
// Why this exists: the human maintainer 2026-04-22 scoped the
// three-repo-split Stage 1 gate as evidence-based budget tracking.
// The live cost graphs on github.com are for humans and disappear
// the moment we stop looking; the factory needs persisted evidence
// to project mid-swap credit-exhaustion risk. See
// docs/budget-history/README.md for the methodology + projection
// approach.
//
// Usage:
//   bun src/Core.TypeScript/budget/snapshot-burn.ts              # append a snapshot
//   bun src/Core.TypeScript/budget/snapshot-burn.ts --dry-run    # print only, no append
//   bun src/Core.TypeScript/budget/snapshot-burn.ts --note "TEXT"  # attach a human note
//
// Scopes required (current gh token has these): read:org, repo, workflow.
// admin:org scope would unlock /settings/billing/{actions,packages,
// shared-storage} too — without admin:org we capture run timing
// instead of pure billing totals.
//
// Exit codes:
//   0 success
//   1 if any required gh/git step fails
//   2 on CLI-argument errors
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const ORG = "Lucent-Financial-Group";
const REPOS = [`${ORG}/Zeta`];
function parseArgs(argv) {
    let dryRun = false;
    let note = "";
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i] ?? "";
        if (arg === "--dry-run") {
            dryRun = true;
        }
        else if (arg === "--note") {
            const next = argv[i + 1];
            if (next === undefined) {
                return { error: "error: --note requires TEXT argument", exitCode: 2 };
            }
            note = next;
            i++;
        }
        else if (arg === "-h" || arg === "--help") {
            emitHelp();
            return { dryRun: false, note: "__HELP__" };
        }
        else {
            return {
                error: `error: unknown argument '${arg}'`,
                exitCode: 2,
            };
        }
    }
    return { dryRun, note };
}
function emitHelp() {
    process.stdout.write(`snapshot-burn.ts — capture a point-in-time LFG cost/burn snapshot\n` +
        `\n` +
        `Usage:\n` +
        `  bun src/Core.TypeScript/budget/snapshot-burn.ts              # append a snapshot\n` +
        `  bun src/Core.TypeScript/budget/snapshot-burn.ts --dry-run    # print only, no append\n` +
        `  bun src/Core.TypeScript/budget/snapshot-burn.ts --note "TEXT"  # attach a human note\n`);
}
function commandAvailable(cmd) {
    const result = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    return result.status === 0;
}
function ghJson(path) {
    // `gh api` shell-out: gh handles auth + pagination defaults; user
    // passes only the API path, no shell-interpolated args.
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("gh", ["api", path], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    if (result.status !== 0) {
        throw new Error(`gh api ${path} failed: ${result.stderr.length > 0 ? result.stderr : "unknown error"}`);
    }
    return JSON.parse(result.stdout);
}
function ghJsonOrEmpty(path, fallback) {
    try {
        return { data: ghJson(path), warning: false };
    }
    catch {
        process.stderr.write(`warning: gh api ${path} failed; using fallback\n`);
        return { data: fallback, warning: true };
    }
}
function repoRoot() {
    const here = dirname(fileURLToPath(import.meta.url));
    // 3 levels up from src/Core.TypeScript/budget/ (was "..","..", when this
    // lived at tools/budget/; the relocation added a directory level).
    return resolve(here, "..", "..", "..");
}
function gitHeadSha() {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["-C", repoRoot(), "rev-parse", "HEAD"], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    return result.status === 0 ? result.stdout.trim() : "unknown";
}
function nowIsoUtc() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
function aggregateTimings(timings) {
    const sum = (xs) => xs.reduce((a, b) => a + b, 0);
    return {
        total_runs: timings.length,
        total_duration_ms: sum(timings.map((t) => t.timing.run_duration_ms ?? 0)),
        billable_ubuntu_ms: sum(timings.map((t) => t.timing.billable?.UBUNTU?.total_ms ?? 0)),
        billable_macos_ms: sum(timings.map((t) => t.timing.billable?.MACOS?.total_ms ?? 0)),
        billable_windows_ms: sum(timings.map((t) => t.timing.billable?.WINDOWS?.total_ms ?? 0)),
    };
}
function summarizePulls(pulls) {
    const merged = pulls.filter((p) => p.merged_at !== null && p.merged_at !== undefined);
    const last = merged[0];
    return {
        recent_merged: merged.length,
        last_merged_at: last?.merged_at ?? null,
    };
}
function captureRepoStats(repos) {
    let warnings = 0;
    const entries = [];
    for (const r of repos) {
        const runsRes = ghJsonOrEmpty(`/repos/${r}/actions/runs?per_page=20`, {
            workflow_runs: [],
        });
        if (runsRes.warning)
            warnings++;
        const runs = runsRes.data;
        const runRows = runs.workflow_runs ?? [];
        const timings = [];
        for (const row of runRows) {
            const tRes = ghJsonOrEmpty(`/repos/${r}/actions/runs/${String(row.id)}/timing`, {});
            if (tRes.warning)
                warnings++;
            timings.push({ id: row.id, timing: tRes.data });
        }
        const agg = aggregateTimings(timings);
        const prRes = ghJsonOrEmpty(`/repos/${r}/pulls?state=closed&per_page=10`, []);
        if (prRes.warning)
            warnings++;
        const prRows = prRes.data;
        const pr = summarizePulls(prRows);
        const last20 = runRows.map((row) => ({
            id: row.id,
            ...(row.name === undefined ? {} : { name: row.name }),
            ...(row.conclusion === undefined ? {} : { conclusion: row.conclusion }),
            ...(row.run_started_at === undefined ? {} : { run_started_at: row.run_started_at }),
            ...(row.updated_at === undefined ? {} : { updated_at: row.updated_at }),
        }));
        entries.push({ repo: r, agg, pr, last_20_runs: last20 });
    }
    return { entries, warnings };
}
function buildSnapshot(args) {
    return {
        ts: nowIsoUtc(),
        factory_git_sha: gitHeadSha(),
        org: ORG,
        note: args.note.length > 0 ? args.note : null,
        copilot_billing: args.copilot,
        repos: args.repos,
        scope_coverage: {
            has_read_org: true,
            has_admin_org: false,
            covered: ["copilot-seats", "actions-runs-per-run-timing"],
            missing_requires_admin_org: [
                "actions-billing",
                "packages-billing",
                "shared-storage-billing",
            ],
        },
    };
}
export function main(argv) {
    const parsed = parseArgs(argv);
    if ("error" in parsed) {
        process.stderr.write(`${parsed.error}\n`);
        return parsed.exitCode;
    }
    if (parsed.note === "__HELP__")
        return 0;
    for (const cmd of ["gh", "git"]) {
        if (!commandAvailable(cmd)) {
            process.stderr.write(`error: '${cmd}' required but not on PATH\n`);
            return 1;
        }
    }
    const copilot = ghJsonOrEmpty(`/orgs/${ORG}/copilot/billing`, {});
    const captured = captureRepoStats(REPOS);
    const totalWarnings = captured.warnings + (copilot.warning ? 1 : 0);
    if (totalWarnings > 0) {
        process.stderr.write(`warning: ${String(totalWarnings)} GitHub API call(s) failed; snapshot is partial — review stderr above\n`);
    }
    const snapshot = buildSnapshot({
        note: parsed.note,
        copilot: copilot.data,
        repos: captured.entries,
    });
    const line = JSON.stringify(snapshot);
    if (line.length === 0 || line === "null") {
        process.stderr.write("error: snapshot compaction produced empty/null output — refusing to append\n");
        return 1;
    }
    if (parsed.dryRun) {
        process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
        return 0;
    }
    const out = resolve(repoRoot(), "docs", "budget-history", "snapshots.jsonl");
    appendFileSync(out, `${line}\n`);
    process.stdout.write(`appended snapshot to ${out}\n`);
    const summary = {
        ts: snapshot.ts,
        org: snapshot.org,
        repos: snapshot.repos.map((r) => ({
            repo: r.repo,
            last_20_total_ms: r.agg.total_duration_ms,
            recent_merged: r.pr.recent_merged,
        })),
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
