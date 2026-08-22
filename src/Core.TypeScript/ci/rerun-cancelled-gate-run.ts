/**
 * Auto-rerun policy for `gate` runs that end `cancelled`.
 *
 * WHY THIS EXISTS (measured, 2026-08-14 — see docs/research/2026-08-14-cancelled-gate-runs-are-apt-stalls-hitting-job-timeouts-not-concurrency-cancels.md):
 * a job killed by `timeout-minutes` reports `conclusion: cancelled`, the `gate (required)`
 * roll-up reads that as failure, and `gh pr checks` renders it as `fail`. A step that never
 * ran is presented identically to one that ran and failed, and nothing re-runs it, so an
 * auto-merge-armed PR sits red forever.
 *
 * The dominant cause (12 of 14 hung jobs) was a stalled apt mirror inside the toolchain
 * install step; that is fixed at the root in `tools/setup/linux.sh`. This module covers the
 * RESIDUAL — cancellations from any other source — and is deliberately narrow, because an
 * over-eager rerun is strictly worse than the bug it treats: re-running a genuinely failed
 * run converts a real red into a flaky green.
 *
 * Four guards, each one derived from the observed population rather than from taste:
 *
 *   1. CANCELLED ONLY. `failure` is never re-run. This is the whole safety property.
 *   2. ATTEMPT 1 ONLY. `run_attempt` is GitHub's own counter, so "at most one automatic
 *      rerun per run id" needs no state of our own to enforce — the bound is a pure
 *      function of the event payload and survives losing every record we keep.
 *   3. NOT SUPERSEDED. 27 of the 37 cancelled runs observed had a NEWER run on the same
 *      branch — i.e. concurrency `cancel-in-progress` doing exactly its job. Re-running
 *      those resurrects work that a newer commit already replaced: pure waste, and it
 *      would have been ~73% of all reruns.
 *   4. NOT STALE. A run cancelled long ago is history, not a stuck merge.
 */

export interface WorkflowRun {
  id: number;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  run_attempt: number;
}

export type RerunAction = "rerun" | "skip";

export interface RerunDecision {
  action: RerunAction;
  /** Stable machine-readable reason; also the log key a rerun-rate alert would group on. */
  reason: "cancelled-orphan" | "not-cancelled" | "already-retried" | "superseded" | "stale" | "still-running";
  detail: string;
}

export interface RerunPolicyOptions {
  /** Runs cancelled longer ago than this are history, not a stuck merge. */
  maxAgeMinutes?: number;
  /** Grace window for a superseding run created just after the cancel landed. */
  supersedeGraceSeconds?: number;
  /** Injected clock — never read the wall clock ambiently (noninterference). */
  now?: Date;
}

const DEFAULTS = {
  maxAgeMinutes: 180,
  supersedeGraceSeconds: 90,
};

/**
 * Is there a newer run for the same branch that replaces this one?
 *
 * The grace window matters: GitHub cancels the in-flight run when the superseding run is
 * QUEUED, and the cancel is recorded a few seconds later, so a strict `created > updated`
 * test misses the very supersessions it exists to catch.
 */
export function isSuperseded(
  run: WorkflowRun,
  siblings: readonly WorkflowRun[],
  graceSeconds: number = DEFAULTS.supersedeGraceSeconds,
): WorkflowRun | undefined {
  const cancelledAt = Date.parse(run.updated_at);
  const startedAt = Date.parse(run.created_at);
  const cutoff = cancelledAt + graceSeconds * 1000;
  return siblings.find((o) => {
    if (o.id === run.id) return false;
    if (o.head_branch !== run.head_branch) return false;
    const t = Date.parse(o.created_at);
    return t > startedAt && t <= cutoff;
  });
}

/**
 * Decide whether a completed `gate` run should be automatically re-run.
 *
 * Pure: every input is explicit, including the clock. Same inputs => same decision, so the
 * policy is replayable against captured run data (which is how it is tested).
 */
export function decideRerun(
  run: WorkflowRun,
  siblings: readonly WorkflowRun[],
  options: RerunPolicyOptions = {},
): RerunDecision {
  const maxAgeMinutes = options.maxAgeMinutes ?? DEFAULTS.maxAgeMinutes;
  const graceSeconds = options.supersedeGraceSeconds ?? DEFAULTS.supersedeGraceSeconds;
  const now = options.now ?? new Date();

  // Guard 1 — the safety property. Anything that is not exactly `cancelled` is left alone.
  // A genuine `failure` MUST reach a human; re-running it would launder a real red.
  if (run.status !== "completed") {
    return { action: "skip", reason: "still-running", detail: `status=${run.status}` };
  }
  if (run.conclusion !== "cancelled") {
    return {
      action: "skip",
      reason: "not-cancelled",
      detail: `conclusion=${run.conclusion ?? "null"} — only 'cancelled' is eligible`,
    };
  }

  // Guard 2 — bound the retries using GitHub's own attempt counter, so the "one rerun per
  // run id" ceiling holds with no state of our own to lose or corrupt.
  if (run.run_attempt > 1) {
    return {
      action: "skip",
      reason: "already-retried",
      detail: `run_attempt=${run.run_attempt} — one automatic rerun per run id is the ceiling`,
    };
  }

  // Guard 3 — a superseded run was cancelled on purpose; a newer run already covers it.
  const newer = isSuperseded(run, siblings, graceSeconds);
  if (newer) {
    return {
      action: "skip",
      reason: "superseded",
      detail: `run ${newer.id} on ${run.head_branch} replaces it (concurrency working as designed)`,
    };
  }

  // Guard 4 — old cancellations are history.
  const ageMinutes = (now.getTime() - Date.parse(run.updated_at)) / 60000;
  if (ageMinutes > maxAgeMinutes) {
    return {
      action: "skip",
      reason: "stale",
      detail: `cancelled ${Math.round(ageMinutes)}min ago (limit ${maxAgeMinutes}min)`,
    };
  }

  const ranForSeconds = Math.round((Date.parse(run.updated_at) - Date.parse(run.created_at)) / 1000);
  return {
    action: "rerun",
    reason: "cancelled-orphan",
    detail: `cancelled after ${ranForSeconds}s on ${run.head_branch} with no superseding run`,
  };
}
