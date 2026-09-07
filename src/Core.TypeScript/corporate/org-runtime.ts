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
  type CascadeNode,
} from "./goal-cascade";
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
  type Pipeline,
  type ProducerPort,
} from "./pipeline";
import { fidelityLine, recordingProviders, runFidelityOf, type ChangeHandle, type DataSourcePort, type ProviderSet, type ReviewVerdict, type RunFidelity } from "./providers";
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
  ORDERED_GATES,
  type GateEvaluation,
  type GateRunResult,
  type RecoveryPath,
  NO_PROPOSER,
} from "./quality-gate";
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
import { projectAll, type Projection } from "./change-control";
import { emit, OrgEventKind, render, type OrgEvent } from "./org-event";

const ORDERED_GATES_COUNT = 7;

/** An agent that exists and the hat it occupies in the chart. */
export interface OrgAgent {
  readonly agentId: string;
  readonly hatId: string;
}

export interface OrgRuntimeDeps {
  readonly chart: OrgChart;
  /** Work arriving from outside. */
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

  const trace: OrgEvent[] = [];
  const refusals: string[] = [];

  /**
   * Record one event.
   *
   * The supervisor chain is computed inside `emit` from the chart, so a caller here cannot pass a
   * wrong one — which is the only reason recording it is worth anything.
   */
  const note = (input: Parameters<typeof emit>[2]): void => {
    trace.push(emit(deps.chart, deps.createId("evt"), input));
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
    const r = receive(raw, { itemId: deps.createId("in"), nowMs: deps.nowMs, seen });
    if (!r.ok) {
      refusedIntake.push(r.refusal);
      refusals.push(`intake: ${r.refusal.reason} — ${r.refusal.message}`);
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

  // ── 3. CASCADE ────────────────────────────────────────────────────────────
  let cascade: Cascade = EMPTY_CASCADE;
  const goalId = deps.createId("goal");
  const goal = acceptGoal(cascade, deps.chart, {
    workId: goalId,
    title: topItem.title,
    acceptingHatId: deps.acceptingHatId,
  });
  if (!goal.ok) {
    refusals.push(`accept goal: ${goal.reason}`);
    return empty();
  }
  cascade = goal.cascade;
  engage(deps.acceptingHatId);
  note({
    kind: OrgEventKind.WorkItemTransition,
    subjectId: goalId,
    actorHatId: deps.acceptingHatId,
    decision: `accepted '${topItem.title}' as a goal`,
    toState: "open",
    atMs: deps.nowMs,
      fact: {
      kind: "work_created",
      workId: goalId,
      workType: WorkType.Goal,
      title: topItem.title,
      ownerHatId: deps.acceptingHatId,
    },
  });

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
      const associated = associateGoal(openedBook.book, goalId, pf.portfolioId);
      if (!associated.ok) refusals.push(`portfolio: ${associated.reason}`);
      else {
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
    note({
      kind: OrgEventKind.WorkItemTransition,
      subjectId: goalId,
      actorHatId: deps.acceptingHatId,
      decision: `this goal is about '${pf.title}'`,
      atMs: deps.nowMs,
      fact: { kind: "goal_associated", goalId, portfolioId: pf.portfolioId },
    });
      }
    }
  }

