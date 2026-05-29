import {
  AgenticEventType,
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  SupervisorChainLevel,
  WorkItemState,
  type AgenticEventEnvelope,
  type ReactionPlanAction,
  isSupervisorChainLevel,
  isWorkItemStateChangedPayload,
} from "../../domain/src/index.ts";

export { ReactionPlanActionType, ReactionPlanReason, RequiredHat, type ReactionPlanAction };

type SupervisorSignalSentPayload = {
  targetHatAssignmentId: string;
  targetLevel: SupervisorTargetLevel;
};

type SupervisorTargetLevel =
  | typeof SupervisorChainLevel.Manager
  | typeof SupervisorChainLevel.Director
  | typeof SupervisorChainLevel.CSuite
  | typeof SupervisorChainLevel.ExecutiveBoard;

export function evaluateV0AutomationRules(envelope: AgenticEventEnvelope): ReactionPlanAction[] {
  const workItemStateChangeReaction = evaluateWorkItemStateChangeRule(envelope);

  if (workItemStateChangeReaction !== undefined) {
    return [workItemStateChangeReaction];
  }

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
      requiredHat: mapTargetLevelToSupervisorHat(envelope.payload.targetLevel),
      reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
    },
  ];
}

function evaluateWorkItemStateChangeRule(envelope: AgenticEventEnvelope): ReactionPlanAction | undefined {
  if (
    envelope.eventType !== AgenticEventType.WorkItemStateChanged ||
    !isWorkItemStateChangedPayload(envelope.payload)
  ) {
    return undefined;
  }

  if (envelope.payload.fromState !== WorkItemState.Ready && envelope.payload.toState === WorkItemState.Ready) {
    return createWorkItemReactionPlan({
      envelope,
      actionType: ReactionPlanActionType.RequestImplementationAssignment,
      requiredHat: RequiredHat.EngineeringManager,
      reason: ReactionPlanReason.WorkItemEnteredReadyState,
    });
  }

  if (envelope.payload.fromState !== WorkItemState.Review && envelope.payload.toState === WorkItemState.Review) {
    return createWorkItemReactionPlan({
      envelope,
      actionType: ReactionPlanActionType.RequestReviewGate,
      requiredHat: RequiredHat.Reviewer,
      reason: ReactionPlanReason.WorkItemEnteredReviewState,
    });
  }

  return undefined;
}

function createWorkItemReactionPlan(input: {
  envelope: AgenticEventEnvelope;
  actionType: typeof ReactionPlanActionType.RequestImplementationAssignment | typeof ReactionPlanActionType.RequestReviewGate;
  requiredHat: typeof RequiredHat.EngineeringManager | typeof RequiredHat.Reviewer;
  reason: typeof ReactionPlanReason.WorkItemEnteredReadyState | typeof ReactionPlanReason.WorkItemEnteredReviewState;
}): ReactionPlanAction {
  if (input.actionType === ReactionPlanActionType.RequestImplementationAssignment) {
    return {
      ...createBaseWorkItemReactionPlan(input.envelope),
      actionType: ReactionPlanActionType.RequestImplementationAssignment,
      requiredHat: RequiredHat.EngineeringManager,
      reason: ReactionPlanReason.WorkItemEnteredReadyState,
    };
  }

  return {
    ...createBaseWorkItemReactionPlan(input.envelope),
    actionType: ReactionPlanActionType.RequestReviewGate,
    requiredHat: RequiredHat.Reviewer,
    reason: ReactionPlanReason.WorkItemEnteredReviewState,
  };
}

function createBaseWorkItemReactionPlan(envelope: AgenticEventEnvelope) {
  return {
    triggerEventId: envelope.eventId,
    organizationId: envelope.scope.organizationId,
    projectId: envelope.scope.projectId,
    ...createOptionalTeamScope(envelope.scope.teamId),
    workItemId: envelope.scope.workItemId,
  };
}

function isSupervisorSignalSentPayload(payload: unknown): payload is SupervisorSignalSentPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "targetHatAssignmentId" in payload &&
    typeof payload.targetHatAssignmentId === "string" &&
    payload.targetHatAssignmentId.trim().length > 0 &&
    "targetLevel" in payload &&
    isSupervisorChainLevel(payload.targetLevel) &&
    isSupervisorTargetLevel(payload.targetLevel)
  );
}

function isSupervisorTargetLevel(value: SupervisorChainLevel): value is SupervisorTargetLevel {
  return value !== SupervisorChainLevel.TeamMember;
}

function createOptionalTeamScope(teamId: string | undefined): { teamId?: string } {
  return teamId === undefined ? {} : { teamId };
}

function mapTargetLevelToSupervisorHat(
  targetLevel: SupervisorTargetLevel,
):
  | typeof RequiredHat.CSuite
  | typeof RequiredHat.Director
  | typeof RequiredHat.EngineeringManager
  | typeof RequiredHat.ExecutiveBoard {
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

  return assertUnreachableTargetLevel(targetLevel);
}

function assertUnreachableTargetLevel(
  targetLevel: never,
):
  | typeof RequiredHat.CSuite
  | typeof RequiredHat.Director
  | typeof RequiredHat.EngineeringManager
  | typeof RequiredHat.ExecutiveBoard {
  throw new Error(`unhandled supervisor target level: ${targetLevel}`);
}
