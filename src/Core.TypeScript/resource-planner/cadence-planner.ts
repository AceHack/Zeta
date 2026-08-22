/**
 * cadence-planner.ts — a cross-repo PLANNER over the one resource measured to bind:
 * uninterrupted completion windows on a ref.
 *
 * Design doc:
 *   docs/research/2026-08-18-cross-repo-resource-planner-what-is-actually-scarce.md
 *
 * ══ What this is, and what it is NOT ══════════════════════════════════════════
 *
 * `FerryThrottler` / `PriorityFerryThrottler` decide which queued item a ferry
 * carries NEXT — dispatch, inside one tick. `ISoftScheduler<'S>` drives one loop
 * against its injected `Source`. This module sits one level up and answers a
 * different question: **given what every (repo x ref) lane has been observed to
 * cost, at what cadence may each lane push at all?**
 *
 * It is a planner, so it emits a plan and dispatches nothing. It holds no queue,
 * spawns nothing, and performs no IO. Every function here is a pure fold, which
 * is what makes the plan DST-replayable (§7) and the same on every node (§13).
 *
 * ══ Why "cadence" and not "allocation" ════════════════════════════════════════
 *
 * From `resource-class.ts`: a completion window is NOT BANKABLE. You cannot save
 * an unused one, cannot queue for one, and cannot be granted one — you either win
 * the race or you do not. `isAllocatable("window") === false`, and this module is
 * the consequence: the only honest control surface over a non-bankable resource
 * is the RATE at which you contend for it.
 *
 * So the plan says "this lane must not push more often than every N ticks". It
 * never says "this lane is granted N units", because that would be a promise the
 * resource cannot keep.
 *
 * ══ The livelock criterion ════════════════════════════════════════════════════
 *
 * On one ref with `cancel-in-progress`, a push preempts the run the previous push
 * started. So the run can only ever conclude when
 *
 *     pushInterval > jobDuration
 *
 * and a lane whose ratio sits below 1 **can never conclude, at any capacity**.
 * Adding runners does not help. This is why the class matters: the failure looks
 * like starvation and is not — it is self-preemption, and the only fix is to slow
 * the lane down or make the job shorter.
 *
 * ══ Units: deliberately dimensionless ═════════════════════════════════════════
 *
 * `ratio` is (ticks / ticks) and therefore carries NO unit, which is the one
 * choice that needs no cross-language treaty — `MassPpm` and `TemperaturePpm`
 * are the only metering units with an oracle today, and inventing a third would
 * ship a number no other oracle could check.
 *
 * But a dimensionless ratio is only meaningful if numerator and denominator come
 * from the SAME clock, so `RunObservation.tickSource` is carried and the fold
 * REFUSES to mix two sources in one lane. That refusal is the Mars Climate
 * Orbiter guard, typed: a ratio of two different clocks is a number that looks
 * fine and means nothing.
 */

import { stringCompare } from "../collation/collation.ts";
import type { ResourceClass } from "./resource-class.ts";

/**
 * Total indexed access. Neither `!` nor `as T` is permitted in this repo, and
 * both would be lies anyway: an out-of-range index is a bug, so it throws rather
 * than manufacturing a value.
 */
export function at<T>(xs: readonly T[], i: number): T {
  const v = xs[i];
  if (v === undefined) {
    throw new RangeError(`index ${String(i)} out of range (length ${String(xs.length)})`);
  }
  return v;
}

// ══ Lanes ══════════════════════════════════════════════════════════════════════

/**
 * The unit of planning: one ref inside one repo.
 *
 * `repo` is an OPAQUE string here on purpose. Repo topology, identity and
 * pointers are a separate design (Kenji's); this module consumes a repo as a
 * name it never interprets, so the two can land independently.
 */
export interface LaneId {
  readonly repo: string;
  readonly ref: string;
}

