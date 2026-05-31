import type { OrgEvent } from "../../domain/src/index.ts";

export const SimulationScenarioKind = {
  IncidentSpike: "incident_spike",
  ReviewBottleneck: "review_bottleneck",
  QaChurn: "qa_churn",
  AgentLoss: "agent_loss",
  DependencyOutage: "dependency_outage",
  ModelDegradation: "model_degradation",
} as const;

export type SimulationScenarioKind =
  typeof SimulationScenarioKind[keyof typeof SimulationScenarioKind];

export type SimulationScenario = {
  kind: SimulationScenarioKind;
  title: string;
  pressureSignals: readonly string[];
};

export const DefaultSimulationScenarioLibrary: readonly SimulationScenario[] = [
  {
    kind: SimulationScenarioKind.IncidentSpike,
    title: "Incident spike",
    pressureSignals: ["incident_count", "estop_pressure", "budget_ceiling_risk"],
  },
  {
    kind: SimulationScenarioKind.ReviewBottleneck,
    title: "Review bottleneck",
    pressureSignals: ["review_lag_p95", "stale_claims", "queue_pressure"],
  },
  {
    kind: SimulationScenarioKind.QaChurn,
    title: "QA churn",
    pressureSignals: ["escaped_defects", "review_reversals", "qa_bounce_backs"],
  },
  {
    kind: SimulationScenarioKind.AgentLoss,
    title: "Agent loss",
    pressureSignals: ["hat_capacity_drop", "lease_expiry", "handoff_lag"],
  },
  {
    kind: SimulationScenarioKind.DependencyOutage,
    title: "Dependency outage",
    pressureSignals: ["external_dependency_degraded", "blocked_work", "sla_risk"],
  },
  {
    kind: SimulationScenarioKind.ModelDegradation,
    title: "Model degradation",
    pressureSignals: ["quality_regression", "cost_quality_tradeoff", "class_b_failure"],
  },
];

export type SimulationPolicyOverlay = {
  overlayId: string;
  autonomyLevel: string;
  modelMapping: Readonly<Record<string, string>>;
  modelCostPerWorkItem: number;
  throughputMultiplier?: number | undefined;
  leadTimeMultiplier?: number | undefined;
  defectMultiplier?: number | undefined;
  classBEscapedDefectMultiplier?: number | undefined;
  reviewLagMultiplier?: number | undefined;
  staleClaimMultiplier?: number | undefined;
  incidentMultiplier?: number | undefined;
  conformanceFailureMultiplier?: number | undefined;
  schedulePolicy?: string | undefined;
  rmoParams?: Readonly<Record<string, number>> | undefined;
  reputationExplorationRate?: number | undefined;
  queuePriorityWeights?: Readonly<Record<string, number>> | undefined;
  gateQuorum: number;
};

export type SimulationOrgStateItem = {
  itemId: string;
  kind: "project" | "initiative" | "work_item";
  status: string;
};

export type SimulationHatQueueSnapshot = {
  queueId: string;
  hatId: string;
  priorityClass: string;
  readyShards: number;
  claimedShards: number;
  slaDeadlineAt?: string | undefined;
};

export type SimulationReputationSnapshot = {
  agentId: string;
  hatId: string;
  mean: number;
  confidence: number;
};

export type SimulationScheduleSnapshot = {
  scheduleId: string;
  hatId: string;
  activeBlocks: number;
  staleBlocks: number;
};

export type SimulationPromptFlowRunSnapshot = {
  runId: string;
  hatId: string;
  state: string;
  blocked: boolean;
};

export type SimulationTelemetrySummary = {
  metricId: string;
  hatId?: string | undefined;
  value: number;
  unit: string;
};

export type SimulationAdapterSnapshot = {
  orgStateItems: readonly SimulationOrgStateItem[];
  hatQueues: readonly SimulationHatQueueSnapshot[];
  reputations: readonly SimulationReputationSnapshot[];
  schedules: readonly SimulationScheduleSnapshot[];
  promptFlowRuns: readonly SimulationPromptFlowRunSnapshot[];
  telemetrySummaries: readonly SimulationTelemetrySummary[];
};

