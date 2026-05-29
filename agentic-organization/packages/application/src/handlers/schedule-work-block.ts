import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  DiscussionAnchorType,
  HatAssignmentAuthorityState,
  ScheduleBlockState,
  createAgenticEventEnvelope,
  isScheduleBlockType,
  type DiscussionAnchor,
  type WorkScheduleBlock,
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
  CommandWorkAnchorWorkItem,
  DiscussionAnchorStateReaderPort,
  HatAssignmentAuthorityReaderPort,
  IdGenerator,
  WorkAnchorStateReaderPort,
} from "../ports.ts";

export const ScheduleWorkBlockIdPrefix = {
  Audit: "audit",
  Event: "evt",
  Outbox: "outbox",
  WorkScheduleBlock: "work-schedule-block",
} as const;

export type ScheduleWorkBlockIdPrefix =
  (typeof ScheduleWorkBlockIdPrefix)[keyof typeof ScheduleWorkBlockIdPrefix];

export const ScheduleWorkBlockValidationErrorMessage = {
  AssignedAgentRequired: "schedule block assigned agent is required",
  AssignedHatRequired: "schedule block assigned hat assignment is required",
  AssignedHatAgentMismatch: "schedule block assigned agent does not match hat assignment",
  AssignedHatInactive: "schedule block assigned hat assignment is not active",
  AssignedHatMissing: "schedule block assigned hat assignment is missing",
  AssignedHatReaderMissing: "schedule block requires hat assignment authority validation",
  AssignedHatScopeMismatch: "schedule block assigned hat assignment scope does not match the command scope",
  BlockTypeInvalid: "schedule block type is invalid",
  DiscussionAnchorMissing: "schedule block discussion anchor is missing",
  DiscussionAnchorReaderMissing: "schedule block discussion anchor validation is required",
  DiscussionAnchorScopeMismatch: "schedule block discussion anchor scope does not match the command scope",
  EndBeforeStart: "schedule block end time must be after start time",
  EndTimeInvalid: "schedule block end time is invalid",
  PurposeRequired: "schedule block purpose is required",
  StartTimeInvalid: "schedule block start time is invalid",
  TitleRequired: "schedule block title is required",
  UnsupportedDiscussionAnchorType: "schedule block V0 only supports work-item discussion anchors",
  WorkItemMissing: "schedule block work item is missing",
  WorkItemReaderMissing: "schedule block requires work item validation",
  WorkItemScopeMismatch: "schedule block work item scope does not match the command scope",
} as const;

export type ScheduleWorkBlockValidationErrorMessage =
  (typeof ScheduleWorkBlockValidationErrorMessage)[keyof typeof ScheduleWorkBlockValidationErrorMessage];

export type ScheduleWorkBlockCommand = PipelineCommand & {
  type: typeof CommandType.ScheduleWorkBlock;
  teamId?: string;
  workItemId: string;
  discussionAnchorId?: string;
  assignedAgentId: string;
  assignedHatAssignmentId: string;
  blockType: WorkScheduleBlock["blockType"];
  title: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
};

