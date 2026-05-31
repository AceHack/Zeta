import {
  ChangeArtifactKind,
  ChangeSetPhase,
  ConfigLayerScopeKind,
  OrgEventKind,
  resolveLayeredTenantConfig,
  type ChangeSet,
  type OrgEvent,
  type TenantConfig,
  type TenantConfigLayer,
} from "../../domain/src/index.ts";
import { ModelEvalCaseClass, type ModelEvalSummary } from "../../model-eval/src/model-eval.ts";
import type { TelemetryQueryPort, TelemetryTimeRange } from "../../observability/src/index.ts";
import { contentAddressedChangeSetId } from "./change-control-id.ts";
import { isContentAddressedEvidenceRef } from "./content-addressed-evidence.ts";
import {
  evaluateControlPlaneAccess,
  type ControlPlaneBudgetCeiling,
  type ControlPlaneFlag,
  type ControlPlaneUsage,
} from "./control-plane-guard.ts";

export type DecisionOptimizerKpiSignal = {
  observedWorkItems: number;
  successCount: number;
  failureCount: number;
  kpiDelta: number;
};

export type DecisionOptimizerThresholds = {
  minClassAAccuracy: number;
};

export type DecisionOptimizerSimulationDecision =
  | { status: "accepted"; reason: string }
  | { status: "rejected"; reason: string };

export type ProposeDecisionOptimizerChangeSetInput = {
  organizationId: string;
  workItemId: string;
  proposerHatId: string;
  targetHatId: string;
  targetRef: string;
  currentConfig: TenantConfig;
  candidateModel: string;
  budgetDeltaTokens: number;
  evalSummary: ModelEvalSummary;
  evalEvidenceRef?: string | undefined;
  telemetryEvidenceRef?: string | undefined;
  simulationEvidenceRef?: string | undefined;
  simulationDecision?: DecisionOptimizerSimulationDecision | undefined;
  emergencyWaiverEvidenceRef?: string | undefined;
  kpiSignal: DecisionOptimizerKpiSignal;
  kpiEvidenceRef?: string | undefined;
  modelCostRank: Readonly<Record<string, number>>;
  thresholds: DecisionOptimizerThresholds;
  now: string;
};

export type DecisionOptimizerResult =
  | { kind: "proposed"; changeSet: ChangeSet; event: OrgEvent }
  | {
    kind: "no_proposal";
    reason:
      | "class_a_accuracy_below_threshold"
      | "kpi_negative"
      | "missing_eval_evidence"
      | "missing_kpi_evidence"
      | "missing_simulation_evidence"
      | "simulation_rejected"
      | "current_model_unknown"
      | "candidate_model_mismatch"
      | "candidate_not_lower_cost"
      | "budget_delta_not_negative"
      | "control_plane_denied"
      | "telemetry_degraded";
  };

export type DecisionOptimizerNoProposalReason =
  Extract<DecisionOptimizerResult, { kind: "no_proposal" }>["reason"];

export type DecisionOptimizerStore = {
  getJson: <T>(key: string) => Promise<T | null>;
  putJson: <T>(key: string, value: T) => Promise<void>;
  appendJson: <T>(key: string, value: T) => Promise<void>;
};

export type RunDecisionOptimizerCycleInput =
  Omit<ProposeDecisionOptimizerChangeSetInput, "currentConfig"> & {
    store: DecisionOptimizerStore;
    modelEvalEvent?: OrgEvent | undefined;
    telemetryEvidence?: DecisionOptimizerTelemetryEvidenceInput | undefined;
    controlPlane?: DecisionOptimizerControlPlane | undefined;
  };

export type DecisionOptimizerControlPlane = {
  flags?: readonly ControlPlaneFlag[] | undefined;
  loadFlags?: (() => Promise<readonly ControlPlaneFlag[]>) | undefined;
  budgets?: readonly ControlPlaneBudgetCeiling[] | undefined;
  usage?: ControlPlaneUsage | undefined;
  availableSecretScopes?: readonly string[] | undefined;
};

