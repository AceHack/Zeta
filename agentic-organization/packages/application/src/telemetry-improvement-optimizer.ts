import {
  ChangeArtifactKind,
  ChangeSetPhase,
  OrgEventKind,
  type ChangeArtifact,
  type ChangeSet,
  type OrgEvent,
} from "../../domain/src/index.ts";
import type {
  MetricSeries,
  TelemetryQueryDegraded,
  TelemetryQueryPort,
  TelemetryTimeRange,
} from "../../observability/src/index.ts";
import { contentAddressedChangeSetId } from "./change-control-id.ts";
import { isContentAddressedEvidenceRef } from "./content-addressed-evidence.ts";
import {
  ReputationOutcomeClass,
  createReputationOutcomeOrgEvent,
  type ReputationObservation,
} from "./reputation.ts";

export const TelemetryImprovementMetricKind = {
  ReviewP95Ms: "review_p95_ms",
  ReleaseQueueDepth: "release_queue_depth",
  ConformancePassRatio: "conformance_pass_ratio",
  QaBounceBackRate: "qa_bounce_back_rate",
  DoraLeadTimeMs: "dora_lead_time_ms",
  ModelCost: "model_cost",
  TokenBurn: "token_burn",
  IncidentCount: "incident_count",
  StaleClaimRate: "stale_claim_rate",
} as const;
export type TelemetryImprovementMetricKind =
  (typeof TelemetryImprovementMetricKind)[keyof typeof TelemetryImprovementMetricKind];

export const TelemetryImprovementProposalMode = {
  Improvement: "improvement",
  Rollback: "rollback",
} as const;
export type TelemetryImprovementProposalMode =
  (typeof TelemetryImprovementProposalMode)[keyof typeof TelemetryImprovementProposalMode];

export type TelemetryImprovementProposedChange =
  | {
    readonly kind: "config" | "model" | "policy" | "prompt_flow";
    readonly summary: string;
    readonly before: string;
    readonly after: string;
  }
  | {
    readonly kind: "rollback";
    readonly summary: string;
    readonly rolledOutChangeSetId: string;
  };

export type TelemetryImprovementExpectedMetricMovement = {
  readonly metric: string;
  readonly direction: "increase" | "decrease";
  readonly minimumRelativeChange: number;
};

export type TelemetryImprovementTrigger = {
  readonly metricKind: TelemetryImprovementMetricKind;
  readonly metricQuery: string;
  readonly logQuery?: string | undefined;
  readonly traceQuery?: string | undefined;
  readonly minimumRelativeChange: number;
  readonly direction: "increase_bad" | "decrease_bad";
  readonly suspectedCause: string;
  readonly proposedChange: Extract<TelemetryImprovementProposedChange, { kind: "config" | "model" | "policy" | "prompt_flow" }>;
  readonly expectedMetricMovement: TelemetryImprovementExpectedMetricMovement;
  readonly rollbackCondition: string;
};

export type ImprovementHypothesis = {
  readonly hypothesisId: string;
  readonly organizationId: string;
  readonly workItemId: string;
  readonly proposerHatId: string;
  readonly symptom: {
    readonly metricKind: TelemetryImprovementMetricKind;
    readonly baselineValue: number;
    readonly observedValue: number;
    readonly relativeChange: number;
  };
  readonly suspectedCause: string;
  readonly proposedChange: TelemetryImprovementProposedChange;
  readonly evidenceRefs: readonly string[];
  readonly expectedMetricMovement: TelemetryImprovementExpectedMetricMovement;
  readonly rollbackCondition: string;
  readonly createdAt: string;
};

export type RunTelemetryImprovementOptimizerInput = {
  readonly organizationId: string;
  readonly workItemId: string;
  readonly proposerHatId: string;
  readonly targetRef: string;
  readonly now: string;
  readonly queryPort: TelemetryQueryPort;
  readonly range: TelemetryTimeRange;
  readonly telemetryEvidenceRef: string;
  readonly simulationEvidenceRef: string;
  readonly simulationDecision?: { readonly status: "accepted" | "rejected"; readonly reason: string } | undefined;
  readonly trigger: TelemetryImprovementTrigger;
  readonly mode?: TelemetryImprovementProposalMode | undefined;
  readonly rolledOutChangeSetId?: string | undefined;
};

