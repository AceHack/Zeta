/**
 * Auto-rerun policy for runs whose TOOLCHAIN INSTALL STEP died on the apt wall budget.
 *
 * WHY THIS EXISTS (measured 2026-08-25, this repo, 15:28Z-20:43Z window).
 * Sixty of the window's failed runs were sampled and every failed job in them was
 * attributed to its failing step. 102 failed jobs; 17 of them died in the toolchain
 * install step BEFORE the work the job is named for had begun, under six different job
 * names in four different workflows:
 *
 *   build-and-test (ubuntu-24.04)            gate.yml
 *   Analyze (csharp)                         codeql.yml
 *   chart pins + helm template + kubeconform helm-validate.yml
 *   manifests (offline) + mutation proof     helm-validate.yml
 *   live kind ArgoCD health (ubuntu-24.04)   k8s-argocd-health-test.yml
 *   live kind included Synced+Healthy proof  k8s-argocd-health-test.yml
 *
 * One infrastructure failure wearing six names. Each one costs a human or an agent a
 * manual `gh run rerun --failed`, and that is the toil this removes.
 *
 * WHAT THE FAILURE ACTUALLY IS — and it is NOT what the log calls it. `tools/setup/linux.sh`
 * prints "stalled archive mirror, not a package error". Read against job 97946436709 the
 * word "stalled" is wrong and the correction matters, because it decides which fix works:
 *
 *   attempt 1  247s slice  103 packages fetched, killed inside emscripten (93.2 MB)
 *   attempt 2   89s slice  emscripten completed in 86s (~1.08 MB/s), 8 more, killed
 *   attempt 3   45s slice  27 more packages incl. pandoc (26.9 MB), killed inside podman
 *   -> rc=124, "did not succeed within the 420s apt budget"
 *
 * Every attempt made real forward progress and apt's archive cache carried it across
 * attempts. The mirror was not wedged, it was SLOW: ~1.1 MB/s against the 553 MB / 38.2s
 * (~14 MB/s) healthy run this budget was sized from. 561 MB at 1.1 MB/s needs ~510s of
 * download alone; the budget is 420s. So the job did not hang and it did not hit a package
 * error — it ran out of wall clock while succeeding slowly, which is a check that NEVER RAN
 * presented as one that ran and failed.
 *
 * WHY A RERUN AND NOT MORE IN-STEP RETRY. The in-step retry already exists and is already
 * exhausted: three attempts, all progressing, all killed by the SHARED 420s deadline. A
 * fourth attempt does not add time, it subdivides the same wall — measured, attempt 3 was
 * already down to a 45s slice. Extending the wall is the only thing that would help inside
 * the job, and it is not available silently: `audit-apt-budget-fits-job-timeout.ts` reports
 * the tightest FITTING margin at 18 seconds (k8s-lane-partition.yml:plan, 420 + 10 + 152 =
 * 582s against a 600s timeout), so a +20s budget bump turns that audit red and a useful bump
 * needs `timeout-minutes` edited across ~49 governed jobs. A rerun instead re-samples the one
 * variable that actually differs between the 38s run and the 420s-exhausted run: WHICH RUNNER
 * DRAWS WHICH MIRROR PATH. The budget stays exactly where the audit put it.
 *
 * THE SAFETY PROPERTY, stated so the widening is refused by name. `rerun-cancelled-gate.yml`
 * re-runs `cancelled` and deliberately never `failure`, because re-running a genuine failure
 * converts a real red into a flaky green. That refusal stands and this module does not undo
 * it. What is added is not "also retry failures" — it is a SIGNATURE, and the signature is
 * causally incapable of being about the pull request's content:
 *
 *   RETRY      the job's FIRST failing step is the toolchain install, and its log carries
 *              linux.sh's own budget-exhaustion banner together with exit 124.
 *   NEVER      anything else. A test failure, a lint finding, a type error, a build break.
 *              Exit 1 is a verdict. 124 in an install step is a check that never ran.
 *
 * Pure by construction: every input is explicit, including the clock (§13 noninterference),
 * so the policy replays deterministically against captured production runs — which is how
 * `toolchain-install-stall.test.ts` tests it.
 */

