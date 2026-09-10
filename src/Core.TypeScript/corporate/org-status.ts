/**
 * corporate/org-status.ts — how the organization is doing right now.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * A function-level import audit found **67 of 146 functions in `corporate/` reached by any non-test
 * module**. Most of the rest were PREDICATES and READOUTS — `isBusy`, `regressionsIn`,
 * `whitewashThreshold`, `claimIsStale`, `gateProgress` — correct, tested, and asked by nobody.
 *
 * A predicate with no caller is a question the organization cannot answer about itself. This module
 * is the thing that asks them, and every field below is one an operator would actually want:
 * schedule reliability, QA health, gate progress, queue health, churn, deliberation debt, and the
 * organization's own whitewashing exposure.
 *
 * It is a READ. Nothing here changes state — `org-admin.ts` is where an operator acts.
 */

import { chainFor } from "./gate-demand";
import type { WorkType } from "./goal-cascade";
import {
  anchorById,
  decisionsOn,
  openAnchorsFor,
  postsOn,
  producedItsOutput,
  type AnchorBoard,
} from "./discussion-anchor";
import {
  bounceBackCount,
  churnGate,
  DEFAULT_CHURN_THRESHOLD,
  detectChurn,
  escalationEffect,
  type EscalationAction,
} from "./escalation";
import {
  cascadeChainOf,
  childrenOf,
  isDelivered,
  nextRung,
  nodeById,
  rungFor,
  WorkState,
  type Cascade,
} from "./goal-cascade";
import { isAuthorizing, type HatBinding } from "./hat-binding";
import { permittedActions, type ActionClass } from "./hat-guardrails";
import {
  actorsIn,
  countByKind,
  decidedBy,
  decidedUnder,
  eventsFor,
  ofKind,
  OrgEventKind,
  unattributed,
  type OrgEvent,
} from "./org-event";
import { directReportsOf, LEVELS_SENIOR_FIRST, outranks, type HatLevel, type OrgChart } from "./org-chart";
import {
  outranksPriority,
  priorityRank,
  wasOverridden,
  type PriorityDecision,
} from "./prioritization";
import {
  failedFeatures,
  isFailing,
  regressionsIn,
  untestedCases,
  type TestCase,
  type TestRun,
} from "./qa";
import {
  mayEvaluate,
  nextLegalGate,
  ORDERED_GATES,
  recoveryPathFor,
  type GateEvaluation,
  type GateKind,
  type RecoveryPath,
} from "./quality-gate";
import {
  DEFAULT_PRIOR,
  UNIFORM_PRIOR,
  explorationBonus,
  summarize,
  whitewashThreshold,
  whitewashingPays,
  OutcomeClass,
  type BetaPrior,
  type ReputationObservation,
} from "./reputation";
import {
  approvalCount,
  claimById,
  claimIsStale,
  hasQuorum,
  readyShards,
  shardById,
  ShardState,
  type WorkQueue,
} from "./work-market";
import {
  blocksFor,
  conflictsFor,
  intervalsOverlap,
  isBusy,
  markMissed,
  meetingLegs,
  occupies,
  ScheduleBlockState,
  ScheduleBlockType,
  type Calendar,
} from "./work-schedule";

// ─── Schedule ───────────────────────────────────────────────────────────────

export interface ScheduleHealth {
  readonly hatId: string;
  readonly busyNow: boolean;
  readonly doingNow?: ScheduleBlockType;
  readonly booked: number;
  readonly missed: number;
  /**
   * Blocks kept once their window passed — `scheduled` and never started.
   *
   * `markMissed` is what turns a schedule from a record of INTENT into a record of what the
   * organization actually did, and until this readout nothing called it. A schedule nobody reconciles
   * reports 100% adherence forever.
   */
  readonly reliability: number;
  /** Meetings this hat is party to that overlap something else it is booked for. */
  readonly doubleBookedMeetings: number;
}

