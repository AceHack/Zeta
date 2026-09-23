#!/usr/bin/env bun
/**
 * wait-run.ts — wait for ONE GitHub Actions workflow run to complete, then say what happened.
 *
 * WHY. Agents kept writing `waitjob.sh` / `watch.sh` and raw `gh api` loops for this, and no two
 * of them agreed on when to stop, how fast to poll, or what an API error meant. This is the one
 * homemade answer. REST only: every probe is `GET repos/{nwo}/actions/...` (or `pulls/{n}` once,
 * to resolve a PR's head), never `gh run view` / `gh pr view`, which spend the contested GraphQL
 * budget (`.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md`).
 *
 * Usage:
 *   bun src/Core.TypeScript/forge-host/github/wait-run.ts --run-id <id>
 *   bun src/Core.TypeScript/forge-host/github/wait-run.ts --pr <n> --workflow gate.yml
 *   bun src/Core.TypeScript/forge-host/github/wait-run.ts --sha <sha> --workflow gate.yml
 *     [--repo owner/name] [--timeout 45m] [--interval 60]
 *
 * THREE OUTCOMES, AND THE THIRD IS NOT A FAILURE:
 *   completed  — the run was observed with status=completed. `conclusion` + per-job detail follow.
 *   timed-out  — the deadline passed, and the LAST probe SUCCEEDED and showed it still running
 *                (or showed no run for that SHA yet). That is an observation.
 *   unknown    — we could not observe: a non-retryable API error, or the deadline passed while
 *                the last probe was FAILING. A failed probe is `unknown`, never a negative
 *                result; it is never reported as success or failure.
 *
 * Exit codes:
 *   0  completed, conclusion success / neutral / skipped
 *   1  completed, any other conclusion (failure, cancelled, timed_out, ...)
 *   2  usage error — nothing was observed
 *   3  timed-out
 *   4  unknown
 *
 * Rate budget: the poll interval defaults to 60 s and is floored at 20 s ON PURPOSE — a CI run
 * takes minutes, so a faster poll buys nothing but spend. On a rate-limit answer (429, or a 403
 * whose body names a rate limit: the SECONDARY limit never shows in `rate_limit` counters) the
 * delay doubles per consecutive failure, capped at 15 minutes and at the deadline. Network
 * errors back off the same way, one step gentler.
 *
 * The loop stops when the GOAL is met — the run is completed — however it got there; it never
 * stops because its own probe "succeeded". Clock and sleep are injected (DST: a test replays the
 * whole loop with a fake clock and a fake forge, no timers, no sockets).
 */

import type { ForgeError, Result } from "../types";
import { err, forgeError, ok } from "../result";
import type { GithubRest } from "./github-pr-rest.ts";
import {
  classifyProbeError,
  defaultGithubRest,
  nextDelayMs,
  parseNwo,
  requestWithBackoff,
} from "./github-rest-transport.ts";

export { classifyProbeError, MAX_BACKOFF_MS, nextDelayMs, type ErrorClass } from "./github-rest-transport.ts";

// ─── Types ─────────────────────────────────────────────────────────────────

export type RunTarget =
  | { readonly kind: "run-id"; readonly runId: number }
  | { readonly kind: "pr"; readonly pr: number; readonly workflow: string }
  | { readonly kind: "sha"; readonly sha: string; readonly workflow: string };

export interface RestRun {
  readonly id: number;
  readonly name?: string | null;
  readonly path?: string;
  readonly head_sha: string;
  readonly head_branch?: string | null;
  readonly event?: string;
  readonly status: string | null;
  readonly conclusion: string | null;
  readonly html_url?: string;
  readonly run_attempt?: number;
  readonly created_at?: string;
}

export interface RestStep {
  readonly name: string;
  readonly status?: string;
  readonly conclusion: string | null;
  readonly number?: number;
}

export interface RestJob {
  readonly id: number;
  readonly name: string;
  readonly status: string | null;
  readonly conclusion: string | null;
  readonly html_url?: string | null;
  readonly steps?: readonly RestStep[];
}

export interface JobSummary {
  readonly name: string;
  readonly status: string | null;
  readonly conclusion: string | null;
  readonly failingSteps: readonly string[];
}

