export const WorkerFailureEvidenceKey = {
  ClaimId: "claimId",
  CommandId: "commandId",
  CurrentClaimId: "currentClaimId",
  EventId: "eventId",
  OutboxEventId: "outboxEventId",
  PublishedAt: "publishedAt",
  TraceId: "traceId",
} as const;

export type WorkerFailureEvidenceKey = (typeof WorkerFailureEvidenceKey)[keyof typeof WorkerFailureEvidenceKey];

export type WorkerFailureEvidenceValue = string | number | boolean | null;

export type WorkerFailureEvidence = Partial<Record<WorkerFailureEvidenceKey, WorkerFailureEvidenceValue>>;

export type CreateOutboxPublishFailureEvidenceInput = {
  claimId: string;
  commandId?: string | undefined;
  currentClaimId?: string | null | undefined;
  eventId?: string | undefined;
  outboxEventId: string;
  publishedAt?: string | null | undefined;
  traceId?: string | undefined;
};

export function createOutboxPublishFailureEvidence(
  input: CreateOutboxPublishFailureEvidenceInput,
): WorkerFailureEvidence {
  return {
    [WorkerFailureEvidenceKey.ClaimId]: input.claimId,
    [WorkerFailureEvidenceKey.CommandId]: input.commandId ?? null,
    [WorkerFailureEvidenceKey.CurrentClaimId]: input.currentClaimId ?? null,
    [WorkerFailureEvidenceKey.EventId]: input.eventId ?? null,
    [WorkerFailureEvidenceKey.OutboxEventId]: input.outboxEventId,
    [WorkerFailureEvidenceKey.PublishedAt]: input.publishedAt ?? null,
    [WorkerFailureEvidenceKey.TraceId]: input.traceId ?? null,
  };
}
