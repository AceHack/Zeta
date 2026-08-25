#!/usr/bin/env bun
// verdict-drought.ts -- how long has `main` gone with NO COMPLETED GATE VERDICT?
//
// ---------------------------------------------------------------------------
// THE CONDITION, AND WHY NOTHING SAW IT
// ---------------------------------------------------------------------------
//
// `gate.yml` uses a per-ref concurrency group with `cancel-in-progress`, and a merge to
// `main` cancels the run still in flight for the previous merge. That is a correct and
// deliberate setting. What it produces, when merges arrive faster than the gate can
// finish, is a `main` whose recent commits carry NO VERDICT AT ALL -- not a pass, not a
// fail, just `cancelled`.
//
// Measured on `Lucent-Financial-Group/Zeta`, 2026-08-23T17:35Z:
//
//     last SUCCESS on main:  10fbd9a4  16:29:06Z -> 16:43:22Z   (~52 min earlier)
//     last VERDICT on main:  7dbd2b11  17:11:52Z -> 17:25:00Z   (`failure`, ~10 min)
//     last 8 gate runs:      6 cancelled, 2 running, 0 success
//     gate duration:         ~14 min when allowed to finish
//     merge interval:        17:30:13, 17:30:29, 17:30:37   <- three merges in 24 s
//
// Merges outran the gate by roughly an order of magnitude. Note the two numbers above
// are DIFFERENT facts and this file reports both: the *verdict* drought is what says
// whether `main` is being checked at all, and the *success* drought is what says whether
// it is green. Only the first is the vacuity class.
//
// THE DEFECT IS THAT `cancelled` READS AS NEITHER PASS NOR FAIL. Every surface in this
// repo that folds gate outcomes -- `platform-drift-report.ts`, `gate-scope-summary.ts`,
// `drift-loud.ts` -- reasons about runs that EXECUTED. A window of nothing but
// `cancelled` produces no findings in any of them, and no findings renders as green.
// `drift-loud.ts` has this exact hole today: hand it 60 cancelled runs and `subjects` is
// empty, `sustained` is empty, and it prints "EXIT 0 -- no sustained drift". It is not
// wrong about drift; it is silent about the fact that nothing was measured.
//
// A CHECK THAT DID NOT RUN MUST NEVER LOOK LIKE A CHECK THAT PASSED. That is the whole
// of this file.
//
// ---------------------------------------------------------------------------
// THE ERROR THIS FILE IS THE CORRECTION OF (owned, 2026-08-23)
// ---------------------------------------------------------------------------
//
// Earlier the same day I looked at this cancellation pattern, reasoned that a later
// successful run covers the earlier commits, and called it benign. The reasoning has a
// premise -- that there eventually IS a later success -- and the premise is exactly what
// the condition removes. At 50 minutes with ~20 commits landed and no success, the
// conclusion had already failed. I found it by counting conclusions by hand, and a
// detector that has to be asked is not a detector.
//
// ---------------------------------------------------------------------------
// THE REGISTER DISCIPLINE: `unknown` IS FIRST CLASS AND NEVER AGGREGATES TO GREEN
// ---------------------------------------------------------------------------
//
// Aaron: "UNKNOWN is a first-class verdict that can never aggregate into green."
// So the fold has THREE outcomes, not two:
//
//   `ok`       -- a completed verdict (`success` OR `failure`) landed on `main` within
//                 the threshold, and few enough commits have landed since it.
//   `drought`  -- a verdict exists but is too old, or too many commits have landed on
//                 top of it. The blast radius is named, loudly.
//   `unknown`  -- there is NO completed verdict anywhere in the observed window, or the
//                 window itself could not be observed. The drought cannot even be
//                 measured, which is strictly worse than a long one. This never reports
//                 as `ok` and it is deliberately the loudest register.
//
// `cancelled`, `skipped`, `timed_out`, `stale`, `neutral`, `action_required` and an
// in-flight run are ALL non-verdicts. The enumeration is a strict allow-list of two
// (`isVerdict`) rather than a deny-list, because the failure that matters is a
// non-verdict being counted as one -- that direction turns a drought green, and a
// deny-list gets that wrong every time GitHub adds a conclusion string.
//
// A `failure` IS A VERDICT. The check is about verdict PRESENCE, not verdict COLOUR.
// Reading it the other way round would make a red `main` -- which is being checked,
// loudly, and is therefore in a *known* state -- look like an unchecked one.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES *NOT* DO -- SCOPE, DELIBERATELY
// ---------------------------------------------------------------------------
//
// It does not change the concurrency group, add a merge queue, or touch any flush
// cadence. Those are the three policy options on the table and choosing between them is
// a human call. This file exists so that whichever is chosen can be VERIFIED afterwards
// -- the same number, measured the same way, before and after. It presumes no answer.
//
// ---------------------------------------------------------------------------
// LOUD, NEVER BLOCKING
// ---------------------------------------------------------------------------
//
// `::error::` annotations plus `$GITHUB_STEP_SUMMARY`. No `gate (required)` dependency
// is added, no `needs:` list is touched, no required check learns about this. It rides
// in two EXISTING surfaces rather than becoming a fourth parallel mechanism:
//
//   1. the `drift (loud)` job in `gate.yml` (#14283) -- already built to go red beside a
//      green required check;
//   2. the `drift-sweep` job -- which is where it actually catches the condition, because
//      `drift-sweep` has its own concurrency group with `cancel-in-progress: false` and
//      therefore SURVIVES the merge storm that cancels every gate run. Measured during
//      the storm above: `drift-sweep` concluded `success` at 17:30:37 -> 17:34:32 while
//      four consecutive gate runs were being cancelled.
//
// That second host is not redundancy for its own sake. A drought detector that lives
// only inside `gate` is cancelled by exactly the condition it exists to report -- it
// would be silent precisely when it matters, which is the defect wearing a detector's
// clothes.
//
// IT PUBLISHES NOTHING. No commit, no push, no artifact on `main`. `drift-sweep.yml`'s
// push to `main` has been rejected by the "CI Gate" ruleset since 2026-08-13 while the
// workflow reported green, and `drift-dashboard-cadence.yml:98` has the same
// `git push origin HEAD:main || echo "::warning::"` shape. Loud therefore lives in the
// RUN, where nothing has to land for it to be seen. If this ever needs to persist, the
// route is to park on `heartbeat/*` and flush via PR (`agent-heartbeat.yml`), never a
// direct push.
//
// ---------------------------------------------------------------------------
// ITS OWN LIVENESS -- HOW THIS DETECTOR FAILS, STATED PLAINLY
// ---------------------------------------------------------------------------
//
// The repo has now rediscovered three times that a detector can stop working and keep
// reporting green. So here is exactly how this one fails, and what it does about it:
//
//   * **The window comes back empty** (token denied, wrong workflow id, API change).
//     -> register `unknown`, `::error::`, non-zero exit. Never `ok`. `assertDroughtDetectorLive`
//     makes this a named verdict rather than a lucky consequence of an empty loop.
//   * **The commit-count channel fails** (the compare base was force-pushed away).
//     -> `unverifiedCommits` is `null`, said out loud in the reasons, and NEVER silently
//     rendered as `0`. A missing count is not a small count.
//   * **Commits land on `main` and no gate run appears at all.** -> `runsSinceVerdict`
//     stays 0 while `unverifiedCommits` climbs; `triggerLooksBroken` names it, because
//     that signature is a broken TRIGGER, not a slow gate.
//   * **The step never executes**, because the job hosting it was cancelled. This is the
//     one failure mode the file cannot self-report, and it is why it runs in two hosts
//     with different concurrency groups. If BOTH go quiet the condition is invisible
//     again -- that limit is real and is not papered over here.
//
// ---------------------------------------------------------------------------
// DISCIPLINES
// ---------------------------------------------------------------------------
//
// Noninterference (§13): the fold takes `nowIso` as an INJECTED argument and reads no
// ambient clock, so tests are hermetic and the fold is DST-replayable from fixtures.
// Idempotency (§6): same observations + same `now` => byte-identical report. Culture:
// every comparison is ordinal, every number formatted with an explicit fixed radix.
//
// Usage (CI):
//   GH_TOKEN=... bun src/Core.TypeScript/ci/verdict-drought.ts --repo owner/name
// Usage (offline, hermetic):
//   bun src/Core.TypeScript/ci/verdict-drought.ts --observations fixture.json --now <iso>

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * A completed gate run's conclusion counts as a VERDICT only when it is one of these.
 *
 * Strict allow-list, on purpose -- see the header. `cancelled`, `skipped`, `timed_out`,
 * `stale`, `neutral`, `action_required` and any future string GitHub invents are all
 * non-verdicts, and a run still in flight is a non-verdict too.
 */
