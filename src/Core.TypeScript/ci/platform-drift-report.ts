#!/usr/bin/env bun
// platform-drift-report.ts -- the read surface for the legs that are DELIBERATELY
// non-blocking.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS (2026-08-19)
// ---------------------------------------------------------------------------
// Aaron settled the standing question about the Windows and macOS legs:
//
//   "windows and mac are drift checks, it's fine to check per pr if we want but we
//    don't want to block on them. Also we are moving more and more away from PRs and
//    more into sovereign mode without PRs."
//
// That makes `continue-on-error` on those legs a CLASSIFICATION, not a tolerance --
// and it moves the whole weight of the arrangement onto one word: *observed*. A drift
// check nobody reads is the vacuity class wearing a different hat, so the honest
// obligation that comes with "don't block" is "then make sure it is seen".
//
// WHAT WAS ALREADY THERE, AND WHERE IT STOPPED.
//   * `gate-scope-summary.ts` names a non-blocking failed leg in the `gate (required)`
//     step summary and raises a warning annotation. Per-run, and Windows legs only run
//     on push-to-main -- a run nobody opens.
//   * `drift-sweep.yml`'s BD001 detector queries the LATEST COMPLETED gate push-run and
//     files any failed `build-and-test` leg into the drift ledger. Real routing, but
//     (a) the ledger key is `Zeta.sln` + `BD001`, so WHICH platform is lost, (b) it
//     cannot distinguish a red blocking Linux build from a drift leg doing its job, and
//     (c) it reads ONE run, so it measures a level and never a rate.
//
// So the gap is not "nothing sees it". The gap is that nothing says WHICH leg, HOW
// OFTEN, or HOW MANY of the runs we already pay for actually executed it. This fold
// answers those three, and publishes them where the fleet already looks
// (`data/platform-drift.json` -> `data/monitor.html`).
//
// THE MEASUREMENT THAT MADE (c) URGENT. Of the 300 most recent completed `gate` push
// runs on main (measured 2026-08-19), **265 were `cancelled`** -- main pushes arrive
// faster than a gate run takes, and GitHub keeps at most one PENDING run per
// concurrency group, cancelling the older pending one. A cancelled run's legs never
// execute. So the drift check we believe runs on every merge actually executed on
// ~12% of them, and a detector that reads only the latest completed run will usually
// read a cancelled one and find nothing. COVERAGE is therefore a first-class output
// here, not a footnote: a clean streak measured over runs that never ran is not
// evidence of anything.
//
// CLASSIFICATION IS OBSERVED, NEVER ASSUMED. Nothing here knows the word "windows".
// A leg is called non-blocking only when it has been SEEN to fail while
// `gate (required)` reported success -- the same derivation `gate-scope-summary.ts`
// uses, and the only one the API supports. A leg with no failures in the window is
// reported `unobserved`, not "healthy": we have not measured it, and saying so is the
// toy/unmetered/metered discipline applied to a CI claim.
//
// IDEMPOTENT AND INCREMENTAL (discipline #6). Run records are keyed by run id and
// upserted, so re-running the report N times equals running it once, and each tick
// fetches jobs only for runs it has not already recorded. That is what keeps a
// per-push cadence inside the API budget: one list call plus (usually) zero or one
// jobs call.
//
// DST (manifesto §7): `foldRuns` is a pure function of the run-record set. No clock,
// no network, no ordering by wall time -- records are ordered by run id, and the ISO
// timestamps ride along as metadata that never enters the fold.
//
// Usage (CI):
//   GH_TOKEN=... bun src/Core.TypeScript/ci/platform-drift-report.ts \
//     --repo owner/name --out data/platform-drift.json [--pages 1] [--max-runs 500]
// Usage (local, no network -- fold an existing ledger and print):
//   bun src/Core.TypeScript/ci/platform-drift-report.ts --out data/platform-drift.json --offline
//
// Exit 0 always: this is an observability layer. It must never be able to turn a lane
// red -- the legs it reports on are non-blocking by decision, and a reporter that can
// fail the build would quietly re-introduce the blocking it exists to describe.

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** The rollup job whose conclusion tells a leg failure apart from a blocking one. */
export const ROLLUP_JOB_NAME = "gate (required)";

/** Job-name prefix of the platform matrix this report covers. */
export const MATRIX_JOB_PREFIX = "build-and-test (";

/** One completed `gate` push run, reduced to what the fold needs. */
export interface RunRecord {
  readonly id: number;
  /** ISO metadata ONLY -- never enters the fold. */
  readonly at: string;
  readonly sha: string;
  /** Run-level conclusion: `success` | `failure` | `cancelled` | ... */
  readonly conclusion: string;
  /** Conclusion of `gate (required)`, or `absent` when the run has no such job. */
  readonly rollup: string;
  /** Matrix leg name -> conclusion. Empty for a run whose legs never executed. */
  readonly legs: Readonly<Record<string, string>>;
}