/** Subset of GitHub's workflow-run object the policy reads. */
export interface WorkflowRun {
  id: number;
  name?: string;
  head_branch: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  run_attempt: number;
}

export interface JobStep {
  number: number;
  name: string;
  conclusion: string | null;
}

export interface Job {
  id: number;
  name: string;
  conclusion: string | null;
  steps: readonly JobStep[];
}

/**
 * The step that installs the three-way-parity toolchain, under every name it currently
 * carries in `.github/workflows/` (measured 2026-08-25):
 *
 *   "Install toolchain via three-way-parity script (Unix; GOVERNANCE §24)"
 *   "Install toolchain via three-way-parity script"
 *   "Install toolchain (three-way-parity script)"
 *
 * Anchored at the start so a step merely MENTIONING the installer cannot match.
 */
export const INSTALL_STEP_NAME = /^install toolchain\b/i;

/**
 * The Windows leg runs `install.ps1`, which has no apt phase and cannot produce this
 * signature. Excluded explicitly rather than left to the log check, so a future Windows
 * failure that happened to print "124" somewhere can never reach the retry path.
 */
export const NON_APT_STEP_NAME = /windows/i;

/**
 * `linux.sh`'s own banner on budget exhaustion. This exact sentence is emitted from ONE
 * place (`tools/setup/linux.sh`, the `apt_install_rc != 0` tail) and nowhere else, which is
 * what makes it a signature rather than a heuristic.
 */
export const APT_BUDGET_EXHAUSTED = "apt-get install did not succeed within the";

/** The runner's own report of the step's exit status. 124 is `timeout` firing. */
export const EXIT_124 = /Process completed with exit code 124\b/;

/**
 * The AFTERSHOCK, and the correction to the framing this was commissioned under.
 *
 * The brief named "124 or 127" as alternate signatures. Measured, they are not alternates:
 * in every observed 127 (`bun: command not found`, jobs 97942225220 and 97959399860) the
 * 127 is a LATER step in the SAME job failing because the toolchain the install step was
 * meant to provide is absent — always downstream of a 124, never instead of one. So 127 is
 * accepted as corroboration and is NEVER a trigger on its own. A 127 with no 124 above it
 * means a binary went missing for some other reason, and that is a real red.
 */
export const EXIT_127 = /Process completed with exit code 127\b/;

/**
 * Jobs whose failure is DERIVED — they fail because another job in the same run failed, and
 * carry no independent verdict. Keyed on job name AND step name together: `gate (required)`
 * failing anywhere other than its roll-up step is a real failure and must not be laundered.
 *
 * Without this the policy is vacuous on `gate`: the roll-up would always classify as an
 * unexplained failure and no gate run would ever be eligible.
 */
export const ROLLUP_JOBS: ReadonlyArray<{ job: string; step: string }> = [
  { job: "gate (required)", step: "Check all gate jobs" },
];

export type JobVerdict =
  | "install-stall" /** first failure is the install step, on the apt wall budget */
  | "derived" /** a roll-up job reporting someone else's failure */
  | "unexplained" /** anything else — a real red, or a stall we cannot prove */
  | "not-failed";

export interface JobClassification {
  jobId: number;
  jobName: string;
  verdict: JobVerdict;
  detail: string;
}

function failedSteps(job: Job): readonly JobStep[] {
  return [...job.steps].filter((s) => s.conclusion === "failure").sort((a, b) => a.number - b.number);
}

function isRollup(job: Job, steps: readonly JobStep[]): boolean {
  return ROLLUP_JOBS.some((r) => r.job === job.name && steps.length === 1 && steps[0]?.name === r.step);
}

/**
 * Classify ONE failed job from its step list and its log.
 *
 * `log` is the job's raw log (or, in tests, a line-numbered excerpt of it — the checks are
 * substring/line tests, so an excerpt that preserves the signature lines is a faithful
 * stand-in, and one that drops them correctly fails to match).
 */