export const VERDICT_CONCLUSIONS: ReadonlySet<string> = new Set(["success", "failure"]);

/** Sentinel used for a run that has not reached a conclusion. Never a verdict. */
export const RUNNING = "RUNNING";

/** True only for `success` and `failure`. Nothing else is a verdict. Ordinal compare. */
export function isVerdict(conclusion: string): boolean {
  return VERDICT_CONCLUSIONS.has(conclusion);
}

// ---------------------------------------------------------------------------
// The API -> model boundary. EVERY network-derived string is constrained HERE.
// ---------------------------------------------------------------------------
//
// CodeQL `js/http-to-file-access` ("Network data written to file") flagged the two
// writes at the bottom of this file, and it was RIGHT -- not about the path, which is a
// constant in both cases (`$GITHUB_STEP_SUMMARY` from the runner, `--out` from argv), but
// about the CONTENT. Fields from the Actions API reached two STRUCTURED formats by string
// concatenation:
//
//   * the `$GITHUB_STEP_SUMMARY` markdown TABLE -- a `|` splits a cell, a newline ends the
//     row and the table, and everything after it renders as fresh document structure;
//   * the `::error title=...::message` WORKFLOW COMMAND -- a newline there forges a second
//     command in the runner's log stream, which is the well-known Actions command-injection
//     surface.
//
// It is tempting to call this a false positive because the fields are, in fact,
// well-formed today: the listing is filtered to `?branch=main&event=push`, so `head_sha`
// is a git-computed sha and `conclusion` is a GitHub enum. But that argument is a claim
// about the SERVER, checked nowhere, restated every time the query changes -- and this
// file exists because "a check that did not run must not look like one that passed".
// A response body is untrusted input; the honest answer is to make the injection
// impossible to EXPRESS rather than to argue it will not occur.
//
// So each value is matched against an anchored shape and, on failure, REPLACED by a fixed
// self-describing constant. Not sanitised, not escaped, not repaired -- replaced. No
// value that reaches the renderer can carry a `|`, a newline, a backtick or a `::`,
// because no value that reaches the renderer came from the network unchecked.
//
// TWO PROPERTIES THIS MUST NOT BREAK, and both are tested:
//   1. Replacement is LOUD, never silent normalisation into something that looks fine.
//      The sentinels are visibly not shas, not instants, not conclusions.
//   2. An unrecognised conclusion is NEVER a verdict. `isVerdict` is an allow-list of
//      exactly two strings, so an unknown value cannot become one by being replaced --
//      which is the direction that would turn a drought green.
//
// "EVERY value" above was a claim, and it was FALSE when first written: `compare.ahead_by`
// came from a second call and reached the fold, the table and the `--out` artifact behind
// nothing but `typeof x === "number"` -- which admits `NaN`. CodeQL kept reporting the
// alert through exactly that field while three commits hardened the fields around it, so
// the alert was not stale and was not noise; it was pointing at the one door still open.
// `constrainCount` closes it, and it is the only value here whose sentinel is `null`
// rather than a string, because the report already has a NOT-MEASURED register for counts.
//
// EVERY function here now RE-EMITS the value it accepts rather than passing the argument
// through -- instants from parsed epoch ms, conclusions from `KNOWN_CONCLUSIONS`, shas
// from `HEX_DIGITS`, numbers through `Math.trunc`. CodeQL kept the alert alive through
// `constrainId` and would have moved to `constrainSha` next, and it was right both times
// in the narrow sense that matters here: those two were checking the value and then
// handing on the ARGUMENT, which is a weaker statement than the block claims to make.