export type SimulationAdapters = {
  orgState: { list: () => readonly SimulationOrgStateItem[] };
  hatQueues: { list: () => readonly SimulationHatQueueSnapshot[] };
  reputation: { list: () => readonly SimulationReputationSnapshot[] };
  schedules: { list: () => readonly SimulationScheduleSnapshot[] };
  promptFlowRuns: { list: () => readonly SimulationPromptFlowRunSnapshot[] };
  telemetry: { list: () => readonly SimulationTelemetrySummary[] };
};

export type SimulationCadenceLaneDecision = {
  lane: "work_os" | "observe_act" | "review" | "schedule";
  action: string;
  reason: string;
  affectedCount: number;
};

export type SimulationWorkEvent =
  | SimulationWorkIntakeEvent
  | SimulationWorkCompletedEvent
  | SimulationReviewLagEvent
  | SimulationEscapedDefectEvent
  | SimulationStaleClaimEvent
  | SimulationIncidentEvent
  | SimulationConformanceFailureEvent;

export type SimulationWorkEventBase = {
  eventId: string;
  occurredAt: string;
  workItemId: string;
  hatId?: string | undefined;
};

export type SimulationWorkIntakeEvent = SimulationWorkEventBase & {
  kind: "work_intake";
  priority: number;
};

export type SimulationWorkCompletedEvent = SimulationWorkEventBase & {
  kind: "work_completed";
  leadTimeMs: number;
};

export type SimulationReviewLagEvent = SimulationWorkEventBase & {
  kind: "review_lag";
  lagMs: number;
};

export type SimulationEscapedDefectEvent = SimulationWorkEventBase & {
  kind: "escaped_defect";
  severity: "class_a" | "class_b" | "class_c";
};

export type SimulationStaleClaimEvent = SimulationWorkEventBase & {
  kind: "stale_claim";
};

export type SimulationIncidentEvent = SimulationWorkEventBase & {
  kind: "incident";
};

export type SimulationConformanceFailureEvent = SimulationWorkEventBase & {
  kind: "conformance_failure";
};

export type RunOrgPolicySimulationInput = {
  organizationId: string;
  seed: string;
  stream: readonly SimulationWorkEvent[];
  orgEvents?: readonly OrgEvent[] | undefined;
  baseline: SimulationPolicyOverlay;
  candidate: SimulationPolicyOverlay;
  adapters?: SimulationAdapters | undefined;
  scenarios?: readonly SimulationScenario[] | undefined;
};

export type SimulationMetrics = {
  intake: number;
  throughput: number;
  completed: number;
  leadTimeP50Ms: number;
  leadTimeAverageMs: number;
  escapedDefects: number;
  classBEscapedDefects: number;
  conformanceFailures: number;
  cost: number;
  reviewLagP95Ms: number;
  staleClaims: number;
  incidentCount: number;
};

export type SimulationRun = {
  overlayId: string;
  autonomyLevel: string;
  modelMapping: Readonly<Record<string, string>>;
  schedulePolicy?: string | undefined;
  gateQuorum: number;
  cadenceLaneDecisions: readonly SimulationCadenceLaneDecision[];
  metrics: SimulationMetrics;
};

export type SimulationReport = {
  organizationId: string;
  seed: string;
  replayedEventIds: readonly string[];
  scenarioKinds: readonly SimulationScenarioKind[];
  adapterSnapshot: SimulationAdapterSnapshot;
  baseline: SimulationRun;
  candidate: SimulationRun;
};

export type SimulationRiskThresholds = {
  maxEscapedDefectRegression: number;
  maxClassBEscapedDefectRegression: number;
  maxIncidentRegression: number;
  maxConformanceFailureRegression: number;
  minThroughputDelta: number;
};

export type SimulationRiskDecision =
  | {
    status: "accepted";
    reason: "candidate_beats_baseline";
    deltas: SimulationMetricDeltas;
  }
  | {
    status: "rejected";
    reason:
      | "escaped_defect_regression"
      | "class_b_escaped_defect_regression"
      | "incident_regression"
      | "conformance_failure_regression"
      | "throughput_regression"
      | "candidate_not_better";
    deltas: SimulationMetricDeltas;
  };

export type SimulationMetricDeltas = {
  throughput: number;
  leadTimeP50Ms: number;
  escapedDefects: number;
  classBEscapedDefects: number;
  conformanceFailures: number;
  cost: number;
  reviewLagP95Ms: number;
  staleClaims: number;
  incidentCount: number;
};

