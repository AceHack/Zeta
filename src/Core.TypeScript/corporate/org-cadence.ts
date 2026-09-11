/**
 * org-cadence.ts — the clock moves, and the organization has something to do next week.
 *
 * ── WHAT WAS MISSING ─────────────────────────────────────────────────────────
 * `driveUntilSettled` runs rounds until one changes nothing, with `nowMs` FIXED for the whole run.
 * Both halves of that are limits nobody stated:
 *
 *   1. **Settled is terminal.** The organization reaches a fixed point and the loop ends. There is
 *      no "and then it is Tuesday".
 *   2. **Time does not pass.** Every round is judged at the same instant, so nothing that depends
 *      on duration can ever fire — a silence SLA cannot expire, a heartbeat cannot go stale, and a
 *      direction set in round one is as fresh in round two hundred as the moment it was stated.
 *
 * Together they mean the deliverable the register was measured against — *"over a week of this
 * running, the C-suite will maintain and shift and adjust company direction"* — was not merely
 * unimplemented but unobservable. A week never elapsed.
 *
 * ── A CADENCE IS NOT A LONGER DRIVE ──────────────────────────────────────────
 * The tempting version of this is `driveUntilSettled` with a bigger budget, and it would be a check
 * that cannot fail: the same rounds, at the same instant, producing the same fixed point later. So
 * the falsifier this module is built around is a comparison rather than a scenario —
 *
 *   > **Run the same organization with a stopped clock and with a moving one. If the two produce
 *   > the same history, the clock is decoration.**
 *
 * `org-cadence.test.ts` runs exactly that, and the difference it measures is the whole claim.
 *
 * ── SETTLING IS STILL LOAD-BEARING, JUST NOT TERMINAL ────────────────────────
 * Within one period the drive still runs to a fixed point, and that fixed point is still what says
 * the organization has nothing further it can do ON ITS OWN. What a cadence adds is the admission
 * that "on its own" was doing a lot of work in that sentence: an organization with nothing left to
 * do at 09:00 has plenty to do on Thursday, and the thing that changed in between is not a decision
 * anybody made.
 *
 * A period that settles immediately is therefore NOT a failure — it is a quiet week, and the report
 * says so rather than reporting the loop as stalled. What would be a failure is every period
 * settling immediately, which is a clock that changes nothing, and the report carries the count
 * needed to see it.
 */

import { driveUntilSettled, type DriveDeps, type DriveResult, type DriveState } from "./org-drive";

/** One turn of the calendar. */
export interface CadencePeriod {
  /** Which period this is, from zero. */
  readonly index: number;
  /** The instant every round in this period was judged at. */
  readonly atMs: number;
  readonly rounds: readonly DriveResult[];
  readonly changes: number;
  /** Did the organization run out of things to do within this period's budget? */
  readonly settled: boolean;
}

export interface CadenceResult {
  readonly state: DriveState;
  readonly periods: readonly CadencePeriod[];
  /** Periods in which nothing at all happened. All of them means the clock is decoration. */
  readonly quietPeriods: number;
  /**
   * Periods that hit their round budget without settling.
   *
   * REPORTED SEPARATELY from quiet ones because they are opposite failures: a quiet period is an
   * organization with nothing to do, and an unsettled one is an organization that could not finish.
   * A single count would render them identically, which is this register's recurring defect.
   */
  readonly unsettledPeriods: number;
  readonly summary: string;
}

export interface Cadence {
  /** How much time one period represents. Zero is legal, and is the falsifier's stopped clock. */
  readonly periodMs: number;
  /** How many periods to run. A week of days is 7. */
  readonly periods: number;
  /** Rounds allowed inside one period before it is reported unsettled. */
  readonly maxRoundsPerPeriod: number;
}

/**
 * Run the organization across a span of time.
 *
 *
 * `deps.nowMs` is the START, and each period advances it by `periodMs` — so the deps handed to the
 * drive are rebuilt per period rather than reused. That is the point of the module in one line: a
 * loop that reuses one `deps` cannot have a clock, however many times it runs.
 *
 * `createId` is NOT rebuilt, deliberately. It is the caller's counter and it must keep counting
 * across periods, or period two mints ids period one already used and the organization grows two
 * things with one name.
 *
 * HONEST LIMIT ON THAT LAST SENTENCE: a mutation run rebuilding `createId` per period killed
 * nothing, and the reason is a property of the fixtures rather than of the rule. Every minted id in
 * this drive — signals, anchors, posts, artifact revisions — is produced by an act that is raised
 * ONCE, so under every state reachable today the counter is not consulted after the opening period
 * and a collision cannot occur. The rule is still right, and it becomes falsifiable the moment any
 * act that mints an id recurs; until then this paragraph is the only thing holding it.
 */
export function runCadence(
  state: DriveState,
  hatIds: readonly string[],
  deps: DriveDeps,
  cadence: Cadence,
): CadenceResult {
  if (cadence.periods < 1) {
    throw new Error("a cadence needs at least one period; a calendar with no days is not a calendar");
  }
  if (cadence.periodMs < 0) {
    throw new Error("a period cannot be negative; time does not run backwards here");
  }
  // NO GUARD ON `maxRoundsPerPeriod`, deliberately. One was written here and a mutation run showed
  // that deleting it killed nothing: `driveUntilSettled` already refuses a budget below one and
  // every period calls it. Two refusals for one rule read as defence in depth and are really a
  // reader's false impression that this layer checks something.
  //
  // The cost is honest and small: the refusal names `maxRounds`, the drive's parameter, rather than
  // `maxRoundsPerPeriod`. A slightly less specific message is worth more than a second guard that
  // cannot fail.

  let current = state;
  const periods: CadencePeriod[] = [];
  for (let i = 0; i < cadence.periods; i += 1) {
    const atMs = deps.nowMs + i * cadence.periodMs;
    const periodDeps: DriveDeps = { ...deps, nowMs: atMs };
    const run = driveUntilSettled(current, hatIds, periodDeps, cadence.maxRoundsPerPeriod);
    current = run.state;
    periods.push({
      index: i,
      atMs,
      rounds: run.rounds,
      changes: run.rounds.reduce((n, r) => n + r.changes, 0),
      settled: run.settled,
    });
  }

  const quietPeriods = periods.filter((p) => p.changes === 0).length;
  const unsettledPeriods = periods.filter((p) => !p.settled).length;
  return {
    state: current,
    periods,
    quietPeriods,
    unsettledPeriods,
    summary: `${String(cadence.periods)} period(s) at ${String(cadence.periodMs)}ms: ${String(
      periods.reduce((n, p) => n + p.changes, 0),
    )} change(s), ${String(quietPeriods)} quiet, ${String(unsettledPeriods)} unsettled`,
  };
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;