/** A run id that was not a safe integer. Never a real id, and never matches a run. */
export const UNRECOGNISED_ID = -1;

/** A `head_sha` that did not match `^[0-9a-f]{7,64}$`. */
export const UNRECOGNISED_SHA = "(unrecognised-sha)";

/** A timestamp that did not match a strict ISO-8601 UTC instant. Never parses. */
export const UNRECOGNISED_INSTANT = "(unrecognised-instant)";

/** A conclusion outside GitHub's documented set. NOT a verdict -- see `isVerdict`. */
export const UNRECOGNISED_CONCLUSION = "unrecognised";

/** Lowercase hex, 7..64 -- covers both sha1 (40) and a future sha256 (64). Ordinal. */
const SHA_RE = /^[0-9a-f]{7,64}$/;

/** Strict ISO-8601 UTC. No offsets, no whitespace, nothing a table or log can read. */
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

/**
 * GitHub's documented run conclusions, plus our in-flight sentinel.
 *
 * DELIBERATELY WIDER than `VERDICT_CONCLUSIONS`. This set says "a string GitHub is known
 * to produce"; that one says "a string that settles whether main was checked". Collapsing
 * the two would be the exact mistake this file is about.
 */
const KNOWN_CONCLUSIONS: ReadonlySet<string> = new Set([
  "success",
  "failure",
  "cancelled",
  "skipped",
  "timed_out",
  "stale",
  "neutral",
  "action_required",
  "startup_failure",
  RUNNING,
]);

/** The sixteen characters `SHA_RE` admits, and the only ones a constrained sha carries. */
const HEX_DIGITS = "0123456789abcdef";

/**
 * The sha, RE-EMITTED from `HEX_DIGITS`, else the sentinel.
 *
 * Same construction as `constrainConclusion`: the returned characters are OURS, matched
 * against the argument rather than taken from it, so no byte of the response body survives
 * into the report. `SHA_RE` has already proved every character is in the alphabet, so this
 * is a COPY, never a repair -- the result equals the argument, and the boundary's own
 * falsifier asserts that equality on a well-formed payload.
 *
 * The regex alone was enough to make injection unexpressible (a `|`, a newline and a `::`
 * are all outside `[0-9a-f]`). What the re-emission adds is that the block's claim -- "no
 * value that reaches the renderer came from the network unchecked" -- is now literally
 * true byte for byte, for every field, instead of true for four of the six and argued for
 * the other two.
 */
export function constrainSha(value: unknown): string {
  if (typeof value !== "string" || !SHA_RE.test(value)) return UNRECOGNISED_SHA;
  let out = "";
  for (const ch of value) for (const digit of HEX_DIGITS) if (digit === ch) out += digit;
  return out;
}

/**
 * The instant, CANONICALISED, else the sentinel.
 *
 * Validated for shape and then RE-EMITTED from its parsed epoch milliseconds, rather than
 * passed through. Two reasons, and the first is the one that matters day to day: every
 * instant in the report then has one format, so `…:52Z` and `…:52.000Z` stop rendering as
 * two different values in a table that gets compared across runs. The second is that the
 * returned string is built by the runtime from a number, so no byte of the response body
 * survives into it.
 */
export function constrainInstant(value: unknown): string {
  if (typeof value !== "string" || !INSTANT_RE.test(value)) return UNRECOGNISED_INSTANT;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return UNRECOGNISED_INSTANT;
  return new Date(ms).toISOString();
}

/**
 * The conclusion, as OUR OWN literal, else the sentinel. Never a verdict when unknown.
 *
 * Returns the element from `KNOWN_CONCLUSIONS` rather than the argument that matched it.
 * The two are equal strings; the difference is that the result is guaranteed by
 * CONSTRUCTION to be one of our constants instead of merely happening to equal one.
 */