/**
 * What the evidence supports about a leg's blocking status.
 *
 * `unobserved` is deliberately not called "healthy": zero failures in the window means
 * the question was never put to the leg, which is a different statement from passing.
 */
export type LegClass = "non-blocking" | "blocking" | "unobserved";

export interface LegStat {
  readonly name: string;
  readonly classification: LegClass;
  /** Runs in which this leg actually executed (reached a conclusion). */
  readonly executedRuns: number;
  readonly failures: number;
  /** Failures that sat beside a green `gate (required)` -- i.e. blocked nothing. */
  readonly nonBlockingFailures: number;
  /** failures / executedRuns, or 0 when the leg never executed. */
  readonly failureRate: number;
  /** Consecutive most-recent EXECUTED runs with no failure of this leg. */
  readonly cleanStreak: number;
  readonly lastFailure: { readonly runId: number; readonly at: string; readonly blocked: boolean } | null;
}

export interface PlatformDriftReport {
  /** Total run records held. */
  readonly runs: number;
  /** Runs whose matrix legs actually executed. */
  readonly executedRuns: number;
  /** Runs that ended `cancelled` -- the legs never ran. */
  readonly cancelledRuns: number;
  /** executedRuns / runs. The honest denominator for every rate below. */
  readonly coverage: number;
  readonly legs: readonly LegStat[];
  /** Highest run id in the window -- the fold's own watermark, not a clock. */
  readonly latestRunId: number;
}

// ---------------------------------------------------------------------------
// Pure fold
// ---------------------------------------------------------------------------

/** Records ordered newest-first by run id. Stable, total, and clock-free. */
export function orderNewestFirst(records: readonly RunRecord[]): readonly RunRecord[] {
  return [...records].sort((a, b) => b.id - a.id);
}

function classify(failures: number, nonBlocking: number): LegClass {
  if (failures === 0) return "unobserved";
  return nonBlocking > 0 ? "non-blocking" : "blocking";
}

export function foldRuns(records: readonly RunRecord[]): PlatformDriftReport {
  const ordered = orderNewestFirst(records);
  const legNames = new Set<string>();
  for (const r of ordered) for (const name of Object.keys(r.legs)) legNames.add(name);

  const legs: LegStat[] = [];
  for (const name of [...legNames].sort()) {
    let executedRuns = 0;
    let failures = 0;
    let nonBlockingFailures = 0;
    let cleanStreak = 0;
    let streakOpen = true;
    let lastFailure: LegStat["lastFailure"] = null;

    for (const run of ordered) {
      const conclusion = run.legs[name];
      if (conclusion === undefined) continue;
      executedRuns++;
      const failed = conclusion === "failure";
      if (failed) {
        failures++;
        const blocked = run.rollup !== "success";
        if (!blocked) nonBlockingFailures++;
        if (lastFailure === null) lastFailure = { runId: run.id, at: run.at, blocked };
        streakOpen = false;
      } else if (streakOpen) {
        cleanStreak++;
      }
    }

    legs.push({
      name,
      classification: classify(failures, nonBlockingFailures),
      executedRuns,
      failures,
      nonBlockingFailures,
      failureRate: executedRuns === 0 ? 0 : failures / executedRuns,
      cleanStreak,
      lastFailure,
    });
  }

  const executedRuns = ordered.filter((r) => Object.keys(r.legs).length > 0).length;
  const cancelledRuns = ordered.filter((r) => r.conclusion === "cancelled").length;

  return {
    runs: ordered.length,
    executedRuns,
    cancelledRuns,
    coverage: ordered.length === 0 ? 0 : executedRuns / ordered.length,
    legs,
    latestRunId: ordered[0]?.id ?? 0,
  };
}

