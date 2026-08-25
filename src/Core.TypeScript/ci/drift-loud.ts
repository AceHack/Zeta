#!/usr/bin/env bun
// drift-loud.ts -- make a NON-BLOCKING failure LOUD without making it blocking.
//
// ---------------------------------------------------------------------------
// THE ASK (Aaron 2026-08-23)
// ---------------------------------------------------------------------------
//
//   "we want drift to be LOUD so the red is immediately noticed, not a whisper --
//    just not blocking."
//
// The drift-and-heal flip is correct and is NOT what this changes: windows/macOS legs
// and every hygiene lint stay non-blocking, `gate (required)` keeps exactly the floor
// it has today, and nothing here can turn a merge red. What this closes is the OTHER
// half -- the repo had been conflating "non-blocking" with "unnoticed".
//
// ---------------------------------------------------------------------------
// WHAT WAS MEASURED, AND WHY THE EXISTING SURFACES DID NOT COVER IT (2026-08-23)
// ---------------------------------------------------------------------------
//
// `gate.yml` names four surfaces that carry a non-blocking failure. Each is real; each
// stops short of a class the others assume someone else has:
//
//   * ABSORPTION RATE. A full census of every completed `gate` push run on `main` over
//     5.5 days (2026-08-18T00:53Z..2026-08-23T16:07Z -- 600 runs, 368 cancelled before
//     any job ran, 232 inspected) found **124 job failures that sat beside a green
//     `gate (required)`**: the merge was permitted and the failure blocked nothing.
//     **Only 32 of the 124 (26%) are covered by any rate surface**, because
//     `platform-drift-report.ts` folds only job names starting `build-and-test (`. The
//     largest single absorber is `test (TS hermetic)` at 47, which nothing folds at all;
//     `lint (bash retirement inventory + hygiene unit tests)` is next at 20. Raw census
//     committed at `src/Core.TypeScript/ci/fixtures/absorbed-failure-census-2026-08-23.json`
//     -- text, diffable, and re-derivable from the Actions API.
//
//   * THE CLASS NOTHING COVERS AT ALL. `continue-on-error` at the STEP level produces a
//     job whose conclusion is `success` with a failed step inside. Every surface listed
//     in gate.yml derives from a JOB conclusion, so a step-level swallow is invisible to
//     all four -- there is no red X, no annotation, no ledger row. It is strictly worse
//     than the job-level case and had no detector.
//
//     The census above found **zero** of these, and that number is the argument for the
//     canary rather than against the class: with no naturally-occurring specimen, "no
//     findings" and "detector broken" produce byte-identical output. Eight
//     `continue-on-error` steps exist in this repo's workflows today (agent-heartbeat
//     x2, chart-version-refresh, gate's own `Emit scope`, drift-sweep's publish step,
//     proof-closure-drift x2, github-settings-drift), so the class is real and live.
//
//     WHY IT WAS ZERO -- and this is the finding the canary was built to produce, caught
//     on its FIRST live run (gate run 32651748761, 2026-08-23):
//
//       **The REST jobs API reports a swallowed step's conclusion as `success`.**
//
//     Measured against the canary, whose one step exits 1 under `continue-on-error`:
//       GET /actions/runs/32651748761/jobs -> drift-canary conclusion `success`, and
//       its steps read `[Set up job: success, drift canary --- deliberate non-blocking
//       failure: SUCCESS, Explain the green: success, Complete job: success]`.
//     The step that failed is reported as having succeeded. `outcome` (the pre-
//     continue-on-error value) exists only inside the workflow as `steps.<id>.outcome`
//     and is not on the REST payload at all. So the class was not merely unsurfaced --
//     from the API every previous surface reads, it is UNREPRESENTABLE. gate.yml's note
//     that "the API reports a continue-on-error leg's conclusion as `failure`" is true
//     of JOBS and false of STEPS, and that asymmetry is what hid the class.
//
//     THE CHANNEL THAT DOES CARRY IT: the runner still files a check-run ANNOTATION.
//       GET /check-runs/97224512630/annotations
//         -> [{ annotation_level: "failure", message: "Process completed with exit code 1." }]
//       on a check run whose own `conclusion` is `success`.
//     So the detectable signature of a step-level swallow is **a green check run
//     carrying a `failure`-level annotation**, and that is what `censusOfRun` now reads.
//     Job conclusions cannot express it; annotations can.
//
//   * THE SURFACES THEMSELVES WENT QUIET. This is the finding that decided the design.
//     `drift-sweep.yml` computes the drift ledger every few minutes and pushes it to
//     `main`. Since **2026-08-13** that push has been REJECTED by the "CI Gate" ruleset
//     (`remote: error: GH013 ... Required status check "gate (required)" is expected`),
//     and the workflow swallows it with
//         git push || echo "push race -- next tick re-records (idempotent)"
//     which misattributes a PERMANENT rule rejection as a TRANSIENT race. Measured:
//     **1,597 `drift-sweep` runs concluded `success`** between 2026-08-13 and
//     2026-08-23 while `docs/drift-events/` stayed frozen at tick `000247` and
//     `data/platform-drift.json` stayed frozen at run `32232815018` (2026-08-19).
//     The dashboard everyone was pointed at has been reporting four-day-old numbers
//     from behind a green check.
//
// So the honest statement of the gap is not "nothing looks at drift". It is: the
// detectors are fine, and the ROUTE FROM DETECTOR TO EYES had three holes -- a coverage
// hole (only one job prefix), a class hole (step-level), and a liveness hole (the
// publication itself could stop landing and say nothing).
//
// ---------------------------------------------------------------------------
// WHERE "LOUD" LIVES, AND WHY NOT THE OBVIOUS PLACE
// ---------------------------------------------------------------------------
//
// The obvious home is the dashboard, and it was rejected on the evidence above: a data
// file that cannot land on `main` is not a surface, it is a hope. Loud therefore lives
// in the RUN, where nothing has to be published for it to be seen:
//
//   1. **The job's own conclusion.** `drift (loud)` goes RED and is NOT in the
//      `gate (required)` floor, so it is a red X in the checks list next to a green
//      required check. That is precisely "loud, not blocking" -- and it is the same
//      mechanism gate.yml already calls surface 0 for the Windows legs, generalised.
//   2. **`::error::` / `::warning::` / `::notice::` annotations**, which render in the
//      PR UI and at the top of the run without touching any conclusion.
//   3. **The step summary**, which renders at the top of the run page.
//   4. A JSON artifact for anything that wants to fold it later -- deliberately LAST,
//      because it is the layer that was already demonstrated to be able to go quiet.
//
// ---------------------------------------------------------------------------
// PROPORTIONALITY IS A REQUIREMENT, NOT A POLISH
// ---------------------------------------------------------------------------
//
// A guard that cries wolf gets switched off, so loudness is banded by how persistent
// the drift is, and every band is computed over a BOUNDED window of EXECUTIONS:
//
//   SUSTAINED  -> `::error::`   failing at least half the time, at least `minFailures`
//                               times, and NOT healed. Red exit.
//   FLAPPING   -> `::warning::` intermittent, more than once.
//   ONE_OFF    -> `::notice::`  exactly one failure in the window.
//   HEALED     -> summary row only, no annotation. Failed inside the window, then went
//                 clean for a full `healStreak` of consecutive executions.
//   UNOBSERVED -> no failure in the window. Deliberately NOT called "healthy".
//
// `HEALED` is checked BEFORE the rate bands and it exists because of a specific bug
// found in this repo on 2026-08-23: an unbounded window reported a lane `MOSTLY
// FAILING` for twelve days after it was fixed. An alarm that stays lit after the
// defect is gone is how a real signal gets muted, so the fix is structural -- the
// window is bounded by construction (`windowRuns`) and a clean streak demotes a band
// rather than being averaged away.
//
// ---------------------------------------------------------------------------
// THE FALSIFIER THAT CANNOT BE ARGUED WITH: THE CANARY
// ---------------------------------------------------------------------------
//
// A second surface that can itself go quiet is the class this repo keeps
// rediscovering -- and the measurement above is the third instance of it. So this
// reporter carries a live falsifier rather than a claim: `gate.yml` runs a
// `drift-canary` job whose one step FAILS on purpose under `continue-on-error: true`,
// on every run, forever. That job concludes `success` with a failed step inside -- an
// exact specimen of the class that had no detector.
//
// `assertDetectorLive` then requires the canary to appear in the census. If step-level
// detection ever breaks, the canary goes missing, and the reporter goes RED with
// `DETECTOR WENT QUIET`. Silence is what fails the check, which is the only way to
// keep an observability layer honest. It is not a test that can pass vacuously: delete
// the class-C branch of `censusOfRun` and this goes red on the next run.
//
// ---------------------------------------------------------------------------
// TWO WAYS THIS REPORTER USED TO REPORT GREEN WITHOUT LOOKING (closed 2026-08-25)
// ---------------------------------------------------------------------------
//
// The canary above is sound and was VERIFIED LIVE while these were written -- gate run
// 32864087075, job 97862170100, 15:31:42Z:
//
//     Detector liveness: OK -- detector live: the canary's swallowed step was observed
//     in run 32864087075 via the annotation channel (Process completed with exit code 1.)
//
// The canary had not gone quiet. Two OTHER paths through this file, however, reached
// green without ever consulting it, and both are this file's own carved sentence turned
// against itself:
//
//   1. NO CREDENTIAL, NO REPO -> `return 0`. `main()` printed one line to stderr and
//      exited GREEN when `GH_TOKEN`/`repo` were empty: no window, no census, no
//      `assertDetectorLive`, no staleness check. Reproduced on the unfixed file:
//
//        $ bun src/Core.TypeScript/ci/drift-loud.ts --repo "" --ledger data/platform-drift.json
//        [drift-loud] no token or repo and no --records: nothing to fold.
//        EXIT=0
//
//      A secret that silently stops being delivered -- rotated, unset, scoped away -- is
//      exactly how a reporter goes quiet in practice, and this path made that outcome
//      indistinguishable from a clean run. It now returns 2 and says which input is
//      missing. Two, not one: this is a configuration error, not a drift finding, and
//      collapsing those is how `exit 2` gets misread as a failing check.
//
//   2. UNREADABLE LEDGER -> "publication landing". `publishedWatermark` answered 0 for
//      a file that was absent, truncated, or simply not in the job's sparse-checkout,
//      and `publicationIsStale` reads 0 as "nothing published yet" -- a real and
//      different state that must not fire on day one. So a MISSING ledger printed the
//      affirmative claim `EXIT 0 -- ... publication landing.` Reproduced on the unfixed
//      file with the ledger path pointed at a file that does not exist:
//
//        $ bun ...drift-loud.ts --records fixture.json --run-id 900 --ledger /nope.json
//        EXIT 0 -- no sustained drift, detector live, publication landing.
//        EXIT=0
//
//      That is not a silent skip; it is a false statement about a file it never opened.
//      The three states are now distinguished -- `absent` (never published, or not
//      checked out) is LOUD and red; `empty` (published, watermark 0) stays quiet; a
//      real watermark is compared as before. `gate.yml` sparse-checks exactly one data
//      file for this job, so dropping that one line from the checkout list is a one-token
//      edit that used to buy a permanent green.
//
// GAP 3, STATED HONESTLY. The publication staleness this reporter exists to catch is
// LIVE and was ALREADY LOUD when this was written -- `data/platform-drift.json` is pinned
// at run 32816944713 and the same job printed
// `::error title=drift publication not landing::` and exited 1. The root cause is not in
// this file: flush PR #15276 has been open since 06:37Z with `gate (required)` red on it,
// so every later tick parks on `heartbeat/drift-sweep-buffer` and main's ledger stays
// frozen. What was fixable HERE is the case above, where the alarm cannot fire at all.
//
// ---------------------------------------------------------------------------
// DISCIPLINES
// ---------------------------------------------------------------------------
//
// DST (§7): `foldAbsorption` is a pure function of the run records. No clock -- runs are
// ordered by run id, and ISO timestamps ride along as metadata that never enters the
// fold. Idempotency (§6): re-running produces byte-identical output for the same input.
// Noninterference (§13): the only entry points for influence are `argv` and the records
// handed in; the network edge is below the `Edge` banner and touches no fold.
//
// Usage (CI):
//   GH_TOKEN=... bun src/Core.TypeScript/ci/drift-loud.ts --repo owner/name \
//     --run-id <this run> --out data/drift-loud.json
// Usage (local, against captured fixtures -- no network):
//   bun src/Core.TypeScript/ci/drift-loud.ts --offline --records <file.json>
//
// EXIT CODE IS THE LOUDNESS, NOT A GATE. Non-zero means "a drift signal is at its
// loudest band, or the detector cannot prove it is still working". The job that runs
// this is not in the `gate (required)` floor, so a non-zero exit is a visible red X
// and merges are unaffected. Adding this job to the floor would be a treaty amendment
// and is explicitly NOT what was asked for.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** The rollup whose conclusion separates "this failure blocked the merge" from "it did not". */
export const ROLLUP_JOB_NAME = "gate (required)";