export function constrainConclusion(value: unknown): string {
  if (typeof value !== "string") return UNRECOGNISED_CONCLUSION;
  for (const known of KNOWN_CONCLUSIONS) if (known === value) return known;
  return UNRECOGNISED_CONCLUSION;
}

/**
 * The id if it is a safe integer, else the sentinel. Keeps ordering total.
 *
 * Re-emitted with `Math.trunc`, which on an already-safe integer is a copy -- the same
 * move as `constrainCount` below and for the same reason: the number handed on is computed
 * here. The id reaches the summary table through `lastVerdict.id`, so it is a network value
 * on its way to a file like any other.
 */
export function constrainId(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? Math.trunc(value) : UNRECOGNISED_ID;
}

/**
 * A COUNT from the API -- `compare.ahead_by` -- as a whole non-negative number, else `null`.
 *
 * `null` is not a fallback here, it is the report's existing NOT-MEASURED register: the
 * fold already says that one out loud and refuses to render it as 0. So a count that is
 * not a count degrades into the single state the report is honest about.
 *
 * THE DIRECTION IS THE POINT, and it is why `typeof x === "number"` was never enough.
 * `typeof NaN === "number"`, and every comparison the fold makes against the count is `>=`
 * or `>` -- both `false` for `NaN`. An unchecked `ahead_by` of `NaN`, `Infinity` or `-1`
 * therefore reports itself as MEASURED, renders as `NaN` in the table, and then quietly
 * declines to fire: a commit count that failed, looking exactly like one that found
 * nothing wrong. That is this file's own subject, committed inside the detector for it.
 *
 * Re-emitted with `Math.trunc` for the same reason `constrainInstant` re-emits from parsed
 * epoch ms: the returned number is computed here, so no part of the response body survives
 * into the report. `Number.isSafeInteger` has already run, so the trunc is a COPY, never a
 * repair -- the result equals the argument, and the falsifier asserts that equality.
 */
export function constrainCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  return Math.trunc(value);
}

/**
 * Short sha for display, which must not slice a sentinel into nonsense.
 *
 * `"(unrecognised-sha)".slice(0, 8)` is `"(unrecog"`, which reads like a truncated real
 * value -- the opposite of the loudness the replacement exists for.
 */
export function shortSha(sha: string): string {
  return sha === UNRECOGNISED_SHA ? sha : sha.slice(0, 8);
}

/**
 * API run -> observation. THE ONLY door network data walks through.
 *
 * A run that has not completed is `RUNNING`, never a verdict.
 */

/** One gate run on `main`, reduced to what the drought fold needs. */
export interface GateRunObservation {
  readonly id: number;
  readonly sha: string;
  /** `success` | `failure` | `cancelled` | `skipped` | ... | `RUNNING`. */
  readonly conclusion: string;
  /** ISO 8601. `created_at`. */
  readonly startedAt: string;
  /** ISO 8601. `updated_at` -- when the run reached its conclusion. */
  readonly endedAt: string;
}

/** The register. `unknown` is first class and never aggregates into green. */
export type VerdictRegister = "ok" | "drought" | "unknown";

export interface DroughtThresholds {
  /**
   * Minutes since the last completed verdict at or beyond which the register is
   * `drought`.
   *
   * DERIVED, not invented: a full gate takes ~14 min when allowed to finish (measured
   * 2026-08-23 over the completed runs in the window; the fold recomputes the median
   * every run and prints it beside this threshold so the derivation stays checkable).
   * Three gate-lengths is the slack that distinguishes "the lane is busy" from "the lane
   * is not producing verdicts". A shorter threshold would fire on any two back-to-back
   * merges, which is the cry-wolf failure `drift-loud.ts` was banded to avoid.
   */
  readonly droughtMinutes: number;
  /**
   * Commits landed on `main` since the last verdict at or beyond which the register is
   * `drought`, independently of elapsed time. "50 minutes quiet" and "50 minutes and 20
   * unverified commits" are very different facts and only the second has a blast radius.
   */
  readonly maxUnverifiedCommits: number;
  /** Cancellation rate over the window at or above which the rate itself is called out. */
  readonly cancelRateWarn: number;
  /** Hard bound on how many runs the fold may look at. */
  readonly windowRuns: number;
}

export const DEFAULT_DROUGHT_THRESHOLDS: DroughtThresholds = {
  droughtMinutes: 45,
  maxUnverifiedCommits: 10,
  cancelRateWarn: 0.5,
  windowRuns: 60,
};

export interface VerdictRef {
  readonly runId: number;
  readonly sha: string;
  readonly conclusion: string;
  readonly endedAt: string;
}

export interface DroughtReport {
  readonly register: VerdictRegister;
  /** Every reason the register is what it is. Never empty. */
  readonly reasons: readonly string[];
  /** Newest run whose conclusion was `success` or `failure`. `null` => `unknown`. */
  readonly lastVerdict: VerdictRef | null;
  /** Newest `success`. Reported separately: a DIFFERENT fact from `lastVerdict`. */
  readonly lastSuccess: VerdictRef | null;
  /** Minutes from `lastVerdict.endedAt` to `now`. `null` when there is no verdict. */
  readonly minutesSinceVerdict: number | null;
  /** Minutes from `lastSuccess.endedAt` to `now`. `null` when there is no success. */
  readonly minutesSinceSuccess: number | null;
  /**
   * Commits landed on `main` since `lastVerdict.sha`. `null` means NOT MEASURED --
   * a different claim from `0`, and never collapsed into it.
   */
  readonly unverifiedCommits: number | null;
  /** Gate runs newer than the last verdict. 0 alongside commits => broken trigger. */
  readonly runsSinceVerdict: number;
  /** Commits landed but no run fired at all -- a trigger problem, not a slow gate. */
  readonly triggerLooksBroken: boolean;
  readonly windowRuns: number;
  readonly verdictRuns: number;
  readonly cancelledRuns: number;
  readonly runningRuns: number;
  readonly otherRuns: number;
  /** cancelled / observed. 0 when nothing was observed (and then the register is `unknown`). */
  readonly cancelRate: number;
  /** Median wall-minutes of the verdict-bearing runs in the window. The threshold's basis. */
  readonly medianVerdictMinutes: number | null;
  /** The injected clock, carried so the report states what it was measured against. */
  readonly nowIso: string;
  readonly thresholds: DroughtThresholds;
}

