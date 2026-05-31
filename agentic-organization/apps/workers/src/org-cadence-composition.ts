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
  createCommandHandlerRegistry,
  createCommandPipeline,
  createHatAuthorityPort,
  createObserveLifecycleTransitionHandler,
  createScheduleBlockCommandAuthority,
  createSendSupervisorSignalHandler,
  evaluateControlPlaneAccess,
  RunLifecyclePhase,
  RunScope,
  ObserveCommandType,
  type CommandResult,
  type ChangeControlPort,
  type ObserveLifecycleTransitionCommand,
  type SendSupervisorSignalCommand,
  type ReleaseBatchEvaluation,
  type ControlPlaneBudgetCeiling,
  type ControlPlaneFlag,
  type ControlPlaneUsage,
  type ScopedMetricAgent,
} from "../../../packages/application/src/index.ts";
import {
  AutonomyLevel,
  CommandType,
  HatAssignmentAuthorityState,
  OrgEventKind,
  WorkItemState,
  type AutonomyPolicy,
  type ChangeSet,
  type OrgEvent,
} from "../../../packages/domain/src/index.ts";
import { createCommandAuthorizationPort, createPolicyDecisionObservationPort } from "../../../packages/policy/src/index.ts";
import {
  createCockroachOrgEventStore,
  createCockroachMemoryStateStore,
  createCockroachChangeSetStore,
  createCockroachWorkIntakeSource,
  createCockroachDocUnitStore,
  createCockroachRecoveryScanReader,
  createCockroachDurableStateAdapters,
  createCockroachControlPlaneStateStore,
  CockroachTableName,
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
  type ObserveActMenuSelector,
  type ObserveActSlotAuthorizer,
  type ObserveActToolDispatcher,
  type ObserveActWorkItemSource,
  type WorkIntakeSource,
} from "./org-cadence-lanes.ts";

type ObserveActPipelineCommand = ObserveLifecycleTransitionCommand | SendSupervisorSignalCommand;

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
   * Defaults to the legacy hardcoded Work OS loop. Shadow runs observe-act next
   * to legacy; primary replaces legacy with the universal observe.ts controller.
   */
  workOsDriver?: "legacy" | "observe-act" | "observe-act-shadow" | "observe-act-primary";
  observeActWorkItems?: ObserveActWorkItemSource;
  observeActRunCommand?: ObserveActCommandRunner;
  observeActDispatchTool?: ObserveActToolDispatcher;
  observeActSelectSlot?: ObserveActMenuSelector;
  observeActAuthorizeSlot?: ObserveActSlotAuthorizer;
  observeActMetricAgents?: readonly ScopedMetricAgent[] | undefined;
  observeActPromotionWindow?: ObserveActPromotionWindow | undefined;
  observeActPromotionWindowSource?: (() => Promise<ObserveActPromotionWindow>) | undefined;
  observeActPromotionPolicy?: ObserveActPromotionPolicy | undefined;
  controlPlane?: ComposeOrgCadenceControlPlane | undefined;
  /** bound each lane for tests/proofs; unbounded in the worker */
  maxTicksPerLane?: number;
};

export type ComposeOrgCadenceControlPlane = {
  flags?: readonly ControlPlaneFlag[] | undefined;
  loadFlags?: ((evaluatedAt: string) => Promise<readonly ControlPlaneFlag[]>) | undefined;
  budgets?: readonly ControlPlaneBudgetCeiling[] | undefined;
  usageForBoundary?: ((boundary: "cadence_tick_start" | "org_event_append", actionType: string) => ControlPlaneUsage | undefined) | undefined;
  availableSecretScopes?: readonly string[] | undefined;
  exemptLaneNames?: readonly string[] | undefined;
};

export type ObserveActPromotionWindow = {
  shadowTickCount: number;
  shadowSoakHours: number;
  shadowDivergenceRate: number;
  shadowIllegalSelections: number;
  primarySelectorRejections30m: number;
  primaryControlBypassRejections30m: number;
};

