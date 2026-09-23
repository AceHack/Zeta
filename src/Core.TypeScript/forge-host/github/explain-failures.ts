#!/usr/bin/env bun
/**
 * explain-failures.ts — say WHY a PR's, a commit's, or a run's checks failed.
 *
 * WHY. `poll-pr-gate.ts` returns counts, so after every red run agents fell back to raw `gh api`
 * to find the failing job, its failing STEP, and the check-run annotations. Two agents hit that
 * gap independently; the coordinator did it by hand. This is the homemade answer, REST only.
 *
 * Usage:
 *   bun src/Core.TypeScript/forge-host/github/explain-failures.ts --pr <n>
 *   bun src/Core.TypeScript/forge-host/github/explain-failures.ts --sha <40-hex>
 *   bun src/Core.TypeScript/forge-host/github/explain-failures.ts --run-id <id>
 *     [--repo owner/name] [--log-tail <lines>] [--max-checks 20] [--interval 60]
 *
 * Two traps this repo measured, both handled here:
 *   1. A CHECK-RUN ID IS THE JOB ID for GitHub Actions checks. So one `GET actions/jobs/{id}`
 *      names the failing steps; no run lookup, no job search.
 *   2. `GET actions/jobs/{id}/logs` can return 0 BYTES for a job that certainly printed output.
 *      An empty log is therefore `unknown`, never "no output" — the annotations are the fallback
 *      evidence, and they are fetched regardless.
 *
 * Per-field honesty: a sub-read that fails (steps, annotations, log) is reported as `null` plus
 * an error string for THAT field — never as "no failing steps" or "no annotations", which would
 * turn a failed probe into a negative observation.
 *
 * Budget: every call is REST (`commits/{sha}/check-runs`, `check-runs/{id}/annotations`,
 * `actions/jobs/{id}`, `commits/{sha}/status`, `pulls/{n}`). Each is retried with back-off only
 * on a rate limit (including a 403 secondary limit) or a network error, at most 3 attempts, the
 * base interval defaulting to 60 s. Annotations are skipped when the check run reports
 * `annotations_count: 0` — that count is itself an observation. `--max-checks` bounds the
 * per-check detail reads.
 *
 * Exit codes:
 *   0  observed; every check finished, none failing
 *   1  observed; at least one failing check or failing commit status
 *   2  usage error — nothing was observed
 *   3  observed; none failing YET, but some checks are still pending (not green)
 *   4  unknown — the check list itself could not be read
 */

import type { ForgeError, Result } from "../types";
import { err, forgeError, ok } from "../result";
import type { GithubRest } from "./github-pr-rest.ts";
import { defaultGithubRest, parseNwo, requestWithBackoff } from "./github-rest-transport.ts";
import { fetchRunJobs, parseDurationMs, parseHeadSha, summarizeJob, type RestJob } from "./wait-run.ts";

// ─── Types ─────────────────────────────────────────────────────────────────

export type ExplainTarget =
  | { readonly kind: "pr"; readonly pr: number }
  | { readonly kind: "sha"; readonly sha: string }
  | { readonly kind: "run-id"; readonly runId: number };

export interface RestCheckRun {
  readonly id: number;
  readonly name: string;
  readonly status: string | null;
  readonly conclusion: string | null;
  readonly html_url?: string | null;
  readonly details_url?: string | null;
  readonly app?: { readonly slug?: string } | null;
  readonly output?: { readonly annotations_count?: number } | null;
}

export interface RestAnnotation {
  readonly path?: string;
  readonly start_line?: number;
  readonly end_line?: number;
  readonly annotation_level?: string;
  readonly message?: string;
  readonly title?: string | null;
}

export interface Annotation {
  readonly level: string;
  readonly message: string;
  readonly title: string | null;
  readonly path: string | null;
  readonly line: number | null;
  readonly endLine: number | null;
}

export type LogTail =
  | { readonly state: "observed"; readonly lines: readonly string[] }
  | { readonly state: "unknown"; readonly reason: string };

