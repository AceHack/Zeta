/**
 * corporate/org-fold.ts — the organization rebuilt from its own event log.
 *
 * ── THE HOLE THIS CLOSES ─────────────────────────────────────────────────────
 * `org-store.ts` made the trace durable and said plainly what it did not do: *"a full `Cascade`
 * fold from events is NOT implemented here … a durable, queryable, mergeable history — not yet a
 * resumable runtime."* The agent loop resumed; the organization did not. Its cascade and calendar
 * were recomputed from the inputs each time, which works only because the runtime is deterministic
 * and stops working the moment anything about a run is not reproducible from its arguments.
 *
 * ── WHY THIS NEEDED A CHANGE TO THE EVENTS FIRST ─────────────────────────────
 * The trace could not support this as it stood. `decision` is prose — *"owns defect 'implement the
 * coupon fix'"* — with the work type inside the sentence and the parent not in it at all, so
 * folding would have meant parsing English. `OrgEvent` was built as an AUDIT TRAIL: it answers what
 * happened, who decided, and under what authority. It could not answer what IS.
 *
 * So state-constituting events now carry an `OrgFact` beside the sentence. The prose stays the
 * reading; the fact is the record. That is the difference between a log you can read and a log you
 * can rebuild from.
 *
 * ── THE FALSIFIER ────────────────────────────────────────────────────────────
 * A fold is only trustworthy if it reproduces what it folded. `org-fold.test.ts` runs the real
 * runtime, folds ITS OWN trace, and asserts the result equals the runtime's cascade and calendar
 * node for node. If the log is missing a fact, that test fails — which is the point: it makes
 * "the log is sufficient" a checkable claim rather than a hopeful one.
 *
 * ── ORDER IS THE LOG'S, NOT THE READER'S ─────────────────────────────────────
 * Events are folded in the order they happened (`atMs`, then id), never in file order. A fold that
 * depended on how the shards happened to be listed would give different state on different
 * machines from identical data.
 */

import type { Cascade, CascadeNode } from "./goal-cascade";
import { ScheduleBlockState, ScheduleBlockType, type Calendar, type ScheduleBlock } from "./work-schedule";
import type { OrgEvent } from "./org-event";
import type { PriorityDecision } from "./prioritization";
import type { GateEvaluation } from "./quality-gate";
import type { Portfolio, PortfolioBook } from "./portfolio";
import type { WorkQueue } from "./work-market";
import type { QaCycleReport } from "./qa";
import type { FidelityReport, RunFidelity } from "./providers";
import type { ObserveActTick } from "./observe-act-window";
import type { SupervisorSignal } from "./supervisor-signal";
import type { AnchorBoard, AnchorPost, DecisionRecord, DiscussionAnchor } from "./discussion-anchor";

/** The events that constitute state, in the order they happened. */
export function factEvents(events: readonly OrgEvent[]): readonly OrgEvent[] {
  return [...events]
    .filter((e) => e.fact !== undefined)
    .sort((a, b) => {
      if (a.atMs !== b.atMs) return a.atMs - b.atMs;
      return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
    });
}

/**
 * Rebuild the cascade.
 *
 * A creation for a work id already present is IGNORED rather than applied twice — the same event
 * arriving from two branches must not duplicate a node, and re-folding a log has to be idempotent
 * or a merge would multiply the organization.
 *
 * An assignment or state change for a work id that was never created is likewise ignored: a log
 * missing its own creation event is incomplete, and inventing a node to hang the change on would
 * manufacture work nobody planned. `foldRefusals` reports these rather than swallowing them.
 */
export function foldCascade(events: readonly OrgEvent[]): Cascade {
  const byId = new Map<string, CascadeNode>();
  for (const event of factEvents(events)) {
    const fact = event.fact;
    if (fact === undefined) continue;
    switch (fact.kind) {
      case "work_created": {
        if (byId.has(fact.workId)) break;
        byId.set(fact.workId, {
          workId: fact.workId,
          workType: fact.workType,
          title: fact.title,
          state: "open",
          ownerHatId: fact.ownerHatId,
          ...(fact.parentWorkId === undefined ? {} : { parentWorkId: fact.parentWorkId }),
        } as CascadeNode);
        break;
      }
      case "work_assigned": {
        const node = byId.get(fact.workId);
        if (node === undefined) break;
        byId.set(fact.workId, { ...node, assigneeHatId: fact.assigneeHatId });
        break;
      }
      case "work_state": {
        const node = byId.get(fact.workId);
        if (node === undefined) break;
        byId.set(fact.workId, { ...node, state: fact.state });
        break;
      }
      default:
        break;
    }
  }
  return { nodes: [...byId.values()] };
}

