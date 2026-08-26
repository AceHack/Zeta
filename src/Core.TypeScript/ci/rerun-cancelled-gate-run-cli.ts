#!/usr/bin/env bun
/**
 * CLI applying the `decideRerun` policy to a real `gate` run.
 *
 *   bun src/Core.TypeScript/ci/rerun-cancelled-gate-run-cli.ts --run-id <id> [--apply]
 *
 * DRY-RUN BY DEFAULT. `--apply` is required to actually re-run, so the policy can be
 * evaluated against production history without touching anything (which is how the
 * evidence in docs/research/2026-08-14-cancelled-gate-runs-are-apt-stalls-hitting-job-timeouts-not-concurrency-cancels.md was produced).
 *
 * THE ENDPOINT IS CHOSEN, NOT FIXED (2026-08-26). It used to be `rerun-failed-jobs`
 * unconditionally, on cost discipline: the observed orphan runs had 26-28 jobs already green
 * and 1-2 cancelled, so re-running the whole run would burn ~28x the minutes needed and
 * discard good results. That reasoning is right and is kept — but it silently assumed the
 * run HAS jobs. A run displaced from a saturated concurrency queue has zero, and measured
 * against run 32952848390 the forge answers `rerun-failed-jobs` with
 * `403 "This workflow run cannot be retried"` while `rerun` succeeds and creates 35 jobs.
 * So the job count decides; see `chooseRerunEndpoint`.
 *
 * Untrusted input: branch names and run titles are attacker-influenceable (anyone can open
 * a PR). Nothing here interpolates them into a shell; the GitHub token is read from the
 * environment and never logged.
 */

import {
  chooseRerunEndpoint,
  classifyRerunRefusal,
  decideRerun,
  REFUSAL_REASON,
  type WorkflowRun,
  type RerunDecision,
} from "./rerun-cancelled-gate-run.ts";

const API = process.env.GITHUB_API_URL ?? "https://api.github.com";
const REPO = process.env.GITHUB_REPOSITORY ?? "AceHack/Zeta";
const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "zeta-rerun-cancelled-gate",
  };
  if (TOKEN) h.authorization = `Bearer ${TOKEN}`;
  return h;
}

/**
 * A non-2xx from the forge, carrying the two things the old bare `Error` threw away.
 *
 * THE OBSERVABILITY HALF OF THE 2026-08-26 DEFECT. The previous throw was a plain `Error`
 * whose message named the status but not the API's own sentence, and the workflow surfaced
 * only its STACK TRACE — so the run went red saying nothing about WHY. A refusal that is
 * not legible cannot be triaged, and an untriageable red is one that gets re-run until it
 * goes away, which is how a real breakage gets absorbed as flake.
 *
 * `status` and `apiMessage` are separate FIELDS rather than only prose, so the classifier
 * decides on values instead of re-parsing a string a future edit could reformat.
 */
export class GitHubApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly apiMessage: string;
  public readonly method: string;
  public readonly path: string;

  // Fields assigned explicitly rather than as constructor parameter properties: tsconfig
  // sets `erasableSyntaxOnly`, so the shorthand is a type error here.
  public constructor(status: number, statusText: string, apiMessage: string, method: string, path: string) {
    super(`GitHub API ${method} ${path} -> ${String(status)} ${statusText}: ${apiMessage}`);
    this.name = "GitHubApiError";
    this.status = status;
    this.statusText = statusText;
    this.apiMessage = apiMessage;
    this.method = method;
    this.path = path;
  }
}

/**
 * The forge's own sentence, out of an error body.
 *
 * Falls back to the raw body (truncated) rather than to "" — an unparseable body is still
 * evidence, and reporting an empty message would recreate the silence being fixed.
 */
export function extractApiMessage(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "message" in parsed) {
      const { message } = parsed;
      if (typeof message === "string" && message.length > 0) return message;
    }
  } catch {
    // Not JSON. The raw body below is the honest fallback.
  }
  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 300) : "(empty response body)";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const res = await fetch(`${API}${path}`, { ...init, headers: ghHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitHubApiError(res.status, res.statusText, extractApiMessage(body), method, path);
  }
  // An EMPTY body is a success, not a parse error. The old form special-cased only 204,
  // but `POST /rerun-failed-jobs` answers 201 with no body — so the one call this tool
  // exists to make would have thrown `Unexpected end of JSON input` on its happy path,
  // landing in the same undiagnosable red as the refusals. Caught by the CLI test's
  // "an accepted rerun posts once" case, which failed against the 204-only form.
  const text = await res.text();
  return (text.length === 0 ? undefined : JSON.parse(text)) as T;
}

export async function fetchRun(runId: number): Promise<WorkflowRun> {
  return api<WorkflowRun>(`/repos/${REPO}/actions/runs/${runId}`);
}

