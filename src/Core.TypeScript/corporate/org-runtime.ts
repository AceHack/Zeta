/**
 * corporate/org-runtime.ts — the composition root. Every module in this register, in one pipeline.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * An import audit of `corporate/` found **62 of 189 exported values reached by any non-test
 * module**, and seven modules — `work-market`, `prioritization`, `assignment-engine`, `loop-policy`,
 * `work-projection`, `org-seed`, `org-cycle` — reached by NONE. Tested, correct, and consumed by
 * nothing: exactly the defect this package was started to fix, reproduced at scale by the fixing.
 *
 * `org-cycle.ts` runs the delivery loop and deliberately stays that. This runs the WHOLE
 * organization, and its job is to be the caller that makes the rest load-bearing:
 *
 *    1. INTAKE       external events arrive, are de-duplicated and triaged      (intake)
 *    2. PRIORITIZE   an authority orders what survived                          (prioritization)
 *    3. CASCADE      the top goal decomposes to owned tasks                     (goal-cascade)
 *    4. STAFF        ranked assignment issues real, expiring bindings           (assignment-engine,
 *                                                                               reputation, hat-binding)
 *    5. SCHEDULE     assignees get work blocks; the chain meets                 (work-schedule)
 *    6. MARKET       tasks become shards; agents claim, complete, review        (work-market)
 *    7. QA           cases derived from criteria run for real                   (qa)
 *    8. GATES        seven gates, with runtime-validation reading QA's verdict  (quality-gate)
 *    9. ESCALATE     repeated rejection is churn, broken structurally           (escalation)
 *   10. LOOP         the dev's OWN observe tick picks the work and reports back (loop-policy,
 *                                                                               work-projection)
 *
 * ── IT IS A FUNCTION OF ITS INPUTS ───────────────────────────────────────────
 * No clock, no randomness, no I/O. Same inputs, same report — which is what lets the end-to-end
 * claim be a test rather than a demonstration.
 *
 * ── REFUSALS ARE RESULTS ─────────────────────────────────────────────────────
 * Every step that can be refused records the refusal and the pipeline continues where continuing is
 * meaningful. A runtime that stopped at the first refusal could only ever report the happy path.
 */

import type { Pricing } from "./meter";
import { acceptanceGateFor, chainFor, chainOf, missingGates, producesCode } from "./gate-demand";
import { parseRequestRef } from "./request";
import {
  assignHat,
  eligibleFor,
  type Candidate,
} from "./assignment-engine";
import {
  EMPTY_BOARD,
  recordDecision,
  resolveAnchor,
  type AnchorBoard,
  type EvidenceRef,
} from "./discussion-anchor";
import {
  DEFAULT_CHURN_THRESHOLD,
  decideEscalation,
  detectChurn,
  escalationDeciderFor,
  EscalationTrigger,
  type EscalationAction,
  type EscalationEffect,
} from "./escalation";
import {
  accountableHatsFor,
  acceptGoal,
  assign,
  decompose,
  EMPTY_CASCADE,
  isDelivered,
  isLeafType,
  nodeById,
  setState,
  unstaffedTasks,
  WorkState,
  WorkType,
  type Cascade,
  deliveredSet,
  childrenOf,
  type CascadeNode,
} from "./goal-cascade";
import {
  branchNameIn,
  collectionsReadyToLand,
  integrationFor,
} from "./branch-topology";
import { ProcessSetting, resolveSetting, settingList, type SettingBinding } from "./practice";
import {
  advanceAll,
  beginBinding,
  bindingForHat,
  isAuthorizing,
  mayTakeHat,
  planSuccession,
  releaseBinding,
  timingFor,
  type HatBinding,
  type SuccessionPlan,
} from "./hat-binding";
import {
  receive,
  type ExternalEvent,
  type IntakeItem,
  type IntakeRefusal,
  type UnreproducedPolicy,
  externalRefOf,
} from "./intake";
import { bindWearerToLoop } from "./loop-policy";
import { firstLegalChooser, preferChooser, type OrgChooser } from "./org-decision";
import { reportsUpTo, type HatLevel, type OrgChart } from "./org-chart";
import { evaluateTrajectory, TrajectoryStatus, warrantsEscalation, type Trajectory } from "./mission-trajectory";
import {
  DEFAULT_PIPELINE,
  runPipeline,
  gatesOf,
  withProducers,
  type Artifact,
  type PhaseTranscript,
  type Pipeline,
  type ProducerPort,
} from "./pipeline";
import { Fidelity, fidelityLine, recordingProviders, runFidelityOf, type ChangeHandle, type ChangeProposal, type DataSourcePort, type PortResult, type ProviderSet, type ReviewVerdict, type RunFidelity,
  fidelityOf,} from "./providers";
import type { ActionItem, HandedOffChange } from "./org-fold";
import {
  acceptedDecisions,
  correlateFeedback,
  followUpOrder,
  type FeedbackDelivery,
  type FollowUpOutcome,
  type FollowUpReport,
  type FollowUpRequest,
} from "./change-followup";
import { missingSections, type ChangeRequestConfig, type DescribeRequest } from "./change-request";
import { autoApproveReview, simulatedChangeControl, simulatedIntake, simulatedTestRunner, simulatedWorkExecutor } from "./adapters";
import { associateGoal, EMPTY_BOOK, openPortfolio, type PortfolioKind } from "./portfolio";
import {
  batchesFromCascade,
  runReactor,
  type ActionKind,
  type ReactorReport,
} from "./org-reactor";
import { reconcile, type ReconciliationReport } from "./reconciliation";
import { groomingProducer } from "./grooming";
import { historyFromPhases, type ArtifactHistory } from "./artifact-deliberation";
import { findInefficiencies, type Inefficiency } from "./inefficiency";
import { bookQaBlocks, bookReviewBlocks, requestReviewsFor } from "./review-calendar";
import type { NamedDependency, WorkBatch } from "./work-batch";
import {
  computeRecommendation,
  decidePriority,
  orderByPriority,
  PriorityClass,
  workable,
  type PriorityDecision,
  type PriorityInputs,
} from "./prioritization";
import {
  deriveTestCases,
  gateOutcomeFor,
  runQaCycle,
  RunOutcome,
  type QaCycleReport,
  type TestCase,
} from "./qa";
import {
  GateKind,
  GateOutcome,
  gateOwners,
  isPassing,
  humanGatesFor,
  ORDERED_GATES,
  type HumanCheckpoint,
  type GateEvaluation,
  type GateRunResult,
  type RecoveryPath,
  NO_PROPOSER,
} from "./quality-gate";
import { authorFor, candidatesFor } from "./phase-staffing";
import type { ReputationObservation } from "./reputation";
import { sendSupervisorSignal, SignalTool, type SupervisorSignal } from "./supervisor-signal";
import {
  EMPTY_CALENDAR,
  firstCommonFreeSlot,
  scheduleBlock,
  scheduleMeeting,
  ScheduleBlockState,
  ScheduleBlockType,
  type Calendar,
} from "./work-schedule";
import {
  addShard,
  approveShard,
  claimShard,
  completeClaim,
  emptyQueue,
  mergeShard,
  reapStaleClaims,
  readout,
  type QueueReadout,
  type WorkQueue,
} from "./work-market";
import { completionsFrom, projectFor } from "./work-projection";
import { doneWithNothingMerged, projectAll, type Projection } from "./change-control";
import {
  checkIdsFor,
  runRoster,
  selectChecks,
  summarize,
  type CheckBinding,
  type CheckResult,
  type CheckSpec,
} from "./check-roster";
import { emit, OrgEventKind, render, type OrgEvent, type OrgFact } from "./org-event";

// DERIVED, never written down. This was the literal `7` while the chain held fourteen gates, so
// every completed task's own log line said it had passed half as many as it had.

/**
 * The QA verdict for work that has no test run — the upper rungs.
 *
 * `Rejected`, never `Approved`: `gateChooserFrom` routes `runtime_validation` to this value, and an
 * initiative with no tests must not be handed a green one. No non-leaf chain contains that gate
 * today, so this is a guard against a future chain that adds it rather than a live path.
 */
const NO_QA_VERDICT = {
  outcome: GateOutcome.Rejected,
  reason: "no test run belongs to this rung",
} as const;

/**
 * The gates ONE work item owes — its own type's chain, intersected with the run's pipeline.
 *
 * ── WHY THIS IS PER ITEM AND NOT PER RUN ─────────────────────────────────────
 * Both pipeline seams used to read `deps.pipeline ?? DEFAULT_PIPELINE`: one chain, every gate, for
 * every item in the run. Measured consequence, from a default run: a single implementation task
 * requested reviews for `business_context_grooming`, `customer_rfp_review` and `brd_approval` — a
 * backend hat walking the business chain, which is the "one agent does all fourteen steps"
 * complaint in its exact mechanical form.
 *
 * `chainFor` already answers what a goal, an initiative, a project or a leaf owes. It was written,
 * tested, and connected only to the read-only CLI, so the reporting surface and the executor
 * disagreed about what the organization does. This is the connection.
 *
 * ── THE RUN'S PIPELINE STILL BOUNDS IT ───────────────────────────────────────
 * Intersected rather than substituted: a caller that hands in a short pipeline — a spike lane, a
 * hotfix process — means it, and a work type's chain must not smuggle gates back in past a process
 * somebody deliberately narrowed. So the item owes what BOTH agree on, in the run's own order.
 *
 * An EMPTY intersection means the run's pipeline covers none of this type's gates. It walks
 * nothing rather than falling back to the whole pipeline, because the fallback is the defect.
 */
function chainForTask(node: CascadeNode, pipeline: Pipeline): readonly GateKind[] {
  const owed = new Set(chainOf(node));
  return gatesOf(pipeline).filter((g) => owed.has(g));
}

/** An agent that exists and the hat it occupies in the chart. */
export interface OrgAgent {
  readonly agentId: string;
  readonly hatId: string;
}

export interface OrgRuntimeDeps extends HumanCheckpointDeps {
  readonly chart: OrgChart;
  /**
   * Dollars per million tokens, per model. Absent ⇒ every meter records tokens and no cost.
   *
   * Never defaulted. A built-in table would be stale within a week and believed anyway — the same
   * rule `requestUrl` keeps for links, for the same reason.
   */
  readonly pricing?: Pricing;
  /**
   * Resolve a phase's reference to a readable document, or `undefined` when it is not one.
   *
   * INJECTED so this runtime keeps touching nothing itself. A phase's refs are a mixed bag — paths,
   * urls, plan lines — and only the caller knows which root they are allowed to be read under. A
   * ref that does not resolve produces no `document_written` fact, so a documents view lists only
   * things it can actually open.
   */
  readonly documentAt?: (ref: string) => { readonly path: string; readonly bytes: number } | undefined;
  /**
   * What this hat already knows, put in front of it before it produces anything.
   *
   * Returns the ids that were injected, so the citations in what it produces can be checked
   * against them. Absent ⇒ agents work with no memory, which is the honest default for a run
   * nobody gave one to.
   */
  readonly recallFor?: (
    workId: string,
    hatId: string,
    gate: string,
    /**
     * The ACTOR wearing the hat, when one picked this work up.
     *
     * Passed so an agent's own calibration can be recalled. Without it `scopesFor` never sees an
     * `agentId`, the agent tier is unreachable however much is written to it, and the weight bonus
     * `weightOf` gives a memory in your own agent scope applies to a set that is empty by
     * construction. Optional because work nobody claimed has no actor, and inventing one would
     * hand a hat somebody else's record of itself.
     */
    agentId?: string,
  ) => { readonly text: string; readonly injectedIds: readonly string[] };
  /**
   * Told what a phase produced, so the ids it cited can be credited.
   *
   * Separate from `recallFor` because injecting and crediting happen at different moments and one
   * without the other is the failure this closes: injection alone can never mark a memory useless,
   * and citation alone cannot be checked.
   */
  readonly notedCitations?: (
    workId: string,
    hatId: string,
    injectedIds: readonly string[],
    produced: readonly string[],
  ) => readonly OrgFact[];
  /**
   * How many NEW goals one run may start. Absent ⇒ every accepted item is started.
   *
   * The operator's number, never a default invented here. Each goal is five work items and each
   * task walks fourteen gates that may each call a model, so an unbounded hand-over of fifty
   * tickets is a fifty-fold bill nobody chose — and a silent cap of one is how work disappeared
   * before this existed. Whatever it is set to, what it does not start is REPORTED.
   */
  readonly maxNewGoalsPerRun?: number;
  /** Work arriving from outside. */
  /**
   * The work this organization was already doing, folded from its own log.
   *
   * ── WHY A RUN MUST BE ABLE TO SEE THIS ───────────────────────────────────
   * Without it the runtime is stateless: every cycle re-accepts the same intake, mints new ids and
   * rebuilds the whole cascade, so the store fills with parallel copies of one request and nothing
   * a run learns can reach the next one. MEASURED: agents raised questions against `goal-219`,
   * a person answered all three, and the following run was working `goal-227` and received
   * `answersReceived=0` at every gate. Nothing was wrong with the answer channel.
   *
   * Absent means a fresh organization, which is the honest default for one that has never run.
   */
  readonly priorCascade?: Cascade;
  /**
   * Work ids a commit ALREADY EXISTS for, from earlier runs and earlier cycles.
   *
   * Folded from the log by the caller (`foldLandedChanges`), because "has this ever landed" is a
   * question about history and this runtime only sees now. Absent means NOT MEASURED — and the
   * verdict below treats not-measured as "do not judge", never as "nothing has landed", which is
   * the reading that turns every resumed run into a false failure.
   */
  readonly alreadyLanded?: ReadonlySet<string>;
  /**
   * Work ids whose change an earlier run already HANDED TO PEOPLE (pushed and proposed for review).
   * Folded from the log by the caller (`foldHandedOffChanges`). Such work is finished as far as the
   * organization is concerned: it is neither walked again nor proposed a second time.
   */
  readonly alreadyHandedOff?: ReadonlySet<string>;
  /**
   * The handed-off changes themselves - branch, review address, base - so an event about one of them
   * can find its work. Folded from the log by the caller (`foldHandedOffChanges`).
   */
  readonly handedOffChanges?: ReadonlyMap<string, HandedOffChange>;
  /** Every action item raised so far, open and settled, by work id. Folded by the caller (`foldActionItems`). */
  readonly actionItems?: ReadonlyMap<string, readonly ActionItem[]>;
  /**
   * What happened to handed-off changes since the last cycle - comments, updates, a target moving -
   * from webhooks or a poll of the review system. Each becomes an ACTION ITEM on its work; none is an
   * instruction. See `change-followup.ts`.
   */
  readonly feedback?: readonly FeedbackDelivery[];
  /** The branch a change targets when its handoff did not record one. */
  readonly defaultBase?: string;
  /**
   * How a finished change is put in front of people - required sections, what it may never add, how
   * it is kept current. See `change-request.ts`. Absent: the organization's own summary is proposed.
   */
  readonly changeRequests?: ChangeRequestConfig;
  /**
   * Who WRITES a merge request's description, in the configured sections. An agent's account of the
   * work, checked mechanically for every section before anything is handed off.
   */
  readonly describeChange?: (request: DescribeRequest) => Promise<PortResult<string>>;
  /**
   * The session that decides about a handed-off change's open action items - address, decline with a
   * reason, or leave for later - and, in `resolve` mode, resolves a conflicted sync.
   */
  readonly followUp?: (request: FollowUpRequest) => Promise<PortResult<FollowUpOutcome>>;
  /** Whether a change's checkout still passes after a follow-up changed it. Required before it is handed off again. */
  readonly verifyChange?: (handle: ChangeHandle) => Promise<PortResult<string>>;
  /** At most this many handed-off changes are followed up in one cycle. Default 2. */
  readonly maxFollowUps?: number;
  /**
   * Verdicts from earlier cycles and earlier runs, so a step that PASSED is not walked again.
   *
   * MEASURED on AIAGENT-1659: the goal's grooming was approved, a later step was rejected, and the
   * next cycle produced and reviewed grooming AGAIN — and that second reviewer rejected it. Real
   * agents make every re-walk a full author-and-review cycle, and an approval that can flip on a
   * re-roll is not an approval. The LATEST verdict per (item, gate) decides: passing, the step is
   * skipped; turned back, it is owed again. Folded from the log by the caller; the runtime reads none.
   */
  readonly priorGateEvaluations?: readonly GateEvaluation[];
  /**
   * The organization's SDLC settings — what the process DOES at mechanical decisions.
   *
   * Absent means every such decision takes its default, which is what every caller meant before
   * settings existed. `integration_branch` is the one this runtime reads: an epic set to `direct`
   * gives its children no feature branch and is never landed as a collection itself.
   */
  readonly settings?: readonly SettingBinding[];
  /**
   * Which checks answer which gate, and what those checks are.
   *
   * ── STRICTLY ADDITIVE, ON PURPOSE ────────────────────────────────────────
   * Bound checks are a PRECONDITION on a gate, never a replacement for its reviewer: a roster that
   * does not come back clean rejects the gate and the reviewer is not asked; a clean one changes
   * nothing and the review proceeds exactly as before. So this can only make a gate stricter. A
   * design where a green roster PASSED the gate would let a check somebody bound by mistake approve
   * work no one looked at, which is a larger thing to get wrong than a gate that asks twice.
   *
   * All three absent is the normal case, and it means the gates run as they always have.
   */
  readonly checkBindings?: readonly CheckBinding[];
  readonly checkSpecs?: readonly CheckSpec[];
  /** Verdicts already recorded, keyed `<tree>:<checkId>` — folded from the log by the caller. */
  readonly checkResults?: ReadonlyMap<string, CheckResult>;
  readonly externalEvents: readonly ExternalEvent[];
  /** Everyone available to be staffed. */
  readonly agents: readonly OrgAgent[];
  /** Reputation history the ranker reads. */
  readonly observations: readonly ReputationObservation[];
  /** The C-suite hat that accepts the goal. */
  readonly acceptingHatId: string;
  readonly resourceAuthorityHatId: string;
  /** The authority that sets priority. */
  readonly priorityDeciderHatId: string;
  readonly createId: (prefix: string) => string;
  readonly nowMs: number;
  readonly workBlockMs: number;
  /**
   * The window this goal is supposed to land inside.
   *
   * OPTIONAL, and its absence is reported rather than defaulted: a run with no declared window has
   * no pace to be measured against, and inventing one would manufacture a schedule the organization
   * never agreed to.
   */
  readonly missionWindow?: { readonly startsAtMs: number; readonly targetAtMs: number };
  /**
   * The process this run follows. Absent means the canonical thirteen phases.
   *
   * The reason the pipeline is data: a caller can reorder phases, drop them, or hand in a short
   * one for a spike, without this module deciding what every organization's process must be. What
   * stays non-negotiable is that the gates of whatever pipeline is supplied are crossed in ITS
   * order, each by an authorized hat that did not do the work.
   */
  readonly pipeline?: Pipeline;
  /**
   * What MAKES the artifact each pre-code gate judges, keyed by gate.
   *
   * Eleven of the fourteen gates had no producer. A reviewer at those phases could only approve
   * nothing or reject nothing, and both are the gate failing to evaluate the work — the run still
   * reported them crossed. Supplying producers here gives each phase a document to judge, so an
   * approval at `brd_approval` means somebody read a BRD.
   *
   * Merged with the runtime's own producers rather than replacing them: work execution and test
   * execution stay where they are, and a caller cannot accidentally unhook them.
   */
  readonly artifactProducers?: ReadonlyMap<GateKind, ProducerPort>;
  /**
   * Called as each event is recorded, so a run can be watched while it is still running.
   *
   * Everything the register knows is derivable from its events — `org-fold` rebuilds the cascade,
   * the calendar, the queues and the board from them, order-independently. So an observer needs
   * exactly this and nothing else: no second state store to drift out of step, no dashboard that
   * can disagree with the organization about what happened.
   *
   * Absent means the trace is still returned at the end, which is what it has always done.
   */
  readonly onEvent?: (event: OrgEvent) => void;
  readonly leaseMs: number;
  /** How each accepted intake item scores. Absent = a neutral score. */
  /**
   * The long-lived thing this run's goal is ABOUT.
   *
   * Optional: a goal need not belong to a portfolio, and inventing one would assert a product
   * nobody declared. Supplied, the run emits the facts that let a portfolio accumulate goals ACROSS
   * runs when the log is stored.
   */
  readonly portfolio?: {
    readonly portfolioId: string;
    readonly title: string;
    readonly kind: PortfolioKind;
    readonly ownerHatId: string;
  };
  /** Passed through to the reactor — see `ReactorDeps`. Omitted means the deterministic default. */
  readonly actionChooser?: OrgChooser<ActionKind>;
  readonly blockerFor?: (batch: WorkBatch) => NamedDependency | undefined;
  readonly depResolved?: (dep: NamedDependency, batch: WorkBatch) => boolean;
  readonly priorityInputsFor?: (item: IntakeItem) => PriorityInputs;
  /** What QA finds. Keyed by test-case id. Absent cases take `fallback`. */
  readonly qaPlan?: ReadonlyMap<string, RunOutcome>;
  readonly qaFallback?: RunOutcome;
  /**
   * The ports where this run touches reality — see `providers.ts`.
   *
   * Absent means the SIMULATED set, built from `externalEvents`, `qaPlan` and `qaFallback`: exactly
   * what the register did before these ports existed. The default is a simulation and the report
   * now says so, which is the difference between a run that shipped something and one that decided
   * it had.
   */
  readonly providers?: ProviderSet;
  /**
   * There is deliberately NO `gateChooser` here any more.
   *
   * It existed to let a caller override every gate, and once the review port arrived it could do
   * only one thing the port cannot: approve work whose TESTS FAILED. Its own test was named "a
   * caller-supplied gate chooser still cannot approve a failing QA run by itself" and then asserted
   * `delivered === true` — so the escape hatch was precisely the defect this register spent its last
   * three passes removing, kept as a documented feature.
   *
   * Worse, while it was here it made the review port DECORATIVE: the runtime still called the
   * reviewer for all six gates, discarded every verdict, and reported `review: real` as though one
   * had decided. Measured before removal — 12 calls, 12 rejections, `delivered: true`, and not one
   * refusal saying so.
   *
   * Both honest uses are already ports, so nothing was lost:
   *   - a fixed verdict on the six reviewable gates -> `agentReview(() => ...)`
   *   - a fixed runtime-validation outcome          -> `simulatedTestRunner(plan, outcome)`
   *
   * What is gone is the ability to say `delivered` over red tests, which was never a capability so
   * much as a way to make the report lie.
   */
  readonly escalationChooser?: OrgChooser<EscalationAction>;
  readonly priorityChooser?: OrgChooser<PriorityClass>;
  readonly maxGateAttempts?: number;
  readonly churnThreshold?: number;
  /**
   * Which staffed work this run delivers ITSELF. Absent means all of it — the behaviour this
   * runtime has always had.
   *
   * Pass `[]` and the runtime staffs, schedules and runs QA but delivers nothing, leaving the work
   * live for an agent to pick up and deliver through `deliverWorkItem`.
   *
   * WHY THIS HAS TO EXIST. The agent loop is offered `candidatesFrom`, which is live leaves only.
   * A runtime that delivers everything before the loop is consulted leaves ZERO candidates, so the
   * agent's only legal choices are heartbeats and free time — and its decision is decorative no
   * matter how honestly the dispatcher is wired underneath. Measured: every cycle of the demo run
   * chose `EmitHeartbeat` over an empty candidate list, with a fully-wired dispatcher behind it
   * that never once ran.
   *
   * So this is not a convenience flag. It is what makes an agent's choice CAPABLE of being
   * load-bearing: someone has to leave the work undone for the agent to do it.
   */
  readonly deliverSelf?: readonly string[];
  /**
   * What agents READ from — a git repository, a directory of specs, a union of both.
   *
   * Absent means `business_context_grooming` stays a judgement-only phase, which is what it has
   * always been. Supplying one gives that phase a producer, so grooming cites documents at a
   * revision instead of approving a title.
   *
   * A PORT like the other five, so it appears in the run's fidelity report: a run groomed against
   * a fixture says so, and cannot be mistaken for one that read a repository.
   */
  readonly dataSource?: DataSourcePort;
  /** Wearers per hat the RMO has authorized. */
  readonly supplyTarget?: number;
}

/**
 * Where a person must sign off, and how their answer arrives.
 *
 * Separated into its own shape because the two halves must travel TOGETHER. Checkpoints with no way
 * to answer them is an organization that stops and cannot be restarted; an answer path with no
 * checkpoints is a door nobody knocks on.
 */
export interface HumanCheckpointDeps {
  /**
   * The checkpoints an operator turned on. EMPTY BY DEFAULT — with none configured the run is
   * exactly what it was before this existed, which is what every current caller depends on.
   */
  readonly checkpoints?: readonly HumanCheckpoint[];
  /**
   * What a person has decided about one work item's gate, if anything.
   *
   * Supplied by the caller because the caller is what read the queue. The runtime does not reach
   * for it mid-walk: a run that could read new instructions between two gates would be deciding
   * against a moving input, and its trace would not replay.
   */
  readonly humanDecisionFor?: (
    workId: string,
    gate: GateKind,
  ) => { readonly outcome: GateOutcome; readonly actionRef: string } | undefined;
}

