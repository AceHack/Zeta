import type {
  AgenticActor,
  SupervisorChainLevel,
} from "../../domain/src/index.ts";

export const PolicyDecisionStatus = {
  Allowed: "allowed",
  Denied: "denied",
} as const;

export type PolicyDecisionStatus = (typeof PolicyDecisionStatus)[keyof typeof PolicyDecisionStatus];

export const HatAuthorityDecisionStatus = {
  Active: "active",
  Expired: "hat_authority_expired",
  Missing: "hat_authority_missing",
  Revoked: "hat_authority_revoked",
  ScopeDenied: "hat_scope_denied",
  ToolDenied: "hat_tool_denied",
} as const;

export type HatAuthorityDecisionStatus = (typeof HatAuthorityDecisionStatus)[keyof typeof HatAuthorityDecisionStatus];

export type PolicyDenialReason =
  | typeof HatAuthorityDecisionStatus.Expired
  | typeof HatAuthorityDecisionStatus.Missing
  | typeof HatAuthorityDecisionStatus.Revoked
  | typeof HatAuthorityDecisionStatus.ScopeDenied
  | typeof HatAuthorityDecisionStatus.ToolDenied;

export type CommandAuthorizationScope = {
  organizationId: string;
  projectId: string;
  teamId?: string;
  workItemId?: string;
};

export type CommandAuthorizationTrace = {
  correlationId: string;
  causationId: string;
  traceId: string;
  idempotencyKey: string;
};

export type CommandAuthorizationSupervisorChain = {
  sourceLevel?: SupervisorChainLevel;
  targetLevel?: SupervisorChainLevel;
};

export type CommandAuthorizationResource = {
  assignedAgentId?: string;
  assignedHatAssignmentId?: string;
  blockType?: string;
  startsAt?: string;
  endsAt?: string;
};

export type CommandAuthorizationRequest = {
  commandId: string;
  commandType: string;
  actor: AgenticActor;
  scope: CommandAuthorizationScope;
  toolType?: string;
  supervisorChain?: CommandAuthorizationSupervisorChain;
  resource?: CommandAuthorizationResource;
  trace: CommandAuthorizationTrace;
};

export type HatAuthorityRequest = CommandAuthorizationRequest & {
  agentId: string;
  hatAssignmentId: string;
};

export type HatAuthorityDecision =
  | {
      status: typeof HatAuthorityDecisionStatus.Active;
      decisionId: string;
      policyVersion: string;
    }
  | {
      status: PolicyDenialReason;
      decisionId: string;
      policyVersion: string;
    };

export type PolicyDecision =
  | {
      status: typeof PolicyDecisionStatus.Allowed;
      decisionId: string;
      policyVersion: string;
    }
  | {
      status: typeof PolicyDecisionStatus.Denied;
      decisionId: string;
      policyVersion: string;
      reason: PolicyDenialReason;
    };

export type PolicyDecisionObservation = {
  commandId: string;
  commandType: string;
  actor: AgenticActor;
  scope: CommandAuthorizationScope;
  toolType?: string;
  supervisorChain?: CommandAuthorizationSupervisorChain;
  resource?: CommandAuthorizationResource;
  trace: CommandAuthorizationTrace;
  decision: PolicyDecision;
  observedAt: string;
};

export const PolicyDecisionObservationPersistenceStatus = {
  Recorded: "recorded",
  Duplicate: "duplicate",
  Conflict: "conflict",
} as const;

export type PolicyDecisionObservationPersistenceStatus =
  (typeof PolicyDecisionObservationPersistenceStatus)[keyof typeof PolicyDecisionObservationPersistenceStatus];

export type RecordPolicyDecisionObservationResult =
  | {
      status: typeof PolicyDecisionObservationPersistenceStatus.Recorded;
    }
  | {
      status: typeof PolicyDecisionObservationPersistenceStatus.Duplicate;
    }
  | {
      status: typeof PolicyDecisionObservationPersistenceStatus.Conflict;
    };

export type PolicyDecisionObservationQuery = {
  organizationId: string;
  projectId?: string;
  teamId?: string;
  workItemId?: string;
  agentId?: string;
  hatAssignmentId?: string;
  decisionStatus?: PolicyDecisionStatus;
  limit: number;
};

export type HatAuthorityPort = {
  evaluateHatAuthority: (request: HatAuthorityRequest) => Promise<HatAuthorityDecision>;
};

export type CommandAuthorizationPort = {
  authorizeCommand: (request: CommandAuthorizationRequest) => Promise<PolicyDecision>;
};

export type PolicyDecisionObservationPort = {
  observePolicyDecision: (observation: PolicyDecisionObservation) => Promise<RecordPolicyDecisionObservationResult>;
};

export type PolicyDecisionObservationStore = {
  recordPolicyDecisionObservation: (
    observation: PolicyDecisionObservation,
  ) => Promise<RecordPolicyDecisionObservationResult>;
};

export type PolicyDecisionObservationReader = {
  findPolicyDecisionObservations: (
    query: PolicyDecisionObservationQuery,
  ) => Promise<readonly PolicyDecisionObservation[]>;
};

export type CreateCommandAuthorizationPortInput = {
  hatAuthorityPort: HatAuthorityPort;
};

export type CreatePolicyDecisionObservationPortInput = {
  store: PolicyDecisionObservationStore;
};

export function createCommandAuthorizationPort(input: CreateCommandAuthorizationPortInput): CommandAuthorizationPort {
  return {
    authorizeCommand: async (request) => {
      const hatAuthorityDecision = await input.hatAuthorityPort.evaluateHatAuthority({
        ...request,
        agentId: request.actor.agentId,
        hatAssignmentId: request.actor.hatAssignmentId,
      });

      if (hatAuthorityDecision.status === HatAuthorityDecisionStatus.Active) {
        return {
          status: PolicyDecisionStatus.Allowed,
          decisionId: hatAuthorityDecision.decisionId,
          policyVersion: hatAuthorityDecision.policyVersion,
        };
      }

      return {
        status: PolicyDecisionStatus.Denied,
        decisionId: hatAuthorityDecision.decisionId,
        policyVersion: hatAuthorityDecision.policyVersion,
        reason: hatAuthorityDecision.status,
      };
    },
  };
}

export function createPolicyDecisionObservationPort(
  input: CreatePolicyDecisionObservationPortInput,
): PolicyDecisionObservationPort {
  return {
    observePolicyDecision: async (observation) => await input.store.recordPolicyDecisionObservation(observation),
  };
}
