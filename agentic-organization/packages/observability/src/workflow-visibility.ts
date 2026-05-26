import type { AgenticAggregateType, AgenticEventEnvelope, AgenticEventType } from "../../domain/src/index.ts";
import {
  PolicyDecisionStatus,
  type PolicyDecisionObservation,
  type PolicyDenialReason,
} from "../../policy/src/index.ts";

export const WorkflowObservationKind = {
  SupervisorSignal: "supervisor_signal",
  Command: "command",
  ReactionPlan: "reaction_plan",
  ToolCall: "tool_call",
  HermesRun: "hermes_run",
  Gate: "gate",
  ScheduleBlock: "schedule_block",
  PolicyDecision: "policy_decision",
} as const;

export type WorkflowObservationKind = (typeof WorkflowObservationKind)[keyof typeof WorkflowObservationKind];

export const VisibilityHealth = {
  Healthy: "healthy",
  Degraded: "degraded",
  Blocked: "blocked",
  Failing: "failing",
  Unknown: "unknown",
} as const;

export type VisibilityHealth = (typeof VisibilityHealth)[keyof typeof VisibilityHealth];

export const WeakPointIndicatorType = {
  BlockedWork: "blocked_work",
  SlowTriage: "slow_triage",
  RepeatedFailure: "repeated_failure",
  MissingEvidence: "missing_evidence",
  MissingTool: "missing_tool",
  PolicyDenied: "policy_denied",
  HarnessFailure: "harness_failure",
  TelemetryGap: "telemetry_gap",
} as const;

export type WeakPointIndicatorType = (typeof WeakPointIndicatorType)[keyof typeof WeakPointIndicatorType];

export const PolicyDecisionVisibilityStage = {
  Allowed: "policy_allowed",
  Denied: "policy_denied",
} as const;

export type PolicyDecisionVisibilityStage =
  (typeof PolicyDecisionVisibilityStage)[keyof typeof PolicyDecisionVisibilityStage];

export type VisibilityLinks = {
  traceUrl: string;
  logsUrl: string;
  metricsUrl: string;
};

export type WeakPointIndicator = {
  indicatorType: WeakPointIndicatorType;
  summary: string;
  suggestedAction: string;
};

export type WorkflowVisibilityRecord = {
  observationKind: WorkflowObservationKind;
  health: VisibilityHealth;
  stage: string;
  occurredAt: string;
  eventId: string;
  eventType: AgenticEventType;
  commandId: string;
  correlationId: string;
  causationId: string;
  traceId: string;
  idempotencyKey: string;
  organizationId: string;
  projectId: string;
  initiativeId?: string;
  teamId?: string;
  workItemId: string;
  agentId: string;
  hatAssignmentId: string;
  aggregateId: string;
  aggregateType: AgenticAggregateType;
  aggregateVersion: number;
  policyDecisionId?: string;
  policyVersion?: string;
  links: VisibilityLinks;
  weakPointIndicators: WeakPointIndicator[];
};

export type PolicyDecisionObservationVisibilityRecord = {
  observationKind: typeof WorkflowObservationKind.PolicyDecision;
  health: VisibilityHealth;
  stage: PolicyDecisionVisibilityStage;
  occurredAt: string;
  commandId: string;
  commandType: PolicyDecisionObservation["commandType"];
  correlationId: string;
  causationId: string;
  traceId: string;
  idempotencyKey: string;
  organizationId: string;
  projectId: string;
  teamId?: string;
  workItemId?: string;
  agentId: string;
  hatAssignmentId: string;
  toolType?: PolicyDecisionObservation["toolType"];
  sourceLevel?: NonNullable<PolicyDecisionObservation["supervisorChain"]>["sourceLevel"];
  targetLevel?: NonNullable<PolicyDecisionObservation["supervisorChain"]>["targetLevel"];
  policyDecisionId: string;
  policyVersion: string;
  policyDecisionStatus: PolicyDecisionObservation["decision"]["status"];
  policyDenialReason?: PolicyDenialReason;
  links: VisibilityLinks;
  weakPointIndicators: WeakPointIndicator[];
};

export type BuildWorkflowVisibilityRecordInput = {
  observationKind: WorkflowObservationKind;
  health: VisibilityHealth;
  stage: string;
  links: VisibilityLinks;
  weakPointIndicators?: WeakPointIndicator[];
};

