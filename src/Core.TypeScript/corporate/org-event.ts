/**
 * corporate/org-event.ts — the organization's trace, as typed events rather than prose.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 * `runOrgRuntime` reported what happened as `readonly string[]`. Readable, and unqueryable: nothing
 * could ask "every gate verdict on this work", "everything this hat decided", or — the one that
 * matters — "everything decided inside the CTO's line". A log you can only read is a log you can
 * only check by reading all of it, which nobody does.
 *
 * This is the reference's `OrgEvent` ported to the corporate register's own vocabulary
 * (`agentic-organization/packages/domain/src/org-event.ts`), reduced to the kinds this register
 * actually emits. Extending the enum with kinds nothing produces would recreate, in the audit trail,
 * exactly the modelled-but-unused problem this package was written to fix.
 *
 * ── THE SUPERVISOR CHAIN IS DERIVED, NEVER SUPPLIED ──────────────────────────
 * Every event carries the hat path from the root down to the actor, and `emit` computes it from the
 * chart. A caller cannot pass a chain, so a chain cannot be wrong — which is the whole reason to
 * record it. A supplied chain is an assertion about authority made by the same code that is claiming
 * the authority.
 *
 * That one field is what makes `decidedUnder` possible: an organization can ask what a line of
 * authority did without knowing in advance which hats are in it.
 */

import { supervisorChainOf, type OrgChart } from "./org-chart";
import type { WorkState, WorkType } from "./goal-cascade";
import type { ScheduleBlockState, ScheduleBlockType } from "./work-schedule";
import type { PriorityClass } from "./prioritization";
import type { GateEvaluation } from "./quality-gate";
import type { PortfolioKind } from "./portfolio";
import type { WorkQueue } from "./work-market";
import type { QaCycleReport } from "./qa";
import type { RunFidelity } from "./providers";
import type { ObserveActTick } from "./observe-act-window";
import type { SupervisorSignal } from "./supervisor-signal";
import type { AnchorPost, DecisionRecord, DiscussionAnchor } from "./discussion-anchor";

export const OrgEventKind = {
  IntakeReceived: "intake_received",
  PriorityDecision: "priority_decision",
  WorkItemTransition: "work_item_transition",
  HatAssignment: "hat_assignment",
  HatBindingTransition: "hat_binding_transition",
  SuccessionPlanned: "succession_planned",
  ScheduleBlockPlanned: "schedule_block_planned",
  MeetingScheduled: "meeting_scheduled",
  SupervisorSignalSent: "supervisor_signal_sent",
  DecisionRecorded: "decision_recorded",
  WorkClaimed: "work_claimed",
  WorkCompleted: "work_completed",
  ShardApproved: "shard_approved",
  ShardMerged: "shard_merged",
  TestRunRecorded: "test_run_recorded",
  QualityGateEvaluation: "quality_gate_evaluation",
  ChurnDetected: "churn_detected",
  EscalationDecision: "escalation_decision",
  ChangeProjected: "change_projected",
  /** The work market as it stood at the end of a run — see the `queue_snapshot` fact. */
  QueueSnapshot: "queue_snapshot",
  /** What the run's ports were — see the `run_fidelity` fact. */
  RunFidelity: "run_fidelity",
  /** One turn of the observe-act lane — see the `observe_act_tick` fact. */
  ObserveActTick: "observe_act_tick",
  Refusal: "refusal",
} as const;

export type OrgEventKind = (typeof OrgEventKind)[keyof typeof OrgEventKind];

/**
 * The STRUCTURED FACT a state-constituting event carries.
 *
 * ── WHY PROSE WAS NOT ENOUGH ─────────────────────────────────────────────────
 * `decision` is a sentence: *"owns defect 'implement the coupon fix'"*. It is the right thing for a
 * human reading a trace, and it is the wrong thing to rebuild state from — the work type is inside
 * the sentence, the parent is not in it at all, and recovering either means parsing English.
 *
 * So an event that CONSTITUTES state carries the fact as data alongside the sentence. The prose
 * stays the reading; this is the record. Without it the trace is an audit log that can say what
 * happened and cannot say what IS — which is exactly why the organization could be persisted and
 * not resumed.
 *
 * Absent on events that decide nothing about state — a refusal, a signal, a churn notice. Those are
 * real events and they change no fact, and giving them an empty payload would blur the difference.
 */