export type ObserveActPromotionPolicy = {
  minShadowTicks?: number | undefined;
  minShadowSoakHours?: number | undefined;
  maxShadowDivergenceRate?: number | undefined;
  primarySelectorRejectionDemotionThreshold?: number | undefined;
  primaryControlBypassDemotionThreshold?: number | undefined;
};

export type ObserveActPromotionDecision = {
  executionMode: "shadow" | "primary";
  reason: "shadow_window_clean" | "shadow_window_insufficient" | "shadow_window_diverged" | "primary_window_unsafe";
  evidenceRefs: readonly string[];
};

type ObserveActPromotionDecisionSource = () => Promise<ObserveActPromotionDecision | undefined>;

const DefaultObserveActPromotionPolicy = {
  minShadowTicks: 100,
  minShadowSoakHours: 24,
  maxShadowDivergenceRate: 0.05,
  primarySelectorRejectionDemotionThreshold: 2,
  primaryControlBypassDemotionThreshold: 1,
} as const satisfies Required<ObserveActPromotionPolicy>;

export function evaluateObserveActPromotionGate(
  window: ObserveActPromotionWindow,
  policy: ObserveActPromotionPolicy = {},
): ObserveActPromotionDecision {
  const effective = {
    minShadowTicks: policy.minShadowTicks ?? DefaultObserveActPromotionPolicy.minShadowTicks,
    minShadowSoakHours: policy.minShadowSoakHours ?? DefaultObserveActPromotionPolicy.minShadowSoakHours,
    maxShadowDivergenceRate: policy.maxShadowDivergenceRate ?? DefaultObserveActPromotionPolicy.maxShadowDivergenceRate,
    primarySelectorRejectionDemotionThreshold: policy.primarySelectorRejectionDemotionThreshold ?? DefaultObserveActPromotionPolicy.primarySelectorRejectionDemotionThreshold,
    primaryControlBypassDemotionThreshold: policy.primaryControlBypassDemotionThreshold ?? DefaultObserveActPromotionPolicy.primaryControlBypassDemotionThreshold,
  };
  const evidenceRefs = observeActPromotionEvidenceRefs(window);
  const primaryUnsafe =
    window.primarySelectorRejections30m >= effective.primarySelectorRejectionDemotionThreshold ||
    window.primaryControlBypassRejections30m >= effective.primaryControlBypassDemotionThreshold;
  if (primaryUnsafe) {
    return { executionMode: "shadow", reason: "primary_window_unsafe", evidenceRefs };
  }

  if (window.shadowIllegalSelections > 0 || window.shadowDivergenceRate > effective.maxShadowDivergenceRate) {
    return { executionMode: "shadow", reason: "shadow_window_diverged", evidenceRefs };
  }

  const shadowWindowSatisfied =
    window.shadowTickCount >= effective.minShadowTicks ||
    window.shadowSoakHours >= effective.minShadowSoakHours;
  return shadowWindowSatisfied
    ? { executionMode: "primary", reason: "shadow_window_clean", evidenceRefs }
    : { executionMode: "shadow", reason: "shadow_window_insufficient", evidenceRefs };
}

function observeActPromotionEvidenceRefs(window: ObserveActPromotionWindow): readonly string[] {
  return [
    `observe-act-promotion:shadow_ticks:${window.shadowTickCount}`,
    `observe-act-promotion:shadow_soak_hours:${window.shadowSoakHours}`,
    `observe-act-promotion:shadow_divergence_rate:${window.shadowDivergenceRate}`,
    `observe-act-promotion:shadow_illegal_selections:${window.shadowIllegalSelections}`,
    `observe-act-promotion:primary_selector_rejections_30m:${window.primarySelectorRejections30m}`,
    `observe-act-promotion:primary_control_bypass_rejections_30m:${window.primaryControlBypassRejections30m}`,
  ];
}

export type OrgCadenceHandle = {
  stop: () => void;
  done: Promise<unknown>;
};

const unavailableObserveActToolDispatcher: ObserveActToolDispatcher = async () => {
  throw new Error("observe-act tool dispatcher unavailable");
};