export type TelemetryImprovementOptimizerResult =
  | {
    readonly kind: "proposed";
    readonly hypothesis: ImprovementHypothesis;
    readonly changeSet: ChangeSet;
    readonly event: OrgEvent;
  }
  | {
    readonly kind: "no_proposal";
    readonly reason:
      | "missing_evidence"
      | "missing_simulation_evidence"
      | "simulation_rejected"
      | "telemetry_degraded"
      | "telemetry_empty"
      | "below_change_threshold"
      | "missing_causal_evidence"
      | "missing_rollback_target";
    readonly degradedSources?: readonly string[] | undefined;
    readonly observedRelativeChange?: number | undefined;
  };

export type EvaluateTelemetryImprovementOutcomeInput = {
  readonly organizationId: string;
  readonly optimizerAgentId: string;
  readonly optimizerHatId: string;
  readonly hypothesis: ImprovementHypothesis;
  readonly postRolloutMetricValue: number;
  readonly evaluatedAt: string;
  readonly evidenceRef: string;
  readonly eventId: string;
  readonly correlationId: string;
  readonly traceId: string;
};

export type TelemetryImprovementOutcomeEvaluation =
  | {
    readonly kind: "reputation_observed";
    readonly expectedMovementMet: boolean;
    readonly observedRelativeMovement: number;
    readonly observation: ReputationObservation;
    readonly event: OrgEvent;
  }
  | {
    readonly kind: "no_reputation_observation";
    readonly reason: "missing_evidence" | "zero_reference_metric";
  };

export async function runTelemetryImprovementOptimizer(
  input: RunTelemetryImprovementOptimizerInput,
): Promise<TelemetryImprovementOptimizerResult> {
  if (!isContentAddressedEvidenceRef(input.telemetryEvidenceRef) || !isContentAddressedEvidenceRef(input.simulationEvidenceRef)) {
    return { kind: "no_proposal", reason: "missing_evidence" };
  }
  if (input.simulationDecision === undefined) {
    return { kind: "no_proposal", reason: "missing_simulation_evidence" };
  }
  if (input.simulationDecision.status !== "accepted") {
    return { kind: "no_proposal", reason: "simulation_rejected" };
  }
  if (input.mode === TelemetryImprovementProposalMode.Rollback && input.rolledOutChangeSetId === undefined) {
    return { kind: "no_proposal", reason: "missing_rollback_target" };
  }

  const telemetry = await collectTelemetryForTrigger(input);
  if (telemetry.status === "degraded") {
    return {
      kind: "no_proposal",
      reason: "telemetry_degraded",
      degradedSources: telemetry.degradedSources,
    };
  }
  if (telemetry.series.length === 0 || telemetry.sampleCount === 0) {
    return { kind: "no_proposal", reason: "telemetry_empty" };
  }

  const symptomResult = metricSymptom(input.trigger, telemetry.series);
  if (symptomResult === undefined) {
    return { kind: "no_proposal", reason: "telemetry_empty" };
  }
  const { symptom, rawRelativeChange } = symptomResult;
  const thresholdCleared = Math.abs(rawRelativeChange) >= input.trigger.minimumRelativeChange &&
    ((input.trigger.direction === "increase_bad" && rawRelativeChange > 0) ||
      (input.trigger.direction === "decrease_bad" && rawRelativeChange < 0));
  if (!thresholdCleared) {
    return {
      kind: "no_proposal",
      reason: "below_change_threshold",
      observedRelativeChange: round(symptom.relativeChange),
    };
  }

  if (telemetry.causalEvidenceCount === 0) {
    return { kind: "no_proposal", reason: "missing_causal_evidence" };
  }

  const mode = input.rolledOutChangeSetId !== undefined
    ? TelemetryImprovementProposalMode.Rollback
    : input.mode ?? TelemetryImprovementProposalMode.Improvement;
  if (mode === TelemetryImprovementProposalMode.Rollback && input.rolledOutChangeSetId === undefined) {
    return { kind: "no_proposal", reason: "missing_rollback_target" };
  }
  const proposedChange = mode === TelemetryImprovementProposalMode.Rollback
    ? rollbackChange(input)
    : input.trigger.proposedChange;
  const evidenceRefs = [input.telemetryEvidenceRef, input.simulationEvidenceRef];
  const hypothesisId = contentAddressedChangeSetId(
    input.organizationId,
    input.workItemId,
    [
      input.targetRef,
      "hypothesis",
      mode,
      input.trigger.metricKind,
      String(symptom.baselineValue),
      String(symptom.observedValue),
      String(symptom.relativeChange),
      input.telemetryEvidenceRef,
      input.simulationEvidenceRef,
      input.rolledOutChangeSetId ?? "no-rollback-target",
    ].join(":"),
    1,
  );
  const hypothesis: ImprovementHypothesis = {
    hypothesisId,
    organizationId: input.organizationId,
    workItemId: input.workItemId,
    proposerHatId: input.proposerHatId,
    symptom,
    suspectedCause: input.trigger.suspectedCause,
    proposedChange,
    evidenceRefs,
    expectedMetricMovement: input.trigger.expectedMetricMovement,
    rollbackCondition: input.trigger.rollbackCondition,
    createdAt: input.now,
  };
  const changeSet = improvementChangeSet(input, hypothesis, mode);
  return {
    kind: "proposed",
    hypothesis,
    changeSet,
    event: improvementEvent(input, hypothesis, changeSet.changeSetId, evidenceRefs),
  };
}

