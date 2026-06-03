export const EventSchemaVersion = {
  AgenticOrgEventV1: "agentic.org.event.v1",
} as const;

export type EventSchemaVersion = (typeof EventSchemaVersion)[keyof typeof EventSchemaVersion];

export const CommandType = {
  CreateWorkItem: "create_work_item",
  CreateDiscussionAnchor: "create_discussion_anchor",
  RecordQualityGateEvaluation: "record_quality_gate_evaluation",
  RecordDecision: "record_decision",
  ScheduleWorkBlock: "schedule_work_block",
  SendSupervisorSignal: "send_supervisor_signal",
  TriageSupervisorSignal: "triage_supervisor_signal",
  AuthorContextPackInboxAnchor: "author_context_pack_inbox_anchor",
  UpdateContextPackInboxAnchorStatus: "update_context_pack_inbox_anchor_status",
  AuthorContextPackAdvisoryPromotionDecision: "author_context_pack_advisory_promotion_decision",
} as const;

export type CommandType = (typeof CommandType)[keyof typeof CommandType];

export const AgenticEventType = {
  DecisionRecorded: "decision.recorded",
  DiscussionAnchorCreated: "discussion_anchor.created",
  QualityGateEvaluated: "quality_gate.evaluated",
  SupervisorSignalSent: "supervisor_signal.sent",
  WorkScheduleBlockScheduled: "work_schedule_block.scheduled",
  WorkItemChanged: "work_item.changed",
  WorkItemStateChanged: "work_item.state_changed",
} as const;

export type AgenticEventType = (typeof AgenticEventType)[keyof typeof AgenticEventType];

export const AgenticAggregateType = {
  DecisionRecord: "decision_record",
  DiscussionAnchor: "discussion_anchor",
  QualityGateEvaluation: "quality_gate_evaluation",
  SupervisorSignal: "supervisor_signal",
  WorkScheduleBlock: "work_schedule_block",
  WorkItem: "work_item",
} as const;

export type AgenticAggregateType = (typeof AgenticAggregateType)[keyof typeof AgenticAggregateType];

export type CommandTrace = {
  commandId: string;
  correlationId: string;
  causationId: string;
  traceId: string;
  idempotencyKey: string;
};

export type AgenticActor = {
  agentId: string;
  hatAssignmentId: string;
};

export type AgenticScope = {
  organizationId: string;
  projectId: string;
  initiativeId?: string;
  teamId?: string;
  workItemId: string;
};

export type AgenticAggregate = {
  aggregateId: string;
  aggregateType: AgenticAggregateType;
  aggregateVersion: number;
};

export type AgenticReplayState = {
  isReplay: boolean;
};

export type PolicyDecisionEvidence = {
  decisionId: string;
  policyVersion: string;
};

export type AgenticEventEnvelope<Payload = Record<string, unknown>> = {
  eventId: string;
  eventType: AgenticEventType;
  schemaVersion: EventSchemaVersion;
  occurredAt: string;
  actor: AgenticActor;
  scope: AgenticScope;
  aggregate: AgenticAggregate;
  trace: CommandTrace;
  policy?: PolicyDecisionEvidence;
  replay: AgenticReplayState;
  payload: Payload;
};

export type CreateAgenticEventEnvelopeInput<Payload = Record<string, unknown>> = Omit<
  AgenticEventEnvelope<Payload>,
  "schemaVersion" | "replay"
> & {
  schemaVersion?: EventSchemaVersion;
  replay?: AgenticReplayState;
};

export function createAgenticEventEnvelope<Payload>(
  input: CreateAgenticEventEnvelopeInput<Payload>,
): AgenticEventEnvelope<Payload> {
  assertNonEmpty("eventId", input.eventId);
  assertNonEmpty("occurredAt", input.occurredAt);
  assertCommandTrace(input.trace);
  assertNonEmpty("actor.agentId", input.actor.agentId);
  assertNonEmpty("actor.hatAssignmentId", input.actor.hatAssignmentId);
  assertNonEmpty("scope.organizationId", input.scope.organizationId);
  assertNonEmpty("scope.projectId", input.scope.projectId);
  assertNonEmpty("scope.workItemId", input.scope.workItemId);
  assertNonEmpty("aggregate.aggregateId", input.aggregate.aggregateId);
  assertPositiveInteger("aggregate.aggregateVersion", input.aggregate.aggregateVersion);

  return {
    ...input,
    schemaVersion: input.schemaVersion ?? EventSchemaVersion.AgenticOrgEventV1,
    replay: input.replay ?? {
      isReplay: false,
    },
  };
}

function assertCommandTrace(trace: CommandTrace): void {
  assertNonEmpty("commandId", trace.commandId);
  assertNonEmpty("correlationId", trace.correlationId);
  assertNonEmpty("causationId", trace.causationId);
  assertNonEmpty("traceId", trace.traceId);
  assertNonEmpty("idempotencyKey", trace.idempotencyKey);
}

function assertNonEmpty(fieldName: string, value: string | undefined): void {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
}

function assertPositiveInteger(fieldName: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}