type RawSimulationMetrics = {
  intake: number;
  leadTimesMs: readonly number[];
  escapedDefects: number;
  classBEscapedDefects: number;
  conformanceFailures: number;
  reviewLagsMs: readonly number[];
  staleClaims: number;
  incidents: number;
};

type AdapterSignals = {
  readyShards: number;
  claimedShards: number;
  staleScheduleBlocks: number;
  activeScheduleBlocks: number;
  blockedPromptFlows: number;
  runnablePromptFlows: number;
  reviewLagP95Ms: number;
  incidentPressure: number;
  reputationMean: number;
  reputationConfidence: number;
};

export function createInMemorySimulationAdapters(snapshot: Partial<SimulationAdapterSnapshot>): SimulationAdapters {
  const normalized = normalizeAdapterSnapshot(snapshot);
  return {
    orgState: { list: () => normalized.orgStateItems },
    hatQueues: { list: () => normalized.hatQueues },
    reputation: { list: () => normalized.reputations },
    schedules: { list: () => normalized.schedules },
    promptFlowRuns: { list: () => normalized.promptFlowRuns },
    telemetry: { list: () => normalized.telemetrySummaries },
  };
}

export function runOrgPolicySimulation(input: RunOrgPolicySimulationInput): SimulationReport {
  const orderedStream = dedupeSimulationEvents([
    ...input.stream,
    ...simulationWorkEventsFromOrgEvents(input.orgEvents ?? []),
  ]).sort(compareSimulationEvents);
  const raw = rawMetrics(orderedStream);
  const scenarios = input.scenarios ?? DefaultSimulationScenarioLibrary;
  const adapterSnapshot = readAdapterSnapshot(input.adapters);

  return {
    organizationId: input.organizationId,
    seed: input.seed,
    replayedEventIds: orderedStream.map((event) => event.eventId),
    scenarioKinds: scenarios.map((scenario) => scenario.kind),
    adapterSnapshot,
    baseline: materializeRun(raw, input.baseline, adapterSnapshot),
    candidate: materializeRun(raw, input.candidate, adapterSnapshot),
  };
}

export function simulationWorkEventsFromOrgEvents(orgEvents: readonly OrgEvent[]): readonly SimulationWorkEvent[] {
  return orgEvents.flatMap((event) => simulationWorkEventFromOrgEvent(event));
}

export function evaluateSimulationRisk(
  report: SimulationReport,
  thresholds: SimulationRiskThresholds,
): SimulationRiskDecision {
  const deltas = simulationMetricDeltas(report);

  if (deltas.escapedDefects > thresholds.maxEscapedDefectRegression) {
    return { status: "rejected", reason: "escaped_defect_regression", deltas };
  }
  if (deltas.classBEscapedDefects > thresholds.maxClassBEscapedDefectRegression) {
    return { status: "rejected", reason: "class_b_escaped_defect_regression", deltas };
  }
  if (deltas.incidentCount > thresholds.maxIncidentRegression) {
    return { status: "rejected", reason: "incident_regression", deltas };
  }
  if (deltas.conformanceFailures > thresholds.maxConformanceFailureRegression) {
    return { status: "rejected", reason: "conformance_failure_regression", deltas };
  }
  if (deltas.throughput < thresholds.minThroughputDelta) {
    return { status: "rejected", reason: "throughput_regression", deltas };
  }
  if (candidateImproves(report)) {
    return { status: "accepted", reason: "candidate_beats_baseline", deltas };
  }

  return { status: "rejected", reason: "candidate_not_better", deltas };
}

function compareSimulationEvents(left: SimulationWorkEvent, right: SimulationWorkEvent): number {
  const byTime = left.occurredAt.localeCompare(right.occurredAt);
  if (byTime !== 0) return byTime;
  return left.eventId.localeCompare(right.eventId);
}

function dedupeSimulationEvents(stream: readonly SimulationWorkEvent[]): SimulationWorkEvent[] {
  const seen = new Map<string, string>();
  const deduped: SimulationWorkEvent[] = [];
  for (const event of stream) {
    const canonical = canonicalJson(event);
    const previous = seen.get(event.eventId);
    if (previous === undefined) {
      seen.set(event.eventId, canonical);
      deduped.push(event);
    } else if (previous !== canonical) {
      throw new Error(`conflicting duplicate simulation event id: ${event.eventId}`);
    }
  }
  return deduped;
}