/** Rebuild the calendar. Same idempotence: a block seen twice is one block. */
export function foldCalendar(events: readonly OrgEvent[]): Calendar {
  const byId = new Map<string, ScheduleBlock>();
  for (const event of factEvents(events)) {
    const fact = event.fact;
    if (fact === undefined) continue;
    switch (fact.kind) {
      case "block_planned": {
        if (byId.has(fact.blockId)) break;
        byId.set(fact.blockId, {
          blockId: fact.blockId,
          hatId: fact.hatId,
          blockType: fact.blockType,
          startMs: fact.startMs,
          endMs: fact.endMs,
          state: ScheduleBlockState.Scheduled,
          ...(fact.workItemId === undefined ? {} : { workItemId: fact.workItemId }),
          ...(fact.meetingId === undefined ? {} : { meetingId: fact.meetingId }),
        } as ScheduleBlock);
        break;
      }
      case "meeting_planned": {
        // One fact, N legs — one block per attendee, all sharing the meeting id. Zipped by
        // position, which is how `scheduleMeeting` pairs them.
        fact.attendeeHatIds.forEach((hatId, i) => {
          const blockId = fact.blockIds[i];
          if (blockId === undefined || byId.has(blockId)) return;
          byId.set(blockId, {
            blockId,
            hatId,
            blockType: ScheduleBlockType.Meeting,
            startMs: fact.startMs,
            endMs: fact.endMs,
            state: ScheduleBlockState.Scheduled,
            meetingId: fact.meetingId,
            ...(fact.workItemId === undefined ? {} : { workItemId: fact.workItemId }),
          } as ScheduleBlock);
        });
        break;
      }
      case "block_state": {
        const block = byId.get(fact.blockId);
        if (block === undefined) break;
        byId.set(fact.blockId, { ...block, state: fact.state });
        break;
      }
      default:
        break;
    }
  }
  return { blocks: [...byId.values()] };
}

/**
 * What the log could NOT account for.
 *
 * A change referring to work the log never created is the shape of an incomplete history — a
 * truncated store, a partial sync, a fact somebody forgot to attach at a new emit site. Reported
 * rather than swallowed, because a fold that silently drops what it cannot place produces a
 * plausible smaller organization and no sign that anything is missing.
 */
