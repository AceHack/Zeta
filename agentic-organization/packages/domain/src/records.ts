import type { AgenticActor, AgenticEventEnvelope, PolicyDecisionEvidence } from "./event-envelope.ts";
import type {
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
} from "./supervisor-communication.ts";
import type { WorkItemState, WorkItemType } from "./work-item-state-machine.ts";

export const ProjectStatus = {
  Active: "active",
  Archived: "archived",
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const InitiativeStatus = {
  Proposed: "proposed",
  Active: "active",
  Completed: "completed",
  Archived: "archived",
} as const;

export type InitiativeStatus = (typeof InitiativeStatus)[keyof typeof InitiativeStatus];

export type Project = {
  projectId: string;
  organizationId: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  createdBy: AgenticActor;
};

export type Initiative = {
  initiativeId: string;
  organizationId: string;
  projectId: string;
  title: string;
  status: InitiativeStatus;
  createdAt: string;
  createdBy: AgenticActor;
};

export type WorkItem = {
  workItemId: string;
  organizationId: string;
  projectId: string;
  initiativeId?: string;
  workItemType: WorkItemType;
  title: string;
  description: string;
  state: WorkItemState;
  createdAt: string;
  createdBy: AgenticActor;
};

export type WorkAnchorTarget = {
  workAnchorTargetId: string;
  organizationId: string;
  projectId: string;
  initiativeId?: string;
  workItemId: string;
  createdAt: string;
  createdBy: AgenticActor;
};

export type WorkStateTransition = {
  workStateTransitionId: string;
  organizationId: string;
  projectId: string;
  workItemId: string;
  fromState: WorkItemState;
  toState: WorkItemState;
  evidenceArtifactIds: readonly string[];
  assignedEngineerHatAssignmentId?: string;
  scheduledWorkBlockId?: string;
  transitionedAt: string;
  transitionedBy: AgenticActor;
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
  policy?: PolicyDecisionEvidence;
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
