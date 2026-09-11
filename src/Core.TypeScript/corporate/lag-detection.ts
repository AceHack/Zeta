/**
 * lag-detection.ts — "No silent lag."
 *
 * ── THE DOC ──────────────────────────────────────────────────────────────────
 * `WORK_AND_RELEASE_MANAGEMENT_OS.md` §"Lag and Breakdown Prevention" lists twelve conditions the
 * system should actively detect, and ends with the sentence that makes it a module rather than a
 * dashboard:
 *
 *   > Each condition should produce a **signal, not a hidden log line**.
 *
 * and the guardrail list closes with the same thing again: *"No silent lag. Stuck states, missing
 * assignments, missing reviewers, silent runs, and saturated queues must produce signals and
 * escalation."*
 *
 * ── WHAT THE REGISTER HAD ────────────────────────────────────────────────────
 * `reconciliation.ts` compares what the organization BELIEVES against what a repository and a
 * tracker say — a delivery-truth reconciler. `work-stealing.ts` derives whether one silent owner's
 * work may move. Neither sweeps the organization for the conditions above, so an assignment with no
 * reviewer, a QA-ready item nobody was given, and a release candidate short of evidence were all
 * things somebody had to notice.
 *
 * ── THE ONLY WAY THIS MODULE CAN LIE ─────────────────────────────────────────
 * A detector that reports nothing looks exactly like an organization with nothing wrong. So the
 * report distinguishes three things and never lets the third read as the first:
 *
 *   - a condition CHECKED and clear,
 *   - a condition checked and FOUND,
 *   - a condition NOT CHECKED, because the observation it needs was not supplied.
 *
 * Same discipline as `reconciliation.ts`'s `notChecked`, for the same reason: silence about
 * something nobody looked at is the shape every stalled organization mistakes for health. An input
 * absent means not-checked; an input present and empty means checked and clear, and those are
 * different facts.
 *
 * ── FINDINGS ARE ROUTED, NOT BROADCAST ───────────────────────────────────────
 * Each finding names the hat that can act on it, derived the way every other routing in this
 * register is: from the chart and from `blocker-taxonomy.ts`'s roster. A signal sent to everyone is
 * a signal addressed to nobody.
 */

import { BlockerKind, ownersFor } from "./blocker-taxonomy";
import { isLeafType, WorkState, type CascadeNode } from "./goal-cascade";
import { type OrgChart, supervisorOf } from "./org-chart";

/** The doc's twelve conditions, in its own order. */
export const LagKind = {
  /** Work needing hats with no active assignment. */
  UnassignedReadyWork: "unassigned_ready_work",
  /** An assignment whose token has expired. */
  ExpiredAssignmentToken: "expired_assignment_token",
  /** An assignment with no run or session heartbeat. */
  AssignmentSilent: "assignment_silent",
  /** A run bound to no work item. */
  UnboundRun: "unbound_run",
  /** Hat supply reserved and no task started against it. */
  ReservedSupplyIdle: "reserved_supply_idle",
  /** Work in review with nobody assigned to review it. */
  ReviewerMissing: "reviewer_missing",
  /** QA-ready work with no QA assignment. */
  QaAssignmentMissing: "qa_assignment_missing",
  /** A release candidate short of the evidence its gates require. */
  ReleaseEvidenceMissing: "release_evidence_missing",
  /** Blocked work whose owner has not answered. */
  BlockerOwnerSilent: "blocker_owner_silent",
  /** A queue growing faster than the hats available to drain it. */
  QueueSaturated: "queue_saturated",
  /** The same item reassigned again and again. */
  RepeatedReassignment: "repeated_reassignment",
  /** An assignment running past what its kind of work takes. */
  AssignmentOverdue: "assignment_overdue",
} as const;

export type LagKind = (typeof LagKind)[keyof typeof LagKind];

/**
 * How many reassignments of ONE item make a pattern.
 *
 * TWO. One reassignment is an ordinary correction — an owner went silent, somebody else picked it
 * up, which is the mechanism `work-stealing.ts` exists to provide. A second says the item keeps
 * coming back, and that is about the item or the process rather than about either owner.
 */
export const REASSIGNMENT_THRESHOLD = 2;

export interface LagFinding {
  readonly kind: LagKind;
  /** What the finding is about — a work id, a run id, a queue name, a hat id. */
  readonly subjectId: string;
  /** The hat that can act on it. */
  readonly ownerHatId: string;
  readonly detail: string;
}

/**
 * What the organization can currently see.
 *
 * EVERY FIELD IS OPTIONAL, and absent means the corresponding condition is reported as NOT CHECKED
 * rather than silently passing. A caller that supplies half the observations gets half the sweep
 * and is told which half.
 */