export interface FailingCheck {
  readonly name: string;
  readonly conclusion: string | null;
  readonly checkRunId: number | null;
  /** Equal to `checkRunId` for GitHub Actions checks; `null` for other apps. */
  readonly jobId: number | null;
  readonly url: string | null;
  readonly failingSteps: readonly string[] | null;
  readonly stepsError: string | null;
  readonly annotations: readonly Annotation[] | null;
  readonly annotationsError: string | null;
  readonly log: LogTail | null;
}

export interface FailingStatus {
  readonly context: string;
  readonly state: string;
  readonly description: string | null;
  readonly url: string | null;
}

export interface Explanation {
  readonly outcome: "observed" | "unknown";
  readonly target: ExplainTarget;
  readonly headSha: string | null;
  readonly reason: string | null;
  readonly checksObserved: number;
  readonly pending: readonly string[];
  readonly failing: readonly FailingCheck[];
  readonly failingStatuses: readonly FailingStatus[];
  /** Failing checks beyond `--max-checks`, listed by name without detail reads. */
  readonly undetailed: readonly string[];
}

// ─── Pure logic ────────────────────────────────────────────────────────────

const FAILING: ReadonlySet<string> = new Set([
  "failure",
  "cancelled",
  "timed_out",
  "startup_failure",
  "action_required",
  "stale",
]);

export function isFailingConclusion(conclusion: string | null | undefined): boolean {
  return typeof conclusion === "string" && FAILING.has(conclusion);
}

/** Not yet completed. A check with no status is treated as pending, never as passed. */
export function isPending(status: string | null | undefined): boolean {
  return status !== "completed";
}

/**
 * The job id behind a check run. For the GitHub Actions app the check-run id IS the job id
 * (measured here); for any other app there is no job and `null` is the honest answer.
 */
export function jobIdOfCheckRun(cr: RestCheckRun): number | null {
  return cr.app?.slug === "github-actions" ? cr.id : null;
}

/** Only failure-level annotations; `notice` / `warning` are noise for "why did it fail". */
export function failureAnnotations(raw: readonly RestAnnotation[]): readonly Annotation[] {
  return raw
    .filter((a) => a.annotation_level === "failure")
    .map((a) => ({
      level: a.annotation_level ?? "failure",
      message: a.message ?? "",
      title: a.title ?? null,
      path: a.path ?? null,
      line: a.start_line ?? null,
      endLine: a.end_line ?? null,
    }));
}

/**
 * The log endpoint's answer, read honestly. ZERO BYTES IS UNKNOWN: the endpoint has been measured
 * returning an empty body for jobs that printed plenty, so emptiness is a property of the
 * endpoint, not evidence about the job.
 */
export function classifyLog(r: Result<string, ForgeError>, tailLines: number): LogTail {
  if (!r.ok) return { state: "unknown", reason: `log read failed (${r.error.kind}): ${r.error.message}` };
  if (r.value.length === 0) {
    return {
      state: "unknown",
      reason: "log endpoint returned 0 bytes; that is not 'no output' - see annotations and failingSteps",
    };
  }
  // ANSI colour/cursor sequences stripped: they are presentation, and a reader of the JSON
  // wants the words.
  // eslint-disable-next-line no-control-regex -- matching ESC is the point
  const plain = r.value.replace(/\u001b\[[0-9;?]*[A-Za-z]/gu, "");
  const lines = plain.replace(/\r\n/gu, "\n").split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return { state: "observed", lines: lines.slice(Math.max(0, lines.length - tailLines)) };
}

export function explanationExitCode(e: Pick<Explanation, "outcome" | "failing" | "failingStatuses" | "pending" | "undetailed">): number {
  if (e.outcome === "unknown") return 4;
  if (e.failing.length > 0 || e.failingStatuses.length > 0 || e.undetailed.length > 0) return 1;
  if (e.pending.length > 0) return 3;
  return 0;
}

export function parseCheckRunPage(text: string): Result<{ readonly total: number; readonly runs: readonly RestCheckRun[] }, ForgeError> {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    return err(forgeError("parse-failure", `check runs: ${e instanceof Error ? e.message : String(e)}`));
  }
  const body = v as { total_count?: unknown; check_runs?: unknown };
  if (typeof body.total_count !== "number" || !Array.isArray(body.check_runs)) {
    return err(forgeError("parse-failure", "check runs: unexpected shape"));
  }
  const runs = body.check_runs.filter(
    (c): c is RestCheckRun =>
      typeof c === "object" && c !== null && typeof (c as RestCheckRun).id === "number" && typeof (c as RestCheckRun).name === "string",
  );
  return ok({ total: body.total_count, runs });
}