export interface OrgRuntimeReport {
  readonly intakeAccepted: readonly IntakeItem[];
  readonly intakeRefused: readonly IntakeRefusal[];
  readonly priorities: readonly PriorityDecision[];
  readonly goalWorkId?: string;
  readonly cascade: Cascade;
  readonly bindings: readonly HatBinding[];
  readonly succession: readonly SuccessionPlan[];
  readonly calendar: Calendar;
  readonly board: AnchorBoard;
  readonly queue: WorkQueue;
  readonly queueReadout: QueueReadout;
  readonly qa: readonly QaCycleReport[];
  readonly testCases: readonly TestCase[];
  readonly gateRuns: readonly { readonly taskId: string; readonly run: GateRunResult }[];
  readonly gateEvaluations: readonly GateEvaluation[];
  readonly gateBlocked: readonly { readonly taskId: string; readonly gate: GateKind; readonly recovery?: RecoveryPath }[];
  /**
   * Work stopped ON PURPOSE, waiting for a person — never a failure, and reported apart from one.
   *
   * A run that stopped at a checkpoint is not a run that failed. Folding this into `gateBlocked`
   * would make an organization waiting politely for its operator indistinguishable from one that
   * kept failing its own reviews, and the second reads as broken.
   */
  readonly awaitingHuman: readonly { readonly taskId: string; readonly gate: GateKind }[];
  /**
   * Questions the organization's own agents asked, that only a person can answer.
   *
   * DIFFERENT FROM `awaitingHuman`, which is a CHECKPOINT — a gate the operator chose to stop at,
   * decided in advance, the same for every item that crosses it. This is an agent, mid-step,
   * finding that it does not know something and saying so in its own words. One is policy; the
   * other is the organization discovering the limits of what it was told.
   *
   * The hat is whoever was doing the step, taken from staffing — never a hat named in this file.
   * Which questions get asked is the agent's business and appears here verbatim.
   */
  readonly questionsForHuman: readonly {
    readonly taskId: string;
    readonly gate: GateKind;
    readonly byHatId: string;
    readonly question: string;
  }[];
  /**
   * What steps worked out along the way, and which hat worked it out.
   *
   * ── WHY THE ORGANIZATION CARRIES THIS AT ALL ─────────────────────────────
   * Memories came from two places: a STUDY session, where a hat reads something on purpose, and a
   * CALIBRATION, where the organization observes how an agent performed. Neither covers the case
   * that matters most - an agent, mid-task, working out how a difficult thing is actually done
   * here. That knowledge died with the process, and the next agent rediscovered it.
   *
   * The HAT, not the agent, because a lesson about how this codebase is built belongs to the role
   * and is inherited by whoever wears it next; a lesson about an agent's own tendencies is what
   * calibration already records.
   */
  readonly learnings: readonly {
    readonly workId: string;
    readonly gate: GateKind;
    readonly byHatId: string;
    readonly key: string;
    readonly value: string;
  }[];
  readonly escalations: readonly {
    readonly taskId: string;
    readonly action: EscalationAction;
    readonly effect: EscalationEffect;
    readonly byHatId: string;
  }[];
  readonly signals: readonly SupervisorSignal[];
  /** What the dev's own observe loop was offered and what it picked. */
  readonly loopTicks: readonly {
    readonly agentId: string;
    readonly hatId: string;
    readonly offered: number;
    readonly pickedWorkId?: string;
  }[];
  readonly levelsEngaged: readonly HatLevel[];
  /**
   * Each executable task as a CHANGE, in the canonical lifecycle's vocabulary, with any place the
   * two records disagree. Derived from what the organization did, never set.
   */
  readonly changes: readonly {
    readonly workId: string;
    readonly projection: Projection;
    readonly disagreements: readonly string[];
  }[];
  /**
   * The work ids whose change the CHANGE-CONTROL PORT opened and merged for real.
   *
   * Distinct from `changes` on purpose: that is what the organization DECIDED, this is what a
   * repository will agree to. Under the simulated adapter they coincide, and the distinction only
   * pays when they do not — which is the case worth being able to see.
   */
  readonly changesLanded: readonly string[];
  /** Done in the cascade with no commit anywhere. Empty when the caller supplied no history. */
  readonly changesDoneUnmerged: readonly string[];
  /** The work ids whose change was handed to people for review in this run - pushed and proposed, never merged. */
  readonly changesHandedOff: readonly string[];
  /** Action items raised this cycle from feedback on handed-off changes. Optional so older fixtures still type. */
  readonly actionItemsRaised?: readonly string[];
  /** Handed-off changes the organization followed up this cycle, and what came of it. */
  readonly followUps?: readonly FollowUpReport[];
  readonly delivered: boolean;
  /**
   * What happened, as TYPED events — queryable by subject, by actor, and by LINE OF AUTHORITY.
   *
   * Each carries a supervisor chain computed from the chart, so "everything the CTO's organization
   * decided" is answerable without knowing who reports to the CTO. `events` is these rendered; the
   * structure is the record and the prose is the reading.
   */
  readonly trace: readonly OrgEvent[];
  readonly events: readonly string[];
  readonly refusals: readonly string[];
  /**
   * THE CYCLE DOES NOT STOP AT THE BOTTOM OF THIS FUNCTION.
   *
   * Everything above is a pipeline: intake, then priority, then cascade, then staffing, once, in
   * source order. A pipeline cannot notice a stall, because its next step is whatever comes next in
   * the file — so a batch going nowhere in phase four produces nothing at all and phase five runs
   * regardless. The reactor takes what the pipeline produced and runs it as a WORK QUEUE until the
   * organization has nothing left to do, deriving each next action from what just happened.
   *
   * The two outcomes it distinguishes are the point: `quiesced` means finished, and the step bound
   * means a reaction rule is producing work faster than the loop consumes it. Its `raised` list is
   * management work the run created for a hat and deliberately did not perform.
   */
  readonly reactor: ReactorReport;
  /**
   * Which adapter answered each port, and whether this run is replayable.
   *
   * DERIVED from the providers rather than declared. A run that reached a shell or a network and
   * called itself deterministic is the claim `providers.ts` exists to make unsayable by accident.
   */
  readonly fidelity: RunFidelity;
  /**
   * Whether the work is keeping pace with its own window — `undefined` when none was declared.
   *
   * `undefined` rather than an `on_track` stand-in, for the reason this register keeps repeating:
   * a reading nobody took must not be reported as a good one.
   */
  readonly trajectory: Trajectory | undefined;
  /**
   * Whether reality agrees with what this run believes — the north-star loop's last step.
   *
   * Always present, and always reporting what it could NOT check: the tracker is compared only
   * when one was supplied, and a reconciliation that skipped a party says so rather than counting
   * its silence as agreement.
   */
  readonly reconciliation: ReconciliationReport;
  /**
   * What each work item's phases PRODUCED, as an artifact history a hat can cite and revise.
   *
   * `openArtifact` had zero callers outside tests, so no run ever produced one of these and the
   * whole deliberation layer was unreachable: no hat could be offered a turn, because a turn cites
   * a revision and no revision existed. The pipeline was already making the thing — every phase
   * with a producer returns an artifact — and this is that, translated.
   *
   * A work item whose phases produced nothing is ABSENT from the map rather than present and
   * empty: an artifact with no content is a document claiming the run made something.
   */
  readonly artifacts: ReadonlyMap<string, ArtifactHistory>;
  /**
   * Frictions that recurred across DIFFERENT work items this run — the organization noticing that
   * something keeps going wrong rather than that one thing went wrong.
   *
   * Reported as well as signalled: the signal travels the chain and this is what a reader of the
   * run sees without folding the log.
   */
  readonly inefficiencies: readonly Inefficiency[];
  /**
   * Tasks whose loop an escalation STOPPED, and which action stopped it.
   *
   * The difference between "this run finished" and "this run gave up" — a driver that cannot tell
   * them apart will either spin on a halted task or stop on a healthy one.
   */
  readonly halted: readonly { readonly taskId: string; readonly action: EscalationAction; readonly byHatId: string }[];
}

const NEUTRAL_INPUTS: PriorityInputs = {
  executivePriority: 0,
  customerImpact: 0,
  severity: 0,
  releaseRisk: 0,
  blockedDownstreamCount: 0,
  dependencyFanOut: 0,
  queueAgeMs: 0,
  hatScarcity: 0,
  budgetBurn: 0,
  estimatedEffort: 0,
};

const STAFFING_EVIDENCE: readonly EvidenceRef[] = [{ kind: "measurement", ref: "queue/unstaffed" }];

const LEVEL_ORDER: readonly HatLevel[] = [
  "executive_board",
  "c_suite",
  "director",
  "manager",
  "lead",
  "individual_contributor",
];

/**
 * The ports a run uses when the caller named none — EVERY ONE SIMULATED.
 *
 * Exported because a second caller needs the same answer, and the one thing every entry point must
 * agree on is what "unspecified" means: that is the answer deciding whether a run touched anything
 * real. A copy of this object elsewhere would be a second set of defaults to drift, and the drift
 * would show up as a fidelity report naming a capability that never ran.
 */
export function defaultProviderSet(deps: {
  readonly externalEvents: OrgRuntimeDeps["externalEvents"];
  readonly qaPlan?: OrgRuntimeDeps["qaPlan"];
  readonly qaFallback?: OrgRuntimeDeps["qaFallback"];
}): ProviderSet {
  return {
    intake: simulatedIntake(deps.externalEvents),
    work: simulatedWorkExecutor(true),
    tests: simulatedTestRunner(deps.qaPlan ?? new Map(), deps.qaFallback ?? RunOutcome.Passed),
    review: autoApproveReview(),
    change: simulatedChangeControl(),
  };
}

/**
 * What an agent working this item is told the requester wrote — the whole ticket.
 *
 * The body when there is one (description and every comment), the reproduction when it is all
 * there is, the tracker parent it was filed under, and — when the reproduction is OWED — a line
 * saying so, because an agent not told the reproduction is its first job will start on a fix for
 * a defect nobody has observed.
 */
export function briefOf(item: IntakeItem): string | undefined {
  const parts: string[] = [];
  if (item.body !== undefined && item.body !== "") parts.push(item.body);
  else if (item.reproduction !== undefined && item.reproduction !== "") parts.push(item.reproduction);
  // WHAT KIND OF REQUEST this is, and where it was filed. An agent describing the system around a
  // DEFECT is documenting what exists; around a feature it is the ground a design is drawn on — and
  // a project-rung agent could otherwise only see that its own node is a `project`.
  parts.push(
    `This request is a ${String(item.kind).replace(/_/g, " ")}` +
      (item.parentExternalId === undefined
        ? "."
        : `, filed under ${item.parentExternalId}${item.parentTitle === undefined ? "" : ` — ${item.parentTitle}`}.`),
  );
  // NO "REPRODUCTION IS OWED" SENTENCE. It used to be appended here, and so it sat on EVERY rung's
  // description — MEASURED, a reviewer judging the goal's grooming rejected it for not having
  // established a reproduction, which is the defect leaf's `reproduction` step and not grooming's.
  // The obligation is a step on the item that owes it; a sentence copied to every rung is not.
  if (item.reproductionOwed === true) parts.push("No reproduction steps were supplied with this ticket.");
  return parts.length === 0 ? undefined : parts.join("\n\n");
}

/**
 * What each rung above this intake owes, when it is a defect and the organization said: `none` owes
 * nothing, a LIST owes those gates on the rung whose chain carries each. `full` or unset is
 * `undefined` — the register's own chains.
 *
 * Resolved against the TICKET and the EPIC it was filed under, nearest first, so a programme can
 * keep the full ladder for its defects while the organization at large does not.
 */
export function upperRungChainFor(
  item: IntakeItem,
  settings: readonly SettingBinding[] | undefined,
): { readonly owesAt: (rung: WorkType) => readonly GateKind[]; readonly value: string; readonly why: string } | undefined {
  if (item.workType !== WorkType.Defect) return undefined;
  const ticket = parseRequestRef(item.externalRef)?.externalId;
  const candidates = [
    ...(ticket === undefined ? [] : [ticket]),
    ...(item.parentExternalId === undefined ? [] : [item.parentExternalId]),
  ];
  const r = resolveSetting(settings ?? [], ProcessSetting.DefectRungGates, candidates);
  if (r.value === undefined || r.value === "full") return undefined;
  const list = r.value === "none" ? [] : settingList(ProcessSetting.DefectRungGates, r.value);
  // AN UNREADABLE VALUE IS NOT `none`. Validation refuses it at bind time; one that reached here
  // anyway keeps the full ladder rather than silently dropping every gate above the defect.
  if (list === undefined) return undefined;
  return {
    owesAt: (rung) => chainFor(rung).filter((g) => list.includes(String(g))),
    value: r.value,
    why: r.why ?? r.because,
  };
}

/** The organization's `unreproduced_defects` setting, or the register's refusal when unset. */
export function unreproducedPolicyOf(settings: readonly SettingBinding[] | undefined): UnreproducedPolicy {
  const v = resolveSetting(settings ?? [], ProcessSetting.UnreproducedDefects, []).value;
  return v === "reproduce_first" ? "reproduce_first" : "refuse";
}

/**
 * Run the whole organization once.
 *
 * Long and linear on purpose: the value of this function is that the entire pipeline is readable in
 * the order it happens. Splitting it into ten helpers would hide the one thing it exists to show —
 * that these modules compose.
 */