export interface LagInput {
  readonly nowMs: number;
  /** Work items. Absent skips every condition derived from the cascade. */
  readonly cascade?: readonly CascadeNode[];
  /** Live assignments, by work id. */
  readonly assignments?: readonly {
    readonly workId: string;
    readonly hatId: string;
    readonly tokenExpiresMs: number;
    readonly heartbeatAtMs: number;
    readonly startedAtMs: number;
    readonly runId?: string;
  }[];
  /** How long an assignment may be silent before it counts as one. */
  readonly silenceSlaMs?: number;
  /** How long an assignment of this work type is expected to take. */
  readonly expectedDurationMs?: number;
  /** Runs the executor knows about, with the work each is bound to. */
  readonly runs?: readonly { readonly runId: string; readonly workId?: string }[];
  /** Hat supply reserved but not yet drawn against. */
  readonly reservedSupply?: readonly { readonly hatId: string; readonly reservedAtMs: number; readonly taskStarted: boolean }[];
  /** How long reserved supply may sit before it is idle capacity. */
  readonly reservationSlaMs?: number;
  /** Work ids currently awaiting review, with the reviewer if one was named. */
  readonly reviews?: readonly { readonly workId: string; readonly reviewerHatId?: string }[];
  /** Work ids ready for QA, with the QA hat if one was named. */
  readonly qaReady?: readonly { readonly workId: string; readonly qaHatId?: string }[];
  /** Release candidates and the evidence each is still missing. */
  readonly releaseCandidates?: readonly { readonly workId: string; readonly missingEvidence: readonly string[] }[];
  /** Blocked work: who was asked, when, and whether they answered. */
  readonly blocked?: readonly {
    readonly workId: string;
    readonly ownerHatId: string;
    readonly askedAtMs: number;
    readonly answered: boolean;
    readonly blockerKind?: BlockerKind;
  }[];
  /** Queue depths against the hats available to drain them. */
  readonly queues?: readonly { readonly queueId: string; readonly depth: number; readonly drainingHats: number; readonly perHatCapacity: number }[];
  /** How many times each work id has been reassigned. */
  readonly reassignments?: ReadonlyMap<string, number>;
}

export interface LagReport {
  readonly findings: readonly LagFinding[];
  /** Conditions actually swept. */
  readonly checked: readonly LagKind[];
  /**
   * Conditions NOT swept, because the observation they need was absent.
   *
   * Never counted as clear. An empty findings list over a mostly-unchecked sweep is the report an
   * organization about to stall produces, and reading it as health is the failure this field exists
   * to make impossible.
   */
  readonly notChecked: readonly LagKind[];
  readonly summary: string;
}

/**
 * One condition, and whether it could be swept at all.
 *
 * `undefined` means NOT CHECKED — the observation this detector needs was not supplied. That is a
 * different return from an empty array, and keeping them different IN THE TYPE is what stops the
 * distinction being lost: a detector has no way to spell "nothing wrong" for something it never
 * looked at.
 *
 * Each detector narrows its own inputs first, so nothing below the guard reaches for a `?? []` —
 * the fallback that would quietly turn a missing observation into a clean one.
 */
interface Detector {
  readonly kind: LagKind;
  readonly run: (chart: OrgChart, input: LagInput) => readonly LagFinding[] | undefined;
}