export function evaluateTelemetryImprovementOutcome(
  input: EvaluateTelemetryImprovementOutcomeInput,
): TelemetryImprovementOutcomeEvaluation {
  if (!isContentAddressedEvidenceRef(input.evidenceRef)) {
    return { kind: "no_reputation_observation", reason: "missing_evidence" };
  }
  const referenceValue = input.hypothesis.symptom.observedValue;
  if (referenceValue === 0) {
    return { kind: "no_reputation_observation", reason: "zero_reference_metric" };
  }

  const observedRelativeMovement = metricMovement(
    input.hypothesis.expectedMetricMovement.direction,
    referenceValue,
    input.postRolloutMetricValue,
  );
  const expectedMovementMet = observedRelativeMovement >= input.hypothesis.expectedMetricMovement.minimumRelativeChange;
  const observation: ReputationObservation = {
    organizationId: input.organizationId,
    agentId: input.optimizerAgentId,
    hatId: input.optimizerHatId,
    workType: "telemetry_improvement_optimizer",
    outcomeClass: ReputationOutcomeClass.Quality,
    observedAt: input.evaluatedAt,
    signal: { kind: "binary", success: expectedMovementMet, weight: 1 },
    evidenceRef: input.evidenceRef,
  };

  return {
    kind: "reputation_observed",
    expectedMovementMet,
    observedRelativeMovement: round(observedRelativeMovement),
    observation,
    event: createReputationOutcomeOrgEvent({
      eventId: input.eventId,
      observedAt: input.evaluatedAt,
      organizationId: input.organizationId,
      observation,
      correlationId: input.correlationId,
      causationId: input.hypothesis.hypothesisId,
      traceId: input.traceId,
    }),
  };
}

type TelemetryCollection =
  | {
    readonly status: "ok";
    readonly series: readonly MetricSeries[];
    readonly sampleCount: number;
    readonly causalEvidenceCount: number;
  }
  | {
    readonly status: "degraded";
    readonly degradedSources: readonly string[];
  };

async function collectTelemetryForTrigger(
  input: RunTelemetryImprovementOptimizerInput,
): Promise<TelemetryCollection> {
  const degraded: string[] = [];
  let causalEvidenceCount = 0;
  const metricResult = await input.queryPort.queryMetrics(input.trigger.metricQuery, input.range);
  if (metricResult.status === "degraded") {
    degraded.push(degradedSource(metricResult));
  }
  if (input.trigger.logQuery !== undefined) {
    const logResult = await input.queryPort.queryLogs(input.trigger.logQuery, input.range);
    if (logResult.status === "degraded") degraded.push(degradedSource(logResult));
    else causalEvidenceCount += logResult.data.length;
  }
  if (input.trigger.traceQuery !== undefined) {
    const traceResult = await input.queryPort.queryTraces(input.trigger.traceQuery, input.range);
    if (traceResult.status === "degraded") degraded.push(degradedSource(traceResult));
    else causalEvidenceCount += traceResult.data.length;
  }
  if (degraded.length > 0) {
    return { status: "degraded", degradedSources: degraded };
  }
  if (metricResult.status === "degraded") {
    return { status: "degraded", degradedSources: [degradedSource(metricResult)] };
  }

  return {
    status: "ok",
    series: metricResult.data,
    sampleCount: metricResult.data.reduce((sum, series) => sum + series.points.length, 0),
    causalEvidenceCount,
  };
}

