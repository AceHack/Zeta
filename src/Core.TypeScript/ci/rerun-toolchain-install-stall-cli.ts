#!/usr/bin/env bun
/**
 * Sweeper applying the `toolchain-install-stall` policy to real failed runs.
 *
 *   bun src/Core.TypeScript/ci/rerun-toolchain-install-stall-cli.ts [--since-minutes 45] \
 *       [--max-reruns 6] [--run-id <id>] [--apply]
 *
 * DRY-RUN BY DEFAULT. `--apply` is required to re-run anything, so the policy can be
 * evaluated against production history without touching a thing.
 *
 * WHY A SWEEP AND NOT A `workflow_run` WATCHER — the cost argument, stated because a new
 * CI slot has to earn itself. A per-run watcher fires once per failed run of every watched
 * workflow. Measured in this repo on 2026-08-25 (15:28Z-20:43Z, 200 failed runs, the API
 * page limit — so a LOWER bound): `gate` alone failed 117 times in 5h15m, ~535/day
 * extrapolated. At ~40s per evaluation (checkout + bun + API) that is ~356 runner-min/day,
 * and it scales WITH the failure rate — most expensive exactly when CI is worst. A sweep on
 * a fixed cadence costs the same whether nothing failed or fifty things did: 96 ticks/day at
 * 17s MEASURED (run 32907739489, the first real execution) is ~27 min/day, flat and
 * predictable, and one tick covers EVERY workflow that calls install.sh rather than needing a
 * per-workflow roster that drifts. The pre-execution estimate was ~45s; it is corrected here
 * rather than left as a figure that happened to flatter the decision it justified. It is also idempotent by
 * construction (§12): re-running the sweep re-evaluates the same runs, and the run_attempt
 * ceiling makes the second pass a no-op.
 *
 * The price paid for that is LATENCY: up to one cadence interval before a stalled run is
 * re-run. Against the status quo — a human or an agent noticing, hours later — that trade is
 * not close.
 *
 * WHY NOT INSIDE THE FAILING JOB. Cheapest of all would be an `if: failure()` step in the
 * job that already exists. It is refused on supply-chain grounds: that job executes pull
 * request code, and giving it `actions: write` hands a fork PR the ability to drive the
 * Actions API. The sweep runs on a schedule from the default branch and never checks out or
 * executes a PR head.
 *
 * COST OF A FIRING. `rerun-failed-jobs`, never `rerun`: an eligible run has its green jobs
 * already green, and re-running the whole thing would burn their minutes again and discard
 * good results. This is exactly what the manual fix was (`gh run rerun <id> --failed`).
 *
 * UNTRUSTED INPUT (BP-11). Branch names, run titles and job names are attacker-influenceable
 * — anyone may open a pull request. Nothing here is interpolated into a shell; the token is
 * read from the environment and never logged.
 *
 * THE BLOCKING FLOOR IS READ FROM DISK, NOT FROM THE API, AND THAT IS THE SECURITY CHOICE.
 * The policy needs to know which of a gate run's jobs could block a merge, and it derives that
 * from `gate.yml`'s own `gate-required.needs:` list. The copy it reads is the one in THIS
 * process's checkout — the scheduled sweep checks out the DEFAULT BRANCH and never a pull
 * request head — so a pull request cannot edit its own workflow file to declare its own
 * failing job harmless. Fetching `gate.yml` at the run's head SHA would hand exactly that
 * ability to any contributor. If the file is missing or unparseable the floor is `undefined`
 * and the policy reverts to refusing every mixed run, which is the fail-closed direction.
 */

import { loadBlockingFloor } from "./gate-blocking-floor.ts";
import {
  decideRerun,
  INSTALL_STEP_NAME,
  NON_APT_STEP_NAME,
  type Job,
  type WorkflowRun,
} from "./toolchain-install-stall.ts";

const API = process.env.GITHUB_API_URL ?? "https://api.github.com";
const REPO = process.env.GITHUB_REPOSITORY ?? "Lucent-Financial-Group/Zeta";
const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";

const DEFAULT_SINCE_MINUTES = 45;
/**
 * BLAST-RADIUS CEILING. If an archive mirror is degraded fleet-wide, dozens of runs carry
 * this signature at once and re-running all of them feeds the same wall a second helping of
 * the same runners. Past the cap the sweep stops and says so, loudly — that is the signal
 * that this is an outage rather than a flake, and an outage wants a human, not a retry.
 */
const DEFAULT_MAX_RERUNS = 6;

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "zeta-rerun-toolchain-install-stall",
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

async function apiText(path: string): Promise<string> {
  const res = await fetch(`${API}${path}`, { headers: ghHeaders() });
  // A missing or expired log is MISSING EVIDENCE, and missing evidence must never read as
  // absolving evidence: the empty string fails the signature check, so the run is left red.
  if (!res.ok) return "";
  return res.text();
}