/**
 * Stable key for a lane. Ordinal by construction — no locale anywhere.
 *
 * The separator is an ESCAPED NUL rather than a raw one. NUL is the right
 * separator for a composite key (it cannot occur in a repo name or a git ref, so
 * the key is unambiguous), but a raw NUL byte in the file makes git treat the
 * source as BINARY and refuse to diff it — which is exactly what
 * `.claude/rules/no-binary-in-proof-lineage.md` exists to prevent. Written as an
 * escape, the file stays text and the key stays unambiguous.
 */
export function laneKey(l: LaneId): string {
  return `${l.repo}\u0000${l.ref}`;
}

/** Canonical code-point ordering on lanes. The deterministic tie-break. */
export function compareLanes(a: LaneId, b: LaneId): number {
  return stringCompare(laneKey(a), laneKey(b));
}

// ══ Observations ═══════════════════════════════════════════════════════════════

/**
 * How a run ended. CLOSED.
 *
 * The distinction that matters is `preempted` vs `concluded`, and it is the same
 * cut `SchedulerShedHeat` already makes: regenerable work is PRESSURE and is
 * free, annihilated work is LOSS and pays. A preempted run is annihilated — it
 * produced no verdict and nothing carries forward — so preemption is loss, not
 * backpressure. Counting it as pressure is what makes a livelock look healthy.
 */
export type RunOutcome =
  /** Reached a verdict. The only outcome that advances the lane. */
  | { readonly kind: "concluded"; readonly passed: boolean }
  /** Killed by a newer push on the same ref. Annihilated: no verdict, no carry. */
  | { readonly kind: "preempted" }
  /** Ended without a verdict for any other reason (timeout, infra, cancel). */
  | { readonly kind: "abandoned"; readonly reason: string };

/**
 * One observed run.
 *
 * Note what is ABSENT: there is no wall-clock field. Phases are logical positions
 * from a named tick source, and the planner never reads a clock. This is
 * `.claude/rules/local-time-never-enters-the-shared-fold.md` at the type level —
 * a node's receive order cannot influence the plan because it is not
 * representable in the input.
 */
export interface RunObservation {
  readonly lane: LaneId;
  /** Dedup key. Folding the same runId twice is a no-op (idempotency, §12). */
  readonly runId: string;
  /** Which clock produced the phases below. Mixing two in a lane is refused. */
  readonly tickSource: string;
  /** Logical phase at which the run began. */
  readonly startedAtPhase: number;
  /** Logical phase at which the run ended. `>= startedAtPhase`. */
  readonly endedAtPhase: number;
  readonly outcome: RunOutcome;
}

// ══ Health ═════════════════════════════════════════════════════════════════════

/**
 * What the fold concluded about a lane. CLOSED.
 *
 * `unknown` is first and is the honest default. A lane with too few samples is
 * NOT viable-by-default; saying so is the difference between a planner that
 * reports and one that guesses.
 */
export type LaneHealth =
  /** Not enough samples to compute an interval. Says so rather than assuming. */
  | { readonly kind: "unknown"; readonly samples: number; readonly needed: number }
  /** Ratio comfortably above 1 — the lane has room to conclude. */
  | { readonly kind: "viable"; readonly ratio: number; readonly samples: number }
  /** Ratio above 1 but inside the safety band — one slow run from livelock. */
  | { readonly kind: "marginal"; readonly ratio: number; readonly samples: number }
  /** Ratio below 1 AND a preemption streak. Cannot conclude at any capacity. */
  | {
      readonly kind: "livelocked";
      readonly ratio: number;
      readonly consecutivePreemptions: number;
      readonly samples: number;
    }
  /** The lane mixed tick sources; its ratio would be a unit error. Refused. */
  | { readonly kind: "incoherent"; readonly tickSources: readonly string[] };

// ══ Thresholds (attributed, per the tick-budget convention) ════════════════════

/**
 * Why a threshold is this number. Mirrors `SimVerb.BudgetSource` rather than
 * inventing a second attribution vocabulary: a bound nobody is on the record for
 * is a hidden oracle.
 */
export type ThresholdSource =
  | { readonly kind: "human-authorized"; readonly who: string; readonly why: string }
  | { readonly kind: "measured"; readonly from: string; readonly why: string }
  | { readonly kind: "toy-default"; readonly why: string };