function rawMetrics(stream: readonly SimulationWorkEvent[]): RawSimulationMetrics {
  const leadTimesMs: number[] = [];
  const reviewLagsMs: number[] = [];
  let intake = 0;
  let escapedDefects = 0;
  let classBEscapedDefects = 0;
  let conformanceFailures = 0;
  let staleClaims = 0;
  let incidents = 0;

  for (const event of stream) {
    switch (event.kind) {
      case "work_intake":
        intake += 1;
        break;
      case "work_completed":
        leadTimesMs.push(event.leadTimeMs);
        break;
      case "review_lag":
        reviewLagsMs.push(event.lagMs);
        break;
      case "escaped_defect":
        escapedDefects += 1;
        if (event.severity === "class_b") classBEscapedDefects += 1;
        break;
      case "stale_claim":
        staleClaims += 1;
        break;
      case "incident":
        incidents += 1;
        break;
      case "conformance_failure":
        conformanceFailures += 1;
        break;
    }
  }

  return {
    intake,
    leadTimesMs,
    escapedDefects,
    classBEscapedDefects,
    conformanceFailures,
    reviewLagsMs,
    staleClaims,
    incidents,
  };
}

function simulationWorkEventFromOrgEvent(event: OrgEvent): readonly SimulationWorkEvent[] {
  switch (event.kind) {
    case "intake_received":
      return [{
        eventId: event.id,
        kind: "work_intake",
        occurredAt: event.occurredAt,
        workItemId: event.subjectId,
        priority: 50,
        ...(event.actorHatId === undefined ? {} : { hatId: event.actorHatId }),
      }];
    case "work_item_transition":
      if (isCompletedState(event.toState)) {
        return [{
          eventId: event.id,
          kind: "work_completed",
          occurredAt: event.occurredAt,
          workItemId: event.subjectId,
          leadTimeMs: 300_000,
          ...(event.actorHatId === undefined ? {} : { hatId: event.actorHatId }),
        }];
      }
      return [];
    case "review_stage_advanced":
      return [{
        eventId: event.id,
        kind: "review_lag",
        occurredAt: event.occurredAt,
        workItemId: event.subjectId,
        lagMs: 60_000,
        ...(event.actorHatId === undefined ? {} : { hatId: event.actorHatId }),
      }];
    case "review_finding_raised":
    case "changes_requested":
    case "defect_opened":
    case "regression_detected":
      return [{
        eventId: event.id,
        kind: "escaped_defect",
        occurredAt: event.occurredAt,
        workItemId: event.subjectId,
        severity: "class_b",
        ...(event.actorHatId === undefined ? {} : { hatId: event.actorHatId }),
      }];
    case "recovery_incident_detected":
      return [{
        eventId: event.id,
        kind: "incident",
        occurredAt: event.occurredAt,
        workItemId: event.subjectId,
        ...(event.actorHatId === undefined ? {} : { hatId: event.actorHatId }),
      }];
    case "observe_act_tick":
      if (event.evidenceRefs.some((ref) => ref.startsWith("observe-act:command:"))) {
        return [{
          eventId: event.id,
          kind: "work_completed",
          occurredAt: event.occurredAt,
          workItemId: event.subjectId,
          leadTimeMs: 120_000,
          ...(event.actorHatId === undefined ? {} : { hatId: event.actorHatId }),
        }];
      }
      return [];
    default:
      return [];
  }
}

function isCompletedState(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.toLowerCase();
  return normalized === "done" ||
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "applied" ||
    normalized === "closed";
}