/** The doc's twelve, as a list, so "twelve" is something a test can count. */
const DETECTORS: readonly Detector[] = [
  {
    kind: LagKind.UnassignedReadyWork,
    run: (_chart, input) => {
      const cascade = input.cascade;
      if (cascade === undefined) return undefined;
      return cascade
        .filter((n) => isLeafType(n.workType) && n.state === WorkState.Open && n.assigneeHatId === undefined)
        .map((n) => ({
          kind: LagKind.UnassignedReadyWork,
          subjectId: n.workId,
          ownerHatId: n.ownerHatId,
          detail: `'${n.workId}' is open with nobody on it`,
        }));
    },
  },
  {
    kind: LagKind.ExpiredAssignmentToken,
    run: (chart, input) => {
      const assignments = input.assignments;
      if (assignments === undefined) return undefined;
      return assignments
        .filter((a) => input.nowMs >= a.tokenExpiresMs)
        .map((a) => ({
          kind: LagKind.ExpiredAssignmentToken,
          subjectId: a.workId,
          ownerHatId: supervisorIdOf(chart, a.hatId),
          detail: `'${a.hatId}' holds '${a.workId}' on a token that expired ${String(input.nowMs - a.tokenExpiresMs)}ms ago`,
        }));
    },
  },
  {
    kind: LagKind.AssignmentSilent,
    run: (chart, input) => {
      // NEEDS BOTH the assignments and an SLA. Sweeping without a threshold would mean inventing
      // one, and a finding against an invented number is one nobody can act on.
      const assignments = input.assignments;
      const sla = input.silenceSlaMs;
      if (assignments === undefined || sla === undefined) return undefined;
      return assignments
        .filter((a) => input.nowMs - a.heartbeatAtMs >= sla)
        .map((a) => ({
          kind: LagKind.AssignmentSilent,
          subjectId: a.workId,
          // THE SUPERVISOR, never the silent hat: a finding sent to a hat that has gone quiet is a
          // message into the same silence.
          ownerHatId: supervisorIdOf(chart, a.hatId),
          detail: `'${a.hatId}' has not been heard from for ${String(input.nowMs - a.heartbeatAtMs)}ms on '${a.workId}'`,
        }));
    },
  },
  {
    kind: LagKind.UnboundRun,
    run: (chart, input) => {
      const runs = input.runs;
      if (runs === undefined) return undefined;
      return runs
        .filter((r) => r.workId === undefined || r.workId.trim() === "")
        .map((r) => ({
          kind: LagKind.UnboundRun,
          subjectId: r.runId,
          // Work happening against no item is the doc's "no work should be invisible" defeated — an
          // operations problem before it is anybody's line management.
          ownerHatId: firstOwnerOr(chart, BlockerKind.EnvironmentIssue, "ceo"),
          detail: `run '${r.runId}' is bound to no work item`,
        }));
    },
  },
  {
    kind: LagKind.ReservedSupplyIdle,
    run: (chart, input) => {
      const reserved = input.reservedSupply;
      const sla = input.reservationSlaMs;
      if (reserved === undefined || sla === undefined) return undefined;
      return reserved
        .filter((s) => !s.taskStarted && input.nowMs - s.reservedAtMs >= sla)
        .map((s) => ({
          kind: LagKind.ReservedSupplyIdle,
          subjectId: s.hatId,
          ownerHatId: firstOwnerOr(chart, BlockerKind.HatSupplyExhausted, "ceo"),
          detail: `'${s.hatId}' has been reserved for ${String(input.nowMs - s.reservedAtMs)}ms with no task started`,
        }));
    },
  },
  {
    kind: LagKind.ReviewerMissing,
    run: (chart, input) => {
      const reviews = input.reviews;
      if (reviews === undefined) return undefined;
      return reviews
        .filter((r) => r.reviewerHatId === undefined)
        .map((r) => ({
          kind: LagKind.ReviewerMissing,
          subjectId: r.workId,
          ownerHatId: firstOwnerOr(chart, BlockerKind.ReviewerUnavailable, "ceo"),
          detail: `'${r.workId}' is in review with no reviewer assigned`,
        }));
    },
  },
  {
    kind: LagKind.QaAssignmentMissing,
    run: (chart, input) => {
      const qaReady = input.qaReady;
      if (qaReady === undefined) return undefined;
      return qaReady
        .filter((q) => q.qaHatId === undefined)
        .map((q) => ({
          kind: LagKind.QaAssignmentMissing,
          subjectId: q.workId,
          ownerHatId: firstOwnerOr(chart, BlockerKind.QaUnavailable, "ceo"),
          detail: `'${q.workId}' is QA-ready with no QA assignment`,
        }));
    },
  },
  {
    kind: LagKind.ReleaseEvidenceMissing,
    run: (chart, input) => {
      const candidates = input.releaseCandidates;
      if (candidates === undefined) return undefined;
      return candidates
        .filter((c) => c.missingEvidence.length > 0)
        .map((c) => ({
          kind: LagKind.ReleaseEvidenceMissing,
          subjectId: c.workId,
          ownerHatId: firstOwnerOr(chart, BlockerKind.ReleaseBlocked, "ceo"),
          detail: `'${c.workId}' is short of ${ordinal(c.missingEvidence).join(", ")}`,
        }));
    },
  },
  {
    kind: LagKind.BlockerOwnerSilent,
    run: (chart, input) => {
      const blocked = input.blocked;
      const sla = input.silenceSlaMs;
      if (blocked === undefined || sla === undefined) return undefined;
      return blocked
        .filter((b) => !b.answered && input.nowMs - b.askedAtMs >= sla)
        .map((b) => ({
          kind: LagKind.BlockerOwnerSilent,
          subjectId: b.workId,
          // ESCALATED PAST the owner who did not answer. Addressing the same hat is a reminder, and
          // a reminder is exactly what already went unanswered.
          ownerHatId: supervisorIdOf(chart, b.ownerHatId),
          detail: `'${b.ownerHatId}' has not answered '${b.workId}' in ${String(input.nowMs - b.askedAtMs)}ms`,
        }));
    },
  },
  {
    kind: LagKind.QueueSaturated,
    run: (chart, input) => {
      const queues = input.queues;
      if (queues === undefined) return undefined;
      // AGAINST CAPACITY, not a constant. Ten items and five drainers is fine; ten and one is not.
      // A fixed threshold fires on a busy healthy queue and stays quiet on a stalled thin one.
      return queues
        .filter((q) => q.depth > q.drainingHats * q.perHatCapacity)
        .map((q) => ({
          kind: LagKind.QueueSaturated,
          subjectId: q.queueId,
          ownerHatId: firstOwnerOr(chart, BlockerKind.HatSupplyExhausted, "ceo"),
          detail: `'${q.queueId}' holds ${String(q.depth)} against a capacity of ${String(q.drainingHats * q.perHatCapacity)}`,
        }));
    },
  },
  {
    kind: LagKind.RepeatedReassignment,
    run: (chart, input) => {
      const counts = input.reassignments;
      if (counts === undefined) return undefined;
      return ordinal([...counts.keys()])
        .filter((workId) => (counts.get(workId) ?? 0) >= REASSIGNMENT_THRESHOLD)
        .map((workId) => ({
          kind: LagKind.RepeatedReassignment,
          subjectId: workId,
          ownerHatId: firstOwnerOr(chart, BlockerKind.DependencyIncomplete, "ceo"),
          detail: `'${workId}' has been reassigned ${String(counts.get(workId) ?? 0)} times`,
        }));
    },
  },
  {
    kind: LagKind.AssignmentOverdue,
    run: (chart, input) => {
      const assignments = input.assignments;
      const expected = input.expectedDurationMs;
      if (assignments === undefined || expected === undefined) return undefined;
      // EXCLUSIVE at the boundary. "Expected" is a budget, and spending all of it is not
      // overrunning it — an inclusive test reports every assignment that lands on its estimate.
      return assignments
        .filter((a) => input.nowMs - a.startedAtMs > expected)
        .map((a) => ({
          kind: LagKind.AssignmentOverdue,
          subjectId: a.workId,
          ownerHatId: supervisorIdOf(chart, a.hatId),
          detail: `'${a.workId}' has run ${String(input.nowMs - a.startedAtMs)}ms against an expected ${String(expected)}ms`,
        }));
    },
  },
];

