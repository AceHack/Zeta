import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  createAgenticEventEnvelope,
  type DecisionRecord,
  type DiscussionAnchor,
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
  IdGenerator,
  WorkAnchorStateReaderPort,
} from "../ports.ts";

export const RecordDecisionIdPrefix = {
  Audit: "audit",
  DecisionRecord: "decision-record",
  Event: "evt",
  Outbox: "outbox",
} as const;

export type RecordDecisionIdPrefix = (typeof RecordDecisionIdPrefix)[keyof typeof RecordDecisionIdPrefix];

export const RecordDecisionValidationErrorMessage = {
  AnchorScopeMismatch: "decision discussion anchor scope does not match the command scope",
  AnchorWithoutDecisionOutput: "decision requires a discussion anchor expecting a decision output",
  AlternativesInvalid: "decision alternatives must be string arrays",
  DecisionRequired: "decision content is required",
  FollowUpWorkInvalid: "decision follow-up work item IDs must be string arrays",
  FollowUpWorkMissing: "decision follow-up work item is missing",
  FollowUpWorkScopeMismatch: "decision follow-up work item scope does not match the command scope",
  MissingFollowUpWorkReader: "decision follow-up work requires work anchor validation",
  MissingAnchor: "decision requires an existing discussion anchor",
  MissingAnchorReader: "decision requires discussion anchor validation",
  RationaleRequired: "decision rationale is required",
  TitleRequired: "decision title is required",
  UnsupportedAnchorType: "decision V0 only supports work-item discussion anchors",
} as const;

export type RecordDecisionValidationErrorMessage =
  (typeof RecordDecisionValidationErrorMessage)[keyof typeof RecordDecisionValidationErrorMessage];

export type RecordDecisionCommand = PipelineCommand & {
  type: typeof CommandType.RecordDecision;
  teamId?: string;
  workItemId: string;
  discussionAnchorId: string;
  title: string;
  decision: string;
  rationale: string;
  alternativesConsidered?: readonly string[] | undefined;
  followUpWorkItemIds?: readonly string[] | undefined;
};

