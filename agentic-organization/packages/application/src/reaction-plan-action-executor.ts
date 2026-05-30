import {
  CommandType,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  ReactionPlanActionType,
  type AgenticActor,
  type ReactionPlanAction,
} from "../../domain/src/index.ts";
import {
  ReactionPlanExecutionStatus,
  type ReactionPlanActionExecutionContext,
  type ReactionPlanActionExecutionResult,
  type ReactionPlanActionExecutorPort,
} from "../../runtime/src/index.ts";
import type { CommandPipeline } from "./command-pipeline.ts";
import type { CommandResult } from "./command-result.ts";
import { CommandResultArtifactType, CommandResultStatus } from "./command-result.ts";
import type { CreateDiscussionAnchorCommand } from "./handlers/create-discussion-anchor.ts";
import type { IdGenerator } from "./ports.ts";

export const ReactionPlanApplicationExecutorIdPrefix = {
  Command: "cmd",
} as const;

export type ReactionPlanApplicationExecutorIdPrefix =
  (typeof ReactionPlanApplicationExecutorIdPrefix)[keyof typeof ReactionPlanApplicationExecutorIdPrefix];

export const ReactionPlanApplicationExecutorMessage = {
  ActorUnavailable: "required reaction actor is unavailable",
  CommandRejected: "reaction command was rejected",
  DiscussionAnchorMissing: "reaction command accepted without creating the expected discussion anchor",
  DiscussionAnchorCreated: "supervisor triage discussion anchor created",
  UnsupportedAction: "reaction action is not supported by the application executor",
} as const;

export type ReactionPlanApplicationExecutorMessage =
  (typeof ReactionPlanApplicationExecutorMessage)[keyof typeof ReactionPlanApplicationExecutorMessage];

export const ReactionPlanApplicationExecutorTitle = {
  ImplementationAssignment: "Implementation assignment",
  ReviewGate: "Review gate",
  SupervisorTriage: "Supervisor triage",
} as const;

export type ReactionPlanApplicationExecutorTitle =
  (typeof ReactionPlanApplicationExecutorTitle)[keyof typeof ReactionPlanApplicationExecutorTitle];

export const ReactionPlanApplicationExecutorPurpose = {
  ImplementationAssignment: "Assign implementation ownership and decide the next execution schedule.",
  ReviewGate: "Open the review gate and decide the reviewer evidence needed before the next state transition.",
  SupervisorTriage: "Triage the supervisor signal and decide the next organization action.",
} as const;

export type ReactionPlanApplicationExecutorPurpose =
  (typeof ReactionPlanApplicationExecutorPurpose)[keyof typeof ReactionPlanApplicationExecutorPurpose];

export type ReactionPlanActorResolutionRequest = {
  action: ReactionPlanAction;
  context: ReactionPlanActionExecutionContext;
};

export type ReactionPlanActorResolverPort = {
  resolveReactionActor: (request: ReactionPlanActorResolutionRequest) => Promise<AgenticActor | undefined>;
};

export type CreateApplicationReactionPlanActionExecutorInput = IdGenerator & {
  // ISP-minimal: this executor only ever builds + executes a CreateDiscussionAnchorCommand,
  // so it depends on the narrowest pipeline that can do that. Any wider pipeline
  // (e.g. CommandPipeline<PipelineCommand>) is assignable here via contravariance.
  commandPipeline: CommandPipeline<CreateDiscussionAnchorCommand>;
  actorResolver: ReactionPlanActorResolverPort;
};

export function createApplicationReactionPlanActionExecutor(
  input: CreateApplicationReactionPlanActionExecutorInput,
): ReactionPlanActionExecutorPort {
  return {
    executeReactionPlanAction: async (action, context) => executeReactionPlanAction(action, context, input),
  };
}

async function executeReactionPlanAction(
  action: ReactionPlanAction,
  context: ReactionPlanActionExecutionContext,
  input: CreateApplicationReactionPlanActionExecutorInput,
): Promise<ReactionPlanActionExecutionResult> {
  if (action.actionType !== ReactionPlanActionType.CreateSupervisorTriage) {
    if (
      action.actionType !== ReactionPlanActionType.RequestImplementationAssignment &&
      action.actionType !== ReactionPlanActionType.RequestReviewGate
    ) {
      return createFailedExecution(ReactionPlanApplicationExecutorMessage.UnsupportedAction, false);
    }
  }

  const actor = await input.actorResolver.resolveReactionActor({
    action,
    context,
  });

  if (actor === undefined) {
    return createFailedExecution(ReactionPlanApplicationExecutorMessage.ActorUnavailable, true);
  }

  const command = createReactionDiscussionCommand(action, context, actor, input);
  const result = await input.commandPipeline.execute(command);

  if (result.status === CommandResultStatus.Rejected) {
    return createFailedExecution(createCommandRejectedMessage(result), true);
  }

  const createdDiscussionAnchorIds = findArtifactIds(result, CommandResultArtifactType.DiscussionAnchor);

  if (createdDiscussionAnchorIds.length === 0) {
    return createFailedExecution(ReactionPlanApplicationExecutorMessage.DiscussionAnchorMissing, true);
  }

  return {
    status: ReactionPlanExecutionStatus.Succeeded,
    result: {
      message: ReactionPlanApplicationExecutorMessage.DiscussionAnchorCreated,
      createdWorkItemIds: [],
      createdDiscussionAnchorIds,
    },
  };
}