export type BuildPolicyDecisionObservationVisibilityRecordInput = {
  links: VisibilityLinks;
};

export function buildWorkflowVisibilityRecord(
  envelope: AgenticEventEnvelope,
  input: BuildWorkflowVisibilityRecordInput,
): WorkflowVisibilityRecord {
  const record: WorkflowVisibilityRecord = {
    observationKind: input.observationKind,
    health: input.health,
    stage: input.stage,
    occurredAt: envelope.occurredAt,
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    commandId: envelope.trace.commandId,
    correlationId: envelope.trace.correlationId,
    causationId: envelope.trace.causationId,
    traceId: envelope.trace.traceId,
    idempotencyKey: envelope.trace.idempotencyKey,
    organizationId: envelope.scope.organizationId,
    projectId: envelope.scope.projectId,
    workItemId: envelope.scope.workItemId,
    agentId: envelope.actor.agentId,
    hatAssignmentId: envelope.actor.hatAssignmentId,
    aggregateId: envelope.aggregate.aggregateId,
    aggregateType: envelope.aggregate.aggregateType,
    aggregateVersion: envelope.aggregate.aggregateVersion,
    links: input.links,
    weakPointIndicators: input.weakPointIndicators ?? [],
  };

  if (envelope.scope.initiativeId !== undefined) {
    record.initiativeId = envelope.scope.initiativeId;
  }

  if (envelope.scope.teamId !== undefined) {
    record.teamId = envelope.scope.teamId;
  }

  if (envelope.policy !== undefined) {
    record.policyDecisionId = envelope.policy.decisionId;
    record.policyVersion = envelope.policy.policyVersion;
  }

  return record;
}

export function buildPolicyDecisionObservationVisibilityRecord(
  observation: PolicyDecisionObservation,
  input: BuildPolicyDecisionObservationVisibilityRecordInput,
): PolicyDecisionObservationVisibilityRecord {
  const record: PolicyDecisionObservationVisibilityRecord = {
    observationKind: WorkflowObservationKind.PolicyDecision,
    health:
      observation.decision.status === PolicyDecisionStatus.Denied ? VisibilityHealth.Blocked : VisibilityHealth.Healthy,
    stage:
      observation.decision.status === PolicyDecisionStatus.Denied
        ? PolicyDecisionVisibilityStage.Denied
        : PolicyDecisionVisibilityStage.Allowed,
    occurredAt: observation.observedAt,
    commandId: observation.commandId,
    commandType: observation.commandType,
    correlationId: observation.trace.correlationId,
    causationId: observation.trace.causationId,
    traceId: observation.trace.traceId,
    idempotencyKey: observation.trace.idempotencyKey,
    organizationId: observation.scope.organizationId,
    projectId: observation.scope.projectId,
    agentId: observation.actor.agentId,
    hatAssignmentId: observation.actor.hatAssignmentId,
    policyDecisionId: observation.decision.decisionId,
    policyVersion: observation.decision.policyVersion,
    policyDecisionStatus: observation.decision.status,
    links: input.links,
    weakPointIndicators:
      observation.decision.status === PolicyDecisionStatus.Denied
        ? [
            {
              indicatorType: WeakPointIndicatorType.PolicyDenied,
              summary: `Policy denied ${observation.commandType} for ${observation.toolType ?? "unspecified_tool"}`,
              suggestedAction: "Review hat authority, scope, and tool grant before retrying the command",
            },
          ]
        : [],
  };

  if (observation.scope.teamId !== undefined) {
    record.teamId = observation.scope.teamId;
  }

  if (observation.scope.workItemId !== undefined) {
    record.workItemId = observation.scope.workItemId;
  }

  if (observation.toolType !== undefined) {
    record.toolType = observation.toolType;
  }

  if (observation.supervisorChain?.sourceLevel !== undefined) {
    record.sourceLevel = observation.supervisorChain.sourceLevel;
  }

  if (observation.supervisorChain?.targetLevel !== undefined) {
    record.targetLevel = observation.supervisorChain.targetLevel;
  }

  if (observation.decision.status === PolicyDecisionStatus.Denied) {
    record.policyDenialReason = observation.decision.reason;
  }

  return record;
}
