import {
  CommandType,
  ScheduleBlockType,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
import {
  CommandScheduleAuthorityDecisionStatus,
  CommandScheduleAuthorityDenialReason,
  type CommandScheduleAuthorityDecision,
  type CommandScheduleAuthorityPort,
  type CommandScheduleAuthorityRequest,
  type WorkScheduleBlockAuthorityReaderPort,
} from "./ports.ts";

export const ScheduleAuthorityMessage = {
  BlockRequired: "command requires a current schedule block for the actor hat",
  ScopeMismatch: "current schedule block does not match the command scope",
  TypeDenied: "current schedule block type does not allow the command",
} as const;

export type ScheduleAuthorityMessage = (typeof ScheduleAuthorityMessage)[keyof typeof ScheduleAuthorityMessage];

export type ScheduleAuthorityCommandRule = {
  commandType: CommandType | string;
  allowedBlockTypes: readonly ScheduleBlockType[];
  scheduleRequired: boolean;
};

export type CreateScheduleBlockCommandAuthorityInput = {
  scheduleBlockReader: WorkScheduleBlockAuthorityReaderPort;
  commandRules?: readonly ScheduleAuthorityCommandRule[] | undefined;
};

export function createScheduleBlockCommandAuthority(
  input: CreateScheduleBlockCommandAuthorityInput,
): CommandScheduleAuthorityPort {
  const rules = input.commandRules ?? DefaultScheduleAuthorityCommandRules;

  return {
    authorizeCommandSchedule: async (request) => authorizeCommandSchedule(request, input.scheduleBlockReader, rules),
  };
}

export const DefaultScheduleAuthorityCommandRules: readonly ScheduleAuthorityCommandRule[] = [
  {
    commandType: CommandType.ScheduleWorkBlock,
    allowedBlockTypes: [],
    scheduleRequired: false,
  },
  {
    commandType: CommandType.CreateDiscussionAnchor,
    allowedBlockTypes: [],
    scheduleRequired: false,
  },
  {
    commandType: CommandType.RecordDecision,
    allowedBlockTypes: [ScheduleBlockType.Meeting, ScheduleBlockType.PrioritizedWork, ScheduleBlockType.Review],
    scheduleRequired: true,
  },
  {
    commandType: CommandType.RecordQualityGateEvaluation,
    allowedBlockTypes: [
      ScheduleBlockType.Meeting,
      ScheduleBlockType.PrioritizedWork,
      ScheduleBlockType.Reporting,
      ScheduleBlockType.Review,
    ],
    scheduleRequired: true,
  },
  {
    commandType: CommandType.CreateWorkItem,
    allowedBlockTypes: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution, ScheduleBlockType.Reporting],
    scheduleRequired: true,
  },
  {
    commandType: CommandType.SendSupervisorSignal,
    allowedBlockTypes: [
      ScheduleBlockType.FreeTime,
      ScheduleBlockType.Meeting,
      ScheduleBlockType.PrioritizedWork,
      ScheduleBlockType.PromptFlowExecution,
      ScheduleBlockType.Reflection,
      ScheduleBlockType.Reporting,
      ScheduleBlockType.Review,
    ],
    scheduleRequired: true,
  },
  {
    commandType: CommandType.TriageSupervisorSignal,
    allowedBlockTypes: [ScheduleBlockType.Meeting, ScheduleBlockType.PrioritizedWork, ScheduleBlockType.Reporting],
    scheduleRequired: true,
  },
];

async function authorizeCommandSchedule(
  request: CommandScheduleAuthorityRequest,
  scheduleBlockReader: WorkScheduleBlockAuthorityReaderPort,
  rules: readonly ScheduleAuthorityCommandRule[],
): Promise<CommandScheduleAuthorityDecision> {
  const rule = findCommandRule(request.commandType, rules);

  if (rule === undefined || !rule.scheduleRequired) {
    return {
      status: CommandScheduleAuthorityDecisionStatus.NotRequired,
    };
  }

  const authorizingBlocks = await scheduleBlockReader.findAuthorizingScheduleBlocks({
    agentId: request.actor.agentId,
    hatAssignmentId: request.actor.hatAssignmentId,
    evaluatedAt: request.evaluatedAt,
  });

  if (authorizingBlocks.length === 0) {
    return createDeniedDecision(
      CommandScheduleAuthorityDenialReason.ScheduleBlockRequired,
      ScheduleAuthorityMessage.BlockRequired,
    );
  }

  const scopeMatchedBlocks = authorizingBlocks.filter((block) => hasMatchingScope(block, request));

  if (scopeMatchedBlocks.length === 0) {
    return createDeniedDecision(
      CommandScheduleAuthorityDenialReason.ScheduleBlockScopeMismatch,
      ScheduleAuthorityMessage.ScopeMismatch,
      authorizingBlocks[0]?.workScheduleBlockId,
    );
  }

  const allowedBlock = scopeMatchedBlocks.find((block) => rule.allowedBlockTypes.includes(block.blockType));

  if (allowedBlock === undefined) {
    return createDeniedDecision(
      CommandScheduleAuthorityDenialReason.ScheduleBlockTypeDenied,
      ScheduleAuthorityMessage.TypeDenied,
      scopeMatchedBlocks[0]?.workScheduleBlockId,
    );
  }

  return {
    status: CommandScheduleAuthorityDecisionStatus.Allowed,
    scheduleBlockId: allowedBlock.workScheduleBlockId,
  };
}

function findCommandRule(
  commandType: CommandType | string,
  rules: readonly ScheduleAuthorityCommandRule[],
): ScheduleAuthorityCommandRule | undefined {
  return rules.find((rule) => rule.commandType === commandType);
}

function hasMatchingScope(block: WorkScheduleBlock, request: CommandScheduleAuthorityRequest): boolean {
  return (
    block.organizationId === request.scope.organizationId &&
    block.projectId === request.scope.projectId &&
    block.assignedAgentId === request.actor.agentId &&
    block.assignedHatAssignmentId === request.actor.hatAssignmentId &&
    optionalScopeMatches(block.teamId, request.scope.teamId) &&
    optionalScopeMatches(block.workItemId, request.scope.workItemId)
  );
}

function optionalScopeMatches(blockValue: string | undefined, requestValue: string | undefined): boolean {
  return requestValue === undefined || blockValue === requestValue;
}

function createDeniedDecision(
  reason: CommandScheduleAuthorityDenialReason,
  message: ScheduleAuthorityMessage,
  scheduleBlockId?: string,
): CommandScheduleAuthorityDecision {
  return {
    status: CommandScheduleAuthorityDecisionStatus.Denied,
    reason,
    message,
    ...(scheduleBlockId === undefined ? {} : { scheduleBlockId }),
  };
}
