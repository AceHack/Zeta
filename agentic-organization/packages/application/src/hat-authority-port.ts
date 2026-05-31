import {
  CommandType,
  HatAssignmentAuthorityState,
  type HatDefinition,
} from "../../domain/src/index.ts";
import {
  HatAuthorityDecisionStatus,
  type HatAuthorityDecision,
  type HatAuthorityPort,
  type HatAuthorityRequest,
} from "../../policy/src/index.ts";
import { ActionClass, preflightHatAction } from "./hat-guardrails.ts";
import type { HatAssignmentAuthorityReaderPort } from "./ports.ts";

export const HatAuthorityPolicyVersion = "hat-authority-v1" as const;

export type CreateHatAuthorityPortInput = {
  hatAssignmentAuthorityReader: HatAssignmentAuthorityReaderPort;
  hatDefinitions: readonly HatDefinition[];
  createId: (prefix: string) => string;
  policyVersion?: string | undefined;
};

const CommandActionClass: Readonly<Partial<Record<CommandType, ActionClass>>> = {
  [CommandType.CreateWorkItem]: ActionClass.Prioritize,
  [CommandType.CreateDiscussionAnchor]: ActionClass.WriteDoc,
  [CommandType.RecordQualityGateEvaluation]: ActionClass.ApproveReview,
  [CommandType.RecordDecision]: ActionClass.Prioritize,
  [CommandType.ScheduleWorkBlock]: ActionClass.Prioritize,
  [CommandType.SendSupervisorSignal]: ActionClass.Prioritize,
  [CommandType.TriageSupervisorSignal]: ActionClass.Prioritize,
};

const ToolActionClass: Readonly<Record<ActionClass, ActionClass>> = {
  [ActionClass.WriteCode]: ActionClass.WriteCode,
  [ActionClass.ReviewCode]: ActionClass.ReviewCode,
  [ActionClass.ApproveReview]: ActionClass.ApproveReview,
  [ActionClass.RunTests]: ActionClass.RunTests,
  [ActionClass.Deploy]: ActionClass.Deploy,
  [ActionClass.WriteDoc]: ActionClass.WriteDoc,
  [ActionClass.Prioritize]: ActionClass.Prioritize,
  [ActionClass.AssignHat]: ActionClass.AssignHat,
  [ActionClass.DesignArchitecture]: ActionClass.DesignArchitecture,
  [ActionClass.WriteBusinessRequirements]: ActionClass.WriteBusinessRequirements,
};

export function createHatAuthorityPort(input: CreateHatAuthorityPortInput): HatAuthorityPort {
  const hatById = new Map(input.hatDefinitions.map((hat) => [hat.id, hat]));
  const policyVersion = input.policyVersion ?? HatAuthorityPolicyVersion;

  return {
    evaluateHatAuthority: async (request) => {
      const decisionId = input.createId("hat-authority-decision");
      const authority = await input.hatAssignmentAuthorityReader.findHatAssignmentAuthority(
        request.hatAssignmentId,
      );

      if (authority === undefined) {
        return denied(HatAuthorityDecisionStatus.Missing, decisionId, policyVersion);
      }

      const stateDecision = decisionForAuthorityState(authority.state, decisionId, policyVersion);
      if (stateDecision !== undefined) {
        return stateDecision;
      }

      if (
        authority.assignedAgentId !== request.agentId ||
        authority.organizationId !== request.scope.organizationId ||
        authority.projectId !== request.scope.projectId ||
        !sameOptionalScope(authority.teamId, request.scope.teamId)
      ) {
        return denied(HatAuthorityDecisionStatus.ScopeDenied, decisionId, policyVersion);
      }

      const hat = hatById.get(authority.hatId);
      if (hat === undefined) {
        return denied(HatAuthorityDecisionStatus.Missing, decisionId, policyVersion);
      }

      const actionClass = actionClassFor(request);
      if (actionClass === undefined) {
        return denied(HatAuthorityDecisionStatus.ToolDenied, decisionId, policyVersion);
      }

      const guardrail = preflightHatAction(hat, actionClass);
      if (!guardrail.allowed) {
        return denied(HatAuthorityDecisionStatus.ToolDenied, decisionId, policyVersion);
      }

      return {
        status: HatAuthorityDecisionStatus.Active,
        decisionId,
        policyVersion,
      };
    },
  };
}

function decisionForAuthorityState(
  state: HatAssignmentAuthorityState,
  decisionId: string,
  policyVersion: string,
): HatAuthorityDecision | undefined {
  switch (state) {
    case HatAssignmentAuthorityState.Active:
      return undefined;
    case HatAssignmentAuthorityState.Expired:
    case HatAssignmentAuthorityState.Released:
      return denied(HatAuthorityDecisionStatus.Expired, decisionId, policyVersion);
    case HatAssignmentAuthorityState.Revoked:
    case HatAssignmentAuthorityState.Suspended:
      return denied(HatAuthorityDecisionStatus.Revoked, decisionId, policyVersion);
  }
}

function actionClassFor(request: HatAuthorityRequest): ActionClass | undefined {
  if (request.toolType !== undefined) {
    return ToolActionClass[request.toolType as ActionClass];
  }

  return CommandActionClass[request.commandType as CommandType];
}

function denied(
  status: Exclude<HatAuthorityDecisionStatus, typeof HatAuthorityDecisionStatus.Active>,
  decisionId: string,
  policyVersion: string,
): HatAuthorityDecision {
  return {
    status,
    decisionId,
    policyVersion,
  };
}

function sameOptionalScope(left: string | undefined, right: string | undefined): boolean {
  return left === right;
}