interface ApiJob {
  id: number;
  name: string;
  conclusion: string | null;
  steps?: Array<{ number: number; name: string; conclusion: string | null }>;
}

export function toJob(j: ApiJob): Job {
  return {
    id: j.id,
    name: j.name,
    conclusion: j.conclusion,
    steps: (j.steps ?? []).map((s) => ({ number: s.number, name: s.name, conclusion: s.conclusion })),
  };
}

/**
 * Cheap pre-filter: does ANY failed job's first failing step look like the Unix installer?
 *
 * Pure, and exported so the test can pin that it never widens. Its only job is to decide
 * whether fetching logs (the expensive call) is worth it — the real verdict is the policy's,
 * and a false positive here costs one log fetch, never a rerun.
 */
export function worthFetchingLogs(jobs: readonly Job[]): boolean {
  return jobs.some((j) => {
    if (j.conclusion !== "failure") return false;
    const failed = [...j.steps].filter((s) => s.conclusion === "failure").sort((a, b) => a.number - b.number);
    const first = failed[0];
    return first !== undefined && INSTALL_STEP_NAME.test(first.name) && !NON_APT_STEP_NAME.test(first.name);
  });
}

interface RunListItem extends WorkflowRun {
  workflow_id: number;
}

async function listRecentFailedRuns(sinceMinutes: number): Promise<RunListItem[]> {
  const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const q = `status=failure&per_page=100&created=${encodeURIComponent(`>=${since}`)}`;
  const out = await api<{ workflow_runs: RunListItem[] }>(`/repos/${REPO}/actions/runs?${q}`);
  return out.workflow_runs ?? [];
}

async function fetchSiblings(run: RunListItem): Promise<WorkflowRun[]> {
  const branch = encodeURIComponent(run.head_branch);
  const out = await api<{ workflow_runs: WorkflowRun[] }>(
    `/repos/${REPO}/actions/workflows/${run.workflow_id}/runs?branch=${branch}&per_page=100`,
  );
  return out.workflow_runs ?? [];
}

/**
 * ONE STRUCTURED LINE PER EVALUATION — the visibility requirement.
 *
 * Fixing the symptom must not delete the evidence that the cause exists. Group these on
 * `reason` to get the rate; `toolchain-install-stall` rising means the apt wall budget is
 * being hit more often, which is a ROOT-CAUSE regression and wants the fixes named in
 * docs/research/2026-08-25-*.md, not a bigger cap here.
 */
function emit(obj: Record<string, unknown>): void {
  console.log(JSON.stringify({ at: new Date().toISOString(), ...obj }));
}

/**
 * THIS MODULE WRITES NO FILES — and that is a decision, not an omission.
 *
 * The first draft also wrote a Markdown table to `$GITHUB_STEP_SUMMARY`. A job summary is a
 * FILE WRITE onto a page rendered as Markdown, so everything reaching it from an API response
 * body is a taint sink — and a run's `name` (a workflow file's `name:` key, contributor-
 * controlled on a `pull_request` run) and `head_branch` are attacker-influenceable strings
 * that could close a table cell, inject a link, or forge a row.
 *
 * Two fixes were tried and CodeQL flagged both (`js/http-to-file-access`, medium): writing the
 * strings through a character allow-list, then writing only a revalidated integer run id.
 * Reshaping a sanitiser until an analyser stops objecting is appeasing a tool, not removing a
 * risk, and dismissing the alert would need a human clicking in the code-scanning UI — the
 * exact intervention this whole change exists to delete.
 *
 * So the sink is gone. The summary was ADDITIVE: the visibility contract this module owes was
 * always the structured stdout below, where `JSON.stringify` is the containment and nothing is
 * written to disk. Everything the table carried is in those lines, in the same job log, one
 * scroll away — and the two counting queries in the workflow header read the API and the log,
 * never a file. Fewer sinks, nothing to dismiss, no human in the loop.
 */