export function scheduleHealth(calendar: Calendar, hatId: string, nowMs: number): ScheduleHealth {
  const reconciled = markMissed(calendar, nowMs);
  const mine = blocksFor(reconciled, hatId);
  const missed = mine.filter((b) => b.state === ScheduleBlockState.Missed).length;
  const past = mine.filter((b) => b.endMs <= nowMs).length;
  const current = mine.find((b) => occupies(b.state) && b.startMs <= nowMs && nowMs < b.endMs);

  // A meeting leg that overlaps other work on the same calendar. `scheduleBlock` refuses to CREATE
  // one, so this can only appear in a calendar assembled some other way — which is exactly why it
  // is worth reporting rather than assuming away.
  let doubleBooked = 0;
  for (const leg of mine.filter((b) => b.blockType === ScheduleBlockType.Meeting)) {
    const others = mine.filter(
      (b) => b.blockId !== leg.blockId && occupies(b.state) && intervalsOverlap(b.startMs, b.endMs, leg.startMs, leg.endMs),
    );
    if (others.length > 0) doubleBooked += 1;
  }

  return {
    hatId,
    busyNow: isBusy(reconciled, hatId, nowMs),
    ...(current === undefined ? {} : { doingNow: current.blockType }),
    booked: mine.length,
    missed,
    reliability: past === 0 ? 1 : (past - missed) / past,
    doubleBookedMeetings: doubleBooked,
  };
}

/** Everyone attending a meeting, and whether any of them has a conflict at that time. */
export function meetingHealth(
  calendar: Calendar,
  meetingId: string,
): { readonly attendees: readonly string[]; readonly conflicted: readonly string[] } {
  const legs = meetingLegs(calendar, meetingId);
  const conflicted = legs
    .filter((leg) => conflictsFor(calendar, leg.hatId, leg.startMs, leg.endMs).length > 1)
    .map((leg) => leg.hatId);
  return { attendees: legs.map((l) => l.hatId), conflicted };
}

// ─── QA ─────────────────────────────────────────────────────────────────────

export interface QaHealth {
  readonly regressions: number;
  /** Built, never worked. */
  readonly failedFeatures: number;
  /** Covered on paper, never run — the third state, and the one a pass rate hides. */
  readonly untested: number;
  readonly passRate: number;
  readonly totalRuns: number;
}

export function qaHealth(cases: readonly TestCase[], history: readonly TestRun[]): QaHealth {
  const failing = history.filter((r) => isFailing(r.outcome)).length;
  return {
    regressions: regressionsIn(history).length,
    failedFeatures: failedFeatures(cases, history).length,
    untested: untestedCases(cases, history).length,
    passRate: history.length === 0 ? 0 : (history.length - failing) / history.length,
    totalRuns: history.length,
  };
}

// ─── Gates ──────────────────────────────────────────────────────────────────

export interface GateHealth {
  readonly workId: string;
  readonly progress: number;
  readonly merged: boolean;
  readonly nextGate?: GateKind;
  /** Where it goes if the next gate rejects it. */
  readonly recoveryIfRejected?: RecoveryPath;
  /** Evaluations recorded by a hat that does not hold the scope. */
  readonly unauthorizedEvaluations: number;
}

/**
 * How one work item is doing against THE GATES IT OWES.
 *
 * `workType` is optional only so existing callers keep compiling; supply it. Without it this
 * reports against every canonical gate, and once each type walks its own chain that answer is
 * actively misleading — a task three gates from done was reported as next-needing
 * `business_context_grooming`, a gate its type does not owe and no hat will ever run for it.
 */
export function gateHealth(
  chart: OrgChart,
  workId: string,
  evaluations: readonly GateEvaluation[],
  workType?: WorkType,
): GateHealth {
  const mine = evaluations.filter((e) => e.workId === workId);
  const passed = new Set(mine.filter((e) => e.outcome === "approved" || e.outcome === "waived").map((e) => e.gate));
  const owed = workType === undefined ? ORDERED_GATES : chainFor(workType);
  const next = nextLegalGate(passed, owed);
  return {
    workId,
    progress: owed.length === 0 ? 0 : owed.filter((g: GateKind) => passed.has(g)).length / owed.length,
    merged: owed.length > 0 && owed.every((g: GateKind) => passed.has(g)),
    ...(next === undefined ? {} : { nextGate: next, recoveryIfRejected: recoveryPathFor(next) }),
    // A verdict from a hat without the scope should be impossible — `evaluateGate` refuses it. This
    // counts them anyway, because an audit that trusts the writer cannot detect a bad writer.
    unauthorizedEvaluations: mine.filter((e) => !mayEvaluate(chart, e.byHatId, e.gate)).length,
  };
}

// ─── Work market ────────────────────────────────────────────────────────────

export interface QueueHealth {
  readonly ready: number;
  readonly inFlight: number;
  readonly staleClaims: readonly string[];
  /** Completed, short of quorum — the review backlog with names. */
  readonly awaitingReview: readonly { readonly shardId: string; readonly approvals: number; readonly needed: number }[];
  readonly merged: number;
}