export function composeOrgCadenceLoops(input: ComposeOrgCadenceInput): OrgCadenceHandle {
  const intervals = { ...OrgCadenceIntervalDefault, ...input.intervals };
  const orgEvents = createCockroachOrgEventStore({ executor: input.executor });
  const controlPlaneState = createCockroachControlPlaneStateStore({ executor: input.executor });
  const controlPlane = createOrgCadenceControlPlane(input, controlPlaneState);
  const memoryState = createCockroachMemoryStateStore({ executor: input.executor });
  const changeSets = createCockroachChangeSetStore({ executor: input.executor });
  const docUnits = createCockroachDocUnitStore({ executor: input.executor });
  const recoveryScanReader = createCockroachRecoveryScanReader({ executor: input.executor });
  const policy = buildDefaultChangeControlPolicy(input.organizationId);
  const appendEvent = (laneName: string) => async (e: Parameters<typeof orgEvents.append>[0]) => {
    const denial = await controlPlane.guardOrgEventAppend(laneName, e);
    if (denial !== undefined) throw new Error(denial);
    await orgEvents.append(e);
  };

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
  const observeActPromotionDecisionSource = createObserveActPromotionDecisionSource(input);
  const initialObserveActPromotionDecision = resolveInitialObserveActPromotionDecision(input);
  const workOsDriver = resolveObserveActWorkOsDriver(input, initialObserveActPromotionDecision);
  const legacyWorkLane = createWorkOsCadenceLane({
    organizationId: input.organizationId, hats, now: input.now, createId: input.createId, appendEvent: appendEvent("work-os"),
    intake,
  });
  const observeActWorkLane = createObserveActWorkItemCadenceLane({
    organizationId: input.organizationId,
    hats,
    now: input.now,
    createId: input.createId,
    source: input.observeActWorkItems ?? createCockroachObserveActWorkItemSource(input),
    runCommand: input.observeActRunCommand ?? createCockroachObserveActCommandRunner(input, hats),
    dispatchTool: input.observeActDispatchTool ?? unavailableObserveActToolDispatcher,
    executionMode: async () => {
      const decision = await observeActPromotionDecisionSource();
      return decision?.executionMode ?? (workOsDriver === "observe-act-shadow" ? "shadow" : "primary");
    },
    supplementalEvidenceRefs: async () => promotionEvidenceRefs(await observeActPromotionDecisionSource()),
    ...(input.observeActMetricAgents === undefined ? {} : { metricAgents: input.observeActMetricAgents }),
    ...createOptionalObserveActSlotAuthorizer(input),
    ...(input.observeActSelectSlot === undefined ? {} : { selectSlot: input.observeActSelectSlot }),
    appendEvent: appendEvent("observe-act-work-item"),
  });
  const workLanes = workLanesFor(workOsDriver, legacyWorkLane, observeActWorkLane, observeActPromotionDecisionSource);
  const memory = createMemoryMaintenanceCadenceLane({
    organizationId: input.organizationId, now: input.now, createId: input.createId,
    reader: memoryState, writer: memoryState, appendEvent: appendEvent("memory-maintenance"),
  });
  // the autonomy dial as config (C1): apply the tenant policy to every resolved pipeline
  const autonomy: AutonomyPolicy = input.autonomy ?? { level: AutonomyLevel.Assisted, humanGatedStageIds: ["human-qa-signoff"] };
  const changeControl = createChangeControlCadenceLane({
    organizationId: input.organizationId, now: input.now, createId: input.createId,
    reader: changeSets, writer: changeSets,
    pipelineFor: (cs) => applyAutonomyPolicy(policy.pipelines[cs.pipelineId] ?? buildInternalOnlyPipeline(input.organizationId), autonomy),
    appendEvent: appendEvent("change-control"),
    ...(input.externalPort ? { externalPort: input.externalPort } : {}),
  });
  const releaseQueue = createReleaseQueueCadenceLane({
    organizationId: input.organizationId,
    now: input.now,
    createId: input.createId,
    reader: changeSets,
    writer: changeSets,
    appendEvent: appendEvent("release-queue"),
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
          appendEvent: async (event) => {
            const denial = await controlPlane.guardOrgEventAppend("release-queue", event);
            if (denial !== undefined) throw new Error(denial);
            await txOrgEvents.append(event);
          },
        });
      });
    },
  });
  const docMaintenance = createDocMaintenanceCadenceLane({
    organizationId: input.organizationId, now: input.now, createId: input.createId,
    reader: docUnits, writer: docUnits, appendEvent: appendEvent("doc-maintenance"),
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
    appendEvent: appendEvent("stale-reaction-plan-scan"),
  });
  const strandedSchedules = createStrandedScheduleScanCadenceLane({
    organizationId: input.organizationId,
    now: input.now,
    createId: input.createId,
    reader: recoveryScanReader,
    appendEvent: appendEvent("stranded-schedule-scan"),
  });
  const abandonedRunBindings = createAbandonedRunBindingScanCadenceLane({
    organizationId: input.organizationId,
    now: input.now,
    createId: input.createId,
    reader: recoveryScanReader,
    appendEvent: appendEvent("abandoned-run-binding-scan"),
  });
  const deadLetters = createDeadLetterClassifierCadenceLane({
    organizationId: input.organizationId,
    now: input.now,
    createId: input.createId,
    reader: recoveryScanReader,
    appendEvent: appendEvent("dead-letter-classifier"),
  });

  const stopped = { value: false };
  const isStopRequested = () => stopped.value;
  const start = (lane: CadenceLane, intervalMs: number): Promise<unknown> =>
    runCadenceLane({
      lane: controlPlane.protectLane(lane), intervalMs, isStopRequested,
      sleep: (ms) => input.sleep(ms, isStopRequested), // sleep + loop check share ONE stop flag
      ...(input.observer ? { observer: input.observer } : {}),
      ...(input.telemetry ? { telemetry: input.telemetry } : {}),
      ...(input.maxTicksPerLane !== undefined ? { maxTicks: input.maxTicksPerLane } : {}),
    });

  const done = Promise.all([
    ...workLanes.map((lane) => start(lane, intervals.workOsMs)),
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

type OrgCadenceControlPlane = {
  protectLane: (lane: CadenceLane) => CadenceLane;
  guardOrgEventAppend: (laneName: string, event: OrgEvent) => Promise<string | undefined>;
};

const DefaultControlPlaneExemptLaneNames = new Set([
  "conformance",
  "stale-reaction-plan-scan",
  "stranded-schedule-scan",
  "abandoned-run-binding-scan",
  "dead-letter-classifier",
]);

function createOrgCadenceControlPlane(
  input: ComposeOrgCadenceInput,
  state: ReturnType<typeof createCockroachControlPlaneStateStore>,
): OrgCadenceControlPlane {
  const exemptLaneNames = new Set([
    ...DefaultControlPlaneExemptLaneNames,
    ...(input.controlPlane?.exemptLaneNames ?? []),
  ]);
  const isExemptLane = (laneName: string) => exemptLaneNames.has(laneName);
  const loadFlags = async (evaluatedAt: string): Promise<readonly ControlPlaneFlag[]> => [
    ...(input.controlPlane?.flags ?? []),
    ...await (input.controlPlane?.loadFlags?.(evaluatedAt) ?? state.listActiveFlags(input.organizationId, evaluatedAt) as Promise<readonly ControlPlaneFlag[]>),
  ];
  const guard = async (
    laneName: string,
    boundary: "cadence_tick_start" | "org_event_append",
    actionType: string,
    actorHatId?: string | undefined,
  ): Promise<string | undefined> => {
    const evaluatedAt = new Date(input.now()).toISOString();
    const decision = evaluateControlPlaneAccess({
      organizationId: input.organizationId,
      actorHatId,
      tenantId: input.organizationId,
      boundary,
      actionType,
      evaluatedAt,
      flags: await loadFlags(evaluatedAt),
      budgets: input.controlPlane?.budgets,
      usage: input.controlPlane?.usageForBoundary?.(boundary, actionType),
      availableSecretScopes: input.controlPlane?.availableSecretScopes,
      isControlPlaneExempt: isExemptLane(laneName),
    });
    return decision.status === "denied" ? decision.message : undefined;
  };

  return {
    protectLane: (lane) => ({
      name: lane.name,
      runOnce: async () => {
        const denial = await guard(lane.name, "cadence_tick_start", lane.name);
        return denial === undefined
          ? await lane.runOnce()
          : { status: `${lane.name}:control-plane-denied`, failures: [{ message: denial }] };
      },
    }),
    guardOrgEventAppend: async (laneName, event) =>
      await guard(laneName, "org_event_append", event.kind, event.actorHatId),
  };
}

function createOptionalObserveActSlotAuthorizer(
  input: ComposeOrgCadenceInput,
): { authorizeSlot?: ObserveActSlotAuthorizer } {
  if (input.observeActAuthorizeSlot !== undefined) return { authorizeSlot: input.observeActAuthorizeSlot };
  return { authorizeSlot: createCockroachObserveActSlotAuthorizer(input) };
}

function resolveObserveActWorkOsDriver(
  input: Pick<ComposeOrgCadenceInput, "workOsDriver" | "observeActPromotionWindow" | "observeActPromotionPolicy">,
  promotionDecision: ObserveActPromotionDecision | undefined,
): NonNullable<ComposeOrgCadenceInput["workOsDriver"]> {
  const requested = input.workOsDriver ?? "legacy";
  if (requested === "legacy" || promotionDecision === undefined) return requested;

  return promotionDecision.executionMode === "primary" ? "observe-act-primary" : "observe-act-shadow";
}

function resolveInitialObserveActPromotionDecision(
  input: Pick<ComposeOrgCadenceInput, "workOsDriver" | "observeActPromotionWindow" | "observeActPromotionPolicy">,
): ObserveActPromotionDecision | undefined {
  const requested = input.workOsDriver ?? "legacy";
  if (requested === "legacy") return undefined;
  if ((requested === "observe-act" || requested === "observe-act-primary") && input.observeActPromotionWindow === undefined) {
    return evaluateObserveActPromotionGate({
      shadowTickCount: 0,
      shadowSoakHours: 0,
      shadowDivergenceRate: 0,
      shadowIllegalSelections: 0,
      primarySelectorRejections30m: 0,
      primaryControlBypassRejections30m: 0,
    }, input.observeActPromotionPolicy);
  }
  if (input.observeActPromotionWindow === undefined) return undefined;
  return evaluateObserveActPromotionGate(input.observeActPromotionWindow, input.observeActPromotionPolicy);
}

function createObserveActPromotionDecisionSource(
  input: ComposeOrgCadenceInput,
): ObserveActPromotionDecisionSource {
  const requested = input.workOsDriver ?? "legacy";
  if (requested === "legacy") return async () => undefined;
  if (input.observeActPromotionWindow !== undefined) {
    const decision = evaluateObserveActPromotionGate(input.observeActPromotionWindow, input.observeActPromotionPolicy);
    return async () => decision;
  }

  const source = input.observeActPromotionWindowSource ?? createCockroachObserveActPromotionWindowSource(input);
  return cacheDecisionForConcurrentWorkLanes(
    async () => evaluateObserveActPromotionGate(await source(), input.observeActPromotionPolicy),
  );
}

function cacheDecisionForConcurrentWorkLanes(
  source: ObserveActPromotionDecisionSource,
): ObserveActPromotionDecisionSource {
  let cached: Promise<ObserveActPromotionDecision | undefined> | undefined;
  let clearScheduled = false;
  return async () => {
    cached ??= source();
    if (!clearScheduled) {
      clearScheduled = true;
      setTimeout(() => {
        cached = undefined;
        clearScheduled = false;
      }, 0);
    }
    return await cached;
  };
}

function promotionEvidenceRefs(
  decision: ObserveActPromotionDecision | undefined,
): readonly string[] {
  return decision === undefined
    ? []
    : [
        `observe-act-promotion:decision:${decision.reason}`,
        `observe-act-promotion:mode:${decision.executionMode}`,
        ...decision.evidenceRefs,
      ];
}

function workLanesFor(
  driver: NonNullable<ComposeOrgCadenceInput["workOsDriver"]>,
  legacy: CadenceLane,
  observeAct: CadenceLane,
  decisionSource: ObserveActPromotionDecisionSource,
): readonly CadenceLane[] {
  switch (driver) {
    case "legacy":
      return [legacy];
    case "observe-act-shadow":
      return [promotionGatedLegacyLane(legacy, decisionSource), observeAct];
    case "observe-act":
    case "observe-act-primary":
      return [promotionGatedLegacyLane(legacy, decisionSource), observeAct];
  }
}

function promotionGatedLegacyLane(
  legacy: CadenceLane,
  decisionSource: ObserveActPromotionDecisionSource,
): CadenceLane {
  return {
    name: legacy.name,
    runOnce: async () => {
      const decision = await decisionSource();
      return decision?.executionMode === "primary"
        ? { status: "work-os:observe-act-primary-suppressed", failures: [] }
        : await legacy.runOnce();
    },
  };
}

function createCockroachObserveActPromotionWindowSource(
  input: Pick<ComposeOrgCadenceInput, "executor" | "organizationId" | "now">,
): () => Promise<ObserveActPromotionWindow> {
  const store = createCockroachOrgEventStore({ executor: input.executor });
  return async () => {
    const now = input.now();
    const events = (await store.listByOrganization(input.organizationId, 10_000))
      .filter((event) =>
        event.kind === OrgEventKind.ObserveActTick &&
        event.traceId.startsWith("observe-act-")
      );
    return observeActPromotionWindowFromEvents(events, now);
  };
}

function observeActPromotionWindowFromEvents(
  events: readonly OrgEvent[],
  now: number,
): ObserveActPromotionWindow {
  const shadowEvents = events.filter((event) => !event.evidenceRefs.includes("observe-act-promotion:mode:primary"));
  const shadowOccurredAt = shadowEvents
    .map((event) => Date.parse(event.occurredAt))
    .filter((timestamp) => Number.isFinite(timestamp));
  const earliestShadow = shadowOccurredAt.length === 0 ? now : Math.min(...shadowOccurredAt);
  const shadowSoakHours = Math.max(0, (now - earliestShadow) / (60 * 60 * 1000));
  const recentPrimaryEvents = events.filter((event) =>
    event.evidenceRefs.includes("observe-act-promotion:mode:primary") &&
    Date.parse(event.occurredAt) >= now - 30 * 60 * 1000
  );
  return {
    shadowTickCount: shadowEvents.length,
    shadowSoakHours,
    shadowDivergenceRate: shadowEvents.length === 0
      ? 1
      : shadowEvents.filter((event) =>
          event.evidenceRefs.some((ref) => ref.startsWith("observe-act:shadow_divergence:"))
        ).length / shadowEvents.length,
    shadowIllegalSelections: shadowEvents.filter((event) =>
      event.evidenceRefs.some((ref) => ref.startsWith("observe-act:selector_rejected:") || ref === "observe-act:selected_slot:illegal")
    ).length,
    primarySelectorRejections30m: recentPrimaryEvents.filter((event) =>
      event.evidenceRefs.some((ref) => ref.startsWith("observe-act:selector_rejected:"))
    ).length,
    primaryControlBypassRejections30m: recentPrimaryEvents.filter((event) =>
      event.evidenceRefs.some((ref) => ref.startsWith("observe-act:control_bypass_rejected:"))
    ).length,
  };
}

type ObserveActWorkItemRow = {
  work_item_id: string;
  project_id: string;
  state: string;
  version: string | number;
  created_by_agent_id: string;
  created_by_hat_assignment_id: string;
};

type ObserveActSupervisorAssignmentRow = {
  hat_assignment_id: string;
};

function createCockroachObserveActWorkItemSource(
  input: Pick<ComposeOrgCadenceInput, "executor" | "organizationId" | "now">,
): ObserveActWorkItemSource {
  const stateAdapters = createCockroachDurableStateAdapters<CommandResult>({ executor: input.executor });
  return async () => {
    const result = await input.executor.execute<ObserveActWorkItemRow>({
      name: "claimable_observe_act_work_item",
      sql: `
        SELECT work_item_id, project_id, state, version, created_by_agent_id, created_by_hat_assignment_id
        FROM ${CockroachTableName.WorkItems}
        WHERE organization_id = $1
          AND state IN ($2, $3, $4, $5)
        ORDER BY updated_at ASC, created_at ASC
        LIMIT 10
      `.trim(),
      parameters: [
        input.organizationId,
        WorkItemState.Ready,
        WorkItemState.InProgress,
        WorkItemState.Review,
        WorkItemState.Blocked,
      ],
    });
    for (const row of result.rows) {
      const phase = observeActPhaseForWorkItemState(row.state);
      if (phase === undefined) continue;
      const actorAuthority = await stateAdapters.hatAssignmentAuthorityReader.findHatAssignmentAuthority(row.created_by_hat_assignment_id);
      if (actorAuthority === undefined || actorAuthority.state !== HatAssignmentAuthorityState.Active) continue;
      const actorHat = buildHatDefinitions().find((hat) => hat.id === actorAuthority.hatId);
      if (actorHat === undefined) continue;
      const supervisorHatId = actorHat.reportsToHatIds[0];
      const supervisorHatAssignmentId = supervisorHatId === undefined
        ? undefined
        : await findActiveObserveActSupervisorHatAssignment(input, {
            organizationId: actorAuthority.organizationId,
            projectId: actorAuthority.projectId,
            teamId: actorAuthority.teamId,
            supervisorHatId,
          });
      const evaluatedAt = new Date(input.now()).toISOString();
      const scheduleBlocks = await stateAdapters.workScheduleBlockAuthorityReader.findAuthorizingScheduleBlocks({
        agentId: row.created_by_agent_id,
        hatAssignmentId: row.created_by_hat_assignment_id,
        evaluatedAt,
      });
      return {
        runId: String(row.version),
        projectId: row.project_id,
        ...(actorAuthority.teamId === undefined ? {} : { teamId: actorAuthority.teamId }),
        workItemId: row.work_item_id,
        scope: RunScope.WorkItem,
        phase,
        hasGateApproval: row.state === WorkItemState.Ready,
        hasEvidence: row.state === WorkItemState.InProgress || row.state === WorkItemState.Review,
        hatId: actorAuthority.hatId,
        hatAssignmentId: row.created_by_hat_assignment_id,
        ...(supervisorHatAssignmentId === undefined ? {} : { supervisorHatAssignmentId }),
        agentId: row.created_by_agent_id,
        scheduleBlocks,
      };
    }
    return null;
  };
}

async function findActiveObserveActSupervisorHatAssignment(
  input: Pick<ComposeOrgCadenceInput, "executor">,
  lookup: {
    organizationId: string;
    projectId: string;
    teamId?: string | undefined;
    supervisorHatId: string;
  },
): Promise<string | undefined> {
  const result = await input.executor.execute<ObserveActSupervisorAssignmentRow>({
    name: "find_active_observe_act_supervisor_hat_assignment",
    sql: `
      SELECT hat_assignment_id
      FROM ${CockroachTableName.HatAssignmentAuthorities}
      WHERE organization_id = $1
        AND project_id = $2
        AND (($3::STRING IS NULL AND team_id IS NULL) OR team_id = $3 OR team_id IS NULL)
        AND hat_id = $4
        AND state = $5
      ORDER BY CASE WHEN team_id = $3 THEN 0 WHEN team_id IS NULL THEN 1 ELSE 2 END, updated_at DESC
      LIMIT 1
    `.trim(),
    parameters: [
      lookup.organizationId,
      lookup.projectId,
      lookup.teamId ?? null,
      lookup.supervisorHatId,
      HatAssignmentAuthorityState.Active,
    ],
  });
  return result.rows[0]?.hat_assignment_id;
}

function observeActPhaseForWorkItemState(state: string): RunLifecyclePhase | undefined {
  switch (state) {
    case WorkItemState.Ready:
      return RunLifecyclePhase.AwaitingGate;
    case WorkItemState.InProgress:
      return RunLifecyclePhase.AwaitingEvidence;
    case WorkItemState.Review:
      return RunLifecyclePhase.AwaitingReview;
    case WorkItemState.Blocked:
      return RunLifecyclePhase.Blocked;
    default:
      return undefined;
  }
}

function createCockroachObserveActCommandRunner(
  input: Pick<ComposeOrgCadenceInput, "executor" | "createId" | "now">,
  hats: readonly ReturnType<typeof buildHatDefinitions>[number][],
): ObserveActCommandRunner {
  const stateAdapters = createCockroachDurableStateAdapters<CommandResult>({ executor: input.executor });
  const controlPlaneState = createCockroachControlPlaneStateStore({ executor: input.executor });
  const pipeline = createCommandPipeline<ObserveActPipelineCommand>({
    stateStoreFactory: stateAdapters.commandStateStoreFactory,
    commandAuthorizationPort: createCommandAuthorizationPort({
      hatAuthorityPort: createHatAuthorityPort({
        hatAssignmentAuthorityReader: stateAdapters.hatAssignmentAuthorityReader,
        hatDefinitions: hats,
        createId: input.createId,
      }),
    }),
    policyDecisionObservationPort: createPolicyDecisionObservationPort({
      store: stateAdapters.policyDecisionObservationStore,
    }),
    commandScheduleAuthorityPort: createScheduleBlockCommandAuthority({
      scheduleBlockReader: stateAdapters.workScheduleBlockAuthorityReader,
    }),
    handlerRegistry: createCommandHandlerRegistry<ObserveActPipelineCommand, CommandResult>([
      createObserveLifecycleTransitionHandler(),
      createSendSupervisorSignalHandler(),
    ]),
    workAnchorStateReader: stateAdapters.workAnchorStateStore,
    controlPlane: {
      loadFlags: async (command) =>
        await controlPlaneState.listActiveFlags(command.organizationId, new Date(input.now()).toISOString()) as readonly ControlPlaneFlag[],
      now: () => new Date(input.now()).toISOString(),
    },
    now: () => new Date(input.now()).toISOString(),
    createId: input.createId,
  });
  return async (commandType, command) => {
    if (commandType !== ObserveCommandType.LifecycleTransition && commandType !== CommandType.SendSupervisorSignal) {
      return { status: "unsupported_command_type", commandType };
    }
    return await pipeline.execute(command as ObserveActPipelineCommand);
  };
}

function createCockroachObserveActSlotAuthorizer(
  input: Pick<ComposeOrgCadenceInput, "executor" | "now">,
): ObserveActSlotAuthorizer {
  const stateAdapters = createCockroachDurableStateAdapters<CommandResult>({ executor: input.executor });
  const authority = createScheduleBlockCommandAuthority({
    scheduleBlockReader: stateAdapters.workScheduleBlockAuthorityReader,
  });
  return async ({ organizationId, work, slot, evaluatedAt }) => {
    if (slot.impl?.kind !== "command") {
      return { status: "allowed" };
    }
    const decision = await authority.authorizeCommandSchedule({
      commandId: `observe-act-slot-${work.runId}-${slot.index}`,
      commandType: slot.impl.commandType,
      actor: {
        agentId: work.agentId,
        hatAssignmentId: work.hatAssignmentId,
      },
      scope: {
        organizationId,
        projectId: work.projectId,
        ...(work.teamId === undefined ? {} : { teamId: work.teamId }),
        workItemId: work.workItemId,
      },
      evaluatedAt,
    });
    return decision.status === "denied"
      ? { status: "denied", reason: decision.reason, message: decision.message }
      : { status: "allowed" };
  };
}