export type DecisionOptimizerTelemetryEvidenceInput = {
  queryPort: TelemetryQueryPort;
  evidenceRef: string;
  range: TelemetryTimeRange;
  metricQueries?: readonly string[] | undefined;
  traceQueries?: readonly string[] | undefined;
  logQueries?: readonly string[] | undefined;
};

export type DecisionOptimizerTelemetryObservations = {
  metricSeriesCount: number;
  traceSummaryCount: number;
  logLineCount: number;
  degradedQueryCount?: number | undefined;
};

export type DecisionOptimizerCycleResult =
  | {
    kind: "proposed";
    changeSet: ChangeSet;
    event: OrgEvent;
    currentConfig: TenantConfig;
    persistedChangeSetKey: string;
    eventStreamKey: string;
    appendedEvents: readonly OrgEvent[];
    telemetryObservations?: DecisionOptimizerTelemetryObservations | undefined;
  }
  | {
    kind: "no_proposal";
    reason: DecisionOptimizerNoProposalReason | "missing_current_config";
  };

export function proposeDecisionOptimizerChangeSet(input: ProposeDecisionOptimizerChangeSetInput): DecisionOptimizerResult {
  const classA = input.evalSummary.byClass[ModelEvalCaseClass.NeutralEvidence];
  if (classA.accuracy < input.thresholds.minClassAAccuracy) {
    return { kind: "no_proposal", reason: "class_a_accuracy_below_threshold" };
  }
  if (input.kpiSignal.kpiDelta < 0) {
    return { kind: "no_proposal", reason: "kpi_negative" };
  }
  const evalEvidenceRef = input.evalEvidenceRef;
  const kpiEvidenceRef = input.kpiEvidenceRef;
  if (evalEvidenceRef === undefined || !isContentAddressedEvidenceRef(evalEvidenceRef)) {
    return { kind: "no_proposal", reason: "missing_eval_evidence" };
  }
  if (kpiEvidenceRef === undefined || !isContentAddressedEvidenceRef(kpiEvidenceRef)) {
    return { kind: "no_proposal", reason: "missing_kpi_evidence" };
  }
  const simulationEvidenceRef = input.simulationEvidenceRef;
  const emergencyWaiverEvidenceRef = input.emergencyWaiverEvidenceRef;
  const simulationAccepted = simulationEvidenceRef !== undefined &&
    isContentAddressedEvidenceRef(simulationEvidenceRef) &&
    input.simulationDecision?.status === "accepted";
  const policyEvidenceRef = simulationAccepted
    ? simulationEvidenceRef
    : emergencyWaiverEvidenceRef !== undefined && isContentAddressedEvidenceRef(emergencyWaiverEvidenceRef)
      ? emergencyWaiverEvidenceRef
      : undefined;
  if (policyEvidenceRef === undefined) {
    if (simulationEvidenceRef !== undefined && isContentAddressedEvidenceRef(simulationEvidenceRef) && input.simulationDecision?.status === "rejected") {
      return { kind: "no_proposal", reason: "simulation_rejected" };
    }
    return { kind: "no_proposal", reason: "missing_simulation_evidence" };
  }
  if (input.candidateModel !== input.evalSummary.model) {
    return { kind: "no_proposal", reason: "candidate_model_mismatch" };
  }
  if (input.budgetDeltaTokens >= 0) {
    return { kind: "no_proposal", reason: "budget_delta_not_negative" };
  }

  const currentModel = resolveLayeredTenantConfig({
    organizationId: input.organizationId,
    hatId: input.targetHatId,
    layers: input.currentConfig.layers ?? [],
  }).model;
  if (currentModel === undefined) {
    return { kind: "no_proposal", reason: "current_model_unknown" };
  }
  const currentCost = input.modelCostRank[currentModel];
  const candidateCost = input.modelCostRank[input.candidateModel];
  if (currentCost === undefined || candidateCost === undefined || candidateCost >= currentCost) {
    return { kind: "no_proposal", reason: "candidate_not_lower_cost" };
  }

  const beforeLayers = input.currentConfig.layers ?? [];
  const optimizerLayer = decisionOptimizerLayer(input);
  const afterLayers = [...beforeLayers, optimizerLayer];
  const changeSetId = contentAddressedChangeSetId(
    input.organizationId,
    input.workItemId,
    input.targetRef,
    1,
  );
  const evidenceRefs = [
    evalEvidenceRef,
    kpiEvidenceRef,
    ...(input.telemetryEvidenceRef !== undefined && isContentAddressedEvidenceRef(input.telemetryEvidenceRef)
      ? [input.telemetryEvidenceRef]
      : []),
    policyEvidenceRef,
  ];
  const changeSet: ChangeSet = {
    changeSetId,
    organizationId: input.organizationId,
    workItemId: input.workItemId,
    proposerHatId: input.proposerHatId,
    title: `Optimize ${input.targetHatId} decision model`,
    targetRef: input.targetRef,
    phase: ChangeSetPhase.Drafted,
    pipelineId: "internal-only",
    currentStageIndex: 0,
    artifacts: [{
      kind: ChangeArtifactKind.ConfigChange,
      key: tenantConfigDocumentKey(input.organizationId),
      before: JSON.stringify(input.currentConfig),
      after: JSON.stringify({ ...input.currentConfig, layers: afterLayers, updatedAt: input.now, version: input.currentConfig.version + 1 }),
    }],
    projections: [],
    revision: 1,
    openedAt: input.now,
    updatedAt: input.now,
  };

  return {
    kind: "proposed",
    changeSet,
    event: decisionOptimizationEvent(input, changeSetId, evidenceRefs),
  };
}