export interface RunSummary {
  readonly id: number;
  readonly name: string | null;
  readonly workflowPath: string | null;
  readonly headSha: string;
  readonly headBranch: string | null;
  readonly event: string | null;
  readonly status: string | null;
  readonly runAttempt: number | null;
  readonly url: string | null;
}

export type Outcome = "completed" | "timed-out" | "unknown";

export interface WaitVerdict {
  readonly outcome: Outcome;
  readonly target: RunTarget;
  readonly run: RunSummary | null;
  readonly conclusion: string | null;
  /** `null` when the run completed but its jobs could not be read — the conclusion still stands. */
  readonly jobs: readonly JobSummary[] | null;
  readonly failedJobs: readonly string[];
  readonly reason: string | null;
  readonly probes: number;
  readonly elapsedSeconds: number;
}

/** What one probe saw. `no-run-yet` is a SUCCESSFUL observation that no matching run exists. */
export type Observation =
  | { readonly kind: "run"; readonly run: RestRun }
  | { readonly kind: "no-run-yet" }
  | { readonly kind: "error"; readonly error: ForgeError };

export type Step =
  | { readonly kind: "completed"; readonly run: RestRun }
  | { readonly kind: "timed-out"; readonly reason: string }
  | { readonly kind: "unknown"; readonly reason: string }
  | { readonly kind: "wait"; readonly delayMs: number };

// ─── Pure decision logic ───────────────────────────────────────────────────

export const MIN_INTERVAL_MS = 20_000;
export const DEFAULT_INTERVAL_MS = 60_000;
export const DEFAULT_TIMEOUT_MS = 60 * 60_000;

const SUCCESS_CONCLUSIONS: ReadonlySet<string> = new Set(["success", "neutral", "skipped"]);
const FAILING_CONCLUSIONS: ReadonlySet<string> = new Set([
  "failure",
  "cancelled",
  "timed_out",
  "startup_failure",
  "action_required",
  "stale",
]);

/** Floor the caller's interval. A poll faster than the floor spends budget and learns nothing. */
export function effectiveIntervalMs(requestedMs: number): number {
  if (!Number.isFinite(requestedMs)) return DEFAULT_INTERVAL_MS;
  return Math.max(requestedMs, MIN_INTERVAL_MS);
}

/**
 * THE CENTRAL DECISION: given what a probe just saw, stop (and with which of the three
 * outcomes) or wait (and how long).
 *
 * The one asymmetry that matters: at the deadline, a SUCCESSFUL probe showing "still running"
 * is `timed-out`, but a FAILED probe is `unknown` — the run may well have finished while we were
 * blind, and saying "timed out" would report a guess as an observation.
 */
export function decideAfterObservation(
  obs: Observation,
  ctx: {
    readonly nowMs: number;
    readonly deadlineMs: number;
    readonly intervalMs: number;
    readonly consecutiveFailures: number;
  },
): Step {
  if (obs.kind === "run" && obs.run.status === "completed") return { kind: "completed", run: obs.run };
  const pastDeadline = ctx.nowMs >= ctx.deadlineMs;
  if (obs.kind === "error") {
    const cls = classifyProbeError(obs.error);
    if (cls === "fatal") {
      return { kind: "unknown", reason: `probe failed (${obs.error.kind}, not retryable): ${obs.error.message}` };
    }
    if (pastDeadline) {
      return {
        kind: "unknown",
        reason: `deadline reached while the last probe was failing (${cls}): ${obs.error.message}`,
      };
    }
    return { kind: "wait", delayMs: nextDelayMs(ctx.intervalMs, ctx.consecutiveFailures, cls) };
  }
  if (pastDeadline) {
    return {
      kind: "timed-out",
      reason:
        obs.kind === "no-run-yet"
          ? "deadline reached; no run for this commit and workflow was ever observed"
          : `deadline reached; run last observed with status=${String(obs.run.status)}`,
    };
  }
  return { kind: "wait", delayMs: ctx.intervalMs };
}

/** A job's failing step names. A step only fails by its own conclusion, never by the job's. */
export function summarizeJob(job: RestJob): JobSummary {
  const failingSteps = (job.steps ?? [])
    .filter((s) => s.conclusion !== null && FAILING_CONCLUSIONS.has(s.conclusion))
    .map((s) => s.name);
  return { name: job.name, status: job.status, conclusion: job.conclusion, failingSteps };
}