export async function runOrgRuntime(deps: OrgRuntimeDeps): Promise<OrgRuntimeReport> {
  // The ports, resolved ONCE. Defaulting here rather than at each call site means one place decides
  // what this run is touching, and one place reports it.
  // The data source joins the set, so the fidelity report counts it. Merged HERE rather than being
  // asked of the caller twice: `deps.dataSource` is where a run declares one, and a set that
  // disagreed with it would report a fidelity the run did not have.
  const declared: ProviderSet = deps.providers ?? defaultProviderSet(deps);
  const configured: ProviderSet =
    deps.dataSource === undefined ? declared : { ...declared, dataSource: deps.dataSource };
  // WRAPPED, so the report can say what the run DID and not only what it was configured to do.
  // `providers` below is the recording set; nothing in this function may reach the raw one, or the
  // count would silently miss whatever bypassed it.
  const recorder = recordingProviders(configured);
  const providers = recorder.providers;

  // A FUNCTION, not a value. Computed once at the top it would be the configuration and nothing
  // else — which is exactly the claim being narrowed here — and every early return below would
  // record a run's reach before the run had a chance to reach anything.
  const fidelityNow = (): RunFidelity => runFidelityOf(configured, recorder.invoked());

  // ── WHICH CLOCK THE METERS READ, decided ONCE from the configuration ──────
  // Deliberately not `fidelityNow()`: that narrows as the run proceeds, so the clock would change
  // partway through and two runs could disagree about when they switched. The CONFIGURED set is
  // fixed before anything is invoked, which is the only thing a clock choice may depend on.
  const replayableByConfiguration = fidelityOf(configured).replayable;

  const trace: OrgEvent[] = [];
  const refusals: string[] = [];

  /**
   * Record one event.
   *
   * The supervisor chain is computed inside `emit` from the chart, so a caller here cannot pass a
   * wrong one — which is the only reason recording it is worth anything.
   */
  /**
   * THE ONE PLACE AN EVENT ENTERS THE TRACE.
   *
   * Written as a helper rather than inlined because it was inlined first, in `note`, and a test
   * caught what that missed: the reactor produces its own events and merged them in bulk further
   * down, so they reached the trace and never reached an observer. A watcher would have shown a
   * run that quietly stopped emitting near the end.
   *
   * An observer that THROWS must not take the organization down with it. A dashboard is a reader,
   * and a reader that can halt the thing it reads is not observability, it is a new failure mode.
   */
  const record = (event: OrgEvent): void => {
    trace.push(event);
    try {
      deps.onEvent?.(event);
    } catch {
      // Deliberately swallowed. The run's own trace is unaffected, and a broken observer shows up
      // as a gap in what IT wrote rather than as a run that stopped.
    }
  };

  const note = (input: Parameters<typeof emit>[2]): void => {
    record(emit(deps.chart, deps.createId("evt"), input));
  };
  /**
   * A verdict into the log THE MOMENT IT IS MADE, so observe is current while the walk continues.
   * The walk's own summary event still records the whole list at the end; the fold keys verdicts on
   * their content, so the same verdict recorded twice is one verdict.
   */
  const verdictNow =
    (workId: string) =>
    (evaluation: GateEvaluation): void => {
      note({
        kind: OrgEventKind.QualityGateEvaluation,
        subjectId: workId,
        actorHatId: evaluation.byHatId,
        decision: `'${String(evaluation.gate)}' ${String(evaluation.outcome)}`,
        atMs: evaluation.atMs,
        fact: { kind: "gates_evaluated", evaluations: [evaluation] },
      });
    };
  const levels = new Set<HatLevel>();
  const engage = (hatId: string): void => {
    const l = deps.chart.byId.get(hatId)?.level;
    if (l !== undefined) levels.add(l);
  };

  // ── 1. INTAKE ─────────────────────────────────────────────────────────────
  const accepted: IntakeItem[] = [];
  const refusedIntake: IntakeRefusal[] = [];
  const seen = new Set<string>();
  // Inbound work comes through the PORT. A refusal is recorded and the run continues with nothing
  // rather than crashing: an unreachable inbox is an organization with no new work, not a broken one.
  const polled = await providers.intake.poll();
  if (!polled.ok) refusals.push(`intake source '${providers.intake.meta.name}': ${polled.reason}`);
  const inbound = polled.ok ? polled.value : [];
  for (const raw of inbound) {
    const r = receive(raw, {
      itemId: deps.createId("in"),
      nowMs: deps.nowMs,
      seen,
      // THE ORGANIZATION'S OWN ANSWER to "what about a defect nobody reproduced yet". Unset keeps
      // the register's refusal; `reproduce_first` admits it with the reproduction owed.
      unreproduced: unreproducedPolicyOf(deps.settings),
    });
    if (!r.ok) {
      refusedIntake.push(r.refusal);
      refusals.push(`intake: ${r.refusal.reason} — ${r.refusal.message}`);
      // AND AS A FACT, so the decline survives the run. Somebody filed this and is waiting; a
      // refusal that lives only in a run's refusal list is an answer they will never receive.
      note({
        kind: OrgEventKind.Refusal,
        subjectId: externalRefOf(raw.source, raw.externalId),
        decision: `intake refused: ${r.refusal.reason} — ${r.refusal.message}`,
        atMs: deps.nowMs,
        fact: {
          kind: "intake_refused",
          reason: String(r.refusal.reason),
          message: r.refusal.message,
          title: raw.title,
          // The key is minted from the RAW event rather than read off the refusal, because a
          // refusal has no key: the point at which one is minted is the point the item was
          // accepted. A declined request still has an identity upstream, and the filer knows it.
          externalRef: externalRefOf(raw.source, raw.externalId),
        },
      });
      continue;
    }
    seen.add(r.value.externalRef);
    accepted.push(r.value);
    note({
      kind: OrgEventKind.IntakeReceived,
      subjectId: r.value.itemId,
      decision: `intake accepted '${r.value.title}' (${r.value.kind}, ${r.value.severity})`,
      toState: r.value.state,
      atMs: deps.nowMs,
      evidenceRefs: [r.value.externalRef],
      fact: { kind: "intake_accepted", item: r.value },
    });
  }

  // ── 2. PRIORITIZE ─────────────────────────────────────────────────────────
  const priorities: PriorityDecision[] = [];
  for (const item of accepted) {
    const rec = computeRecommendation(
      item.itemId,
      deps.priorityInputsFor?.(item) ?? NEUTRAL_INPUTS,
      [],
    );
    const decided = decidePriority(deps.chart, {
      recommendation: rec,
      deciderHatId: deps.priorityDeciderHatId,
      chooser: deps.priorityChooser ?? preferChooser<PriorityClass>(rec.priorityClass, "as recommended"),
    });
    if (!decided.ok) {
      refusals.push(`priority for ${item.itemId}: ${decided.reason}`);
      continue;
    }
    priorities.push(decided.decision);
    engage(decided.decision.decidedByHatId);
    note({
      kind: OrgEventKind.PriorityDecision,
      subjectId: item.itemId,
      actorHatId: decided.decision.decidedByHatId,
      decision: `priority '${decided.decision.priorityClass}' (recommended '${decided.decision.recommended}')`,
      fromState: decided.decision.recommended,
      toState: decided.decision.priorityClass,
      atMs: deps.nowMs,
      evidenceRefs: decided.decision.reasonCodes,
      fact: {
        kind: "priority_decided",
        workId: item.itemId,
        priorityClass: decided.decision.priorityClass,
        decidedByHatId: decided.decision.decidedByHatId,
        reason: decided.decision.reason,
        recommended: decided.decision.recommended,
        reasonCodes: decided.decision.reasonCodes,
      },
    });
  }
  const ordered = orderByPriority(priorities);
  const queueOfWork = workable(priorities);
  note({
    kind: OrgEventKind.PriorityDecision,
    subjectId: "portfolio",
    actorHatId: deps.priorityDeciderHatId,
    decision: `prioritized ${ordered.length} item(s); ${queueOfWork.length} workable`,
    atMs: deps.nowMs,
  });

  /** Write the run's fidelity into the LOG. Called on every path out of this function. */
  const noteFidelity = (subjectId: string, atMs: number): RunFidelity => {
    const f = fidelityNow();
    note({
      kind: OrgEventKind.RunFidelity,
      subjectId,
      decision: fidelityLine(f),
      atMs,
      fact: { kind: "run_fidelity", report: f },
    });
    return f;
  };

  /**
   * An early return is still a run, and it still has to say what it could and did reach.
   *
   * THE DEFECT THIS CLOSES. The fact was emitted at the end of the happy path only, so all three
   * `return empty()` paths wrote nothing. `empty()` carried `fidelity` in the RETURNED report, so a
   * live caller was fine and the store was not: measured on a run with no workable goal, persisted
   * exactly as both CLIs persist, the run record said `{"replayable":true,"realPorts":[]}` and the
   * event log said `[]`. Two records of one fact in one store, disagreeing — and `--resume`, which
   * reads the log, printed "no run recorded its fidelity — UNKNOWN, not simulated" for a run whose
   * fidelity was sitting in the same store.
   *
   * Same shape as the `runOrgCycle` early return closed one pass earlier, in that pass's own words,
   * and its sibling was never checked.
   */
  /**
   * The mission's pace, measured over the cascade's own leaves.
   *
   * DELIVERED over TOTAL, counted from the cascade rather than from a separately-maintained number,
   * so the pace cannot disagree with the work. Absent window -> `undefined`, never a stand-in.
   */
  const trajectoryOf = (nodes: readonly CascadeNode[]): Trajectory | undefined => {
    const w = deps.missionWindow;
    if (w === undefined) return undefined;
    const leaves = nodes.filter((n) => isLeafType(n.workType));
    return evaluateTrajectory({
      missionId: "mission",
      startsAtMs: w.startsAtMs,
      targetAtMs: w.targetAtMs,
      nowMs: deps.nowMs,
      delivered: leaves.filter((n) => n.state === WorkState.Done).length,
      total: leaves.length,
    });
  };

  const empty = (): OrgRuntimeReport => ({
    fidelity: noteFidelity("run", deps.nowMs),
    halted: [],
    // An early return waited for nobody: it never reached a gate, so no checkpoint was hit.
    awaitingHuman: [],
    questionsForHuman: [],
    learnings: [],
    // An early return ran no phases, so it produced no artifact. Empty rather than a map of empty
    // histories: an artifact with no content would claim the run made something.
    artifacts: new Map(),
    // Nothing ran, so nothing recurred. An empty list is the true reading of a run that did
    // no work, and is not the same claim as "this organization is efficient".
    inefficiencies: [],
    // An early return reconciled NOTHING, and that is what it reports: no items, no disagreements,
    // and the tracker listed as unchecked. `fullyReconciled` is false over it, which is correct —
    // a run that did nothing has not established that anything agrees.
    reconciliation: reconcile({
      cascade: [],
      changesLanded: [],
      changesUnlanded: [],
      gateEvaluations: [],
      delivered: false,
    }),
    // An early return has done no work, so its pace is measured over an empty cascade — which the
    // trajectory reports as NOT STARTED rather than as on track.
    trajectory: trajectoryOf([]),
    // An empty run still gets a REAL reactor report over an empty organization, not a hand-written
    // stub: it quiesces immediately because there is nothing to do, which is the true answer and
    // the same one the loop would give. A fabricated `quiesced: true` would be indistinguishable
    // from a run that finished, which is exactly the distinction the field exists to carry.
    reactor: runReactor(
      {
        chart: deps.chart,
        cascade: EMPTY_CASCADE,
        testRuns: [],
        gateEvaluations: [],
        createId: deps.createId,
        nowMs: deps.nowMs,
      },
      [],
    ),
    intakeAccepted: accepted,
    intakeRefused: refusedIntake,
    priorities: ordered,
    cascade: EMPTY_CASCADE,
    bindings: [],
    succession: [],
    calendar: EMPTY_CALENDAR,
    board: EMPTY_BOARD,
    queue: emptyQueue("q", "none"),
    queueReadout: readout(emptyQueue("q", "none"), deps.nowMs),
    qa: [],
    testCases: [],
    gateRuns: [],
    gateEvaluations: [],
    gateBlocked: [],
    escalations: [],
    signals: [],
    loopTicks: [],
    levelsEngaged: [...levels].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b)),
    changes: [],
    changesLanded: [],
    changesDoneUnmerged: [],
    changesHandedOff: [],
    delivered: false,
    trace,
    events: trace.map(render),
    refusals,
  });

  const top = queueOfWork[0];
  if (top === undefined) {
    refusals.push("nothing workable — no goal to cascade");
    return empty();
  }
  const topItem = accepted.find((i) => i.itemId === top.workId);
  if (topItem === undefined) return empty();

  // ── 3. CASCADE — EVERY ITEM THAT WAS HANDED OVER ──────────────────────────
  // In QUEUE ORDER, so the highest-priority item is started first and a cap bites on the least
  // urgent. Until this loop existed only `queueOfWork[0]` was cascaded and everything else was
  // accepted, prioritised, counted and dropped — an organisation with 124 hats worked one item at
  // a time and a second hand-over vanished without a word.
  let cascade: Cascade = EMPTY_CASCADE;
  const startedGoals: { readonly goalId: string; readonly item: (typeof accepted)[number]; readonly resumed?: boolean }[] = [];

  for (const queued of queueOfWork) {
    const item = accepted.find((i) => i.itemId === queued.workId);
    if (item === undefined) continue;

    if (deps.maxNewGoalsPerRun !== undefined && startedGoals.length >= deps.maxNewGoalsPerRun) {
      // NOT SILENT. Recorded per item rather than as one summary line, because the question a
      // person asks is "where is MY ticket" and an aggregate cannot answer it. The event is
      // durable, so a resumed run still shows what was waiting and behind what.
      note({
        kind: OrgEventKind.DecisionRecorded,
        subjectId: item.externalRef,
        decision:
          `accepted and NOT started this run — this run was capped at ` +
          `${String(deps.maxNewGoalsPerRun)} new goal(s). It stays in the queue and is picked up ` +
          `when it reaches the top.`,
        toState: "accepted_not_started",
        // The intake clock, not the walk's: this is decided at intake time, before any hat warms.
        atMs: deps.nowMs,
        evidenceRefs: [item.itemId],
      });
      refusals.push(
        `'${item.title}' was accepted and not started — this run was capped at ${String(deps.maxNewGoalsPerRun)} new goal(s)`,
      );
      continue;
    }

    // ── ALREADY UNDERWAY? THEN CARRY IT ON ────────────────────────────────
    // Matched on `requestRef`, the intake-minted link back to whatever asked — the one identifier
    // that is stable across runs. Minting a second goal for a request already being worked is how
    // an organization ends up with two of everything and finishes neither.
    const already =
      deps.priorCascade === undefined
        ? undefined
        : deps.priorCascade.nodes.find(
            (n) => n.workType === WorkType.Goal && n.requestRef === item.externalRef,
          );

    if (already !== undefined) {
      // THE WHOLE SUBTREE, with the states it reached. A goal grafted without its children would
      // be decomposed again below and the finished work redone; a subtree grafted without its
      // states would be redone anyway, one rung lower.
      const keep = new Set<string>([already.workId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of deps.priorCascade?.nodes ?? []) {
          if (n.parentWorkId !== undefined && keep.has(n.parentWorkId) && !keep.has(n.workId)) {
            keep.add(n.workId);
            grew = true;
          }
        }
      }
      cascade = { nodes: [...cascade.nodes, ...(deps.priorCascade?.nodes ?? []).filter((n) => keep.has(n.workId))] };
      startedGoals.push({ goalId: already.workId, item, resumed: true });
      engage(deps.acceptingHatId);
      note({
        kind: OrgEventKind.WorkItemTransition,
        subjectId: already.workId,
        actorHatId: deps.acceptingHatId,
        decision: `resumed '${item.title}' — ${String(keep.size)} work item(s) already exist for this request`,
        toState: already.state,
        atMs: deps.nowMs,
      });
      continue;
    }

    const thisGoalId = deps.createId("goal");
    // WHAT THE RUNGS ABOVE THIS OWE, decided here and recorded on each — see `upperRungChainFor`.
    const upper = upperRungChainFor(item, deps.settings);
    const goal = acceptGoal(cascade, deps.chart, {
      workId: thisGoalId,
      title: item.title,
      acceptingHatId: deps.acceptingHatId,
      ...(upper === undefined ? {} : { owes: upper.owesAt(WorkType.Goal) }),
      // THE LINK BACK TO WHATEVER ASKED. `externalRef` is minted by intake and, until this line,
      // went no further than the intake item — so the organization could not answer "what did we
      // do about this request" from its own work, in any run.
      requestRef: item.externalRef,
      // WHAT THE REQUESTER WROTE, carried past intake — THE WHOLE TICKET. This line used to read
      // `brief: item.reproduction` under this same comment, so an agent got the steps and never
      // the impact, the session id, or the reporter's suspected cause. Measured on AIAGENT-1659.
      ...((b) => (b === undefined ? {} : { brief: b }))(briefOf(item)),
    });
    if (!goal.ok) {
      // ONE refusal, not the whole run. A goal the chart will not accept is that item's problem;
      // failing the run for it would let one bad ticket stop every good one behind it.
      refusals.push(`accept goal for '${item.title}': ${goal.reason}`);
      continue;
    }
    cascade = goal.cascade;
    startedGoals.push({ goalId: thisGoalId, item });
    engage(deps.acceptingHatId);
    note({
      kind: OrgEventKind.WorkItemTransition,
      subjectId: thisGoalId,
      actorHatId: deps.acceptingHatId,
      decision: `accepted '${item.title}' as a goal`,
      toState: "open",
      atMs: deps.nowMs,
      fact: {
        kind: "work_created",
        workId: thisGoalId,
        workType: WorkType.Goal,
        title: item.title,
        ownerHatId: deps.acceptingHatId,
        requestRef: item.externalRef,
        // ON THE FACT TOO, or a replayed organization loses what the requester said and its agents
        // start asking for detail the person supplied at intake. The round-trip test is what
        // catches this: the run held a brief the fold did not.
        ...((b) => (b === undefined ? {} : { brief: b }))(briefOf(item)),
        ...(upper === undefined ? {} : { owes: upper.owesAt(WorkType.Goal) }),
      },
    });
    if (upper !== undefined) {
      // SAID, not only done: a reader of the log must be able to see why this defect's goal,
      // initiative and project carry no BRD, cost or architecture gates, and who decided that.
      note({
        kind: OrgEventKind.DecisionRecorded,
        subjectId: thisGoalId,
        actorHatId: deps.acceptingHatId,
        decision:
          `defect_rung_gates=${upper.value}: the rungs above '${item.title}' owe ` +
          `${[WorkType.Goal, WorkType.Initiative, WorkType.Project].flatMap((t) => upper.owesAt(t)).join(", ") || "no gates"} — ${upper.why}`,
        atMs: deps.nowMs,
      });
    }
  }

  const firstGoal = startedGoals[0];
  if (firstGoal === undefined) {
    refusals.push("nothing workable — no goal could be accepted");
    return empty();
  }
  // The run's own identity for the goal-keyed records below (fidelity, pace, the delivery line).
  // The FIRST started goal, which is the highest-priority item — the one a reader means when they
  // ask what this run was about.
  const goalId = firstGoal.goalId;

  // The goal is ABOUT a long-lived thing, when the caller named one. Two facts rather than one:
  // opening the container and pointing a goal at it are separate acts, and a log that conflated
  // them could not tell a new product from a new goal on an existing one.
  if (deps.portfolio !== undefined) {
    const pf = deps.portfolio;
    // VALIDATED BEFORE IT IS RECORDED. The fold replays facts and cannot re-check them, so writing
    // the fact directly would let a portfolio be opened with an owner too junior to hold it and the
    // seniority rule would never run — the rule would exist and never fire, which is the vacuity
    // class with an extra step.
    const openedBook = openPortfolio(EMPTY_BOOK, deps.chart, pf);
    if (!openedBook.ok) refusals.push(`portfolio: ${openedBook.reason}`);
    else {
      // EVERY goal this run started, not just the first. A portfolio spans goals — associating
      // one and dropping the rest is how a portfolio ends up with exactly one goal in it, which
      // `foldPortfolioBook` already notes is the same as not having one.
      let book = openedBook.book;
      let associatedAll = true;
      for (const started of startedGoals) {
        const one = associateGoal(book, started.goalId, pf.portfolioId);
        if (!one.ok) {
          refusals.push(`portfolio: ${one.reason}`);
          associatedAll = false;
          break;
        }
        book = one.book;
      }
      const associated = { ok: associatedAll } as { ok: boolean };
      if (!associated.ok) {
        // Already reported above, per goal.
      } else {
    note({
      kind: OrgEventKind.WorkItemTransition,
      subjectId: pf.portfolioId,
      actorHatId: pf.ownerHatId,
      decision: `portfolio '${pf.title}' is open`,
      atMs: deps.nowMs,
      fact: {
        kind: "portfolio_opened",
        portfolioId: pf.portfolioId,
        title: pf.title,
        portfolioKind: pf.kind,
        ownerHatId: pf.ownerHatId,
      },
    });
        for (const started of startedGoals) {
          note({
            kind: OrgEventKind.WorkItemTransition,
            subjectId: started.goalId,
            actorHatId: deps.acceptingHatId,
            decision: `this goal is about '${pf.title}'`,
            atMs: deps.nowMs,
            fact: { kind: "goal_associated", goalId: started.goalId, portfolioId: pf.portfolioId },
          });
        }
      }
    }
  }

  const step = (
    parent: string,
    titles: readonly string[],
    prefix: string,
    workType?: WorkType,
    dependsOn?: readonly string[],
    owes?: readonly GateKind[],
  ): readonly string[] => {
    const children = titles.map((title) => ({
      workId: deps.createId(prefix),
      title,
      ...(workType === undefined ? {} : { workType }),
      ...(dependsOn === undefined || dependsOn.length === 0 ? {} : { dependsOn }),
      ...(owes === undefined ? {} : { owes }),
    }));
    // HOW MANY PEOPLE THIS LINE HAS FREE, counted from the cascade as it stands. The chart cannot
    // answer this and must not try — a chart that changed shape as work arrived would make two runs
    // over one organization disagree about who reports to whom.
    const carrying = new Set(
      // Same rule as staffing uses: finished work frees the person who did it.
      cascade.nodes
        .filter((n) => n.state !== WorkState.Done && n.state !== WorkState.Canceled)
        .map((n) => n.assigneeHatId)
        .filter((h): h is string => h !== undefined),
    );
    //
    // MEMOISED, because `best` calls this from inside a SORT COMPARATOR: every comparison would
    // otherwise walk the supervisor chain of all 85 contributors twice, which turned a decomposition
    // into thousands of chain walks and timed out a five-second test at seventy-five seconds.
    const freeCount = new Map<string, number>();
    const freeUnder = (hatId: string): number => {
      const seen = freeCount.get(hatId);
      if (seen !== undefined) return seen;
      const n = deps.chart.hats.filter(
        (h) =>
          h.level === "individual_contributor" &&
          !carrying.has(h.id) &&
          reportsUpTo(deps.chart, h.id, hatId),
      ).length;
      freeCount.set(hatId, n);
      return n;
    };
    const r = decompose(cascade, deps.chart, parent, children, freeUnder);
    if (!r.ok) {
      refusals.push(`decompose ${parent}: ${r.reason}`);
      return [];
    }
    cascade = r.cascade;
    for (const c of children) {
      const n = nodeById(cascade, c.workId);
      if (n !== undefined) {
        engage(n.ownerHatId);
        note({
          kind: OrgEventKind.WorkItemTransition,
          subjectId: n.workId,
          actorHatId: n.ownerHatId,
          decision: `owns ${n.workType} '${n.title}'`,
          toState: n.state,
          atMs: deps.nowMs,
                  fact: {
            kind: "work_created",
            workId: n.workId,
            workType: n.workType,
            title: n.title,
            ownerHatId: n.ownerHatId,
            ...(n.parentWorkId === undefined ? {} : { parentWorkId: n.parentWorkId }),
            // Read off the NODE, which inherited it from its parent — never re-derived here, or the
            // log and the cascade could disagree about which request a branch answers.
            ...(n.requestRef === undefined ? {} : { requestRef: n.requestRef }),
            ...(n.dependsOn === undefined || n.dependsOn.length === 0 ? {} : { dependsOn: n.dependsOn }),
            ...(n.brief === undefined ? {} : { brief: n.brief }),
            ...(n.owes === undefined ? {} : { owes: n.owes }),
          },
        });
      }
    }
    return children.map((c) => c.workId);
  };

  for (const started of startedGoals) {
    // A RESUMED GOAL ALREADY HAS ITS RUNGS. Decomposing again would add a second initiative,
    // project and pair of leaves under the same goal every single run — the work would never
    // finish, because there would always be more of it than the run before.
    if (started.resumed === true) continue;
    const upper = upperRungChainFor(started.item, deps.settings);
    const initiatives = step(started.goalId, [`initiative for ${started.item.title}`], "init", undefined, undefined, upper?.owesAt(WorkType.Initiative));
    const projects = initiatives.flatMap((i) =>
      step(i, [`project for ${started.item.title}`], "proj", undefined, undefined, upper?.owesAt(WorkType.Project)),
    );
    // THE LEAF CARRIES THE INTAKE'S OWN CLASSIFICATION. Intake decides an inbound event is a
    // defect or an incident; creating the executable work as a plain `task` regardless would
    // discard that a second time, one layer below where it was first thrown away. The VERIFY leaf
    // stays a `review` whatever the work is — checking a fix is different work from making it.
    const leafType = isLeafType(started.item.workType) ? started.item.workType : WorkType.Task;
    for (const p of projects) {
      const built = step(p, [`implement ${started.item.title}`], "task", leafType);
      // THE CHECK DEPENDS ON THE MAKING, STATED AS AN EDGE. Decomposition knows this because it
      // just created both; the runtime does not have to infer it from the work types, and any
      // other decomposition — an agent's, a source system's — declares its dependencies the same
      // way rather than needing the executor taught about a new shape.
      step(p, [`verify ${started.item.title}`], "task", WorkType.Review, built);
    }
  }

  // ── 4. STAFF — ranked assignment producing real, expiring bindings ────────
  let bindings: readonly HatBinding[] = [];
  const board0 = EMPTY_BOARD;
  let board: AnchorBoard = board0;
  const signals: SupervisorSignal[] = [];
  const supplyTarget = deps.supplyTarget ?? 1;

  /** Agents already given work in this cycle. See the exclusion below. */
  const staffedThisCycle = new Set<string>();

  for (const task of unstaffedTasks(cascade)) {
    // The lead asks the RMO — routed, evidenced, and anchored.
    const sent = sendSupervisorSignal(
      deps.chart,
      board,
      {
        signalId: deps.createId("sig"),
        anchorId: deps.createId("anchor"),
        fromHatId: task.ownerHatId,
        tool: SignalTool.RequestResource,
        title: `staff '${task.title}'`,
        message: `${task.workId} has no contributor`,
        evidence: STAFFING_EVIDENCE,
        atMs: deps.nowMs,
        workItemId: task.workId,
      },
      deps.resourceAuthorityHatId,
    );
    if (!sent.ok) {
      refusals.push(`staffing request for ${task.workId}: ${sent.reason}`);
      continue;
    }
    board = sent.board;
    signals.push(sent.signal);
    engage(sent.signal.fromHatId);
    engage(sent.signal.toHatId);
    note({
      kind: OrgEventKind.SupervisorSignalSent,
      subjectId: task.workId,
      actorHatId: sent.signal.fromHatId,
      decision: `${sent.signal.tool} → ${sent.signal.toHatId}`,
      toState: sent.signal.toHatId,
      atMs: deps.nowMs,
      evidenceRefs: sent.signal.evidence.map((e) => e.ref),
      // THE SIGNAL ITSELF, so a second process can read what was asked rather than a sentence
      // about it. Without this the upward channel does not survive a process boundary.
      fact: { kind: "supervisor_signal", signal: sent.signal },
    });
    // THE ANCHOR THE SIGNAL OPENED. Recorded separately because a signal and the deliberation it
    // starts are different things: the signal is what was asked, the anchor is what the asking
    // OWES. Reading one from the other would mean re-deriving the anchor's expected output from
    // the tool that opened it, which is a mapping nobody wrote down.
    for (const opened of sent.board.anchors.filter((x) => x.anchorId === sent.signal.anchorId)) {
      note({
        kind: OrgEventKind.DecisionRecorded,
        subjectId: opened.anchorId,
        actorHatId: opened.openedByHatId,
        decision: `opened '${opened.title}' owing ${opened.expectedOutput}`,
        toState: opened.state,
        atMs: deps.nowMs,
        fact: { kind: "discussion_anchor", anchor: opened },
      });
    }

    // TWO SEPARATE QUESTIONS, and conflating them is what made the first run of this pipeline
    // starve. `goal-cascade.assign` assigns a HAT to the task; `assignment-engine.assignHat` picks
    // an AGENT to wear a hat. So:
    //
    //   (a) which IC hat should carry this task — a chart question, answered by the reporting line;
    //   (b) which agent wears it — a ranking question, answered by reputation and availability.
    //
    // (a) An IC hat inside the task owner's line, not already carrying another task in this
    // cascade. Without the second condition both tasks land on one hat and the second is refused
    // at the supply cap, which reads as a capacity problem and is really a selection bug.
    // FINISHED WORK DOES NOT HOLD A PERSON. This counted every hat that had EVER been assigned
    // anything, with no state filter, so a contributor who completed a task was marked busy for the
    // rest of the organization's life. MEASURED: the seeded chart puts 2 individual contributors
    // under `tech_lead`, which owns every leaf; after those two finished their first items the line
    // was permanently full, three stated goals produced five `no free individual-contributor hat`
    // refusals, and the autonomy loop stopped with NO_PROGRESS while 83 people sat idle.
    //
    // An organization whose workforce only ever shrinks does not converge on anything.
    //
    // …AND A HAT CARRIES AS MANY OPEN TASKS AS WEARERS ARE AUTHORIZED FOR IT, not one. A hat is a
    // ROLE; `supplyTarget` is how many agents may wear it at once. Counting it as a single seat
    // MEASURED on the Agentic Team's first real run: three tickets, two contributor hats under the
    // lead who owns every leaf — one ticket's items took both, one of those waited on a person, and
    // the other two tickets were never started. At the default supply of 1 this is exactly the old
    // rule; the same agent still never takes two tasks at once (below).
    const openCarried = new Map<string, number>();
    for (const n of cascade.nodes) {
      if (n.state === WorkState.Done || n.state === WorkState.Canceled || n.assigneeHatId === undefined) continue;
      openCarried.set(n.assigneeHatId, (openCarried.get(n.assigneeHatId) ?? 0) + 1);
    }
    const targetHat = deps.chart.hats.find(
      (h) =>
        h.level === "individual_contributor" &&
        (openCarried.get(h.id) ?? 0) < supplyTarget &&
        reportsUpTo(deps.chart, h.id, task.ownerHatId),
    );
    if (targetHat === undefined) {
      refusals.push(
        `no free individual-contributor hat reports up to '${task.ownerHatId}' for ${task.workId}`,
      );
      continue;
    }

    // (b) The agents who could wear it. Ranked on the (agent, hat) pairing.
    //
    // ── ONE CONCURRENT TASK PER AGENT ───────────────────────────────────────
    // Every agent used to be a candidate for every task, so one agent took BOTH items in a run and
    // wore two implementation hats at the same instant — out of eighty-five eligible. The hat cap
    // did not catch it (two is under three) because it governs hats, not workload.
    //
    // The calendar is runtime authority everywhere else here: `bookReviewBlocks` already refuses to
    // put a reviewer in two places at once. Staffing simply never asked. This is that same rule at
    // the moment of assignment, and it is why the work spreads across the roster instead of piling
    // onto whoever ranks first.
    const candidates: Candidate[] = deps.agents
      .filter((a) => !staffedThisCycle.has(a.agentId))
      .map((a) => ({ agentId: a.agentId, hatId: a.hatId }));
    // ONLY WHEN THERE WERE AGENTS TO EXCLUDE. An organization with no agents at all is a different
    // fact from one whose agents are all busy, and the first draft reported "all 0 already hold work
    // this cycle" for the empty roster — a sentence that is not true of anything. `assignHat` names
    // the empty case properly, so fall through to it.
    if (candidates.length === 0 && deps.agents.length > 0) {
      refusals.push(
        `no unstaffed agent is available for ${task.workId}: all ${String(deps.agents.length)} already hold work this cycle`,
      );
      continue;
    }
    const outcome = assignHat({
      chart: deps.chart,
      hat: targetHat,
      candidates,
      bindings,
      nowMs: deps.nowMs,
      observations: deps.observations,
      chooser: firstLegalChooser(),
      supplyTarget,
    });

    if (outcome.outcome !== "assigned") {
      refusals.push(`assign ${task.workId}: ${outcome.reason}`);
      // The eligibility detail is what the RMO needs, so surface it rather than only the summary.
      if (outcome.outcome === "no_eligible_candidate") {
        for (const x of outcome.excluded) refusals.push(`  ${x.agentId}: ${x.reason}`);
      }
      continue;
    }

    // A hat is WORN, not owned: the binding warms up, activates, and will expire.
    const may = mayTakeHat(bindings, outcome.agentId, targetHat.id, deps.nowMs, supplyTarget);
    if (!may.ok) {
      refusals.push(`bind ${outcome.agentId} to ${targetHat.id}: ${may.reason}`);
      continue;
    }
    const begun = beginBinding(targetHat, {
      bindingId: deps.createId("bind"),
      wearerAgentId: outcome.agentId,
      nowMs: deps.nowMs,
    });
    if (!begun.ok) {
      refusals.push(`bind ${outcome.agentId}: ${begun.reason}`);
      continue;
    }
    bindings = [...bindings, begun.binding];

    const decided = recordDecision(board, {
      decisionId: deps.createId("dec"),
      anchorId: sent.signal.anchorId,
      byHatId: sent.signal.toHatId,
      atMs: deps.nowMs,
      decision: `assign ${outcome.agentId} (score ${outcome.score.toFixed(3)})`,
      rationale: `ranked first among eligible candidates in the owning line`,
      evidence: STAFFING_EVIDENCE,
    });
    if (decided.ok) {
      board = decided.board;
      // THE DECISION AS AN ARTIFACT, with its rationale. A decision whose reason is not recorded
      // cannot be revisited when circumstances change — nobody can tell whether it still holds.
      const record = decided.board.decisions[decided.board.decisions.length - 1];
      if (record !== undefined) {
        note({
          kind: OrgEventKind.DecisionRecorded,
          subjectId: record.anchorId,
          actorHatId: record.byHatId,
          decision: record.decision,
          atMs: deps.nowMs,
          evidenceRefs: record.evidence.map((e) => e.ref),
          fact: { kind: "decision_record", record },
        });
      }
    } else refusals.push(`RMO decision for ${task.workId}: ${decided.reason}`);

    const assigned = assign(cascade, deps.chart, task.workId, targetHat.id);
    if (!assigned.ok) {
      refusals.push(`assign ${task.workId}: ${assigned.reason}`);
      continue;
    }
    cascade = assigned.cascade;
    staffedThisCycle.add(outcome.agentId);
    engage(targetHat.id);
    note({
      kind: OrgEventKind.HatAssignment,
      subjectId: task.workId,
      actorHatId: sent.signal.toHatId,
      actorAgentId: outcome.agentId,
      decision: `${outcome.agentId} bound to ${targetHat.id} and assigned ${task.workId}`,
      toState: targetHat.id,
      atMs: deps.nowMs,
          fact: { kind: "work_assigned", workId: task.workId, assigneeHatId: targetHat.id },
    });

    const resolved = resolveAnchor(board, sent.signal.anchorId);
    if (resolved.ok) {
      board = resolved.board;
      const closed = resolved.board.anchors.find((x) => x.anchorId === sent.signal.anchorId);
      if (closed !== undefined) {
        note({
          kind: OrgEventKind.DecisionRecorded,
          subjectId: closed.anchorId,
          actorHatId: sent.signal.toHatId,
          decision: `anchor ${closed.state}`,
          toState: closed.state,
          atMs: deps.nowMs,
          fact: { kind: "anchor_state", anchorId: closed.anchorId, state: closed.state },
        });
      }
    } else refusals.push(`resolve staffing anchor: ${resolved.reason}`);
  }

  // ── 4b. STAFF THE DISCIPLINES THE WORK WILL NEED ─────────────────────────
  // Above, the RMO staffed a CONTRIBUTOR per task, chosen by reporting line alone. That says
  // nothing about what the work needs, so one implementer ends up authoring the business context,
  // the customer review and the architecture. Here the RMO is asked for one hat per discipline the
  // walk will use, with the qualified set read off the chart and the pick made by the same ranking.
  //
  // Skipped entirely when nothing will be produced: an organisation with no artifact producer has
  // no phases to staff, and binding hats for work that will not happen is how a calendar fills up
  // with people who are not doing anything.
  if (deps.artifactProducers !== undefined && deps.artifactProducers.size > 0) {
    const alreadyBound = new Set(bindings.map((b) => b.hatId));
    for (const gate of deps.artifactProducers.keys()) {
      const staffing = candidatesFor(deps.chart, gate);
      if (staffing.candidates.length === 0) {
        // Named, not skipped. "No hat in this organisation could author this" is a fact about the
        // chart that somebody should act on, and it is invisible if the loop simply moves on.
        refusals.push(`no hat could author '${String(gate)}': ${staffing.because ?? "no candidate"}`);
        continue;
      }
      // Already covered by a hat this run bound — the disciplines overlap by design (several
      // business gates share one department), and binding a second hat for the same discipline
      // would spend an agent to answer a question already answered.
      if (staffing.candidates.some((c) => alreadyBound.has(c.hatId))) continue;

      let staffed = false;
      for (const candidate of staffing.candidates) {
        const hat = deps.chart.byId.get(candidate.hatId);
        if (hat === undefined || alreadyBound.has(hat.id)) continue;
        const outcome = assignHat({
          chart: deps.chart,
          hat,
          candidates: deps.agents.map((a) => ({ agentId: a.agentId, hatId: a.hatId })),
          bindings,
          nowMs: deps.nowMs,
          observations: deps.observations,
          chooser: firstLegalChooser(),
          supplyTarget,
        });
        if (outcome.outcome !== "assigned") continue;
        const begun = beginBinding(hat, {
          bindingId: deps.createId("bind"),
          wearerAgentId: outcome.agentId,
          nowMs: deps.nowMs,
        });
        if (!begun.ok) continue;
        bindings = [...bindings, begun.binding];
        alreadyBound.add(hat.id);
        engage(hat.id);
        note({
          kind: OrgEventKind.HatAssignment,
          subjectId: String(gate),
          actorHatId: deps.resourceAuthorityHatId,
          actorAgentId: outcome.agentId,
          decision: `${outcome.agentId} bound to ${hat.id} to author '${String(gate)}' (score ${outcome.score.toFixed(3)})`,
          toState: hat.id,
          atMs: deps.nowMs,
        });
        staffed = true;
        break;
      }
      if (!staffed) {
        refusals.push(
          `could not staff '${String(gate)}' — none of ${String(staffing.candidates.length)} qualified hat(s) could be filled`,
        );
      }
    }
  }

  // Warm the bindings up so they authorize. `advanceAll` is the runtime tick.
  const warmedAt = deps.nowMs + Math.max(...bindings.map((b) => b.warmupEndsMs - b.boundAtMs), 0);
  bindings = advanceAll(bindings, deps.chart, warmedAt);
  for (const b of bindings) {
    if (isAuthorizing(b, warmedAt)) {
      note({
        kind: OrgEventKind.HatBindingTransition,
        subjectId: b.bindingId,
        actorHatId: b.hatId,
        actorAgentId: b.wearerAgentId,
        decision: `${b.wearerAgentId} is now wearing ${b.hatId}`,
        toState: b.phase,
        atMs: warmedAt,
      });
    }
  }

  // ── 5. SCHEDULE ───────────────────────────────────────────────────────────
  let calendar: Calendar = EMPTY_CALENDAR;
  let cursor = warmedAt;
  const staffedTasks = cascade.nodes.filter((n) => n.assigneeHatId !== undefined);
  for (const task of staffedTasks) {
    // Hoisted so the event's FACT can name the block it planned. Minting it inside the call would
    // leave the log describing a block whose id it does not know.
    const blockId = deps.createId("blk");
    const r = scheduleBlock(calendar, {
      blockId,
      hatId: task.assigneeHatId!,
      blockType: ScheduleBlockType.PrioritizedWork,
      startMs: cursor,
      endMs: cursor + deps.workBlockMs,
      state: ScheduleBlockState.Scheduled,
      workItemId: task.workId,
    });
    if (!r.ok) {
      refusals.push(`schedule ${task.workId}: ${r.reason}`);
      continue;
    }
    calendar = r.calendar;
    note({
      kind: OrgEventKind.ScheduleBlockPlanned,
      subjectId: task.workId,
      actorHatId: task.assigneeHatId,
      decision: `booked ${deps.workBlockMs}ms of prioritized work`,
      toState: ScheduleBlockType.PrioritizedWork,
      atMs: cursor,
      fact: {
        kind: "block_planned",
        blockId,
        hatId: task.assigneeHatId!,
        blockType: ScheduleBlockType.PrioritizedWork,
        startMs: cursor,
        endMs: cursor + deps.workBlockMs,
        workItemId: task.workId,
      },
    });
    cursor += deps.workBlockMs;

    // ── REVIEWS AND QA GET TIME TOO ──────────────────────────────────────
    // Booked here, alongside the work, because the calendar is RUNTIME AUTHORITY: `loop-policy`
    // narrows a hat's menu by what it is booked to be doing, so a review with no block is one the
    // reviewing hat's tick cannot see it is supposed to do. Work was authorised by the schedule
    // and reviews were not, which is why the review lane could never drive itself.
    const chain = chainForTask(task, deps.pipeline ?? DEFAULT_PIPELINE);
    const reviews = bookReviewBlocks({
      chart: deps.chart,
      calendar,
      gates: chain,
      workId: task.workId,
      proposerHatId: task.assigneeHatId!,
      fromMs: cursor,
      blockMs: deps.workBlockMs,
      createId: deps.createId,
    });
    calendar = reviews.calendar;
    for (const r of reviews.refusals) refusals.push(r);
    for (const b of reviews.booked) {
      note({
        kind: OrgEventKind.ScheduleBlockPlanned,
        subjectId: task.workId,
        actorHatId: b.block.hatId,
        decision: `booked a review of '${b.gate}'`,
        toState: ScheduleBlockType.Review,
        atMs: b.block.startMs,
        fact: {
          kind: "block_planned",
          blockId: b.block.blockId,
          hatId: b.block.hatId,
          blockType: ScheduleBlockType.Review,
          startMs: b.block.startMs,
          endMs: b.block.endMs,
          workItemId: task.workId,
        },
      });
    }
    cursor += chain.length * deps.workBlockMs;

    // AND ACTUALLY ASK THEM. Booking the time and sending the request are two halves of one act:
    // `RequestReview` had a reader (`reviewsAskedOf`, which builds a hat's menu) and no writer, so
    // that surface was always empty and `review_artifact` was a verb no agent could be offered.
    // Built from what was BOOKED, so the hat with the time is the hat with the ask.
    const asked = requestReviewsFor({
      chart: deps.chart,
      board,
      booked: reviews.booked,
      workId: task.workId,
      fromHatId: task.assigneeHatId!,
      atMs: cursor,
      createId: deps.createId,
      resourceAuthorityHatId: deps.resourceAuthorityHatId,
      evidenceRefs: [`work:${task.workId}`],
    });
    board = asked.board;
    for (const r of asked.refusals) refusals.push(r);
    for (const sig of asked.signals) {
      signals.push(sig);
      note({
        kind: OrgEventKind.SupervisorSignalSent,
        subjectId: task.workId,
        actorHatId: sig.fromHatId,
        decision: `${sig.tool} → ${sig.toHatId} for '${sig.title}'`,
        toState: sig.toHatId,
        atMs: cursor,
        evidenceRefs: sig.evidence.map((e) => e.ref),
        fact: { kind: "supervisor_signal", signal: sig },
      });
      // AND THE ANCHOR IT OPENED. Missed on the first pass: 28 anchors existed on the board and
      // 2 were in the log, because only the staffing path emitted this fact. A deliberation the
      // log does not hold is one no second process can read — the exact defect the board facts
      // were added to close, reintroduced one code path over.
      const opened = asked.board.anchors.find((x) => x.anchorId === sig.anchorId);
      if (opened !== undefined) {
        note({
          kind: OrgEventKind.DecisionRecorded,
          subjectId: opened.anchorId,
          actorHatId: opened.openedByHatId,
          decision: `opened '${opened.title}' owing ${opened.expectedOutput}`,
          toState: opened.state,
          atMs: cursor,
          fact: { kind: "discussion_anchor", anchor: opened },
        });
      }
    }

    const qa = bookQaBlocks({
      calendar,
      qaHatIds: gateOwners(deps.chart, GateKind.RuntimeValidation)
        .filter((h) => h.id !== task.assigneeHatId)
        .map((h) => h.id),
      workId: task.workId,
      fromMs: cursor,
      blockMs: deps.workBlockMs,
      createId: deps.createId,
    });
    calendar = qa.calendar;
    for (const r of qa.refusals) refusals.push(r);
    for (const b of qa.booked) {
      note({
        kind: OrgEventKind.ScheduleBlockPlanned,
        subjectId: task.workId,
        actorHatId: b.block.hatId,
        decision: "booked QA time",
        toState: ScheduleBlockType.PromptFlowExecution,
        atMs: b.block.startMs,
        fact: {
          kind: "block_planned",
          blockId: b.block.blockId,
          hatId: b.block.hatId,
          blockType: ScheduleBlockType.PromptFlowExecution,
          startMs: b.block.startMs,
          endMs: b.block.endMs,
          workItemId: task.workId,
        },
      });
    }
    cursor += deps.workBlockMs;
  }

  const firstTask = staffedTasks[0];
  if (firstTask !== undefined) {
    const attendees = accountableHatsFor(cascade, firstTask.workId);
    const slot = firstCommonFreeSlot(
      calendar,
      attendees,
      warmedAt,
      warmedAt + 16 * deps.workBlockMs,
      deps.workBlockMs,
      deps.workBlockMs,
    );
    if (slot === undefined) refusals.push("no common slot for the accountable chain");
    else {
      // Hoisted so the event's fact can name the meeting and every leg it booked. Minting them
      // inside the call would leave the log describing blocks whose ids it does not know.
      const meetingId = deps.createId("mtg");
      const blockIds = attendees.map(() => deps.createId("blk"));
      const met = scheduleMeeting(calendar, {
        meetingId,
        attendeeHatIds: attendees,
        blockIds,
        startMs: slot,
        endMs: slot + deps.workBlockMs,
        workItemId: firstTask.workId,
      });
      if (!met.ok) refusals.push(`chain meeting: ${met.reason}`);
      else {
        calendar = met.calendar;
        for (const a of attendees) engage(a);
        note({
          kind: OrgEventKind.MeetingScheduled,
          subjectId: firstTask.workId,
          actorHatId: firstTask.ownerHatId,
          decision: `the accountable chain met: ${attendees.join(" → ")}`,
          atMs: slot,
          evidenceRefs: attendees,
          fact: {
            kind: "meeting_planned",
            meetingId,
            blockIds,
            attendeeHatIds: attendees,
            startMs: slot,
            endMs: slot + deps.workBlockMs,
            workItemId: firstTask.workId,
          },
        });
      }
    }
  }

  // ── 6. THE DEV'S OWN LOOP — what it is offered, and what it picks ────────
  // Placed HERE, before the work is executed, because that is what the loop is for. Running it
  // after the gates closed the tasks made it report "offered 0 items" on every tick — a postscript
  // rather than the thing that picks the work up.
  const loopTicks: OrgRuntimeReport["loopTicks"][number][] = [];
  const pickedBy = new Map<string, string>(); // workId -> agentId that picked it
  for (const b of bindings) {
    if (!isAuthorizing(b, warmedAt)) continue;
    // Per BINDING, naming the hat — an agent wearing two hats ticks once as each, not twice
    // as whichever binding came first.
    const bound = bindWearerToLoop(deps.chart, calendar, bindings, b.wearerAgentId, warmedAt, b.hatId);
    if (!bound.ok) {
      refusals.push(`loop for ${b.wearerAgentId}: ${bound.reason}`);
      continue;
    }
    // The projection is what this hat's own observe tick is offered; the binding is what it may do.
    const offered = projectFor(cascade, bound.hatId);
    const ready = offered.find((i) => i.ready);
    const closes =
      ready === undefined
        ? []
        : completionsFrom(cascade, bound.hatId, [{ kind: "do_item", item: { id: ready.id } }]);
    const picked = closes[0];
    if (picked !== undefined) pickedBy.set(picked, b.wearerAgentId);
    loopTicks.push({
      agentId: b.wearerAgentId,
      hatId: bound.hatId,
      offered: offered.length,
      ...(picked === undefined ? {} : { pickedWorkId: picked }),
    });
    note({
      kind: OrgEventKind.WorkClaimed,
      subjectId: picked ?? bound.hatId,
      actorHatId: bound.hatId,
      actorAgentId: b.wearerAgentId,
      decision: `offered ${offered.length} item(s); picked ${picked ?? "nothing"}`,
      atMs: warmedAt,
    });
  }

  // ── 7. MARKET — the work the loop picked becomes claimable shards ────────
  let queue = emptyQueue(deps.createId("q"), firstTask?.ownerHatId ?? "none", 1);
  for (const task of staffedTasks) {
    const r = addShard(queue, deps.createId("shard"), task.workId);
    if (!r.ok) refusals.push(`shard ${task.workId}: ${r.reason}`);
    else queue = r.queue;
  }

  const wearers = bindings.filter((b) => isAuthorizing(b, warmedAt)).map((b) => b.wearerAgentId);
  // ── THE RMO'S OWN ANSWER TO "WHO IS AVAILABLE" ─────────────────────────────
  // The hats it has actually put an agent into, in the order it staffed them — which is the order
  // `rankCandidates` produced, so this IS the ranking rather than a second opinion about it. Used
  // to pick each phase's author from the discipline that owns it; see `phase-staffing.ts`.
  const preferredHats = bindings.filter((b) => isAuthorizing(b, warmedAt)).map((b) => b.hatId);

  // ── WHAT A PHASE MADE REACHES THE LOG THE MOMENT IT IS MADE ──────────────
  // Before anybody is asked to judge it. MEASURED: a reviewer told to judge from `observe` opened
  // the item and found "0 attachments — no work has been produced", and was right — outputs were
  // written only after the whole walk, and a governance rung's documents never at all. A record
  // that lags the work is a record a reviewer cannot use, whoever the reviewer is.
  const recordedEarly = new Set<string>();

  // ── WHAT ALREADY PASSED, from earlier cycles and runs ─────────────────────
  // The LATEST prior verdict per (item, gate). See `OrgRuntimeDeps.priorGateEvaluations`.
  const latestPrior = new Map<string, GateEvaluation>();
  for (const e of deps.priorGateEvaluations ?? []) {
    const key = `${e.workId}::${String(e.gate)}`;
    const had = latestPrior.get(key);
    if (had === undefined || had.atMs <= e.atMs) latestPrior.set(key, e);
  }
  const passedBefore = (workId: string, gate: GateKind): boolean => {
    const e = latestPrior.get(`${workId}::${String(gate)}`);
    return e !== undefined && isPassing(e.outcome);
  };
  const recordProduced = (
    workId: string,
    gate: GateKind,
    art: Artifact,
    producedByHatId: string,
    actorHatId: string | undefined,
    said: PhaseTranscript | undefined,
  ): void => {
    note({
      kind: OrgEventKind.DecisionRecorded,
      subjectId: workId,
      actorHatId,
      decision: `produced for '${String(gate)}': ${art.summary}`,
      atMs: warmedAt,
      evidenceRefs: art.refs,
      fact: {
        kind: "phase_output",
        workId,
        gate: String(gate),
        refs: art.refs,
        summary: art.summary,
        producedByHatId,
        ...(said === undefined ? {} : { output: said.output, durationMs: said.durationMs }),
      },
    });
    // Only refs that resolved to bytes — a refs list carries plan lines and urls too.
    for (const ref of art.refs) {
      const doc = deps.documentAt?.(ref);
      if (doc === undefined) continue;
      note({
        kind: OrgEventKind.DecisionRecorded,
        subjectId: workId,
        actorHatId,
        decision: `wrote ${doc.path} (${String(doc.bytes)} bytes) at '${String(gate)}'`,
        atMs: warmedAt,
        evidenceRefs: [ref],
        fact: { kind: "document_written", workId, gate: String(gate), path: doc.path, bytes: doc.bytes, producedByHatId },
      });
    }
    recordedEarly.add(`${workId}::${String(gate)}`);
  };
  const reviewers = deps.agents.map((a) => a.agentId).filter((id) => !wearers.includes(id));

  for (const shard of [...queue.shards]) {
    // The agent that PICKED this work in its own loop tick is the one that claims it. Falling back
    // to "the first wearer" would let the market and the loop disagree about who is doing what.
    const wearer =
      pickedBy.get(shard.workId) ?? wearers[0];
    if (wearer === undefined) break;
    const claimed = claimShard(queue, {
      claimId: deps.createId("claim"),
      ownerAgentId: wearer,
      nowMs: warmedAt,
      leaseMs: deps.leaseMs,
      expectedRevision: queue.revision,
      shardId: shard.shardId,
    });
    if (!claimed.ok) {
      refusals.push(`claim ${shard.shardId}: ${claimed.reason}`);
      continue;
    }
    queue = claimed.queue;
    const done = completeClaim(queue, {
      claimId: claimed.claim.claimId,
      fencingToken: claimed.claim.fencingToken,
      nowMs: warmedAt + 1,
    });
    if (!done.ok) {
      refusals.push(`complete ${shard.shardId}: ${done.reason}`);
      continue;
    }
    queue = done.queue;
    // A reviewer who is not the claimant — the quorum rule refuses self-approval.
    const reviewer = reviewers[0];
    if (reviewer !== undefined) {
      const approved = approveShard(queue, { shardId: shard.shardId, byAgentId: reviewer, atMs: warmedAt + 2 });
      if (approved.ok) {
        queue = approved.queue;
        const merged = mergeShard(queue, shard.shardId);
        if (merged.ok) {
          queue = merged.queue;
          note({
            kind: OrgEventKind.ShardMerged,
            subjectId: shard.shardId,
            actorAgentId: reviewer,
            decision: `${wearer} completed it; ${reviewer} approved and it merged`,
            toState: "merged",
            atMs: warmedAt,
          });
        } else refusals.push(`merge ${shard.shardId}: ${merged.reason}`);
      } else refusals.push(`approve ${shard.shardId}: ${approved.reason}`);
    } else {
      refusals.push(`no reviewer other than the claimant for ${shard.shardId}`);
    }
  }
  // Reap anything left holding a lease, so a dead claimant's work returns to the pool.
  const reaped = reapStaleClaims(queue, warmedAt + deps.leaseMs + 1);
  queue = reaped.queue;
  if (reaped.reaped.length > 0) {
    note({
      kind: OrgEventKind.WorkCompleted,
      subjectId: queue.queueId,
      decision: `reaped ${reaped.reaped.length} stale claim(s)`,
      atMs: warmedAt,
      evidenceRefs: reaped.reaped,
    });
  }

  // ── 8 & 9. QA and the GATES ───────────────────────────────────────────────
  const qaReports: QaCycleReport[] = [];
  /** Per work item, what its phases produced — see `OrgRuntimeReport.artifacts`. */
  const artifacts = new Map<string, ArtifactHistory>();
  /**
   * The change opened for each task, kept so the same handle is the one merged later.
   *
   * Opened BEFORE the work runs, because `execute` is handed `{ branch }` and that context is a
   * promise: a branch the executor is told to work on has to exist while it works. Opening at
   * projection time instead — after the work — left every branch empty, which is a repository that
   * agrees with the record about nothing except the names.
   */
  const openedChanges = new Map<string, ChangeHandle>();
  const allCases: TestCase[] = [];
  const gateRuns: { taskId: string; run: GateRunResult }[] = [];
  const gateEvaluations: GateEvaluation[] = [];
  const gateBlocked: { taskId: string; gate: GateKind; recovery?: RecoveryPath }[] = [];
  const awaitingHuman: { taskId: string; gate: GateKind }[] = [];
  /** Filled from any walk whose producer asked; see `questionsForHuman`. */
  const questionsForHuman: { taskId: string; gate: GateKind; byHatId: string; question: string }[] = [];
  /** What steps worked out; see `learnings` on the report. */
  const learnings: { workId: string; gate: GateKind; byHatId: string; key: string; value: string }[] = [];
  const escalations: OrgRuntimeReport["escalations"][number][] = [];
  /** Tasks whose loop an escalation STOPPED, so a caller can tell 'finished' from 'gave up'. */
  const halted: { readonly taskId: string; readonly action: EscalationAction; readonly byHatId: string }[] = [];
  const maxAttempts = Math.max(1, deps.maxGateAttempts ?? 3);
  const threshold = deps.churnThreshold ?? DEFAULT_CHURN_THRESHOLD;

  /** Rungs whose own chain stopped at a gate, and where. Their subtree is not authorized. */
  const governanceBlocked = new Map<string, GateKind>();

  // ── THE UPPER RUNGS ARE GOVERNED TOO ──────────────────────────────────────
  // `staffedTasks` above is every node with an ASSIGNEE, and only leaves are ever assigned. A goal,
  // an initiative and a project are owned and never assigned, so nothing here used to walk them —
  // which was invisible while every leaf walked all fourteen gates, and became a ten-control hole
  // the moment each type started walking its own chain.
  //
  // This is what makes the hierarchy real rather than decorative: a director's initiative actually
  // crosses `brd_approval` and `cost_approval`, a manager's project crosses the architecture gates,
  // and each is judged by a hat outside its own line. No change is opened and no work executed —
  // an initiative has no branch, and giving it one would put a code change behind a business gate.
  for (const node of cascade.nodes) {
    if (isLeafType(node.workType)) continue;
    if (node.state === WorkState.Canceled) continue;

    const govReviewed = new Map<GateKind, ReviewVerdict>();
    // What the REVIEWER consulted, kept so it reaches the evaluation. Without it a governance gate
    // records an approval with no evidence — the gate's whole claim resting on the approver's
    // say-so, which is the rubber stamp the evidence work exists to remove.
    const govReviewEvidence = new Map<GateKind, readonly string[]>();
    const askGovernanceReviewer = async (
      gate: GateKind,
      produced: Artifact | undefined,
      soFar: ReadonlyMap<GateKind, Artifact>,
      said?: PhaseTranscript,
    ): Promise<void> => {
      if (produced !== undefined) recordProduced(node.workId, gate, produced, node.ownerHatId, node.ownerHatId, said);
      const trail = [...soFar.values()].flatMap((a) => a.refs);
      const shown = [...new Set([...(produced?.refs ?? []), ...trail])];
      const verdict = await providers.review.review({
        gate,
        workId: node.workId,
        evidence: shown.map((ref) => ({ kind: "document" as const, ref })),
      });
      if (!verdict.ok) {
        // A REVIEW THAT COULD NOT BE OBTAINED IS NOT AN APPROVAL — the same sentence the leaf walk
        // refuses to blur, applied to the rungs that govern it.
        refusals.push(`review '${providers.review.meta.name}' on ${gate} for ${node.workId}: ${verdict.reason}`);
        govReviewed.set(gate, { outcome: GateOutcome.Rejected, reason: `not reviewed: ${verdict.reason}` });
        return;
      }
      govReviewed.set(gate, verdict.value);
      govReviewEvidence.set(gate, verdict.evidence.map((e) => e.ref));
    };

    // ── THE GOVERNING HATS GET TIME, AND ARE ASKED ON THE RECORD ────────────
    // Booked and requested exactly as a leaf's reviews are. Without this the upper rungs were
    // reviewed silently: no calendar block, so the reviewing hat's own tick could not see the work;
    // no review request, so no anchor; no anchor, so no deliberation record. Measured as the board
    // dropping to a single speaking hat.
    const govChain = chainForTask(node, deps.pipeline ?? DEFAULT_PIPELINE);
    if (govChain.length > 0 && deps.workBlockMs > 0) {
      const govBooked = bookReviewBlocks({
        chart: deps.chart,
        calendar,
        gates: govChain,
        workId: node.workId,
        proposerHatId: node.ownerHatId,
        fromMs: cursor,
        blockMs: deps.workBlockMs,
        createId: deps.createId,
      });
      calendar = govBooked.calendar;
      for (const r of govBooked.refusals) refusals.push(`governance schedule ${node.workId}: ${r}`);
      for (const b of govBooked.booked) {
        note({
          kind: OrgEventKind.ScheduleBlockPlanned,
          subjectId: node.workId,
          actorHatId: b.block.hatId,
          decision: `booked a review of '${b.gate}' on this ${node.workType}`,
          toState: ScheduleBlockType.Review,
          atMs: b.block.startMs,
          fact: {
            kind: "block_planned",
            blockId: b.block.blockId,
            hatId: b.block.hatId,
            blockType: ScheduleBlockType.Review,
            startMs: b.block.startMs,
            endMs: b.block.endMs,
            workItemId: node.workId,
          },
        });
      }
      const govAsked = requestReviewsFor({
        chart: deps.chart,
        board,
        booked: govBooked.booked,
        workId: node.workId,
        fromHatId: node.ownerHatId,
        atMs: cursor,
        createId: deps.createId,
        resourceAuthorityHatId: deps.resourceAuthorityHatId,
        evidenceRefs: [`work:${node.workId}`],
      });
      // ADVANCE THE CLOCK PER RUNG. Every rung booking from the same instant double-booked the
      // shared reviewers — `product_director` judges gates on both the goal and the project — and
      // the calendar correctly refused the second. A hat cannot be in two reviews at once, and
      // pretending otherwise is how a schedule stops meaning anything.
      cursor += deps.workBlockMs * Math.max(1, govBooked.booked.length);
      board = govAsked.board;
      for (const r of govAsked.refusals) refusals.push(r);
      for (const sig of govAsked.signals) {
        signals.push(sig);
        // NOTED, NOT JUST PUSHED. This file already carries the scar from the first time this was
        // missed — "28 anchors existed on the board and 2 were in the log" — and pushing without
        // noting reproduced it exactly: the governance deliberation lived in memory and no second
        // process could read it back off disk.
        note({
          kind: OrgEventKind.SupervisorSignalSent,
          subjectId: node.workId,
          actorHatId: sig.fromHatId,
          decision: `${sig.tool} → ${sig.toHatId} for '${sig.title}'`,
          toState: sig.toHatId,
          atMs: cursor,
          evidenceRefs: sig.evidence.map((e) => e.ref),
          fact: { kind: "supervisor_signal", signal: sig },
        });
        const opened = govAsked.board.anchors.find((x) => x.anchorId === sig.anchorId);
        if (opened !== undefined) {
          note({
            kind: OrgEventKind.DecisionRecorded,
            subjectId: opened.anchorId,
            actorHatId: opened.openedByHatId,
            decision: `opened '${opened.title}' owing ${opened.expectedOutput}`,
            toState: opened.state,
            atMs: cursor,
            fact: { kind: "discussion_anchor", anchor: opened },
          });
        }
      }
    }

    const owed = chainForTask(node, deps.pipeline ?? DEFAULT_PIPELINE);
    if (owed.length === 0) continue;

    // THE ACCEPTANCE GATE WAITS FOR THE CHILDREN. A rung's last gate asserts that what it decomposed
    // was delivered; crossing it over open children is the premature sign-off `gate-demand` refuses,
    // and it has to be refused here too or the walk would grant what the demand model withholds.
    const delivered = deliveredSet(cascade);
    const acceptance = acceptanceGateFor(node);
    const kids = childrenOf(cascade, node.workId).filter((c: CascadeNode) => c.state !== WorkState.Canceled);
    const childrenDone = kids.length > 0 && kids.every((c: CascadeNode) => delivered.has(c.workId));
    const walkable = owed.filter(
      (g) => (g !== acceptance || childrenDone) && !passedBefore(node.workId, g),
    );
    if (walkable.length === 0) continue;

    // PRODUCERS TOO, or the upper rungs judge nothing. `business_context_grooming` belongs to the
    // GOAL now, and the grooming producer — the one that actually reads the configured data source
    // — was attached only in the leaf walk. Without this the source integration is dead: a run
    // handed a repository would reach it nowhere, and the gate would cite its own approval.
    //
    // Work and test execution are deliberately NOT here: those belong to a code change, and an
    // initiative has none.
    const govPipeline = withProducers(
      (deps.pipeline ?? DEFAULT_PIPELINE).filter((p) => walkable.includes(p.gate)),
      new Map<GateKind, ProducerPort>([
        ...(providers.dataSource === undefined
          ? []
          : ([[GateKind.BusinessContextGrooming, groomingProducer(providers.dataSource)]] as const)),
        ...[...(deps.artifactProducers ?? new Map<GateKind, ProducerPort>())].filter(
          ([gate]) => gate !== GateKind.ImplementationReview && gate !== GateKind.RuntimeValidation,
        ),
      ]),
    );
    // ── WHAT THIS RUNG ALREADY KNOWS ──────────────────────────────────────
    // The upper rungs recall too. Only the LEAF walk called this, so the goal, the initiative and
    // the project — the hats whose whole job is institutional judgement — worked with no memory at
    // all, while the implementer got everything the organization had ever learned. That is the
    // governance-walk hole again, in a fourth place: a facility built once and wired to one of the
    // two walks that need it.
    //
    // Called for its effect, exactly as the leaf walk does: the injection is what puts the recall
    // where the producer will be handed it, and it must happen before the pipeline runs.
    deps.recallFor?.(node.workId, node.ownerHatId, "governance");

    const governed = await runPipeline(deps.chart, {
      workId: node.workId,
      node,
      pipeline: govPipeline,
      // ITS OWN REVIEWERS. `reviewed` and `qaVerdict` above are per-leaf: a QA run belongs to a
      // code change and an initiative has none, so reusing them would judge a business gate on a
      // test result from an unrelated task.
      chooser: (legal, ctx) => gateChooserFrom(govReviewed, NO_QA_VERDICT)(legal, ctx),
      // Asked BEFORE each gate, same as the leaf walk. Without this the map stays empty and
      // `gateChooserFrom` rejects everything, which would make every upper rung permanently
      // blocked — safe, and useless.
      prepare: askGovernanceReviewer,
      onEvaluated: verdictNow(node.workId),
      // The reviewer's own references, on top of whatever the phase produced — the same as the
      // leaf walk. This is what puts a document behind a business approval.
      extraEvidenceFor: (gate) => govReviewEvidence.get(gate) ?? [],
      atMs: warmedAt,
      // The rung's OWNER proposes; `evaluate` refuses a gate whose only holder is the proposer, so
      // separation of duties is enforced by the same rule the leaf walk uses.
      proposerHatId: node.ownerHatId,
      // The SAME opt-in the leaf walk uses. Empty means fully agentic and every check below is a
      // no-op — and the checkpoint gates live on THESE rungs now, so without this an operator who
      // asked to sign off the BRD would never be asked.
      ...((gates) => (gates.size === 0 ? {} : { humanRequiredAt: gates }))(
        humanGatesFor(deps.checkpoints ?? []),
      ),
      ...(deps.humanDecisionFor === undefined
        ? {}
        : { humanDecisionFor: (gate: GateKind) => deps.humanDecisionFor?.(node.workId, gate) }),
      ...(deps.pricing === undefined ? {} : { pricing: deps.pricing }),
    });

    // ── WHAT THIS RUNG MADE REACHES THE LOG ─────────────────────────────────
    // The grooming producer runs here now, so without this a goal's business context existed only
    // in memory and died with the process: the gate would read as approved with nothing to show
    // for it. Same fact shape the leaf walk writes, so one reader serves both.
    for (const [gate, art] of governed.artifacts.entries()) {
      // Already on the record if its reviewer was asked — see `recordProduced`.
      if (recordedEarly.has(`${node.workId}::${String(gate)}`)) continue;
      const said = governed.transcripts.get(gate);
      note({
        kind: OrgEventKind.DecisionRecorded,
        subjectId: node.workId,
        actorHatId: node.ownerHatId,
        decision: `produced for '${String(gate)}': ${art.summary}`,
        atMs: warmedAt,
        evidenceRefs: art.refs,
        fact: {
          kind: "phase_output",
          workId: node.workId,
          gate: String(gate),
          refs: art.refs,
          summary: art.summary,
          producedByHatId: node.ownerHatId,
          ...(said === undefined ? {} : { output: said.output, durationMs: said.durationMs }),
        },
      });
    }

    // ── AND IT CAN STOP FOR A PERSON ────────────────────────────────────────
    // `brd_approval` and `architecture_approval` — the two checkpoint gates — live on THESE rungs
    // now. Without this the pause was unreachable: an operator who turned a checkpoint on would
    // never be asked, and the run would pass the gate it was told to stop at.
    for (const [gate, art] of governed.artifacts.entries()) {
      for (const l of art.learned ?? []) {
        learnings.push({ workId: node.workId, gate, byHatId: node.ownerHatId, key: l.key, value: l.value });
      }
    }
    for (const question of governed.questions) {
      questionsForHuman.push({ taskId: node.workId, gate: governed.blockedAt ?? GateKind.BusinessContextGrooming, byHatId: node.ownerHatId, question });
    }
    if (governed.awaitingHuman !== undefined) {
      awaitingHuman.push({ taskId: node.workId, gate: governed.awaitingHuman });
      note({
        kind: OrgEventKind.DecisionRecorded,
        subjectId: node.workId,
        decision: `waiting for a person at '${String(governed.awaitingHuman)}' — stopped here on purpose`,
        toState: "awaiting_human",
        atMs: warmedAt,
      });
    }

    // A RUNG WHOSE OWN GATES DID NOT PASS DOES NOT AUTHORIZE THE WORK BELOW IT.
    // A rejected architecture approval on a project has to stop that project's tasks, exactly as a
    // pending human decision does — otherwise the review is a report on work that shipped anyway,
    // which is the decoration the whole gate chain exists not to be.
    if (governed.blockedAt !== undefined) {
      governanceBlocked.set(node.workId, governed.blockedAt);
    }

    gateEvaluations.push(...governed.evaluations);
    for (const e of governed.evaluations) engage(e.byHatId);
    for (const r of governed.refusals) refusals.push(`governance for ${node.workId}: ${r}`);
    if (governed.evaluations.length > 0) {
      note({
        kind: OrgEventKind.QualityGateEvaluation,
        subjectId: node.workId,
        actorHatId: governed.evaluations[governed.evaluations.length - 1]?.byHatId,
        decision: `${String(governed.evaluations.length)} governance verdict(s) on this ${node.workType}`,
        atMs: warmedAt,
        fact: { kind: "gates_evaluated", evaluations: governed.evaluations },
      });
    }
    if (governed.complete && childrenDone) {
      // NOT `setState(Done)`. The cascade refuses to mark a parent done directly — "it is delivered
      // when they are, not by being marked done" — and `isDelivered` derives that from the children
      // every time it is asked. Writing the state here produced three refusals per run and would,
      // if it had succeeded, have created a second source of truth for delivery that could disagree
      // with the children it claims to summarise.
      note({
        kind: OrgEventKind.QualityGateEvaluation,
        subjectId: node.workId,
        actorHatId: node.ownerHatId,
        decision: `this ${node.workType} passed its own ${String(owed.length)} gate(s); delivery follows its children`,
        atMs: warmedAt,
      });
    }
  }

  /**
   * Work whose ancestor is waiting on a person.
   *
   * A checkpoint means STOP — including for everything below the rung that stopped. Without this
   * the run reported "waiting on a person at brd_approval" and landed the code under that same
   * initiative in the same breath, which is a control that reports rather than one that holds.
   */
  const pausedAncestors = new Set(awaitingHuman.map((a) => a.taskId));
  const heldByAncestor = (node: CascadeNode): string | undefined => {
    let cur: CascadeNode | undefined = node;
    const seen = new Set<string>();
    while (cur?.parentWorkId !== undefined && !seen.has(cur.workId)) {
      seen.add(cur.workId);
      if (pausedAncestors.has(cur.parentWorkId)) return cur.parentWorkId;
      if (governanceBlocked.has(cur.parentWorkId)) return cur.parentWorkId;
      cur = nodeById(cascade, cur.parentWorkId);
    }
    return undefined;
  };

  /**
   * What this item is waiting on — read off the cascade's own `dependsOn` edges.
   *
   * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────
   * Decomposition mints two leaves under every project — `implement X` and `verify X` — and until
   * the edge existed nothing recorded that one needed the other. A `review` leaf produces no code,
   * so change control opens no branch for it, so it had no checkout of its own and its tests ran in
   * the BASE tree. And the base tree does not contain the work yet, because MERGING HAPPENS IN A
   * SEPARATE LOOP AFTER this one.
   *
   * MEASURED, with the runner tracing its own working directory and the base HEAD: `implement` ran
   * in its worktree with the suite present and exited 0; `verify` then ran three times against the
   * base checkout, every time at `head=skeleton` with `suiteExists=false`, was turned back at
   * `runtime_validation` each time, and the third rejection escalated to `add_agents` — which
   * halted the whole autonomy loop. Adding agents would not have helped: nothing was wrong with the
   * work, the worker, or the staffing. The check was asked to verify something that was not there.
   *
   * ── WHY THE EDGE, AND WHY THE DEPENDENCY'S CHECKOUT ──────────────────────
   * The first repair asked the runtime to infer the dependency — "an item of type `review` waits on
   * its non-review siblings". That is one true dependency written as code: no other dependency
   * could be expressed, and this one could not be inspected or overridden. Stated as data, whoever
   * decomposes says what waits for what, and this reads the edge without knowing why it is there.
   *
   * And a dependent item borrows the CHECKOUT of what it depends on, rather than waiting for it to
   * land. That is what review is for — judging the artifact before it merges is the only judgement
   * that can still stop it — and it is also the only form that works, since `done` is set in this
   * loop and the merge runs after it.
   */
  const dependenciesOf = (node: CascadeNode): readonly CascadeNode[] =>
    (node.dependsOn ?? [])
      .map((id) => nodeById(cascade, id))
      .filter((n): n is CascadeNode => n !== undefined && n.state !== WorkState.Canceled);

  for (const task of staffedTasks) {
    // ALREADY ON THE TRUNK, from an earlier run: nothing to walk and no change to open. MEASURED on
    // the Agentic Team's run: a resumed run re-opened a change for a defect merged hours earlier,
    // found its old checkout directory still on disk, and refused - and the refusal was the first
    // thing in a run that then made no progress at all.
    if (deps.alreadyLanded?.has(task.workId) === true) continue;
    // ...or already IN FRONT OF A REVIEWER: handed off by an earlier run, and the next act is a person's.
    if (deps.alreadyHandedOff?.has(task.workId) === true) continue;
    const heldBy = heldByAncestor(task);
    if (heldBy !== undefined) {
      const why = governanceBlocked.get(heldBy);
      refusals.push(
        why === undefined
          ? `${task.workId} is held: '${heldBy}' is waiting on a person, and a checkpoint stops the work below it`
          : `${task.workId} is held: '${heldBy}' did not pass '${String(why)}', so its work is not authorized`,
      );
      continue;
    }
    // WHAT THIS ITEM WAITS FOR, and the checkout to judge it in. See `dependenciesOf`.
    const blocking = dependenciesOf(task);
    // The checkout of whatever this item depends on. With more than one dependency the first that
    // opened a change is the tree to judge in; an item that genuinely spans several changes is a
    // decomposition problem, not something to paper over by picking one silently — so the refusal
    // below names every dependency that is not ready.
    const subjectChange = blocking.map((d) => openedChanges.get(d.workId)).find((c) => c !== undefined);
    // A CHECKOUT ONLY IF THE CHANGE HAS ONE. In-memory change control opens real changes with no
    // directory at all, so `workdir` is absent there and the runner's configured directory is
    // right — treating that absence as "nothing to verify" held every review leaf under every
    // simulated run, which four end-to-end tests caught: a FAILING run stopped putting work on the
    // surface, because the leaf that surfaces it was never reached.
    const subjectWorkdir = subjectChange?.workdir;
    // HELD ONLY WHEN THERE IS GENUINELY NOTHING TO VERIFY: no change was opened for the subject and
    // the subject is not done. Absence of a CHANGE is the honest signal; absence of a directory is
    // a property of which adapter is in use.
    const waitingOn =
      subjectChange === undefined ? blocking.find((d) => d.state !== WorkState.Done) : undefined;
    if (waitingOn !== undefined) {
      refusals.push(
        `${task.workId} is held: it depends on '${waitingOn.workId}' (${waitingOn.title}), ` +
          `which is ${String(waitingOn.state)} and has opened no change`,
      );
      continue;
    }
    // …AND HELD UNTIL THERE IS SOMETHING IN THAT CHANGE TO JUDGE. A change that is open is not a
    // change that has code in it: MEASURED on the rehearsal run, the defect's reproduction was
    // rejected, nothing was ever implemented — and the verify leaf, seeing an open change, went ahead
    // and wrote a peer review of a branch with no commits. A review of nothing is the vacuity this
    // organization exists to refuse. So a dependency that writes code must have PASSED its
    // implementation step, in this run, before anything that verifies it starts.
    const unjudged =
      subjectChange === undefined
        ? undefined
        : blocking.find(
            (d) =>
              d.state !== WorkState.Done &&
              producesCode(d.workType) &&
              !passedBefore(d.workId, GateKind.ImplementationReview) &&
              !gateEvaluations.some(
                (e) => e.workId === d.workId && e.gate === GateKind.ImplementationReview && isPassing(e.outcome),
              ),
          );
    if (unjudged !== undefined) {
      refusals.push(
        `${task.workId} is held: '${unjudged.workId}' has opened a change but has not passed ` +
          `'${GateKind.ImplementationReview}', so there is nothing in it yet to verify`,
      );
      continue;
    }
    // Work this run was told not to deliver stays LIVE, for an agent to pick up. Skipped before QA
    // and before the change is opened, so a deferred item leaves no half-started branch behind.
    if (deps.deliverSelf !== undefined && !deps.deliverSelf.includes(task.workId)) {
      refusals.push(`${task.workId} was left for the agent lane to deliver; this run did not deliver it`);
      continue;
    }
    // QA derives its cases from the task's own criterion — the BRD stands in for the spec.
    const cases = deriveTestCases(
      {
        brdId: `brd-${task.workId}`,
        suiteId: `suite-${task.workId}`,
        authoredByHatId: "product_manager",
        acceptanceCriteria: [task.title],
      },
      deps.createId,
    );
    allCases.push(...cases);

    // ── THE CHANGE IS OPENED FIRST ────────────────────────────────────────
    // Producers write inside it, so the branch (and the worktree, when the adapter gives each
    // change one) has to exist before the first phase runs.
    // NO BRANCH FOR WORK THAT WRITES NO CODE — but it is still WORKED.
    //
    // A `review` item owes no implementation gate, so nothing would ever commit to its branch and
    // opening one leaves an empty change the reconciliation then fails on. What it must NOT do is
    // skip the item: a first cut wrote this as a `continue` and the verification leaf stopped being
    // walked entirely, so the goal never delivered because one of its children was never done.
    //
    // `handle` is optional on `PipelineRunInput` exactly for this case.
    let handle: ChangeHandle | undefined;
    if (producesCode(task.workType)) {
      // ── WHAT THE BRANCH IS CALLED, AND WHAT IT IS CUT FROM ─────────────
      // Both derived from the WORK rather than from this organization's internal ids.
      // `work/task-015` told a reviewer nothing; `story/AIAGENT-1520` can be found by anybody
      // holding the ticket, which is the only audience a branch name has.
      //
      // `base` is supplied ONLY when the item belongs under a collection. Saying nothing is how
      // a caller asks for the adapter's own trunk — the runtime does not know the trunk and must
      // not learn it, or the same fact lives in two places and drifts.
      const branch = branchNameIn(cascade, task);
      const under = integrationFor({
        cascade,
        workId: task.workId,
        ...(deps.settings === undefined ? {} : { settings: deps.settings }),
      });
      const openedResult = await providers.change.open(
        task,
        under === undefined ? { branch } : { branch, base: under.branch },
      );
      if (!openedResult.ok) {
        refusals.push(`change control '${providers.change.meta.name}' could not open ${branch}: ${openedResult.reason}`);
        continue;
      }
      openedChanges.set(task.workId, openedResult.value);
      handle = openedResult.value;
    }
    // WHERE THE WORK IS. The run already recorded that a change reached `Merged` and threw away the
    // branch, the merge request and the worktree — so the history could say a change happened and
    // could not say where to go and look at it.
    if (handle !== undefined) note({
      kind: OrgEventKind.ChangeProjected,
      subjectId: task.workId,
      actorHatId: task.assigneeHatId,
      decision: `opened ${handle.branch}${handle.url === undefined ? "" : ` (${handle.url})`}`,
      atMs: warmedAt,
      fact: {
        kind: "change_opened",
        workId: task.workId,
        changeId: handle.changeId,
        branch: handle.branch,
        ...(handle.url === undefined ? {} : { url: handle.url }),
        ...(handle.workdir === undefined ? {} : { workdir: handle.workdir }),
      },
    });

    // ── WHAT EACH PHASE PRODUCES ──────────────────────────────────────────
    // The work executor and the test runner are PRODUCERS now, attached to the phases whose gates
    // judge what they make. That is the whole reordering: `implementation_review` reviews code that
    // exists because the phase before it wrote the code, and `runtime_validation` weighs tests that
    // ran against that code rather than against an empty branch.
    let qaVerdict = gateOutcomeFor({ runs: [], passed: 0, failed: 0, errored: 0, cases: [] } as unknown as QaCycleReport);

    const workProducer: ProducerPort = {
      meta: providers.work.meta,
      produce: async (node, ctx) => {
        const prior = [...ctx.priorArtifacts].map(([gate, a]) => ({
          gate: String(gate),
          refs: a.refs,
          ...(a.summary === undefined ? {} : { summary: a.summary }),
        }));
        const performed = await providers.work.execute(node, {
          branch: ctx.branch,
          ...(ctx.workdir === undefined ? {} : { workdir: ctx.workdir }),
          // WHAT CAME BEFORE — for a defect, the reproduction this change must turn green.
          ...(prior.length === 0 ? {} : { priorPhases: prior }),
        });
        if (!performed.ok) return { ok: false, reason: performed.reason };
        if (!performed.value.succeeded) {
          // A work item that ran and did not succeed is a REFUSAL of the phase, not an artifact.
          // Producing something here would hand the reviewer an approval-shaped nothing.
          return { ok: false, reason: `the work did not succeed: ${performed.value.summary}` };
        }
        return {
          ok: true,
          value: { refs: [...performed.value.artifacts], summary: performed.value.summary },
          evidence: performed.evidence,
        };
      },
    };

    const testProducer: ProducerPort = {
      meta: providers.tests.meta,
      produce: async () => {
        const qa = await runQaCycle({
          cases,
          priorRuns: [],
          // A refusal from the runner is a test that could not be RUN, which is not the same as a
          // failing test — so it becomes `Errored` and carries the reason, rather than a quiet
          // `Failed` that would blame the code for a missing binary.
          executor: {
            execute: async (testCase, ctx) => {
              // THE CHANGE'S CHECKOUT, FROM THE HANDLE. The QA cycle's own ctx knows the branch and
              // nothing about where that branch is checked out, so passing it straight through sent
              // every test to the base directory. `handle.workdir` is the checkout the work was
              // just performed in — the same one `workProducer` above hands the work executor, so
              // the tests now run where the code is.
              // ITS OWN CHECKOUT, ELSE THE ONE IT DEPENDS ON. A leaf that opened a change tests
              // that change; a leaf that opened none tests the change it is waiting on. Falling
              // through to the runner's configured directory — the base tree — is what made every
              // verification gate unpassable.
              const testWorkdir = handle?.workdir ?? subjectWorkdir;
              const r = await providers.tests.run(testCase, {
                ...ctx,
                ...(testWorkdir === undefined ? {} : { workdir: testWorkdir }),
              });
              if (!r.ok) {
                return {
                  outcome: RunOutcome.Errored,
                  evidence: [{ kind: "trace" as const, ref: `runner-refused:${r.reason}` }],
                };
              }
              return { outcome: r.value.outcome, evidence: r.evidence };
            },
          },
          // A code-less item has no branch; QA still needs a name for the run it reports.
          branch: handle?.branch ?? branchNameIn(cascade, task),
          qaHatId: "qa_engineer",
          createId: deps.createId,
          nowMs: warmedAt,
        });
        qaReports.push(qa);
        engage("qa_engineer");
        qaVerdict = gateOutcomeFor(qa);
        note({
          kind: OrgEventKind.TestRunRecorded,
          subjectId: task.workId,
          actorHatId: "qa_engineer",
          decision: `${qa.passed}/${qa.runs.length} passed → ${qaVerdict.outcome}`,
          toState: qaVerdict.outcome,
          atMs: warmedAt,
          evidenceRefs: qa.runs.flatMap((r) => r.evidence.map((e) => e.ref)),
          // The prose says how many passed; the FACT carries the runs, so a resumed run has a QA
          // history and `regressions` — passed before, fails now — has a "before".
          fact: { kind: "qa_cycle", report: qa },
        });
        return {
          ok: true,
          value: {
            refs: qa.runs.flatMap((r) => r.evidence.map((e) => e.ref)),
            summary: `${qa.passed}/${qa.runs.length} passed`,
          },
          evidence: qa.runs.flatMap((r) => r.evidence),
        };
      },
    };

    // The item's OWN chain, not the run's whole pipeline. See `chainForTask`.
    // A STEP THAT ALREADY PASSED is not owed again — see `passedBefore`.
    const owedGates = new Set(
      chainForTask(task, deps.pipeline ?? DEFAULT_PIPELINE).filter((g) => !passedBefore(task.workId, g)),
    );
    const pipeline = withProducers(
      (deps.pipeline ?? DEFAULT_PIPELINE).filter((phase) => owedGates.has(phase.gate)),
      new Map<GateKind, ProducerPort>([
        // Grooming reads a DATA SOURCE, when the run declared one. Without a source this phase
        // stays judgement-only, exactly as it was — an organization that named no repository has
        // nothing to groom against, and a producer that read nothing would be worse than none: it
        // would put an empty citation list behind an approval and look like diligence.
        // THE RECORDED source, never `deps.dataSource`. Reaching the raw one would leave a real
        // adapter that read a repository absent from `invoked`, and the run would report it as
        // configured-but-never-reached while its citations sat in the gate's evidence.
        ...(providers.dataSource === undefined
          ? []
          : ([[GateKind.BusinessContextGrooming, groomingProducer(providers.dataSource)]] as const)),
        [GateKind.ImplementationReview, workProducer],
        [GateKind.RuntimeValidation, testProducer],
        // Caller-supplied producers LAST, so a run that wires a real document producer for a phase
        // gets it — but never at the cost of unhooking work or test execution above, which are the
        // runtime's own and not a caller's to remove.
        ...[...(deps.artifactProducers ?? new Map<GateKind, ProducerPort>())].filter(
          ([gate]) => gate !== GateKind.ImplementationReview && gate !== GateKind.RuntimeValidation,
        ),
      ]),
    );

    // ── WHO DECIDES EACH GATE ─────────────────────────────────────────────
    // Runtime validation is decided by the EVIDENCE and is not the reviewer's to overrule: green
    // tests are green tests, and letting an opinion outrank them would put the one earned verdict
    // back on the same footing as the others.
    //
    // Every other gate goes to the REVIEW PORT — and is now asked AT ITS PHASE rather than up
    // front. The verdicts used to be fetched for all thirteen gates before any of them ran, so a
    // reviewer was asked about an architecture before the architecture had been written.
    const reviewed = new Map<GateKind, ReviewVerdict>();
    const reviewEvidence = new Map<GateKind, readonly string[]>();
    // WHO AUTHORED A PHASE — see the comment where the phases are recorded. Hoisted so a phase
    // recorded the moment it is made is attributed exactly as it would be after the walk.
    const authorOf = (gate: GateKind): { hatId: string; staffed: boolean } => {
      const staffing = candidatesFor(deps.chart, gate);
      const picked = authorFor(staffing, preferredHats);
      if (picked !== undefined) return { hatId: picked.hatId, staffed: true };
      return { hatId: task.assigneeHatId ?? NO_PROPOSER, staffed: false };
    };
    const askTheReviewer = async (
      gate: GateKind,
      produced: Artifact | undefined,
      soFar: ReadonlyMap<GateKind, Artifact>,
      said?: PhaseTranscript,
    ): Promise<void> => {
      if (produced !== undefined) recordProduced(task.workId, gate, produced, authorOf(gate).hatId, task.assigneeHatId, said);
      if (gate === GateKind.RuntimeValidation) return;
      // WHAT THIS PHASE MADE, PLUS THE WHOLE TRAIL BEHIND IT. A reviewer judging from a title is
      // the thing the evidence work was for; a LATE reviewer judging only from its own phase would
      // be nearly as blind — the final architecture review needs the design and the test runs, not
      // just whatever the last step happened to emit.
      const trail = [...soFar.values()].flatMap((a) => a.refs);
      const shown = [...new Set([...(produced?.refs ?? []), ...trail])];

      // ── CHECKS FIRST, WHERE ANY ARE BOUND ─────────────────────────────────
      // They run in the CHANGE'S OWN CHECKOUT and are recorded against the git TREE they judged, so
      // a gate re-evaluated over unchanged content reuses the verdict and changed content cannot.
      // Without the tree the answer would say nothing about which code it looked at, which is the
      // "the artifact you edited is not the one that ran" failure this register has already paid
      // for more than once.
      const boundIds = checkIdsFor(deps.checkBindings ?? [], gate, [task.workId]);
      if (boundIds.length > 0 && providers.change.revision !== undefined) {
        const handle = openedChanges.get(task.workId);
        const at = handle === undefined ? undefined : await providers.change.revision(handle);
        // NO CHECKOUT OF ITS OWN, NO CHECKS. `handle.workdir` is filled in only by the
        // worktree adapter; the shared-checkout one leaves it absent on purpose, to mark that this
        // change has no isolation. Running the roster anyway meant falling back to `"."` — the
        // directory `run-org` was LAUNCHED FROM — so the checks would judge whatever repository the
        // operator happened to be standing in, and the verdict would be filed against this change's
        // tree hash. A wrong answer attributed to the right content is worse than no answer.
        if (handle === undefined || handle.workdir === undefined || at === undefined || !at.ok) {
          // NO TREE, NO VERDICT. Running the checks anyway would produce an answer nobody could
          // attribute to a revision, and caching it would attribute it to the wrong one.
          // THREE DIFFERENT REASONS, SAID APART. They send an operator to three different places:
          // to the pipeline (nothing has been opened yet), to a flag (no isolated checkout), or to
          // the repository (the branch will not resolve). Collapsing them into one sentence would
          // make the commonest of them the diagnosis for all three.
          const why =
            handle === undefined
              ? "no change has been opened for it yet, so there is nothing to check"
              : handle.workdir === undefined
                ? "the change has no checkout of its own to run them in — pass --worktrees"
                : "the change has no readable revision";
          refusals.push(`checks bound to ${gate} for ${task.workId} could not run: ${why}`);
          reviewed.set(gate, { outcome: GateOutcome.Rejected, reason: why });
          return;
        }
        const picked = selectChecks(deps.checkSpecs ?? [], boundIds);
        for (const missing of picked.unknown) {
          // A binding that matches nothing is a gate that verifies nothing while reporting itself
          // configured. Said out loud rather than left to be inferred from a short list.
          refusals.push(`check '${missing}' is bound to ${gate} on ${task.workId} and is not in the roster`);
        }
        const ran = runRoster(
          picked.selected,
          at.value.tree,
          { workdir: handle.workdir },
          deps.checkResults ?? new Map(),
        );
        for (const result of ran.results) {
          note({
            kind: OrgEventKind.QualityGateEvaluation,
            subjectId: task.workId,
            decision: `check ${result.checkId}: ${result.outcome}`,
            atMs: warmedAt,
            fact: {
              kind: "check_result",
              workId: task.workId,
              checkId: result.checkId,
              tree: result.tree,
              outcome: result.outcome,
              ...(result.exitCode === undefined ? {} : { exitCode: result.exitCode }),
              detail: result.detail,
              durationMs: result.durationMs,
              ...(result.falsifierPassed === undefined ? {} : { falsifierPassed: result.falsifierPassed }),
            },
          });
        }
        if (!ran.clean || picked.unknown.length > 0) {
          // THE CHECK OUTPUT IS THE REASON. A rejection saying "checks failed" sends an agent back
          // to guess; one carrying the file and the line sends it back to fix.
          const detail = ran.results
            .filter((r) => r.outcome !== "passed")
            .map((r) => `${r.checkId}: ${r.detail.split(String.fromCharCode(10))[0] ?? r.outcome}`)
            .join("; ");
          refusals.push(`checks on ${gate} for ${task.workId}: ${summarize(ran)}`);
          reviewed.set(gate, { outcome: GateOutcome.Rejected, reason: `${summarize(ran)}${detail === "" ? "" : ` — ${detail}`}` });
          return;
        }
      }

      // IN THE WORK'S OWN CHECKOUT when it has one - its own change, or the change it verifies.
      const reviewIn = handle?.workdir ?? subjectWorkdir;
      const verdict = await providers.review.review({
        gate,
        workId: task.workId,
        evidence: shown.map((ref) => ({ kind: "document" as const, ref })),
        ...(reviewIn === undefined ? {} : { workdir: reviewIn }),
      });
      if (!verdict.ok) {
        // A REVIEW THAT COULD NOT BE OBTAINED IS NOT AN APPROVAL. "Nobody was available to review
        // this" and "this was reviewed and approved" are the two sentences an organization must
        // never confuse.
        refusals.push(`review '${providers.review.meta.name}' on ${gate} for ${task.workId}: ${verdict.reason}`);
        reviewed.set(gate, { outcome: GateOutcome.Rejected, reason: `not reviewed: ${verdict.reason}` });
        return;
      }
      reviewed.set(gate, verdict.value);
      reviewEvidence.set(gate, verdict.evidence.map((e) => e.ref));
    };

    // The chooser stays SYNCHRONOUS — the menu discipline — and reads what `askTheReviewer` and the
    // test producer have already put in place for the gate being evaluated.
    const chooser: OrgChooser<GateOutcome> = (legal, ctx) => gateChooserFrom(reviewed, qaVerdict)(legal, ctx);

    let merged = false;
    // ── A STEP THAT PASSED IN AN EARLIER ATTEMPT IS NOT WALKED AGAIN ──────────
    // A rejection stops the walk AT the rejected step, so everything that passed lies before it and
    // nothing the rework changes can un-pass it. MEASURED: each attempt used to walk the whole chain
    // again, so an implementation turned back re-ran the reproduction — author and reviewer both —
    // before anyone looked at the new code. Earlier steps' documents stay on the item, in `observe`.
    const passedThisCycle = new Set<GateKind>();
    for (let attempt = 1; attempt <= maxAttempts && !merged; attempt += 1) {
      // ── WHAT THIS HAT ALREADY KNOWS, BEFORE IT DOES ANYTHING ─────────────
      // Injected per work item rather than per gate: the recall scope is the hat and the work, and
      // both are constant across the walk. Injecting fourteen times would inflate `injectedCount`
      // by the length of the pipeline and make every memory look ignored.
      const recalled = deps.recallFor?.(
        task.workId,
        task.assigneeHatId ?? NO_PROPOSER,
        "walk",
        pickedBy.get(task.workId),
      );

      const walked = await runPipeline(deps.chart, {
        workId: task.workId,
        node: task,
        pipeline: pipeline.filter((phase) => !passedThisCycle.has(phase.gate)),
        chooser,
        // ── EACH ATTEMPT IS ITS OWN MOMENT ──────────────────────────────────
        // All attempts used to be stamped `warmedAt`, so three retries of the same gate produced
        // three byte-identical evaluations — and `foldGateEvaluations` keys on
        // `workId|gate|outcome|byHatId|atMs|reason` and correctly collapsed them to one. Correct
        // for a replayed shard, wrong for a genuine retry: `repeatedRejections` could then never
        // count past one, so `proposeMeetings` — which needs two before it will put an hour in the
        // diary — could never fire. The meeting over a disagreement was unreachable.
        //
        // Derived from the attempt, so it stays a pure function of the run and replays identically.
        atMs: warmedAt + (attempt - 1),
        // Separation of duties: whoever did the work does not review it.
        proposerHatId: task.assigneeHatId ?? NO_PROPOSER,
        ...(handle === undefined ? {} : { handle }),
        // The reviewer is asked HERE — after this phase produced, before its gate is judged.
        prepare: askTheReviewer,
        onEvaluated: verdictNow(task.workId),
        // A reviewer's own references, on top of whatever the phase produced.
        extraEvidenceFor: (gate) => reviewEvidence.get(gate) ?? [],
        // Absent ⇒ meters carry tokens and no cost. Never a built-in table.
        ...(deps.pricing === undefined ? {} : { pricing: deps.pricing }),
        // ── THE CLOCK IS DECLARED, NOT AMBIENT ────────────────────────────
        // `meterCall` reads a clock, and an ambient `Date.now()` put a wall-clock instant into
        // every `metered_call` fact — so two runs of the SAME inputs produced different events and
        // `the runtime is a FUNCTION OF ITS INPUTS` began failing intermittently. It was right to.
        //
        // So: a run whose ports are all simulated reads the run's own LOGICAL instant, and is
        // replayable. A run that touched something real reads a real clock and is already declared
        // non-replayable by `fidelityOf`. Determinism now tracks replayability exactly, instead of
        // one of them quietly being false — the discipline in
        // `local-time-never-enters-the-shared-fold`, applied to the meter.
        now: replayableByConfiguration ? () => warmedAt : Date.now,
        // OPTIONAL, AND OFF UNLESS ASKED FOR. `humanGatesFor([])` is empty, and an empty set makes
        // every check below a no-op — so a run with no checkpoints walks the pipeline it always
        // walked, with no branch taken and nothing to wait for.
        ...((gates) => (gates.size === 0 ? {} : { humanRequiredAt: gates }))(
          humanGatesFor(deps.checkpoints ?? []),
        ),
        ...(deps.humanDecisionFor === undefined
          ? {}
          : { humanDecisionFor: (gate: GateKind) => deps.humanDecisionFor?.(task.workId, gate) }),
      });
      // What passed in this attempt is not walked in the next — see `passedThisCycle`.
      for (const e of walked.evaluations) if (isPassing(e.outcome)) passedThisCycle.add(e.gate);
      // Shaped as the old `GateRunResult` so the churn/escalation handling below is untouched by
      // the reordering — that logic is about what a rejection MEANS, which did not change.
      // THE PHASES' OUTPUT AS AN ARTIFACT the organization can deliberate over. In the pipeline's
      // own order, so a reordered pipeline yields a history in the order it actually ran.
      // WHAT THIS STEP WORKED OUT. Attributed to the hat that did the work — staffing decides who
      // that is, so nothing here needs to know which hat learns what.
      for (const [gate, art] of walked.artifacts.entries()) {
        for (const l of art.learned ?? []) {
          learnings.push({ workId: task.workId, gate, byHatId: task.assigneeHatId ?? task.ownerHatId, key: l.key, value: l.value });
        }
      }
      const produced = [...walked.artifacts.entries()].map(([gate, art]) => ({
        gate: String(gate),
        refs: art.refs,
        summary: art.summary,
        // Carried explicitly. A citation is not a document and no longer arrives inside `refs`;
        // dropping it here would switch the memory-utility circuit off without a word.
        citations: art.citations ?? [],
      }));
      // ── AND INTO THE LOG ────────────────────────────────────────────────
      // Until this line the phases' output existed only in memory and on the report, so it died with
      // the process: an observer could say a gate was approved and could not say what was approved,
      // or whether anything had been made at all. A reviewer being shown a gate NAME and asked to
      // sign it is the rubber stamp this whole chain exists to prevent, arriving one layer out.
      // ── DID IT USE ANY OF WHAT IT WAS GIVEN ──────────────────────────────
      // `recalled` was computed BEFORE the walk (see above) — memory that arrives after the work is
      // done is a diary entry, not a resource. This half only credits what was cited.
      if (recalled !== undefined && recalled.injectedIds.length > 0) {
        const citedFacts = deps.notedCitations?.(
          task.workId,
          task.assigneeHatId ?? NO_PROPOSER,
          recalled.injectedIds,
          // What the phases produced, PLUS what they said they relied on. The citations used to
          // arrive inside `refs` because the producer filed them as documents; now that they are
          // their own field they have to be passed deliberately, or fixing the document leak would
          // have silently switched the whole memory-utility circuit off.
          produced.flatMap((p) => [p.summary, ...p.refs, ...(p.citations ?? [])]),
        );
        for (const fact of citedFacts ?? []) {
          note({
            kind: OrgEventKind.DecisionRecorded,
            subjectId: task.workId,
            actorHatId: task.assigneeHatId,
            decision: `cited a memory it was given`,
            atMs: warmedAt,
            fact,
          });
        }
      }

      // ── WHO ACTUALLY DID EACH PHASE ─────────────────────────────────────
      // Every phase used to be credited to `task.assigneeHatId`, so one Backend Implementer
      // "wrote" the customer RFP review, the business context and the architecture. The chart says
      // otherwise: a gate's approvers sit in a department, that department is the discipline that
      // owns the phase, and its OTHER hats are the ones who could author it.
      //
      // The RMO CHOOSES inside that set — `preferredHats` is its ranking, and the first qualified
      // hat in it wins. When it offers nobody qualified the phase falls back to the task's holder
      // AND the fallback is recorded, so "an implementer wrote the RFP review" is visible as a
      // staffing failure rather than looking like the normal case.

      for (const phase of produced) {
        const author = authorOf(phase.gate as GateKind);
        if (!author.staffed) {
          // SAID OUT LOUD. A phase authored by whoever happened to hold the task is a staffing
          // failure, and the whole reason the attribution was wrong before is that it was silent.
          note({
            kind: OrgEventKind.Refusal,
            subjectId: task.workId,
            actorHatId: task.assigneeHatId,
            decision:
              `'${phase.gate}' was authored by '${author.hatId}', who does not hold that ` +
              `discipline — no qualified hat was available`,
            atMs: warmedAt,
          });
          refusals.push(
            `'${phase.gate}' on ${task.workId} was authored by '${author.hatId}', outside its discipline`,
          );
        }
        const said = walked.transcripts.get(phase.gate as GateKind);
        const early = recordedEarly.has(`${task.workId}::${phase.gate}`);
        if (!early) note({
          kind: OrgEventKind.DecisionRecorded,
          subjectId: task.workId,
          actorHatId: task.assigneeHatId,
          decision: `produced for '${phase.gate}': ${phase.summary}`,
          atMs: warmedAt,
          evidenceRefs: phase.refs,
          fact: {
            kind: "phase_output",
            workId: task.workId,
            gate: phase.gate,
            refs: phase.refs,
            summary: phase.summary,
            producedByHatId: author.hatId,
            ...(said === undefined ? {} : { output: said.output, durationMs: said.durationMs }),
          },
        });
        // ── WHAT THE CROSSING COST ────────────────────────────────────────
        // One row per port call, carrying the work item and the gate so that "what did this task
        // cost" and "what does this gate cost across every task" are both folds of the same rows.
        if (said !== undefined) {
          note({
            kind: OrgEventKind.DecisionRecorded,
            subjectId: task.workId,
            actorHatId: task.assigneeHatId,
            decision: `metered '${phase.gate}': ${String(said.meter.durationMs)}ms via ${said.meter.provider}`,
            atMs: warmedAt,
            fact: {
              kind: "metered_call",
              meter: said.meter,
              workId: task.workId,
              gate: phase.gate,
              ...(task.assigneeHatId === undefined ? {} : { hatId: task.assigneeHatId }),
            },
          });
        }
        // ── WHICH OF ITS REFS ARE ACTUALLY DOCUMENTS ──────────────────────
        // Only the ones that resolved to bytes. A refs list contains plan lines and urls too, and a
        // documents view built on the whole list offers a reader files that will not open.
        for (const ref of early ? [] : phase.refs) {
          const doc = deps.documentAt?.(ref);
          if (doc === undefined) continue;
          note({
            kind: OrgEventKind.DecisionRecorded,
            subjectId: task.workId,
            actorHatId: task.assigneeHatId,
            decision: `wrote ${doc.path} (${String(doc.bytes)} bytes) at '${phase.gate}'`,
            atMs: warmedAt,
            evidenceRefs: [ref],
            fact: {
              kind: "document_written",
              workId: task.workId,
              gate: phase.gate,
              path: doc.path,
              bytes: doc.bytes,
              producedByHatId: author.hatId,
            },
          });
        }
      }
      const history = historyFromPhases({
        artifactId: task.workId,
        phases: produced,
        byHatId: task.assigneeHatId ?? NO_PROPOSER,
        atMs: warmedAt,
      });
      if (history !== undefined) artifacts.set(task.workId, history);

      // WHAT THE AGENT DOING THIS STEP ASKED. Attributed to the hat actually assigned to the work
      // — staffing decides who was doing it, so nothing here needs to know which hat interviews,
      // grooms, or designs. A different chart routes the same question to a different person.
      for (const question of walked.questions) {
        questionsForHuman.push({
          taskId: task.workId,
          gate: walked.blockedAt ?? GateKind.ImplementationReview,
          byHatId: task.assigneeHatId ?? task.ownerHatId,
          question,
        });
      }
      if (walked.awaitingHuman !== undefined) {
        // ── THE WORK ALREADY DONE IS KEPT ───────────────────────────────────
        // The first version of this branch broke out before the recording below, so a task that
        // passed two gates and then stopped for a person recorded NEITHER of them: the store held
        // zero verdicts, the dashboard read `0/14` next to a task that was two gates in, and a
        // resumed run would have re-crossed gates it had already crossed. Waiting is a pause, not a
        // rollback — the same evaluations are recorded here as on any other path.
        gateRuns.push({
          taskId: task.workId,
          run: { evaluations: walked.evaluations, passed: walked.passed, merged: false, refusals: walked.refusals },
        });
        gateEvaluations.push(...walked.evaluations);
        for (const e of walked.evaluations) engage(e.byHatId);
        if (walked.evaluations.length > 0) {
          note({
            kind: OrgEventKind.QualityGateEvaluation,
            subjectId: task.workId,
            actorHatId: walked.evaluations[walked.evaluations.length - 1]?.byHatId,
            decision: `${walked.evaluations.length} gate verdict(s) recorded before stopping for a person`,
            atMs: warmedAt,
            fact: { kind: "gates_evaluated", evaluations: walked.evaluations },
          });
        }
        for (const r of walked.refusals) refusals.push(`gates for ${task.workId}: ${r}`);

        // NOT A REFUSAL AND NOT A BLOCK. Nobody has looked yet, and the work is fine — it is simply
        // not the organization's turn. Recorded as its own event so a dashboard can say whose it is.
        awaitingHuman.push({ taskId: task.workId, gate: walked.awaitingHuman });
        note({
          kind: OrgEventKind.DecisionRecorded,
          subjectId: task.workId,
          decision: `waiting for a person at '${String(walked.awaitingHuman)}' — stopped here on purpose`,
          toState: "awaiting_human",
          atMs: warmedAt,
        });
        break;
      }

      const run: GateRunResult = {
        evaluations: walked.evaluations,
        passed: walked.passed,
        merged: walked.complete,
        refusals: walked.refusals,
        ...(walked.blockedAt === undefined ? {} : { blockedAt: walked.blockedAt }),
        ...(walked.recovery === undefined ? {} : { recovery: walked.recovery }),
      };
      gateRuns.push({ taskId: task.workId, run });
      gateEvaluations.push(...run.evaluations);
      for (const e of run.evaluations) engage(e.byHatId);
      // The verdicts as DATA, so the log can rebuild them. The summary events below stay the human
      // reading of what the chain did.
      if (run.evaluations.length > 0) {
        note({
          kind: OrgEventKind.QualityGateEvaluation,
          subjectId: task.workId,
          actorHatId: run.evaluations[run.evaluations.length - 1]?.byHatId,
          decision: `${run.evaluations.length} gate verdict(s) recorded`,
          atMs: warmedAt,
          fact: { kind: "gates_evaluated", evaluations: run.evaluations },
        });
      }
      for (const r of run.refusals) refusals.push(`gates for ${task.workId}: ${r}`);
      if (run.merged) {
        merged = true;
        break;
      }
      if (run.blockedAt !== undefined) {
        gateBlocked.push({
          taskId: task.workId,
          gate: run.blockedAt,
          ...(run.recovery === undefined ? {} : { recovery: run.recovery }),
        });
      }
      note({
        kind: OrgEventKind.QualityGateEvaluation,
        subjectId: task.workId,
        actorHatId: run.evaluations[run.evaluations.length - 1]?.byHatId,
        decision: `turned back at ${run.blockedAt ?? "?"} (attempt ${attempt})`,
        fromState: run.blockedAt,
        toState: "rejected",
        atMs: warmedAt,
      });
      // WHY IT STOPPED, ON THE ITEM. A step that stops with a verdict carries the reviewer's words
      // on the evaluation; one that stops WITHOUT a verdict — its author failed, nobody could judge
      // it — carried its reason only in this process's `refusals`, printed when the process exits.
      // MEASURED on AIAGENT-1662: the implementation step was turned back with no verdict, and the
      // log, observe and the next attempt's author all saw "turned back" and nothing about why.
      for (const r of run.refusals) {
        note({
          kind: OrgEventKind.Refusal,
          subjectId: task.workId,
          ...(task.assigneeHatId === undefined ? {} : { actorHatId: task.assigneeHatId }),
          decision: `stopped at ${run.blockedAt ?? "?"} (attempt ${attempt}): ${r}`,
          atMs: warmedAt,
        });
      }
      if (run.refusals.length > 0) break;
      if (!detectChurn(task.workId, gateEvaluations, threshold)) continue;

      // ── 10. ESCALATE ──────────────────────────────────────────────────────
      const decider = escalationDeciderFor(deps.chart, task.ownerHatId);
      if (decider === undefined) {
        refusals.push(`churn on ${task.workId}: nobody may decide an escalation`);
        break;
      }
      const esc = decideEscalation(deps.chart, {
        trigger: EscalationTrigger.RepeatedGateRejection,
        workId: task.workId,
        ownerHatIds: [task.ownerHatId],
        deciderHatId: decider.id,
        chooser: deps.escalationChooser ?? firstLegalChooser(),
        ...(run.blockedAt === undefined ? {} : { reopenGate: run.blockedAt }),
      });
      if (!esc.ok) {
        refusals.push(`escalating ${task.workId}: ${esc.reason}`);
        break;
      }
      escalations.push({ taskId: task.workId, action: esc.action, effect: esc.effect, byHatId: esc.byHatId });

      // ASK THE LEVEL THAT HOLDS THE AUTHORITY. `RequestDecision`'s own policy says when it is
      // for — *"multiple valid paths exist and authority sits above the hat"* — and that is
      // exactly an escalation. It had ZERO senders, so the one signal family meant to carry "how
      // should we execute this?" upward was never used, and an escalation was a decision the hat
      // that noticed the problem made for itself.
      //
      // Sent AS WELL AS recorded, not instead: the local decision is what the run did, and the
      // signal is what the organization was asked. A supervisor overruling it later is the chain
      // working, and it cannot overrule something it was never told about.
      const askedDecision = sendSupervisorSignal(
        deps.chart,
        board,
        {
          signalId: deps.createId("sig"),
          anchorId: deps.createId("anchor"),
          fromHatId: esc.byHatId,
          tool: SignalTool.RequestDecision,
          title: `how to proceed with ${task.workId}`,
          message: `escalated after repeated rejection; the local call was '${esc.action}'`,
          // The gate verdicts ARE the document: a decision request with no record of what went
          // wrong asks the supervisor to re-derive the problem before deciding anything.
          evidence: [{ kind: "document", ref: `gates:${task.workId}` }],
          atMs: warmedAt,
          workItemId: task.workId,
        },
        deps.resourceAuthorityHatId,
      );
      if (askedDecision.ok) {
        board = askedDecision.board;
        signals.push(askedDecision.signal);
        note({
          kind: OrgEventKind.SupervisorSignalSent,
          subjectId: task.workId,
          actorHatId: askedDecision.signal.fromHatId,
          decision: `${askedDecision.signal.tool} → ${askedDecision.signal.toHatId}`,
          toState: askedDecision.signal.toHatId,
          atMs: warmedAt,
          evidenceRefs: askedDecision.signal.evidence.map((e) => e.ref),
          fact: { kind: "supervisor_signal", signal: askedDecision.signal },
        });
      } else {
        // The top of the chain has nobody to ask. Reported, because an escalation nobody above can
        // take is the organization discovering it has run out of authority — not a quiet no-op.
        refusals.push(`could not ask for a decision on ${task.workId}: ${askedDecision.reason}`);
      }
      engage(esc.byHatId);
      note({
        kind: OrgEventKind.EscalationDecision,
        subjectId: task.workId,
        actorHatId: esc.byHatId,
        decision: `escalated → ${esc.action} (${esc.effect})`,
        fromState: EscalationTrigger.RepeatedGateRejection,
        toState: esc.action,
        atMs: warmedAt,
        // The DECISION as a value. An escalation is the organization deciding something, and a
        // decision recorded as prose has to be re-parsed by whoever needs to act on it.
        fact: {
          kind: "escalation",
          taskId: task.workId,
          action: esc.action,
          effect: esc.effect,
          byHatId: esc.byHatId,
          trigger: EscalationTrigger.RepeatedGateRejection,
        },
      });

      // ── THE EFFECT IS RECORDED, AND THE LOOP STOPS EITHER WAY ─────────────
      // A first attempt at this let `changes_the_input` RETRY, on the reasoning that `AddAgents`
      // and `ReScope` exist precisely to change the input and try again. That was wrong, and a
      // test caught it: nothing in this runtime APPLIES an escalation action. No agents are added,
      // no scope is cut. Retrying on an input that did not change is a spin — five identical
      // attempts instead of two — and the typed effect would have been asserting something that
      // did not happen.
      //
      // So the loop stops on either effect, and the LIMIT is the honest part: the split is
      // recorded (`escalations` carries it) and will decide the retry the day something applies
      // the action. Until then, "we escalated and tried again with the same input" is not a
      // sentence this runtime is entitled to.
      halted.push({ taskId: task.workId, action: esc.action, byHatId: esc.byHatId });
      break;
    }

    if (!merged) continue;

    // THE CHANGE IS ALREADY OPEN AND THE WORK IS ALREADY DONE — both happened inside the pipeline,
    // at the phases whose gates judge them. This block used to open the change and call the work
    // executor HERE, after every gate had approved: the reordering is the point of the change that
    // introduced `pipeline.ts`, and leaving a second execution here would perform the work twice.
    // ── DONE IS EVIDENCE, NEVER MEMORY ──────────────────────────────────────
    // Checked against the RECORDED evaluations rather than against `merged`, which is only this
    // process's belief that its own walk finished. A verdict that never reached the log is a
    // verdict no second reader can see, and marking work done on it would let the cascade and the
    // record disagree about whether anything was ever approved.
    // PRIOR VERDICTS COUNT: a step passed in an earlier cycle is not walked again, so an item whose
    // steps passed across cycles would otherwise never read as done.
    const owedButUnproven = missingGates(task, task.workId, [...(deps.priorGateEvaluations ?? []), ...gateEvaluations]);
    if (owedButUnproven.length > 0) {
      refusals.push(
        `${task.workId} is not done: no passing verdict on the record for ` +
          `${owedButUnproven.join(", ")} — done requires evidence, not a completed walk`,
      );
      continue;
    }

    const closed = setState(cascade, task.workId, WorkState.Done);
    if (!closed.ok) refusals.push(`complete ${task.workId}: ${closed.reason}`);
    else {
      cascade = closed.cascade;
      const owed = chainOf(task);
      note({
        kind: OrgEventKind.QualityGateEvaluation,
        subjectId: task.workId,
        actorHatId: task.ownerHatId,
        // The item's OWN count. This said "all 14" for an item that owes four — a decision line
        // that misreports what was actually satisfied is a record nobody can audit against.
        decision:
          `passed all ${String(owed.length)} gate(s) this ${task.workType} owes ` +
          `(${owed.join(", ")}) and is done`,
        toState: WorkState.Done,
        atMs: warmedAt,
        evidenceRefs: owed.map((g) => `gate:${task.workId}:${String(g)}`),
        fact: { kind: "work_state", workId: task.workId, state: WorkState.Done },
      });
    }
  }

  // ── SUCCESSION — what happens to the hats when the bindings end ───────────
  const succession: SuccessionPlan[] = [];
  for (const b of bindings) {
    const hat = deps.chart.byId.get(b.hatId);
    if (hat === undefined) continue;
    const released = releaseBinding(b, hat, warmedAt + timingFor(hat).ttlMs, "cycle complete");
    if (!released.ok) continue;
    succession.push(
      planSuccession({
        hat,
        candidateAgentIds: deps.agents.map((a) => a.agentId),
        lastWearerAgentId: b.wearerAgentId,
      }),
    );
  }
  for (const plan of succession) {
    const holder = bindingForHat(bindings, plan.hatId);
    note({
      kind: OrgEventKind.SuccessionPlanned,
      subjectId: plan.hatId,
      actorHatId: plan.hatId,
      decision:
        plan.nextWearerAgentId !== undefined
          ? `succession (${plan.policy}): ${plan.nextWearerAgentId} is next`
          : `succession (${plan.policy}): awaiting an authority among ${plan.candidateAgentIds.length} candidate(s)`,
      toState: plan.nextWearerAgentId ?? "undecided",
      atMs: warmedAt,
      evidenceRefs: plan.candidateAgentIds,
    });
    if (holder !== undefined) {
      note({
        kind: OrgEventKind.HatBindingTransition,
        subjectId: holder.bindingId,
        actorHatId: plan.hatId,
        actorAgentId: holder.wearerAgentId,
        decision: `still worn until the lease ends`,
        toState: holder.phase,
        atMs: warmedAt,
      });
    }
  }

  // ── The work MARKET, recorded so a resumed run inherits it ────────────────
  // Emitted here rather than at each shard transition: `work-market.ts` owns those transitions, and
  // a fold that replayed them would be a second copy of that state machine, free to drift. One
  // snapshot, one authority, and a round trip that can be checked.
  // ── WHAT THIS RUN COULD DO, AND WHAT IT DID ───────────────────────────────
  // Recorded, not merely returned: the report tells a live caller, this fact tells everyone who
  // reads the log afterwards, which is the only audience a resumed organization has.
  //
  // LAST, deliberately. Every port has been called by now if it was going to be, so `invoked()` is
  // complete. Emitting earlier would record the configuration under a name that promises more.
  // ── ACCEPTANCE: THE SECOND GOVERNANCE PASS ────────────────────────────────
  // The first pass runs before execution and deliberately skips each rung's acceptance gate,
  // because that gate asserts "what I decomposed was delivered" and nothing has been at that point.
  // This pass runs after delivery and crosses exactly those gates, for the rungs whose children
  // actually arrived.
  //
  // Without it a goal was permanently unclosable: approved, built, delivered, and still owing a
  // final validation it could never reach. Measured as a second cycle adding zero events.
  for (const node of cascade.nodes) {
    if (isLeafType(node.workType)) continue;
    if (node.state === WorkState.Canceled) continue;

    const acceptance = acceptanceGateFor(node);
    if (acceptance === undefined) continue;
    // Already crossed? Nothing to do. Asked of the RECORD, not of this run's memory.
    if (missingGates(node, node.workId, [...(deps.priorGateEvaluations ?? []), ...gateEvaluations]).length === 0) continue;

    const deliveredNow = deliveredSet(cascade);
    const kids = childrenOf(cascade, node.workId).filter((c: CascadeNode) => c.state !== WorkState.Canceled);
    if (kids.length === 0 || !kids.every((c: CascadeNode) => deliveredNow.has(c.workId))) continue;

    // EVERY OTHER GATE FIRST. Accepting a rung whose earlier gates never passed would let a final
    // validation stand in for the architecture review it was supposed to follow.
    const stillOwed = missingGates(node, node.workId, [...(deps.priorGateEvaluations ?? []), ...gateEvaluations]);
    if (stillOwed.length > 1 || stillOwed[0] !== acceptance) {
      refusals.push(
        `${node.workId} cannot be accepted yet: still owes ${stillOwed.filter((g) => g !== acceptance).join(", ")}`,
      );
      continue;
    }

    const acceptReviewed = new Map<GateKind, ReviewVerdict>();
    const acceptEvidence = new Map<GateKind, readonly string[]>();
    const askAcceptanceReviewer = async (
      gate: GateKind,
      produced: Artifact | undefined,
      soFar: ReadonlyMap<GateKind, Artifact>,
    ): Promise<void> => {
      const trail = [...soFar.values()].flatMap((a) => a.refs);
      const shown = [...new Set([...(produced?.refs ?? []), ...trail])];
      const verdict = await providers.review.review({
        gate,
        workId: node.workId,
        evidence: shown.map((ref) => ({ kind: "document" as const, ref })),
      });
      if (!verdict.ok) {
        refusals.push(`review '${providers.review.meta.name}' on ${gate} for ${node.workId}: ${verdict.reason}`);
        acceptReviewed.set(gate, { outcome: GateOutcome.Rejected, reason: `not reviewed: ${verdict.reason}` });
        return;
      }
      acceptReviewed.set(gate, verdict.value);
      acceptEvidence.set(gate, verdict.evidence.map((e) => e.ref));
    };

    const accepted = await runPipeline(deps.chart, {
      workId: node.workId,
      node,
      pipeline: (deps.pipeline ?? DEFAULT_PIPELINE).filter((p) => p.gate === acceptance),
      chooser: (legal, ctx) => gateChooserFrom(acceptReviewed, NO_QA_VERDICT)(legal, ctx),
      atMs: warmedAt,
      proposerHatId: node.ownerHatId,
      prepare: askAcceptanceReviewer,
      onEvaluated: verdictNow(node.workId),
      extraEvidenceFor: (gate) => acceptEvidence.get(gate) ?? [],
      ...((gates) => (gates.size === 0 ? {} : { humanRequiredAt: gates }))(
        humanGatesFor(deps.checkpoints ?? []),
      ),
      ...(deps.humanDecisionFor === undefined
        ? {}
        : { humanDecisionFor: (gate: GateKind) => deps.humanDecisionFor?.(node.workId, gate) }),
      ...(deps.pricing === undefined ? {} : { pricing: deps.pricing }),
    });

    gateEvaluations.push(...accepted.evaluations);
    for (const e of accepted.evaluations) engage(e.byHatId);
    for (const r of accepted.refusals) refusals.push(`acceptance for ${node.workId}: ${r}`);
    if (accepted.awaitingHuman !== undefined) {
      awaitingHuman.push({ taskId: node.workId, gate: accepted.awaitingHuman });
      note({
        kind: OrgEventKind.DecisionRecorded,
        subjectId: node.workId,
        decision: `waiting for a person at '${String(accepted.awaitingHuman)}' — stopped here on purpose`,
        toState: "awaiting_human",
        atMs: warmedAt,
      });
    }
    if (accepted.evaluations.length > 0) {
      note({
        kind: OrgEventKind.QualityGateEvaluation,
        subjectId: node.workId,
        actorHatId: accepted.evaluations[accepted.evaluations.length - 1]?.byHatId,
        decision: `accepted this ${node.workType}: '${String(acceptance)}' crossed with its children delivered`,
        atMs: warmedAt,
        fact: { kind: "gates_evaluated", evaluations: accepted.evaluations },
      });
    }
  }

  const fidelity = noteFidelity(goalId, warmedAt);

  note({
    kind: OrgEventKind.QueueSnapshot,
    subjectId: queue.queueId,
    actorHatId: queue.hatId,
    decision:
      `queue at revision ${String(queue.revision)}: ${String(queue.shards.length)} shard(s), ` +
      `${String(queue.claims.length)} claim(s), ${String(queue.approvals.length)} approval(s)`,
    atMs: warmedAt,
    fact: { kind: "queue_snapshot", queue },
  });

  // ── The work as a real CHANGE ─────────────────────────────────────────────
  /** The changes the CHANGE-CONTROL PORT actually opened and merged — not the ones projected. */
  const changesLanded: string[] = [];
  /** Projected as merged, and the port said no. The organization and the repository disagree. */
  const changesUnlanded: string[] = [];
  /** Done in the cascade, and no commit exists for it in this run OR in any earlier one. */
  const changesDoneUnmerged: string[] = [];
  /** Handed to people for review in this run. */
  const changesHandedOff: string[] = [];
  /** Due to be handed off, and the handoff failed or could not be attempted. */
  const changesUnhandedOff: string[] = [];
  // -- WHO INTEGRATES: the organization, or a person ------------------------------
  // A REAL repository is merged into only when the operator said `delivery=merge`. Anything else -
  // `human_review`, or nothing said at all - means the organization hands the change to people and
  // stops. Unset is NOT treated as permission: MEASURED on the Agentic Team's first real run, the
  // runtime merged two defects into its clone's master because nothing said it should not, and
  // that is the one act the operator would never allow on the real repository.
  //
  // A simulated change control touches nothing, so it keeps merging in memory as it always has.
  const realChangeControl = providers.change.meta.fidelity === Fidelity.Real;
  const deliveryRule = resolveSetting(deps.settings ?? [], ProcessSetting.Delivery, []);
  const handOffInstead = realChangeControl && deliveryRule.value !== "merge";
  /**
   * What a reviewer reads first: the request it answers and what the organization checked, step by
   * step, with each reviewer's own words. Built from the record, never from an agent's summary.
   */
  const proposalFor = (workId: string, handle: ChangeHandle): ChangeProposal => {
    const node = nodeById(cascade, workId);
    const ref = node?.requestRef === undefined ? undefined : parseRequestRef(node.requestRef);
    const goal = startedGoals
      .map((g) => nodeById(cascade, g.goalId))
      .find((g) => g !== undefined && g.requestRef !== undefined && g.requestRef === node?.requestRef);
    const subject = goal?.title ?? node?.title ?? workId;
    const title = ref === undefined ? subject : `${ref.externalId}: ${subject}`;
    const related = (e: GateEvaluation): boolean =>
      e.workId === workId || nodeById(cascade, e.workId)?.dependsOn?.includes(workId) === true;
    const latest = new Map<string, GateEvaluation>();
    for (const e of uniqueVerdicts([...(deps.priorGateEvaluations ?? []), ...gateEvaluations])) {
      if (related(e)) latest.set(`${e.workId}|${String(e.gate)}`, e);
    }
    const oneLine = (t: string): string => t.split(/\s+/).join(" ").trim().slice(0, 400);
    const tick = String.fromCharCode(96);
    const lines = [
      ref === undefined ? `Work item ${workId}.` : `Answers ${ref.source} ${ref.externalId}.`,
      "",
      "Opened by the organization for HUMAN REVIEW. Nothing has been merged; integrating this change is a person's decision.",
      "",
      "## What was checked before this was proposed",
      "",
      ...[...latest.values()].map(
        (e) => `- **${String(e.gate)}** (${e.workId}) - ${String(e.outcome)} by ${e.byHatId}: ${oneLine(e.reason)}`,
      ),
      "",
      `Branch ${tick}${handle.branch}${tick}${handle.base === undefined ? "" : ` against ${tick}${handle.base}${tick}`}.`,
    ];
    return { title, description: lines.join(String.fromCharCode(10)), ...(handle.base === undefined ? {} : { base: handle.base }) };
  };
  /**
   * Hand a change to people. `again` is a follow-up re-pushing work already in front of them: it is
   * reported with the follow-up, never counted as this run's delivery.
   */
  const handOff = async (workId: string, handle: ChangeHandle, again = false): Promise<boolean> => {
    const failed = (reason: string): false => {
      refusals.push(reason);
      if (!again) changesUnhandedOff.push(workId);
      return false;
    };
    if (providers.change.handoff === undefined) {
      return failed(
        `change control '${providers.change.meta.name}' cannot hand ${handle.branch} to people for review, ` +
          `and delivery is '${deliveryRule.value ?? "unset"}': the organization does not merge it instead`,
      );
    }
    const proposal = proposalFor(workId, handle);
    // ── WHAT THE REQUEST SAYS IS THE ORGANIZATION'S CONVENTION, NOT OURS ─────
    // MEASURED on the first three merge requests: a list of gate verdicts, where the operator wanted
    // the problem, whether it reproduced, the root cause, the resolution and how the fix was confirmed.
    // With sections configured, an agent writes the description from the record and the diff, and
    // every section is CHECKED before anything is pushed: a request missing one is not handed off.
    const cr = deps.changeRequests;
    let description = proposal.description;
    if (cr !== undefined) {
      if (deps.describeChange === undefined) {
        return failed(
          `merge requests here must carry ${cr.sections.map((x) => x.heading).join(" / ")}, and nothing is configured to write them: ${handle.branch} was not handed off`,
        );
      }
      const written = await deps.describeChange({
        workId,
        title: proposal.title,
        branch: handle.branch,
        ...(handle.base === undefined ? {} : { base: handle.base }),
        ...(handle.workdir === undefined ? {} : { workdir: handle.workdir }),
        sections: cr.sections,
      });
      if (!written.ok) return failed(`the merge request for ${workId} could not be written: ${written.reason}`);
      const missing = missingSections(written.value, cr.sections);
      if (missing.length > 0) {
        return failed(`the merge request written for ${workId} does not carry: ${missing.join(", ")} - ${handle.branch} was not handed off`);
      }
      description =
        `${written.value.trim()}\n\n---\n` +
        "_Opened by the organization for HUMAN REVIEW. Nothing has been merged; integrating this change is a person's decision._";
    }
    const handed = await providers.change.handoff(handle, {
      ...proposal,
      description,
      ...(cr === undefined ? {} : { keepOut: cr.keepOut }),
    });
    if (!handed.ok) return failed(`change control '${providers.change.meta.name}' could not hand ${handle.branch} to people: ${handed.reason}`);
    if (!again) changesHandedOff.push(workId);
    note({
      kind: OrgEventKind.ChangeProjected,
      subjectId: workId,
      decision: `${again ? "updated for review" : "handed to people for review"}: ${handed.value.url ?? handed.value.branch} - nothing was merged`,
      toState: "awaiting_human_review",
      atMs: warmedAt,
      fact: {
        kind: "change_handed_off",
        workId,
        changeId: handle.changeId,
        branch: handed.value.branch,
        ...(handed.value.url === undefined ? {} : { url: handed.value.url }),
        ...(handed.value.commit === undefined ? {} : { commit: handed.value.commit }),
        ...(handle.base === undefined ? {} : { base: handle.base }),
      },
    });
    return true;
  };
  const changes = projectAll({
    cascade,
    queue,
    // EVERY VERDICT THE WORK HAS, not only this cycle's. A leaf whose early steps passed in an
    // earlier run carries those verdicts (see `priorGateEvaluations`) and walks only what is left -
    // so this cycle holds its QA and release verdicts and not its implementation review, and a
    // projection built from this cycle alone stopped at InReview. MEASURED on AIAGENT-1661: done in
    // the cascade, every step approved, and never merged.
    gateEvaluations: uniqueVerdicts([...(deps.priorGateEvaluations ?? []), ...gateEvaluations]),
    pickedBy,
    nowMs: warmedAt,
  });
  for (const c of changes) {
    note({
      kind: OrgEventKind.ChangeProjected,
      subjectId: c.workId,
      decision: `change is ${c.projection.state.tag}`,
      toState: c.projection.state.tag,
      atMs: warmedAt,
      evidenceRefs: c.projection.applied.map((a) => a.tag),
    });
    // A disagreement between the organization and its change record is the one thing change control
    // exists to catch, so it is a refusal rather than a line in the log.
    for (const d of c.disagreements) refusals.push(`change control ${c.workId}: ${d}`);

    // ...and then the CHANGE-CONTROL PORT makes the record true somewhere real.
    //
    // Without this the port would be decorative: `fidelityOf` would print `change_control … real`
    // on a run where nothing ever branched, which is the exact misreading the whole layer exists to
    // prevent — a report naming a capability that never ran. A projection that reached `Merged`
    // therefore has to be openable and mergeable, and a refusal CONTRADICTS the claim rather than
    // being logged beside it: `landed` is what the port did, never what the organization decided.
    // ── DONE, AND NO COMMIT EXISTS FOR IT ANYWHERE ────────────────────────
    //
    // The narrow rule below catches a merge the port REFUSED. It cannot catch work the cascade
    // calls done whose change never got as far as being offered — that item never reaches the line
    // below, so its refusal is recorded and the run delivers over it.
    //
    // THE HISTORY IS WHAT MAKES THIS SAFE, and the first attempt without it was wrong. Asking only
    // this run's projection, a RESUMED run reports every already-merged item as unlanded, because
    // resuming opens no change for work that finished last week. MEASURED 2026-09-10, two runs over
    // one repository: run 1 delivered with a merge commit in git; run 2 resumed and called the same
    // item unlanded while that commit sat there untouched. So the question is put to the log.
    //
    // NOT MEASURED IS NOT A FAILURE. `alreadyLanded` absent means the caller kept no history, and a
    // runtime that judged that as "nothing has landed" would fail every store-less run.
    if (
      providers.change.meta.fidelity === Fidelity.Real &&
      deps.alreadyLanded !== undefined &&
      !deps.alreadyLanded.has(c.workId) &&
      deps.alreadyHandedOff?.has(c.workId) !== true &&
      !changesLanded.includes(c.workId) &&
      doneWithNothingMerged(c.projection, { cascade, workId: c.workId })
    ) {
      refusals.push(
        `change control ${c.workId}: the cascade calls this done, the change is ${c.projection.state.tag}, and no commit exists for it`,
      );
      changesDoneUnmerged.push(c.workId);
      continue;
    }
    if (c.projection.state.tag !== "Merged") continue;
    // Landed by an earlier run: merging it again is an empty merge or a refusal, never progress.
    if (deps.alreadyLanded?.has(c.workId) === true) continue;
    // Already in front of a reviewer: proposing it again would open a second review of one change.
    if (deps.alreadyHandedOff?.has(c.workId) === true) continue;
    // The handle from when the work STARTED, not a fresh one. Re-opening here would branch off
    // whatever the repository looks like now and merge something that never held the work.
    const handle = openedChanges.get(c.workId);
    if (handle === undefined) {
      refusals.push(`change control ${c.workId}: projected as merged, but no change was ever opened for it`);
      continue;
    }
    // ── WHAT THE BRANCH ACTUALLY HOLDS, measured before it lands ────────
    // Asked here rather than at `open`, because at open the branch is empty: the diff that answers
    // "what did this work change" only exists once the work is done. An adapter that cannot diff
    // does not implement `changed`, and then no fact is emitted — which a view reads as "this
    // adapter cannot tell you", never as "nothing changed".
    if (providers.change.changed !== undefined) {
      const diff = await providers.change.changed(handle);
      if (diff.ok) {
        note({
          kind: OrgEventKind.ChangeProjected,
          subjectId: c.workId,
          decision: `${String(diff.value.length)} file(s) changed on ${handle.branch}`,
          atMs: warmedAt,
          fact: {
            kind: "change_files",
            workId: c.workId,
            changeId: handle.changeId,
            files: diff.value.map((f) => ({ path: f.path, added: f.added, removed: f.removed })),
          },
        });
      } else {
        refusals.push(`change control could not diff ${handle.branch}: ${diff.reason}`);
      }
    }
    // HANDED TO PEOPLE, NOT MERGED, unless the operator said the organization merges.
    if (handOffInstead) {
      await handOff(c.workId, handle);
      continue;
    }
    const landed = await providers.change.merge(handle);
    if (!landed.ok) {
      refusals.push(`change control '${providers.change.meta.name}' could not merge ${handle.branch}: ${landed.reason}`);
      changesUnlanded.push(c.workId);
      continue;
    }
    changesLanded.push(c.workId);
    // ── WHERE IT LANDED, RECORDED ─────────────────────────────────────────
    // `merge` returns the handle enriched with the merge commit and its tree when the adapter can
    // read them. Written to the LOG rather than kept in the report, because the question it answers
    // — "has this work ever landed?" — is asked by the NEXT run, which has no report from this one.
    note({
      kind: OrgEventKind.ChangeProjected,
      subjectId: c.workId,
      decision: `merged ${handle.branch}${landed.value.commit === undefined ? "" : ` at ${landed.value.commit.slice(0, 12)}`}`,
      atMs: warmedAt,
      fact: {
        kind: "change_merged",
        workId: c.workId,
        changeId: handle.changeId,
        branch: handle.branch,
        ...(landed.value.commit === undefined ? {} : { commit: landed.value.commit }),
        ...(landed.value.tree === undefined ? {} : { tree: landed.value.tree }),
      },
    });
  }

  // ── THE COLLECTION'S OWN MERGE ────────────────────────────────────────────
  //
  // A feature branch that nothing merges is WORSE than no feature branch: the stories land on it,
  // the run reports them delivered, and the trunk never sees any of the feature. Every loop above
  // merges code-producing LEAVES; nothing merged the thing they were collected into.
  //
  // WHEN is not a new concept — it is two facts the cascade already holds, and both are required:
  // the collection is Done (for a non-leaf that means its own gate chain passed, and `gate-demand`
  // holds the last gate until the children are delivered), AND every code item under it is done.
  // The second is checked rather than inferred from the first, because a collection marked done
  // over an unfinished child is exactly the disagreement this register exists to catch, and merging
  // on it would put half a feature on the trunk.
  //
  // NO `base` ON THE HANDLE, deliberately: a collection goes to the adapter's own trunk. That is
  // the same silence the open path uses, and it keeps the trunk in one place.
  const collectionsLanded: string[] = [];
  const collectionsUnlanded: string[] = [];
  // REAL CHANGE CONTROL ONLY. A simulated port would accept a merge of a branch that never existed
  // and emit a `change_merged` fact for it, which is a landing nobody can check — the vacuity class
  // wearing a success. A simulated run therefore behaves exactly as it did.
  if (providers.change.meta.fidelity === Fidelity.Real) {
    for (const ready of collectionsReadyToLand({
      cascade,
      ...(deps.settings === undefined ? {} : { settings: deps.settings }),
    })) {
      // ALREADY ON THE TRUNK, from an earlier run. Asked of the LOG, for the same reason the
      // done-with-nothing-merged rule asks it: this run has no history of its own, and a second
      // merge of a landed collection is either a refusal that reads as a defect or an empty merge
      // commit nobody asked for.
      if (deps.alreadyLanded?.has(ready.workId) === true) continue;
      if (deps.alreadyHandedOff?.has(ready.workId) === true) continue;
      if (collectionsLanded.includes(ready.workId)) continue;
      // A COLLECTION IS HANDED OFF THE SAME WAY: its branch goes to review as one change.
      if (handOffInstead) {
        await handOff(ready.workId, { changeId: `${ready.branch}@${ready.workId}`, branch: ready.branch });
        continue;
      }

      const landed = await providers.change.merge({
        changeId: `${ready.branch}@${ready.workId}`,
        branch: ready.branch,
      });
      if (!landed.ok) {
        refusals.push(
          `change control '${providers.change.meta.name}' could not land the collection ` +
            `'${ready.workId}' from ${ready.branch}: ${landed.reason}`,
        );
        collectionsUnlanded.push(ready.workId);
        continue;
      }
      collectionsLanded.push(ready.workId);
      note({
        kind: OrgEventKind.ChangeProjected,
        subjectId: ready.workId,
        decision:
          `landed collection ${ready.branch}` +
          `${landed.value.commit === undefined ? "" : ` at ${landed.value.commit.slice(0, 12)}`}`,
        atMs: warmedAt,
        fact: {
          kind: "change_merged",
          workId: ready.workId,
          changeId: `${ready.branch}@${ready.workId}`,
          branch: ready.branch,
          ...(landed.value.commit === undefined ? {} : { commit: landed.value.commit }),
          ...(landed.value.tree === undefined ? {} : { tree: landed.value.tree }),
        },
      });
    }
  }

  // ── AFTER THE HANDOFF: WHAT PEOPLE SAID, AND WHAT THE ORGANIZATION DOES ABOUT IT ──────
  //
  // A merge request is a conversation, and until this existed the organization handed a change off
  // and never looked at it again. Feedback (comments, updates, the target moving) is recorded as
  // ACTION ITEMS on the work it concerns - never as instructions: nothing here re-runs a gate or
  // reopens a step. The organization then weighs each handed-off change's open items and decides,
  // item by item, whether to address, decline or defer it; the decision is the session's, and this
  // only carries the items to it, checks the answer, and does the mechanical halves it asks for
  // (bringing the change level with its target, verifying, pushing it again). See `change-followup.ts`.
  const actionItemsRaised: string[] = [];
  const followUps: FollowUpReport[] = [];
  if (providers.change.meta.fidelity === Fidelity.Real) {
    const handedMap = new Map<string, HandedOffChange>(deps.handedOffChanges ?? []);
    const allItems = new Map<string, ActionItem[]>([...(deps.actionItems ?? new Map<string, readonly ActionItem[]>())].map(([w, v]) => [w, [...v]]));
    const known = new Set([...allItems.values()].flat().map((i) => i.actionItemId));
    const raise = (
      workId: string,
      actionItemId: string,
      d: { readonly source: string; readonly itemKind: string; readonly summary: string; readonly detail?: string; readonly url?: string; readonly author?: string },
    ): void => {
      // IDEMPOTENT: a webhook retry, or a poll that sees the same comment again, raises nothing new.
      if (known.has(actionItemId)) return;
      known.add(actionItemId);
      note({
        kind: OrgEventKind.ChangeProjected,
        subjectId: workId,
        decision: `action item on ${workId} (${d.itemKind}${d.author === undefined ? "" : ` by ${d.author}`}): ${d.summary.split(/\s+/).join(" ").slice(0, 200)}`,
        atMs: warmedAt,
        fact: { kind: "action_item_raised", workId, actionItemId, ...d },
      });
      allItems.set(workId, [...(allItems.get(workId) ?? []), { workId, actionItemId, ...d, raisedAtMs: warmedAt }]);
      actionItemsRaised.push(actionItemId);
    };
    const fromDelivery = (x: FeedbackDelivery) => ({
      source: x.source,
      itemKind: x.itemKind,
      summary: x.summary,
      ...(x.detail === undefined ? {} : { detail: x.detail }),
      ...(x.url === undefined ? {} : { url: x.url }),
      ...(x.author === undefined ? {} : { author: x.author }),
    });
    /** The change's own checkout, rejoined - never a fresh branch, which would lose what was reviewed. */
    const reopen = async (workId: string): Promise<ChangeHandle | undefined> => {
      const h = handedMap.get(workId);
      const node = nodeById(cascade, workId);
      if (h === undefined || node === undefined) return undefined;
      const opened = await providers.change.open(node, { branch: h.branch, ...(h.base === undefined ? {} : { base: h.base }) });
      if (!opened.ok) {
        refusals.push(`could not reopen ${h.branch} for ${workId}: ${opened.reason}`);
        return undefined;
      }
      return opened.value;
    };

    const corr = correlateFeedback(deps.feedback ?? [], handedMap, deps.defaultBase ?? "master");
    for (const m of corr.aboutChange) raise(m.workId, m.actionItemId, fromDelivery(m.delivery));
    for (const d of corr.unmatched) {
      note({
        kind: OrgEventKind.ChangeProjected,
        subjectId: goalId,
        decision: `feedback from ${d.source} (${d.itemKind}) concerns no change this organization handed off - not attached to anything`,
        atMs: warmedAt,
      });
    }
    // A TARGET THAT MOVED IS MEASURED, NOT ASSUMED: an item is raised only for a change that is
    // actually behind, so a push that the change already contains asks nobody to do anything.
    for (const m of corr.targetMoved) {
      if (known.has(m.actionItemId) || providers.change.syncWithTarget === undefined) continue;
      const handle = await reopen(m.workId);
      if (handle === undefined) continue;
      const at = await providers.change.syncWithTarget(handle, { apply: false });
      if (!at.ok) {
        refusals.push(`could not tell whether ${handle.branch} is behind its target: ${at.reason}`);
        continue;
      }
      if (at.value.behindBy === 0) continue;
      raise(m.workId, m.actionItemId, {
        ...fromDelivery(m.delivery),
        itemKind: "behind_target",
        summary: `${at.value.target} moved ahead: this change is ${String(at.value.behindBy)} commit(s) behind it`,
      });
    }

    const followUpOne = async (workId: string, items: readonly ActionItem[]): Promise<FollowUpReport> => {
      const refused: string[] = [];
      const handle = await reopen(workId);
      if (handle === undefined) return { workId, decided: [], handedOffAgain: false, refused: [`could not reopen the change for ${workId}`] };
      const node = nodeById(cascade, workId);
      const hatId = node?.assigneeHatId ?? node?.ownerHatId ?? "implementer";
      const canSync = deps.changeRequests?.sync === "merge_target" && providers.change.syncWithTarget !== undefined;
      const where = {
        workId,
        hatId,
        branch: handle.branch,
        ...(handle.base === undefined ? {} : { base: handle.base }),
        ...(handle.workdir === undefined ? {} : { workdir: handle.workdir }),
        items,
        canSync,
      };
      const before = providers.change.revision === undefined ? undefined : await providers.change.revision(handle);
      const triage = await deps.followUp!({ ...where, mode: "triage" });
      if (!triage.ok) return { workId, decided: [], handedOffAgain: false, refused: [`the follow-up of ${workId} did not complete: ${triage.reason}`] };
      const { accepted, refused: bad } = acceptedDecisions(items, triage.value.decisions);
      refused.push(...bad);

      let synced: FollowUpReport["synced"];
      if (triage.value.syncWithTarget) {
        if (!canSync) {
          refused.push("bringing the change up to date was asked for, and this organization only flags a change that is behind (sync: flag_only)");
        } else {
          const s = await providers.change.syncWithTarget!(handle, { apply: true });
          if (!s.ok) {
            refused.push(`could not bring ${handle.branch} up to date: ${s.reason}`);
          } else if (s.value.conflicts.length === 0) {
            synced = s.value;
          } else {
            // A CONFLICT IS JUDGEMENT: the merge is left in progress and a session resolves it. If it
            // does not, the merge is backed out whole - never pushed half-resolved.
            const resolved = await deps.followUp!({ ...where, mode: "resolve", conflicts: s.value.conflicts });
            const after = await providers.change.syncWithTarget!(handle, { apply: false });
            if (!resolved.ok || !after.ok || after.value.behindBy > 0) {
              await providers.change.abortSync?.(handle);
              refused.push(`merging ${s.value.target} conflicted in ${s.value.conflicts.join(", ")} and was not resolved - backed out`);
              synced = { ...s.value, applied: false };
            } else {
              synced = { ...s.value, applied: true, conflicts: [] };
            }
          }
        }
      }

      const afterRev = providers.change.revision === undefined ? undefined : await providers.change.revision(handle);
      // UNKNOWN IS TREATED AS MOVED: re-verifying a change that did not move costs a run; skipping the
      // verification of one that did would hand people something nobody checked.
      const moved = before?.ok === true && afterRev?.ok === true ? before.value.commit !== afterRev.value.commit : true;
      let handedOffAgain = false;
      let attempted = false;
      if (moved) {
        const verified = deps.verifyChange === undefined
          ? ({ ok: false, reason: "nothing is configured to verify a followed-up change" } as const)
          : await deps.verifyChange(handle);
        if (!verified.ok) refused.push(`the followed-up change was not handed off again - it does not pass verification: ${verified.reason}`);
        else {
          attempted = true;
          handedOffAgain = await handOff(workId, handle, true);
        }
      } else if (accepted.some((d) => d.outcome === "addressed")) {
        // NOTHING MOVED, AND SOMETHING WAS STILL ADDRESSED - an answered question, a description
        // asked to be rewritten. The request is re-described so what people read matches what the
        // organization now says about it; no code changed, so nothing needs verifying again.
        attempted = true;
        handedOffAgain = await handOff(workId, handle, true);
      }
      // AN ITEM IS SETTLED ONLY WHEN WHAT SETTLES IT IS IN FRONT OF PEOPLE: an "addressed" comment on a
      // change that was then not pushed has been addressed nowhere a reviewer can see.
      const settleable = moved ? handedOffAgain : !attempted || handedOffAgain;
      for (const d of accepted) {
        if (d.outcome === "deferred" || !settleable) continue;
        note({
          kind: OrgEventKind.ChangeProjected,
          subjectId: workId,
          actorHatId: hatId,
          decision: `action item ${d.actionItemId} ${d.outcome}: ${d.how.split(/\s+/).join(" ").slice(0, 200)}`,
          atMs: warmedAt,
          fact: { kind: "action_item_settled", workId, actionItemId: d.actionItemId, outcome: d.outcome, how: d.how, byHatId: hatId },
        });
      }
      note({
        kind: OrgEventKind.ChangeProjected,
        subjectId: workId,
        actorHatId: hatId,
        decision:
          `followed up ${workId}: ${String(accepted.filter((d) => d.outcome !== "deferred").length)} of ${String(items.length)} item(s) decided` +
          `${synced === undefined ? "" : synced.applied ? `, brought level with ${synced.target}` : ", not brought level"}` +
          `${handedOffAgain ? ", request updated" : ""}${refused.length === 0 ? "" : ` - ${refused.join("; ")}`}`,
        atMs: warmedAt,
      });
      return { workId, decided: accepted, ...(synced === undefined ? {} : { synced }), handedOffAgain, refused };
    };

    if (deps.followUp !== undefined) {
      const open = new Map<string, readonly ActionItem[]>();
      for (const [w, items] of allItems) {
        const o = items.filter((i) => i.settled === undefined);
        if (o.length > 0 && handedMap.has(w)) open.set(w, o);
      }
      for (const workId of followUpOrder(open).slice(0, Math.max(0, deps.maxFollowUps ?? 2))) {
        followUps.push(await followUpOne(workId, open.get(workId) ?? []));
      }
    } else if ([...allItems.values()].some((items) => items.some((i) => i.settled === undefined))) {
      // SAID, not silently kept: open items nobody is configured to look at are work waiting on nobody.
      refusals.push("handed-off changes have open action items and nothing is configured to follow them up");
    }
  }

  // A GOAL IS NOT DELIVERED WHILE A CHANGE THE ORGANIZATION PROJECTED AS MERGED DID NOT MERGE.
  //
  // The paragraph above says a refusal "CONTRADICTS the claim rather than being logged beside it",
  // and until this line it did not: `delivered` was `isDelivered(cascade, goalId)` alone, so the
  // refusal went into a list nothing read and the run still printed `goal DELIVERED`. Measured on
  // the first real end-to-end agent run — both merges refused, `delivered: true`, and
  // `deliveryRate.deliveredForReal` counted it as shipped.
  //
  // Narrow on purpose. It can only bite where the change record and the repository DISAGREE, which
  // a simulated change control never does, so no simulated run changes meaning. What it removes is
  // the ability to say DELIVERED over a repository in which nothing landed.
  // EVERY goal this run started, not just the first. Reporting the run delivered because its
  // highest-priority item finished would call a two-ticket run done with one ticket outstanding.
  const delivered =
    startedGoals.every((g) => isDelivered(cascade, g.goalId)) &&
    changesUnlanded.length === 0 &&
    // ...AND NO COLLECTION FAILED TO REACH THE TRUNK. Without this the stories are on the
    // feature branch, the feature branch is not on the trunk, and the run says delivered — the
    // same refusal-beside-the-claim shape the two clauses around it exist to prevent.
    collectionsUnlanded.length === 0 &&
    // ...AND NOTHING IS DONE WITH NO COMMIT BEHIND IT. A merge the port refused and a merge nobody
    // ever offered are both "the repository does not have this"; only the first was being counted.
    changesDoneUnmerged.length === 0 &&
    // ...AND EVERYTHING DUE TO BE HANDED TO PEOPLE WAS. A handoff that failed is work nobody can review.
    changesUnhandedOff.length === 0;
  note({
    kind: OrgEventKind.WorkItemTransition,
    subjectId: goalId,
    actorHatId: deps.acceptingHatId,
    decision: !delivered
      ? "goal not delivered"
      : handOffInstead
        ? "goal HANDED OFF for human review - the organization merged nothing"
        : "goal DELIVERED",
    toState: delivered ? "delivered" : "open",
    atMs: warmedAt,
  });

  // ── Phase 11 — the organization MOVES ──────────────────────────────────────
  // Batches are built from the cascade's own projects rather than declared, so the reactor works
  // the same work the rest of the run produced. Its trace and refusals join this run's: a stall
  // noticed here is part of what happened, not a separate report nobody reads.
  const reactor = runReactor(
    {
      chart: deps.chart,
      cascade,
      testRuns: qaReports.flatMap((q) => q.runs),
      gateEvaluations,
      createId: deps.createId,
      nowMs: warmedAt,
      ...(deps.actionChooser === undefined ? {} : { actionChooser: deps.actionChooser }),
      ...(deps.blockerFor === undefined ? {} : { blockerFor: deps.blockerFor }),
      ...(deps.depResolved === undefined ? {} : { depResolved: deps.depResolved }),
    },
    batchesFromCascade(cascade, deps.createId),
  );
  // Through `record`, one at a time. A bulk `trace.push(...)` here is exactly how these events
  // reached the trace while bypassing every observer.
  for (const event of reactor.trace) record(event);
  refusals.push(...reactor.refusals);

  // ── PACE, and the escalation it may warrant ───────────────────────────────
  // Computed from the finished cascade so the reading is over what the run actually delivered.
  // A run that is measurably behind RAISES the trigger rather than deciding anything: what to do
  // about it is the organization's call, through the normal authority check.
  // ── REPEATABLE INEFFICIENCY IS A REQUEST TO CHANGE THE SYSTEM ─────────────
  // `ORGANIZATION_RUNTIME_ARCHITECTURE.md` §"Workflow and Runtime Expansion": agents request new
  // workflows and automation *"when they discover repeatable organizational inefficiency"*, and
  // its examples are all countable — an Engineering Manager noticing REPEATED review drift, QA
  // noticing REPEATED missed coverage.
  //
  // The unit is DISTINCT WORK ITEMS, never occurrences. One item failing a gate four times is a
  // hard item, which churn and escalation already handle; four different items failing the same
  // gate is the process. That is also what separates this from the escalation above it: an
  // escalation asks somebody to decide about ONE stuck thing, an improvement says no per-item
  // decision will stop the next one.
  const inefficiencies = findInefficiencies({
    gateBlocked,
    escalations,
    refusals,
  });
  for (const pattern of inefficiencies) {
    // Raised by the hat that OWNS the affected work, so it travels the chain from where the
    // friction was felt rather than from wherever the detector happens to run.
    const owner = cascade.nodes.find((n) => n.workId === pattern.workIds[0])?.ownerHatId;
    if (owner === undefined) continue;
    const asked = sendSupervisorSignal(
      deps.chart,
      board,
      {
        signalId: deps.createId("sig"),
        anchorId: deps.createId("anchor"),
        fromHatId: owner,
        tool: SignalTool.SuggestImprovement,
        title: `recurring ${pattern.kind}: ${pattern.pattern}`,
        // What was seen, NOT what to build. The doc has a Director or a Manager deciding what
        // workflow to add; a detector arriving with a solution would make that call from the
        // bottom of the chain with the least context about what else is already in flight.
        message: `${pattern.summary} — ${pattern.workIds.join(", ")}`,
        evidence: pattern.workIds.map((id) => ({ kind: "trace" as const, ref: `recurrence:${id}` })),
        atMs: warmedAt,
      },
      deps.resourceAuthorityHatId,
    );
    if (asked.ok) {
      board = asked.board;
      signals.push(asked.signal);
      note({
        kind: OrgEventKind.SupervisorSignalSent,
        subjectId: pattern.pattern,
        actorHatId: asked.signal.fromHatId,
        decision: `${asked.signal.tool} → ${asked.signal.toHatId}: ${pattern.summary}`,
        toState: asked.signal.toHatId,
        atMs: warmedAt,
        evidenceRefs: asked.signal.evidence.map((e) => e.ref),
        fact: { kind: "supervisor_signal", signal: asked.signal },
      });
    } else {
      refusals.push(`could not raise '${pattern.pattern}' as an improvement: ${asked.reason}`);
    }
  }

  const trajectory = trajectoryOf(cascade.nodes);
  if (trajectory !== undefined) {
    note({
      kind: OrgEventKind.WorkItemTransition,
      subjectId: goalId,
      decision: `mission pace: ${trajectory.status} — ${trajectory.basis}`,
      atMs: warmedAt,
    });
    // A PACE PROBLEM IS A RISK, and `ReportRisk` is the family for one — *"a risk could affect
    // scope, schedule, quality, security, or cost"*. It had no senders, so the organization
    // measured its own pace and told nobody: the trigger went into `refusals`, which is a list for
    // things that went wrong rather than a channel anyone is watching.
    //
    // Raised for AT RISK as well as OFF TRACK, and that is the point of a risk report: off track
    // is a fact somebody must act on, at risk is a warning while acting is still cheap. Reporting
    // only the first would make the family a slower duplicate of the escalation above it.
    if (trajectory.status !== TrajectoryStatus.OnTrack && trajectory.status !== TrajectoryStatus.NotStarted) {
      const owner = cascade.nodes.find((n) => n.workId === goalId)?.ownerHatId;
      const risk =
        owner === undefined
          ? undefined
          : sendSupervisorSignal(
              deps.chart,
              board,
              {
                signalId: deps.createId("sig"),
                anchorId: deps.createId("anchor"),
                fromHatId: owner,
                tool: SignalTool.ReportRisk,
                title: `mission pace is ${trajectory.status}`,
                message: trajectory.basis,
                // The pace reading IS the measurement. A risk reported without one is an opinion
                // about the schedule, and `evidenceSatisfies` refuses it.
                evidence: [{ kind: "measurement", ref: `pace:${goalId}:${trajectory.status}` }],
                atMs: warmedAt,
                workItemId: goalId,
              },
              deps.resourceAuthorityHatId,
            );
      if (risk?.ok === true) {
        board = risk.board;
        signals.push(risk.signal);
        note({
          kind: OrgEventKind.SupervisorSignalSent,
          subjectId: goalId,
          actorHatId: risk.signal.fromHatId,
          decision: `${risk.signal.tool} → ${risk.signal.toHatId}`,
          toState: risk.signal.toHatId,
          atMs: warmedAt,
          evidenceRefs: risk.signal.evidence.map((e) => e.ref),
          fact: { kind: "supervisor_signal", signal: risk.signal },
        });
      } else if (risk !== undefined) {
        refusals.push(`could not report the pace risk on ${goalId}: ${risk.reason}`);
      }
    }
    if (warrantsEscalation(trajectory)) {
      refusals.push(
        `mission is off track (${trajectory.basis}) — ${EscalationTrigger.MissionOffTrack} is warranted`,
      );
    }
  }

  return {
    trajectory,
    halted,
    awaitingHuman,
    questionsForHuman,
    learnings,
    intakeAccepted: accepted,
    intakeRefused: refusedIntake,
    priorities: ordered,
    goalWorkId: goalId,
    cascade,
    bindings,
    succession,
    calendar,
    board,
    queue,
    queueReadout: readout(queue, warmedAt + deps.leaseMs + 1),
    qa: qaReports,
    testCases: allCases,
    gateRuns,
    gateEvaluations,
    gateBlocked,
    escalations,
    signals,
    loopTicks,
    levelsEngaged: [...levels].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b)),
    changes,
    changesLanded,
    changesDoneUnmerged,
    changesHandedOff,
    actionItemsRaised,
    followUps,
    delivered,
    trace,
    events: trace.map(render),
    refusals,
    reactor,
    artifacts,
    inefficiencies,
    // THE LAST STEP OF THE LOOP. Computed from what this run actually did, so the comparison is
    // against the repository and the gates rather than against the plan. The tracker is not passed
    // here: this runtime has no external state to compare with, and the report says so by listing
    // it under `notChecked` — silence is never counted as agreement.
    reconciliation: reconcile({
      cascade: cascade.nodes,
      changesLanded,
      changesUnlanded,
      changesDoneUnmerged,
      gateEvaluations,
      delivered,
    }),
    fidelity,
  };
}