export async function runDecisionOptimizerCycle(
  input: RunDecisionOptimizerCycleInput,
): Promise<DecisionOptimizerCycleResult> {
  const currentConfig = await input.store.getJson<TenantConfig>(tenantConfigDocumentKey(input.organizationId));
  if (currentConfig === null) {
    return { kind: "no_proposal", reason: "missing_current_config" };
  }
  const controlPlaneDecision = await authorizeOptimizerControlPlane(input);
  if (controlPlaneDecision !== undefined) {
    return controlPlaneDecision;
  }
  const appendedEvents: OrgEvent[] = [];
  const eventStreamKey = orgEventStreamKey(input.organizationId);
  if (input.modelEvalEvent !== undefined) {
    await input.store.appendJson(eventStreamKey, input.modelEvalEvent);
    appendedEvents.push(input.modelEvalEvent);
  }

  const telemetryObservations = await collectTelemetryEvidence(input.telemetryEvidence);
  if ((telemetryObservations?.degradedQueryCount ?? 0) > 0) {
    return { kind: "no_proposal", reason: "telemetry_degraded" };
  }
  const {
    store: _store,
    modelEvalEvent: _modelEvalEvent,
    telemetryEvidence: _telemetryEvidence,
    controlPlane: _controlPlane,
    ...proposalInput
  } = input;
  const proposal = proposeDecisionOptimizerChangeSet({
    ...proposalInput,
    currentConfig,
    ...(input.telemetryEvidence === undefined ? {} : { telemetryEvidenceRef: input.telemetryEvidence.evidenceRef }),
  });
  if (proposal.kind !== "proposed") {
    return proposal;
  }

  const persistedChangeSetKey = changeSetDocumentKey(proposal.changeSet.changeSetId);
  await input.store.putJson(persistedChangeSetKey, proposal.changeSet);
  await input.store.appendJson(eventStreamKey, proposal.event);
  appendedEvents.push(proposal.event);

  return {
    ...proposal,
    currentConfig,
    persistedChangeSetKey,
    eventStreamKey,
    appendedEvents,
    ...(telemetryObservations === undefined ? {} : { telemetryObservations }),
  };
}

