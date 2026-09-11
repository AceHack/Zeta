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

import { isStudyKind } from "./org-life";
import { STUDY_BLOCK_TYPE } from "./study-session";
import type { PortMeter } from "./meter";
import type { Cascade, CascadeNode } from "./goal-cascade";
import type { RaisedBlocker } from "./human-blocker";
import { ScheduleBlockState, ScheduleBlockType, type Calendar, type ScheduleBlock } from "./work-schedule";
import type { ChangedFile, OrgEvent } from "./org-event";
import { checkKey, type CheckResult } from "./check-roster";
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
          // WITHOUT THIS THE SPINE IS RUNTIME-ONLY. The cascade holds the request in memory and the
          // log would not, so a resumed organization forgets what asked for its own work — which is
          // exactly the failure the field exists to end.
          ...(fact.requestRef === undefined ? {} : { requestRef: fact.requestRef }),
          ...(fact.dependsOn === undefined || fact.dependsOn.length === 0
            ? {}
            : { dependsOn: [...fact.dependsOn] }),
          ...(fact.brief === undefined ? {} : { brief: fact.brief }),
          // THE STATED CHAIN, or a resumed organization walks its defect's initiative through a BRD
          // the run that created it had decided it did not owe.
          ...(fact.owes === undefined ? {} : { owes: [...fact.owes] }),
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
      case "self_directed": {
        // FREE TIME IS BOOKED TIME. Without this the hour exists only as a fact, so the calendar
        // reports a studying hat as free — and `firstCommonFreeSlot` would book a meeting straight
        // over it while `idleHats` counted it idle. The block id is derived from the hat and the
        // start so re-folding a log is an upsert rather than a second booking.
        const blockId = `free-${fact.hatId}-${String(fact.startMs)}`;
        if (!byId.has(blockId)) {
          byId.set(blockId, {
            blockId,
            hatId: fact.hatId,
            // AND A STUDY HOUR IS RECOGNISABLE AS STUDY. The fact carries which kind of hour it
            // was; flattening every kind to `FreeTime` here is what made the study budget
            // unspendable — `isStudyBlock` tests for `Reflection`, so the fold answered "nothing
            // was ever studied" over a log full of study. Classified by the SAME predicate the
            // writer uses, so a replayed log and a live tick cannot disagree about an hour.
            blockType: isStudyKind(fact.selfDirectedKind) ? STUDY_BLOCK_TYPE : ScheduleBlockType.FreeTime,
            startMs: fact.startMs,
            endMs: fact.endMs,
            state: ScheduleBlockState.Scheduled,
            // The memory it owes, in the field that carries "what this block is against". A
            // free-time block whose key never gets written is then visible as a block that
            // produced nothing, which is the whole point of `producesKey`.
            //
            // NOT invented as a new field: the first draft wrote `subjectId`, which is not on
            // `ScheduleBlock` at all — and the `as ScheduleBlock` cast below silently accepted it,
            // so the value would have been carried on an object nothing could read it from.
            workItemId: fact.producesKey,
          } as ScheduleBlock);
        }
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
 * Every blocker the organization raised OUT to a person, from the log.
 *
 * Keyed by `blockerId` so replaying the log yields one blocker rather than a duplicate queue —
 * the same de-duplication `foldGateEvaluations` needs, and for the same reason: a merged branch
 * must not manufacture a second question for a person to answer.
 */
export function foldBlockers(events: readonly OrgEvent[]): readonly RaisedBlocker[] {
  const out: RaisedBlocker[] = [];
  const seen = new Set<string>();
  for (const event of factEvents(events)) {
    if (event.fact?.kind !== "blocker_raised") continue;
    const blocker = event.fact.blocker;
    if (seen.has(blocker.blockerId)) continue;
    seen.add(blocker.blockerId);
    out.push(blocker);
  }
  return out;
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

/** A metered crossing, with the dimensions worth slicing it by. */
export interface MeteredCall {
  readonly meter: PortMeter;
  readonly workId: string | undefined;
  readonly hatId: string | undefined;
  readonly gate: string | undefined;
  readonly atMs: number;
}

/** A document an agent wrote, that existed when the phase that wrote it finished. */
export interface WrittenDocument {
  readonly workId: string;
  readonly gate: string;
  readonly path: string;
  readonly bytes: number;
  readonly producedByHatId: string;
  readonly atMs: number;
}

/** A room as the log remembers it. */
export interface FoldedRoom {
  readonly roomId: string;
  readonly workId: string;
  readonly gate: string;
  readonly documentPath: string;
  readonly withHatId: string;
  readonly openedBy: string;
  readonly openedAtMs: number;
  readonly state: string;
  readonly turns: readonly {
    readonly turnId: string;
    readonly speakerKind: string;
    readonly speaker: string;
    readonly text: string;
    readonly atMs: number;
    readonly producedRevision: number | undefined;
  }[];
  readonly revisions: readonly {
    readonly revision: number;
    readonly byHatId: string;
    readonly text: string;
    readonly atMs: number;
  }[];
  readonly approvedRevision: number | undefined;
  readonly closedBy: string | undefined;
  readonly closedReason: string | undefined;
}

/** What the organization believes, as the log recorded it being written. */
export interface LearnedMemory {
  readonly memoryId: string;
  readonly tier: string;
  readonly scope: string;
  readonly key: string;
  readonly value: string;
  readonly writtenBy: string;
  readonly atMs: number;
  readonly phase: string;
  readonly outcome: string;
}

/** Where every hat was at one instant. */
export interface PresenceCensus {
  readonly atMs: number;
  readonly counts: Readonly<Record<string, number>>;
  readonly waking: readonly string[];
  readonly hats: readonly { readonly hatId: string; readonly presence: string; readonly because: string; readonly subject?: string }[];
}

/** A meeting as the log holds it: one thing that happened, and the legs it booked. */
export interface FoldedMeeting {
  readonly meetingId: string;
  readonly attendeeHatIds: readonly string[];
  readonly startMs: number;
  readonly endMs: number;
  readonly workItemId?: string;
  /** Absent for a meeting booked as part of walking an item rather than in answer to a condition. */
  readonly reason?: string;
  readonly about?: string;
  readonly mustProduce?: string;
  /**
   * Whether the meeting was actually HELD, and what came out.
   *
   * `held: false` is the normal state for a meeting still in the future, and for one nobody
   * facilitated. `produced: ""` on a held meeting is the interesting case and stays visible: the
   * organisation met and nothing came of it.
   */
  readonly held?: boolean;
  readonly produced?: string;
  readonly producedNothingBecause?: string;
}

export interface FoldedOrganization {
  readonly cascade: Cascade;
  readonly calendar: Calendar;
  readonly priorities: readonly PriorityDecision[];
  readonly gateEvaluations: readonly GateEvaluation[];
  /** Blockers raised OUT of the organization, awaiting a person. See `foldBlockers`. */
  readonly blockers: readonly RaisedBlocker[];
  /** What each phase produced, keyed `<workId>::<gate>`. The evidence a reviewer is shown. */
  readonly phaseOutputs: ReadonlyMap<string, PhaseOutput>;
  /** Branch, merge request and worktree per work item — where a developer goes to look. */
  readonly changes: ReadonlyMap<string, ChangeAddress>;
  /**
   * Every measured port crossing, in log order.
   *
   * A LIST, not a running total. Totals are folds of this and there are several worth taking — per
   * work item, per hat, per run, per model — and a stored total answers exactly one of them while
   * silently going stale for the rest.
   */
  readonly meters: readonly MeteredCall[];
  /** What each change touched, keyed by work id. The latest diff for that work wins. */
  readonly changedFiles: ReadonlyMap<string, readonly ChangedFile[]>;
  /** Every document that resolved to bytes when its phase finished, keyed `<workId>::<path>`. */
  readonly documents: ReadonlyMap<string, WrittenDocument>;
  /**
   * Rooms where a person and an agent iterated, keyed by room id.
   *
   * Rebuilt from the turns rather than stored whole, so a room that was mid-conversation when the
   * process died comes back mid-conversation rather than as a snapshot somebody remembered to take.
   */
  readonly rooms: ReadonlyMap<string, FoldedRoom>;
  /** What the organization learned, keyed by memory id. The latest write per memory wins. */
  readonly learned: ReadonlyMap<string, LearnedMemory>;
  /** Which hats are currently worn, from the don/doff record. */
  readonly hatsWorn: ReadonlySet<string>;
  /** Every meeting the organisation booked, in log order. */
  readonly meetings: readonly FoldedMeeting[];
  /** Where every hat was, at the most recent census. Absent when no tick has taken one. */
  readonly presence: PresenceCensus | undefined;
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

/** What one phase made. */
export interface PhaseOutput {
  readonly workId: string;
  readonly gate: string;
  readonly refs: readonly string[];
  readonly summary: string;
  readonly producedByHatId: string;
  readonly atMs: number;
  /** What the adapter printed while producing it — stdout, stderr, or the refusal. */
  readonly output: readonly string[];
  readonly durationMs: number | undefined;
}

/** Where a piece of work lives: its branch, its merge request, its checkout. */
export interface ChangeAddress {
  readonly workId: string;
  readonly changeId: string;
  readonly branch: string;
  readonly url: string | undefined;
  readonly workdir: string | undefined;
}

/** The address of every change the log knows about, keyed by work item. */
export function foldChangeAddresses(events: readonly OrgEvent[]): ReadonlyMap<string, ChangeAddress> {
  const out = new Map<string, ChangeAddress>();
  for (const event of events) {
    if (event.fact?.kind !== "change_opened") continue;
    const f = event.fact;
    out.set(f.workId, {
      workId: f.workId,
      changeId: f.changeId,
      branch: f.branch,
      url: f.url,
      workdir: f.workdir,
    });
  }
  return out;
}

/**
 * Every check the log has a verdict for, keyed `<tree>:<checkId>`.
 *
 * This is what makes the reuse durable rather than a cache in one process's memory: a second run,
 * in a second process, asking about the same content gets the same answer without paying for it
 * again — and asking about DIFFERENT content cannot get it at all, because the tree is half the key.
 *
 * LAST WRITE WINS per key, deliberately: a check re-run against the same tree after somebody fixed
 * the check itself should report what it says NOW. The earlier verdicts stay in the log for anyone
 * reconstructing the sequence.
 */
export function foldCheckResults(events: readonly OrgEvent[]): ReadonlyMap<string, CheckResult> {
  const out = new Map<string, CheckResult>();
  for (const event of events) {
    if (event.fact?.kind !== "check_result") continue;
    const x = event.fact;
    out.set(checkKey(x.tree, x.checkId), {
      checkId: x.checkId,
      outcome: x.outcome as CheckResult["outcome"],
      tree: x.tree,
      exitCode: x.exitCode,
      detail: x.detail,
      durationMs: x.durationMs,
      ...(x.falsifierPassed === undefined ? {} : { falsifierPassed: x.falsifierPassed }),
    });
  }
  return out;
}

/** Where a change came to rest. `commit`/`tree` absent means the port could not name them. */
export interface LandedChange {
  readonly workId: string;
  readonly changeId: string;
  readonly branch: string;
  readonly commit: string | undefined;
  readonly tree: string | undefined;
}

/**
 * Every change the log says LANDED, keyed by work item.
 *
 * The durable answer to "does this work exist in the repository", which a single run cannot give:
 * a resumed run opens no change for work that finished earlier, so its projection is silent about
 * it, and silence read as absence is how a delivered goal comes back undelivered.
 *
 * LAST WRITE WINS per work id, deliberately. Work can land more than once — a fix on top of a fix —
 * and the interesting revision is the current one. The earlier merges remain in the log for anybody
 * who wants the sequence; this fold answers a different question.
 */
export function foldLandedChanges(events: readonly OrgEvent[]): ReadonlyMap<string, LandedChange> {
  const out = new Map<string, LandedChange>();
  for (const event of events) {
    // A MERGE A PERSON UNDID is not landed any more. Both facts stay in the log; the fold reads
    // them in order, so a later merge of the same work would count again.
    if (event.fact?.kind === "change_merge_reverted") {
      out.delete(event.fact.workId);
      continue;
    }
    if (event.fact?.kind !== "change_merged") continue;
    const x = event.fact;
    out.set(x.workId, {
      workId: x.workId,
      changeId: x.changeId,
      branch: x.branch,
      commit: x.commit,
      tree: x.tree,
    });
  }
  return out;
}

/** A change handed to people for review, as the log recorded it. */
export interface HandedOffChange {
  readonly workId: string;
  readonly changeId: string;
  readonly branch: string;
  readonly url?: string;
  readonly commit?: string;
  readonly base?: string;
  /** The commit of the FIRST handoff - a later, different `commit` means a follow-up pushed a fix. */
  readonly firstCommit?: string;
}

/**
 * Every change the organization handed to people, by work id - the latest handoff wins.
 *
 * The companion of `foldLandedChanges` for an organization that never merges: it is how a resumed
 * run knows a change is already in front of a reviewer, so it neither walks it again nor opens a
 * second review of it.
 */
export function foldHandedOffChanges(events: readonly OrgEvent[]): ReadonlyMap<string, HandedOffChange> {
  const out = new Map<string, HandedOffChange>();
  for (const event of events) {
    if (event.fact?.kind !== "change_handed_off") continue;
    const x = event.fact;
    const firstCommit = out.get(x.workId)?.firstCommit ?? x.commit;
    out.set(x.workId, {
      workId: x.workId,
      changeId: x.changeId,
      branch: x.branch,
      ...(x.url === undefined ? {} : { url: x.url }),
      ...(x.commit === undefined ? {} : { commit: x.commit }),
      ...(x.base === undefined ? {} : { base: x.base }),
      ...(firstCommit === undefined ? {} : { firstCommit }),
    });
  }
  return out;
}

/** The after-open steps already performed, by work id: step keys, and the ids of what they posted. */
export function foldAfterOpen(events: readonly OrgEvent[]): ReadonlyMap<string, { readonly done: ReadonlySet<string>; readonly replyIds: readonly string[] }> {
  const out = new Map<string, { done: Set<string>; replyIds: string[] }>();
  for (const event of events) {
    const f = event.fact;
    if (f?.kind !== "change_after_open") continue;
    const entry = out.get(f.workId) ?? { done: new Set<string>(), replyIds: [] };
    entry.done.add(f.stepKey);
    if (f.replyId !== undefined) entry.replyIds.push(f.replyId);
    out.set(f.workId, entry);
  }
  return out;
}

/**
 * The review rounds requested on each change after a follow-up pushed it: which (step@commit) were
 * done, how many distinct pushes that is, and the ids of what they posted.
 */
export function foldAfterUpdate(
  events: readonly OrgEvent[],
): ReadonlyMap<string, { readonly done: ReadonlySet<string>; readonly rounds: number; readonly replyIds: readonly string[] }> {
  const out = new Map<string, { done: Set<string>; commits: Set<string>; replyIds: string[] }>();
  for (const event of events) {
    const f = event.fact;
    if (f?.kind !== "change_after_update") continue;
    const entry = out.get(f.workId) ?? { done: new Set<string>(), commits: new Set<string>(), replyIds: [] };
    entry.done.add(`${f.stepKey}@${f.commit}`);
    entry.commits.add(f.commit);
    if (f.replyId !== undefined) entry.replyIds.push(f.replyId);
    out.set(f.workId, entry);
  }
  return new Map([...out].map(([w, e]) => [w, { done: e.done, rounds: e.commits.size, replyIds: e.replyIds }]));
}

/** One action item on a piece of work: what happened, and whether it has been dealt with. */
export interface ActionItem {
  readonly workId: string;
  readonly actionItemId: string;
  readonly source: string;
  readonly itemKind: string;
  readonly summary: string;
  readonly detail?: string;
  readonly url?: string;
  readonly author?: string;
  readonly raisedAtMs: number;
  /** Absent while OPEN. */
  readonly settled?: {
    readonly outcome: string;
    readonly how: string;
    readonly byHatId?: string;
    readonly atMs: number;
    readonly respond?: boolean;
    readonly commit?: string;
  };
  /** The latest time it was weighed and left open, and why. The item is still open. */
  readonly deferred?: { readonly why: string; readonly byHatId?: string; readonly atMs: number };
  /** Answered where it was raised. Absent until then - a settled item with no answer is owed one. */
  readonly answered?: { readonly replyId?: string; readonly resolved: boolean; readonly skipped?: string; readonly atMs: number };
  /** Settled once, and that settlement did not stand - why. The item is OPEN; the next session is told this. */
  readonly reopened?: { readonly why: string; readonly atMs: number };
}

/**
 * Every action item, by work id, in the order raised - open and settled alike.
 *
 * RAISING IS IDEMPOTENT: the same event delivered twice (a webhook retry, a poll that sees the same
 * comment again) has the same id and folds to one item. A settle for an id never raised is ignored
 * rather than inventing an item nobody saw.
 */
export function foldActionItems(events: readonly OrgEvent[]): ReadonlyMap<string, readonly ActionItem[]> {
  const byId = new Map<string, ActionItem>();
  for (const event of events) {
    const f = event.fact;
    if (f?.kind === "action_item_raised") {
      if (byId.has(f.actionItemId)) continue;
      byId.set(f.actionItemId, {
        workId: f.workId,
        actionItemId: f.actionItemId,
        source: f.source,
        itemKind: f.itemKind,
        summary: f.summary,
        ...(f.detail === undefined ? {} : { detail: f.detail }),
        ...(f.url === undefined ? {} : { url: f.url }),
        ...(f.author === undefined ? {} : { author: f.author }),
        raisedAtMs: event.atMs,
      });
    } else if (f?.kind === "action_item_deferred") {
      const item = byId.get(f.actionItemId);
      if (item === undefined || item.settled !== undefined) continue;
      byId.set(f.actionItemId, { ...item, deferred: { why: f.why, ...(f.byHatId === undefined ? {} : { byHatId: f.byHatId }), atMs: event.atMs } });
    } else if (f?.kind === "action_item_settled") {
      const item = byId.get(f.actionItemId);
      if (item === undefined) continue;
      byId.set(f.actionItemId, {
        ...item,
        settled: {
          outcome: f.outcome,
          how: f.how,
          ...(f.byHatId === undefined ? {} : { byHatId: f.byHatId }),
          atMs: event.atMs,
          ...(f.respond === undefined ? {} : { respond: f.respond }),
          ...(f.commit === undefined ? {} : { commit: f.commit }),
        },
      });
    } else if (f?.kind === "action_item_reopened") {
      const item = byId.get(f.actionItemId);
      if (item === undefined) continue;
      // OPEN AGAIN: the settlement and its answer are dropped, the reason kept for whoever decides next.
      const { settled: _s, answered: _a, ...rest } = item;
      byId.set(f.actionItemId, { ...rest, reopened: { why: f.why, atMs: event.atMs } });
    } else if (f?.kind === "action_item_answered") {
      const item = byId.get(f.actionItemId);
      if (item === undefined) continue;
      byId.set(f.actionItemId, {
        ...item,
        answered: {
          ...(f.replyId === undefined ? {} : { replyId: f.replyId }),
          resolved: f.resolved,
          ...(f.skipped === undefined ? {} : { skipped: f.skipped }),
          atMs: event.atMs,
        },
      });
    }
  }
  const out = new Map<string, ActionItem[]>();
  for (const item of byId.values()) out.set(item.workId, [...(out.get(item.workId) ?? []), item]);
  return out;
}

/** The OPEN action items, by work id. Work with none is absent. */
export function openActionItems(events: readonly OrgEvent[]): ReadonlyMap<string, readonly ActionItem[]> {
  const out = new Map<string, readonly ActionItem[]>();
  for (const [workId, items] of foldActionItems(events)) {
    const open = items.filter((i) => i.settled === undefined);
    if (open.length > 0) out.set(workId, open);
  }
  return out;
}

/**
 * Rooms, rebuilt turn by turn.
 *
 * A room is a CONVERSATION, so it folds by replaying what was said rather than by taking the last
 * snapshot. Replaying is also what makes a mid-conversation restart come back mid-conversation.
 */
export function foldRooms(events: readonly OrgEvent[]): ReadonlyMap<string, FoldedRoom> {
  const out = new Map<string, FoldedRoom>();
  for (const event of events) {
    const fact = event.fact;
    if (fact === undefined) continue;
    if (fact.kind === "room_opened") {
      // A second `room_opened` for one id is ignored rather than resetting the transcript: losing a
      // conversation to a duplicate event is worse than carrying one stale header field.
      if (out.has(fact.roomId)) continue;
      out.set(fact.roomId, {
        roomId: fact.roomId,
        workId: fact.workId,
        gate: fact.gate,
        documentPath: fact.documentPath,
        withHatId: fact.withHatId,
        openedBy: fact.openedBy,
        openedAtMs: event.atMs,
        state: "open",
        turns: [],
        revisions: [],
        approvedRevision: undefined,
        closedBy: undefined,
        closedReason: undefined,
      });
    } else if (fact.kind === "room_turn") {
      const room = out.get(fact.roomId);
      if (room === undefined) continue;
      if (room.turns.some((t) => t.turnId === fact.turnId)) continue;
      out.set(fact.roomId, {
        ...room,
        turns: [
          ...room.turns,
          {
            turnId: fact.turnId,
            speakerKind: fact.speakerKind,
            speaker: fact.speaker,
            text: fact.text,
            atMs: event.atMs,
            producedRevision: fact.producedRevision,
          },
        ],
      });
    } else if (fact.kind === "room_revision") {
      const room = out.get(fact.roomId);
      if (room === undefined) continue;
      if (room.revisions.some((r) => r.revision === fact.revision)) continue;
      out.set(fact.roomId, {
        ...room,
        revisions: [
          ...room.revisions,
          { revision: fact.revision, byHatId: fact.byHatId, text: fact.text, atMs: event.atMs },
        ],
      });
    } else if (fact.kind === "room_closed") {
      const room = out.get(fact.roomId);
      if (room === undefined) continue;
      out.set(fact.roomId, {
        ...room,
        state: fact.state,
        approvedRevision: fact.approvedRevision,
        closedBy: fact.byHuman,
        closedReason: fact.reason,
      });
    }
  }
  return out;
}

/**
 * What the organization has learned.
 *
 * LATEST WRITE WINS on content, and a later phase change overwrites the phase without touching the
 * value — the two facts move at different rates, which is the same split the store keeps on disk.
 */
export function foldLearned(events: readonly OrgEvent[]): ReadonlyMap<string, LearnedMemory> {
  const out = new Map<string, LearnedMemory>();
  for (const event of events) {
    const fact = event.fact;
    if (fact === undefined) continue;
    if (fact.kind === "memory_written") {
      const prior = out.get(fact.memoryId);
      if (prior !== undefined && prior.atMs > event.atMs) continue;
      out.set(fact.memoryId, {
        memoryId: fact.memoryId,
        tier: fact.tier,
        scope: fact.scope,
        key: fact.key,
        // A CONFLICTED write does not replace the value — the existing belief stands until somebody
        // decides, exactly as `memory.write` refuses to overwrite it.
        value: fact.outcome === "conflicted" && prior !== undefined ? prior.value : fact.value,
        writtenBy: fact.writtenBy,
        atMs: event.atMs,
        phase: prior?.phase ?? "draft",
        outcome: fact.outcome,
      });
    } else if (fact.kind === "memory_phase") {
      const prior = out.get(fact.memoryId);
      if (prior === undefined) continue;
      out.set(fact.memoryId, { ...prior, phase: fact.to });
    }
  }
  return out;
}

/**
 * Which hats are worn right now.
 *
 * A SET REBUILT BY REPLAY, never a stored list. Donning and doffing are events; the current set is
 * what they add up to, so a hat that was taken off cannot linger because somebody forgot to remove
 * it from a roster.
 */
export function foldHatsWorn(events: readonly OrgEvent[]): ReadonlySet<string> {
  const worn = new Set<string>();
  for (const event of events) {
    if (event.fact?.kind !== "hat_move") continue;
    if (event.fact.move === "don") worn.add(event.fact.hatId);
    else if (event.fact.move === "doff") worn.delete(event.fact.hatId);
  }
  return worn;
}

/**
 * The most recent census, or `undefined` when no tick has taken one.
 *
 * The LATEST only. A census is a snapshot of one instant, and keeping every one of them would let
 * a page average four hours of an organisation's day into a number that describes no moment in it.
 */
export function foldPresence(events: readonly OrgEvent[]): PresenceCensus | undefined {
  let latest: PresenceCensus | undefined;
  for (const event of factEvents(events)) {
    const fact = event.fact;
    if (fact?.kind !== "presence_census") continue;
    if (latest !== undefined && fact.atMs < latest.atMs) continue;
    latest = { atMs: fact.atMs, counts: fact.counts, waking: fact.waking, hats: fact.hats };
  }
  return latest;
}

/**
 * Every meeting, from the log.
 *
 * Keyed by meeting id so re-reading a log does not double-count, and so a meeting re-booked at a
 * new time appears once, at the time it was last booked for.
 */
export function foldMeetings(events: readonly OrgEvent[]): readonly FoldedMeeting[] {
  const byId = new Map<string, FoldedMeeting>();
  for (const event of factEvents(events)) {
    const fact = event.fact;
    if (fact?.kind !== "meeting_planned") continue;
    byId.set(fact.meetingId, {
      // A re-booking must not erase the outcome of the meeting that already happened.
      ...(byId.get(fact.meetingId) ?? {}),
      meetingId: fact.meetingId,
      attendeeHatIds: fact.attendeeHatIds,
      startMs: fact.startMs,
      endMs: fact.endMs,
      ...(fact.workItemId === undefined ? {} : { workItemId: fact.workItemId }),
      ...(fact.reason === undefined ? {} : { reason: fact.reason }),
      ...(fact.about === undefined ? {} : { about: fact.about }),
      ...(fact.mustProduce === undefined ? {} : { mustProduce: fact.mustProduce }),
    });
  }

  // Held SECOND, so an outcome survives a re-booking of the same meeting id.
  for (const event of factEvents(events)) {
    const fact = event.fact;
    if (fact?.kind !== "meeting_held") continue;
    const planned = byId.get(fact.meetingId);
    byId.set(fact.meetingId, {
      // A meeting held with no plan on record is still a meeting that happened. Recorded from what
      // the holding fact itself carries rather than dropped for want of a booking.
      meetingId: fact.meetingId,
      attendeeHatIds: fact.attendeeHatIds,
      startMs: planned?.startMs ?? fact.atMs,
      endMs: planned?.endMs ?? fact.atMs,
      ...(planned?.workItemId === undefined ? {} : { workItemId: planned.workItemId }),
      ...(planned?.reason === undefined ? {} : { reason: planned.reason }),
      ...(planned?.about === undefined ? {} : { about: planned.about }),
      mustProduce: fact.mustProduce,
      held: true,
      produced: fact.produced,
      ...(fact.reason === undefined ? {} : { producedNothingBecause: fact.reason }),
    });
  }
  return [...byId.values()];
}

/**
 * Every metered port crossing, in the order the log holds them.
 *
 * No de-duplication and no last-wins: two calls to the same port for the same gate are two calls
 * that both cost money, and collapsing them would under-report a retry — which is precisely the
 * case somebody checking a bill is looking for.
 */
export function foldMeters(events: readonly OrgEvent[]): readonly MeteredCall[] {
  const out: MeteredCall[] = [];
  for (const event of events) {
    if (event.fact?.kind !== "metered_call") continue;
    const f = event.fact;
    out.push({ meter: f.meter, workId: f.workId, hatId: f.hatId, gate: f.gate, atMs: event.atMs });
  }
  return out;
}

/**
 * What each work item's change touched.
 *
 * THE LATEST WINS, unlike the meters above, and for the opposite reason: a diff is a statement
 * about the branch as it stands now, so an older one describes a state that no longer exists.
 */
export function foldChangedFiles(events: readonly OrgEvent[]): ReadonlyMap<string, readonly ChangedFile[]> {
  const out = new Map<string, readonly ChangedFile[]>();
  const seenAt = new Map<string, number>();
  for (const event of events) {
    if (event.fact?.kind !== "change_files") continue;
    const f = event.fact;
    const prior = seenAt.get(f.workId);
    if (prior !== undefined && prior > event.atMs) continue;
    seenAt.set(f.workId, event.atMs);
    out.set(f.workId, f.files);
  }
  return out;
}

/** Every document that resolved to bytes, keyed by work and path. The latest write wins. */
export function foldDocuments(events: readonly OrgEvent[]): ReadonlyMap<string, WrittenDocument> {
  const out = new Map<string, WrittenDocument>();
  for (const event of events) {
    if (event.fact?.kind !== "document_written") continue;
    const f = event.fact;
    const key = `${f.workId}::${f.path}`;
    const prior = out.get(key);
    if (prior !== undefined && prior.atMs > event.atMs) continue;
    out.set(key, {
      workId: f.workId,
      gate: f.gate,
      path: f.path,
      bytes: f.bytes,
      producedByHatId: f.producedByHatId,
      atMs: event.atMs,
    });
  }
  return out;
}

/**
 * What every phase produced, keyed by work and gate.
 *
 * THE LATEST WINS. Work that was rejected and re-produced has two outputs for one gate, and the
 * older one describes a document that has since been rewritten — showing it to a reviewer would be
 * showing them the version that was already turned down.
 */
export function foldPhaseOutputs(events: readonly OrgEvent[]): ReadonlyMap<string, PhaseOutput> {
  const out = new Map<string, PhaseOutput>();
  for (const event of events) {
    if (event.fact?.kind !== "phase_output") continue;
    const f = event.fact;
    const key = `${f.workId}::${f.gate}`;
    const prior = out.get(key);
    if (prior !== undefined && prior.atMs > event.atMs) continue;
    out.set(key, {
      workId: f.workId,
      gate: f.gate,
      refs: f.refs,
      summary: f.summary,
      producedByHatId: f.producedByHatId,
      atMs: event.atMs,
      output: f.output ?? [],
      durationMs: f.durationMs,
    });
  }
  return out;
}

/**
 * The whole organization, from the log alone.
 *
 * An EMPTY log folds to an empty organization rather than throwing: a store nobody has written to
 * is a normal state, and it is distinguishable from a broken one by `factCount` being zero while
 * `refusals` is empty.
 */
export function foldOrganization(events: readonly OrgEvent[]): FoldedOrganization {
  // ── THERE IS NO CHECKPOINT HERE, AND THAT IS A MEASURED DECISION ──────────
  // The obvious next optimisation is to snapshot this result, key it on (last event id, fold
  // version), and replay only the tail. It was planned, and then measured, 2026-09-10:
  //
  //     events   indexed read   fold   resume total
  //      5,000          30 ms    3 ms      33 ms    (fold is 8%)
  //     20,000          65 ms    4 ms      68 ms    (fold is 5%)
  //     60,000         177 ms    9 ms     186 ms    (fold is 5%)
  //
  // The fold is NINE MILLISECONDS at sixty thousand events. Reading was the whole cost, and the
  // date-pruned walk and the derived index already removed it. A checkpoint would buy 5% of a
  // fifth of a second, and cost a SECOND RECORD OF THE SAME FACTS beside the events that produced
  // them — the thing `org-store.ts` refuses in its own header, because the two can disagree.
  //
  // Written down rather than left as an absence so the next reader does not have to re-derive the
  // case for building it. If the fold ever grows to dominate a resume, the numbers above are what
  // to compare against.
  //
  // No special case for an empty log: every fold below already returns empty for empty input, so a
  // guard here would be a branch that reads as a guard and computes the same answer.
  return {
    cascade: foldCascade(events),
    calendar: foldCalendar(events),
    priorities: foldPriorities(events),
    gateEvaluations: foldGateEvaluations(events),
    blockers: foldBlockers(events),
    phaseOutputs: foldPhaseOutputs(events),
    changes: foldChangeAddresses(events),
    meters: foldMeters(events),
    changedFiles: foldChangedFiles(events),
    documents: foldDocuments(events),
    rooms: foldRooms(events),
    learned: foldLearned(events),
    hatsWorn: foldHatsWorn(events),
    meetings: foldMeetings(events),
    presence: foldPresence(events),
    portfolios: foldPortfolioBook(events),
    queues: foldQueues(events),
    qa: foldQaCycles(events),
    fidelities: foldRunFidelity(events),
    refusals: foldRefusals(events),
    factCount: factEvents(events).length,
  };
}
