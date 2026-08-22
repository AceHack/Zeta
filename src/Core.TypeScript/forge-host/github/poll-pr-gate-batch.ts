#!/usr/bin/env bun
// poll-pr-gate-batch.ts — refresh world model across many PRs in one call.
//
// Wraps `poll-pr-gate.ts` (single-PR gate query) and runs it in parallel
// for a list of PR numbers, then aggregates the per-PR JSON reports
// into one stable, structured payload for the autonomous-loop tick or
// the conversation window. This is the multi-PR refresh-world-model
// tool — replaces ad-hoc `for n in 1 2 3; do gh pr view $n …; done`
// bash loops per the human maintainer's directive 2026-05-01: write a
// batch version of the ts that calls this one — not bash, not .sh,
// not .ps1, not dynamic bash.
//
// Origin: task #355 (5-AI peer convergence on poll-the-gate as
// executable script with fixtures); follow-on to v1 single-PR script.
// Full attribution lineage in:
//   - memory/feedback_prefer_ts_scripts_over_dynamic_bash_for_conversation_ux_dst_in_ts_aaron_2026_05_01.md
//   - memory/feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md
//   - memory/feedback_first_class_for_us_not_for_our_host_portability_over_host_coupling_aaron_2026_05_01.md
//
// Usage:
//   bun tools/github/poll-pr-gate-batch.ts <PR1> <PR2> <PR3> ...
//   bun tools/github/poll-pr-gate-batch.ts --all-open
//   bun tools/github/poll-pr-gate-batch.ts --all-open --owner Lucent-Financial-Group --repo Zeta
//   bun tools/github/poll-pr-gate-batch.ts --concurrency 4 1152 1145 1130
//   bun tools/github/poll-pr-gate-batch.ts --summary-only --all-open
//
// Output: one JSON object on stdout, shape:
//   {
//     "owner": "Lucent-Financial-Group",
//     "repo": "Zeta",
//     "queriedAt": "2026-05-01T20:30:00.000Z",
//     "count": 3,
//     "summary": {
//       "byGate": { "CLEAN": 1, "BLOCKED": 1, "DIRTY": 0, "UNSTABLE": 0, "UNKNOWN": 1 },
//       "byNextAction": { "verify-merge": 1, "resolve-threads": 1, "wait-ci": 1, ... },
//       "byState": { "OPEN": 2, "MERGED": 1, "CLOSED": 0 },
//       "actionable": [1145, 1130],         // PRs whose nextAction != "none" / "verify-merge"
//       "warnings": ["#1145: non-required check failed: foo", ...]
//     },
//     "reports": [ <GateReport>, <GateReport>, ... ],   // one per PR, ordered by input
//     "errors":  [ { "number": 1149, "exitCode": 2, "stderr": "..." }, ... ]
//   }
//
// Concurrency: defaults to 4 in-flight gh calls; each individual poll
// fans out to two gh subcommands plus pagination, so high concurrency
// can hit GitHub rate limits on a slow tick. Tune via --concurrency.
//
// Exit codes:
//   0 — all queries succeeded (errors[] is empty)
//   1 — invocation / argument error (bad args, no PRs given)
//   2 — at least one per-PR query failed (errors[] non-empty); the
//       successful reports are still emitted in `reports`. Caller can
//       distinguish full failure vs partial failure by checking
//       `count === reports.length` vs `errors.length`.

import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { allActiveClaims } from "../../bus/claim.ts";
import type { ClaimRecord } from "../../bus/claim.ts";
import { PriorityFerryThrottlerWithResult } from "../../ferry-throttler/priority-ferry-throttler-with-result.ts";
import type { PriorityFerryThrottlerConfig } from "../../ferry-throttler/priority-config.ts";
import type { ProcessBatchWithResult } from "../../ferry-throttler/ferry-throttler.ts";
import { readPRState } from "../../observe/world-infra.ts";

export interface CheckCounts {
  ok: number;
  inProgress: number;
  pending: number;
  failed: number;
}

export interface GateReport {
  number: number;
  state: string;
  gate: "CLEAN" | "BLOCKED" | "DIRTY" | "UNSTABLE" | "UNKNOWN";
  checks: CheckCounts;
  requiredChecks: CheckCounts;
  unresolvedThreads: number;
  autoMerge: "armed" | "none";
  mergeCommit: string | null;
  warnings: string[];
  nextAction:
    | "wait-ci"
    | "fix-failed-checks"
    | "resolve-threads"
    | "rebase"
    | "verify-merge"
    | "none";
}

