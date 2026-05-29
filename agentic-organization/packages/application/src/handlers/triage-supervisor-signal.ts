import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  EventSchemaVersion,
  SupervisorTriageActionType,
  createAgenticEventEnvelope,
  createInitialWorkItemState,
  type SupervisorSignal,
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
import type {
  Clock,
  CommandEffects,
  CommandWorkAnchorProject,
  IdGenerator,
  SupervisorSignalStateReaderPort,
  WorkAnchorStateReaderPort,
} from "../ports.ts";

export const TriageSupervisorSignalIdPrefix = {
  Audit: "audit",
  Event: "evt",
  Outbox: "outbox",
  WorkItem: "work-item",
} as const;

export type TriageSupervisorSignalIdPrefix =
  (typeof TriageSupervisorSignalIdPrefix)[keyof typeof TriageSupervisorSignalIdPrefix];

export const SupervisorSignalTriageValidationErrorMessage = {
  FollowUpDescriptionRequired: "supervisor signal triage follow-up description is required",
  FollowUpTitleRequired: "supervisor signal triage follow-up title is required",
  MissingProject: "supervisor signal triage project does not exist",
  MissingSupervisorSignal: "supervisor signal triage requires an existing supervisor signal",
  MissingSupervisorSignalReader: "supervisor signal triage requires supervisor signal validation",
  ProjectScopeMismatch: "supervisor signal triage project scope does not match the command scope",
  SignalScopeMismatch: "supervisor signal scope does not match the command scope",
  TargetSupervisorRequired: "supervisor signal triage must be performed by the target supervisor hat",
  UnsupportedActionType: "supervisor signal triage action type is unsupported",
} as const;

export type SupervisorSignalTriageValidationErrorMessage =
  (typeof SupervisorSignalTriageValidationErrorMessage)[keyof typeof SupervisorSignalTriageValidationErrorMessage];

export type TriageSupervisorSignalCommand = PipelineCommand & {
  type: typeof CommandType.TriageSupervisorSignal;
  teamId: string;
  workItemId: string;
  supervisorSignalId: string;
  actionType: typeof SupervisorTriageActionType.OpenWorkItem;
  followUpWorkItemType: WorkItemType;
  followUpTitle: string;
  followUpDescription: string;
};

