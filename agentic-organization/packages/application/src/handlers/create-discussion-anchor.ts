import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  DiscussionAnchorType,
  createAgenticEventEnvelope,
  isDiscussionAnchorType,
  isDiscussionExpectedOutput,
  type DiscussionAnchor,
  type DiscussionExpectedOutput,
} from "../../../domain/src/index.ts";
import type { CommandHandler, CommandHandlerOutcome } from "../command-handler-registry.ts";
import type { PipelineCommand } from "../command-contract.ts";
import {
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
  type CommandResult,
} from "../command-result.ts";
import type { Clock, CommandEffects, IdGenerator } from "../ports.ts";
import type { CommandWorkAnchorWorkItem, WorkAnchorStateReaderPort } from "../ports.ts";

export const CreateDiscussionAnchorIdPrefix = {
  Audit: "audit",
  DiscussionAnchor: "discussion-anchor",
  Event: "evt",
  Outbox: "outbox",
} as const;

export type CreateDiscussionAnchorIdPrefix =
  (typeof CreateDiscussionAnchorIdPrefix)[keyof typeof CreateDiscussionAnchorIdPrefix];

export const DiscussionAnchorValidationErrorMessage = {
  MissingWorkAnchorReader: "discussion anchor requires work anchor validation",
  MissingRelatedWorkItem: "discussion anchor requires an existing related work item",
  ExpectedOutputRequired: "discussion anchor requires at least one expected output",
  InvalidExpectedOutput: "discussion anchor expected output is invalid",
  PurposeRequired: "discussion anchor purpose is required",
  ScopeMismatch: "discussion anchor work item scope does not match the command scope",
  TitleRequired: "discussion anchor title is required",
  UnsupportedAnchorType: "discussion anchor V0 only supports work_item anchors",
} as const;

export type DiscussionAnchorValidationErrorMessage =
  (typeof DiscussionAnchorValidationErrorMessage)[keyof typeof DiscussionAnchorValidationErrorMessage];

export type CreateDiscussionAnchorCommand = PipelineCommand & {
  type: typeof CommandType.CreateDiscussionAnchor;
  teamId?: string;
  workItemId: string;
  discussionAnchorType: typeof DiscussionAnchorType.WorkItem;
  title: string;
  purpose: string;
  expectedOutputs: readonly DiscussionExpectedOutput[];
};

export type CreateDiscussionAnchorDependencies = Clock &
  IdGenerator & {
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

export function createCreateDiscussionAnchorHandler(): CommandHandler<CreateDiscussionAnchorCommand, CommandResult> {
  return {
    commandType: CommandType.CreateDiscussionAnchor,
    execute: createDiscussionAnchor,
  };
}

export async function createDiscussionAnchor(
  command: CreateDiscussionAnchorCommand,
  dependencies: CreateDiscussionAnchorDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const validationError = validateCreateDiscussionAnchorCommand(command);

  if (validationError !== undefined) {
    return createRejectedValidationOutcome(command, validationError);
  }

  const workItemValidationError = await validateRelatedWorkItem(command, dependencies);

  if (workItemValidationError !== undefined) {
    return createRejectedPreconditionOutcome(command, workItemValidationError);
  }

  const occurredAt = dependencies.now();
  const discussionAnchor = createDiscussionAnchorRecord(
    command,
    dependencies.createId(CreateDiscussionAnchorIdPrefix.DiscussionAnchor),
    occurredAt,
  );
  const auditEventId = dependencies.createId(CreateDiscussionAnchorIdPrefix.Audit);
  const outboxEventId = dependencies.createId(CreateDiscussionAnchorIdPrefix.Outbox);
  const envelope = createAgenticEventEnvelope({
    eventId: dependencies.createId(CreateDiscussionAnchorIdPrefix.Event),
    eventType: AgenticEventType.DiscussionAnchorCreated,
    occurredAt,
    actor: command.actor,
    scope: {
      organizationId: command.organizationId,
      projectId: command.projectId,
      ...createOptionalTeamScope(command),
      workItemId: command.workItemId,
    },
    aggregate: {
      aggregateId: discussionAnchor.discussionAnchorId,
      aggregateType: AgenticAggregateType.DiscussionAnchor,
      aggregateVersion: discussionAnchor.metadata.version,
    },
    trace: {
      commandId: command.commandId,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
      idempotencyKey: command.idempotencyKey,
    },
    payload: {
      discussionAnchorType: command.discussionAnchorType,
      title: command.title,
      purpose: command.purpose,
      expectedOutputs: command.expectedOutputs,
    },
  });

  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Accepted,
      artifacts: [
        {
          artifactType: CommandResultArtifactType.DiscussionAnchor,
          artifactId: discussionAnchor.discussionAnchorId,
          label: discussionAnchor.title,
        },
      ],
      emittedEvents: [
        {
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          aggregateId: envelope.aggregate.aggregateId,
          aggregateType: envelope.aggregate.aggregateType,
        },
      ],
      auditEventIds: [auditEventId],
      discussionAnchor,
      idempotency: {
        replayed: false,
      },
    },
    effects: {
      supervisorSignals: [],
      discussionAnchors: [discussionAnchor],
      decisionRecords: [],
      qualityGateEvaluations: [],
      workScheduleBlocks: [],
      auditEvents: [
        {
          auditEventId,
          eventName: AgenticEventType.DiscussionAnchorCreated,
          aggregateId: discussionAnchor.discussionAnchorId,
          actor: command.actor,
          occurredAt,
        },
      ],
      outboxEvents: [
        {
          outboxEventId,
          envelope,
        },
      ],
      workAnchors: createEmptyWorkAnchorCommandEffects(),
    },
  };
}

