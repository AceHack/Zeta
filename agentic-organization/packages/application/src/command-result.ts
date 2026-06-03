import type {
  AgenticAggregateType,
  AgenticEventType,
  ContextPackInboxAnchor,
  ContextPackInboxAnchorStatusTransition,
  DecisionRecord,
  DiscussionAnchor,
  PolicyDecisionEvidence,
  QualityGateEvaluation,
  SupervisorSignal,
  WorkScheduleBlock,
  WorkItem,
} from "../../domain/src/index.ts";
import type { PolicyDenialReason } from "../../policy/src/index.ts";
import type { ContextPackAdvisoryPromotionDecisionWriteInput } from "./context-pack-advisory-promotion-policy.ts";

export const CommandResultStatus = {
  Accepted: "accepted",
  Rejected: "rejected",
} as const;

export type CommandResultStatus = (typeof CommandResultStatus)[keyof typeof CommandResultStatus];

export const CommandErrorCode = {
  ControlPlaneDenied: "control_plane_denied",
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
  ContextPackAdvisoryPromotionDecision: "context_pack_advisory_promotion_decision",
  ContextPackInboxAnchor: "context_pack_inbox_anchor",
  Generic: "generic",
  QualityGateEvaluation: "quality_gate_evaluation",
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
  qualityGateEvaluation?: QualityGateEvaluation;
  contextPackAdvisoryPromotionDecision?: ContextPackAdvisoryPromotionDecisionWriteInput;
  contextPackInboxAnchor?: ContextPackInboxAnchor;
  contextPackInboxAnchorStatusTransition?: ContextPackInboxAnchorStatusTransition;
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