export interface PlannerThresholds {
  /** Runs needed before a ratio means anything. Two runs give one interval. */
  readonly minSamples: number;
  /** Ratio at or below which a lane cannot conclude. Structural, always 1. */
  readonly livelockRatio: number;
  /** Ratio below which a lane is only marginally safe. */
  readonly marginalRatio: number;
  /** Consecutive preemptions required to corroborate a sub-1 ratio. */
  readonly preemptionStreak: number;
  readonly attribution: ThresholdSource;
}

/**
 * The defaults, each traceable to the 2026-08-18 measurement.
 *
 * `livelockRatio` is 1 and is NOT a tunable: it is the structural point where
 * push interval equals job duration. The others are judgement and say so.
 */
export const MEASURED_THRESHOLDS: PlannerThresholds = {
  minSamples: 3,
  livelockRatio: 1,
  marginalRatio: 1.25,
  preemptionStreak: 3,
  attribution: {
    kind: "measured",
    from: "60 gate runs over 2h41m, 2026-08-18, Lucent-Financial-Group/Zeta",
    why:
      "minSamples=3 because two intervals are the fewest that can disagree. " +
      "marginalRatio=1.25 because observed gate duration spread was p50 18.7 to " +
      "p90 30.4 min (~1.6x), so 1.25 flags lanes a single slow run would sink " +
      "without flagging every lane. preemptionStreak=3 because the observed " +
      "livelocked lanes ran streaks of 7 and 10, well clear of noise.",
  },
};

// ══ The fold ═══════════════════════════════════════════════════════════════════

/**
 * Accumulated per-lane state. A readonly record, not a class: nothing here is
 * captured, so the whole state can be serialized, diffed and replayed
 * (`.claude/rules/interfaces-free-classes-earned-under-rules.md`).
 */
export interface LaneState {
  readonly lane: LaneId;
  /** Deduped by runId, kept sorted by startedAtPhase. Order of ARRIVAL is lost
   *  on purpose — that is what makes the fold commutative. */
  readonly runs: readonly RunObservation[];
  readonly tickSources: readonly string[];
}

export interface PlannerState {
  readonly lanes: readonly LaneState[];
}

export const EMPTY_STATE: PlannerState = { lanes: [] };

/**
 * Fold one observation into the state.
 *
 * Three properties this is written to have, each with a test that fails without
 * it:
 *   - COMMUTATIVE: observations are inserted in phase order, never arrival
 *     order, so any permutation of the same set yields the same state.
 *   - IDEMPOTENT: a repeated `runId` is dropped, so apply-N-times equals
 *     apply-once (§12).
 *   - TOTAL: an unknown lane creates one; nothing throws.
 */
export function observeRun(state: PlannerState, obs: RunObservation): PlannerState {
  const key = laneKey(obs.lane);
  const idx = state.lanes.findIndex((l) => laneKey(l.lane) === key);

  if (idx === -1) {
    const created: LaneState = {
      lane: obs.lane,
      runs: [obs],
      tickSources: [obs.tickSource],
    };
    return { lanes: insertLaneOrdered(state.lanes, created) };
  }

  const existing = at(state.lanes, idx);
  if (existing.runs.some((r) => r.runId === obs.runId)) {
    return state; // idempotent: already folded
  }

  const runs = insertRunOrdered(existing.runs, obs);
  const tickSources = existing.tickSources.includes(obs.tickSource)
    ? existing.tickSources
    : [...existing.tickSources, obs.tickSource].sort(stringCompare);

  const updated: LaneState = { lane: existing.lane, runs, tickSources };
  const lanes = [...state.lanes];
  lanes[idx] = updated;
  return { lanes };
}

/** Fold many. Scale-free across arity: one path, differing only in length. */
export function observeAll(
  state: PlannerState,
  observations: readonly RunObservation[],
): PlannerState {
  return observations.reduce(observeRun, state);
}