// ---------------------------------------------------------------------------
// Pure fold -- no clock, no network, nothing below this reads the environment
// ---------------------------------------------------------------------------

/** Newest-first by run id. Stable, total, clock-free -- same ordering as `drift-loud`. */
export function orderNewestFirst(obs: readonly GateRunObservation[]): readonly GateRunObservation[] {
  return [...obs].sort((a, b) => b.id - a.id);
}

/** Whole minutes between two ISO instants, or `null` when either does not parse. */
export function minutesBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 60_000);
}

/** Median of a numeric sample, or `null` when empty. Lower-middle on even counts. */
export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? null;
}

/**
 * The fold.
 *
 * `unverifiedCommits` is supplied by the caller (the edge measures it with one
 * `compare` call) and `null` means it could not be measured. `nowIso` is injected --
 * §13 noninterference -- so this is a pure function and replays deterministically.
 */
export function foldDrought(
  observations: readonly GateRunObservation[],
  unverifiedCommits: number | null,
  nowIso: string,
  thresholds: DroughtThresholds = DEFAULT_DROUGHT_THRESHOLDS,
): DroughtReport {
  const window = orderNewestFirst(observations).slice(0, thresholds.windowRuns);

  const verdicts = window.filter((r) => isVerdict(r.conclusion));
  const cancelledRuns = window.filter((r) => r.conclusion === "cancelled").length;
  const runningRuns = window.filter((r) => r.conclusion === RUNNING).length;
  const otherRuns = window.length - verdicts.length - cancelledRuns - runningRuns;

  const lastVerdict = verdicts[0] ?? null;
  const lastSuccess = verdicts.find((r) => r.conclusion === "success") ?? null;

  const ref = (r: GateRunObservation): VerdictRef => ({
    runId: r.id,
    sha: r.sha,
    conclusion: r.conclusion,
    endedAt: r.endedAt,
  });

  const minutesSinceVerdict = lastVerdict === null ? null : minutesBetween(lastVerdict.endedAt, nowIso);
  const minutesSinceSuccess = lastSuccess === null ? null : minutesBetween(lastSuccess.endedAt, nowIso);
  const runsSinceVerdict = lastVerdict === null ? window.length : window.filter((r) => r.id > lastVerdict.id).length;

  const durations = verdicts
    .map((r) => minutesBetween(r.startedAt, r.endedAt))
    .filter((m): m is number => m !== null);

  const cancelRate = window.length === 0 ? 0 : cancelledRuns / window.length;

  // A trigger problem, not a slow gate: commits landed and NO run fired for any of them.
  const triggerLooksBroken = unverifiedCommits !== null && unverifiedCommits > 0 && runsSinceVerdict === 0;

  const reasons: string[] = [];
  let register: VerdictRegister;

  if (window.length === 0) {
    register = "unknown";
    reasons.push(
      "NO GATE RUNS OBSERVED on main at all. The window is empty, so the drought cannot even be measured. " +
        "That is strictly worse than a long drought and it is NOT ok: either the listing failed, the token " +
        "lacks `actions: read`, or the workflow stopped firing. Unmeasured is not green.",
    );
  } else if (lastVerdict === null) {
    register = "unknown";
    reasons.push(
      `NO COMPLETED VERDICT in the last ${window.length} gate run(s) on main ` +
        `(${cancelledRuns} cancelled, ${runningRuns} still running, ${otherRuns} other). ` +
        "`cancelled` is neither a pass nor a fail, so NOTHING in this window says whether main is checked. " +
        "A check that did not run must never look like a check that passed.",
    );
  } else if (minutesSinceVerdict === null) {
    // A VERDICT EXISTS AND ITS AGE CANNOT BE COMPUTED. Reachable since the boundary
    // constraint above replaces an unparseable `updated_at` with a sentinel, and equally
    // if `--now` is garbage. The old code fell through to `overTime = false` and returned
    // `ok` -- an unmeasurable drought reading as a healthy one, which is this file's own
    // defect committed inside the detector for it. `unknown`, loudly.
    register = "unknown";
    reasons.push(
      `A VERDICT EXISTS BUT ITS AGE CANNOT BE MEASURED: run ${String(lastVerdict.id)} ended ` +
        `\`${lastVerdict.endedAt}\` and now is \`${nowIso}\` -- at least one is not a parseable ` +
        "instant. An unmeasurable drought is not a short one, so this is `unknown`, never `ok`.",
    );
  } else {
    const overTime = minutesSinceVerdict >= thresholds.droughtMinutes;
    const overCommits = unverifiedCommits !== null && unverifiedCommits >= thresholds.maxUnverifiedCommits;
    if (overTime) {
      reasons.push(
        `LAST COMPLETED VERDICT on main was ${String(minutesSinceVerdict)} min ago ` +
          `(run ${String(lastVerdict.id)}, ${shortSha(lastVerdict.sha)}, \`${lastVerdict.conclusion}\`, ` +
          `ended ${lastVerdict.endedAt}) -- at or past the ${String(thresholds.droughtMinutes)} min threshold.`,
      );
    }
    if (overCommits) {
      reasons.push(
        `${String(unverifiedCommits)} commit(s) have landed on main since that verdict -- at or past the ` +
          `${String(thresholds.maxUnverifiedCommits)} commit threshold. That is the blast radius: ` +
          "those commits carry no pass and no fail.",
      );
    }
    register = overTime || overCommits ? "drought" : "ok";
  }

  if (unverifiedCommits === null) {
    reasons.push(
      "COMMIT COUNT NOT MEASURED (the compare call failed or there was no verdict sha to compare from). " +
        "Reported as `null`, never as 0 -- a missing count is not a small count.",
    );
  }
  if (triggerLooksBroken) {
    reasons.push(
      `TRIGGER MAY BE BROKEN: ${String(unverifiedCommits)} commit(s) landed on main since the last verdict and ` +
        "ZERO gate runs fired for any of them. That signature is a workflow that stopped triggering, not a gate " +
        "that is running slowly.",
    );
  }
  if (cancelRate >= thresholds.cancelRateWarn && window.length > 0) {
    reasons.push(
      `CANCELLATION RATE ${(cancelRate * 100).toFixed(1)}% (${String(cancelledRuns)}/${String(window.length)} runs) ` +
        `is at or above the ${(thresholds.cancelRateWarn * 100).toFixed(1)}% mark. Merges are outrunning the gate.`,
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      `main has a completed verdict from ${String(minutesSinceVerdict)} min ago ` +
        `(run ${String(lastVerdict?.id ?? 0)}, \`${lastVerdict?.conclusion ?? "?"}\`)` +
        `${unverifiedCommits === null ? "" : ` with ${String(unverifiedCommits)} commit(s) on top of it`}.`,
    );
  }

  return {
    register,
    reasons,
    lastVerdict: lastVerdict === null ? null : ref(lastVerdict),
    lastSuccess: lastSuccess === null ? null : ref(lastSuccess),
    minutesSinceVerdict,
    minutesSinceSuccess,
    unverifiedCommits,
    runsSinceVerdict,
    triggerLooksBroken,
    windowRuns: window.length,
    verdictRuns: verdicts.length,
    cancelledRuns,
    runningRuns,
    otherRuns,
    cancelRate,
    medianVerdictMinutes: median(durations),
    nowIso,
    thresholds,
  };
}