export function classifyFailedJob(job: Job, log: string): JobClassification {
  const base = { jobId: job.id, jobName: job.name };
  if (job.conclusion !== "failure") {
    return { ...base, verdict: "not-failed", detail: `conclusion=${job.conclusion ?? "null"}` };
  }
  const failed = failedSteps(job);
  if (failed.length === 0) {
    return { ...base, verdict: "unexplained", detail: "failed with no failing step recorded" };
  }
  if (isRollup(job, failed)) {
    return { ...base, verdict: "derived", detail: `roll-up job; failing step "${failed[0]!.name}"` };
  }

  // THE ORDERING GUARD. The install step must be the FIRST thing that failed. A checkout or
  // cache-restore failure ahead of it is a different fault, and a genuine red in a step
  // BEFORE the install would otherwise ride along on the install's signature.
  const first = failed[0]!;
  if (!INSTALL_STEP_NAME.test(first.name)) {
    return { ...base, verdict: "unexplained", detail: `first failing step is "${first.name}"` };
  }
  if (NON_APT_STEP_NAME.test(first.name)) {
    return { ...base, verdict: "unexplained", detail: `"${first.name}" has no apt phase` };
  }

  // THE SIGNATURE. Both halves required: linux.sh's own banner (which only the
  // budget-exhaustion path prints) AND the runner's exit-124 report.
  const hasBanner = log.includes(APT_BUDGET_EXHAUSTED);
  const has124 = EXIT_124.test(log);
  if (!hasBanner || !has124) {
    return {
      ...base,
      verdict: "unexplained",
      detail: `install step failed without the apt-budget signature (banner=${hasBanner}, exit124=${has124})`,
    };
  }

  // Steps after the install are permitted to have failed: with no toolchain on the box a
  // cleanup or diagnostic step CANNOT produce a verdict, so its failure carries no
  // information about the pull request. Steps before it were already excluded above.
  const after = failed.slice(1).map((s) => `#${s.number} ${s.name}`);
  return {
    ...base,
    verdict: "install-stall",
    detail:
      `install step "${first.name}" (#${first.number}) exhausted the apt wall budget` +
      (after.length > 0 ? `; downstream-of-no-toolchain: ${after.join(", ")}` : ""),
  };
}

export type RerunAction = "rerun" | "skip";

export type RerunReason =
  | "toolchain-install-stall"
  | "still-running"
  | "not-failed"
  | "already-retried"
  | "superseded"
  | "stale"
  | "no-install-stall"
  | "mixed-failure";

export interface RerunDecision {
  action: RerunAction;
  /** Stable machine-readable key — this is what a rerun-rate query groups on. */
  reason: RerunReason;
  detail: string;
  classifications: readonly JobClassification[];
}

export interface PolicyOptions {
  /** Runs that failed longer ago than this are history, not a stuck merge. */
  maxAgeMinutes?: number;
  /** Grace window for a superseding run created just after this one ended. */
  supersedeGraceSeconds?: number;
  /** Injected clock — never read the wall clock ambiently (§13 noninterference). */
  now?: Date;
}

const DEFAULTS = {
  maxAgeMinutes: 120,
  supersedeGraceSeconds: 90,
};

/** Is there a newer run for the same branch that replaces this one? */
export function isSuperseded(
  run: WorkflowRun,
  siblings: readonly WorkflowRun[],
  graceSeconds: number = DEFAULTS.supersedeGraceSeconds,
): WorkflowRun | undefined {
  const startedAt = Date.parse(run.created_at);
  const cutoff = Date.parse(run.updated_at) + graceSeconds * 1000;
  return siblings.find((o) => {
    if (o.id === run.id) return false;
    if (o.head_branch !== run.head_branch) return false;
    const t = Date.parse(o.created_at);
    return t > startedAt && t <= cutoff;
  });
}