// ══ Health computation ═════════════════════════════════════════════════════════

/**
 * The ratio and the verdict for one lane.
 *
 * Two INDEPENDENT signals must agree before a lane is called livelocked:
 *   1. the RATE signal — median push interval over median run duration, < 1
 *   2. the OUTCOME signal — a streak of preemptions with no conclusion
 *
 * Requiring both is deliberate. Either alone produces false positives (a ratio
 * can dip on two unlucky samples; a streak can come from an unrelated outage),
 * and because they are measured from different fields they can genuinely
 * disagree — which is reported as `marginal` rather than resolved by preference.
 */
export function laneHealth(
  lane: LaneState,
  t: PlannerThresholds = MEASURED_THRESHOLDS,
): LaneHealth {
  if (lane.tickSources.length > 1) {
    return { kind: "incoherent", tickSources: lane.tickSources };
  }

  const n = lane.runs.length;
  if (n < t.minSamples) {
    return { kind: "unknown", samples: n, needed: t.minSamples };
  }

  const durations = lane.runs.map((r) => r.endedAtPhase - r.startedAtPhase);
  const intervals: number[] = [];
  for (let i = 1; i < n; i++) {
    const prev = at(lane.runs, i - 1);
    const cur = at(lane.runs, i);
    intervals.push(cur.startedAtPhase - prev.startedAtPhase);
  }

  const medDur = median(durations);
  const medInt = median(intervals);

  // A zero-length job cannot be preempted; the ratio is undefined, not infinite.
  if (medDur <= 0) {
    return { kind: "unknown", samples: n, needed: t.minSamples };
  }

  const ratio = medInt / medDur;
  const streak = trailingPreemptions(lane.runs);
  const concluded = lane.runs.some((r) => r.outcome.kind === "concluded");

  if (ratio <= t.livelockRatio && streak >= t.preemptionStreak && !concluded) {
    return { kind: "livelocked", ratio, consecutivePreemptions: streak, samples: n };
  }
  if (ratio < t.marginalRatio) {
    return { kind: "marginal", ratio, samples: n };
  }
  return { kind: "viable", ratio, samples: n };
}

/** Preemptions at the tail of the run list, newest first. */
function trailingPreemptions(runs: readonly RunObservation[]): number {
  let count = 0;
  for (let i = runs.length - 1; i >= 0; i--) {
    if (at(runs, i).outcome.kind !== "preempted") break;
    count++;
  }
  return count;
}

// ══ The plan ═══════════════════════════════════════════════════════════════════

/**
 * What the planner says about a lane. CLOSED, and disjoint by construction: a
 * lane gets exactly one of these, so "admitted and paced" is not representable.
 *
 * There is no `defer` case, and its absence is the design. Deferring implies the
 * resource will still be there later, which is true of a `stock` and false of a
 * `window`. Offering `defer` over a non-bankable resource would be a plan that
 * cannot be honoured.
 */
export type Admission =
  /** Push freely; the lane has been observed to conclude. */
  | { readonly kind: "admit"; readonly lane: LaneId; readonly because: LaneHealth }
  /** Push no more often than `minPushIntervalTicks`, or it cannot conclude. */
  | {
      readonly kind: "pace";
      readonly lane: LaneId;
      readonly minPushIntervalTicks: number;
      readonly because: LaneHealth;
    }
  /** Nothing can be said yet, or the lane's own data is incoherent. */
  | { readonly kind: "hold"; readonly lane: LaneId; readonly because: LaneHealth };

export interface Plan {
  readonly admissions: readonly Admission[];
  /** Lanes competing for a `mutex`-class resource, in fair-share order. */
  readonly mutexOrder: readonly LaneId[];
}

/**
 * Build the plan. A pure function of (state, thresholds) — no clock, no IO, no
 * randomness, so the same state yields the same plan on every node and on every
 * replay.
 */