export type OrgFact =
  | {
      readonly kind: "work_created";
      readonly workId: string;
      readonly workType: WorkType;
      readonly title: string;
      readonly ownerHatId: string;
      readonly parentWorkId?: string;
    }
  | { readonly kind: "work_assigned"; readonly workId: string; readonly assigneeHatId: string }
  | { readonly kind: "work_state"; readonly workId: string; readonly state: WorkState }
  | {
      readonly kind: "block_planned";
      readonly blockId: string;
      readonly hatId: string;
      readonly blockType: ScheduleBlockType;
      readonly startMs: number;
      readonly endMs: number;
      readonly workItemId?: string;
      readonly meetingId?: string;
    }
  | { readonly kind: "block_state"; readonly blockId: string; readonly state: ScheduleBlockState }
  /**
   * A meeting is ONE thing that happened and N blocks on N calendars.
   *
   * Carried as one fact with all its legs rather than split into N events, because splitting would
   * make a meeting look like N unrelated bookings that happen to share a time — and the meeting is
   * the thing the organization decided, not the individual legs.
   */
  /** The priority the organization DECIDED, with what the scorer had recommended. */
  | {
      readonly kind: "priority_decided";
      readonly workId: string;
      readonly priorityClass: PriorityClass;
      readonly decidedByHatId: string;
      readonly reason: string;
      readonly recommended: PriorityClass;
      readonly reasonCodes: readonly string[];
    }
  /**
   * The verdicts from ONE run of the gate chain.
   *
   * A list rather than one fact per verdict, for the same reason a meeting is one fact with N legs:
   * a chain run is the thing that happened, and splitting it would make seven related verdicts look
   * like seven unrelated decisions that share a timestamp. The churn signal and the change-failure
   * rate are both folds over these.
   */
  | { readonly kind: "gates_evaluated"; readonly evaluations: readonly GateEvaluation[] }
  /** A long-lived container was opened. It outlives every goal inside it — see `portfolio.ts`. */
  | {
      readonly kind: "portfolio_opened";
      readonly portfolioId: string;
      readonly title: string;
      readonly portfolioKind: PortfolioKind;
      readonly ownerHatId: string;
    }
  /** A goal was said to be ABOUT a portfolio. An association, never a decomposition edge. */
  | { readonly kind: "goal_associated"; readonly goalId: string; readonly portfolioId: string }
  /**
   * The work MARKET at the end of a run: its shards, its claims, its approvals.
   *
   * A SNAPSHOT, and deliberately not a stream of `shard_claimed` / `claim_released` deltas. The
   * queue's transitions are enforced by `work-market.ts` — fencing tokens, lease expiry, the
   * self-approval refusal — and re-deriving them in the fold would be a SECOND implementation of
   * that state machine, free to drift from the first while both look healthy. Carrying the queue's
   * own value keeps one authority, and makes the round trip checkable: fold the log and the queue
   * that comes back must equal the one the run ended with.
   *
   * Keyed by `queueId`, and the fold takes the LAST occurrence in the log rather than the highest
   * revision — a later run opening a fresh queue under the same id starts at revision 0 again, and
   * a max-revision fold would resurrect the older one.
   */
  | { readonly kind: "queue_snapshot"; readonly queue: WorkQueue }
  /**
   * WHAT THIS RUN'S CAPABILITIES ACTUALLY WERE.
   *
   * `fidelityOf` tells a live run whether it touched anything. Until this fact existed that answer
   * was in memory only and died at the disk boundary, so a store built from real commands, real
   * worktrees and real `--no-ff` merges resumed IDENTICALLY to one built from a pure simulation:
   * same run count, same `delivered: true`, same facts, same work items. Measured.
   *
   * That is the failure the port layer exists to prevent — a run that shipped something versus one
   * that decided it had — displaced in time, and worse than the original, because after the fact it
   * is not recoverable even in principle. The evidence was never written down.
   *
   * Carried as the whole report rather than a boolean: `replayable` is the conclusion, and a reader
   * asking WHICH capability was real needs the ports, not the verdict.
   */
  | { readonly kind: "run_fidelity"; readonly report: RunFidelity }
  /**
   * One turn of the observe-act lane, durable.
   *
   * The promotion gate reads a window folded from these. Before this fact existed the window was
   * always empty, so the gate always answered shadow — correct, and unfalsifiable, which is the
   * one property a gate must not have.
   */
  | { readonly kind: "observe_act_tick"; readonly tick: ObserveActTick }
  /**
   * A hat talking upward, as a VALUE rather than as a sentence.
   *
   * `supervisor_signal_sent` recorded `decision: "<tool> → <hat>"` and nothing else, so the routed,
   * evidenced signal was flattened to prose the moment it was logged. Fourteen other event kinds
   * carried a fact; this one did not, which meant a second process folding the log could read that
   * a signal happened and could not read WHAT WAS ASKED. An organization whose upward channel
   * survives only as a description of itself has no upward channel across a process boundary.
   */
  | { readonly kind: "supervisor_signal"; readonly signal: SupervisorSignal }
  /**
   * A deliberation opened — what is being discussed, by whom, and what it OWES.
   *
   * The board was an in-memory value returned in the report and recorded nowhere. `decision_recorded`
   * existed as an event kind with zero emitters, so every anchor, post and decision an organization
   * produced vanished when the process ended. An organization that cannot say what it discussed
   * yesterday has no deliberation record, only a habit of deliberating.
   */
  | { readonly kind: "discussion_anchor"; readonly anchor: DiscussionAnchor }
  /** One turn in a deliberation, with whatever artifacts the speaker pointed at. */
  | { readonly kind: "anchor_post"; readonly post: AnchorPost }
  /** The artifact a `decision` anchor owes. Its rationale is what makes the choice revisitable. */
  | { readonly kind: "decision_record"; readonly record: DecisionRecord }
  /** An anchor reaching a terminal state — resolved or abandoned, and which. */
  | { readonly kind: "anchor_state"; readonly anchorId: string; readonly state: string }
  /**
   * An escalation, likewise — who escalated, what action, what effect.
   *
   * Same defect and the same consequence: `escalated → <action> (<effect>)` is readable by a human
   * and unusable by a fold. An escalation is the organization DECIDING something, and a decision
   * that survives as prose has to be re-parsed and re-interpreted by whoever needs to act on it.
   */
  | {
      readonly kind: "escalation";
      readonly taskId: string;
      readonly action: string;
      readonly effect: string;
      readonly byHatId: string;
      readonly trigger: string;
    }
  /**
   * One QA cycle: every run it made, the regressions it found, the defects it filed.
   *
   * ACCUMULATES across runs rather than replacing, which is the point of persisting it at all — a
   * regression is *passed before, fails now*, and a store that kept only the latest cycle could
   * never see the "before". This is the history that makes the distinction possible.
   */
  | { readonly kind: "qa_cycle"; readonly report: QaCycleReport }
  | {
      readonly kind: "meeting_planned";
      readonly meetingId: string;
      readonly blockIds: readonly string[];
      readonly attendeeHatIds: readonly string[];
      readonly startMs: number;
      readonly endMs: number;
      readonly workItemId?: string;
    };