export interface PollError {
  number: number;
  exitCode: number;
  stderr: string;
}

export interface BatchSummary {
  byGate: Record<string, number>;
  byNextAction: Record<string, number>;
  byState: Record<string, number>;
  actionable: number[];
  warnings: string[];
}

export interface BatchReport {
  owner: string;
  repo: string;
  queriedAt: string;
  count: number;
  summary: BatchSummary;
  reports: GateReport[];
  errors: PollError[];
  /** Active bus claims across all backlog items — present only when --with-bus-claims */
  busClaims?: ClaimRecord[];
}

interface ParsedArgs {
  owner: string;
  repo: string;
  concurrency: number;
  prs: number[];
  allOpen: boolean;
  summaryOnly: boolean;
  withBusClaims: boolean;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const POLL_SCRIPT = resolve(HERE, "poll-pr-gate.ts");

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    owner: "Lucent-Financial-Group",
    repo: "Zeta",
    concurrency: 4,
    prs: [],
    allOpen: false,
    summaryOnly: false,
    withBusClaims: false,
  };
  const requireValue = (flag: string, v: string | undefined): string => {
    // Reject any value starting with `-` (not just `--`), so that
    // `--owner -h` doesn't silently consume `-h` as the flag value.
    // Matches the parsing pattern in tools/github/check-github-status.ts.
    // (Copilot review on PR #1153 2026-05-01.)
    if (v === undefined || v.startsWith("-")) {
      process.stderr.write(`${flag} requires a value\n`);
      process.exit(1);
    }
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--owner") {
      out.owner = requireValue("--owner", argv[++i]);
    } else if (arg === "--repo") {
      out.repo = requireValue("--repo", argv[++i]);
    } else if (arg === "--concurrency") {
      const v = requireValue("--concurrency", argv[++i]);
      const n = Number.parseInt(v, 10);
      if (!Number.isFinite(n) || n <= 0) {
        process.stderr.write(`--concurrency must be a positive integer (got ${v})\n`);
        process.exit(1);
      }
      out.concurrency = n;
    } else if (arg === "--all-open") {
      out.allOpen = true;
    } else if (arg === "--summary-only") {
      out.summaryOnly = true;
    } else if (arg === "--with-bus-claims") {
      out.withBusClaims = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: poll-pr-gate-batch.ts <PR1> <PR2> ...\n" +
          "       poll-pr-gate-batch.ts --all-open [--owner X] [--repo Y]\n" +
          "       poll-pr-gate-batch.ts --concurrency N <PRs...>\n" +
          "       poll-pr-gate-batch.ts --summary-only --all-open\n" +
          "       poll-pr-gate-batch.ts --with-bus-claims 1234 5678\n",
      );
      process.exit(0);
    } else if (/^\d+$/.test(arg)) {
      const n = Number.parseInt(arg, 10);
      if (n <= 0) {
        process.stderr.write(`PR number must be a positive integer (got ${arg})\n`);
        process.exit(1);
      }
      out.prs.push(n);
    } else {
      process.stderr.write(`unknown arg: ${arg}\n`);
      process.exit(1);
    }
  }
  if (!out.allOpen && out.prs.length === 0) {
    process.stderr.write(
      "must provide PR numbers or --all-open (try --help)\n",
    );
    process.exit(1);
  }
  return out;
}

