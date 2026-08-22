#!/usr/bin/env bun
// poll-pr-gate.ts — query GitHub PR gate state for the autonomous loop.
//
// TypeScript+Bun port replacing the inline `gh pr view --json` + jq
// snippets that the poll-the-gate memory file describes
// (memory/feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md).
//
// Origin: 5-AI peer-reviewer convergence on 2026-04-30 (full attribution
// in `docs/research/2026-04-30-multi-ai-feedback-packets-this-session.md`)
// on promoting prose-jq to executable. Carved blade from that packet:
// "if the loop uses it every tick, it deserves tests."
//
// **v1** (2026-04-30): adds required-vs-non-required check classification
// per peer-AI hardening feedback. Total `checks` summary preserved;
// `requiredChecks` summary plus `warnings` array added. nextAction uses
// required-only counts so non-required transient flakes (e.g. submit-nuget
// on this repo) don't produce spurious fix-failed-checks signals.
// The memory file points at this script (per script-supersedes-prose
// discipline); matrix fixture coverage tracked under task #355.
//
// Usage:
//   bun tools/github/poll-pr-gate.ts <PR_NUMBER>
//   bun tools/github/poll-pr-gate.ts <PR_NUMBER> --owner Lucent-Financial-Group --repo Zeta
//   bun tools/github/poll-pr-gate.ts --fixture tools/github/fixtures/blocked-by-threads.json
//
// Output: one JSON object on stdout, shape:
//   {
//     "number": 917,
//     "state": "OPEN" | "MERGED" | "CLOSED",
//     "gate": "CLEAN" | "BLOCKED" | "DIRTY" | "UNSTABLE" | "UNKNOWN",
//     "checks":         { "ok": N, "inProgress": N, "pending": N, "failed": N },
//     "requiredChecks": { "ok": N, "inProgress": N, "pending": N, "failed": N },
//     "unresolvedThreads": 0,
//     "autoMerge": "armed" | "none",
//     "mergeCommit": "0ec21ebe..." | null,
//     "warnings": ["non-required check failed: <name>", ...],
//     "nextAction": "wait-ci" | "fix-failed-checks" | "resolve-threads" | "rebase" | "verify-merge" | "none"
//   }
//
// `checks` counts every status check on the rollup. `requiredChecks`
// counts only the subset that GitHub considers required for merge.
// `nextAction` uses required-only counts so non-required diagnostic
// failures (e.g. transient submit-nuget) surface in `warnings` rather
// than producing spurious fix-failed-checks signals.
//
// Exit codes:
//   0 — query succeeded, JSON emitted
//   1 — invocation / argument / dependency error (bad args, gh missing,
//       fixture missing, PR number <= 0)
//   2 — gh CLI returned non-zero (auth, rate-limit, PR not found)
//   3 — gh CLI output couldn't be parsed (truncated, non-JSON)
//
// Required-check semantics (per peer-AI GitHub-docs verification):
// SUCCESS / NEUTRAL / SKIPPED are merge-satisfying; FAILURE / CANCELLED
// / TIMED_OUT / STARTUP_FAILURE / ACTION_REQUIRED / STALE block.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

type GateState = "CLEAN" | "BLOCKED" | "DIRTY" | "UNSTABLE" | "UNKNOWN";
type NextAction =
  | "wait-ci"
  | "fix-failed-checks"
  | "resolve-threads"
  | "rebase"
  | "verify-merge"
  | "none";

interface CheckRollupItem {
  status?: string;
  conclusion?: string;
  name?: string;
}

interface ReviewThreadNode {
  isResolved: boolean;
}

export interface PullRequestData {
  number: number;
  state: string;
  mergeStateStatus: string;
  autoMergeRequest: { enabledAt?: string } | null;
  mergeCommit: { oid: string } | null;
  statusCheckRollup: CheckRollupItem[];
  reviewThreads: { nodes: ReviewThreadNode[] };
  /** Names of checks that are *required* for merge. Set during fetchPR
   *  via `gh pr checks --required`. Tri-state semantics:
   *  - `undefined` — fetch failed or fixture didn't supply (unknown);
   *    buildReport falls back to v0 semantics (treat all as required).
   *  - `[]` (empty array) — successfully fetched, GitHub reports zero
   *    required checks; treat that as the truth, not as fallback.
   *  - `[...names]` — known required-check name set.
   *  This distinction matters because "fetch failed" and "no required
   *  checks configured" produce different correct behaviors.
   *  (Per v1 hardening peer review 2026-04-30.) */
  requiredCheckNames?: string[];
}

