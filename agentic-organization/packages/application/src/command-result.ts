import type {
  AgenticAggregateType,
  AgenticEventType,
  PolicyDecisionEvidence,
  SupervisorSignal,
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
  UnsupportedCommand: "unsupported_command",
  ValidationFailed: "validation_failed",
} as const;

export type CommandErrorCode = (typeof CommandErrorCode)[keyof typeof CommandErrorCode];

export const CommandResultArtifactType = {
  Generic: "generic",
  SupervisorSignal: "supervisor_signal",
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
    reason?: PolicyDenialReason;
    observationFailureReason?: string;
  };
};