export type RecordDecisionDependencies = Clock &
  IdGenerator & {
    discussionAnchorStateReader?: DiscussionAnchorStateReaderPort | undefined;
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

export function createRecordDecisionHandler(): CommandHandler<RecordDecisionCommand, CommandResult> {
  return {
    commandType: CommandType.RecordDecision,
    execute: recordDecision,
  };
}

export async function recordDecision(
  command: RecordDecisionCommand,
  dependencies: RecordDecisionDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const validationError = validateRecordDecisionCommand(command);

  if (validationError !== undefined) {
    return createRejectedValidationOutcome(command, validationError);
  }

  const discussionAnchorValidation = await validateDiscussionAnchor(command, dependencies);

  if (discussionAnchorValidation.status === DiscussionAnchorValidationStatus.Rejected) {
    return createRejectedPreconditionOutcome(command, discussionAnchorValidation.message);
  }

  const followUpWorkValidation = await validateFollowUpWork(command, dependencies);

  if (followUpWorkValidation.status === FollowUpWorkValidationStatus.Rejected) {
    return createRejectedPreconditionOutcome(command, followUpWorkValidation.message);
  }

  const occurredAt = dependencies.now();
  const decisionRecord = createDecisionRecord(
    command,
    dependencies.createId(RecordDecisionIdPrefix.DecisionRecord),
    occurredAt,
  );
  const auditEventId = dependencies.createId(RecordDecisionIdPrefix.Audit);
  const envelope = createAgenticEventEnvelope({
    eventId: dependencies.createId(RecordDecisionIdPrefix.Event),
    eventType: AgenticEventType.DecisionRecorded,
    occurredAt,
    actor: command.actor,
    scope: {
      organizationId: command.organizationId,
      projectId: command.projectId,
      ...createOptionalTeamScope(command),
      workItemId: command.workItemId,
    },
    aggregate: {
      aggregateId: decisionRecord.decisionRecordId,
      aggregateType: AgenticAggregateType.DecisionRecord,
      aggregateVersion: decisionRecord.metadata.version,
    },
    trace: {
      commandId: command.commandId,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
      idempotencyKey: command.idempotencyKey,
    },
    payload: {
      discussionAnchorId: command.discussionAnchorId,
      title: command.title,
      decision: command.decision,
      rationale: command.rationale,
      alternativesConsidered: createOptionalStringList(command.alternativesConsidered),
      followUpWorkItemIds: createOptionalStringList(command.followUpWorkItemIds),
    },
  });

  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Accepted,
      artifacts: [
        {
          artifactType: CommandResultArtifactType.DecisionRecord,
          artifactId: decisionRecord.decisionRecordId,
          label: decisionRecord.title,
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
      decisionRecord,
      idempotency: {
        replayed: false,
      },
    },
    effects: {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [decisionRecord],
      qualityGateEvaluations: [],
      workScheduleBlocks: [],
      auditEvents: [
        {
          auditEventId,
          eventName: AgenticEventType.DecisionRecorded,
          aggregateId: decisionRecord.decisionRecordId,
          actor: command.actor,
          occurredAt,
        },
      ],
      outboxEvents: [
        {
          outboxEventId: dependencies.createId(RecordDecisionIdPrefix.Outbox),
          envelope,
        },
      ],
      workAnchors: createEmptyWorkAnchorCommandEffects(),
    },
  };
}

const FollowUpWorkValidationStatus = {
  Accepted: "accepted",
  Rejected: "rejected",
} as const;

type FollowUpWorkValidationStatus =
  (typeof FollowUpWorkValidationStatus)[keyof typeof FollowUpWorkValidationStatus];

type FollowUpWorkValidationResult =
  | {
      status: typeof FollowUpWorkValidationStatus.Accepted;
    }
  | {
      status: typeof FollowUpWorkValidationStatus.Rejected;
      message: RecordDecisionValidationErrorMessage;
    };

const DiscussionAnchorValidationStatus = {
  Accepted: "accepted",
  Rejected: "rejected",
} as const;

type DiscussionAnchorValidationStatus =
  (typeof DiscussionAnchorValidationStatus)[keyof typeof DiscussionAnchorValidationStatus];

type DiscussionAnchorValidationResult =
  | {
      status: typeof DiscussionAnchorValidationStatus.Accepted;
    }
  | {
      status: typeof DiscussionAnchorValidationStatus.Rejected;
      message: RecordDecisionValidationErrorMessage;
    };

async function validateDiscussionAnchor(
  command: RecordDecisionCommand,
  dependencies: RecordDecisionDependencies,
): Promise<DiscussionAnchorValidationResult> {
  if (dependencies.discussionAnchorStateReader === undefined) {
    return createDiscussionAnchorRejectedResult(RecordDecisionValidationErrorMessage.MissingAnchorReader);
  }

  const discussionAnchor = await dependencies.discussionAnchorStateReader.findDiscussionAnchor(
    command.discussionAnchorId,
  );

  if (discussionAnchor === undefined) {
    return createDiscussionAnchorRejectedResult(RecordDecisionValidationErrorMessage.MissingAnchor);
  }

  if (!hasMatchingCommandScope(command, discussionAnchor)) {
    return createDiscussionAnchorRejectedResult(RecordDecisionValidationErrorMessage.AnchorScopeMismatch);
  }

  if (discussionAnchor.discussionAnchorType !== DiscussionAnchorType.WorkItem) {
    return createDiscussionAnchorRejectedResult(RecordDecisionValidationErrorMessage.UnsupportedAnchorType);
  }

  if (!discussionAnchor.expectedOutputs.includes(DiscussionExpectedOutput.Decision)) {
    return createDiscussionAnchorRejectedResult(RecordDecisionValidationErrorMessage.AnchorWithoutDecisionOutput);
  }

  return {
    status: DiscussionAnchorValidationStatus.Accepted,
  };
}

async function validateFollowUpWork(
  command: RecordDecisionCommand,
  dependencies: RecordDecisionDependencies,
): Promise<FollowUpWorkValidationResult> {
  const followUpWorkItemIds = createOptionalStringList(command.followUpWorkItemIds);

  if (followUpWorkItemIds.length === 0) {
    return {
      status: FollowUpWorkValidationStatus.Accepted,
    };
  }

  if (dependencies.workAnchorStateReader === undefined) {
    return createFollowUpWorkRejectedResult(RecordDecisionValidationErrorMessage.MissingFollowUpWorkReader);
  }

  for (const followUpWorkItemId of followUpWorkItemIds) {
    const followUpWorkItem = await dependencies.workAnchorStateReader.findWorkItem(followUpWorkItemId);

    if (followUpWorkItem === undefined) {
      return createFollowUpWorkRejectedResult(RecordDecisionValidationErrorMessage.FollowUpWorkMissing);
    }

    if (!hasMatchingFollowUpWorkScope(command, followUpWorkItem)) {
      return createFollowUpWorkRejectedResult(RecordDecisionValidationErrorMessage.FollowUpWorkScopeMismatch);
    }
  }

  return {
    status: FollowUpWorkValidationStatus.Accepted,
  };
}

function createDiscussionAnchorRejectedResult(
  message: RecordDecisionValidationErrorMessage,
): DiscussionAnchorValidationResult {
  return {
    status: DiscussionAnchorValidationStatus.Rejected,
    message,
  };
}

function createFollowUpWorkRejectedResult(message: RecordDecisionValidationErrorMessage): FollowUpWorkValidationResult {
  return {
    status: FollowUpWorkValidationStatus.Rejected,
    message,
  };
}

function hasMatchingCommandScope(command: RecordDecisionCommand, discussionAnchor: DiscussionAnchor): boolean {
  return (
    discussionAnchor.discussionAnchorId === command.discussionAnchorId &&
    discussionAnchor.organizationId === command.organizationId &&
    discussionAnchor.projectId === command.projectId &&
    discussionAnchor.workItemId === command.workItemId &&
    discussionAnchor.teamId === command.teamId
  );
}

function hasMatchingFollowUpWorkScope(command: RecordDecisionCommand, workItem: CommandWorkAnchorWorkItem): boolean {
  return workItem.organizationId === command.organizationId && workItem.projectId === command.projectId;
}

function validateRecordDecisionCommand(
  command: RecordDecisionCommand,
): RecordDecisionValidationErrorMessage | undefined {
  if (isBlank(command.title)) {
    return RecordDecisionValidationErrorMessage.TitleRequired;
  }

  if (isBlank(command.decision)) {
    return RecordDecisionValidationErrorMessage.DecisionRequired;
  }

  if (isBlank(command.rationale)) {
    return RecordDecisionValidationErrorMessage.RationaleRequired;
  }

  if (!isOptionalStringList(command.alternativesConsidered)) {
    return RecordDecisionValidationErrorMessage.AlternativesInvalid;
  }

  if (!isOptionalStringList(command.followUpWorkItemIds)) {
    return RecordDecisionValidationErrorMessage.FollowUpWorkInvalid;
  }

  return undefined;
}

function createDecisionRecord(command: RecordDecisionCommand, decisionRecordId: string, occurredAt: string): DecisionRecord {
  return {
    decisionRecordId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...createOptionalTeamScope(command),
    workItemId: command.workItemId,
    discussionAnchorId: command.discussionAnchorId,
    title: command.title,
    decision: command.decision,
    rationale: command.rationale,
    alternativesConsidered: createOptionalStringList(command.alternativesConsidered),
    followUpWorkItemIds: createOptionalStringList(command.followUpWorkItemIds),
    decidedAt: occurredAt,
    decidedBy: command.actor,
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
  command: RecordDecisionCommand,
  message: RecordDecisionValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.ValidationFailed, message);
}

function createRejectedPreconditionOutcome(
  command: RecordDecisionCommand,
  message: RecordDecisionValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.PreconditionFailed, message);
}

function createRejectedOutcome(
  command: RecordDecisionCommand,
  code: CommandErrorCode,
  message: RecordDecisionValidationErrorMessage,
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

function createOptionalTeamScope(command: Pick<RecordDecisionCommand, "teamId">): { teamId?: string } {
  return command.teamId === undefined ? {} : { teamId: command.teamId };
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function isOptionalStringList(value: readonly string[] | undefined): boolean {
  return value === undefined || (Array.isArray(value) && value.every(isNonBlankString));
}

function createOptionalStringList(value: readonly string[] | undefined): readonly string[] {
  return value === undefined ? [] : [...value];
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && !isBlank(value);
}