export function failedJobNames(jobs: readonly JobSummary[]): readonly string[] {
  return jobs.filter((j) => j.conclusion !== null && FAILING_CONCLUSIONS.has(j.conclusion)).map((j) => j.name);
}

/** Latest run of a list: newest `created_at`, ties broken by the larger id. */
export function pickLatestRun(runs: readonly RestRun[]): RestRun | null {
  let best: RestRun | null = null;
  for (const r of runs) {
    if (best === null) {
      best = r;
      continue;
    }
    const a = r.created_at ?? "";
    const b = best.created_at ?? "";
    if (a > b || (a === b && r.id > best.id)) best = r;
  }
  return best;
}

export function summarizeRun(run: RestRun): RunSummary {
  return {
    id: run.id,
    name: run.name ?? null,
    workflowPath: run.path ?? null,
    headSha: run.head_sha,
    headBranch: run.head_branch ?? null,
    event: run.event ?? null,
    status: run.status,
    runAttempt: run.run_attempt ?? null,
    url: run.html_url ?? null,
  };
}

export function exitCodeFor(v: Pick<WaitVerdict, "outcome" | "conclusion">): number {
  if (v.outcome === "unknown") return 4;
  if (v.outcome === "timed-out") return 3;
  return v.conclusion !== null && SUCCESS_CONCLUSIONS.has(v.conclusion) ? 0 : 1;
}

// ─── Parsing (pure) ────────────────────────────────────────────────────────

function parseJsonText(text: string, what: string): Result<unknown, ForgeError> {
  try {
    return ok(JSON.parse(text));
  } catch (e) {
    return err(forgeError("parse-failure", `${what}: ${e instanceof Error ? e.message : String(e)}`));
  }
}

function isRestRun(v: unknown): v is RestRun {
  if (typeof v !== "object" || v === null) return false;
  const r = v as RestRun;
  return typeof r.id === "number" && typeof r.head_sha === "string" && (typeof r.status === "string" || r.status === null);
}

export function parseRun(text: string): Result<RestRun, ForgeError> {
  const parsed = parseJsonText(text, "workflow run");
  if (!parsed.ok) return parsed;
  return isRestRun(parsed.value) ? ok(parsed.value) : err(forgeError("parse-failure", "workflow run: unexpected shape"));
}

export function parseRunList(text: string): Result<readonly RestRun[], ForgeError> {
  const parsed = parseJsonText(text, "workflow runs");
  if (!parsed.ok) return parsed;
  const runs = (parsed.value as { workflow_runs?: unknown }).workflow_runs;
  if (!Array.isArray(runs)) return err(forgeError("parse-failure", "workflow runs: missing workflow_runs"));
  return ok(runs.filter(isRestRun));
}

export function parseJobPage(text: string): Result<{ readonly total: number; readonly jobs: readonly RestJob[] }, ForgeError> {
  const parsed = parseJsonText(text, "jobs");
  if (!parsed.ok) return parsed;
  const v = parsed.value as { total_count?: unknown; jobs?: unknown };
  if (typeof v.total_count !== "number" || !Array.isArray(v.jobs)) {
    return err(forgeError("parse-failure", "jobs: unexpected shape"));
  }
  const jobs = v.jobs.filter(
    (j): j is RestJob => typeof j === "object" && j !== null && typeof (j as RestJob).name === "string",
  );
  return ok({ total: v.total_count, jobs });
}

export function parseHeadSha(text: string): Result<string, ForgeError> {
  const parsed = parseJsonText(text, "pull");
  if (!parsed.ok) return parsed;
  const sha = (parsed.value as { head?: { sha?: unknown } }).head?.sha;
  return typeof sha === "string" && /^[0-9a-f]{40}$/u.test(sha)
    ? ok(sha)
    : err(forgeError("parse-failure", "pull: missing head.sha"));
}

// ─── I/O (injected forge, clock, sleep) ────────────────────────────────────

export interface WaitDeps {
  readonly rest: GithubRest;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly log?: (line: string) => void;
}

interface ProbeState {
  headSha: string | null;
  runId: number | null;
}