/** Sibling runs of the same workflow — the supersession guard's evidence. */
export async function fetchSiblings(runId: number): Promise<WorkflowRun[]> {
  const run = await api<WorkflowRun & { workflow_id: number }>(`/repos/${REPO}/actions/runs/${runId}`);
  const branch = encodeURIComponent(run.head_branch);
  const out = await api<{ workflow_runs: WorkflowRun[] }>(
    `/repos/${REPO}/actions/workflows/${run.workflow_id}/runs?branch=${branch}&per_page=100`,
  );
  return out.workflow_runs;
}

/**
 * The repository's real default branch — MEASURED, not assumed to be `"main"`.
 *
 * Guard 3's carve-out hangs off this value, so hardcoding it would mean a branch rename
 * silently restored the write-off behaviour with every test still green. The runs API does
 * not carry it (`repository.default_branch` is `null` on the minimal repository object it
 * embeds — checked), hence the separate read.
 */
export async function fetchDefaultBranch(): Promise<string> {
  const repo = await api<{ default_branch: string }>(`/repos/${REPO}`);
  return repo.default_branch;
}

/**
 * How many jobs this run ever created — the input `chooseRerunEndpoint` decides on.
 *
 * `total_count` is the count of jobs that EXIST, not of jobs that finished, so a run
 * displaced from the concurrency queue before it started answers 0 and a run whose jobs
 * timed out answers 26-28. `per_page=1` because only the count is read.
 */
export async function fetchJobCount(runId: number): Promise<number> {
  const out = await api<{ total_count: number }>(`/repos/${REPO}/actions/runs/${runId}/jobs?per_page=1`);
  return out.total_count;
}

function log(runId: number, d: RerunDecision, applied: boolean, endpoint?: string): void {
  // One structured line per evaluation. This is the visibility requirement: a RISING RERUN
  // RATE must be observable, because the auto-rerun treats the residual and must never
  // quietly absorb a returning root cause. Group on `reason` to get that rate.
  console.log(
    JSON.stringify({
      kind: "gate-rerun-decision",
      run_id: runId,
      action: d.action,
      reason: d.reason,
      detail: d.detail,
      applied,
      // Which call was made. Without it the log cannot distinguish "recovered a displaced
      // run" from "re-ran a few timed-out jobs", and those have very different costs.
      endpoint: endpoint ?? null,
      at: new Date().toISOString(),
    }),
  );
}

export async function main(argv: string[]): Promise<number> {
  const runIdArg = argv[argv.indexOf("--run-id") + 1];
  const apply = argv.includes("--apply");
  const runId = Number(runIdArg);
  if (!runIdArg || !Number.isFinite(runId)) {
    console.error("usage: rerun-cancelled-gate-run-cli.ts --run-id <id> [--apply]");
    return 2;
  }

  const run = await fetchRun(runId);
  const siblings = await fetchSiblings(runId);
  const defaultBranch = await fetchDefaultBranch();
  const decision = decideRerun(run, siblings, { defaultBranch });

  if (decision.action !== "rerun") {
    log(runId, decision, false);
    return 0;
  }
  // Read AFTER the decision, so the extra call is paid only on the ~small selected set.
  const endpoint = chooseRerunEndpoint(await fetchJobCount(runId));
  if (!apply) {
    log(runId, decision, false, endpoint);
    console.error(`[dry-run] would POST ${endpoint} for run ${runId}; pass --apply to do it`);
    return 0;
  }
  // THE REFUSAL BOUNDARY IS EXACTLY THIS ONE CALL, and the narrowness is the point.
  // `fetchRun` and `fetchSiblings` above are deliberately OUTSIDE it: a 4xx on a read is
  // never an ordinary refusal to re-run, so wrapping them too would be the blanket catch
  // this fix exists to avoid. Only the mutation the forge is entitled to decline is
  // classified, and only against the phrase allowlist in the policy module.
  try {
    await api(`/repos/${REPO}/actions/runs/${runId}/${endpoint}`, { method: "POST" });
  } catch (err) {
    const refusal = err instanceof GitHubApiError ? classifyRerunRefusal(err.status, err.apiMessage) : null;
    // Not a recognised refusal ⇒ auth, rate limit, 5xx, or something new. It goes up, loud.
    if (refusal === null) throw err;
    log(
      runId,
      {
        action: "skip",
        reason: REFUSAL_REASON[refusal],
        detail: `${String((err as GitHubApiError).status)} ${(err as GitHubApiError).apiMessage} — the forge declined; nothing to do`,
      },
      false,
      endpoint,
    );
    return 0;
  }
  log(runId, decision, true, endpoint);
  return 0;
}

if (import.meta.main) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (err) {
    // A workflow annotation, not a bare stack trace. On 2026-08-26 this lane went red on
    // `main` and the log carried only a trace — no status, no message — so the failure said
    // nothing about its own cause. `::error` puts one legible line on the run's summary
    // page; the stack still goes to stderr for whoever needs it.
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`::error title=rerun-cancelled-gate::${message.replace(/\r?\n/gu, " ")}\n`);
    process.stderr.write(`${err instanceof Error ? (err.stack ?? message) : message}\n`);
    process.exit(1);
  }
}