function materializeRun(
  raw: RawSimulationMetrics,
  overlay: SimulationPolicyOverlay,
  adapterSnapshot: SimulationAdapterSnapshot,
): SimulationRun {
  const signals = adapterSignals(adapterSnapshot);
  const policyFactors = overlayPolicyFactors(overlay, signals);
  const throughput = scaledCount(
    raw.leadTimesMs.length + Math.min(signals.readyShards, Math.max(0, Math.round(signals.activeScheduleBlocks * policyFactors.capacity))),
    (overlay.throughputMultiplier ?? 1) * policyFactors.throughput,
  );
  const escapedDefects = scaledCount(raw.escapedDefects, overlay.defectMultiplier);
  const conformanceFailures = scaledCount(raw.conformanceFailures, overlay.conformanceFailureMultiplier)
    + (overlay.gateQuorum <= 0 ? 1 : 0)
    + signals.blockedPromptFlows;
  const leadTimeBaseMs = percentile(raw.leadTimesMs, 0.5) + Math.round(signals.claimedShards * 30_000);
  const reviewLagBaseMs = Math.max(percentile(raw.reviewLagsMs, 0.95), signals.reviewLagP95Ms);

  return {
    overlayId: overlay.overlayId,
    autonomyLevel: overlay.autonomyLevel,
    modelMapping: { ...overlay.modelMapping },
    ...(overlay.schedulePolicy === undefined ? {} : { schedulePolicy: overlay.schedulePolicy }),
    gateQuorum: overlay.gateQuorum,
    cadenceLaneDecisions: cadenceLaneDecisions(overlay, signals),
    metrics: {
      intake: raw.intake,
      throughput,
      completed: raw.leadTimesMs.length,
      leadTimeP50Ms: scaledDuration(leadTimeBaseMs, (overlay.leadTimeMultiplier ?? 1) * policyFactors.leadTime),
      leadTimeAverageMs: scaledDuration(average(raw.leadTimesMs), (overlay.leadTimeMultiplier ?? 1) * policyFactors.leadTime),
      escapedDefects,
      classBEscapedDefects: scaledCount(raw.classBEscapedDefects, overlay.classBEscapedDefectMultiplier ?? overlay.defectMultiplier),
      conformanceFailures,
      cost: throughput * overlay.modelCostPerWorkItem,
      reviewLagP95Ms: scaledDuration(reviewLagBaseMs, (overlay.reviewLagMultiplier ?? 1) * policyFactors.reviewLag),
      staleClaims: scaledCount(raw.staleClaims + signals.staleScheduleBlocks, (overlay.staleClaimMultiplier ?? 1) * policyFactors.staleClaims),
      incidentCount: scaledCount(raw.incidents + signals.incidentPressure, overlay.incidentMultiplier),
    },
  };
}

function simulationMetricDeltas(report: SimulationReport): SimulationMetricDeltas {
  return {
    throughput: report.candidate.metrics.throughput - report.baseline.metrics.throughput,
    leadTimeP50Ms: report.candidate.metrics.leadTimeP50Ms - report.baseline.metrics.leadTimeP50Ms,
    escapedDefects: report.candidate.metrics.escapedDefects - report.baseline.metrics.escapedDefects,
    classBEscapedDefects: report.candidate.metrics.classBEscapedDefects - report.baseline.metrics.classBEscapedDefects,
    conformanceFailures: report.candidate.metrics.conformanceFailures - report.baseline.metrics.conformanceFailures,
    cost: report.candidate.metrics.cost - report.baseline.metrics.cost,
    reviewLagP95Ms: report.candidate.metrics.reviewLagP95Ms - report.baseline.metrics.reviewLagP95Ms,
    staleClaims: report.candidate.metrics.staleClaims - report.baseline.metrics.staleClaims,
    incidentCount: report.candidate.metrics.incidentCount - report.baseline.metrics.incidentCount,
  };
}

function candidateImproves(report: SimulationReport): boolean {
  const deltas = simulationMetricDeltas(report);
  return deltas.throughput > 0 ||
    deltas.leadTimeP50Ms < 0 ||
    deltas.cost < 0 ||
    deltas.reviewLagP95Ms < 0 ||
    deltas.staleClaims < 0;
}

function scaledCount(value: number, multiplier: number | undefined): number {
  return Math.max(0, Math.round(value * (multiplier ?? 1)));
}

function scaledDuration(value: number, multiplier: number | undefined): number {
  return Math.max(0, Math.round(value * (multiplier ?? 1)));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index] ?? 0;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function readAdapterSnapshot(adapters: SimulationAdapters | undefined): SimulationAdapterSnapshot {
  if (adapters === undefined) return normalizeAdapterSnapshot({});
  return normalizeAdapterSnapshot({
    orgStateItems: adapters.orgState.list(),
    hatQueues: adapters.hatQueues.list(),
    reputations: adapters.reputation.list(),
    schedules: adapters.schedules.list(),
    promptFlowRuns: adapters.promptFlowRuns.list(),
    telemetrySummaries: adapters.telemetry.list(),
  });
}

