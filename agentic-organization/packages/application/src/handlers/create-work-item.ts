import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  EventSchemaVersion,
  createAgenticEventEnvelope,
  createInitialWorkItemState,
  type WorkItem,
  type WorkItemType,
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
import type { CommandWorkAnchorInitiative, CommandWorkAnchorProject, WorkAnchorStateReaderPort } from "../ports.ts";

export const CreateWorkItemIdPrefix = {
  Audit: "audit",
  Event: "evt",
  Outbox: "outbox",
  WorkItem: "work-item",
} as const;

export type CreateWorkItemIdPrefix = (typeof CreateWorkItemIdPrefix)[keyof typeof CreateWorkItemIdPrefix];

export const CreateWorkItemValidationErrorMessage = {
  DescriptionRequired: "work item description is required",
  InitiativeScopeMismatch: "work item initiative scope does not match the command scope",
  MissingInitiative: "work item initiative does not exist",
  MissingProject: "work item project does not exist",
  ProjectScopeMismatch: "work item project scope does not match the command scope",
  TitleRequired: "work item title is required",
} as const;

export type CreateWorkItemValidationErrorMessage =
  (typeof CreateWorkItemValidationErrorMessage)[keyof typeof CreateWorkItemValidationErrorMessage];

export type CreateWorkItemCommand = PipelineCommand & {
  type: typeof CommandType.CreateWorkItem;
  initiativeId?: string;
  workItemType: WorkItemType;
  title: string;
  description: string;
};

export type CreateWorkItemDependencies = Clock &
  IdGenerator & {
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

export function createCreateWorkItemHandler(): CommandHandler<CreateWorkItemCommand, CommandResult> {
  return {
    commandType: CommandType.CreateWorkItem,
    execute: createWorkItem,
  };
}

export async function createWorkItem(
  command: CreateWorkItemCommand,
  dependencies: CreateWorkItemDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const validationError = validateCreateWorkItemCommand(command);

  if (validationError !== undefined) {
    return createRejectedValidationOutcome(command, validationError);
  }

  const referenceValidationError = await validateWorkAnchorReferences(command, dependencies);

  if (referenceValidationError !== undefined) {
    return createRejectedPreconditionOutcome(command, referenceValidationError);
  }

  const occurredAt = dependencies.now();
  const workItem = createCommandWorkItem(command, dependencies.createId(CreateWorkItemIdPrefix.WorkItem), occurredAt);
  const auditEventId = dependencies.createId(CreateWorkItemIdPrefix.Audit);
  const outboxEventId = dependencies.createId(CreateWorkItemIdPrefix.Outbox);
  const envelope = createAgenticEventEnvelope({
    eventId: dependencies.createId(CreateWorkItemIdPrefix.Event),
    eventType: AgenticEventType.WorkItemChanged,
    schemaVersion: EventSchemaVersion.AgenticOrgEventV1,
    occurredAt,
    scope: {
      organizationId: command.organizationId,
      projectId: command.projectId,
      workItemId: workItem.workItemId,
      ...createOptionalInitiativeScope(command),
    },
    actor: command.actor,
    aggregate: {
      aggregateId: workItem.workItemId,
      aggregateType: AgenticAggregateType.WorkItem,
      aggregateVersion: workItem.metadata.version,
    },
    trace: {
      commandId: command.commandId,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
      idempotencyKey: command.idempotencyKey,
    },
    replay: {
      isReplay: false,
    },
    payload: {
      state: workItem.state,
      title: workItem.title,
      workItemType: workItem.workItemType,
    },
  });

  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Accepted,
      artifacts: [
        {
          artifactType: CommandResultArtifactType.WorkItem,
          artifactId: workItem.workItemId,
          label: workItem.title,
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
      workItem,
      idempotency: {
        replayed: false,
      },
    },
    effects: {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
      workScheduleBlocks: [],
      auditEvents: [
        {
          auditEventId,
          eventName: AgenticEventType.WorkItemChanged,
          aggregateId: workItem.workItemId,
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
      workAnchors: {
        projects: [],
        initiatives: [],
        workItems: [workItem],
        workAnchorTargets: [],
        workItemTransitions: [],
      },
    },
  };
}

async function validateWorkAnchorReferences(
  command: CreateWorkItemCommand,
  dependencies: CreateWorkItemDependencies,
): Promise<CreateWorkItemValidationErrorMessage | undefined> {
  if (dependencies.workAnchorStateReader === undefined) {
    return undefined;
  }

  const project = await dependencies.workAnchorStateReader.findProject(command.projectId);

  if (project === undefined) {
    return CreateWorkItemValidationErrorMessage.MissingProject;
  }

  if (!hasMatchingProjectScope(command, project)) {
    return CreateWorkItemValidationErrorMessage.ProjectScopeMismatch;
  }

  if (command.initiativeId === undefined) {
    return undefined;
  }

  const initiative = await dependencies.workAnchorStateReader.findInitiative(command.initiativeId);

  if (initiative === undefined) {
    return CreateWorkItemValidationErrorMessage.MissingInitiative;
  }

  if (!hasMatchingInitiativeScope(command, initiative)) {
    return CreateWorkItemValidationErrorMessage.InitiativeScopeMismatch;
  }

  return undefined;
}

function hasMatchingProjectScope(command: CreateWorkItemCommand, project: CommandWorkAnchorProject): boolean {
  return project.organizationId === command.organizationId && project.projectId === command.projectId;
}

function hasMatchingInitiativeScope(command: CreateWorkItemCommand, initiative: CommandWorkAnchorInitiative): boolean {
  return (
    initiative.organizationId === command.organizationId &&
    initiative.projectId === command.projectId &&
    initiative.initiativeId === command.initiativeId
  );
}

function validateCreateWorkItemCommand(command: CreateWorkItemCommand): CreateWorkItemValidationErrorMessage | undefined {
  if (isBlank(command.title)) {
    return CreateWorkItemValidationErrorMessage.TitleRequired;
  }

  if (isBlank(command.description)) {
    return CreateWorkItemValidationErrorMessage.DescriptionRequired;
  }

  return undefined;
}

function createCommandWorkItem(command: CreateWorkItemCommand, workItemId: string, occurredAt: string): WorkItem & {
  metadata: {
    updatedAt: string;
    version: number;
    correlationId: string;
    causationId: string;
    traceId: string;
  };
} {
  return {
    workItemId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...createOptionalInitiativeScope(command),
    workItemType: command.workItemType,
    title: command.title,
    description: command.description,
    state: createInitialWorkItemState(),
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

function createOptionalInitiativeScope(command: Pick<CreateWorkItemCommand, "initiativeId">): {
  initiativeId?: string;
} {
  return command.initiativeId === undefined ? {} : { initiativeId: command.initiativeId };
}

function createRejectedPreconditionOutcome(
  command: CreateWorkItemCommand,
  message: CreateWorkItemValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Rejected,
      idempotency: {
        replayed: false,
      },
      error: {
        code: CommandErrorCode.PreconditionFailed,
        message,
      },
    },
    effects: createEmptyCommandEffects(),
  };
}

function createRejectedValidationOutcome(
  command: CreateWorkItemCommand,
  message: CreateWorkItemValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Rejected,
      idempotency: {
        replayed: false,
      },
      error: {
        code: CommandErrorCode.ValidationFailed,
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
    workScheduleBlocks: [],
    auditEvents: [],
    outboxEvents: [],
    workAnchors: {
      projects: [],
      initiatives: [],
      workItems: [],
      workAnchorTargets: [],
      workItemTransitions: [],
    },
  };
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}