export type ScheduleWorkBlockDependencies = Clock &
  IdGenerator & {
    discussionAnchorStateReader?: DiscussionAnchorStateReaderPort | undefined;
    hatAssignmentAuthorityReader?: HatAssignmentAuthorityReaderPort | undefined;
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

export function createScheduleWorkBlockHandler(): CommandHandler<ScheduleWorkBlockCommand, CommandResult> {
  return {
    commandType: CommandType.ScheduleWorkBlock,
    execute: scheduleWorkBlock,
  };
}

export async function scheduleWorkBlock(
  command: ScheduleWorkBlockCommand,
  dependencies: ScheduleWorkBlockDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const validationError = validateScheduleWorkBlockCommand(command);

  if (validationError !== undefined) {
    return createRejectedValidationOutcome(command, validationError);
  }

  const workItemValidation = await validateWorkItem(command, dependencies);

  if (workItemValidation.status === ScheduleValidationStatus.Rejected) {
    return createRejectedPreconditionOutcome(command, workItemValidation.message);
  }

  const hatAssignmentValidation = await validateHatAssignmentAuthority(command, dependencies);

  if (hatAssignmentValidation.status === ScheduleValidationStatus.Rejected) {
    return createRejectedPreconditionOutcome(command, hatAssignmentValidation.message);
  }

  const discussionAnchorValidation = await validateDiscussionAnchor(command, dependencies);

  if (discussionAnchorValidation.status === ScheduleValidationStatus.Rejected) {
    return createRejectedPreconditionOutcome(command, discussionAnchorValidation.message);
  }

  const occurredAt = dependencies.now();
  const workScheduleBlock = createWorkScheduleBlock(
    command,
    dependencies.createId(ScheduleWorkBlockIdPrefix.WorkScheduleBlock),
    occurredAt,
  );
  const auditEventId = dependencies.createId(ScheduleWorkBlockIdPrefix.Audit);
  const envelope = createAgenticEventEnvelope({
    eventId: dependencies.createId(ScheduleWorkBlockIdPrefix.Event),
    eventType: AgenticEventType.WorkScheduleBlockScheduled,
    occurredAt,
    actor: command.actor,
    scope: {
      organizationId: command.organizationId,
      projectId: command.projectId,
      ...createOptionalTeamScope(command),
      workItemId: command.workItemId,
    },
    aggregate: {
      aggregateId: workScheduleBlock.workScheduleBlockId,
      aggregateType: AgenticAggregateType.WorkScheduleBlock,
      aggregateVersion: workScheduleBlock.metadata.version,
    },
    trace: {
      commandId: command.commandId,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
      idempotencyKey: command.idempotencyKey,
    },
    payload: {
      workScheduleBlockId: workScheduleBlock.workScheduleBlockId,
      assignedAgentId: command.assignedAgentId,
      assignedHatAssignmentId: command.assignedHatAssignmentId,
      blockType: command.blockType,
      state: ScheduleBlockState.Scheduled,
      title: command.title,
      purpose: command.purpose,
      startsAt: command.startsAt,
      endsAt: command.endsAt,
      ...createOptionalDiscussionAnchorPayload(command),
    },
  });

  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Accepted,
      artifacts: [
        {
          artifactType: CommandResultArtifactType.WorkScheduleBlock,
          artifactId: workScheduleBlock.workScheduleBlockId,
          label: workScheduleBlock.title,
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
      workScheduleBlock,
      idempotency: {
        replayed: false,
      },
    },
    effects: {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
      qualityGateEvaluations: [],
      workScheduleBlocks: [workScheduleBlock],
      auditEvents: [
        {
          auditEventId,
          eventName: AgenticEventType.WorkScheduleBlockScheduled,
          aggregateId: workScheduleBlock.workScheduleBlockId,
          actor: command.actor,
          occurredAt,
        },
      ],
      outboxEvents: [
        {
          outboxEventId: dependencies.createId(ScheduleWorkBlockIdPrefix.Outbox),
          envelope,
        },
      ],
      workAnchors: createEmptyWorkAnchorCommandEffects(),
    },
  };
}

const ScheduleValidationStatus = {
  Accepted: "accepted",
  Rejected: "rejected",
} as const;

type ScheduleValidationStatus = (typeof ScheduleValidationStatus)[keyof typeof ScheduleValidationStatus];

type ScheduleValidationResult =
  | {
      status: typeof ScheduleValidationStatus.Accepted;
    }
  | {
      status: typeof ScheduleValidationStatus.Rejected;
      message: ScheduleWorkBlockValidationErrorMessage;
    };

async function validateWorkItem(
  command: ScheduleWorkBlockCommand,
  dependencies: ScheduleWorkBlockDependencies,
): Promise<ScheduleValidationResult> {
  if (dependencies.workAnchorStateReader === undefined) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.WorkItemReaderMissing);
  }

  const workItem = await dependencies.workAnchorStateReader.findWorkItem(command.workItemId);

  if (workItem === undefined) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.WorkItemMissing);
  }

  if (!hasMatchingWorkItemScope(command, workItem)) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.WorkItemScopeMismatch);
  }

  return {
    status: ScheduleValidationStatus.Accepted,
  };
}

async function validateDiscussionAnchor(
  command: ScheduleWorkBlockCommand,
  dependencies: ScheduleWorkBlockDependencies,
): Promise<ScheduleValidationResult> {
  if (command.discussionAnchorId === undefined) {
    return {
      status: ScheduleValidationStatus.Accepted,
    };
  }

  if (dependencies.discussionAnchorStateReader === undefined) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.DiscussionAnchorReaderMissing);
  }

  const discussionAnchor = await dependencies.discussionAnchorStateReader.findDiscussionAnchor(
    command.discussionAnchorId,
  );

  if (discussionAnchor === undefined) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.DiscussionAnchorMissing);
  }

  if (!hasMatchingDiscussionAnchorScope(command, discussionAnchor)) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.DiscussionAnchorScopeMismatch);
  }

  if (discussionAnchor.discussionAnchorType !== DiscussionAnchorType.WorkItem) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.UnsupportedDiscussionAnchorType);
  }

  return {
    status: ScheduleValidationStatus.Accepted,
  };
}

async function validateHatAssignmentAuthority(
  command: ScheduleWorkBlockCommand,
  dependencies: ScheduleWorkBlockDependencies,
): Promise<ScheduleValidationResult> {
  if (dependencies.hatAssignmentAuthorityReader === undefined) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.AssignedHatReaderMissing);
  }

  const authority = await dependencies.hatAssignmentAuthorityReader.findHatAssignmentAuthority(
    command.assignedHatAssignmentId,
  );

  if (authority === undefined) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.AssignedHatMissing);
  }

  if (authority.state !== HatAssignmentAuthorityState.Active) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.AssignedHatInactive);
  }

  if (authority.assignedAgentId !== command.assignedAgentId) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.AssignedHatAgentMismatch);
  }

  if (!hasMatchingHatAssignmentScope(command, authority)) {
    return createRejectedScheduleValidation(ScheduleWorkBlockValidationErrorMessage.AssignedHatScopeMismatch);
  }

  return {
    status: ScheduleValidationStatus.Accepted,
  };
}