function listOpenPRs(owner: string, repo: string): number[] {
  // Enumerate all open PRs via `gh api --paginate` so repos with
  // more than 1000 open PRs don't get silently truncated (Codex P2
  // on PR #1153, 2026-05-01). The paginated REST API follows Link
  // headers automatically.
  //
  // Use `--jq '.[].number'` to project each page to one PR number
  // per line (line-oriented primitive output) instead of trying to
  // parse the page bodies as JSON. `gh api` may pretty-print page
  // bodies across multiple lines for REST endpoints, breaking any
  // line-split-then-JSON-parse approach (Codex P2 + Copilot P1 on
  // PR #1153 2026-05-01). The jq filter sidesteps the issue
  // entirely — stdout becomes a stream of integers, one per line.
  const result = spawnSync(
    "gh",
    [
      "api",
      "--paginate",
      `/repos/${owner}/${repo}/pulls?state=open&per_page=100`,
      "--jq",
      ".[].number",
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (result.error) {
    process.stderr.write(`failed to launch gh: ${result.error.message}\n`);
    process.exit(2);
  }
  if (result.status !== 0) {
    process.stderr.write(
      `gh api --paginate exited ${result.status}: ${result.stderr || result.stdout}\n`,
    );
    process.exit(2);
  }
  // Each non-empty line is one PR number — guaranteed by the jq
  // filter. Parse each as an integer; skip malformed lines defensively.
  const all: number[] = [];
  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const n = Number.parseInt(trimmed, 10);
    if (Number.isFinite(n) && n > 0) all.push(n);
  }
  return all;
}

export interface PollOutcome {
  number: number;
  report?: GateReport;
  error?: PollError;
}

function pollOne(
  prNumber: number,
  owner: string,
  repo: string,
): Promise<PollOutcome> {
  return new Promise((resolveOutcome) => {
    // Spawn the existing single-PR script. Async spawn (not spawnSync)
    // so Promise.all-style fan-out actually overlaps — gh CLI is the
    // dominant cost; bun startup is ~50ms each but doesn't serialise.
    // This is the literal "calls this one" pattern: child invocation
    // via the same on-disk script the maintainer reaches for manually.
    // Default stdio (omitted) gives ['pipe','pipe','pipe'] without
    // the explicit-stdio TS narrowing problem: when `stdio` is
    // explicitly specified, TypeScript types `child.stdout`/`stderr`
    // as nullable, breaking the repo's strict tsc gate. Default
    // pipes give non-null streams. Explicitly close stdin since we
    // never write to it. (Copilot review on PR #1153 2026-05-01.)
    const child = spawn("bun", [
      POLL_SCRIPT,
      String(prNumber),
      "--owner",
      owner,
      "--repo",
      repo,
    ]);
    child.stdin.end();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
    child.stderr.on("data", (c: Buffer) => stderrChunks.push(c));
    child.on("error", (err) => {
      resolveOutcome({
        number: prNumber,
        error: {
          number: prNumber,
          exitCode: -1,
          stderr: `spawn error: ${err.message}`,
        },
      });
    });
    child.on("close", (code) => {
      const exitCode = code ?? -1;
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (exitCode !== 0) {
        resolveOutcome({
          number: prNumber,
          error: { number: prNumber, exitCode, stderr },
        });
        return;
      }
      try {
        const report = JSON.parse(stdout) as GateReport;
        resolveOutcome({ number: prNumber, report });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        resolveOutcome({
          number: prNumber,
          error: {
            number: prNumber,
            exitCode: 3,
            stderr: `JSON parse error: ${msg}\nfirst 200 bytes: ${stdout.slice(0, 200)}`,
          },
        });
      }
    });
  });
}

type PollFn = (
  prNumber: number,
  owner: string,
  repo: string,
) => Promise<PollOutcome>;

/** Injectable bus-claims provider — default reads from /tmp/zeta-bus; override in tests. */
export type BusClaimsFn = () => ClaimRecord[];

/** Injectable prior-state reader so orchestration tests never need the forge CLI. */
export type ReadPRStateFn = typeof readPRState;

export async function pollAllBounded(
  prs: number[],
  owner: string,
  repo: string,
  concurrency: number,
  pollFn: PollFn = pollOne,
  urgentPrs?: ReadonlySet<number>,
): Promise<PollOutcome[]> {
  // PriorityFerryThrottlerWithResult replaces the manual worker-pool pattern.
  // Each PR is one item; maxBatchSize=1 because each poll is independent
  // (the child process fans out to 2-3 gh calls internally). Priority 0 =
  // urgent/actionable PRs, priority 1 = background.
  //
  // When `urgentPrs` is provided (a set of PR numbers known to be actionable
  // from prior state — DIRTY gate, failing checks, unresolved threads), those
  // PRs enter the high-priority lane and drain first under strict scheduling.
  if (prs.length === 0) return [];

  const config: PriorityFerryThrottlerConfig = {
    maxDegreeOfParallelism: Math.min(concurrency, prs.length),
    defaultMaxBatchSize: 1,
    defaultMaxBatchBytes: undefined,
    lanes: [
      { priority: 0 },  // urgent (actionable PRs)
      { priority: 1 },  // background (all others)
    ],
    defaultPriority: 1,
    drainingPolicy: { kind: "strict" },
  };

  const processBatch: ProcessBatchWithResult<number, PollOutcome> = async (boat) => {
    // Each boat has exactly 1 item (maxBatchSize=1), so we poll that one PR.
    const results: PollOutcome[] = [];
    for (const prNumber of boat) {
      try {
        results.push(await pollFn(prNumber, owner, repo));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          number: prNumber,
          error: { number: prNumber, exitCode: -1, stderr: `pollFn rejected: ${msg}` },
        });
      }
    }
    return results;
  };

  const throttler = new PriorityFerryThrottlerWithResult<number, PollOutcome>(config, processBatch);

  // Submit all PRs with priority classification. Urgent PRs (known actionable
  // from prior state) enter lane 0; others enter lane 1 (background).
  const resultPromises: Promise<PollOutcome>[] = prs.map((pr) => {
    const priority = urgentPrs?.has(pr) ? 0 : 1;
    return throttler.process(pr, priority);
  });

  // Signal completion and wait for all ferries to drain
  await throttler.complete();
  return Promise.all(resultPromises);
}