// ---------------------------------------------------------------------------
// The detector's own liveness -- it must be loud about its OWN silence
// ---------------------------------------------------------------------------

export interface DroughtLiveness {
  readonly live: boolean;
  readonly reason: string;
}

/**
 * Can this detector prove it looked?
 *
 * An empty window and a healthy `main` produce the same *shape* of output -- no
 * findings -- and that equivalence is the entire class this repo keeps rediscovering.
 * So "I observed N runs" is asserted as a verdict rather than left implicit. `live` is
 * false when the detector cannot demonstrate it saw anything, and a not-live detector
 * never reports `ok`.
 */
export function assertDroughtDetectorLive(report: DroughtReport): DroughtLiveness {
  if (report.windowRuns === 0) {
    return {
      live: false,
      reason:
        "DROUGHT DETECTOR WENT QUIET: zero gate runs were observed on main, so this pass exercised nothing. " +
        "An empty window and a healthy main render identically -- that is the defect class, not a corner case. " +
        "Unverified is not the same as working, and this reporter does not report green on it.",
    };
  }
  if (report.register === "unknown") {
    return {
      live: true,
      reason:
        `drought detector live: ${String(report.windowRuns)} gate run(s) observed on main, and the register is ` +
        "`unknown` because none of them carried a verdict. The detector worked; the LANE is the thing that is silent.",
    };
  }
  return {
    live: true,
    reason:
      `drought detector live: ${String(report.windowRuns)} gate run(s) observed on main, ` +
      `${String(report.verdictRuns)} of them carrying a completed verdict.`,
  };
}

// ---------------------------------------------------------------------------
// Render -- still pure, returns strings
// ---------------------------------------------------------------------------

const REGISTER_LABEL: Readonly<Record<VerdictRegister, string>> = {
  ok: "OK -- main has a recent completed verdict",
  drought: "DROUGHT -- main's last completed verdict is stale",
  unknown: "UNKNOWN -- main has NO completed verdict in the window",
};

/**
 * The register's annotation severity.
 *
 * `unknown` is `error`, not `warning`, and that ordering is the rule rather than a
 * preference: a lane that produced no verdict at all is less known than one whose
 * verdict is merely old, and severity must not decrease as knowledge decreases.
 */
export function severityOfRegister(register: VerdictRegister): "error" | null {
  return register === "ok" ? null : "error";
}