/**
 * Decide whether a completed, failed run should be automatically re-run.
 *
 * `logsByJobId` supplies each FAILED job's log. A failed job with no log entry classifies as
 * `unexplained` and therefore blocks the rerun — missing evidence must never read as
 * absolving evidence.
 */
export function decideRerun(
  run: WorkflowRun,
  jobs: readonly Job[],
  logsByJobId: ReadonlyMap<number, string>,
  siblings: readonly WorkflowRun[] = [],
  options: PolicyOptions = {},
): RerunDecision {
  const maxAgeMinutes = options.maxAgeMinutes ?? DEFAULTS.maxAgeMinutes;
  const graceSeconds = options.supersedeGraceSeconds ?? DEFAULTS.supersedeGraceSeconds;
  const now = options.now ?? new Date();
  const none: readonly JobClassification[] = [];

  if (run.status !== "completed") {
    return { action: "skip", reason: "still-running", detail: `status=${run.status}`, classifications: none };
  }
  if (run.conclusion !== "failure") {
    return {
      action: "skip",
      reason: "not-failed",
      detail: `conclusion=${run.conclusion ?? "null"} — only 'failure' is in scope here (cancelled is rerun-cancelled-gate.yml's)`,
      classifications: none,
    };
  }

  // THE BOUND. GitHub's own attempt counter is the ceiling, so "at most one automatic rerun
  // per run id" needs no state of ours to enforce and survives losing every record we keep.
  // Exhausted => the run stays RED, loudly, with the mirror named in its own log.
  if (run.run_attempt > 1) {
    return {
      action: "skip",
      reason: "already-retried",
      detail: `run_attempt=${run.run_attempt} — one automatic rerun per run id is the ceiling`,
      classifications: none,
    };
  }

  const failedJobs = jobs.filter((j) => j.conclusion === "failure");
  const classifications = failedJobs.map((j) => classifyFailedJob(j, logsByJobId.get(j.id) ?? ""));
  const stalls = classifications.filter((c) => c.verdict === "install-stall");
  const unexplained = classifications.filter((c) => c.verdict === "unexplained");

  if (stalls.length === 0) {
    return {
      action: "skip",
      reason: "no-install-stall",
      detail:
        failedJobs.length === 0
          ? "run failed with no failing job"
          : `no failed job carries the apt-budget signature (${classifications.map((c) => `${c.jobName}=${c.verdict}`).join(", ")})`,
      classifications,
    };
  }

  // THE GUARD THAT MATTERS. A run holding BOTH a stall and a genuine red must reach a human:
  // re-running it would re-run the real red too, and a red that keeps being re-run is exactly
  // how a real failure becomes a flake. Live instance in the fixture: gate run 32896165119
  // had an install stall in build-and-test alongside a tsc type error and a failing hermetic
  // TypeScript suite.
  if (unexplained.length > 0) {
    return {
      action: "skip",
      reason: "mixed-failure",
      detail: `${stalls.length} install stall(s) but also ${unexplained.length} unexplained failure(s): ${unexplained
        .map((c) => `${c.jobName} (${c.detail})`)
        .join("; ")}`,
      classifications,
    };
  }

  const newer = isSuperseded(run, siblings, graceSeconds);
  if (newer) {
    return {
      action: "skip",
      reason: "superseded",
      detail: `run ${newer.id} on ${run.head_branch} replaces it`,
      classifications,
    };
  }

  const ageMinutes = (now.getTime() - Date.parse(run.updated_at)) / 60000;
  if (ageMinutes > maxAgeMinutes) {
    return {
      action: "skip",
      reason: "stale",
      detail: `failed ${Math.round(ageMinutes)}min ago (limit ${maxAgeMinutes}min)`,
      classifications,
    };
  }

  return {
    action: "rerun",
    reason: "toolchain-install-stall",
    detail: `${stalls.length} job(s) died on the apt wall budget before their named work began: ${stalls
      .map((c) => c.jobName)
      .join(", ")}`,
    classifications,
  };
}