async function validateRelatedWorkItem(
  command: CreateDiscussionAnchorCommand,
  dependencies: CreateDiscussionAnchorDependencies,
): Promise<DiscussionAnchorValidationErrorMessage | undefined> {
  if (dependencies.workAnchorStateReader === undefined) {
    return DiscussionAnchorValidationErrorMessage.MissingWorkAnchorReader;
  }

  const relatedWorkItem = await dependencies.workAnchorStateReader.findWorkItem(command.workItemId);

  if (relatedWorkItem === undefined) {
    return DiscussionAnchorValidationErrorMessage.MissingRelatedWorkItem;
  }

  if (!hasMatchingCommandScope(command, relatedWorkItem)) {
    return DiscussionAnchorValidationErrorMessage.ScopeMismatch;
  }

  return undefined;
}

function hasMatchingCommandScope(command: CreateDiscussionAnchorCommand, workItem: CommandWorkAnchorWorkItem): boolean {
  return (
    workItem.workItemId === command.workItemId &&
    workItem.organizationId === command.organizationId &&
    workItem.projectId === command.projectId
  );
}

function validateCreateDiscussionAnchorCommand(
  command: CreateDiscussionAnchorCommand,
): DiscussionAnchorValidationErrorMessage | undefined {
  if (isBlank(command.title)) {
    return DiscussionAnchorValidationErrorMessage.TitleRequired;
  }

  if (isBlank(command.purpose)) {
    return DiscussionAnchorValidationErrorMessage.PurposeRequired;
  }

  if (!isDiscussionAnchorType(command.discussionAnchorType)) {
    return DiscussionAnchorValidationErrorMessage.UnsupportedAnchorType;
  }

  if (command.discussionAnchorType !== DiscussionAnchorType.WorkItem) {
    return DiscussionAnchorValidationErrorMessage.UnsupportedAnchorType;
  }

  if (!Array.isArray(command.expectedOutputs)) {
    return DiscussionAnchorValidationErrorMessage.InvalidExpectedOutput;
  }

  if (command.expectedOutputs.length === 0) {
    return DiscussionAnchorValidationErrorMessage.ExpectedOutputRequired;
  }

  if (!command.expectedOutputs.every(isDiscussionExpectedOutput)) {
    return DiscussionAnchorValidationErrorMessage.InvalidExpectedOutput;
  }

  return undefined;
}

function createDiscussionAnchorRecord(
  command: CreateDiscussionAnchorCommand,
  discussionAnchorId: string,
  occurredAt: string,
): DiscussionAnchor {
  return {
    discussionAnchorId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...createOptionalTeamScope(command),
    workItemId: command.workItemId,
    discussionAnchorType: command.discussionAnchorType,
    title: command.title,
    purpose: command.purpose,
    expectedOutputs: [...command.expectedOutputs],
    createdAt: occurredAt,
    createdBy: command.actor,
    metadata: {
      updatedAt: occurredAt,
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}

function createRejectedValidationOutcome(
  command: CreateDiscussionAnchorCommand,
  message: DiscussionAnchorValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.ValidationFailed, message);
}

function createRejectedPreconditionOutcome(
  command: CreateDiscussionAnchorCommand,
  message: DiscussionAnchorValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.PreconditionFailed, message);
}

function createRejectedOutcome(
  command: CreateDiscussionAnchorCommand,
  code: CommandErrorCode,
  message: DiscussionAnchorValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Rejected,
      idempotency: {
        replayed: false,
      },
      error: {
        code,
        message,
      },
    },
    effects: createEmptyCommandEffects(),
  };
}

function createEmptyCommandEffects(): CommandEffects {
  return {
    supervisorSignals: [],
    discussionAnchors: [],
    decisionRecords: [],
    qualityGateEvaluations: [],
    workScheduleBlocks: [],
    auditEvents: [],
    outboxEvents: [],
    workAnchors: createEmptyWorkAnchorCommandEffects(),
  };
}

function createEmptyWorkAnchorCommandEffects(): NonNullable<CommandEffects["workAnchors"]> {
  return {
    projects: [],
    initiatives: [],
    workItems: [],
    workAnchorTargets: [],
    workItemTransitions: [],
  };
}

function createOptionalTeamScope(command: Pick<CreateDiscussionAnchorCommand, "teamId">): { teamId?: string } {
  return command.teamId === undefined ? {} : { teamId: command.teamId };
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}