/** The deliberate specimen. See "THE FALSIFIER THAT CANNOT BE ARGUED WITH" above. */
export const CANARY_JOB_NAME = "drift-canary";

/** This reporter's own job name. See `isInstrument`. */
export const REPORTER_JOB_NAME = "drift (loud)";

/** Steps the runner injects around user steps -- never drift, and never annotated. */
const RUNNER_STEP_NAMES: ReadonlySet<string> = new Set(["Set up job", "Complete job"]);

/**
 * Subject suffix for a step-level swallow found via the annotation channel.
 *
 * The annotation does NOT carry the step's name (its `message` is the runner's generic
 * "Process completed with exit code 1."), so the subject is keyed on the JOB. That loses
 * which step swallowed and keeps the key STABLE, which is the right trade for a rate:
 * a subject key that changes with the message text would fragment one lane into many.
 * The messages themselves are carried on the `Absorption` so nothing is discarded.
 */
export const SWALLOWED_STEP = "(step swallowed by continue-on-error)";

export interface StepRecord {
  readonly name: string;
  readonly conclusion: string | null;
}

export interface JobRecord {
  readonly name: string;
  readonly conclusion: string | null;
  readonly steps?: readonly StepRecord[] | undefined;
  /**
   * Check-run id. Equal to the job id -- verified live: job 97224512630 is also check
   * run 97224512630. Carried so annotations can be fetched without a second lookup.
   */
  readonly id?: number | undefined;
  /**
   * `failure`-level check-run annotation messages. THE ONLY API-VISIBLE EVIDENCE of a
   * step-level `continue-on-error` swallow -- see the header. Absent (not empty) when
   * annotations were never fetched, which is a different claim from "there were none".
   */
  readonly failureAnnotations?: readonly string[] | undefined;
}

