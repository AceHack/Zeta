import type {
  AgenticActor,
  CommandType,
  SupervisorChainLevel,
  SupervisorSignalToolType,
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
};

export type CommandAuthorizationSupervisorChain = {
  sourceLevel?: SupervisorChainLevel;
  targetLevel?: SupervisorChainLevel;
};

export type CommandAuthorizationRequest = {
  commandId: string;
  commandType: CommandType;
  actor: AgenticActor;
  scope: CommandAuthorizationScope;
  toolType?: SupervisorSignalToolType;
  supervisorChain?: CommandAuthorizationSupervisorChain;
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

export type HatAuthorityPort = {
  evaluateHatAuthority: (request: HatAuthorityRequest) => Promise<HatAuthorityDecision>;
};

export type CommandAuthorizationPort = {
  authorizeCommand: (request: CommandAuthorizationRequest) => Promise<PolicyDecision>;
};

export type CreateCommandAuthorizationPortInput = {
  hatAuthorityPort: HatAuthorityPort;
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