export interface CheckCounts {
  ok: number;
  inProgress: number;
  pending: number;
  failed: number;
}

export interface GateReport {
  number: number;
  state: string;
  gate: GateState;
  /** All checks counted (required + non-required). */
  checks: CheckCounts;
  /** Just the required-for-merge checks. nextAction uses these to
   *  decide failure vs warning (v1 hardening per peer review 2026-04-30 —
   *  "a failed check is not automatically a failed gate"). */
  requiredChecks: CheckCounts;
  unresolvedThreads: number;
  autoMerge: "armed" | "none";
  mergeCommit: string | null;
  /** Diagnostic notes about non-required failures or other lane-state
   *  observations that don't gate merge. */
  warnings: string[];
  nextAction: NextAction;
}

const OK_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const BLOCKING_CONCLUSIONS = new Set([
  "FAILURE",
  "CANCELLED",
  "TIMED_OUT",
  "STARTUP_FAILURE",
  "ACTION_REQUIRED",
  "STALE",
  // StatusContext-class blocking states (per Codex P1):
  "ERROR",
]);
const PENDING_STATUSES = new Set([
  "QUEUED",
  "PENDING",
  // StatusContext-class pending state (per Codex P1):
  "EXPECTED",
  // CheckRun non-terminal states (per Codex P1, second pass):
  "REQUESTED",
  "WAITING",
]);

function classifyChecks(
  rollup: CheckRollupItem[],
  filter?: (item: CheckRollupItem) => boolean,
): CheckCounts {
  let ok = 0;
  let inProgress = 0;
  let pending = 0;
  let failed = 0;
  for (const c of rollup) {
    if (filter && !filter(c)) continue;
    if (c.status === "IN_PROGRESS") {
      inProgress++;
      continue;
    }
    if (c.status && PENDING_STATUSES.has(c.status)) {
      pending++;
      continue;
    }
    if (c.conclusion && OK_CONCLUSIONS.has(c.conclusion)) {
      ok++;
      continue;
    }
    if (c.conclusion && BLOCKING_CONCLUSIONS.has(c.conclusion)) {
      failed++;
    }
  }
  return { ok, inProgress, pending, failed };
}

function nonRequiredFailures(
  rollup: CheckRollupItem[],
  requiredNames: Set<string>,
): string[] {
  const failures: string[] = [];
  for (const c of rollup) {
    if (c.name && requiredNames.has(c.name)) continue;
    if (c.conclusion && BLOCKING_CONCLUSIONS.has(c.conclusion)) {
      if (c.name) failures.push(c.name);
    }
  }
  return failures;
}

function classifyGate(
  mergeStateStatus: string,
  state: string,
  requiredChecks: CheckCounts,
  unresolvedThreads: number,
): GateState {
  if (state === "MERGED") return "CLEAN";
  if (state === "CLOSED") return "CLEAN";
  // DIRTY = merge conflict; BEHIND = base advanced past PR's merge-base
  // (rebase/update needed). Both surface as "rebase" next-action under
  // the DIRTY gate state per Copilot P0 — semantically the same fix.
  if (mergeStateStatus === "DIRTY" || mergeStateStatus === "BEHIND") return "DIRTY";
  if (mergeStateStatus === "UNSTABLE") return "UNSTABLE";
  // Only required-check failures gate the merge (v1 hardening per
  // peer review 2026-04-30). Non-required failures surface as warnings.
  if (requiredChecks.failed > 0) return "BLOCKED";
  if (mergeStateStatus === "BLOCKED") return "BLOCKED";
  if (mergeStateStatus === "CLEAN" && unresolvedThreads === 0) return "CLEAN";
  return "UNKNOWN";
}

