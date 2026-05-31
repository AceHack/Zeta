/**
 * Org cadence composition (A0) — wires the proven cycles (Work OS, memory
 * maintenance, change control) as concurrent CadenceLanes driven on their own
 * intervals, exactly like the keep-alive loop. main.ts calls this once and stops
 * it after the work loop finishes, keeping the entrypoint thin (single
 * responsibility: lane wiring lives here, not in main).
 *
 * Each lane runs on a configurable interval; a slow lane never delays another
 * (independent loops), and a thrown/degraded tick is isolated by the driver.
 */

import {
  buildDefaultChangeControlPolicy,
  buildInternalOnlyPipeline,
  buildHatDefinitions,
  applyAutonomyPolicy,
  type ChangeControlPort,
  type ReleaseBatchEvaluation,
} from "../../../packages/application/src/index.ts";
import { AutonomyLevel, type AutonomyPolicy, type ChangeSet } from "../../../packages/domain/src/index.ts";
import {
  createCockroachOrgEventStore,
  createCockroachMemoryStateStore,
  createCockroachChangeSetStore,
  createCockroachWorkIntakeSource,
  createCockroachDocUnitStore,
  createCockroachRecoveryScanReader,
} from "../../../packages/state-cockroach/src/index.ts";
import type { TelemetryPort } from "../../../packages/observability/src/index.ts";
import type { CockroachGenericSqlExecutor } from "../../../packages/state-cockroach/src/cockroach-sql-executor.ts";
import { runCadenceLane, type CadenceLane, type CadenceLaneObserver } from "./cadence-lane.ts";
import {
  createWorkOsCadenceLane,
  createObserveActWorkItemCadenceLane,
  createMemoryMaintenanceCadenceLane,
  createChangeControlCadenceLane,
  createReleaseQueueCadenceLane,
  createDocMaintenanceCadenceLane,
  createConformanceCadenceLane,
  createAbandonedRunBindingScanCadenceLane,
  createDeadLetterClassifierCadenceLane,
  createStaleReactionPlanScanCadenceLane,
  createStrandedScheduleScanCadenceLane,
  type ObserveActCommandRunner,
  type ObserveActToolDispatcher,
  type ObserveActWorkItemSource,
  type WorkIntakeSource,
} from "./org-cadence-lanes.ts";

export type OrgCadenceIntervals = {
  workOsMs: number;
  memoryMaintenanceMs: number;
  changeControlMs: number;
  releaseQueueMs: number;
  docMaintenanceMs: number;
  conformanceMs: number;
  staleReactionPlanScanMs: number;
  strandedScheduleScanMs: number;
  abandonedRunBindingScanMs: number;
  deadLetterClassifierMs: number;
};

export const OrgCadenceIntervalDefault: OrgCadenceIntervals = {
  workOsMs: 60_000,
  memoryMaintenanceMs: 6 * 60 * 60 * 1000, // 6h (memory decay is slow)
  changeControlMs: 30_000,
  releaseQueueMs: 30_000,
  docMaintenanceMs: 6 * 60 * 60 * 1000, // 6h (doc lifecycle is slow, like memory)
  conformanceMs: 60_000,
  staleReactionPlanScanMs: 60_000,
  strandedScheduleScanMs: 60_000,
  abandonedRunBindingScanMs: 60_000,
  deadLetterClassifierMs: 60_000,
};