function validateScheduleWorkBlockCommand(
  command: ScheduleWorkBlockCommand,
): ScheduleWorkBlockValidationErrorMessage | undefined {
  if (isBlank(command.assignedAgentId)) {
    return ScheduleWorkBlockValidationErrorMessage.AssignedAgentRequired;
  }

  if (isBlank(command.assignedHatAssignmentId)) {
    return ScheduleWorkBlockValidationErrorMessage.AssignedHatRequired;
  }

  if (!isScheduleBlockType(command.blockType)) {
    return ScheduleWorkBlockValidationErrorMessage.BlockTypeInvalid;
  }

  if (isBlank(command.title)) {
    return ScheduleWorkBlockValidationErrorMessage.TitleRequired;
  }

  if (isBlank(command.purpose)) {
    return ScheduleWorkBlockValidationErrorMessage.PurposeRequired;
  }

  if (!isValidInstant(command.startsAt)) {
    return ScheduleWorkBlockValidationErrorMessage.StartTimeInvalid;
  }

  if (!isValidInstant(command.endsAt)) {
    return ScheduleWorkBlockValidationErrorMessage.EndTimeInvalid;
  }

  if (Date.parse(command.endsAt) <= Date.parse(command.startsAt)) {
    return ScheduleWorkBlockValidationErrorMessage.EndBeforeStart;
  }

  return undefined;
}

function createWorkScheduleBlock(
  command: ScheduleWorkBlockCommand,
  workScheduleBlockId: string,
  occurredAt: string,
): WorkScheduleBlock {
  return {
    workScheduleBlockId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...createOptionalTeamScope(command),
    workItemId: command.workItemId,
    ...createOptionalDiscussionAnchorPayload(command),
    assignedAgentId: command.assignedAgentId,
    assignedHatAssignmentId: command.assignedHatAssignmentId,
    blockType: command.blockType,
    state: ScheduleBlockState.Scheduled,
    title: command.title,
    purpose: command.purpose,
    startsAt: command.startsAt,
    endsAt: command.endsAt,
    scheduledAt: occurredAt,
    scheduledBy: command.actor,
    metadata: {
      updatedAt: occurredAt,
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}

function createRejectedScheduleValidation(message: ScheduleWorkBlockValidationErrorMessage): ScheduleValidationResult {
  return {
    status: ScheduleValidationStatus.Rejected,
    message,
  };
}

function createRejectedValidationOutcome(
  command: ScheduleWorkBlockCommand,
  message: ScheduleWorkBlockValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.ValidationFailed, message);
}

function createRejectedPreconditionOutcome(
  command: ScheduleWorkBlockCommand,
  message: ScheduleWorkBlockValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.PreconditionFailed, message);
}

function createRejectedOutcome(
  command: ScheduleWorkBlockCommand,
  code: CommandErrorCode,
  message: ScheduleWorkBlockValidationErrorMessage,
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

function hasMatchingWorkItemScope(command: ScheduleWorkBlockCommand, workItem: CommandWorkAnchorWorkItem): boolean {
  return (
    workItem.workItemId === command.workItemId &&
    workItem.organizationId === command.organizationId &&
    workItem.projectId === command.projectId
  );
}

function hasMatchingDiscussionAnchorScope(
  command: ScheduleWorkBlockCommand,
  discussionAnchor: DiscussionAnchor,
): boolean {
  return (
    discussionAnchor.discussionAnchorId === command.discussionAnchorId &&
    discussionAnchor.organizationId === command.organizationId &&
    discussionAnchor.projectId === command.projectId &&
    discussionAnchor.workItemId === command.workItemId &&
    discussionAnchor.teamId === command.teamId
  );
}

function hasMatchingHatAssignmentScope(
  command: ScheduleWorkBlockCommand,
  authority: Awaited<ReturnType<HatAssignmentAuthorityReaderPort["findHatAssignmentAuthority"]>>,
): boolean {
  return (
    authority !== undefined &&
    authority.hatAssignmentId === command.assignedHatAssignmentId &&
    authority.organizationId === command.organizationId &&
    authority.projectId === command.projectId &&
    authority.teamId === command.teamId
  );
}

function createOptionalTeamScope(command: Pick<ScheduleWorkBlockCommand, "teamId">): { teamId?: string } {
  return command.teamId === undefined ? {} : { teamId: command.teamId };
}

function createOptionalDiscussionAnchorPayload(
  command: Pick<ScheduleWorkBlockCommand, "discussionAnchorId">,
): { discussionAnchorId?: string } {
  return command.discussionAnchorId === undefined ? {} : { discussionAnchorId: command.discussionAnchorId };
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function isValidInstant(value: unknown): value is string {
  if (typeof value !== "string" || isBlank(value)) {
    return false;
  }

  return StrictIsoInstantPattern.test(value) && !Number.isNaN(Date.parse(value));
}

const StrictIsoInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