function nextAction(report: Omit<GateReport, "nextAction">): NextAction {
  if (report.state === "MERGED") return "verify-merge";
  // CLOSED-without-merge is terminal too — no actionable next step
  // for a PR that can no longer merge (per Codex P2). Avoid chasing
  // stale CI/thread blockers on intentionally-closed PRs.
  if (report.state === "CLOSED") return "none";
  if (report.gate === "DIRTY") return "rebase";
  // Only required-check failures trigger fix-failed-checks. Non-required
  // failures appear in `warnings` but don't gate merge (v1 hardening per
  // peer review — "a failed check is not automatically a failed gate").
  if (report.requiredChecks.failed > 0) return "fix-failed-checks";
  if (report.unresolvedThreads > 0) return "resolve-threads";
  if (
    report.requiredChecks.inProgress > 0 ||
    report.requiredChecks.pending > 0
  ) {
    return "wait-ci";
  }
  return "none";
}

export function buildReport(pr: PullRequestData): GateReport {
  const rollup = pr.statusCheckRollup ?? [];
  const checks = classifyChecks(rollup);
  // Tri-state on requiredCheckNames (v1 hardening per peer review):
  //   undefined → unknown (fetch failed or fixture didn't supply);
  //               fall back to treating all as required (v0 semantics).
  //   defined   → trust as ground truth (even if empty array).
  // This distinguishes "fetch failed" from "no required checks
  // configured" — the latter is a valid state that shouldn't be
  // confused with an unknown.
  const haveRequiredMetadata = pr.requiredCheckNames !== undefined;
  const requiredNames = new Set(pr.requiredCheckNames ?? []);
  const requiredChecks = haveRequiredMetadata
    ? classifyChecks(rollup, (c) => Boolean(c.name && requiredNames.has(c.name)))
    : checks;
  const warnings = haveRequiredMetadata
    ? nonRequiredFailures(rollup, requiredNames).map(
        (name) => `non-required check failed: ${name}`,
      )
    : [];
  const unresolvedThreads = (pr.reviewThreads?.nodes ?? []).filter(
    (t) => !t.isResolved,
  ).length;
  const gate = classifyGate(
    pr.mergeStateStatus,
    pr.state,
    requiredChecks,
    unresolvedThreads,
  );
  const partial: Omit<GateReport, "nextAction"> = {
    number: pr.number,
    state: pr.state,
    gate,
    checks,
    requiredChecks,
    unresolvedThreads,
    autoMerge: pr.autoMergeRequest ? "armed" : "none",
    mergeCommit: pr.mergeCommit?.oid ?? null,
    warnings,
  };
  return { ...partial, nextAction: nextAction(partial) };
}

// Distinct exit codes (per Copilot P1):
//   0 — success
//   1 — invocation / argument / dependency-missing error
//   2 — gh CLI returned non-zero (auth, rate-limit, PR not found)
//   3 — gh CLI output couldn't be parsed (truncated, non-JSON)
// Generous buffer for `gh api graphql --paginate` on discussion-heavy PRs.
// Default Node maxBuffer is 1 MiB which can truncate paginated output and
// cascade into JSON parse failures (per Copilot P1).
const SPAWN_MAX_BUFFER = 32 * 1024 * 1024; // 32 MiB

function runGhOrExit(args: string[], context: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh is a
  // standard CI/dev dependency invoked by name; convention used across
  // tools/peer-call/, tools/pr-preservation/, tools/audit-packages.ts.
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.error) {
    // ENOENT etc — gh is not on PATH or couldn't be launched
    process.stderr.write(`${context}: failed to launch gh: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(
      `${context}: gh exited ${result.status}: ${result.stderr || result.stdout}\n`,
    );
    process.exit(2);
  }
  return result.stdout;
}

function parseJsonOrExit<T>(raw: string, context: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${context}: JSON parse error: ${msg}\n`);
    process.stderr.write(`first 200 bytes of output: ${raw.slice(0, 200)}\n`);
    process.exit(3);
  }
}