function normalizeAdapterSnapshot(snapshot: Partial<SimulationAdapterSnapshot>): SimulationAdapterSnapshot {
  return {
    orgStateItems: [...(snapshot.orgStateItems ?? [])],
    hatQueues: [...(snapshot.hatQueues ?? [])],
    reputations: [...(snapshot.reputations ?? [])],
    schedules: [...(snapshot.schedules ?? [])],
    promptFlowRuns: [...(snapshot.promptFlowRuns ?? [])],
    telemetrySummaries: [...(snapshot.telemetrySummaries ?? [])],
  };
}

function adapterSignals(snapshot: SimulationAdapterSnapshot): AdapterSignals {
  const reputationMean = average(snapshot.reputations.map((entry) => entry.mean));
  const reputationConfidence = average(snapshot.reputations.map((entry) => entry.confidence));
  return {
    readyShards: snapshot.hatQueues.reduce((sum, queue) => sum + queue.readyShards, 0),
    claimedShards: snapshot.hatQueues.reduce((sum, queue) => sum + queue.claimedShards, 0),
    staleScheduleBlocks: snapshot.schedules.reduce((sum, schedule) => sum + schedule.staleBlocks, 0),
    activeScheduleBlocks: snapshot.schedules.reduce((sum, schedule) => sum + schedule.activeBlocks, 0),
    blockedPromptFlows: snapshot.promptFlowRuns.filter((run) => run.blocked).length,
    runnablePromptFlows: snapshot.promptFlowRuns.filter((run) => !run.blocked).length,
    reviewLagP95Ms: Math.max(0, ...snapshot.telemetrySummaries.filter((summary) => summary.metricId === "review_lag_p95").map((summary) => summary.value)),
    incidentPressure: snapshot.telemetrySummaries.filter((summary) => summary.metricId === "incident_count").reduce((sum, summary) => sum + summary.value, 0),
    reputationMean,
    reputationConfidence,
  };
}

function overlayPolicyFactors(overlay: SimulationPolicyOverlay, signals: AdapterSignals) {
  const queuePriorityWeight = Object.values(overlay.queuePriorityWeights ?? {}).reduce((sum, value) => sum + value, 0);
  const capacity = overlay.rmoParams?.capacityMultiplier ?? 1;
  const scheduleRebalance = overlay.schedulePolicy === "rebalance_critical_hats";
  const confidenceDrag = signals.reputationConfidence > 0 && signals.reputationConfidence < 0.5 ? 1.1 : 1;
  return {
    capacity,
    throughput: (overlay.autonomyLevel === "autonomous" ? 1.1 : 1) +
      Math.min(0.5, queuePriorityWeight * 0.1) +
      Math.min(0.2, (overlay.reputationExplorationRate ?? 0) * 0.5),
    leadTime: (scheduleRebalance ? 0.8 : 1) * confidenceDrag,
    reviewLag: scheduleRebalance ? 0.75 : 1,
    staleClaims: scheduleRebalance ? 0.5 : 1,
  };
}

function cadenceLaneDecisions(
  overlay: SimulationPolicyOverlay,
  signals: AdapterSignals,
): readonly SimulationCadenceLaneDecision[] {
  return [
    {
      lane: "work_os",
      action: signals.readyShards > 0 ? "claim_ready_shards" : "idle",
      reason: signals.readyShards > 0 ? "hat_queue_ready_shards" : "no_ready_shards",
      affectedCount: signals.readyShards,
    },
    {
      lane: "observe_act",
      action: signals.runnablePromptFlows > 0 ? "execute_prompt_flow" : "hold",
      reason: signals.runnablePromptFlows > 0 ? "prompt_flow_runnable" : "no_runnable_prompt_flow",
      affectedCount: signals.runnablePromptFlows,
    },
    {
      lane: "schedule",
      action: overlay.schedulePolicy === "rebalance_critical_hats" ? "rebalance_capacity" : "keep_schedule",
      reason: overlay.schedulePolicy ?? "no_schedule_overlay",
      affectedCount: signals.staleScheduleBlocks,
    },
    {
      lane: "review",
      action: signals.blockedPromptFlows > 0 ? "request_quorum_attention" : "monitor",
      reason: signals.blockedPromptFlows > 0 ? "blocked_prompt_flows" : "review_pressure_within_bounds",
      affectedCount: signals.blockedPromptFlows,
    },
  ];
}