export type ComposeOrgCadenceInput = {
  executor: CockroachGenericSqlExecutor;
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  intervals?: Partial<OrgCadenceIntervals>;
  /** sleep that wakes early when the cadence is stopped (the stop check is supplied) */
  sleep: (ms: number, isStopRequested: () => boolean) => Promise<void>;
  observer?: CadenceLaneObserver;
  /**
   * pending-work source for the Work OS lane. Defaults to the Cockroach intake source
   * (claims a `proposed` initiative → `active`, dequeue-once). Tests/proofs override it.
   */
  intake?: WorkIntakeSource;
  /**
   * live external review port (L0). When present, the change-control lane projects real
   * PRs/cards for `external` stages and pulls the decision; absent → internal-only.
   */
  externalPort?: ChangeControlPort;
  /**
   * the tenant's autonomy dial (C1). Applied to every change-control pipeline so WHICH stages
   * require a human is config, not hardcoded. Defaults to assisted (the QA sign-off stays human).
   */
  autonomy?: AutonomyPolicy;
  /**
   * real release gate for approved ChangeSets. If omitted, the release queue idles when empty
   * and degrades instead of applying approved work on metadata alone.
   */
  releaseBatchEvaluator?: (batch: readonly ChangeSet[]) => ReleaseBatchEvaluation;
  telemetry?: TelemetryPort;
  /**
   * Defaults to the legacy hardcoded Work OS loop. `observe-act` is the explicit
   * migration switch for the universal observe.ts controller path.
   */
  workOsDriver?: "legacy" | "observe-act";
  observeActWorkItems?: ObserveActWorkItemSource;
  observeActRunCommand?: ObserveActCommandRunner;
  observeActDispatchTool?: ObserveActToolDispatcher;
  /** bound each lane for tests/proofs; unbounded in the worker */
  maxTicksPerLane?: number;
};

export type OrgCadenceHandle = {
  stop: () => void;
  done: Promise<unknown>;
};

const idleObserveActWorkItemSource: ObserveActWorkItemSource = async () => null;

const unavailableObserveActCommandRunner: ObserveActCommandRunner = async () => {
  throw new Error("observe-act command runner unavailable");
};

const unavailableObserveActToolDispatcher: ObserveActToolDispatcher = async () => {
  throw new Error("observe-act tool dispatcher unavailable");
};

