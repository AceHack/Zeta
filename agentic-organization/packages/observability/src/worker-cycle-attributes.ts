import { WorkerFailureEvidenceKey, type WorkerFailureEvidence } from "../../domain/src/index.ts";

export const WorkerCycleAttributeKey = {
  Status: "agentic.worker.cycle.status",
  OutboxStatus: "agentic.worker.outbox.status",
  InboundPulledCount: "agentic.worker.inbound.pulled_count",
  InboundProcessedCount: "agentic.worker.inbound.processed_count",
  InboundDuplicateCount: "agentic.worker.inbound.duplicate_count",
  InboundPayloadConflictCount: "agentic.worker.inbound.payload_conflict_count",
  InboundFailedCount: "agentic.worker.inbound.failed_count",
  InboundReactionPlanCount: "agentic.worker.inbound.reaction_plan_count",
  ReactionPlanStatus: "agentic.worker.reaction_plan.status",
  ReactionPlanClaimedCount: "agentic.worker.reaction_plan.claimed_count",
  ReactionPlanSucceededCount: "agentic.worker.reaction_plan.succeeded_count",
  ReactionPlanFailedCount: "agentic.worker.reaction_plan.failed_count",
  ReactionPlanClaimLostCount: "agentic.worker.reaction_plan.claim_lost_count",
  FailureCount: "agentic.worker.failure_count",
  FirstFailureClaimId: "agentic.worker.failure.first_claim_id",
  FirstFailureCommandId: "agentic.worker.failure.first_command_id",
  FirstFailureCurrentClaimId: "agentic.worker.failure.first_current_claim_id",
  FirstFailureEventId: "agentic.worker.failure.first_event_id",
  FirstFailureLane: "agentic.worker.failure.first_lane",
  FirstFailureMessage: "agentic.worker.failure.first_message",
  FirstFailureOutboxEventId: "agentic.worker.failure.first_outbox_event_id",
  FirstFailurePublishedAt: "agentic.worker.failure.first_published_at",
  FirstFailureStage: "agentic.worker.failure.first_stage",
  FirstFailureTraceId: "agentic.worker.failure.first_trace_id",
} as const;

export type WorkerCycleAttributeKey = (typeof WorkerCycleAttributeKey)[keyof typeof WorkerCycleAttributeKey];
export type WorkerCycleAttributeValue = string | number | boolean;
export type WorkerCycleCoreAttributeKey =
  | typeof WorkerCycleAttributeKey.Status
  | typeof WorkerCycleAttributeKey.OutboxStatus
  | typeof WorkerCycleAttributeKey.InboundPulledCount
  | typeof WorkerCycleAttributeKey.InboundProcessedCount
  | typeof WorkerCycleAttributeKey.InboundDuplicateCount
  | typeof WorkerCycleAttributeKey.InboundPayloadConflictCount
  | typeof WorkerCycleAttributeKey.InboundFailedCount
  | typeof WorkerCycleAttributeKey.InboundReactionPlanCount
  | typeof WorkerCycleAttributeKey.ReactionPlanStatus
  | typeof WorkerCycleAttributeKey.ReactionPlanClaimedCount
  | typeof WorkerCycleAttributeKey.ReactionPlanSucceededCount
  | typeof WorkerCycleAttributeKey.ReactionPlanFailedCount
  | typeof WorkerCycleAttributeKey.ReactionPlanClaimLostCount
  | typeof WorkerCycleAttributeKey.FailureCount;
export type WorkerCycleFailureAttributeKey = Exclude<WorkerCycleAttributeKey, WorkerCycleCoreAttributeKey>;

export type BuildWorkerCycleAttributesInput = {
  status: string;
  outboxStatus: string;
  inboundPulledCount: number;
  inboundProcessedCount: number;
  inboundDuplicateCount: number;
  inboundPayloadConflictCount: number;
  inboundFailedCount: number;
  inboundReactionPlanCount: number;
  reactionPlanStatus: string;
  reactionPlanClaimedCount: number;
  reactionPlanSucceededCount: number;
  reactionPlanFailedCount: number;
  reactionPlanClaimLostCount: number;
  failureCount: number;
  firstFailure?: WorkerCycleFailureAttributeInput | undefined;
};

export type WorkerCycleFailureAttributeInput = {
  evidence?: WorkerFailureEvidence;
  lane: string;
  message: string;
  stage?: string | undefined;
};

export type WorkerCycleAttributes = Record<WorkerCycleCoreAttributeKey, WorkerCycleAttributeValue> &
  Partial<Record<WorkerCycleFailureAttributeKey, WorkerCycleAttributeValue>>;