export type TriageSupervisorSignalDependencies = Clock &
  IdGenerator & {
    supervisorSignalStateReader?: SupervisorSignalStateReaderPort | undefined;
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

export function createTriageSupervisorSignalHandler(): CommandHandler<TriageSupervisorSignalCommand, CommandResult> {
  return {
    commandType: CommandType.TriageSupervisorSignal,
    execute: triageSupervisorSignal,
  };
}

export async function triageSupervisorSignal(
  command: TriageSupervisorSignalCommand,
  dependencies: TriageSupervisorSignalDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const commandValidationError = validateTriageCommand(command);

  if (commandValidationError !== undefined) {
    return createRejectedOutcome(command, CommandErrorCode.ValidationFailed, commandValidationError);
  }

  const supervisorSignalValidation = await validateSupervisorSignal(command, dependencies);

  if (supervisorSignalValidation.status === SupervisorSignalTriageValidationStatus.Invalid) {
    return createRejectedOutcome(command, CommandErrorCode.PreconditionFailed, supervisorSignalValidation.message);
  }

  const projectValidationError = await validateProject(command, dependencies);

  if (projectValidationError !== undefined) {
    return createRejectedOutcome(command, CommandErrorCode.PreconditionFailed, projectValidationError);
  }

  const occurredAt = dependencies.now();
  const workItem = createFollowUpWorkItem(command, dependencies.createId(TriageSupervisorSignalIdPrefix.WorkItem), occurredAt);
  const auditEventId = dependencies.createId(TriageSupervisorSignalIdPrefix.Audit);
  const envelope = createAgenticEventEnvelope({
    eventId: dependencies.createId(TriageSupervisorSignalIdPrefix.Event),
    eventType: AgenticEventType.WorkItemChanged,
    schemaVersion: EventSchemaVersion.AgenticOrgEventV1,
    occurredAt,
    actor: command.actor,
    scope: {
      organizationId: command.organizationId,
      projectId: command.projectId,
      teamId: supervisorSignalValidation.supervisorSignal.teamId,
      workItemId: workItem.workItemId,
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
      triagedSupervisorSignalId: command.supervisorSignalId,
      triageActionType: command.actionType,
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
          outboxEventId: dependencies.createId(TriageSupervisorSignalIdPrefix.Outbox),
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

const SupervisorSignalTriageValidationStatus = {
  Invalid: "invalid",
  Valid: "valid",
} as const;

type SupervisorSignalTriageValidationResult =
  | {
      status: typeof SupervisorSignalTriageValidationStatus.Valid;
      supervisorSignal: SupervisorSignal;
    }
  | {
      status: typeof SupervisorSignalTriageValidationStatus.Invalid;
      message: SupervisorSignalTriageValidationErrorMessage;
    };

async function validateSupervisorSignal(
  command: TriageSupervisorSignalCommand,
  dependencies: TriageSupervisorSignalDependencies,
): Promise<SupervisorSignalTriageValidationResult> {
  if (dependencies.supervisorSignalStateReader === undefined) {
    return {
      status: SupervisorSignalTriageValidationStatus.Invalid,
      message: SupervisorSignalTriageValidationErrorMessage.MissingSupervisorSignalReader,
    };
  }

  const supervisorSignal = await dependencies.supervisorSignalStateReader.findSupervisorSignal(command.supervisorSignalId);

  if (supervisorSignal === undefined) {
    return {
      status: SupervisorSignalTriageValidationStatus.Invalid,
      message: SupervisorSignalTriageValidationErrorMessage.MissingSupervisorSignal,
    };
  }

  if (!hasMatchingSignalScope(command, supervisorSignal)) {
    return {
      status: SupervisorSignalTriageValidationStatus.Invalid,
      message: SupervisorSignalTriageValidationErrorMessage.SignalScopeMismatch,
    };
  }

  if (supervisorSignal.targetHatAssignmentId !== command.actor.hatAssignmentId) {
    return {
      status: SupervisorSignalTriageValidationStatus.Invalid,
      message: SupervisorSignalTriageValidationErrorMessage.TargetSupervisorRequired,
    };
  }

  return {
    status: SupervisorSignalTriageValidationStatus.Valid,
    supervisorSignal,
  };
}

async function validateProject(
  command: TriageSupervisorSignalCommand,
  dependencies: TriageSupervisorSignalDependencies,
): Promise<SupervisorSignalTriageValidationErrorMessage | undefined> {
  if (dependencies.workAnchorStateReader === undefined) {
    return undefined;
  }

  const project = await dependencies.workAnchorStateReader.findProject(command.projectId);

  if (project === undefined) {
    return SupervisorSignalTriageValidationErrorMessage.MissingProject;
  }

  if (!hasMatchingProjectScope(command, project)) {
    return SupervisorSignalTriageValidationErrorMessage.ProjectScopeMismatch;
  }

  return undefined;
}

function validateTriageCommand(
  command: TriageSupervisorSignalCommand,
): SupervisorSignalTriageValidationErrorMessage | undefined {
  if (command.actionType !== SupervisorTriageActionType.OpenWorkItem) {
    return SupervisorSignalTriageValidationErrorMessage.UnsupportedActionType;
  }

  if (isBlank(command.followUpTitle)) {
    return SupervisorSignalTriageValidationErrorMessage.FollowUpTitleRequired;
  }

  if (isBlank(command.followUpDescription)) {
    return SupervisorSignalTriageValidationErrorMessage.FollowUpDescriptionRequired;
  }

  return undefined;
}

function createFollowUpWorkItem(
  command: TriageSupervisorSignalCommand,
  workItemId: string,
  occurredAt: string,
): WorkItem & {
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
    workItemType: command.followUpWorkItemType,
    title: command.followUpTitle,
    description: command.followUpDescription,
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

function hasMatchingSignalScope(command: TriageSupervisorSignalCommand, signal: SupervisorSignal): boolean {
  return (
    signal.organizationId === command.organizationId &&
    signal.projectId === command.projectId &&
    signal.teamId === command.teamId &&
    signal.relatedWorkItemId === command.workItemId
  );
}

function hasMatchingProjectScope(command: TriageSupervisorSignalCommand, project: CommandWorkAnchorProject): boolean {
  return project.organizationId === command.organizationId && project.projectId === command.projectId;
}

function createRejectedOutcome(
  command: TriageSupervisorSignalCommand,
  code: CommandErrorCode,
  message: SupervisorSignalTriageValidationErrorMessage,
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
