import { AgenticEventType, SupervisorChainLevel, type AgenticEventEnvelope } from "../../domain/src/index.ts";

export const ReactionPlanActionType = {
  CreateSupervisorTriage: "create_supervisor_triage",
  RequestReviewGate: "request_review_gate",
} as const;

export type ReactionPlanActionType = (typeof ReactionPlanActionType)[keyof typeof ReactionPlanActionType];

export const RequiredHat = {
  CSuite: "c_suite",
  Director: "director",
  EngineeringManager: "engineering_manager",
  ExecutiveBoard: "executive_board",
  Reviewer: "reviewer",
} as const;

export type RequiredHat = (typeof RequiredHat)[keyof typeof RequiredHat];

export const ReactionPlanReason = {
  SupervisorSignalNeedsTriage: "supervisor signal needs triage",
  WorkItemEnteredReadyState: "work item entered ready state",
} as const;

export type ReactionPlanReason = (typeof ReactionPlanReason)[keyof typeof ReactionPlanReason];

export type ReactionPlanAction = {
  actionType: ReactionPlanActionType;
  triggerEventId: string;
  organizationId: string;
  projectId: string;
  teamId?: string;
  workItemId: string;
  supervisorSignalId?: string;
  targetLevel?: SupervisorChainLevel;
  requiredHat: RequiredHat;
  reason: ReactionPlanReason;
};

type SupervisorSignalSentPayload = {
  targetHatAssignmentId: string;
  targetLevel: SupervisorChainLevel;
};

export function evaluateV0AutomationRules(envelope: AgenticEventEnvelope): ReactionPlanAction[] {
  if (
    envelope.eventType !== AgenticEventType.SupervisorSignalSent ||
    !isSupervisorSignalSentPayload(envelope.payload) ||
    envelope.scope.teamId === undefined
  ) {
    return [];
  }

  return [
    {
      actionType: ReactionPlanActionType.CreateSupervisorTriage,
      triggerEventId: envelope.eventId,
      organizationId: envelope.scope.organizationId,
      projectId: envelope.scope.projectId,
      teamId: envelope.scope.teamId,
      workItemId: envelope.scope.workItemId,
      supervisorSignalId: envelope.aggregate.aggregateId,
      targetLevel: envelope.payload.targetLevel,
      requiredHat: mapTargetLevelToHat(envelope.payload.targetLevel),
      reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
    },
  ];
}

function isSupervisorSignalSentPayload(payload: unknown): payload is SupervisorSignalSentPayload {
  return (
    typeof payload === "object" && payload !== null && "targetHatAssignmentId" in payload && "targetLevel" in payload
  );
}

function mapTargetLevelToHat(targetLevel: SupervisorChainLevel): RequiredHat {
  if (targetLevel === SupervisorChainLevel.Manager) {
    return RequiredHat.EngineeringManager;
  }

  if (targetLevel === SupervisorChainLevel.Director) {
    return RequiredHat.Director;
  }

  if (targetLevel === SupervisorChainLevel.CSuite) {
    return RequiredHat.CSuite;
  }

  if (targetLevel === SupervisorChainLevel.ExecutiveBoard) {
    return RequiredHat.ExecutiveBoard;
  }

  return RequiredHat.EngineeringManager;
}