function metricSymptom(
  trigger: TelemetryImprovementTrigger,
  series: readonly MetricSeries[],
): { symptom: ImprovementHypothesis["symptom"]; rawRelativeChange: number } | undefined {
  const points = series.flatMap((entry) => entry.points).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  if (points.length < 2) {
    return undefined;
  }
  const split = Math.floor(points.length / 2);
  const baseline = average(points.slice(0, split).map((point) => point.value));
  const observed = average(points.slice(split).map((point) => point.value));
  if (baseline === undefined || observed === undefined || baseline === 0) {
    return undefined;
  }
  const rawRelativeChange = (observed - baseline) / Math.abs(baseline);
  return {
    symptom: {
      metricKind: trigger.metricKind,
      baselineValue: round(baseline),
      observedValue: round(observed),
      relativeChange: round(rawRelativeChange),
    },
    rawRelativeChange,
  };
}

function improvementChangeSet(
  input: RunTelemetryImprovementOptimizerInput,
  hypothesis: ImprovementHypothesis,
  mode: TelemetryImprovementProposalMode,
): ChangeSet {
  const revision = 1;
  const changeSetId = contentAddressedChangeSetId(input.organizationId, input.workItemId, `${input.targetRef}:${hypothesis.hypothesisId}`, revision);
  return {
    changeSetId,
    organizationId: input.organizationId,
    workItemId: input.workItemId,
    proposerHatId: input.proposerHatId,
    title: mode === TelemetryImprovementProposalMode.Rollback && input.rolledOutChangeSetId !== undefined
      ? `Rollback ${input.rolledOutChangeSetId} after telemetry regression`
      : `Improve ${hypothesis.symptom.metricKind} from telemetry regression`,
    targetRef: input.targetRef,
    phase: ChangeSetPhase.Drafted,
    pipelineId: "internal-only",
    currentStageIndex: 0,
    artifacts: [hypothesisArtifact(hypothesis)],
    projections: [],
    revision,
    openedAt: input.now,
    updatedAt: input.now,
  };
}

function hypothesisArtifact(hypothesis: ImprovementHypothesis): ChangeArtifact {
  return {
    kind: ChangeArtifactKind.DecisionRecord,
    decisionId: hypothesis.hypothesisId,
    summary: JSON.stringify(hypothesis),
  };
}

function improvementEvent(
  input: RunTelemetryImprovementOptimizerInput,
  hypothesis: ImprovementHypothesis,
  changeSetId: string,
  evidenceRefs: readonly string[],
): OrgEvent {
  return {
    id: `evt-telemetry-improvement-${changeSetId}`,
    kind: OrgEventKind.DecisionOptimizationProposed,
    occurredAt: input.now,
    organizationId: input.organizationId,
    actorHatId: input.proposerHatId,
    subjectId: changeSetId,
    decision: `${hypothesis.proposedChange.kind} proposal for ${hypothesis.symptom.metricKind} from telemetry regression`,
    supervisorChain: ["executive_board", "coo", input.proposerHatId],
    evidenceRefs: [...evidenceRefs],
    correlationId: changeSetId,
    causationId: hypothesis.hypothesisId,
    traceId: changeSetId,
  };
}

function rollbackChange(input: RunTelemetryImprovementOptimizerInput): TelemetryImprovementProposedChange {
  const rolledOutChangeSetId = input.rolledOutChangeSetId;
  if (rolledOutChangeSetId === undefined) {
    throw new Error("rollback change requires rolledOutChangeSetId");
  }
  return {
    kind: "rollback",
    rolledOutChangeSetId,
    summary: `rollback ${rolledOutChangeSetId} because post-change telemetry breached rollback condition`,
  };
}

function metricMovement(
  direction: TelemetryImprovementExpectedMetricMovement["direction"],
  referenceValue: number,
  postRolloutValue: number,
): number {
  const denominator = Math.abs(referenceValue);
  return direction === "decrease"
    ? (referenceValue - postRolloutValue) / denominator
    : (postRolloutValue - referenceValue) / denominator;
}

function degradedSource(result: TelemetryQueryDegraded): string {
  return `${result.source}:${result.reason}`;
}

function average(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