export function parseAnnotations(text: string): Result<readonly RestAnnotation[], ForgeError> {
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) ? ok(v as RestAnnotation[]) : err(forgeError("parse-failure", "annotations: not an array"));
  } catch (e) {
    return err(forgeError("parse-failure", `annotations: ${e instanceof Error ? e.message : String(e)}`));
  }
}

export function parseFailingStatuses(text: string): Result<readonly FailingStatus[], ForgeError> {
  try {
    const v = JSON.parse(text) as { statuses?: unknown };
    if (!Array.isArray(v.statuses)) return err(forgeError("parse-failure", "status: missing statuses"));
    const out: FailingStatus[] = [];
    for (const s of v.statuses as readonly { context?: unknown; state?: unknown; description?: unknown; target_url?: unknown }[]) {
      if (typeof s.context !== "string" || (s.state !== "failure" && s.state !== "error")) continue;
      out.push({
        context: s.context,
        state: s.state,
        description: typeof s.description === "string" ? s.description : null,
        url: typeof s.target_url === "string" ? s.target_url : null,
      });
    }
    return ok(out);
  } catch (e) {
    return err(forgeError("parse-failure", `status: ${e instanceof Error ? e.message : String(e)}`));
  }
}

function parseJob(text: string): Result<RestJob, ForgeError> {
  try {
    const v = JSON.parse(text) as RestJob;
    return typeof v.name === "string" ? ok(v) : err(forgeError("parse-failure", "job: unexpected shape"));
  } catch (e) {
    return err(forgeError("parse-failure", `job: ${e instanceof Error ? e.message : String(e)}`));
  }
}

// ─── I/O ───────────────────────────────────────────────────────────────────

export interface ExplainDeps {
  readonly rest: GithubRest;
  readonly sleep: (ms: number) => Promise<void>;
}

export interface ExplainOpts {
  readonly intervalMs: number;
  readonly maxChecks: number;
  readonly logTail: number;
}

async function readAnnotations(
  nwo: string,
  checkRunId: number,
  count: number | undefined,
  get: (path: string) => Promise<Result<string, ForgeError>>,
): Promise<{ readonly annotations: readonly Annotation[] | null; readonly error: string | null }> {
  // `annotations_count: 0` is an observation, not an absence: skip the call and report [].
  if (count === 0) return { annotations: [], error: null };
  const r = await get(`repos/${nwo}/check-runs/${String(checkRunId)}/annotations?per_page=100`);
  const parsed = r.ok ? parseAnnotations(r.value) : r;
  return parsed.ok
    ? { annotations: failureAnnotations(parsed.value), error: null }
    : { annotations: null, error: `${parsed.error.kind}: ${parsed.error.message}` };
}

async function readLog(
  nwo: string,
  jobId: number,
  tail: number,
  get: (path: string) => Promise<Result<string, ForgeError>>,
): Promise<LogTail | null> {
  if (tail <= 0) return null;
  return classifyLog(await get(`repos/${nwo}/actions/jobs/${String(jobId)}/logs`), tail);
}

function unknown(target: ExplainTarget, headSha: string | null, reason: string): Explanation {
  return {
    outcome: "unknown",
    target,
    headSha,
    reason,
    checksObserved: 0,
    pending: [],
    failing: [],
    failingStatuses: [],
    undetailed: [],
  };
}