  const step = (
    parent: string,
    titles: readonly string[],
    prefix: string,
    workType?: WorkType,
  ): readonly string[] => {
    const children = titles.map((title) => ({
      workId: deps.createId(prefix),
      title,
      ...(workType === undefined ? {} : { workType }),
    }));
    const r = decompose(cascade, deps.chart, parent, children);
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
          },
        });
      }
    }
    return children.map((c) => c.workId);
  };

  const initiatives = step(goalId, [`initiative for ${topItem.title}`], "init");
  const projects = initiatives.flatMap((i) => step(i, [`project for ${topItem.title}`], "proj"));
  // THE LEAF CARRIES THE INTAKE'S OWN CLASSIFICATION. Intake decides an inbound event is a defect
  // or an incident; creating the executable work as a plain `task` regardless would discard that a
  // second time, one layer below where it was first thrown away. The VERIFY leaf stays a `review`
  // whatever the work is — checking a fix is a different kind of work from making it.
  const leafType = isLeafType(topItem.workType) ? topItem.workType : WorkType.Task;
  projects.flatMap((p) => [
    ...step(p, [`implement ${topItem.title}`], "task", leafType),
    ...step(p, [`verify ${topItem.title}`], "task", WorkType.Review),
  ]);

  // ── 4. STAFF — ranked assignment producing real, expiring bindings ────────
  let bindings: readonly HatBinding[] = [];
  const board0 = EMPTY_BOARD;
  let board: AnchorBoard = board0;
  const signals: SupervisorSignal[] = [];
  const supplyTarget = deps.supplyTarget ?? 1;

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
    const alreadyCarrying = new Set(
      cascade.nodes.map((n) => n.assigneeHatId).filter((h): h is string => h !== undefined),
    );
    const targetHat = deps.chart.hats.find(
      (h) =>
        h.level === "individual_contributor" &&
        !alreadyCarrying.has(h.id) &&
        reportsUpTo(deps.chart, h.id, task.ownerHatId),
    );
    if (targetHat === undefined) {
      refusals.push(
        `no free individual-contributor hat reports up to '${task.ownerHatId}' for ${task.workId}`,
      );
      continue;
    }

    // (b) The agents who could wear it. Ranked on the (agent, hat) pairing.
    const candidates: Candidate[] = deps.agents.map((a) => ({ agentId: a.agentId, hatId: a.hatId }));
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
    const may = mayTakeHat(bindings, outcome.agentId, targetHat.id, deps.nowMs);
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
    const chain = gatesOf(deps.pipeline ?? DEFAULT_PIPELINE);
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
  const escalations: OrgRuntimeReport["escalations"][number][] = [];
  /** Tasks whose loop an escalation STOPPED, so a caller can tell 'finished' from 'gave up'. */
  const halted: { readonly taskId: string; readonly action: EscalationAction; readonly byHatId: string }[] = [];
  const maxAttempts = Math.max(1, deps.maxGateAttempts ?? 3);
  const threshold = deps.churnThreshold ?? DEFAULT_CHURN_THRESHOLD;

  for (const task of staffedTasks) {
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
    const branch = `work/${task.workId}`;
    const openedResult = await providers.change.open(task, { branch });
    if (!openedResult.ok) {
      refusals.push(`change control '${providers.change.meta.name}' could not open ${branch}: ${openedResult.reason}`);
      continue;
    }
    openedChanges.set(task.workId, openedResult.value);
    const handle = openedResult.value;

    // ── WHAT EACH PHASE PRODUCES ──────────────────────────────────────────
    // The work executor and the test runner are PRODUCERS now, attached to the phases whose gates
    // judge what they make. That is the whole reordering: `implementation_review` reviews code that
    // exists because the phase before it wrote the code, and `runtime_validation` weighs tests that
    // ran against that code rather than against an empty branch.
    let qaVerdict = gateOutcomeFor({ runs: [], passed: 0, failed: 0, errored: 0, cases: [] } as unknown as QaCycleReport);

    const workProducer: ProducerPort = {
      meta: providers.work.meta,
      produce: async (node, ctx) => {
        const performed = await providers.work.execute(node, {
          branch: ctx.branch,
          ...(ctx.workdir === undefined ? {} : { workdir: ctx.workdir }),
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
              const r = await providers.tests.run(testCase, ctx);
              if (!r.ok) {
                return {
                  outcome: RunOutcome.Errored,
                  evidence: [{ kind: "trace" as const, ref: `runner-refused:${r.reason}` }],
                };
              }
              return { outcome: r.value.outcome, evidence: r.evidence };
            },
          },
          branch,
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

    const pipeline = withProducers(
      deps.pipeline ?? DEFAULT_PIPELINE,
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
    const askTheReviewer = async (
      gate: GateKind,
      produced: Artifact | undefined,
      soFar: ReadonlyMap<GateKind, Artifact>,
    ): Promise<void> => {
      if (gate === GateKind.RuntimeValidation) return;
      // WHAT THIS PHASE MADE, PLUS THE WHOLE TRAIL BEHIND IT. A reviewer judging from a title is
      // the thing the evidence work was for; a LATE reviewer judging only from its own phase would
      // be nearly as blind — the final architecture review needs the design and the test runs, not
      // just whatever the last step happened to emit.
      const trail = [...soFar.values()].flatMap((a) => a.refs);
      const shown = [...new Set([...(produced?.refs ?? []), ...trail])];
      const verdict = await providers.review.review({
        gate,
        workId: task.workId,
        evidence: shown.map((ref) => ({ kind: "document" as const, ref })),
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
    for (let attempt = 1; attempt <= maxAttempts && !merged; attempt += 1) {
      const walked = await runPipeline(deps.chart, {
        workId: task.workId,
        node: task,
        pipeline,
        chooser,
        atMs: warmedAt,
        // Separation of duties: whoever did the work does not review it.
        proposerHatId: task.assigneeHatId ?? NO_PROPOSER,
        handle,
        // The reviewer is asked HERE — after this phase produced, before its gate is judged.
        prepare: askTheReviewer,
        // A reviewer's own references, on top of whatever the phase produced.
        extraEvidenceFor: (gate) => reviewEvidence.get(gate) ?? [],
      });
      // Shaped as the old `GateRunResult` so the churn/escalation handling below is untouched by
      // the reordering — that logic is about what a rejection MEANS, which did not change.
      // THE PHASES' OUTPUT AS AN ARTIFACT the organization can deliberate over. In the pipeline's
      // own order, so a reordered pipeline yields a history in the order it actually ran.
      const produced = [...walked.artifacts.entries()].map(([gate, art]) => ({
        gate: String(gate),
        refs: art.refs,
        summary: art.summary,
      }));
      const history = historyFromPhases({
        artifactId: task.workId,
        phases: produced,
        byHatId: task.assigneeHatId ?? NO_PROPOSER,
        atMs: warmedAt,
      });
      if (history !== undefined) artifacts.set(task.workId, history);

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
    const closed = setState(cascade, task.workId, WorkState.Done);
    if (!closed.ok) refusals.push(`complete ${task.workId}: ${closed.reason}`);
    else {
      cascade = closed.cascade;
      note({
        kind: OrgEventKind.QualityGateEvaluation,
        subjectId: task.workId,
        actorHatId: task.ownerHatId,
        decision: `passed all ${ORDERED_GATES_COUNT} gates and is done`,
        toState: WorkState.Done,
        atMs: warmedAt,
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
  const changes = projectAll({
    cascade,
    queue,
    gateEvaluations,
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
    if (c.projection.state.tag !== "Merged") continue;
    // The handle from when the work STARTED, not a fresh one. Re-opening here would branch off
    // whatever the repository looks like now and merge something that never held the work.
    const handle = openedChanges.get(c.workId);
    if (handle === undefined) {
      refusals.push(`change control ${c.workId}: projected as merged, but no change was ever opened for it`);
      continue;
    }
    const landed = await providers.change.merge(handle);
    if (!landed.ok) {
      refusals.push(`change control '${providers.change.meta.name}' could not merge ${handle.branch}: ${landed.reason}`);
      changesUnlanded.push(c.workId);
      continue;
    }
    changesLanded.push(c.workId);
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
  const delivered = isDelivered(cascade, goalId) && changesUnlanded.length === 0;
  note({
    kind: OrgEventKind.WorkItemTransition,
    subjectId: goalId,
    actorHatId: deps.acceptingHatId,
    decision: delivered ? "goal DELIVERED" : "goal not delivered",
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
  trace.push(...reactor.trace);
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