export async function main(argv: string[]): Promise<number> {
  const numArg = (flag: string, dflt: number): number => {
    const i = argv.indexOf(flag);
    if (i < 0) return dflt;
    const v = Number(argv[i + 1]);
    return Number.isFinite(v) && v > 0 ? v : dflt;
  };
  const apply = argv.includes("--apply");
  const sinceMinutes = numArg("--since-minutes", DEFAULT_SINCE_MINUTES);
  const maxReruns = numArg("--max-reruns", DEFAULT_MAX_RERUNS);
  // Exposed for replay: a historical run is `stale` by the 120-minute default no matter what
  // else is true of it, which would mask every other verdict when checking the policy against
  // a run from yesterday. The sweep itself never passes it.
  const maxAgeMinutes = argv.includes("--max-age-minutes") ? numArg("--max-age-minutes", 0) : undefined;
  const onlyRunId = argv.includes("--run-id") ? Number(argv[argv.indexOf("--run-id") + 1]) : undefined;
  // REPLAY ONLY. `--attempt N` evaluates the run AS IT WAS on attempt N, which is the only way
  // to check the policy against a stranded run that has since been re-run by hand — and the
  // only way this change could be verified live at all, because the run that motivated it
  // (32886176743) was manually re-run before the fix existed. It is refused together with
  // `--apply`: `rerun-failed-jobs` acts on the LATEST attempt, so applying a verdict computed
  // from an older one would be a decision about data that is no longer the run's state.
  const attempt = argv.includes("--attempt") ? Number(argv[argv.indexOf("--attempt") + 1]) : undefined;
  const USAGE =
    "usage: rerun-toolchain-install-stall-cli.ts [--since-minutes N] [--max-reruns N] " +
    "[--max-age-minutes N] [--run-id ID [--attempt N]] [--apply]";
  if (argv.includes("--run-id") && !Number.isFinite(onlyRunId)) {
    console.error(USAGE);
    return 2;
  }
  if (attempt !== undefined && (!Number.isInteger(attempt) || attempt < 1 || onlyRunId === undefined || apply)) {
    console.error(`${USAGE}\n--attempt is a positive integer, requires --run-id, and is incompatible with --apply.`);
    return 2;
  }
  const attemptPath = attempt !== undefined ? `/attempts/${attempt}` : "";

  const candidates: RunListItem[] = onlyRunId
    ? [await api<RunListItem>(`/repos/${REPO}/actions/runs/${onlyRunId}${attemptPath}`)]
    : await listRecentFailedRuns(sinceMinutes);

  // The blocking floor, announced whichever way it went. A policy that quietly reverted to
  // refusing everything would look exactly like a policy with nothing to do.
  const floorLoad = loadBlockingFloor();
  const blockingFloor = floorLoad.floor;
  emit({
    kind: "toolchain-install-stall-floor",
    status: floorLoad.status,
    path: floorLoad.path,
    ...(floorLoad.floor
      ? { workflow: floorLoad.floor.workflow, rollup: floorLoad.floor.rollupJobName, blocking: floorLoad.floor.blocking }
      : { effect: "no demotion — every mixed run is refused, as before this policy read gate.yml" }),
  });

  const byReason = new Map<string, number>();
  let rerun = 0;
  let capHit = false;

  for (const run of candidates) {
    const jobsRaw = await api<{ jobs: ApiJob[] }>(
      `/repos/${REPO}/actions/runs/${run.id}${attemptPath}/jobs?per_page=100`,
    );
    const jobs = (jobsRaw.jobs ?? []).map(toJob);

    const logs = new Map<number, string>();
    if (worthFetchingLogs(jobs)) {
      for (const j of jobs) {
        if (j.conclusion !== "failure") continue;
        logs.set(j.id, await apiText(`/repos/${REPO}/actions/jobs/${j.id}/logs`));
      }
    }
    const siblings = logs.size > 0 ? await fetchSiblings(run) : [];
    const decision = decideRerun(run, jobs, logs, siblings, {
      ...(blockingFloor !== undefined ? { blockingFloor } : {}),
      ...(maxAgeMinutes !== undefined ? { maxAgeMinutes } : {}),
    });

    byReason.set(decision.reason, (byReason.get(decision.reason) ?? 0) + 1);

    // Only SPEAK about runs that carry the signature. The sweep sees every failed run in the
    // window and logging all of them would bury the one line that matters.
    if (decision.reason === "no-install-stall" && logs.size === 0) continue;

    let applied = false;
    if (decision.action === "rerun") {
      if (rerun >= maxReruns) {
        capHit = true;
        emit({
          kind: "toolchain-install-stall-cap-hit",
          run_id: run.id,
          workflow: run.name,
          detail: `per-sweep rerun cap of ${maxReruns} reached — this looks like a mirror outage, not a flake; left RED for a human`,
        });
        continue;
      }
      if (apply) {
        await api(`/repos/${REPO}/actions/runs/${run.id}/rerun-failed-jobs`, { method: "POST" });
        applied = true;
      }
      rerun += 1;
    }
    emit({
      kind: "toolchain-install-stall-decision",
      run_id: run.id,
      workflow: run.name,
      branch: run.head_branch,
      action: decision.action,
      reason: decision.reason,
      detail: decision.detail,
      jobs: decision.classifications.map((c) => ({ name: c.jobName, verdict: c.verdict })),
      applied,
      dry_run: !apply,
    });
  }

  emit({
    kind: "toolchain-install-stall-sweep",
    window_minutes: sinceMinutes,
    evaluated: candidates.length,
    rerun,
    cap: maxReruns,
    cap_hit: capHit,
    dry_run: !apply,
    by_reason: Object.fromEntries(byReason),
  });

  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
