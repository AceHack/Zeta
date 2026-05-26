import {
  AgenticEventType,
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  SupervisorChainLevel,
  type AgenticEventEnvelope,
  type ReactionPlanAction,
} from "../../domain/src/index.ts";

export { ReactionPlanActionType, ReactionPlanReason, RequiredHat, type ReactionPlanAction };

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