/**
 * The annotation lines. Empty only when the register is `ok`, the cancellation rate is
 * below its mark, and the detector is live.
 *
 * TWO BANDS, and the second was missing until the first live CI run proved it.
 *
 * `drift (loud)` run 32657724476 (2026-08-23T18:35Z) reported register `ok` -- a `failure`
 * verdict 1 minute old, 4 commits on top -- with a **60% cancellation rate** and a
 * 112-minute success drought, and emitted NO ANNOTATION AT ALL. The rate was in the step
 * summary and nowhere else. That is the leading indicator of the very condition this file
 * exists for, sitting silent behind an `ok`.
 *
 * So the rate is annotated INDEPENDENTLY of the register, at `::warning::` rather than
 * `::error::`. The ordering is deliberate and is the same rule as `severityOfRegister`:
 * the register says whether main is CHECKED (error when it is not), the rate says the gate
 * is being OUTRUN (warning -- a forecast, not yet a fault). Merges outrunning the gate is
 * how the drought is produced, so it is worth saying before the drought arrives.
 *
 * It is emitted only when the register is `ok`, because every other register already
 * carries the rate inside its own reason list -- annotating it twice is how a real signal
 * gets tuned out.
 */
export function droughtAnnotations(report: DroughtReport, liveness: DroughtLiveness): readonly string[] {
  const out: string[] = [];
  const sev = severityOfRegister(report.register);
  if (sev !== null) {
    out.push(
      `::${sev} title=main gate-verdict ${report.register}::${report.reasons.join(" | ")} ` +
        "This is a DRIFT signal about the CI lane itself: it is loud on purpose and it blocks nothing.",
    );
  } else if (report.cancelRate >= report.thresholds.cancelRateWarn && report.windowRuns > 0) {
    out.push(
      `::warning title=gate cancellation rate::${(report.cancelRate * 100).toFixed(1)}% of the last ` +
        `${String(report.windowRuns)} gate runs on main were CANCELLED ` +
        `(${String(report.cancelledRuns)} of them), at or above the ` +
        `${(report.thresholds.cancelRateWarn * 100).toFixed(1)}% mark. main currently HAS a completed verdict, ` +
        "so this is not yet a drought -- it is the mechanism that produces one: merges are landing faster than " +
        "the gate can finish, and each new merge cancels the run in flight. Loud on purpose, blocks nothing.",
    );
  }
  if (!liveness.live) out.push(`::error title=verdict-drought detector went quiet::${liveness.reason}`);
  return out;
}

export function renderDroughtMarkdown(report: DroughtReport, liveness: DroughtLiveness): string {
  const r = report;
  const min = (v: number | null): string => (v === null ? "not measured" : `${String(v)} min`);
  const verdictCell =
    r.lastVerdict === null
      ? "**none in window**"
      : `run ${String(r.lastVerdict.runId)} \`${r.lastVerdict.conclusion}\` ${shortSha(r.lastVerdict.sha)} (${r.lastVerdict.endedAt})`;
  const successCell =
    r.lastSuccess === null
      ? "**none in window**"
      : `run ${String(r.lastSuccess.runId)} ${shortSha(r.lastSuccess.sha)} (${r.lastSuccess.endedAt})`;

  const out: string[] = [
    "## main gate-verdict drought -- loud, and blocking nothing",
    "",
    `**${REGISTER_LABEL[r.register]}**`,
    "",
    "| measurement | value |",
    "| --- | --- |",
    `| register | \`${r.register}\` |`,
    `| last COMPLETED verdict (success **or** failure) | ${verdictCell} |`,
    `| time since that verdict | ${min(r.minutesSinceVerdict)} (threshold ${String(r.thresholds.droughtMinutes)} min) |`,
    `| commits on main since that verdict | ${r.unverifiedCommits === null ? "**not measured**" : String(r.unverifiedCommits)} (threshold ${String(r.thresholds.maxUnverifiedCommits)}) |`,
    `| gate runs since that verdict | ${String(r.runsSinceVerdict)} |`,
    `| last SUCCESS (a different fact) | ${successCell} |`,
    `| time since last success | ${min(r.minutesSinceSuccess)} |`,
    `| window | ${String(r.windowRuns)} run(s), bounded at ${String(r.thresholds.windowRuns)} |`,
    `| of which verdicts | ${String(r.verdictRuns)} |`,
    `| of which cancelled | ${String(r.cancelledRuns)} (${(r.cancelRate * 100).toFixed(1)}%) |`,
    `| of which still running | ${String(r.runningRuns)} |`,
    `| of which other non-verdict | ${String(r.otherRuns)} |`,
    `| median gate duration when allowed to finish | ${min(r.medianVerdictMinutes)} |`,
    `| measured against | ${r.nowIso} |`,
    "",
    "**Why:**",
    "",
  ];
  for (const reason of r.reasons) out.push(`- ${reason}`);
  out.push(
    "",
    "`cancelled` and `skipped` are **not** verdicts and can never satisfy this check. `failure` **is** a " +
      "verdict -- this measures whether `main` is being checked, not whether it is green.",
    "",
    "**Nothing here blocks.** No `gate (required)` dependency was added and no required check reads this. " +
      "The concurrency group, the merge queue question, and the flush cadences are untouched on purpose: " +
      "this makes the condition visible so that whichever policy is chosen can be verified afterwards.",
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
  readonly head_sha: string;
  readonly status: string | null;
  readonly conclusion: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

async function ghJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${String(res.status)} for ${url}`);
  return (await res.json()) as T;
}

/**
 * API run -> observation. THE ONLY door network data walks through.
 *
 * Every field is constrained by the shape checks above (see "The API -> model boundary").
 * A run that has not completed is `RUNNING`, never a verdict.
 */
export function toObservation(run: ApiRun): GateRunObservation {
  return {
    id: constrainId(run.id),
    sha: constrainSha(run.head_sha),
    conclusion: run.status === "completed" ? constrainConclusion(run.conclusion) : RUNNING,
    startedAt: constrainInstant(run.created_at),
    endedAt: constrainInstant(run.updated_at),
  };
}

/**
 * Commits on `main` since `baseSha`, or `null` when it could not be measured.
 *
 * `null` on ANY failure (base gone after a force-push, network, rate limit, or a body
 * whose `ahead_by` is not a count). It is never coerced to 0 -- see the header. One call:
 * `compare` accepts a branch name as head.
 */
async function commitsSince(repo: string, baseSha: string, token: string): Promise<number | null> {
  try {
    const cmp = await ghJson<{ readonly ahead_by?: number }>(
      `https://api.github.com/repos/${repo}/compare/${baseSha}...main`,
      token,
    );
    return constrainCount(cmp.ahead_by);
  } catch {
    return null;
  }
}

