import type { AgenticActor, AgenticEventEnvelope } from "./event-envelope.ts";
import type {
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
} from "./supervisor-communication.ts";
import type { WorkItemState } from "./work-item-state-machine.ts";

export type WorkItem = {
  workItemId: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string;
  state: WorkItemState;
  createdAt: string;
  createdBy: AgenticActor;
};

export type SupervisorSignal = {
  supervisorSignalId: string;
  organizationId: string;
  projectId: string;
  teamId: string;
  sourceLevel: SupervisorChainLevel;
  targetLevel: SupervisorChainLevel;
  targetHatAssignmentId: string;
  sender: AgenticActor;
  toolType: SupervisorSignalToolType;
  status: SupervisorSignalStatus;
  title: string;
  message: string;
  relatedWorkItemId: string;
  createdAt: string;
};

export type DiscussionAnchor = {
  discussionAnchorId: string;
  workItemId: string;
  organizationId: string;
  projectId: string;
  createdAt: string;
};

export type AuditEvent = {
  auditEventId: string;
  eventName: string;
  aggregateId: string;
  actor: AgenticActor;
  occurredAt: string;
};

export type OutboxEvent = {
  outboxEventId: string;
  envelope: AgenticEventEnvelope;
  publishedAt?: string;
};

export type IdempotencyRecord<Result> = {
  idempotencyKey: string;
  requestHash: string;
  result: Result;
};