export function queueHealth(queue: WorkQueue, nowMs: number): QueueHealth {
  const stale = queue.claims
    .filter((c) => claimIsStale(queue, c, nowMs))
    .map((c) => c.claimId)
    .sort();
  const awaiting = queue.shards
    .filter((s) => s.state === ShardState.Completed && !hasQuorum(queue, s.shardId))
    .map((s) => ({ shardId: s.shardId, approvals: approvalCount(queue, s.shardId), needed: queue.quorumSize }));
  return {
    ready: readyShards(queue).length,
    inFlight: queue.shards.filter((s) => s.state === ShardState.Claimed).length,
    staleClaims: stale,
    awaitingReview: awaiting,
    merged: queue.shards.filter((s) => s.state === ShardState.Merged).length,
  };
}

/** Who is holding a shard, and are they still alive on it? */
export function shardHolder(
  queue: WorkQueue,
  shardId: string,
  nowMs: number,
): { readonly agentId: string; readonly stale: boolean } | undefined {
  const shard = shardById(queue, shardId);
  if (shard?.claimedByClaimId === undefined) return undefined;
  const claim = claimById(queue, shard.claimedByClaimId);
  if (claim === undefined) return undefined;
  return { agentId: claim.ownerAgentId, stale: claimIsStale(queue, claim, nowMs) };
}

// ─── Churn ──────────────────────────────────────────────────────────────────

export interface ChurnHealth {
  readonly workId: string;
  readonly bounceBacks: number;
  readonly churning: boolean;
  /** The gate it keeps failing, when there is one. */
  readonly stuckAt?: GateKind;
}

export function churnHealth(
  workId: string,
  evaluations: readonly GateEvaluation[],
  threshold: number = DEFAULT_CHURN_THRESHOLD,
): ChurnHealth {
  const gate = churnGate(workId, evaluations);
  return {
    workId,
    bounceBacks: bounceBackCount(workId, evaluations),
    churning: detectChurn(workId, evaluations, threshold),
    ...(gate === undefined ? {} : { stuckAt: gate }),
  };
}

/** What an escalation would DO — the operator's preview before choosing one. */
export function escalationPreview(
  actions: readonly EscalationAction[],
): readonly { readonly action: EscalationAction; readonly effect: string }[] {
  return actions.map((action) => ({ action, effect: escalationEffect(action) }));
}

// ─── Deliberation ───────────────────────────────────────────────────────────

export interface DeliberationDebt {
  readonly hatId: string;
  readonly openAnchors: number;
  /** Open anchors that have NOT yet produced what they owe — the real backlog. */
  readonly owing: readonly string[];
  readonly posts: number;
  readonly decisions: number;
}

export function deliberationDebt(board: AnchorBoard, hatId: string): DeliberationDebt {
  const open = openAnchorsFor(board, hatId);
  const owing = open.filter((a) => !producedItsOutput(board, a.anchorId)).map((a) => a.anchorId);
  return {
    hatId,
    openAnchors: open.length,
    owing,
    posts: open.reduce((n, a) => n + postsOn(board, a.anchorId).length, 0),
    decisions: open.reduce((n, a) => n + decisionsOn(board, a.anchorId).length, 0),
  };
}

/** Is this anchor closeable — does it already have what it owes? */
export function anchorIsCloseable(board: AnchorBoard, anchorId: string): boolean {
  return anchorById(board, anchorId) !== undefined && producedItsOutput(board, anchorId);
}

// ─── Reputation exposure ────────────────────────────────────────────────────

export interface ReputationExposure {
  /** The failure-to-success ratio beyond which re-minting an identity improves a rating. */
  readonly whitewashThreshold: number;
  /** Agents whose record is bad enough that starting over would pay. */
  readonly agentsWhoGainByRestarting: readonly string[];
  readonly rated: readonly { readonly agentId: string; readonly mean: number; readonly bonus: number }[];
}

/**
 * The reference implementation's prior, reported beside ours.
 *
 * `DEFAULT_PRIOR` is Beta(1,3) and the reference uses Beta(1,1). The difference is the whole
 * whitewashing argument — 3.0 versus 1.0 — so an operator comparing the two needs both numbers,
 * and stating only ours would hide that the choice was a choice.
 */