function flagValue(argv: readonly string[], flag: string, fallback: string): string {
  const i = argv.indexOf(flag);
  return i >= 0 ? (argv[i + 1] ?? fallback) : fallback;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const repo = flagValue(argv, "--repo", process.env["GITHUB_REPOSITORY"] ?? "");
  const observationsPath = flagValue(argv, "--observations", "");
  const out = flagValue(argv, "--out", "");
  const windowRuns = Number.parseInt(flagValue(argv, "--window", String(DEFAULT_DROUGHT_THRESHOLDS.windowRuns)), 10);
  const droughtMinutes = Number.parseInt(
    flagValue(argv, "--drought-minutes", String(DEFAULT_DROUGHT_THRESHOLDS.droughtMinutes)),
    10,
  );
  const maxUnverifiedCommits = Number.parseInt(
    flagValue(argv, "--max-unverified-commits", String(DEFAULT_DROUGHT_THRESHOLDS.maxUnverifiedCommits)),
    10,
  );
  const thresholds: DroughtThresholds = {
    ...DEFAULT_DROUGHT_THRESHOLDS,
    windowRuns,
    droughtMinutes,
    maxUnverifiedCommits,
  };

  // The clock enters HERE and nowhere else -- one declared, metered channel (§13).
  const nowIso = flagValue(argv, "--now", new Date().toISOString());

  let observations: GateRunObservation[] = [];
  let unverified: number | null = null;

  if (observationsPath.length > 0) {
    observations = JSON.parse(readFileSync(observationsPath, "utf8")) as GateRunObservation[];
    const supplied = flagValue(argv, "--unverified-commits", "");
    unverified = supplied.length > 0 ? Number.parseInt(supplied, 10) : null;
  } else {
    const token = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";
    if (token.length === 0 || repo.length === 0) {
      // Loud, not silent: no token is a detector that did not look, and this file's whole
      // subject is that a check which did not run must not look like one that passed.
      console.log(
        "::error title=verdict-drought detector went quiet::No GH_TOKEN or no --repo, and no --observations " +
          "fixture. The drought was NOT measured. This is reported as a failure rather than skipped, because a " +
          "detector that silently does nothing is the exact defect it exists to catch.",
      );
      return 1;
    }
    // NO `status=completed` filter: an in-flight run must be counted as a non-verdict,
    // and filtering it out would hide the "2 running, 0 success" half of the picture.
    const listed = await ghJson<{ readonly workflow_runs?: readonly ApiRun[] }>(
      `https://api.github.com/repos/${repo}/actions/workflows/gate.yml/runs` +
        `?branch=main&event=push&per_page=${String(Math.min(windowRuns, 100))}`,
      token,
    );
    observations = (listed.workflow_runs ?? []).map(toObservation);
    const newestVerdict = orderNewestFirst(observations).find((r) => isVerdict(r.conclusion));
    unverified = newestVerdict === undefined ? null : await commitsSince(repo, newestVerdict.sha, token);
  }

  const report = foldDrought(observations, unverified, nowIso, thresholds);
  const liveness = assertDroughtDetectorLive(report);
  const markdown = renderDroughtMarkdown(report, liveness);
  console.log(markdown);
  for (const line of droughtAnnotations(report, liveness)) console.log(line);

  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath !== undefined && summaryPath.length > 0) appendFileSync(summaryPath, `${markdown}\n`);
  if (out.length > 0) writeFileSync(out, `${JSON.stringify({ report, liveness }, null, 2)}\n`);

  // `--report-only` prints and annotates but always exits 0. Used by the `drift-sweep`
  // host, whose run conclusion is folded by the drift-dashboard roster: failing it there
  // would cascade into a lane whose semantics are not this change's to alter. The
  // `drift (loud)` host takes the non-zero exit, where a red X beside a green required
  // check is the established, reviewed pattern (#14283).
  if (argv.includes("--report-only")) {
    console.log("\nEXIT 0 (--report-only) -- the annotations above are the signal; this host never goes red.");
    return 0;
  }
  if (report.register !== "ok" || !liveness.live) {
    console.log(
      `\nEXIT 1 -- register \`${report.register}\`. This job is NOT in the \`gate (required)\` floor: ` +
        "the merge is unaffected. Red here means read it, not stop.",
    );
    return 1;
  }
  console.log("\nEXIT 0 -- main has a recent completed verdict and the detector proved it looked.");
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
