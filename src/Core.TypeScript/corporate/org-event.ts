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

import type { PortMeter } from "./meter";
import { supervisorChainOf, type OrgChart } from "./org-chart";
import type { WorkState, WorkType } from "./goal-cascade";
import type { ScheduleBlockState, ScheduleBlockType } from "./work-schedule";
import type { PriorityClass } from "./prioritization";
import type { GateEvaluation, GateKind } from "./quality-gate";
import type { PortfolioKind } from "./portfolio";
import type { WorkQueue } from "./work-market";
import type { QaCycleReport } from "./qa";
import type { RunFidelity } from "./providers";
import type { ObserveActTick } from "./observe-act-window";
import type { SupervisorSignal } from "./supervisor-signal";
import type { AnchorPost, DecisionRecord, DiscussionAnchor } from "./discussion-anchor";
import type { IntakeItem } from "./intake";
import type { RaisedBlocker } from "./human-blocker";

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
      /** What asked for it — see `request.ts`. Absent for work the organization raised itself. */
      readonly requestRef?: string;
      /**
       * What this work waits for — see `CascadeNode.dependsOn`.
       *
       * ON THE FACT, not only in memory, because a cascade folded from the log has to be the same
       * organization the run was working. A round-trip test caught this immediately: the run held
       * a dependency the replay did not, so a resumed organization would have scheduled a check
       * before the thing it checks.
       */
      readonly dependsOn?: readonly string[];
      /** What the requester wrote — see `CascadeNode.brief`. */
      readonly brief?: string;
      /** The gates the organization stated this item owes — see `CascadeNode.owes`. */
      readonly owes?: readonly GateKind[];
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
  /**
   * A blocker that LEFT the organization, with its whole content.
   *
   * The event alone used to carry only a sentence and the id in `evidenceRefs`, so a reader could
   * see THAT something was raised and never WHAT — which made the raise unanswerable from the log
   * and left `openBlockers` with nothing to read.
   */
  | { readonly kind: "blocker_raised"; readonly blocker: RaisedBlocker }
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
  /**
   * WHAT A PHASE MADE, so a reviewer can be shown the thing they are judging.
   *
   * The gap this closes was the worst kind: a writer with no reader. `runPipeline` produced an
   * artifact for every phase and `historyFromPhases` assembled them into a document — and none of it
   * reached the log, so it died with the process. An observer could report that `brd_approval` was
   * approved and could not show the BRD, or say whether one existed. A person asked to approve it
   * was being asked to approve a gate name.
   *
   * `refs` is where the thing IS; `summary` is one line about it. An EMPTY `refs` is the honest
   * record of a phase that produced nothing, and is the single most useful thing this fact carries —
   * it is what lets a dashboard refuse to present a rubber stamp as a decision.
   */
  /**
   * THE CHANGE A PIECE OF WORK BECAME — branch, merge request, worktree.
   *
   * The log recorded `change is Merged` and threw the handle away, so the one question a developer
   * opens a ticket to answer — *where is the branch, where is the MR* — could not be answered from
   * the history at all. The state was kept and the address was not.
   */
  /**
   * A REQUEST THE ORGANIZATION TOOK ON — the outside asking for work, recorded as data.
   *
   * Intake already mints a collision-proof key and already refuses duplicates and defects with no
   * reproduction steps. Both outcomes were prose in the trace, so neither survived the fold: an
   * organization could not list what it had been asked to do, and — worse — could not list what it
   * had DECLINED, while the person who filed it waited.
   */
  | {
      readonly kind: "intake_accepted";
      readonly item: IntakeItem;
    }
  /**
   * A REQUEST THE ORGANIZATION DECLINED, with its reason.
   *
   * Carried separately from `Refusal` events because a refused request has an addressee: somebody
   * filed it and is owed the answer. A refusal that only exists in a list of run refusals is a
   * decision nobody outside the run will ever see.
   */
  | {
      readonly kind: "intake_refused";
      readonly reason: string;
      readonly message: string;
      readonly title: string;
      readonly externalRef?: string;
    }
  | {
      readonly kind: "change_opened";
      readonly workId: string;
      readonly changeId: string;
      readonly branch: string;
      readonly url?: string;
      readonly workdir?: string;
    }
  /**
   * A change that ACTUALLY LANDED, with where it landed.
   *
   * ── WHY THE LOG AND NOT THE PROJECTION ───────────────────────────────────
   * A projection describes what one run did. "Has a commit ever existed for this work" is a
   * question across runs, and holding the projection to it is how a RESUMED run comes to believe
   * nothing was ever committed for work that shipped last week — measured, 2026-09-10: run 1
   * delivered with a merge commit in git, run 2 resumed and called the same item unlanded while the
   * commit sat there. The log is the only record here that outlives the process.
   *
   * `commit` and `tree` are OPTIONAL because an adapter may not be able to name them — a simulated
   * port has no repository. Absent means "this port could not say", never "no commit exists"; the
   * fact's presence is what says the merge happened.
   */
  /**
   * A CHECK THAT RAN, and the exact content it judged.
   *
   * ── WHY THE TREE IS ON THE FACT ──────────────────────────────────────────
   * A verdict that does not say which code it looked at cannot be reused and cannot be audited —
   * "the artifact you edited is not the one that ran" is a failure this register has paid for
   * repeatedly, and a gate result with no content address is exactly that failure waiting to
   * happen. With the tree recorded, re-running a gate over unchanged content reuses the answer, and
   * changed content CANNOT reuse it, which is the half that matters.
   *
   * TREE RATHER THAN COMMIT: two commits over identical content share a tree, so a rebase, an
   * amend or a cherry-pick does not invalidate work already done — and those are most of what a
   * working branch does.
   *
   * `outcome` distinguishes a green check from a green check nothing can falsify. They are not the
   * same evidence and the log must not flatten them into one.
   */
  | {
      readonly kind: "check_result";
      readonly workId: string;
      readonly checkId: string;
      readonly tree: string;
      readonly outcome: string;
      readonly exitCode?: number;
      readonly detail: string;
      readonly durationMs: number;
      readonly falsifierPassed?: boolean;
    }
  /**
   * A CHECK THAT RAN, and the exact content it judged.
   *
   * ── WHY THE TREE IS ON THE FACT ──────────────────────────────────────────
   * A verdict that does not say which code it looked at cannot be reused and cannot be audited —
   * "the artifact you edited is not the one that ran" is a failure this register has paid for
   * repeatedly, and a gate result with no content address is exactly that failure waiting to
   * happen. With the tree recorded, re-running a gate over unchanged content reuses the answer, and
   * changed content CANNOT reuse it, which is the half that matters.
   *
   * TREE RATHER THAN COMMIT: two commits over identical content share a tree, so a rebase, an
   * amend or a cherry-pick does not invalidate work already done — and those are most of what a
   * working branch does.
   *
   * `outcome` distinguishes a green check from a green check nothing can falsify. They are not the
   * same evidence and the log must not flatten them into one.
   */
  | {
      readonly kind: "check_result";
      readonly workId: string;
      readonly checkId: string;
      readonly tree: string;
      readonly outcome: string;
      readonly exitCode?: number;
      readonly detail: string;
      readonly durationMs: number;
      readonly falsifierPassed?: boolean;
    }
  | {
      /**
       * The change was HANDED TO PEOPLE: pushed and proposed for review, and left open. The
       * organization's last act on it. Distinct from `change_merged`, which it never implies.
       */
      readonly kind: "change_handed_off";
      readonly workId: string;
      readonly changeId: string;
      readonly branch: string;
      /** Where it can be reviewed — the merge request's address, when the review system gave one. */
      readonly url?: string;
      readonly commit?: string;
      /** What it was proposed against, so feedback about that target moving can find it. */
      readonly base?: string;
    }
  | {
      /**
       * Something happened to a handed-off change that somebody may need to act on - a reviewer's
       * comment, the request being updated or closed, its target moving ahead of it. Recorded as an
       * ACTION ITEM on the work, never as an instruction: the organization decides what, if
       * anything, to do about it, and when.
       */
      readonly kind: "action_item_raised";
      readonly workId: string;
      /** Stable across re-deliveries of the same event, so raising is idempotent. */
      readonly actionItemId: string;
      /** Where it came from - the configured source or the review system. */
      readonly source: string;
      /** What kind of thing happened, in the source's own words (`comment`, `behind_target`, `closed`, ...). */
      readonly itemKind: string;
      readonly summary: string;
      readonly detail?: string;
      readonly url?: string;
      readonly author?: string;
    }
  | {
      /** An action item was dealt with - addressed, declined with a reason, or overtaken by events. */
      readonly kind: "action_item_settled";
      readonly workId: string;
      readonly actionItemId: string;
      readonly outcome: "addressed" | "declined" | "superseded";
      readonly how: string;
      readonly byHatId?: string;
    }
  | {
      /**
       * A merge the organization made was UNDONE by a person - reset off the trunk it should never
       * have reached. Recorded beside `change_merged`, never instead of it: both happened. The
       * work is no longer landed, so a resumed run treats it as finished-but-not-integrated.
       */
      readonly kind: "change_merge_reverted";
      readonly workId: string;
      readonly branch: string;
      readonly reason: string;
    }
  | {
      readonly kind: "change_merged";
      readonly workId: string;
      readonly changeId: string;
      readonly branch: string;
      readonly commit?: string;
      /** The tree the merge produced — the cache key a gate keys its checks on. */
      readonly tree?: string;
    }
  | {
      readonly kind: "phase_output";
      readonly workId: string;
      readonly gate: string;
      readonly refs: readonly string[];
      readonly summary: string;
      readonly producedByHatId: string;
      /**
       * WHAT THE ADAPTER ACTUALLY SAID — the captured stdout and stderr of the command behind this
       * phase, up to `MAX_CAPTURED_OUTPUT`.
       *
       * The adapters have captured this since they were written, and it was dropped one layer up:
       * `runPipeline` carried the artifact's `refs` into the gate's evidence and discarded the
       * producer's own `evidence`, which is where the output lives. So a run could tell you a gate
       * passed and could never tell you what the agent behind it printed — which is the whole
       * substance of the work for anyone reading it as a developer rather than as a board.
       */
      readonly output?: readonly string[];
      readonly durationMs?: number;
    }
  /**
   * ONE CROSSING OF ONE PORT, MEASURED — duration, tokens, and cost where a price was configured.
   *
   * The fact that makes every money figure in every view derivable instead of invented. Carried per
   * call rather than per run so that "what did this task cost" and "what does this hat spend" are
   * both folds of the same rows rather than two separately-maintained counters that drift.
   *
   * `workId` and `hatId` are the dimensions worth slicing by and both are OPTIONAL: an intake poll
   * belongs to no work item, and a run-level call belongs to no hat. Attributing those to a
   * convenient owner would make the per-item totals add up to more than the run.
   */
  | {
      readonly kind: "metered_call";
      readonly meter: PortMeter;
      readonly workId?: string;
      readonly hatId?: string;
      readonly gate?: string;
    }
  /**
   * WHAT A CHANGE ACTUALLY TOUCHED — a path and its added/removed line counts, per file.
   *
   * `change_opened` records the address of a change; this records its content. Without it a
   * "Changes" view can name a branch and cannot say what is in it, which is the one question
   * anybody opening that view has.
   *
   * Line counts come from the change-control adapter's own diff, never from an agent's summary of
   * what it says it did. The agent's claim is testimony and lives in `phase_output`; this is the
   * measurement, and keeping them apart is what lets the two disagree in the open.
   */
  | {
      readonly kind: "change_files";
      readonly workId: string;
      readonly changeId: string;
      readonly files: readonly ChangedFile[];
    }
  /**
   * A DOCUMENT AN AGENT WROTE, resolved to something a reader can open.
   *
   * `phase_output` already carries the refs a phase cited, and a ref is not a document: it may be a
   * plan line, a URL, or a path that no longer exists. This fact is emitted only for refs that
   * RESOLVED to bytes on disk at the moment the phase finished, and carries the size that was read.
   * A documents view built on refs alone lists things it cannot open.
   */
  | {
      readonly kind: "document_written";
      readonly workId: string;
      readonly gate: string;
      readonly path: string;
      readonly bytes: number;
      readonly producedByHatId: string;
    }
  /**
   * SOMETHING THE ORGANIZATION LEARNED, and where it belongs.
   *
   * The write itself, not the file. The file is the store's business; this is the fact that at this
   * moment this hat came to believe this, which is what a fold needs to rebuild what is known
   * without reading a filesystem it may not have.
   */
  | {
      readonly kind: "memory_written";
      readonly memoryId: string;
      readonly tier: string;
      readonly scope: string;
      readonly key: string;
      readonly writtenBy: string;
      /** new | reinforced | conflicted — three genuinely different things happened. */
      readonly outcome: "new" | "reinforced" | "conflicted";
      readonly value: string;
    }
  /**
   * A memory moved through its lifecycle: went stale, was archived, was promoted.
   *
   * Carries the WEIGHT that justified it. A phase change with no number behind it is a decision
   * nobody can check, and archiving is the one that means never again.
   */
  | {
      readonly kind: "memory_phase";
      readonly memoryId: string;
      readonly from: string;
      readonly to: string;
      readonly authority: string;
      readonly weight: number;
      readonly why: string;
    }
  /**
   * A HAT SPENT TIME ON SOMETHING NOBODY ASKED FOR — and what it was supposed to produce.
   *
   * The block and its intended output travel together on purpose. A free-time block recorded
   * without its output would make "the organization is learning" unfalsifiable, which is the exact
   * failure `org-life.ts` is built to avoid.
   */
  | {
      readonly kind: "self_directed";
      readonly hatId: string;
      readonly selfDirectedKind: string;
      readonly subject: string;
      readonly startMs: number;
      readonly endMs: number;
      /** The memory key it must write. Absent output later is then visible as a block that produced nothing. */
      readonly producesKey: string;
    }
  /**
   * A PERSON TOOK AN AGENT'S TIME, and what that cost the schedule.
   *
   * `displaced` is the point. An organization that silently drops work to take a meeting is not
   * more responsive, it is less trustworthy — so the delay is recorded with the interruption.
   */
  | {
      readonly kind: "conversation_preempted";
      readonly hatId: string;
      readonly withHuman: string;
      readonly blockId: string;
      readonly displaced: readonly { readonly blockId: string; readonly byMs: number }[];
    }
  /** A room where a person and an agent iterate on a document. */
  | {
      readonly kind: "room_opened";
      readonly roomId: string;
      readonly workId: string;
      readonly gate: string;
      readonly documentPath: string;
      readonly withHatId: string;
      readonly openedBy: string;
    }
  | {
      readonly kind: "room_turn";
      readonly roomId: string;
      readonly turnId: string;
      readonly speakerKind: string;
      readonly speaker: string;
      readonly text: string;
      readonly producedRevision?: number;
    }
  | {
      readonly kind: "room_revision";
      readonly roomId: string;
      readonly revision: number;
      readonly byHatId: string;
      readonly text: string;
      readonly inResponseToTurnId?: string;
    }
  /** The room ended. `approvedRevision` is present only when somebody approved something specific. */
  | {
      readonly kind: "room_closed";
      readonly roomId: string;
      readonly state: string;
      readonly byHuman: string;
      readonly reason: string;
      readonly approvedRevision?: number;
    }
  /**
   * AUTHORITY WAS PUT ON OR TAKEN OFF.
   *
   * The record that makes "who was allowed to do this, at the time they did it" answerable. A
   * register where every hat is always active cannot answer that, which is the only question an
   * audit asks.
   */
  /**
   * AN AGENT SAID IT USED SOMETHING IT WAS TOLD.
   *
   * The other half of the memory economy. Without it `citedCount` never moves, `utilityRatio` sits
   * at its neutral value forever, and a memory that was injected twenty times and never relied on
   * is indistinguishable from one that saved every run it appeared in.
   */
  | {
      readonly kind: "memory_cited";
      readonly memoryId: string;
      readonly byHatId: string;
      readonly workId?: string;
    }
  /**
   * Where every hat was at one instant: working, in a room, studying, or asleep.
   *
   * ONE FACT FOR THE WHOLE CENSUS rather than one per hat. The interesting number is the shape of
   * the day — how many were asleep while three worked — and splitting it into seventy facts would
   * make that a query rather than a reading, and would let a partial write report a half-populated
   * organisation as a real one.
   */
  /**
   * A meeting HAPPENED, and what came out of it.
   *
   * Separate from `meeting_planned` because booking an hour and holding it are different facts and
   * an organisation that conflated them could report a calendar as an achievement. `produced` is
   * what the attendees actually put on the table; EMPTY IS A REAL VALUE and is recorded as one —
   * "we met and nothing came of it" is the finding a meeting register exists to surface.
   */
  | {
      readonly kind: "meeting_held";
      readonly meetingId: string;
      readonly attendeeHatIds: readonly string[];
      readonly atMs: number;
      /** What it had to produce, carried forward so the output can be judged against the ask. */
      readonly mustProduce: string;
      /** What it did produce. Empty means nothing, and that is not smoothed over. */
      readonly produced: string;
      /** Why nothing came out, when nothing did. */
      readonly reason?: string;
    }
  | {
      readonly kind: "presence_census";
      readonly atMs: number;
      readonly counts: Readonly<Record<string, number>>;
      /** Hats that were asleep last tick and are needed now. Empty is normal and is not padded. */
      readonly waking: readonly string[];
      /** The full census, so a page can say what each hat was doing rather than only how many. */
      readonly hats: readonly { readonly hatId: string; readonly presence: string; readonly because: string; readonly subject?: string }[];
    }
  | {
      readonly kind: "hat_move";
      readonly hatId: string;
      readonly move: string;
      readonly why: string;
    }
  | {
      readonly kind: "meeting_planned";
      readonly meetingId: string;
      readonly blockIds: readonly string[];
      readonly attendeeHatIds: readonly string[];
      readonly startMs: number;
      readonly endMs: number;
      readonly workItemId?: string;
      /**
       * WHY it was booked — `MeetingReason` from `org-life.ts`.
       *
       * Optional because the accountable-chain meeting the runtime books has no such cause; it is
       * part of walking a work item, not a response to a condition. Optional rather than a filler
       * value, so "this meeting has no stated cause" stays visibly different from a cause nobody
       * chose. A meeting whose reason is absent is one nothing can later tell you to stop holding.
       */
      readonly reason?: string;
      /** What it is about, in a sentence somebody can decide from. */
      readonly about?: string;
      /** What has to come out of it. See `MeetingProposal.mustProduce`. */
      readonly mustProduce?: string;
    };

/** One file a change touched, as the change-control adapter's own diff reports it. */
export interface ChangedFile {
  readonly path: string;
  readonly added: number;
  readonly removed: number;
}

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