/** One completed workflow run reduced to what the fold needs. */
export interface RunRecord {
  readonly id: number;
  /** ISO metadata ONLY -- never enters the fold. */
  readonly at: string;
  readonly sha: string;
  /** Run-level conclusion: `success` | `failure` | `cancelled` | ... */
  readonly conclusion: string;
  readonly jobs: readonly JobRecord[];
}

/**
 * How a failure was absorbed.
 *
 * `job-red-gate-green` -- the job's own conclusion is `failure` and the required rollup
 * is `success`. Job-level `continue-on-error`, or a job simply outside the floor. It has
 * ONE existing surface (its own red X) and no rate anywhere unless its name happens to
 * start `build-and-test (`.
 *
 * `step-red-job-green` -- the job concluded `success` with a failed step inside.
 * Step-level `continue-on-error`. Strictly worse: there is no red X at all, so every
 * job-conclusion-derived surface in the repo is blind to it.
 */
export type AbsorptionKind = "job-red-gate-green" | "step-red-job-green";

/** A single absorbed failure, keyed by the subject it should be attributed to. */
export interface Absorption {
  readonly kind: AbsorptionKind;
  /** `job` for a job-level absorption, `job › step` for a step-level one. */
  readonly subject: string;
  readonly job: string;
  readonly step: string | null;
  readonly runId: number;
  readonly at: string;
  /** Annotation messages behind a step-level absorption; empty otherwise. */
  readonly detail?: readonly string[] | undefined;
}

export type Band = "SUSTAINED" | "FLAPPING" | "ONE_OFF" | "HEALED" | "UNOBSERVED";

/** Annotation severity. `null` means "summary row only" -- the anti-cry-wolf setting. */
export type Severity = "error" | "warning" | "notice" | null;