export function composeOrgCadenceLoops(input: ComposeOrgCadenceInput): OrgCadenceHandle {
  const intervals = { ...OrgCadenceIntervalDefault, ...input.intervals };
  const orgEvents = createCockroachOrgEventStore({ executor: input.executor });
  const memoryState = createCockroachMemoryStateStore({ executor: input.executor });
  const changeSets = createCockroachChangeSetStore({ executor: input.executor });
  const docUnits = createCockroachDocUnitStore({ executor: input.executor });
  const recoveryScanReader = createCockroachRecoveryScanReader({ executor: input.executor });
  const policy = buildDefaultChangeControlPolicy(input.organizationId);
  const appendEvent = (e: Parameters<typeof orgEvents.append>[0]) => orgEvents.append(e);

  // real intake by default: claim a `proposed` initiative from Cockroach (dequeue-once);
  // the worker idles only when nothing is proposed — no synthetic flood, no manual runner.
  const intake =
    input.intake ??
    createCockroachWorkIntakeSource({
      executor: input.executor,
      organizationId: input.organizationId,
      nowIso: () => new Date(input.now()).toISOString(),
    });
  const hats = buildHatDefinitions();
  const workLane = input.workOsDriver === "observe-act"
    ? createObserveActWorkItemCadenceLane({
      organizationId: input.organizationId,
      hats,
      now: input.now,
      createId: input.createId,
      source: input.observeActWorkItems ?? idleObserveActWorkItemSource,
      runCommand: input.observeActRunCommand ?? unavailableObserveActCommandRunner,
      dispatchTool: input.observeActDispatchTool ?? unavailableObserveActToolDispatcher,
    })
    : createWorkOsCadenceLane({
      organizationId: input.organizationId, hats, now: input.now, createId: input.createId, appendEvent,
      intake,
    });
  const memory = createMemoryMaintenanceCadenceLane({
    organizationId: input.organizationId, now: input.now, createId: input.createId,
    reader: memoryState, writer: memoryState, appendEvent,
  });
  // the autonomy dial as config (C1): apply the tenant policy to every resolved pipeline
  const autonomy: AutonomyPolicy = input.autonomy ?? { level: AutonomyLevel.Assisted, humanGatedStageIds: ["human-qa-signoff"] };
  const changeControl = createChangeControlCadenceLane({
    organizationId: input.organizationId, now: input.now, createId: input.createId,
    reader: changeSets, writer: changeSets,
    pipelineFor: (cs) => applyAutonomyPolicy(policy.pipelines[cs.pipelineId] ?? buildInternalOnlyPipeline(input.organizationId), autonomy),
    appendEvent,
    ...(input.externalPort ? { externalPort: input.externalPort } : {}),
  });
  const releaseQueue = createReleaseQueueCadenceLane({
    organizationId: input.organizationId,
    now: input.now,
    createId: input.createId,
    reader: changeSets,
    writer: changeSets,
    appendEvent,
    ...(input.releaseBatchEvaluator ? { evaluateBatch: input.releaseBatchEvaluator } : {}),
    runAtomically: async (operation) => {
      await input.executor.executeTransaction(async (transaction) => {
        const txExecutor: CockroachGenericSqlExecutor = {
          execute: transaction.execute,
          executeTransaction: async (nestedOperation) => await nestedOperation(transaction),
        };
        const txChangeSets = createCockroachChangeSetStore({ executor: txExecutor });
        const txOrgEvents = createCockroachOrgEventStore({ executor: txExecutor });
        await operation({
          writer: txChangeSets,
          appendEvent: (event) => txOrgEvents.append(event),
        });
      });
    },
  });
  const docMaintenance = createDocMaintenanceCadenceLane({
    organizationId: input.organizationId, now: input.now, createId: input.createId,
    reader: docUnits, writer: docUnits, appendEvent,
  });
  const conformance = createConformanceCadenceLane({
    organizationId: input.organizationId,
    reader: orgEvents,
    limit: 1_000,
    ...(input.telemetry === undefined ? {} : { telemetry: input.telemetry }),
  });
  const staleReactionPlans = createStaleReactionPlanScanCadenceLane({
    organizationId: input.organizationId,
    now: input.now,
    createId: input.createId,
    reader: recoveryScanReader,
    appendEvent,
  });
  const strandedSchedules = createStrandedScheduleScanCadenceLane({
    organizationId: input.organizationId,
    now: input.now,
    createId: input.createId,
    reader: recoveryScanReader,
    appendEvent,
  });
  const abandonedRunBindings = createAbandonedRunBindingScanCadenceLane({
    organizationId: input.organizationId,
    now: input.now,
    createId: input.createId,
    reader: recoveryScanReader,
    appendEvent,
  });
  const deadLetters = createDeadLetterClassifierCadenceLane({
    organizationId: input.organizationId,
    now: input.now,
    createId: input.createId,
    reader: recoveryScanReader,
    appendEvent,
  });

  const stopped = { value: false };
  const isStopRequested = () => stopped.value;
  const start = (lane: CadenceLane, intervalMs: number): Promise<unknown> =>
    runCadenceLane({
      lane, intervalMs, isStopRequested,
      sleep: (ms) => input.sleep(ms, isStopRequested), // sleep + loop check share ONE stop flag
      ...(input.observer ? { observer: input.observer } : {}),
      ...(input.maxTicksPerLane !== undefined ? { maxTicks: input.maxTicksPerLane } : {}),
    });

  const done = Promise.all([
    start(workLane, intervals.workOsMs),
    start(memory, intervals.memoryMaintenanceMs),
    start(changeControl, intervals.changeControlMs),
    start(releaseQueue, intervals.releaseQueueMs),
    start(docMaintenance, intervals.docMaintenanceMs),
    start(conformance, intervals.conformanceMs),
    start(staleReactionPlans, intervals.staleReactionPlanScanMs),
    start(strandedSchedules, intervals.strandedScheduleScanMs),
    start(abandonedRunBindings, intervals.abandonedRunBindingScanMs),
    start(deadLetters, intervals.deadLetterClassifierMs),
  ]);

  return { stop: () => { stopped.value = true; }, done };
}
