#!/usr/bin/env bun
/**
 * drift-rate-cli.ts — record CI outcomes and report drift trends.
 *
 * The edge: all I/O and the only clock read. Everything that DECIDES lives in
 * `drift-rate.ts`, which is pure and takes `now` as an argument, so a report replays
 * deterministically (DST) and local wall-clock never reaches the fold
 * (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
 *
 * Usage:
 *   # Report (reads data/ci-runs.jsonl + db/drift-dashboard/roster.json)
 *   bun src/Core.TypeScript/observe/drift-rate-cli.ts --report [--json] [--annotate]
 *
 *   # Record one outcome (appends to data/ci-runs.jsonl)
 *   bun src/Core.TypeScript/observe/drift-rate-cli.ts --record \
 *     --check agent-heartbeat --lane otto --outcome green --run-id 12345
 *
 * `--check` takes a `CheckId` — the SAME identity the drift-dashboard roster uses (a
 * workflow file's basename without extension). `--lane` is the satellite: which agent
 * produced it. Recording `--check heartbeat-otto` would mint a check the roster has
 * never heard of, and the report says so out loud (`unrostered`) rather than quietly
 * accumulating a parallel vocabulary.
 *
 * `--workflow` and `--conclusion` remain accepted as legacy aliases.
 *
 * EXIT STATUS. `--report` exits 0 whether the news is good or bad — a *trend reporter*
 * is a measurement, not a gate (the SDV framing), and making the heartbeat's health
 * depend on the repo's health would be a feedback loop, not a meter. It exits **1 only
 * when the reporter itself failed**: unreadable log, malformed roster, a bug in here.
 * That distinction is what lets the caller drop `|| true` and still never be blocked by
 * a red repo — see the `Record CI drift` step in `.github/workflows/agent-heartbeat.yml`.
 *
 * `--annotate` additionally emits GitHub `::warning::` lines for dark / silent /
 * unrostered checks, so a finding is visible in the run summary rather than buried.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  computeDrift, formatDrift, formatRate, loadCIRuns, loadRosterCheckIds,
  type CIRun, type Outcome,
} from "./drift-rate.ts";

const DATA_PATH = join("data", "ci-runs.jsonl");
const ROSTER_PATH = join("db", "drift-dashboard", "roster.json");

const OUTCOME_IN: ReadonlyMap<string, Outcome> = new Map([
  ["green", "green"], ["success", "green"],
  ["red", "red"], ["failure", "red"],
  ["cancelled", "cancelled"], ["canceled", "cancelled"],
]);

function argValue(argv: readonly string[], ...flags: string[]): string | undefined {
  for (const flag of flags) {
    const i = argv.indexOf(flag);
    if (i >= 0) return argv[i + 1];
  }
  return undefined;
}

function doRecord(argv: readonly string[], repoRoot: string): number {
  const checkId = argValue(argv, "--check", "--workflow");
  const rawOutcome = argValue(argv, "--outcome", "--conclusion");
  const lane = argValue(argv, "--lane");
  const runId = argValue(argv, "--run-id");

  if (!checkId || !rawOutcome) {
    console.error("Usage: --record --check <checkId> --outcome <green|red|cancelled> [--lane <name>] [--run-id <id>]");
    return 1;
  }
  const outcome = OUTCOME_IN.get(rawOutcome.toLowerCase());
  if (outcome === undefined) {
    console.error(`Invalid outcome: "${rawOutcome}". Must be green|red|cancelled (success/failure accepted).`);
    return 1;
  }

  const record: CIRun = {
    checkId,
    outcome,
    at: new Date().toISOString(),
    ...(lane ? { lane } : {}),
    ...(runId ? { runId } : {}),
  };

  const dataPath = join(repoRoot, DATA_PATH);
  try {
    mkdirSync(dirname(dataPath), { recursive: true });
    appendFileSync(dataPath, `${JSON.stringify(record)}\n`);
  } catch (err) {
    console.error(`[drift-rate] failed to write ${DATA_PATH}: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  console.log(`[drift-rate] recorded: ${checkId}${lane ? `/${lane}` : ""} = ${outcome}`);
  return 0;
}

function doReport(argv: readonly string[], repoRoot: string): number {
  const runs = loadCIRuns(join(repoRoot, DATA_PATH));
  const roster = loadRosterCheckIds(join(repoRoot, ROSTER_PATH));
  const snapshot = computeDrift(runs, { roster });

  if (argv.includes("--json")) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(formatDrift(snapshot));
    console.log(`  roster: ${roster.length} checks, log: ${runs.length} runs`);
    if (roster.length === 0) {
      console.log(`  NOTE: ${ROSTER_PATH} unreadable or empty — every check reads 'unrostered' and`);
      console.log(`        the denominator is only what was recorded. This is the degraded mode.`);
    }
    for (const w of snapshot.overall) {
      console.log(`  ${w.label}: green ${formatRate(w.green_of_all)} | concluded ${formatRate(w.green_of_concluded)} | cancelled ${w.cancelled}/${w.total}`);
    }
    const worst = snapshot.byCheck.slice(0, 8);
    if (worst.length > 0) {
      console.log("  Checks (worst-first; unknown outranks red):");
      for (const c of worst) {
        const age = c.sinceConcludedMs === null
          ? "never concluded"
          : `last concluded ${(c.sinceConcludedMs / 3_600_000).toFixed(1)}h ago`;
        console.log(`    ${c.checkId} [${c.status}${c.dark ? " DARK" : ""}] green ${formatRate(c.green_of_all)}, ${age}, trend ${c.trend}`);
      }
    }
  }

  if (argv.includes("--annotate")) {
    for (const id of snapshot.darkChecks) {
      console.log(`::warning title=drift-rate dark lane::${id} has not concluded a run recently — cancelled runs never count as green`);
    }
    if (snapshot.silent.length > 0) {
      console.log(`::warning title=drift-rate silent checks::${snapshot.silent.length} rostered check(s) recorded nothing in the window: ${snapshot.silent.slice(0, 20).join(", ")}`);
    }
    if (snapshot.unrostered.length > 0) {
      console.log(`::warning title=drift-rate vocabulary drift::${snapshot.unrostered.length} recorded check id(s) are not in ${ROSTER_PATH}: ${snapshot.unrostered.slice(0, 20).join(", ")}`);
    }
  }
  return 0;
}

export function main(argv: readonly string[], repoRoot: string): number {
  if (argv.includes("--record")) return doRecord(argv, repoRoot);
  if (argv.includes("--report") || argv.length === 0) return doReport(argv, repoRoot);
  console.error("Usage: --report [--json] [--annotate] | --record --check <id> --outcome <green|red|cancelled>");
  return 1;
}

// Guarded so the module can be imported by tests without executing.
if (typeof process.argv[1] === "string" && /drift-rate-cli\.ts$/.test(process.argv[1])) {
  let code: number;
  try {
    code = main(process.argv.slice(2), process.cwd());
  } catch (err) {
    // The reporter itself broke. Say so on stderr AND as a GitHub annotation, and exit
    // non-zero. A telemetry reporter that swallows its own failure is indistinguishable
    // from a working one forever — which is the exact class this repo keeps finding.
    console.error(`[drift-rate] REPORTER FAILED: ${err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err)}`);
    console.log(`::error title=drift-rate reporter failed::${err instanceof Error ? err.message : String(err)}`);
    code = 1;
  }
  process.exit(code);
}