export interface SubjectStat {
  readonly subject: string;
  readonly kind: AbsorptionKind;
  /** The job this subject was derived from. Carried so the canary can be found by JOB
   * name rather than by parsing the composite `job › step` subject key back apart. */
  readonly job: string;
  /** The step, for a step-level subject; `null` for a job-level one. */
  readonly step: string | null;
  readonly band: Band;
  /** Runs in the window in which this subject executed (reached a conclusion). */
  readonly executions: number;
  readonly failures: number;
  readonly failureRate: number;
  /** Consecutive most-recent EXECUTIONS with no failure. Demotes the band when long. */
  readonly cleanStreak: number;
  readonly lastFailure: { readonly runId: number; readonly at: string } | null;
}

export interface Thresholds {
  /** Hard bound on how many runs the fold may look at. The `MOSTLY FAILING` guard. */
  readonly windowRuns: number;
  /** Consecutive clean executions that demote any band to `HEALED`. */
  readonly healStreak: number;
  /** Failure rate at or above which a subject may be `SUSTAINED`. */
  readonly sustainedRate: number;
  /** Failures at or above which a subject may be `SUSTAINED`. Rate alone is not enough. */
  readonly sustainedMinFailures: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  windowRuns: 60,
  healStreak: 10,
  sustainedRate: 0.5,
  sustainedMinFailures: 3,
};

export interface DriftLoudReport {
  /** Runs actually folded (after the window bound). */
  readonly runs: number;
  /** Runs whose jobs executed -- the honest denominator. */
  readonly executedRuns: number;
  readonly cancelledRuns: number;
  readonly coverage: number;
  readonly totalAbsorbed: number;
  readonly subjects: readonly SubjectStat[];
  /** Highest run id folded. The fold's own watermark, never a clock. */
  readonly latestRunId: number;
  readonly thresholds: Thresholds;
}

// ---------------------------------------------------------------------------
// Pure fold -- nothing below this line until `Edge` touches the network or a clock
// ---------------------------------------------------------------------------

/** Newest-first by run id. Stable, total, clock-free. */
export function orderNewestFirst(records: readonly RunRecord[]): readonly RunRecord[] {
  return [...records].sort((a, b) => b.id - a.id);
}

/** True when this job executed at all -- i.e. reached a conclusion we can reason about. */
function executed(job: JobRecord): boolean {
  return job.conclusion === "success" || job.conclusion === "failure";
}

/**
 * Every absorbed failure in ONE run.
 *
 * A failure is absorbed when the merge was permitted anyway. The rollup's conclusion is
 * the discriminator, exactly as `gate-scope-summary.ts` and `platform-drift-report.ts`
 * derive it -- so nothing here knows the word "windows", "markdownlint", or any job name
 * except the rollup's and the canary's. When a run carries no rollup at all (a workflow
 * other than `gate`), the run's own conclusion stands in: a green run with a red job
 * inside absorbed it just the same.
 */
export function censusOfRun(run: RunRecord): readonly Absorption[] {
  const rollup = run.jobs.find((j) => j.name === ROLLUP_JOB_NAME);
  const permitted = rollup === undefined ? run.conclusion === "success" : rollup.conclusion === "success";
  const out: Absorption[] = [];
  for (const job of run.jobs) {
    if (job.name === ROLLUP_JOB_NAME) continue;
    if (job.conclusion === "failure") {
      // Class A/B. Only absorbed if the required check stayed green; a job that failed
      // BESIDE a red rollup blocked the merge and is not this rule's business.
      if (permitted) out.push({ kind: "job-red-gate-green", subject: job.name, job: job.name, step: null, runId: run.id, at: run.at });
      continue;
    }
    if (job.conclusion !== "success") continue;

    // Class C, PRIMARY CHANNEL: a green check run carrying a `failure`-level annotation.
    // This is the only API-visible evidence a step-level swallow leaves -- the step's own
    // `conclusion` reads `success` (header, "WHY IT WAS ZERO"). Independent of
    // `permitted`: a green job hides its failed step whether or not anything else in the
    // run was red, and no job-conclusion surface anywhere can see it.
    const annotations = job.failureAnnotations ?? [];
    if (annotations.length > 0) {
      out.push({
        kind: "step-red-job-green",
        subject: `${job.name} › ${SWALLOWED_STEP}`,
        job: job.name,
        step: SWALLOWED_STEP,
        runId: run.id,
        at: run.at,
        detail: annotations,
      });
    }

    // Class C, SECONDARY CHANNEL, kept deliberately. GitHub does not report a swallowed
    // step as `failure` TODAY; if that ever changes, or if records arrive from a source
    // that does carry it (a fixture, a self-hosted runner, a future API version), this
    // branch reads it directly and names the STEP rather than only the job. It is not
    // dead code guarded by optimism -- it is covered by its own falsifier in the test
    // file, and it degrades to zero findings on today's payloads rather than to a wrong
    // answer.
    for (const step of job.steps ?? []) {
      if (step.conclusion !== "failure") continue;
      if (RUNNER_STEP_NAMES.has(step.name)) continue;
      out.push({ kind: "step-red-job-green", subject: `${job.name} › ${step.name}`, job: job.name, step: step.name, runId: run.id, at: run.at });
    }
  }
  return out;
}

/** Did this subject execute in this run? Needed so a clean streak counts executions, never pushes. */
function subjectExecuted(run: RunRecord, jobName: string, stepName: string | null): boolean {
  const job = run.jobs.find((j) => j.name === jobName);
  if (job === undefined || !executed(job)) return false;
  if (stepName === null) return true;
  // The annotation-derived subject has no step to look up -- the annotation never named
  // one. Its execution IS the job's, and treating it otherwise would report zero
  // executions and therefore a meaningless rate.
  if (stepName === SWALLOWED_STEP) {
    // ...but only where annotations were actually FETCHED. A run whose annotations were
    // never queried is not evidence of a clean run, and counting it as an execution
    // would inflate every clean streak by the runs we did not look at. Unknown stays
    // unknown -- the four-register discipline applied to an API budget.
    return job.failureAnnotations !== undefined;
  }
  const step = (job.steps ?? []).find((s) => s.name === stepName);
  return step !== undefined && (step.conclusion === "success" || step.conclusion === "failure");
}