async function authorizeOptimizerControlPlane(
  input: RunDecisionOptimizerCycleInput,
): Promise<Extract<DecisionOptimizerCycleResult, { kind: "no_proposal" }> | undefined> {
  if (input.controlPlane === undefined) {
    return undefined;
  }
  const flags = [...(input.controlPlane.flags ?? []), ...await (input.controlPlane.loadFlags?.() ?? Promise.resolve([]))];
  const decision = evaluateControlPlaneAccess({
    organizationId: input.organizationId,
    actorHatId: input.proposerHatId,
    tenantId: input.organizationId,
    boundary: "optimizer_rollout",
    actionType: "decision_optimizer_cycle",
    evaluatedAt: input.now,
    flags,
    budgets: input.controlPlane.budgets,
    usage: input.controlPlane.usage,
    availableSecretScopes: input.controlPlane.availableSecretScopes,
  });

  return decision.status === "denied" ? { kind: "no_proposal", reason: "control_plane_denied" } : undefined;
}

async function collectTelemetryEvidence(
  input: DecisionOptimizerTelemetryEvidenceInput | undefined,
): Promise<DecisionOptimizerTelemetryObservations | undefined> {
  if (input === undefined) {
    return undefined;
  }

  let metricSeriesCount = 0;
  let degradedQueryCount = 0;
  for (const query of input.metricQueries ?? []) {
    const result = await input.queryPort.queryMetrics(query, input.range);
    if (result.status === "ok") {
      metricSeriesCount += result.data.length;
    } else {
      degradedQueryCount += 1;
    }
  }

  let traceSummaryCount = 0;
  for (const query of input.traceQueries ?? []) {
    const result = await input.queryPort.queryTraces(query, input.range);
    if (result.status === "ok") {
      traceSummaryCount += result.data.length;
    } else {
      degradedQueryCount += 1;
    }
  }

  let logLineCount = 0;
  for (const query of input.logQueries ?? []) {
    const result = await input.queryPort.queryLogs(query, input.range);
    if (result.status === "ok") {
      logLineCount += result.data.length;
    } else {
      degradedQueryCount += 1;
    }
  }

  return {
    metricSeriesCount,
    traceSummaryCount,
    logLineCount,
    ...(degradedQueryCount > 0 ? { degradedQueryCount } : {}),
  };
}

export function tenantConfigDocumentKey(organizationId: string): string {
  return `tenant-config/${storeKeySegment(organizationId)}.json`;
}

export function changeSetDocumentKey(changeSetId: string): string {
  return `change-sets/${storeKeySegment(changeSetId)}.json`;
}

export function orgEventStreamKey(organizationId: string): string {
  return `org-events/${storeKeySegment(organizationId)}.jsonl`;
}

function storeKeySegment(value: string): string {
  if (/^[A-Za-z0-9_-]+$/.test(value)) return value;
  return `encoded-${[...new TextEncoder().encode(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function decisionOptimizerLayer(input: ProposeDecisionOptimizerChangeSetInput): TenantConfigLayer {
  return {
    layerId: `decision-optimizer:${input.targetHatId}:${input.candidateModel}:${input.evalSummary.runId}`,
    scope: { kind: ConfigLayerScopeKind.Hat, id: input.targetHatId },
    policy: {
      model: input.candidateModel,
      budgetDeltaTokens: input.budgetDeltaTokens,
      blocksInheritedDirectives: true,
      directives: [`optimizer:model-downgrade:${input.evalSummary.runId}`],
    },
    updatedAt: input.now,
    version: 1,
  };
}

function decisionOptimizationEvent(
  input: ProposeDecisionOptimizerChangeSetInput,
  changeSetId: string,
  evidenceRefs: readonly string[],
): OrgEvent {
  return {
    id: `evt-decision-optimizer-${changeSetId}`,
    kind: OrgEventKind.DecisionOptimizationProposed,
    occurredAt: input.now,
    organizationId: input.organizationId,
    actorHatId: input.proposerHatId,
    subjectId: changeSetId,
    decision: `proposed ${input.targetHatId} model downgrade to ${input.candidateModel} from eval ${input.evalSummary.runId}`,
    supervisorChain: ["executive_board", "coo", input.proposerHatId],
    evidenceRefs: [...evidenceRefs],
    correlationId: changeSetId,
    causationId: input.evalSummary.runId,
    traceId: changeSetId,
  };
}
