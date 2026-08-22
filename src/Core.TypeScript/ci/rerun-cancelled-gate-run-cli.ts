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
 * The re-run uses `rerun-failed-jobs`, NOT `rerun`. Cost discipline: the observed orphan
 * runs had 26-28 jobs already green and 1-2 cancelled, so re-running the whole run would
 * burn ~28x the minutes needed and discard good results. This is also exactly what the
 * manual fix was (`gh run rerun <id> --failed`).
 *
 * Untrusted input: branch names and run titles are attacker-influenceable (anyone can open
 * a PR). Nothing here interpolates them into a shell; the GitHub token is read from the
 * environment and never logged.
 */

import { decideRerun, type WorkflowRun, type RerunDecision } from "./rerun-cancelled-gate-run.ts";

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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: ghHeaders() });
  if (!res.ok) {
    throw new Error(`GitHub API ${init?.method ?? "GET"} ${path} -> ${res.status} ${res.statusText}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
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

function log(runId: number, d: RerunDecision, applied: boolean): void {
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
  const decision = decideRerun(run, siblings);

  if (decision.action !== "rerun") {
    log(runId, decision, false);
    return 0;
  }
  if (!apply) {
    log(runId, decision, false);
    console.error(`[dry-run] would rerun failed/cancelled jobs of run ${runId}; pass --apply to do it`);
    return 0;
  }
  await api(`/repos/${REPO}/actions/runs/${runId}/rerun-failed-jobs`, { method: "POST" });
  log(runId, decision, true);
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