/**
 * The chooser the gate chain consults: QA for runtime validation, the review port for the rest.
 *
 * EXTRACTED AND EXPORTED so every branch can be falsified. Inline, the "nobody answered" branch was
 * unreachable — the runtime populates a verdict for every non-runtime gate and returns early for
 * the runtime one — so it was a guard that could not fire, which is the vacuity class wearing a
 * safety belt. As a function over a map it can be handed a map with a hole in it.
 *
 * Every unknown case FAILS CLOSED. Approving where no verdict exists would reintroduce the rubber
 * stamp this port was built to remove, through the back door.
 */
export function gateChooserFrom(
  reviewed: ReadonlyMap<GateKind, ReviewVerdict>,
  qaVerdict: { readonly outcome: GateOutcome; readonly reason: string },
): OrgChooser<GateOutcome> {
  return (legal, ctx) => {
    // Runtime validation is decided by the EVIDENCE and is not the reviewer's to overrule: green
    // tests are green tests, and letting an opinion outrank them would put the one earned verdict
    // back on the same footing as the six that were not.
    if (ctx.includes(GateKind.RuntimeValidation)) {
      const i = legal.indexOf(qaVerdict.outcome);
      return i < 0
        ? { index: legal.indexOf(GateOutcome.Rejected), reason: qaVerdict.reason }
        : { index: i, reason: qaVerdict.reason };
    }
    const gate = ORDERED_GATES.find((g) => ctx.includes(g));
    const verdict = gate === undefined ? undefined : reviewed.get(gate);
    if (verdict === undefined) {
      return { index: legal.indexOf(GateOutcome.Rejected), reason: `no reviewer answered for '${ctx}'` };
    }
    // The verdict is CLAMPED to what this hat may actually say — the same discipline as the menu:
    // code computes the legal set, the judgement picks within it. A reviewer asking for an outcome
    // its hat does not hold blocks rather than being silently upgraded to one that fits.
    const i = legal.indexOf(verdict.outcome);
    return i < 0
      ? { index: legal.indexOf(GateOutcome.Rejected), reason: `'${verdict.outcome}' is not open to this hat: ${verdict.reason}` }
      : { index: i, reason: verdict.reason };
  };
}