function fetchPR(
  owner: string,
  repo: string,
  number: number,
): PullRequestData {
  // Use `gh pr view --json` which flattens StatusCheckRollup into a uniform
  // array (CheckRun + StatusContext both surfaced as items with status/
  // conclusion/name fields). Pair with a separate `gh api graphql` call for
  // reviewThreads since `gh pr view --json reviewThreads` is not supported.
  const prStdout = runGhOrExit(
    [
      "pr",
      "view",
      String(number),
      "--repo",
      `${owner}/${repo}`,
      "--json",
      "number,state,mergeStateStatus,autoMergeRequest,mergeCommit,statusCheckRollup",
    ],
    "fetchPR.gh-pr-view",
  );
  const pr = parseJsonOrExit<Record<string, unknown>>(prStdout, "fetchPR.gh-pr-view");

  // Paginate review threads manually — discussion-heavy PRs can have >50.
  // `gh api graphql --paginate` concatenates pages WITHOUT newlines (unlike
  // `gh api --paginate` for REST, which is line-oriented), so a
  // split('\n')-then-parse approach silently drops continuation pages on
  // PRs with >100 threads. Drive pagination from TS via the endCursor.
  const allNodes: ReviewThreadNode[] = [];
  let endCursor: string | null = null;
  let hasNextPage = true;
  const threadsQuery = `query=query($o:String!,$r:String!,$n:Int!,$endCursor:String){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100,after:$endCursor){pageInfo{hasNextPage endCursor}nodes{isResolved}}}}}`;
  while (hasNextPage) {
    const args = [
      "api",
      "graphql",
      "-f",
      threadsQuery,
      "-F",
      `o=${owner}`,
      "-F",
      `r=${repo}`,
      "-F",
      `n=${number}`,
    ];
    if (endCursor !== null) args.push("-f", `endCursor=${endCursor}`);
    const pageStdout = runGhOrExit(args, "fetchPR.gh-graphql-threads");
    const parsed = parseJsonOrExit<{
      data?: {
        repository?: {
          pullRequest?: {
            reviewThreads?: {
              pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
              nodes?: ReviewThreadNode[];
            };
          };
        };
      };
    }>(pageStdout, "fetchPR.gh-graphql-threads.page");
    const threads = parsed.data?.repository?.pullRequest?.reviewThreads;
    allNodes.push(...(threads?.nodes ?? []));
    hasNextPage = threads?.pageInfo?.hasNextPage ?? false;
    endCursor = threads?.pageInfo?.endCursor ?? null;
    if (hasNextPage && endCursor === null) break; // safety: stale cursor
  }
  const reviewThreads = { nodes: allNodes };

  // Fetch required-check names so buildReport can distinguish required-
  // gate failures from non-required diagnostic noise (v1 hardening per peer review
  // 2026-04-30). Use `gh pr checks --required --json name`. The flag
  // returns only the checks GitHub considers required for merge.
  // Failure here is non-fatal: if the API errors (e.g., classic-vs-ruleset
  // protection edge cases), fall back to v0 semantics (treat all as required)
  // rather than crashing the poll.
  // Tri-state: undefined = fetch failed (fall back to v0 semantics);
  // defined (even if empty) = trust the result. See PullRequestData.
  let requiredCheckNames: string[] | undefined;
  const requiredResult = spawnSync(
    "gh",
    [
      "pr",
      "checks",
      String(number),
      "--repo",
      `${owner}/${repo}`,
      "--required",
      "--json",
      "name",
    ],
    { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER },
  );
  // `gh pr checks` exit codes (per `gh help exit-codes`):
  //   0 — OK
  //   1 — invalid invocation
  //   2 — gh CLI error / auth / etc.
  //   4 — one or more checks failed (data is still valid JSON)
  //   8 — checks pending (data is still valid JSON — common in-progress case)
  // The JSON output is well-formed for 0/4/8 — only 1/2 mean "no usable
  // data." Treating only exit 0 as success (per Codex P1 catch) would
  // defeat the v1 fix in the exact case it targets: required checks
  // pending while a non-required check failed. Accept 0/4/8 as parseable.
  const requiredStatus = requiredResult.status;
  if (requiredStatus === 0 || requiredStatus === 4 || requiredStatus === 8) {
    try {
      const required = JSON.parse(requiredResult.stdout) as Array<{
        name?: string;
      }>;
      requiredCheckNames = required
        .map((r) => r.name)
        .filter((n): n is string => typeof n === "string");
    } catch {
      // Parse error — leave undefined so buildReport falls back to v0.
    }
  }

  const prNarrowed = pr as unknown as PullRequestData;
  const rollup = (prNarrowed.statusCheckRollup ?? []) as unknown[];

  const result: PullRequestData = {
    ...prNarrowed,
    statusCheckRollup: normalizeRollup(rollup),
    reviewThreads,
  };
  if (requiredCheckNames !== undefined) {
    result.requiredCheckNames = requiredCheckNames;
  }
  return result;
}