export async function explainFailures(nwo: string, target: ExplainTarget, opts: ExplainOpts, deps: ExplainDeps): Promise<Explanation> {
  const get = (path: string): Promise<Result<string, ForgeError>> =>
    requestWithBackoff(deps.rest, "GET", path, { intervalMs: opts.intervalMs, attempts: 3, sleep: deps.sleep });

  if (target.kind === "run-id") {
    const jobs = await fetchRunJobs(deps.rest, nwo, target.runId, { intervalMs: opts.intervalMs, sleep: deps.sleep });
    if (!jobs.ok) return unknown(target, null, `jobs of run ${String(target.runId)} unreadable (${jobs.error.kind}): ${jobs.error.message}`);
    const failingJobs = jobs.value.filter((j) => isFailingConclusion(j.conclusion));
    const detailed = failingJobs.slice(0, opts.maxChecks);
    const failing: FailingCheck[] = [];
    for (const j of detailed) {
      const ann = await readAnnotations(nwo, j.id, undefined, get);
      failing.push({
        name: j.name,
        conclusion: j.conclusion,
        checkRunId: j.id,
        jobId: j.id,
        url: j.html_url ?? null,
        failingSteps: summarizeJob(j).failingSteps,
        stepsError: null,
        annotations: ann.annotations,
        annotationsError: ann.error,
        log: await readLog(nwo, j.id, opts.logTail, get),
      });
    }
    return {
      outcome: "observed",
      target,
      headSha: null,
      reason: null,
      checksObserved: jobs.value.length,
      pending: jobs.value.filter((j) => isPending(j.status)).map((j) => j.name),
      failing,
      failingStatuses: [],
      undetailed: failingJobs.slice(opts.maxChecks).map((j) => j.name),
    };
  }

  let headSha: string;
  if (target.kind === "sha") {
    headSha = target.sha;
  } else {
    const p = await get(`repos/${nwo}/pulls/${String(target.pr)}`);
    const sha = p.ok ? parseHeadSha(p.value) : p;
    if (!sha.ok) return unknown(target, null, `PR head unreadable (${sha.error.kind}): ${sha.error.message}`);
    headSha = sha.value;
  }

  const checkRuns: RestCheckRun[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = await get(`repos/${nwo}/commits/${headSha}/check-runs?per_page=100&page=${String(page)}`);
    const parsed = r.ok ? parseCheckRunPage(r.value) : r;
    if (!parsed.ok) return unknown(target, headSha, `check runs unreadable (${parsed.error.kind}): ${parsed.error.message}`);
    checkRuns.push(...parsed.value.runs);
    if (checkRuns.length >= parsed.value.total || parsed.value.runs.length === 0) break;
  }

  // Legacy commit statuses are a second, separate check surface; a failure there is a failure.
  // Unreadable is recorded in `reason`, never as "no failing statuses".
  const st = await get(`repos/${nwo}/commits/${headSha}/status`);
  const statuses = st.ok ? parseFailingStatuses(st.value) : st;

  const failingRuns = checkRuns.filter((c) => isFailingConclusion(c.conclusion));
  const failing: FailingCheck[] = [];
  for (const cr of failingRuns.slice(0, opts.maxChecks)) {
    const jobId = jobIdOfCheckRun(cr);
    let failingSteps: readonly string[] | null = null;
    let stepsError: string | null = null;
    if (jobId !== null) {
      // THE TRAP THAT IS A GIFT: the check-run id is the job id, so this one call names the step.
      const j = await get(`repos/${nwo}/actions/jobs/${String(jobId)}`);
      const job = j.ok ? parseJob(j.value) : j;
      if (job.ok) failingSteps = summarizeJob(job.value).failingSteps;
      else stepsError = `${job.error.kind}: ${job.error.message}`;
    } else {
      stepsError = `not a GitHub Actions check (app ${cr.app?.slug ?? "unknown"}); no job steps exist`;
    }
    const ann = await readAnnotations(nwo, cr.id, cr.output?.annotations_count, get);
    failing.push({
      name: cr.name,
      conclusion: cr.conclusion,
      checkRunId: cr.id,
      jobId,
      url: cr.html_url ?? cr.details_url ?? null,
      failingSteps,
      stepsError,
      annotations: ann.annotations,
      annotationsError: ann.error,
      log: jobId === null ? null : await readLog(nwo, jobId, opts.logTail, get),
    });
  }

  return {
    outcome: "observed",
    target,
    headSha,
    reason: statuses.ok ? null : `commit statuses unreadable (${statuses.error.kind}): ${statuses.error.message}`,
    checksObserved: checkRuns.length,
    pending: checkRuns.filter((c) => isPending(c.status)).map((c) => c.name),
    failing,
    failingStatuses: statuses.ok ? statuses.value : [],
    undetailed: failingRuns.slice(opts.maxChecks).map((c) => c.name),
  };
}