export interface OrgEvent {
  readonly id: string;
  readonly kind: OrgEventKind;
  readonly atMs: number;
  /** The hat that acted — the authority the transition happened under. */
  readonly actorHatId?: string;
  readonly actorAgentId?: string;
  /** What transitioned: a work id, a binding id, a shard id. */
  readonly subjectId: string;
  readonly fromState?: string;
  readonly toState?: string;
  /** What happened, in a sentence. Human-readable, alongside the structure rather than instead of it. */
  readonly decision: string;
  /** Root → actor. Derived from the chart by `emit`; never supplied. */
  readonly supervisorChain: readonly string[];
  readonly evidenceRefs: readonly string[];
  /** The fact, when this event constitutes state. See `OrgFact`. */
  readonly fact?: OrgFact;
}

export interface EmitInput {
  readonly kind: OrgEventKind;
  readonly subjectId: string;
  readonly decision: string;
  readonly atMs: number;
  // `| undefined` explicitly, not just optional: under `exactOptionalPropertyTypes` those differ,
  // and a caller whose actor is legitimately optional would otherwise have to spread it in
  // conditionally at every site — ceremony that makes the common case harder to read than the rare
  // one.
  readonly actorHatId?: string | undefined;
  readonly actorAgentId?: string | undefined;
  readonly fromState?: string | undefined;
  readonly toState?: string | undefined;
  readonly evidenceRefs?: readonly string[] | undefined;
  readonly fact?: OrgFact | undefined;
}