/** Everyone who could be staffed, one agent per individual-contributor hat. */
export function agentsFromChart(chart: OrgChart, prefix = "agent"): readonly OrgAgent[] {
  return chart.hats
    .filter((h) => h.level === "individual_contributor")
    .map((h) => ({ agentId: `${prefix}-${h.id}`, hatId: h.id }));
}

/** Who may evaluate each gate in this chart — a staffing readout for the RMO. */
export function gateStaffing(chart: OrgChart): Readonly<Record<string, readonly string[]>> {
  const out: Record<string, readonly string[]> = {};
  for (const gate of Object.values(GateKind)) {
    out[gate] = gateOwners(chart, gate).map((h) => h.id);
  }
  return out;
}

/** Candidates eligible for a hat right now, with reasons for everyone excluded. */
export function staffingReadout(
  chart: OrgChart,
  hatId: string,
  agents: readonly OrgAgent[],
  bindings: readonly HatBinding[],
  nowMs: number,
) {
  const hat = chart.byId.get(hatId);
  if (hat === undefined) return undefined;
  return eligibleFor({
    chart,
    hat,
    candidates: agents.map((a) => ({ agentId: a.agentId, hatId: a.hatId })),
    bindings,
    nowMs,
  });
}

/**
 * Verdicts with repeats removed, keyed the way the log's own fold keys them - so the same verdict
 * seen as carried and as recorded this cycle counts once, and a merge cannot manufacture churn.
 */
export function uniqueVerdicts(verdicts: readonly GateEvaluation[]): readonly GateEvaluation[] {
  const seen = new Set<string>();
  const out: GateEvaluation[] = [];
  for (const e of verdicts) {
    const key = `${e.workId}|${e.gate}|${e.outcome}|${e.byHatId}|${String(e.atMs)}|${e.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