export function summarize(reports: GateReport[]): BatchSummary {
  const byGate: Record<string, number> = {};
  const byNextAction: Record<string, number> = {};
  const byState: Record<string, number> = {};
  const actionable: number[] = [];
  const warnings: string[] = [];
  for (const r of reports) {
    byGate[r.gate] = (byGate[r.gate] ?? 0) + 1;
    byNextAction[r.nextAction] = (byNextAction[r.nextAction] ?? 0) + 1;
    byState[r.state] = (byState[r.state] ?? 0) + 1;
    if (r.nextAction !== "none" && r.nextAction !== "verify-merge") {
      actionable.push(r.number);
    }
    for (const w of r.warnings) {
      warnings.push(`#${r.number}: ${w}`);
    }
  }
  return { byGate, byNextAction, byState, actionable, warnings };
}

export async function main(
  argv: string[],
  busClaimsFn: BusClaimsFn = allActiveClaims,
  pollFn: PollFn = pollOne,
  readPRStateFn: ReadPRStateFn = readPRState,
): Promise<number> {
  const args = parseArgs(argv);
  const prs = args.allOpen ? listOpenPRs(args.owner, args.repo) : args.prs;
  if (prs.length === 0) {
    // --all-open with no open PRs is a valid empty result, not an error.
    const empty: BatchReport = {
      owner: args.owner,
      repo: args.repo,
      queriedAt: new Date().toISOString(),
      count: 0,
      summary: {
        byGate: {},
        byNextAction: {},
        byState: {},
        actionable: [],
        warnings: [],
      },
      reports: [],
      errors: [],
      ...(args.withBusClaims && { busClaims: busClaimsFn() }),
    };
    process.stdout.write(`${JSON.stringify(empty, null, 2)}\n`);
    return 0;
  }
  // Classify urgent PRs from prior state: any PR that is NOT CLEAN is
  // potentially actionable and should be polled first (strict priority lane 0).
  // PRs known to be CLEAN from the last world-infra snapshot are background.
  // This is the observe loop's priority wiring: urgent PRs drain before
  // background PRs, so actionable signals surface with minimal latency.
  let urgentPrs: Set<number> | undefined;
  // Priority cannot change a one-item order. Avoid an ambient forge process in
  // that common path and keep injected single-PR tests genuinely hermetic.
  if (prs.length > 1) {
    try {
      const prState = readPRStateFn();
      const cleanNumbers = new Set(prState.clean.map((p) => p.number));
      // Any PR in our poll list that is NOT in the clean set is urgent.
      const urgent = prs.filter((n) => !cleanNumbers.has(n));
      if (urgent.length > 0 && urgent.length < prs.length) {
        urgentPrs = new Set(urgent);
      }
    } catch {
      // readPRState() depends on `gh` being available; if it fails, all PRs
      // get background priority (no classification — graceful degradation).
    }
  }
  const outcomes = await pollAllBounded(prs, args.owner, args.repo, args.concurrency, pollFn, urgentPrs);
  const reports: GateReport[] = [];
  const errors: PollError[] = [];
  for (const o of outcomes) {
    if (o.report) reports.push(o.report);
    if (o.error) errors.push(o.error);
  }
  const batch: BatchReport = {
    owner: args.owner,
    repo: args.repo,
    queriedAt: new Date().toISOString(),
    count: prs.length,
    summary: summarize(reports),
    reports: args.summaryOnly ? [] : reports,
    errors,
    ...(args.withBusClaims && { busClaims: busClaimsFn() }),
  };
  process.stdout.write(`${JSON.stringify(batch, null, 2)}\n`);
  return errors.length > 0 ? 2 : 0;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`unhandled error: ${msg}\n`);
      process.exit(1);
    },
  );
}
