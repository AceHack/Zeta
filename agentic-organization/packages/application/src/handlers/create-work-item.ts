import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  createAgenticEventEnvelope,
  createInitialWorkItemState,
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
import type { Clock, CommandEffects, CommandWorkAnchorWorkItem, IdGenerator } from "../ports.ts";

export const CreateWorkItemIdPrefix = {
  Audit: "audit",
  Event: "evt",
  Outbox: "outbox",
  WorkItem: "work-item",
} as const;

export type CreateWorkItemCommand = PipelineCommand & {
  type: typeof CommandType.CreateWorkItem;
  initiativeId?: string | undefined;
  workItemType: WorkItemType;
  title: string;
  description: string;
};

export type CreateWorkItemDependencies = Clock & IdGenerator;

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
  if (isBlank(command.title)) {
    return createRejectedOutcome(command, CommandErrorCode.ValidationFailed, "work item title is required");
  }

  if (isBlank(command.description)) {
    return createRejectedOutcome(command, CommandErrorCode.ValidationFailed, "work item description is required");
  }

  const occurredAt = dependencies.now();
  const workItem = createCommandWorkItem(command, dependencies.createId(CreateWorkItemIdPrefix.WorkItem), occurredAt);
  const auditEventId = dependencies.createId(CreateWorkItemIdPrefix.Audit);
  const outboxEventId = dependencies.createId(CreateWorkItemIdPrefix.Outbox);
  const envelope = createAgenticEventEnvelope({
    eventId: dependencies.createId(CreateWorkItemIdPrefix.Event),
    eventType: AgenticEventType.WorkItemChanged,
    occurredAt,
    actor: command.actor,
    scope: {
      organizationId: command.organizationId,
      projectId: command.projectId,
      workItemId: workItem.workItemId,
      ...createOptionalInitiativeScope(command),
    },
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

function createCommandWorkItem(
  command: CreateWorkItemCommand,
  workItemId: string,
  occurredAt: string,
): CommandWorkAnchorWorkItem {
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

function createRejectedOutcome(
  command: CreateWorkItemCommand,
  code: typeof CommandErrorCode.ValidationFailed | typeof CommandErrorCode.PreconditionFailed,
  message: string,
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

function createOptionalInitiativeScope(command: Pick<CreateWorkItemCommand, "initiativeId">): {
  initiativeId?: string;
} {
  return command.initiativeId === undefined ? {} : { initiativeId: command.initiativeId };
}

function createEmptyCommandEffects(): CommandEffects {
  return {
    supervisorSignals: [],
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

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}
