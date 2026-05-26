export const WorkerCycleAttributeKey = {
  Status: "agentic.worker.cycle.status",
  OutboxStatus: "agentic.worker.outbox.status",
  InboundPulledCount: "agentic.worker.inbound.pulled_count",
  InboundProcessedCount: "agentic.worker.inbound.processed_count",
  InboundDuplicateCount: "agentic.worker.inbound.duplicate_count",
  InboundPayloadConflictCount: "agentic.worker.inbound.payload_conflict_count",
  InboundFailedCount: "agentic.worker.inbound.failed_count",
  InboundReactionPlanCount: "agentic.worker.inbound.reaction_plan_count",
  FailureCount: "agentic.worker.failure_count",
} as const;

export type WorkerCycleAttributeKey = (typeof WorkerCycleAttributeKey)[keyof typeof WorkerCycleAttributeKey];

export type BuildWorkerCycleAttributesInput = {
  status: string;
  outboxStatus: string;
  inboundPulledCount: number;
  inboundProcessedCount: number;
  inboundDuplicateCount: number;
  inboundPayloadConflictCount: number;
  inboundFailedCount: number;
  inboundReactionPlanCount: number;
  failureCount: number;
};

export type WorkerCycleAttributes = Record<WorkerCycleAttributeKey, string | number>;

export function buildWorkerCycleAttributes(input: BuildWorkerCycleAttributesInput): WorkerCycleAttributes {
  return {
    [WorkerCycleAttributeKey.Status]: input.status,
    [WorkerCycleAttributeKey.OutboxStatus]: input.outboxStatus,
    [WorkerCycleAttributeKey.InboundPulledCount]: input.inboundPulledCount,
    [WorkerCycleAttributeKey.InboundProcessedCount]: input.inboundProcessedCount,
    [WorkerCycleAttributeKey.InboundDuplicateCount]: input.inboundDuplicateCount,
    [WorkerCycleAttributeKey.InboundPayloadConflictCount]: input.inboundPayloadConflictCount,
    [WorkerCycleAttributeKey.InboundFailedCount]: input.inboundFailedCount,
    [WorkerCycleAttributeKey.InboundReactionPlanCount]: input.inboundReactionPlanCount,
    [WorkerCycleAttributeKey.FailureCount]: input.failureCount,
  };
}