// ─── CLI ───────────────────────────────────────────────────────────────────

const USAGE =
  "usage: explain-failures.ts (--pr <n> | --sha <40-hex> | --run-id <id>) [--repo owner/name]\n" +
  "                           [--log-tail <lines>] [--max-checks 20] [--interval 60]\n";

export function parseArgs(
  argv: readonly string[],
): Result<{ readonly nwo: string; readonly target: ExplainTarget; readonly opts: ExplainOpts }, string> {
  const flags = new Map<string, string>();
  const known = ["--pr", "--sha", "--run-id", "--repo", "--log-tail", "--max-checks", "--interval"];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (!known.includes(a)) return err(`unexpected argument: ${a}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) return err(`${a} requires a value`);
    flags.set(a, v);
    i++;
  }
  const nwo = parseNwo(flags.get("--repo") ?? "Lucent-Financial-Group/Zeta");
  if (nwo === null) return err("--repo must be owner/name");
  const nat = (flag: string, dflt: string): number | null => {
    const raw = flags.get(flag) ?? dflt;
    return /^\d+$/u.test(raw) ? Number(raw) : null;
  };
  const logTail = nat("--log-tail", "0");
  const maxChecks = nat("--max-checks", "20");
  const intervalMs = parseDurationMs(flags.get("--interval") ?? "60");
  if (logTail === null || maxChecks === null || intervalMs === null) {
    return err("--log-tail / --max-checks must be integers; --interval like 60 or 2m");
  }
  const pr = flags.get("--pr");
  const sha = flags.get("--sha");
  const runId = flags.get("--run-id");
  if ([pr, sha, runId].filter((x) => x !== undefined).length !== 1) return err("give exactly one of --pr, --sha, --run-id");
  let target: ExplainTarget;
  if (pr !== undefined) {
    if (!/^\d+$/u.test(pr) || Number(pr) < 1) return err("--pr must be a positive integer");
    target = { kind: "pr", pr: Number(pr) };
  } else if (sha !== undefined) {
    if (!/^[0-9a-f]{40}$/u.test(sha)) return err("--sha must be a full 40-hex commit SHA");
    target = { kind: "sha", sha };
  } else {
    if (runId === undefined || !/^\d+$/u.test(runId)) return err("--run-id must be a positive integer");
    target = { kind: "run-id", runId: Number(runId) };
  }
  // Same floor as wait-run: retries are slow on purpose.
  return ok({ nwo, target, opts: { intervalMs: Math.max(intervalMs, 20_000), maxChecks, logTail } });
}

export async function main(argv: readonly string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(USAGE);
    return 0;
  }
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    process.stderr.write(`explain-failures: ${parsed.error}\n${USAGE}`);
    return 2;
  }
  const { nwo, target, opts } = parsed.value;
  const explanation = await explainFailures(nwo, target, opts, {
    rest: defaultGithubRest(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  process.stdout.write(`${JSON.stringify(explanation, null, 2)}\n`);
  return explanationExitCode(explanation);
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