/** Upsert by run id, newest-first, bounded. Apply-N-times == apply-once (discipline #6). */
export function mergeRecords(
  existing: readonly RunRecord[],
  incoming: readonly RunRecord[],
  maxRuns: number,
): readonly RunRecord[] {
  const byId = new Map<number, RunRecord>();
  for (const r of existing) byId.set(r.id, r);
  for (const r of incoming) byId.set(r.id, r);
  return orderNewestFirst([...byId.values()]).slice(0, maxRuns);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

const CLASS_LABEL: Readonly<Record<LegClass, string>> = {
  "non-blocking": "drift check (observed non-blocking)",
  blocking: "BLOCKS the floor (observed)",
  unobserved: "unobserved (no failure in window)",
};

export function renderMarkdown(report: PlatformDriftReport): string {
  const out: string[] = [
    "### Platform drift -- `build-and-test` legs on main",
    "",
    `**Coverage: ${report.executedRuns}/${report.runs} push runs actually executed the matrix** ` +
      `(${pct(report.coverage)}); ${report.cancelledRuns} were cancelled before their legs ran. ` +
      "Every rate below is over the executed runs, never over the pushes.",
    "",
    "| leg | status | executed | failures | rate | clean streak | last failure |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const leg of report.legs) {
    const last =
      leg.lastFailure === null
        ? "--"
        : `run ${leg.lastFailure.runId} (${leg.lastFailure.blocked ? "blocked" : "did NOT block"})`;
    out.push(
      `| \`${leg.name}\` | ${CLASS_LABEL[leg.classification]} | ${leg.executedRuns} | ` +
        `${leg.failures} | ${pct(leg.failureRate)} | ${leg.cleanStreak} | ${last} |`,
    );
  }
  out.push(
    "",
    "A leg marked _drift check_ is non-blocking **by decision** (Aaron 2026-08-19: " +
      '"windows and mac are drift checks ... we don\'t want to block on them"), not by ' +
      "accident. This table is the half of that decision that has to keep being true: " +
      "the drift is observed. A row here is information, never an alarm -- reading it is " +
      "the work.",
    "",
  );
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Edge -- I/O only past this line
// ---------------------------------------------------------------------------

interface ApiRun {
  readonly id: number;
  readonly created_at: string;
  readonly head_sha: string;
  readonly conclusion: string | null;
}

interface ApiJob {
  readonly name: string;
  readonly conclusion: string | null;
}

interface LedgerFile {
  readonly generatedAt?: string;
  readonly records?: readonly RunRecord[];
}

async function ghJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return (await res.json()) as T;
}

async function fetchRunRecord(repo: string, run: ApiRun, token: string): Promise<RunRecord> {
  const base: Omit<RunRecord, "legs" | "rollup"> = {
    id: run.id,
    at: run.created_at,
    sha: run.head_sha,
    conclusion: run.conclusion ?? "unknown",
  };
  // A cancelled run's legs never executed; asking for its jobs buys nothing and costs a call.
  if (base.conclusion === "cancelled") return { ...base, rollup: "absent", legs: {} };

  const payload = await ghJson<{ readonly jobs?: readonly ApiJob[] }>(
    `https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`,
    token,
  );
  const jobs = payload.jobs ?? [];
  const legs: Record<string, string> = {};
  let rollup = "absent";
  for (const job of jobs) {
    if (job.name === ROLLUP_JOB_NAME) rollup = job.conclusion ?? "unknown";
    else if (job.name.startsWith(MATRIX_JOB_PREFIX)) legs[job.name] = job.conclusion ?? "unknown";
  }
  return { ...base, rollup, legs };
}

function readLedger(path: string): readonly RunRecord[] {
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as LedgerFile;
    return parsed.records ?? [];
  } catch {
    // A corrupt ledger must not wedge the tick: rebuild from the API instead.
    return [];
  }
}

function flagValue(argv: readonly string[], flag: string, fallback: string): string {
  const i = argv.indexOf(flag);
  return i >= 0 ? (argv[i + 1] ?? fallback) : fallback;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const out = flagValue(argv, "--out", "data/platform-drift.json");
  const repo = flagValue(argv, "--repo", process.env["GITHUB_REPOSITORY"] ?? "");
  const pages = Number.parseInt(flagValue(argv, "--pages", "1"), 10);
  const maxRuns = Number.parseInt(flagValue(argv, "--max-runs", "500"), 10);
  const offline = argv.includes("--offline");

  const existing = readLedger(out);
  let records = existing;

  if (!offline) {
    const token = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";
    if (token.length === 0 || repo.length === 0) {
      console.log("[platform-drift] no token or repo -- folding the existing ledger only.");
    } else {
      const known = new Set(existing.map((r) => r.id));
      const fresh: RunRecord[] = [];
      for (let page = 1; page <= pages; page++) {
        const url =
          `https://api.github.com/repos/${repo}/actions/workflows/gate.yml/runs` +
          `?branch=main&event=push&status=completed&per_page=100&page=${page}`;
        const listed = await ghJson<{ readonly workflow_runs?: readonly ApiRun[] }>(url, token);
        const runs = listed.workflow_runs ?? [];
        if (runs.length === 0) break;
        for (const run of runs) {
          if (known.has(run.id)) continue;
          fresh.push(await fetchRunRecord(repo, run, token));
        }
      }
      console.log(`[platform-drift] ${fresh.length} new run record(s); ${existing.length} already held.`);
      records = mergeRecords(existing, fresh, maxRuns);
    }
  }

  const report = foldRuns(records);
  const markdown = renderMarkdown(report);
  console.log(markdown);

  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath !== undefined && summaryPath.length > 0) appendFileSync(summaryPath, `${markdown}\n`);

  writeFileSync(
    out,
    `${JSON.stringify(
      {
        // `asOf` is the newest RUN's own timestamp, not `Date.now()`. Two reasons, and
        // both are standing rules here: the file stays a pure function of the evidence
        // (a tick that learned nothing rewrites byte-identical content, so it produces
        // no commit and no churn), and no local wall-clock leaks into a shared artifact.
        asOf: orderNewestFirst(records)[0]?.at ?? null,
        report,
        records,
      },
      null,
      2,
    )}\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