export function plan(
  state: PlannerState,
  t: PlannerThresholds = MEASURED_THRESHOLDS,
): Plan {
  const admissions = state.lanes.map((lane): Admission => {
    const health = laneHealth(lane, t);
    switch (health.kind) {
      case "viable":
        return { kind: "admit", lane: lane.lane, because: health };
      case "marginal":
      case "livelocked": {
        const medDur = median(lane.runs.map((r) => r.endedAtPhase - r.startedAtPhase));
        return {
          kind: "pace",
          lane: lane.lane,
          // Target the safety band, not merely ratio 1: landing exactly on 1
          // means the next slightly-slow run preempts again.
          minPushIntervalTicks: Math.ceil(medDur * t.marginalRatio),
          because: health,
        };
      }
      case "unknown":
      case "incoherent":
        return { kind: "hold", lane: lane.lane, because: health };
      default:
        return assertNeverAdmission(health);
    }
  });

  return { admissions, mutexOrder: fairShareOrder(state) };
}

function assertNeverAdmission(x: never): never {
  throw new Error(`plan: unhandled LaneHealth ${JSON.stringify(x)}`);
}

// ══ Fairness ═══════════════════════════════════════════════════════════════════

/**
 * Fair-share ordering for the `mutex`-class resources (the repo-wide
 * `concurrency:` singletons: one holder at a time, so someone must be last).
 *
 * Deficit Round Robin, the same discipline `drain-scheduler.ts` already applies
 * to ferry lanes, lifted to plan altitude. A lane that has held the mutex less
 * often sorts earlier; ties break on canonical code-point lane order so the
 * result is deterministic without a seed.
 *
 * ══ WHAT THIS DOES NOT GUARANTEE — stated plainly ══════════════════════════════
 *
 * This gives SELECTION fairness: no lane is passed over forever, so no lane
 * starves for want of being chosen. It does NOT guarantee progress, and the
 * difference is the whole point of this module:
 *
 *   **A livelocked lane starves no matter how often it is selected**, because
 *   its runs are destroyed by its own next push rather than by competition.
 *   Selecting it more often makes the situation strictly worse — more runs
 *   started, the same zero concluded, more work annihilated.
 *
 * So fair-share is the right tool for `mutex` and the wrong tool for `window`,
 * and the planner deliberately applies it only to the former. For a livelocked
 * lane the answer is the `pace` admission, and if the lane cannot slow down then
 * the honest report is that the job must get shorter — which is a change no
 * scheduler can make on its behalf.
 */
export function fairShareOrder(state: PlannerState): readonly LaneId[] {
  return [...state.lanes]
    .map((l) => ({
      lane: l.lane,
      // Concluded runs are the ones that actually consumed a turn.
      held: l.runs.filter((r) => r.outcome.kind === "concluded").length,
    }))
    .sort((a, b) => (a.held !== b.held ? a.held - b.held : compareLanes(a.lane, b.lane)))
    .map((x) => x.lane);
}

// ══ Which class a plan is about ════════════════════════════════════════════════

/** This planner plans over exactly one class. Named so a reader cannot assume. */
export const PLANNED_CLASS: ResourceClass = "window";

// ══ Small pure helpers ═════════════════════════════════════════════════════════

/** Median of a non-empty numeric list. Sorts numerically, never by string. */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  if (s.length % 2 === 1) return at(s, mid);
  return (at(s, mid - 1) + at(s, mid)) / 2;
}

/** Insert keeping runs sorted by (startedAtPhase, runId) — arrival order lost. */
function insertRunOrdered(
  runs: readonly RunObservation[],
  obs: RunObservation,
): readonly RunObservation[] {
  const out = [...runs, obs];
  out.sort((a, b) =>
    a.startedAtPhase !== b.startedAtPhase
      ? a.startedAtPhase - b.startedAtPhase
      : stringCompare(a.runId, b.runId),
  );
  return out;
}

/** Insert keeping lanes in canonical order — arrival order lost. */
function insertLaneOrdered(
  lanes: readonly LaneState[],
  lane: LaneState,
): readonly LaneState[] {
  const out = [...lanes, lane];
  out.sort((a, b) => compareLanes(a.lane, b.lane));
  return out;
}