// StatusContext items (gh pr view --json output for non-CheckRun checks)
// expose .state instead of .status/.conclusion. Normalise to the CheckRun
// shape so classifyChecks's OK_CONCLUSIONS / BLOCKING_CONCLUSIONS sets
// pick them up. StatusContext states per GitHub schema: SUCCESS | FAILURE
// | PENDING | ERROR | EXPECTED. PENDING and EXPECTED both map to
// status=PENDING (CI still running); the rest map to status=COMPLETED
// with state forwarded as conclusion (per Codex P1).
const PENDING_STATE_LITERALS = new Set(["PENDING", "EXPECTED"]);
function normalizeRollup(rollup: unknown[]): CheckRollupItem[] {
  return rollup.map((raw) => {
    const c = raw as Record<string, unknown>;
    if (typeof c.state === "string" && c.status === undefined) {
      const state = c.state as string;
      const isPendingState = PENDING_STATE_LITERALS.has(state);
      const name =
        (c.context as string | undefined) ?? (c.name as string | undefined);
      const item: CheckRollupItem = {
        status: isPendingState ? "PENDING" : "COMPLETED",
      };
      if (name !== undefined) item.name = name;
      if (!isPendingState) item.conclusion = state;
      return item;
    }
    return c as CheckRollupItem;
  });
}

export function loadFixture(path: string): PullRequestData {
  let raw: PullRequestData;
  try {
    raw = JSON.parse(readFileSync(path, "utf8")) as PullRequestData;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`failed to load fixture ${path}: ${msg}\n`);
    process.exit(1);
  }
  // Apply the same StatusContext-state normalization as fetchPR so fixture
  // mode and live mode classify identically (Codex P1).
  return {
    ...raw,
    statusCheckRollup: normalizeRollup(raw.statusCheckRollup ?? []),
  };
}

interface ParsedArgs {
  fixture?: string;
  owner: string;
  repo: string;
  number?: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    owner: "Lucent-Financial-Group",
    repo: "Zeta",
  };
  const requireValue = (flag: string, v: string | undefined): string => {
    if (v === undefined || v.startsWith("--")) {
      process.stderr.write(`${flag} requires a value\n`);
      process.exit(1);
    }
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--fixture") {
      out.fixture = requireValue("--fixture", argv[++i]);
    } else if (arg === "--owner") {
      out.owner = requireValue("--owner", argv[++i]);
    } else if (arg === "--repo") {
      out.repo = requireValue("--repo", argv[++i]);
    } else if (/^\d+$/.test(arg)) {
      const parsed = Number.parseInt(arg, 10);
      if (parsed <= 0) {
        process.stderr.write("PR number must be a positive integer\n");
        process.exit(1);
      }
      out.number = parsed;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: poll-pr-gate.ts <PR_NUMBER> [--owner X] [--repo Y]\n" +
          "       poll-pr-gate.ts --fixture path/to/fixture.json\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`unknown arg: ${arg}\n`);
      process.exit(1);
    }
  }
  return out;
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  let pr: PullRequestData;
  if (args.fixture) {
    pr = loadFixture(args.fixture);
  } else if (args.number !== undefined) {
    pr = fetchPR(args.owner, args.repo, args.number);
  } else {
    process.stderr.write("must provide PR number or --fixture\n");
    return 1;
  }
  const report = buildReport(pr);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