async function probe(nwo: string, target: RunTarget, state: ProbeState, rest: GithubRest): Promise<Observation> {
  if (state.runId !== null) {
    const r = await rest.request("GET", `repos/${nwo}/actions/runs/${String(state.runId)}`);
    if (!r.ok) return { kind: "error", error: r.error };
    const run = parseRun(r.value);
    return run.ok ? { kind: "run", run: run.value } : { kind: "error", error: run.error };
  }
  if (target.kind === "run-id") return { kind: "error", error: forgeError("internal", "run id missing") };
  if (state.headSha === null) {
    if (target.kind === "sha") {
      state.headSha = target.sha;
    } else {
      const p = await rest.request("GET", `repos/${nwo}/pulls/${String(target.pr)}`);
      if (!p.ok) return { kind: "error", error: p.error };
      const sha = parseHeadSha(p.value);
      if (!sha.ok) return { kind: "error", error: sha.error };
      state.headSha = sha.value;
    }
  }
  const wf = encodeURIComponent(target.workflow);
  const list = await rest.request(
    "GET",
    `repos/${nwo}/actions/workflows/${wf}/runs?head_sha=${state.headSha}&per_page=20`,
  );
  if (!list.ok) return { kind: "error", error: list.error };
  const runs = parseRunList(list.value);
  if (!runs.ok) return { kind: "error", error: runs.error };
  const latest = pickLatestRun(runs.value);
  if (latest === null) return { kind: "no-run-yet" };
  // Lock onto this run: every later probe is one GET of this id, and a re-run of it
  // (run_attempt + 1) is still this run.
  state.runId = latest.id;
  return { kind: "run", run: latest };
}

/**
 * Every job of the run's LATEST attempt, paginated (at most 10 pages of 100). Each page gets
 * bounded retries on rate limit / network; any other failure returns at once.
 */
export async function fetchRunJobs(
  rest: GithubRest,
  nwo: string,
  runId: number,
  opts: { readonly intervalMs: number; readonly sleep: (ms: number) => Promise<void> },
): Promise<Result<readonly RestJob[], ForgeError>> {
  const all: RestJob[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = await requestWithBackoff(
      rest,
      "GET",
      `repos/${nwo}/actions/runs/${String(runId)}/jobs?filter=latest&per_page=100&page=${String(page)}`,
      { intervalMs: opts.intervalMs, attempts: 3, sleep: opts.sleep },
    );
    if (!r.ok) return r;
    const parsed = parseJobPage(r.value);
    if (!parsed.ok) return parsed;
    all.push(...parsed.value.jobs);
    if (all.length >= parsed.value.total || parsed.value.jobs.length === 0) break;
  }
  return ok(all);
}

export async function waitRun(
  nwo: string,
  target: RunTarget,
  opts: { readonly intervalMs: number; readonly timeoutMs: number },
  deps: WaitDeps,
): Promise<WaitVerdict> {
  const intervalMs = effectiveIntervalMs(opts.intervalMs);
  const startMs = deps.now();
  const deadlineMs = startMs + Math.max(opts.timeoutMs, 0);
  const state: ProbeState = { headSha: null, runId: target.kind === "run-id" ? target.runId : null };
  let probes = 0;
  let consecutiveFailures = 0;
  let lastRun: RestRun | null = null;
  const elapsed = (): number => Math.round((deps.now() - startMs) / 1000);

  for (;;) {
    const obs = await probe(nwo, target, state, deps.rest);
    probes++;
    if (obs.kind === "error") consecutiveFailures++;
    else consecutiveFailures = 0;
    if (obs.kind === "run") lastRun = obs.run;
    const step = decideAfterObservation(obs, { nowMs: deps.now(), deadlineMs, intervalMs, consecutiveFailures });
    deps.log?.(
      `[wait-run] probe ${String(probes)}: ${obs.kind === "run" ? `run ${String(obs.run.id)} status=${String(obs.run.status)}` : obs.kind === "error" ? `error ${obs.error.kind}` : "no run yet"} -> ${step.kind}${step.kind === "wait" ? ` ${String(Math.round(step.delayMs / 1000))}s` : ""}`,
    );
    if (step.kind === "wait") {
      const remaining = deadlineMs - deps.now();
      // Never sleep past the deadline: the final probe lands AT the deadline, so a run that
      // finishes in the last interval is still seen.
      await deps.sleep(Math.max(0, Math.min(step.delayMs, remaining)));
      continue;
    }
    if (step.kind === "completed") {
      const jobs = await fetchRunJobs(deps.rest, nwo, step.run.id, { intervalMs, sleep: deps.sleep });
      const summaries = jobs.ok ? jobs.value.map(summarizeJob) : null;
      return {
        outcome: "completed",
        target,
        run: summarizeRun(step.run),
        conclusion: step.run.conclusion,
        jobs: summaries,
        failedJobs: summaries === null ? [] : failedJobNames(summaries),
        reason: jobs.ok ? null : `run completed, but its jobs could not be read: ${jobs.error.message}`,
        probes,
        elapsedSeconds: elapsed(),
      };
    }
    return {
      outcome: step.kind,
      target,
      run: lastRun === null ? null : summarizeRun(lastRun),
      conclusion: null,
      jobs: null,
      failedJobs: [],
      reason: step.reason,
      probes,
      elapsedSeconds: elapsed(),
    };
  }
}