/** How many conditions this module sweeps for. The doc's count, as a value a test can check. */
export const LAG_CONDITION_COUNT = DETECTORS.length;

/**
 * Sweep for the twelve.
 *
 * Pure and total: no clock of its own, no ports, no repair. `nowMs` is supplied so the same inputs
 * produce the same report, which is what lets a sweep be replayed and argued with.
 */
export function detectLag(chart: OrgChart, input: LagInput): LagReport {
  const findings: LagFinding[] = [];
  const checked: LagKind[] = [];
  const notChecked: LagKind[] = [];

  for (const detector of DETECTORS) {
    const found = detector.run(chart, input);
    if (found === undefined) {
      notChecked.push(detector.kind);
      continue;
    }
    checked.push(detector.kind);
    findings.push(...found);
  }

  return {
    findings,
    checked,
    notChecked,
    summary: `${String(findings.length)} finding(s) across ${String(checked.length)} checked condition(s); ${String(notChecked.length)} not checked`,
  };
}

/** Findings of one kind. */
export function lagOfKind(report: LagReport, kind: LagKind): readonly LagFinding[] {
  return report.findings.filter((f) => f.kind === kind);
}

/**
 * Was this sweep complete?
 *
 * A separate question from whether it found anything, and callers must be able to ask it: a clean
 * report over four of twelve conditions is not a healthy organization, it is a thin look at one.
 */
export function sweptEverything(report: LagReport): boolean {
  return report.notChecked.length === 0;
}

/** The hat above this one, or the hat itself when it is the root — never `undefined`. */
function supervisorIdOf(chart: OrgChart, hatId: string): string {
  return supervisorOf(chart, hatId)?.id ?? hatId;
}

/**
 * The first hat that owns this class of problem, falling back to a named hat.
 *
 * The fallback is deliberate and different from `routeBlocker`'s refusal: a blocker with no owner
 * must refuse, because delivering it to someone who cannot act is worse than not sending it. A LAG
 * finding with no natural owner still has to reach somebody — an organization that cannot say who
 * owns its own saturated queue has a bigger problem than the queue, and dropping the finding hides
 * exactly that.
 */
function firstOwnerOr(chart: OrgChart, kind: BlockerKind, fallbackHatId: string): string {
  return ownersFor(chart, kind)[0]?.id ?? fallbackHatId;
}

/** ORDINAL. Two machines sweeping the same organization must report in the same order. */
function ordinal(xs: readonly string[]): readonly string[] {
  return [...xs].sort((a, b) => {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  });
}
