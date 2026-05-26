import type { SupervisorSignal, WorkItem } from "../../domain/src/index.ts";
import type { PolicyDenialReason } from "../../policy/src/index.ts";

export const CommandResultStatus = {
  Accepted: "accepted",
  Rejected: "rejected",
} as const;

export type CommandResultStatus = (typeof CommandResultStatus)[keyof typeof CommandResultStatus];

export const CommandErrorCode = {
  IdempotencyConflict: "idempotency_conflict",
  PolicyDenied: "policy_denied",
  UnsupportedCommand: "unsupported_command",
} as const;

export type CommandErrorCode = (typeof CommandErrorCode)[keyof typeof CommandErrorCode];

export type CommandResult = {
  status: CommandResultStatus;
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
  };
};