// ─── CLI ───────────────────────────────────────────────────────────────────

/** `90`, `90s`, `45m`, `2h` -> milliseconds. `null` on anything else. */
export function parseDurationMs(raw: string): number | null {
  const m = /^(\d+)(s|m|h)?$/u.exec(raw);
  if (m === null) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? "s";
  return n * (unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : 1000);
}

export interface ParsedArgs {
  readonly nwo: string;
  readonly target: RunTarget;
  readonly intervalMs: number;
  readonly timeoutMs: number;
}

const USAGE =
  "usage: wait-run.ts (--run-id <id> | --pr <n> --workflow <file.yml> | --sha <sha> --workflow <file.yml>)\n" +
  "                   [--repo owner/name] [--timeout 60m] [--interval 60]\n";

export function parseArgs(argv: readonly string[]): Result<ParsedArgs, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (!a.startsWith("--")) return err(`unexpected argument: ${a}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) return err(`${a} requires a value`);
    if (!["--run-id", "--pr", "--sha", "--workflow", "--repo", "--timeout", "--interval"].includes(a)) {
      return err(`unknown flag: ${a}`);
    }
    flags.set(a, v);
    i++;
  }
  const nwo = parseNwo(flags.get("--repo") ?? "Lucent-Financial-Group/Zeta");
  if (nwo === null) return err("--repo must be owner/name");
  const timeoutMs = parseDurationMs(flags.get("--timeout") ?? "60m");
  if (timeoutMs === null) return err("--timeout must look like 90, 90s, 45m or 2h");
  const intervalMs = parseDurationMs(flags.get("--interval") ?? "60");
  if (intervalMs === null) return err("--interval must look like 60 or 2m");

  const runId = flags.get("--run-id");
  const pr = flags.get("--pr");
  const sha = flags.get("--sha");
  const workflow = flags.get("--workflow");
  const chosen = [runId, pr, sha].filter((x) => x !== undefined).length;
  if (chosen !== 1) return err("give exactly one of --run-id, --pr, --sha");
  if (workflow !== undefined && !/^[A-Za-z0-9._-]+$/u.test(workflow)) return err("--workflow must be a file name or id");

  let target: RunTarget;
  if (runId !== undefined) {
    if (!/^\d+$/u.test(runId)) return err("--run-id must be a positive integer");
    target = { kind: "run-id", runId: Number(runId) };
  } else if (pr !== undefined) {
    if (!/^\d+$/u.test(pr) || Number(pr) < 1) return err("--pr must be a positive integer");
    if (workflow === undefined) return err("--pr needs --workflow");
    target = { kind: "pr", pr: Number(pr), workflow };
  } else {
    if (sha === undefined || !/^[0-9a-f]{40}$/u.test(sha)) return err("--sha must be a full 40-hex commit SHA");
    if (workflow === undefined) return err("--sha needs --workflow");
    target = { kind: "sha", sha, workflow };
  }
  return ok({ nwo, target, intervalMs, timeoutMs });
}

export async function main(argv: readonly string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(USAGE);
    return 0;
  }
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    process.stderr.write(`wait-run: ${parsed.error}\n${USAGE}`);
    return 2;
  }
  const { nwo, target, intervalMs, timeoutMs } = parsed.value;
  if (intervalMs < MIN_INTERVAL_MS) {
    process.stderr.write(`wait-run: --interval raised to the ${String(MIN_INTERVAL_MS / 1000)}s floor\n`);
  }
  const verdict = await waitRun(nwo, target, { intervalMs, timeoutMs }, {
    rest: defaultGithubRest(),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (line) => process.stderr.write(`${line}\n`),
  });
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  return exitCodeFor(verdict);
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
