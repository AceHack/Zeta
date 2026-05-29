import type { AgenticActor, AgenticEventEnvelope, PolicyDecisionEvidence } from "./event-envelope.ts";
import type {
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
} from "./supervisor-communication.ts";
import { WorkItemState, type WorkItemType } from "./work-item-state-machine.ts";

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

export type WorkItemStateChangedPayload = {
  fromState: WorkItemState;
  toState: WorkItemState;
};

export function isWorkItemStateChangedPayload(payload: unknown): payload is WorkItemStateChangedPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  return (
    "fromState" in payload &&
    "toState" in payload &&
    isWorkItemState(payload.fromState) &&
    isWorkItemState(payload.toState)
  );
}

function isWorkItemState(value: unknown): value is WorkItemState {
  return typeof value === "string" && Object.values(WorkItemState).includes(value as WorkItemState);
}

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

export const HatAssignmentAuthorityState = {
  Active: "active",
  Expired: "expired",
  Released: "released",
  Revoked: "revoked",
  Suspended: "suspended",
} as const;

export type HatAssignmentAuthorityState =
  (typeof HatAssignmentAuthorityState)[keyof typeof HatAssignmentAuthorityState];

export type HatAssignmentAuthoritySnapshot = {
  hatAssignmentId: string;
  organizationId: string;
  projectId: string;
  teamId?: string;
  assignedAgentId: string;
  state: HatAssignmentAuthorityState;
};

export const DiscussionAnchorType = {
  CapabilityRequest: "capability_request",
  Gate: "gate",
  Incident: "incident",
  Initiative: "initiative",
  MemoryReview: "memory_review",
  Project: "project",
  Release: "release",
  SupervisorSignal: "supervisor_signal",
  WorkItem: "work_item",
} as const;

export type DiscussionAnchorType = (typeof DiscussionAnchorType)[keyof typeof DiscussionAnchorType];

export const DiscussionExpectedOutput = {
  Decision: "decision",
  Document: "document",
  FollowUp: "follow_up",
  GateResult: "gate_result",
  Memory: "memory",
  Status: "status",
} as const;

export type DiscussionExpectedOutput = (typeof DiscussionExpectedOutput)[keyof typeof DiscussionExpectedOutput];

export function isDiscussionAnchorType(value: unknown): value is DiscussionAnchorType {
  return typeof value === "string" && Object.values(DiscussionAnchorType).includes(value as DiscussionAnchorType);
}

export function isDiscussionExpectedOutput(value: unknown): value is DiscussionExpectedOutput {
  return (
    typeof value === "string" &&
    Object.values(DiscussionExpectedOutput).includes(value as DiscussionExpectedOutput)
  );
}

export type DiscussionAnchor = {
  discussionAnchorId: string;
  organizationId: string;
  projectId: string;
  teamId?: string;
  workItemId: string;
  discussionAnchorType: DiscussionAnchorType;
  title: string;
  purpose: string;
  expectedOutputs: readonly DiscussionExpectedOutput[];
  createdAt: string;
  createdBy: AgenticActor;
  metadata: {
    updatedAt: string;
    version: number;
    correlationId: string;
    causationId: string;
    traceId: string;
  };
};

export type DecisionRecord = {
  decisionRecordId: string;
  organizationId: string;
  projectId: string;
  teamId?: string;
  workItemId: string;
  discussionAnchorId: string;
  title: string;
  decision: string;
  rationale: string;
  alternativesConsidered: readonly string[];
  followUpWorkItemIds: readonly string[];
  decidedAt: string;
  decidedBy: AgenticActor;
  metadata: {
    updatedAt: string;
    version: number;
    correlationId: string;
    causationId: string;
    traceId: string;
  };
};

export const ScheduleBlockType = {
  FreeTime: "free_time",
  Meeting: "meeting",
  MemoryMaintenance: "memory_maintenance",
  PrioritizedWork: "prioritized_work",
  PromptFlowExecution: "prompt_flow_execution",
  Reflection: "reflection",
  Reporting: "reporting",
  Review: "review",
} as const;

export type ScheduleBlockType = (typeof ScheduleBlockType)[keyof typeof ScheduleBlockType];

export const ScheduleBlockState = {
  Active: "active",
  Canceled: "canceled",
  Completed: "completed",
  Missed: "missed",
  Paused: "paused",
  Scheduled: "scheduled",
} as const;

export type ScheduleBlockState = (typeof ScheduleBlockState)[keyof typeof ScheduleBlockState];

export function isScheduleBlockType(value: unknown): value is ScheduleBlockType {
  return typeof value === "string" && Object.values(ScheduleBlockType).includes(value as ScheduleBlockType);
}

export function isScheduleBlockState(value: unknown): value is ScheduleBlockState {
  return typeof value === "string" && Object.values(ScheduleBlockState).includes(value as ScheduleBlockState);
}

export type WorkScheduleBlock = {
  workScheduleBlockId: string;
  organizationId: string;
  projectId: string;
  teamId?: string;
  workItemId: string;
  discussionAnchorId?: string;
  assignedAgentId: string;
  assignedHatAssignmentId: string;
  blockType: ScheduleBlockType;
  state: ScheduleBlockState;
  title: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
  scheduledAt: string;
  scheduledBy: AgenticActor;
  metadata: {
    updatedAt: string;
    version: number;
    correlationId: string;
    causationId: string;
    traceId: string;
  };
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