export const REFERENCE_WHITEWASH_THRESHOLD = whitewashThreshold(UNIFORM_PRIOR);

/**
 * The organization's own exposure to identity-restart.
 *
 * Reported rather than assumed away: no finite prior removes it, so a system that knows its number
 * is better off than one that believes it is immune.
 */
export function reputationExposure(
  observations: readonly ReputationObservation[],
  hatId: string,
  agentIds: readonly string[],
  nowMs: number,
  prior: BetaPrior = DEFAULT_PRIOR,
): ReputationExposure {
  const rated: { agentId: string; mean: number; bonus: number }[] = [];
  const gain: string[] = [];
  for (const agentId of agentIds) {
    const key = { agentId, hatId, outcomeClass: OutcomeClass.Quality };
    const s = summarize(observations, key, nowMs, prior);
    rated.push({ agentId, mean: s.mean, bonus: explorationBonus(s) });
    const mine = observations.filter(
      (o) => o.agentId === agentId && o.hatId === hatId && o.outcomeClass === OutcomeClass.Quality,
    );
    const successes = mine.filter((o) => o.success).length;
    const failures = mine.length - successes;
    if (whitewashingPays(successes, failures, prior)) gain.push(agentId);
  }
  return {
    whitewashThreshold: whitewashThreshold(prior),
    agentsWhoGainByRestarting: gain.sort(),
    rated: rated.sort((a, b) => b.mean - a.mean || (a.agentId < b.agentId ? -1 : 1)),
  };
}

// ─── Cascade and priority ───────────────────────────────────────────────────

export interface CascadeHealth {
  readonly workId: string;
  /** Owner hats from this rung up to the goal. */
  readonly accountableChain: readonly string[];
  readonly rung?: string;
  readonly nextRungDown?: string;
  readonly children: number;
  readonly delivered: boolean;
}

export function cascadeHealth(cascade: Cascade, workId: string): CascadeHealth | undefined {
  const node = nodeById(cascade, workId);
  if (node === undefined) return undefined;
  const rung = rungFor(node.workType);
  const below = nextRung(node.workType);
  return {
    workId,
    accountableChain: cascadeChainOf(cascade, workId),
    ...(rung === undefined ? {} : { rung: rung.ownerLevel }),
    ...(below === undefined ? {} : { nextRungDown: below.ownerLevel }),
    children: childrenOf(cascade, workId).length,
    delivered: isDelivered(cascade, workId),
  };
}

/** Open work, most urgent first, flagging where an authority overrode the score. */
export function priorityBoard(
  decisions: readonly PriorityDecision[],
): readonly { readonly workId: string; readonly rank: number; readonly overridden: boolean }[] {
  return [...decisions]
    .sort((a, b) => priorityRank(a.priorityClass) - priorityRank(b.priorityClass))
    .map((d) => ({ workId: d.workId, rank: priorityRank(d.priorityClass), overridden: wasOverridden(d) }));
}

/** Is the first decision more urgent than the second? */
export function moreUrgent(a: PriorityDecision, b: PriorityDecision): boolean {
  return outranksPriority(a.priorityClass, b.priorityClass);
}

// ─── The org chart itself ───────────────────────────────────────────────────

export interface ChartHealth {
  readonly levels: readonly { readonly level: HatLevel; readonly hats: number }[];
  /** Managers and above with nobody reporting to them — a rung with no team beneath it. */
  readonly childlessSupervisors: readonly string[];
  /** Hats actively worn right now. */
  readonly wornHats: readonly string[];
}

export function chartHealth(
  chart: OrgChart,
  bindings: readonly HatBinding[],
  nowMs: number,
): ChartHealth {
  const levels = LEVELS_SENIOR_FIRST.map((level) => ({
    level,
    hats: chart.hats.filter((h) => h.level === level).length,
  }));
  const childless = chart.hats
    .filter((h) => outranks(h.level, "individual_contributor") && directReportsOf(chart, h.id).length === 0)
    .map((h) => h.id)
    .sort();
  return {
    levels,
    childlessSupervisors: childless,
    wornHats: bindings.filter((b) => isAuthorizing(b, nowMs)).map((b) => b.hatId).sort(),
  };
}

// ─── The whole picture ──────────────────────────────────────────────────────

