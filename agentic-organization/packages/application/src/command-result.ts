import type {
  AgenticAggregateType,
  AgenticEventType,
  DecisionRecord,
  DiscussionAnchor,
  PolicyDecisionEvidence,
  SupervisorSignal,
  WorkScheduleBlock,
  WorkItem,
} from "../../domain/src/index.ts";
import type { PolicyDenialReason } from "../../policy/src/index.ts";

export const CommandResultStatus = {
  Accepted: "accepted",
  Rejected: "rejected",
} as const;

export type CommandResultStatus = (typeof CommandResultStatus)[keyof typeof CommandResultStatus];

export const CommandErrorCode = {
  IdempotencyConflict: "idempotency_conflict",
  PreconditionFailed: "precondition_failed",
  PolicyDenied: "policy_denied",
  PolicyObservationConflict: "policy_observation_conflict",
  PolicyObservationFailed: "policy_observation_failed",
  ScheduleAuthorityDenied: "schedule_authority_denied",
  UnsupportedCommand: "unsupported_command",
  ValidationFailed: "validation_failed",
} as const;

export type CommandErrorCode = (typeof CommandErrorCode)[keyof typeof CommandErrorCode];

export const CommandResultArtifactType = {
  DecisionRecord: "decision_record",
  DiscussionAnchor: "discussion_anchor",
  Generic: "generic",
  SupervisorSignal: "supervisor_signal",
  WorkScheduleBlock: "work_schedule_block",
  WorkItem: "work_item",
} as const;

export type CommandResultArtifactType =
  (typeof CommandResultArtifactType)[keyof typeof CommandResultArtifactType];

export type CommandResultArtifact = {
  artifactType: CommandResultArtifactType | string;
  artifactId: string;
  label?: string;
};

export type CommandResultEmittedEvent = {
  eventId: string;
  eventType: AgenticEventType | string;
  aggregateId: string;
  aggregateType: AgenticAggregateType | string;
};

export type CommandResult = {
  commandId?: string;
  status: CommandResultStatus;
  artifacts?: readonly CommandResultArtifact[];
  emittedEvents?: readonly CommandResultEmittedEvent[];
  auditEventIds?: readonly string[];
  policy?: PolicyDecisionEvidence;
  decisionRecord?: DecisionRecord;
  discussionAnchor?: DiscussionAnchor;
  workScheduleBlock?: WorkScheduleBlock;
  workItem?: WorkItem;
  supervisorSignal?: SupervisorSignal;
  idempotency: {
    replayed: boolean;
  };
  error?: {
    code: CommandErrorCode;
    message: string;
    policyDecisionId?: string;
    policyVersion?: string;
    reason?: PolicyDenialReason | string;
    observationFailureReason?: string;
  };
};