/**
 * Build one event, with the supervisor chain computed from the chart.
 *
 * An actor that is not in the chart gets an EMPTY chain rather than a fabricated one. That makes the
 * event visibly unattributable instead of quietly attributing it to a line it never belonged to —
 * and `unattributed` below finds them, which a fabricated chain would hide forever.
 */
export function emit(chart: OrgChart, id: string, input: EmitInput): OrgEvent {
  return {
    id,
    kind: input.kind,
    atMs: input.atMs,
    ...(input.actorHatId === undefined ? {} : { actorHatId: input.actorHatId }),
    ...(input.actorAgentId === undefined ? {} : { actorAgentId: input.actorAgentId }),
    subjectId: input.subjectId,
    ...(input.fromState === undefined ? {} : { fromState: input.fromState }),
    ...(input.toState === undefined ? {} : { toState: input.toState }),
    decision: input.decision,
    supervisorChain:
      input.actorHatId === undefined ? [] : [...supervisorChainOf(chart, input.actorHatId)].reverse(),
    evidenceRefs: input.evidenceRefs ?? [],
    ...(input.fact === undefined ? {} : { fact: input.fact }),
  };
}

/** One line, for a human. The structure is the record; this is the rendering. */
export function render(event: OrgEvent): string {
  const who = event.actorAgentId ?? event.actorHatId;
  // Only render an arrow when there is a FROM to point away from. A transition with no prior state
  // is an arrival, and `[? → open]` reads like a lost value rather than a first appearance.
  const transition =
    event.fromState !== undefined && event.toState !== undefined
      ? ` [${event.fromState} → ${event.toState}]`
      : event.toState !== undefined
        ? ` [${event.toState}]`
        : "";
  return `${who === undefined ? "" : `${who}: `}${event.decision}${transition}`;
}

// ─── Queries — the reason the trace is typed ────────────────────────────────

/** Every event about one subject, in order. */
export function eventsFor(events: readonly OrgEvent[], subjectId: string): readonly OrgEvent[] {
  return events.filter((e) => e.subjectId === subjectId);
}

/** Every event a specific hat produced. */
export function decidedBy(events: readonly OrgEvent[], hatId: string): readonly OrgEvent[] {
  return events.filter((e) => e.actorHatId === hatId);
}

/**
 * Every event decided ANYWHERE INSIDE a hat's line of authority.
 *
 * The query the supervisor chain exists for. "What did the CTO's organization decide" needs no list
 * of who reports to the CTO — the chain on each event already carries it, so the answer stays right
 * when the org chart changes.
 */
export function decidedUnder(events: readonly OrgEvent[], hatId: string): readonly OrgEvent[] {
  return events.filter((e) => e.supervisorChain.includes(hatId));
}

export function ofKind(events: readonly OrgEvent[], kind: OrgEventKind): readonly OrgEvent[] {
  return events.filter((e) => e.kind === kind);
}

/**
 * Events by an actor the chart does not know, or with no actor at all.
 *
 * An organization that cannot say under whose authority something happened has a hole in its audit,
 * and this is what finds it. Refusals legitimately have no actor and are excluded — nobody decided
 * a refusal.
 */
export function unattributed(events: readonly OrgEvent[]): readonly OrgEvent[] {
  return events.filter(
    (e) => e.kind !== OrgEventKind.Refusal && e.actorHatId !== undefined && e.supervisorChain.length === 0,
  );
}

/** How many events each kind produced — the shape of a run at a glance. */
export function countByKind(events: readonly OrgEvent[]): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const e of events) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}

/**
 * The levels that acted, senior first, derived from the chains rather than from a separate tally.
 *
 * `runOrgRuntime` also tracks engaged levels while it runs. Deriving them again HERE, from the
 * trace, is what makes the two checkable against each other — a tally kept alongside the work can
 * drift from the work, and only a second derivation notices.
 */
export function actorsIn(events: readonly OrgEvent[]): readonly string[] {
  return [...new Set(events.map((e) => e.actorHatId).filter((h): h is string => h !== undefined))].sort();
}