export interface OrgStatus {
  readonly chart: ChartHealth;
  readonly schedules: readonly ScheduleHealth[];
  readonly qa: QaHealth;
  readonly queue: QueueHealth;
  readonly gates: readonly GateHealth[];
  readonly churn: readonly ChurnHealth[];
  readonly deliberation: readonly DeliberationDebt[];
  readonly exposure: ReputationExposure;
  readonly priorities: readonly { readonly workId: string; readonly rank: number; readonly overridden: boolean }[];
  readonly goalDelivered: boolean;
}

export interface StatusInput {
  readonly chart: OrgChart;
  readonly cascade: Cascade;
  readonly bindings: readonly HatBinding[];
  readonly calendar: Calendar;
  readonly board: AnchorBoard;
  readonly queue: WorkQueue;
  readonly testCases: readonly TestCase[];
  readonly testRuns: readonly TestRun[];
  readonly gateEvaluations: readonly GateEvaluation[];
  readonly priorities: readonly PriorityDecision[];
  readonly observations: readonly ReputationObservation[];
  readonly agentIds: readonly string[];
  readonly goalWorkId?: string;
  readonly nowMs: number;
}

/** One call, the whole readout. */
export function orgStatus(input: StatusInput): OrgStatus {
  const workedHats = [...new Set(input.bindings.map((b) => b.hatId))].sort();
  const taskIds = input.cascade.nodes
    .filter((n) => n.state !== WorkState.Canceled && childrenOf(input.cascade, n.workId).length === 0)
    .map((n) => n.workId);
  const partyHats = [...new Set(input.board.anchors.flatMap((a) => a.participantHatIds))].sort();

  // Each item is judged against ITS OWN chain, so the type has to travel with the id. Absent, this
  // reported every task as owing all fourteen gates.
  const typeOf = (id: string): WorkType | undefined =>
    input.cascade.nodes.find((n) => n.workId === id)?.workType;

  return {
    chart: chartHealth(input.chart, input.bindings, input.nowMs),
    schedules: workedHats.map((h) => scheduleHealth(input.calendar, h, input.nowMs)),
    qa: qaHealth(input.testCases, input.testRuns),
    queue: queueHealth(input.queue, input.nowMs),
    gates: taskIds.map((id) =>
      gateHealth(input.chart, id, input.gateEvaluations, typeOf(id)),
    ),
    churn: taskIds.map((id) => churnHealth(id, input.gateEvaluations)),
    deliberation: partyHats.map((h) => deliberationDebt(input.board, h)),
    exposure: reputationExposure(
      input.observations,
      workedHats[0] ?? "",
      input.agentIds,
      input.nowMs,
    ),
    priorities: priorityBoard(input.priorities),
    goalDelivered: input.goalWorkId === undefined ? false : isDelivered(input.cascade, input.goalWorkId),
  };
}

// ─── The trace ──────────────────────────────────────────────────────────────

export interface TraceHealth {
  readonly total: number;
  readonly byKind: Readonly<Record<string, number>>;
  /**
   * Events whose actor the chart does not know.
   *
   * An organization that cannot say under whose authority something happened has a hole in its
   * audit. Reported first because a non-empty list invalidates every other number below it.
   */
  readonly unattributed: readonly string[];
  readonly actors: readonly string[];
  readonly gateVerdicts: number;
  readonly escalations: number;
}

export function traceHealth(trace: readonly OrgEvent[]): TraceHealth {
  return {
    total: trace.length,
    byKind: countByKind(trace),
    unattributed: unattributed(trace).map((e) => e.id),
    actors: actorsIn(trace),
    gateVerdicts: ofKind(trace, OrgEventKind.QualityGateEvaluation).length,
    escalations: ofKind(trace, OrgEventKind.EscalationDecision).length,
  };
}

/** Everything one line of authority decided, and how much of the whole run that was. */
export function lineActivity(
  trace: readonly OrgEvent[],
  hatId: string,
): { readonly own: number; readonly line: number; readonly share: number } {
  const line = decidedUnder(trace, hatId).length;
  const attributed = trace.filter((e) => e.actorHatId !== undefined).length;
  return {
    own: decidedBy(trace, hatId).length,
    line,
    share: attributed === 0 ? 0 : line / attributed,
  };
}

/** The full history of one work item — what happened to it, in order. */
export function historyOf(trace: readonly OrgEvent[], subjectId: string): readonly OrgEvent[] {
  return eventsFor(trace, subjectId);
}

/** What a hat may currently do, for its brief. */
export function authorityOf(chart: OrgChart, hatId: string): readonly ActionClass[] {
  return permittedActions(chart, hatId);
}