export function buildWorkerCycleAttributes(input: BuildWorkerCycleAttributesInput): WorkerCycleAttributes {
  const attributes: WorkerCycleAttributes = {
    [WorkerCycleAttributeKey.Status]: input.status,
    [WorkerCycleAttributeKey.OutboxStatus]: input.outboxStatus,
    [WorkerCycleAttributeKey.InboundPulledCount]: input.inboundPulledCount,
    [WorkerCycleAttributeKey.InboundProcessedCount]: input.inboundProcessedCount,
    [WorkerCycleAttributeKey.InboundDuplicateCount]: input.inboundDuplicateCount,
    [WorkerCycleAttributeKey.InboundPayloadConflictCount]: input.inboundPayloadConflictCount,
    [WorkerCycleAttributeKey.InboundFailedCount]: input.inboundFailedCount,
    [WorkerCycleAttributeKey.InboundReactionPlanCount]: input.inboundReactionPlanCount,
    [WorkerCycleAttributeKey.ReactionPlanStatus]: input.reactionPlanStatus,
    [WorkerCycleAttributeKey.ReactionPlanClaimedCount]: input.reactionPlanClaimedCount,
    [WorkerCycleAttributeKey.ReactionPlanSucceededCount]: input.reactionPlanSucceededCount,
    [WorkerCycleAttributeKey.ReactionPlanFailedCount]: input.reactionPlanFailedCount,
    [WorkerCycleAttributeKey.ReactionPlanClaimLostCount]: input.reactionPlanClaimLostCount,
    [WorkerCycleAttributeKey.FailureCount]: input.failureCount,
  };

  if (input.firstFailure !== undefined) {
    attributes[WorkerCycleAttributeKey.FirstFailureLane] = input.firstFailure.lane;
    attributes[WorkerCycleAttributeKey.FirstFailureMessage] = input.firstFailure.message;
    if (input.firstFailure.stage !== undefined) {
      attributes[WorkerCycleAttributeKey.FirstFailureStage] = input.firstFailure.stage;
    }
    copyPrimitiveEvidenceAttribute({
      attributes,
      evidence: input.firstFailure.evidence,
      evidenceKey: WorkerFailureEvidenceKey.ClaimId,
      attributeKey: WorkerCycleAttributeKey.FirstFailureClaimId,
    });
    copyPrimitiveEvidenceAttribute({
      attributes,
      evidence: input.firstFailure.evidence,
      evidenceKey: WorkerFailureEvidenceKey.CommandId,
      attributeKey: WorkerCycleAttributeKey.FirstFailureCommandId,
    });
    copyPrimitiveEvidenceAttribute({
      attributes,
      evidence: input.firstFailure.evidence,
      evidenceKey: WorkerFailureEvidenceKey.CurrentClaimId,
      attributeKey: WorkerCycleAttributeKey.FirstFailureCurrentClaimId,
    });
    copyPrimitiveEvidenceAttribute({
      attributes,
      evidence: input.firstFailure.evidence,
      evidenceKey: WorkerFailureEvidenceKey.EventId,
      attributeKey: WorkerCycleAttributeKey.FirstFailureEventId,
    });
    copyPrimitiveEvidenceAttribute({
      attributes,
      evidence: input.firstFailure.evidence,
      evidenceKey: WorkerFailureEvidenceKey.OutboxEventId,
      attributeKey: WorkerCycleAttributeKey.FirstFailureOutboxEventId,
    });
    copyPrimitiveEvidenceAttribute({
      attributes,
      evidence: input.firstFailure.evidence,
      evidenceKey: WorkerFailureEvidenceKey.PublishedAt,
      attributeKey: WorkerCycleAttributeKey.FirstFailurePublishedAt,
    });
    copyPrimitiveEvidenceAttribute({
      attributes,
      evidence: input.firstFailure.evidence,
      evidenceKey: WorkerFailureEvidenceKey.TraceId,
      attributeKey: WorkerCycleAttributeKey.FirstFailureTraceId,
    });
  }

  return attributes;
}

type CopyPrimitiveEvidenceAttributeInput = {
  attributes: WorkerCycleAttributes;
  attributeKey: WorkerCycleFailureAttributeKey;
  evidence: WorkerFailureEvidence | undefined;
  evidenceKey: WorkerFailureEvidenceKey;
};

function copyPrimitiveEvidenceAttribute(input: CopyPrimitiveEvidenceAttributeInput): void {
  const value = input.evidence?.[input.evidenceKey];

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    input.attributes[input.attributeKey] = value;
  }
}