function createReactionDiscussionCommand(
  action: ReactionPlanAction,
  context: ReactionPlanActionExecutionContext,
  actor: AgenticActor,
  input: IdGenerator,
): CreateDiscussionAnchorCommand {
  const idempotencyKey = `${context.actionIdempotencyKey}:${CommandType.CreateDiscussionAnchor}`;
  const commandId = input.createId(ReactionPlanApplicationExecutorIdPrefix.Command);
  const template = createReactionDiscussionTemplate(action);

  return {
    commandId,
    type: CommandType.CreateDiscussionAnchor,
    idempotencyKey,
    requestHash: createReactionCommandRequestHash(action, CommandType.CreateDiscussionAnchor),
    correlationId: action.triggerEventId,
    causationId: createReactionCommandCausationId(action),
    traceId: action.triggerEventId,
    organizationId: action.organizationId,
    projectId: action.projectId,
    actor,
    ...createOptionalTeamScope(action),
    workItemId: action.workItemId,
    discussionAnchorType: DiscussionAnchorType.WorkItem,
    title: `${template.title}: ${action.reason}`,
    purpose: template.purpose,
    expectedOutputs: [DiscussionExpectedOutput.Decision, DiscussionExpectedOutput.FollowUp],
  };
}

function createReactionDiscussionTemplate(action: ReactionPlanAction): {
  title: ReactionPlanApplicationExecutorTitle;
  purpose: ReactionPlanApplicationExecutorPurpose;
} {
  if (action.actionType === ReactionPlanActionType.CreateSupervisorTriage) {
    return {
      title: ReactionPlanApplicationExecutorTitle.SupervisorTriage,
      purpose: ReactionPlanApplicationExecutorPurpose.SupervisorTriage,
    };
  }

  if (action.actionType === ReactionPlanActionType.RequestImplementationAssignment) {
    return {
      title: ReactionPlanApplicationExecutorTitle.ImplementationAssignment,
      purpose: ReactionPlanApplicationExecutorPurpose.ImplementationAssignment,
    };
  }

  return {
    title: ReactionPlanApplicationExecutorTitle.ReviewGate,
    purpose: ReactionPlanApplicationExecutorPurpose.ReviewGate,
  };
}

function createOptionalTeamScope(action: Pick<ReactionPlanAction, "teamId">): { teamId?: string } {
  return action.teamId === undefined ? {} : { teamId: action.teamId };
}

function createReactionCommandCausationId(action: ReactionPlanAction): string {
  return "supervisorSignalId" in action ? action.supervisorSignalId : action.triggerEventId;
}

function createReactionCommandRequestHash(action: ReactionPlanAction, commandType: CommandType): string {
  return JSON.stringify({
    actionType: action.actionType,
    commandType,
    organizationId: action.organizationId,
    projectId: action.projectId,
    reason: action.reason,
    supervisorSignalId: "supervisorSignalId" in action ? action.supervisorSignalId : undefined,
    triggerEventId: action.triggerEventId,
    workItemId: action.workItemId,
  });
}

function createCommandRejectedMessage(result: CommandResult): string {
  return result.error === undefined
    ? ReactionPlanApplicationExecutorMessage.CommandRejected
    : `${ReactionPlanApplicationExecutorMessage.CommandRejected}: ${result.error.message}`;
}

function findArtifactIds(result: CommandResult, artifactType: CommandResultArtifactType): readonly string[] {
  return (result.artifacts ?? [])
    .filter((artifact) => artifact.artifactType === artifactType && isNonBlankString(artifact.artifactId))
    .map((artifact) => artifact.artifactId);
}

function isNonBlankString(value: string): boolean {
  return value.trim().length > 0;
}

function createFailedExecution(
  message: string,
  retryable: boolean,
): Extract<ReactionPlanActionExecutionResult, { status: typeof ReactionPlanExecutionStatus.Failed }> {
  return {
    status: ReactionPlanExecutionStatus.Failed,
    failure: {
      message,
      retryable,
    },
  };
}