export function foldRefusals(events: readonly OrgEvent[]): readonly string[] {
  const known = new Set<string>();
  const blocks = new Set<string>();
  const openedPortfolios = new Set<string>();
  const out: string[] = [];
  for (const event of factEvents(events)) {
    const fact = event.fact;
    if (fact === undefined) continue;
    switch (fact.kind) {
      case "work_created":
        known.add(fact.workId);
        break;
      case "block_planned":
        blocks.add(fact.blockId);
        break;
      case "meeting_planned":
        for (const id of fact.blockIds) blocks.add(id);
        break;
      case "work_assigned":
      case "work_state":
        if (!known.has(fact.workId)) out.push(`${fact.kind} for unknown work '${fact.workId}'`);
        break;
      case "block_state":
        if (!blocks.has(fact.blockId)) out.push(`block_state for unknown block '${fact.blockId}'`);
        break;
      case "portfolio_opened":
        openedPortfolios.add(fact.portfolioId);
        break;
      case "goal_associated":
        if (!openedPortfolios.has(fact.portfolioId)) {
          out.push(`goal_associated with unknown portfolio '${fact.portfolioId}'`);
        }
        break;
      case "queue_snapshot":
        // A shard is work the organization committed to, so a queue holding shards for work the log
        // never created is an accounting hole — the resumed run would offer items nothing explains.
        for (const shard of fact.queue.shards) {
          if (!known.has(shard.workId)) out.push(`queue '${fact.queue.queueId}' holds a shard for unknown work '${shard.workId}'`);
        }
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * Every work MARKET the log has seen, latest snapshot per queue.
 *
 * LAST IN THE LOG wins, not the highest revision: a later run may open a fresh queue under the same
 * id, whose revision restarts at 0, and a max-revision fold would resurrect the abandoned one.
 */
export function foldQueues(events: readonly OrgEvent[]): readonly WorkQueue[] {
  const latest = new Map<string, WorkQueue>();
  for (const event of factEvents(events)) {
    if (event.fact?.kind === "queue_snapshot") latest.set(event.fact.queue.queueId, event.fact.queue);
  }
  return [...latest.values()];
}

/**
 * The QA history, in the order it happened.
 *
 * ACCUMULATES rather than replacing. A regression is *this case passed before and fails now*, so a
 * fold that kept only the latest cycle would destroy the evidence for every regression it could
 * ever report — the history IS the mechanism, not a record of it.
 */
export function foldQaCycles(events: readonly OrgEvent[]): readonly QaCycleReport[] {
  const out: QaCycleReport[] = [];
  for (const event of factEvents(events)) {
    if (event.fact?.kind === "qa_cycle") out.push(event.fact.report);
  }
  return out;
}

/**
 * What every run in this log could actually do, in the order the runs happened.
 *
 * PLURAL, and never reduced to one verdict. A store spans runs, and a history of nine simulated
 * runs plus one real one is not "real" — nor is it "simulated". Collapsing them would manufacture a
 * single version of the truth out of ten separate facts, which is exactly what the raw vault
 * forbids: a single version of the FACTS, never a single version of the TRUTH.
 *
 * A caller that wants a verdict computes one and owns it. `everyRunWasSimulated` is offered because
 * it is the one question with an unambiguous answer, and it is deliberately the CONSERVATIVE
 * direction: an empty log is not "all simulated", because nothing was observed.
 */
export function foldRunFidelity(events: readonly OrgEvent[]): readonly RunFidelity[] {
  const out: RunFidelity[] = [];
  for (const event of factEvents(events)) {
    if (event.fact?.kind === "run_fidelity") out.push(event.fact.report);
  }
  return out;
}

/**
 * Rebuild the DELIBERATION BOARD from the log — what was discussed, and what it produced.
 *
 * The same fold shape as `foldCascade`: state is a replay of the facts, so a second process can
 * read the whole deliberation without having been present for it. Before these facts existed the
 * board lived only in the report a run returned, which meant the organization's record of WHY it
 * decided something ended with the process that decided it.
 *
 * ANCHOR STATE IS LAST-WINS, and posts and decisions are APPEND-ONLY. That asymmetry is the
 * deliberation's actual shape: an anchor opens and later resolves, so the newest state is the true
 * one; a post or a decision is a thing that was said, and a later one never unsays an earlier one.
 * Collapsing posts the way state collapses would turn a conversation into its last message.
 */
export function foldBoard(events: readonly OrgEvent[]): AnchorBoard {
  const anchors = new Map<string, DiscussionAnchor>();
  const posts: AnchorPost[] = [];
  const decisions: DecisionRecord[] = [];
  for (const event of factEvents(events)) {
    const fact = event.fact;
    if (fact === undefined) continue;
    if (fact.kind === "discussion_anchor") {
      // First writer wins for the anchor's own identity: re-folding a log must not duplicate an
      // anchor, and a later `anchor_state` is what changes it.
      if (!anchors.has(fact.anchor.anchorId)) anchors.set(fact.anchor.anchorId, fact.anchor);
    } else if (fact.kind === "anchor_post") {
      posts.push(fact.post);
    } else if (fact.kind === "decision_record") {
      decisions.push(fact.record);
    } else if (fact.kind === "anchor_state") {
      const existing = anchors.get(fact.anchorId);
      // A state change for an anchor the log never opened is IGNORED rather than invented. A
      // fabricated anchor would carry no purpose and no expected output, so it would resolve
      // vacuously — the fold would manufacture a deliberation nobody had.
      if (existing !== undefined) {
        anchors.set(fact.anchorId, { ...existing, state: fact.state as DiscussionAnchor["state"] });
      }
    }
  }
  return { anchors: [...anchors.values()], posts, decisions };
}

/** Everything said on one anchor, oldest first — a conversation, read back off the log. */
export function conversationOn(
  events: readonly OrgEvent[],
  anchorId: string,
): readonly AnchorPost[] {
  return foldBoard(events)
    .posts.filter((p) => p.anchorId === anchorId)
    .sort((a, b) => a.atMs - b.atMs || (a.postId < b.postId ? -1 : a.postId > b.postId ? 1 : 0));
}

/**
 * Every upward signal the log recorded — the organization's upward channel, folded.
 *
 * This is what makes the channel work ACROSS PROCESSES without a message bus. A signal is emitted
 * as a fact into the same content-addressed, append-only store everything else uses, so a second
 * process reads the routed, evidenced signal by folding the log — the substrate corporate already
 * has, rather than a second one beside it.
 *
 * PLURAL and unreduced, like `foldRunFidelity`: two signals asking the same hat for the same thing
 * are two askings, and collapsing them would lose the fact that it had to be asked twice.
 */
export function foldSupervisorSignals(events: readonly OrgEvent[]): readonly SupervisorSignal[] {
  const out: SupervisorSignal[] = [];
  for (const event of factEvents(events)) {
    if (event.fact?.kind === "supervisor_signal") out.push(event.fact.signal);
  }
  return out;
}

/** Signals addressed to one hat — the question "what is waiting for me?", answerable from disk. */
export function signalsTo(events: readonly OrgEvent[], hatId: string): readonly SupervisorSignal[] {
  return foldSupervisorSignals(events).filter((s) => s.toHatId === hatId);
}

/**
 * Every escalation the log recorded, as decisions rather than as sentences.
 *
 * Kept separate from the signals fold because they answer different questions: a signal is a hat
 * ASKING, an escalation is the organization DECIDING. A caller wanting to know what was decided
 * should not have to filter a list of requests to find out.
 */
export function foldEscalations(
  events: readonly OrgEvent[],
): readonly {
  readonly taskId: string;
  readonly action: string;
  readonly effect: string;
  readonly byHatId: string;
  readonly trigger: string;
}[] {
  const out: {
    taskId: string;
    action: string;
    effect: string;
    byHatId: string;
    trigger: string;
  }[] = [];
  for (const event of factEvents(events)) {
    if (event.fact?.kind === "escalation") {
      const f = event.fact;
      out.push({
        taskId: f.taskId,
        action: f.action,
        effect: f.effect,
        byHatId: f.byHatId,
        trigger: f.trigger,
      });
    }
  }
  return out;
}

/**
 * Every observe-act tick the log recorded.
 *
 * PLURAL and unreduced, exactly like `foldRunFidelity` — the window is computed by
 * `foldObserveActWindow`, which is where the time bounds and the divergence rule live. Splitting
 * the read from the judgement means a caller can inspect the raw ticks without going through the
 * gate's opinion of them.
 */
export function foldObserveActTicks(events: readonly OrgEvent[]): readonly ObserveActTick[] {
  const out: ObserveActTick[] = [];
  for (const event of factEvents(events)) {
    if (event.fact?.kind === "observe_act_tick") out.push(event.fact.tick);
  }
  return out;
}

/**
 * True only when the log records at least one run and EVERY recorded run was simulated.
 *
 * An empty log answers `false`: nothing was observed, and "no evidence of reality" is not "evidence
 * of simulation". A log with runs predating this fact also answers `false`, for the same reason —
 * see `deliveryRate`, which reports those as unknown rather than assuming either way.
 */
export function everyRunWasSimulated(reports: readonly FidelityReport[]): boolean {
  return reports.length > 0 && reports.every((r) => r.replayable);
}

/**
 * The priorities the organization decided, latest per work item.
 *
 * LATEST wins: a re-prioritization is the organization changing its mind, and keeping the first
 * would make the fold report a decision that has been superseded.
 */
export function foldPriorities(events: readonly OrgEvent[]): readonly PriorityDecision[] {
  const byWork = new Map<string, PriorityDecision>();
  for (const event of factEvents(events)) {
    if (event.fact?.kind !== "priority_decided") continue;
    const f = event.fact;
    byWork.set(f.workId, {
      workId: f.workId,
      priorityClass: f.priorityClass,
      decidedByHatId: f.decidedByHatId,
      reason: f.reason,
      recommended: f.recommended,
      reasonCodes: [...f.reasonCodes],
    });
  }
  return [...byWork.values()];
}

/**
 * Every gate verdict, in order.
 *
 * ALL of them, not the latest per gate: the churn signal is the COUNT of rejections, so collapsing
 * to the newest verdict per gate would erase exactly the history that makes churn visible.
 */
export function foldGateEvaluations(events: readonly OrgEvent[]): readonly GateEvaluation[] {
  const out: GateEvaluation[] = [];
  const seen = new Set<string>();
  for (const event of factEvents(events)) {
    if (event.fact?.kind !== "gates_evaluated") continue;
    for (const e of event.fact.evaluations) {
      // Keyed so a duplicated event does not double-count churn — the same verdict twice is one
      // verdict, and a merge must not manufacture a rejection.
      const key = `${e.workId}|${e.gate}|${e.outcome}|${e.byHatId}|${String(e.atMs)}|${e.reason}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
  }
  return out;
}

/**
 * The portfolio book, from the log.
 *
 * This is why the association is a FACT and not a value passed around: a portfolio accumulates
 * goals ACROSS RUNS, and only a folded log can carry that. Recomputing it per invocation would give
 * every run a portfolio with exactly one goal in it, which is the same as not having one.
 *
 * A goal associated with a portfolio the log never opened is skipped and reported by
 * `foldRefusals` — the same rule as work: never invent the container to hang the association on.
 */
export function foldPortfolioBook(events: readonly OrgEvent[]): PortfolioBook {
  const portfolios = new Map<string, Portfolio>();
  const goalOf: Record<string, string> = {};
  for (const event of factEvents(events)) {
    const fact = event.fact;
    if (fact === undefined) continue;
    if (fact.kind === "portfolio_opened") {
      if (portfolios.has(fact.portfolioId)) continue;
      portfolios.set(fact.portfolioId, {
        portfolioId: fact.portfolioId,
        title: fact.title,
        kind: fact.portfolioKind,
        ownerHatId: fact.ownerHatId,
      });
    } else if (fact.kind === "goal_associated") {
      if (!portfolios.has(fact.portfolioId)) continue;
      // Last association wins: a goal moving between products is a re-org, and the newest word is
      // the current one.
      goalOf[fact.goalId] = fact.portfolioId;
    }
  }
  return { portfolios: [...portfolios.values()], goalOf };
}

export interface FoldedOrganization {
  readonly cascade: Cascade;
  readonly calendar: Calendar;
  readonly priorities: readonly PriorityDecision[];
  readonly gateEvaluations: readonly GateEvaluation[];
  readonly portfolios: PortfolioBook;
  /** The work markets, one per queue — shards, claims and approvals, not an empty queue. */
  readonly queues: readonly WorkQueue[];
  /** Every QA cycle in order, so a resumed run can still tell a regression from a new failure. */
  readonly qa: readonly QaCycleReport[];
  /**
   * What each run in this log could actually do, in run order.
   *
   * Without it a resumed organization cannot tell inherited REAL work from inherited simulated work
   * — the two stores are otherwise byte-identical.
   */
  readonly fidelities: readonly RunFidelity[];
  /** Empty when the log accounted for everything it referred to. */
  readonly refusals: readonly string[];
  /** How many events carried a fact. Zero means the log holds no state, only commentary. */
  readonly factCount: number;
}

/**
 * The whole organization, from the log alone.
 *
 * An EMPTY log folds to an empty organization rather than throwing: a store nobody has written to
 * is a normal state, and it is distinguishable from a broken one by `factCount` being zero while
 * `refusals` is empty.
 */
export function foldOrganization(events: readonly OrgEvent[]): FoldedOrganization {
  // No special case for an empty log: every fold below already returns empty for empty input, so a
  // guard here would be a branch that reads as a guard and computes the same answer.
  return {
    cascade: foldCascade(events),
    calendar: foldCalendar(events),
    priorities: foldPriorities(events),
    gateEvaluations: foldGateEvaluations(events),
    portfolios: foldPortfolioBook(events),
    queues: foldQueues(events),
    qa: foldQaCycles(events),
    fidelities: foldRunFidelity(events),
    refusals: foldRefusals(events),
    factCount: factEvents(events).length,
  };
}