/**
 * Band from the counts.
 *
 * ORDER IS THE POINT. `HEALED` is tested first, so a long clean streak demotes a subject
 * that would otherwise average out as `SUSTAINED` across a stale window. That is the
 * structural fix for the alarm that stayed lit for twelve days after its defect was gone.
 */
export function bandOf(failures: number, executions: number, cleanStreak: number, t: Thresholds): Band {
  if (failures === 0) return "UNOBSERVED";
  if (cleanStreak >= t.healStreak) return "HEALED";
  const rate = executions === 0 ? 0 : failures / executions;
  if (rate >= t.sustainedRate && failures >= t.sustainedMinFailures) return "SUSTAINED";
  if (failures > 1) return "FLAPPING";
  return "ONE_OFF";
}

/** Loudness for a band. `HEALED` and `UNOBSERVED` are deliberately silent in the PR UI. */
export function severityOf(band: Band): Severity {
  switch (band) {
    case "SUSTAINED":
      return "error";
    case "FLAPPING":
      return "warning";
    case "ONE_OFF":
      return "notice";
    default:
      return null;
  }
}

/** Pure fold over the run records. Bounded by `thresholds.windowRuns` before anything else. */
export function foldAbsorption(
  records: readonly RunRecord[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): DriftLoudReport {
  const ordered = orderNewestFirst(records).slice(0, thresholds.windowRuns);

  const absorptions: Absorption[] = [];
  for (const run of ordered) absorptions.push(...censusOfRun(run));

  const subjects = new Map<string, { kind: AbsorptionKind; job: string; step: string | null }>();
  for (const a of absorptions) subjects.set(a.subject, { kind: a.kind, job: a.job, step: a.step });

  const stats: SubjectStat[] = [];
  for (const [subject, meta] of [...subjects.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    let executions = 0;
    let failures = 0;
    let cleanStreak = 0;
    let streakOpen = true;
    let lastFailure: SubjectStat["lastFailure"] = null;

    for (const run of ordered) {
      if (!subjectExecuted(run, meta.job, meta.step)) continue;
      executions++;
      const failed = absorptions.some((a) => a.runId === run.id && a.subject === subject);
      if (failed) {
        failures++;
        if (lastFailure === null) lastFailure = { runId: run.id, at: run.at };
        streakOpen = false;
      } else if (streakOpen) {
        cleanStreak++;
      }
    }

    stats.push({
      subject,
      kind: meta.kind,
      job: meta.job,
      step: meta.step,
      band: bandOf(failures, executions, cleanStreak, thresholds),
      executions,
      failures,
      failureRate: executions === 0 ? 0 : failures / executions,
      cleanStreak,
      lastFailure,
    });
  }

  const executedRuns = ordered.filter((r) => r.jobs.some(executed)).length;
  const cancelledRuns = ordered.filter((r) => r.conclusion === "cancelled").length;

  return {
    runs: ordered.length,
    executedRuns,
    cancelledRuns,
    coverage: ordered.length === 0 ? 0 : executedRuns / ordered.length,
    totalAbsorbed: absorptions.length,
    subjects: stats,
    latestRunId: ordered[0]?.id ?? 0,
    thresholds,
  };
}

// ---------------------------------------------------------------------------
// The detector's own liveness -- falsifier #2
// ---------------------------------------------------------------------------

export interface LivenessVerdict {
  readonly live: boolean;
  readonly reason: string;
}

/**
 * The canary must be in the census, or the detector has gone quiet.
 *
 * This is the whole answer to "a silent absorption fails the check". `drift-canary`
 * fails one step under `continue-on-error` on EVERY run, so a working step-level
 * detector cannot fail to see it. If it is missing, either class-C detection broke or
 * the canary stopped running -- and both are reasons to go red, because in both cases
 * this reporter's green would be a claim it can no longer support.
 */
export function assertDetectorLive(currentRun: RunRecord | null): LivenessVerdict {
  // Asserted against THIS RUN, not the window, and that is the stronger claim: it says
  // step-level detection worked on the very payload being reported, rather than that it
  // worked at some point recently. It also happens to be the only affordable form --
  // annotations cost one call per green job, so they are fetched for this run alone.
  if (currentRun === null) {
    return {
      live: false,
      reason:
        "DETECTOR WENT QUIET: the current run was not available to fold, so step-level detection could not be " +
        "exercised at all. Unverified is not the same as working, and this reporter does not report green on it.",
    };
  }
  const canary = censusOfRun(currentRun).find((a) => a.kind === "step-red-job-green" && a.job === CANARY_JOB_NAME);
  if (canary === undefined) {
    const job = currentRun.jobs.find((j) => j.name === CANARY_JOB_NAME);
    const why =
      job === undefined
        ? `job \`${CANARY_JOB_NAME}\` did not appear in run ${currentRun.id} at all`
        : job.failureAnnotations === undefined
          ? `job \`${CANARY_JOB_NAME}\` was found but its check-run annotations were never fetched`
          : `job \`${CANARY_JOB_NAME}\` concluded \`${job.conclusion}\` carrying ${job.failureAnnotations.length} failure annotation(s)`;
    return {
      live: false,
      reason:
        `DETECTOR WENT QUIET: no step-level absorption was observed in run ${currentRun.id} (${why}). That job ` +
        "fails one step on purpose, under `continue-on-error`, on every run, so a working detector cannot miss " +
        "it. Seeing nothing means step-level detection is broken or the canary stopped running -- NOT that " +
        "there is no drift. A reporter that cannot prove it is looking must not report green.",
    };
  }
  return {
    live: true,
    reason:
      `detector live: the canary's swallowed step was observed in run ${currentRun.id} via the annotation ` +
      `channel (${(canary.detail ?? []).join("; ") || "no message"})`,
  };
}

/**
 * Is a published drift artifact still landing?
 *
 * `data/platform-drift.json` and `docs/drift-events/` are written every tick and pushed
 * to `main`; when that push is rejected the workflow still reports green, so the only
 * evidence is that the artifact's own watermark stops advancing. A watermark older than
 * every run in the current window means the publication has stopped landing entirely.
 */
export function publicationIsStale(
  publishedWatermark: number,
  oldestRunIdInWindow: number,
): boolean {
  // Nothing published yet is a DIFFERENT claim (a new artifact, not a stopped one), and
  // conflating them would make this fire on day one of any new publication.
  if (publishedWatermark <= 0) return false;
  if (oldestRunIdInWindow <= 0) return false;
  // Strictly older than every run we can see. Not "a bit behind" -- a tick that is merely
  // racing lands within the window, so this fires only when the route itself has stopped.
  return publishedWatermark < oldestRunIdInWindow;
}

/** Lowest run id in the folded window, or 0 when the window is empty. */
export function oldestRunId(records: readonly RunRecord[], windowRuns: number): number {
  const ordered = orderNewestFirst(records).slice(0, windowRuns);
  return ordered[ordered.length - 1]?.id ?? 0;
}

// ---------------------------------------------------------------------------
// Render -- annotations, summary, markdown. Still pure: returns strings.
// ---------------------------------------------------------------------------

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

const BAND_LABEL: Readonly<Record<Band, string>> = {
  SUSTAINED: "SUSTAINED -- failing most runs, unhealed",
  FLAPPING: "flapping -- intermittent",
  ONE_OFF: "one-off",
  HEALED: "healed -- failed in window, clean since",
  UNOBSERVED: "unobserved -- no failure in window",
};

const KIND_LABEL: Readonly<Record<AbsorptionKind, string>> = {
  "job-red-gate-green": "job red, `gate (required)` green",
  "step-red-job-green": "step red, JOB GREEN (no red X anywhere)",
};

/**
 * Is this subject the INSTRUMENT rather than a measurement?
 *
 * Two jobs are, and both were caught by reading live output rather than by reasoning:
 *
 * **The canary** fails on every run by design. Left in the ordinary bands it climbs to
 * `SUSTAINED` and emits an `::error::` forever -- a permanent false alarm, self-inflicted
 * by the instrument, which is exactly the cry-wolf failure this surface exists to avoid.
 *
 * **This reporter itself.** Observed on gate run 32654127165: `drift (loud)` appeared in
 * its own table at `2/3 executions failed (66.7%)`. It is a non-floor job that fails
 * beside a green rollup, so by the fold's own definition it IS an absorbed failure -- the
 * definition is right and the reading is useless. Its red X *is* the drift display; a row
 * saying "the drift display went red" reports the same event twice rather than adding
 * information. Worse, it self-amplifies: every loud run raises its own failure rate, so
 * it converges on `SUSTAINED` regardless of whether any real drift exists, and an
 * `::error::` that is always present is an `::error::` nobody reads. The reporter would
 * have drowned out the signals it was built to carry, and it would have looked like
 * evidence while doing it.
 *
 * THIS IS NOT SILENCING. Nothing is made quieter: both jobs keep their own conclusions,
 * their own annotations, and their own place in the checks list, and both stay in the
 * CENSUS -- `assertDetectorLive` still goes red when the canary is missing. What is
 * removed is a self-referential row that measures the measuring, and whose only effect
 * on a reader is to raise the noise floor.
 *
 * The general rule, and the test for anything added here later: a subject belongs on this
 * list only when its failure IS the reporting mechanism firing. Anything whose failure is
 * an independent event stays a finding, however noisy.
 */
export function isInstrument(subject: SubjectStat): boolean {
  return subject.job === CANARY_JOB_NAME || subject.job === REPORTER_JOB_NAME;
}

/** One `::severity::` workflow command per loud subject. Empty when nothing is loud. */
export function annotationLines(report: DriftLoudReport): readonly string[] {
  const out: string[] = [];
  for (const s of report.subjects) {
    if (isInstrument(s)) continue;
    const sev = severityOf(s.band);
    if (sev === null) continue;
    const last = s.lastFailure === null ? "never" : `run ${s.lastFailure.runId}`;
    out.push(
      `::${sev} title=drift (${s.band})::${s.subject} -- ${s.failures}/${s.executions} executions failed ` +
        `(${pct(s.failureRate)}), clean streak ${s.cleanStreak}, last ${last}. ` +
        `${KIND_LABEL[s.kind]}. This is a DRIFT signal: it is loud on purpose and it blocks nothing.`,
    );
  }
  return out;
}

export function renderMarkdown(report: DriftLoudReport, liveness: LivenessVerdict, stalePublication: string | null): string {
  const loud = report.subjects.filter((s) => !isInstrument(s) && severityOf(s.band) !== null);
  const sustained = report.subjects.filter((s) => !isInstrument(s) && s.band === "SUSTAINED");
  const out: string[] = [
    "## Drift -- loud, and blocking nothing",
    "",
    `**${report.totalAbsorbed} absorbed failure(s)** across ${report.subjects.length} subject(s) (of which the ` +
      "canary and this reporter are instruments, not findings) in the last " +
      `${report.runs} run(s) (window is bounded at ${report.thresholds.windowRuns}). ` +
      `Coverage: ${report.executedRuns}/${report.runs} runs actually executed jobs (${pct(report.coverage)}); ` +
      `${report.cancelledRuns} were cancelled before anything ran. Every rate below is over EXECUTIONS.`,
    "",
  ];
  if (stalePublication !== null) out.push(`> **${stalePublication}**`, "");
  if (!liveness.live) out.push(`> **${liveness.reason}**`, "");

  const findings = report.subjects.filter((s) => !isInstrument(s));
  if (findings.length === 0) {
    out.push("_No absorbed failure in the window (the canary and this reporter are instruments, not findings)._", "");
  } else {
    out.push(
      "| subject | band | class | executions | failures | rate | clean streak | last |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const s of report.subjects) {
      if (isInstrument(s)) continue;
      out.push(
        `| \`${s.subject}\` | ${BAND_LABEL[s.band]} | ${KIND_LABEL[s.kind]} | ${s.executions} | ${s.failures} | ` +
          `${pct(s.failureRate)} | ${s.cleanStreak} | ${s.lastFailure === null ? "--" : `run ${s.lastFailure.runId}`} |`,
      );
    }
    out.push("");
  }

  out.push(
    `Loud: **${loud.length}** annotated (${sustained.length} at \`::error::\`). ` +
      "`healed` and `unobserved` rows carry NO annotation on purpose -- an alarm that stays lit after its " +
      "defect is gone is how a real signal gets muted.",
    "",
    "**This job is not in the `gate (required)` floor.** A red X here is a drift signal, never a merge block. " +
      "Making any of these blocking is a floor amendment and a separate, human decision.",
    "",
    `Detector liveness: ${liveness.live ? "OK" : "**FAILED**"} -- ${liveness.reason}`,
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
  readonly id?: number | undefined;
  readonly name: string;
  readonly conclusion: string | null;
  readonly steps?: readonly { readonly name: string; readonly conclusion: string | null }[] | undefined;
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

/**
 * `failure`-level annotation messages on a check run, or `undefined` when they could not
 * be read. `undefined` and `[]` are DIFFERENT claims and the fold depends on the
 * difference: `[]` means "looked, found none", `undefined` means "did not look".
 */
async function fetchFailureAnnotations(repo: string, checkRunId: number, token: string): Promise<readonly string[] | undefined> {
  try {
    const payload = await ghJson<readonly { readonly annotation_level?: string; readonly message?: string }[]>(
      `https://api.github.com/repos/${repo}/check-runs/${checkRunId}/annotations?per_page=100`,
      token,
    );
    return payload.filter((a) => a.annotation_level === "failure").map((a) => a.message ?? "(no message)");
  } catch {
    return undefined;
  }
}

async function fetchRun(repo: string, run: ApiRun, token: string, withAnnotations = false): Promise<RunRecord> {
  const base = { id: run.id, at: run.created_at, sha: run.head_sha, conclusion: run.conclusion ?? "unknown" };
  if (base.conclusion === "cancelled") return { ...base, jobs: [] };
  const payload = await ghJson<{ readonly jobs?: readonly ApiJob[] }>(
    `https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`,
    token,
  );
  const jobs: JobRecord[] = [];
  for (const j of payload.jobs ?? []) {
    // Annotations are fetched for GREEN jobs only, and only where asked. A red job's
    // failure is already visible in its conclusion, so paying a call to learn it again
    // buys nothing; the green ones are the whole point.
    const annotations =
      withAnnotations && j.conclusion === "success" && typeof j.id === "number"
        ? await fetchFailureAnnotations(repo, j.id, token)
        : undefined;
    jobs.push({
      name: j.name,
      conclusion: j.conclusion,
      ...(typeof j.id === "number" ? { id: j.id } : {}),
      steps: (j.steps ?? []).map((s) => ({ name: s.name, conclusion: s.conclusion })),
      ...(annotations === undefined ? {} : { failureAnnotations: annotations }),
    });
  }
  return { ...base, jobs };
}

function flagValue(argv: readonly string[], flag: string, fallback: string): string {
  const i = argv.indexOf(flag);
  return i >= 0 ? (argv[i + 1] ?? fallback) : fallback;
}

/**
 * What the published drift ledger says, as THREE states rather than two.
 *
 * `absent` is the one that matters and the one that used to be missing: a ledger that
 * could not be read is NOT a ledger reporting zero. Collapsing them let a file this job
 * never opened -- deleted, truncated, or simply left out of the sparse-checkout -- read
 * as "publication landing". See the header, item 2.
 */
export type LedgerRead =
  | { readonly kind: "absent"; readonly why: string }
  | { readonly kind: "watermark"; readonly runId: number };

export function readPublishedWatermark(
  path: string,
  read: (p: string) => string = (p) => readFileSync(p, "utf8"),
): LedgerRead {
  let raw: string;
  try {
    raw = read(path);
  } catch (e) {
    return { kind: "absent", why: `cannot be read (${e instanceof Error ? e.message : String(e)})` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { kind: "absent", why: `is not valid JSON (${e instanceof Error ? e.message : String(e)})` };
  }
  const runId = (parsed as { report?: { latestRunId?: unknown } } | null)?.report?.latestRunId;
  if (typeof runId !== "number" || !Number.isFinite(runId)) {
    return { kind: "absent", why: "carries no numeric report.latestRunId" };
  }
  return { kind: "watermark", runId };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const repo = flagValue(argv, "--repo", process.env["GITHUB_REPOSITORY"] ?? "");
  const out = flagValue(argv, "--out", "");
  const offline = argv.includes("--offline");
  const recordsPath = flagValue(argv, "--records", "");
  const ledgerPath = flagValue(argv, "--ledger", "data/platform-drift.json");
  const windowRuns = Number.parseInt(flagValue(argv, "--window", String(DEFAULT_THRESHOLDS.windowRuns)), 10);
  const thisRunId = Number.parseInt(flagValue(argv, "--run-id", "0"), 10);
  const thresholds: Thresholds = { ...DEFAULT_THRESHOLDS, windowRuns };

  let records: RunRecord[] = [];
  if (recordsPath.length > 0) {
    records = JSON.parse(readFileSync(recordsPath, "utf8")) as RunRecord[];
  } else if (!offline) {
    const token = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";
    if (token.length === 0 || repo.length === 0) {
      // EXIT 2, NOT 0. This used to return 0 -- green, silently, having folded nothing.
      // A reporter that cannot prove it is looking must not report green, and that
      // sentence is enforced two lines below by assertDetectorLive on every OTHER path;
      // this one skipped past it entirely. 2 rather than 1 because this is a
      // CONFIGURATION error (a missing input) and not a drift finding: a reader must not
      // read it as "the detector looked and found something".
      const missing = [
        token.length === 0 ? "GH_TOKEN/GITHUB_TOKEN" : null,
        repo.length === 0 ? "--repo (or GITHUB_REPOSITORY)" : null,
      ].filter((x): x is string => x !== null);
      console.error(
        `[drift-loud] CANNOT LOOK: missing ${missing.join(" and ")}, and no --records was given. ` +
          "Nothing was folded, the canary was never consulted, and the publication watermark was " +
          "never compared -- so there is no green to report. Supply the credential, or pass " +
          "--records/--offline to fold a captured window.",
      );
      console.log("::error title=drift reporter cannot look::" + `missing ${missing.join(" and ")}; no window was folded`);
      return 2;
    }
    // The window: recent completed `gate` runs on main, plus THIS run when given, so a
    // PR sees its own canary and its own absorbed failures rather than only main's.
    const listed = await ghJson<{ readonly workflow_runs?: readonly ApiRun[] }>(
      `https://api.github.com/repos/${repo}/actions/workflows/gate.yml/runs` +
        `?branch=main&status=completed&per_page=${Math.min(windowRuns, 100)}`,
      token,
    );
    for (const r of listed.workflow_runs ?? []) records.push(await fetchRun(repo, r, token));
    if (thisRunId > 0) {
      // THIS run is refetched WITH annotations even if the listing already carried it,
      // because the annotation channel is the only thing that can exercise the canary
      // and the listing's copy was fetched without it.
      records = records.filter((r) => r.id !== thisRunId);
      const self = await ghJson<ApiRun>(`https://api.github.com/repos/${repo}/actions/runs/${thisRunId}`, token);
      records.push(await fetchRun(repo, self, token, true));
    }
  }

  const report = foldAbsorption(records, thresholds);
  const currentRun = thisRunId > 0 ? (records.find((r) => r.id === thisRunId) ?? null) : null;
  const liveness = assertDetectorLive(currentRun);
  const ledger = readPublishedWatermark(ledgerPath);
  const stale =
    ledger.kind === "absent"
      ? `LEDGER NOT READABLE: \`${ledgerPath}\` ${ledger.why}. This check compares the published ` +
        "watermark against the folded window; with no watermark it has not run, and a check that did " +
        "not run must not read as one that passed. If the file is genuinely new, publish it once; if " +
        "this job stopped checking it out, restore it to the sparse-checkout list."
      : publicationIsStale(ledger.runId, oldestRunId(records, thresholds.windowRuns))
        ? `PUBLICATION NOT LANDING: \`${ledgerPath}\` is pinned at run ${ledger.runId}, older than every one of the ` +
          `${report.runs} runs in this window (newest ${report.latestRunId}). The tick computes and then throws ` +
          "the result away -- the dashboard is showing stale numbers from behind a green check."
        : null;

  const markdown = renderMarkdown(report, liveness, stale);
  console.log(markdown);

  // LOUD: annotations first, so they are the first thing the run page shows.
  for (const line of annotationLines(report)) console.log(line);
  if (stale !== null) console.log(`::error title=drift publication not landing::${stale}`);
  if (!liveness.live) console.log(`::error title=drift detector went quiet::${liveness.reason}`);

  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath !== undefined && summaryPath.length > 0) appendFileSync(summaryPath, `${markdown}\n`);

  if (out.length > 0) {
    writeFileSync(
      out,
      `${JSON.stringify({ asOf: orderNewestFirst(records)[0]?.at ?? null, liveness, stalePublication: stale, report }, null, 2)}\n`,
    );
  }

  // Instruments are excluded here for the same reason they are excluded from
  // annotations: the canary fails on purpose, and counting THIS JOB's own past failures
  // would make it red on every run for no reason other than that it was red before --
  // a latch, not a measurement. The canary's only role is `assertDetectorLive` above.
  const sustained = report.subjects.filter((s) => !isInstrument(s) && s.band === "SUSTAINED");
  const red = sustained.length > 0 || !liveness.live || stale !== null;
  if (red) {
    console.log(
      "\nEXIT 1 -- a drift signal is at its loudest band. This job is NOT in the `gate (required)` floor: " +
        "the merge is unaffected. Red here means read it, not stop.",
    );
    return 1;
  }
  console.log("\nEXIT 0 -- no sustained drift, detector live, publication landing.");
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
