import {
  CommandType,
  ContextPackInboxAnchorStatus,
  isContextPackInboxAnchorStatus,
  isContextPackInboxAnchorTerminalStatus,
  type AuditEvent,
  type ContextPackInboxAnchor,
  type ContextPackInboxAnchorStatusTransition,
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
  ContextPackInboxAnchorStateReaderPort,
  IdGenerator,
} from "../ports.ts";

export const UpdateContextPackInboxAnchorStatusIdPrefix = {
  Audit: "audit",
} as const;

export type UpdateContextPackInboxAnchorStatusIdPrefix =
  (typeof UpdateContextPackInboxAnchorStatusIdPrefix)[keyof typeof UpdateContextPackInboxAnchorStatusIdPrefix];

export const ContextPackInboxAnchorStatusAuditEventName = {
  StatusUpdated: "context_pack.inbox_anchor.status_updated",
} as const;

export type ContextPackInboxAnchorStatusAuditEventName =
  (typeof ContextPackInboxAnchorStatusAuditEventName)[keyof typeof ContextPackInboxAnchorStatusAuditEventName];

export const UpdateContextPackInboxAnchorStatusValidationErrorMessage = {
  InboxAnchorMissing: "context-pack inbox anchor was not found",
  InboxAnchorReaderRequired: "context-pack inbox anchor state reader is required",
  InboxAnchorRequired: "context-pack inbox anchor id is required",
  ScopeMismatch: "context-pack inbox anchor scope does not match the command scope",
  SnoozedUntilInvalid: "context-pack inbox anchor snooze time must be in the future",
  StatusInvalid: "context-pack inbox anchor status is invalid",
  StatusTransitionInvalid: "context-pack inbox anchor status transition is invalid",
  TargetHatRequired: "context-pack inbox anchor target hat assignment is required",
} as const;

export type UpdateContextPackInboxAnchorStatusValidationErrorMessage =
  (typeof UpdateContextPackInboxAnchorStatusValidationErrorMessage)[keyof typeof UpdateContextPackInboxAnchorStatusValidationErrorMessage];

export type UpdateContextPackInboxAnchorStatusCommand = PipelineCommand & {
  type: typeof CommandType.UpdateContextPackInboxAnchorStatus;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  inboxAnchorId: string;
  targetHatAssignmentId: string;
  targetAgentId?: string | undefined;
  status: ContextPackInboxAnchorStatus;
  snoozedUntil?: string | undefined;
};

export type UpdateContextPackInboxAnchorStatusDependencies = Clock &
  IdGenerator & {
    contextPackInboxAnchorStateReader?: ContextPackInboxAnchorStateReaderPort | undefined;
  };

export function createUpdateContextPackInboxAnchorStatusHandler(): CommandHandler<
  UpdateContextPackInboxAnchorStatusCommand,
  CommandResult
> {
  return {
    commandType: CommandType.UpdateContextPackInboxAnchorStatus,
    execute: updateContextPackInboxAnchorStatus,
  };
}

export async function updateContextPackInboxAnchorStatus(
  command: UpdateContextPackInboxAnchorStatusCommand,
  dependencies: UpdateContextPackInboxAnchorStatusDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const occurredAt = dependencies.now();
  const validationError = validateCommand(command, occurredAt);
  if (validationError !== undefined) {
    return createRejectedValidationOutcome(command, validationError);
  }

  const reader = dependencies.contextPackInboxAnchorStateReader;
  if (reader === undefined) {
    return createRejectedPreconditionOutcome(
      command,
      UpdateContextPackInboxAnchorStatusValidationErrorMessage.InboxAnchorReaderRequired,
    );
  }

  const inboxAnchor = await reader.findContextPackInboxAnchor(command.inboxAnchorId);
  if (inboxAnchor === undefined) {
    return createRejectedPreconditionOutcome(
      command,
      UpdateContextPackInboxAnchorStatusValidationErrorMessage.InboxAnchorMissing,
    );
  }

  if (!inboxAnchorMatchesCommandScope(inboxAnchor, command)) {
    return createRejectedPreconditionOutcome(
      command,
      UpdateContextPackInboxAnchorStatusValidationErrorMessage.ScopeMismatch,
    );
  }

  const statusTransition = createStatusTransition(command, occurredAt);
  const auditEvent = createAuditEvent(command, dependencies, statusTransition, occurredAt);

  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Accepted,
      artifacts: [{
        artifactType: CommandResultArtifactType.ContextPackInboxAnchor,
        artifactId: inboxAnchor.inboxAnchorId,
        label: inboxAnchor.title,
      }],
      auditEventIds: [auditEvent.auditEventId],
      contextPackInboxAnchor: inboxAnchor,
      contextPackInboxAnchorStatusTransition: statusTransition,
      idempotency: {
        replayed: false,
      },
    },
    effects: {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
      qualityGateEvaluations: [],
      workScheduleBlocks: [],
      contextPackInboxAnchors: [],
      contextPackInboxAnchorStatusTransitions: [statusTransition],
      auditEvents: [auditEvent],
      outboxEvents: [],
      workAnchors: createEmptyWorkAnchorCommandEffects(),
    },
  };
}

function validateCommand(
  command: UpdateContextPackInboxAnchorStatusCommand,
  observedAt: string,
): UpdateContextPackInboxAnchorStatusValidationErrorMessage | undefined {
  if (isBlank(command.inboxAnchorId)) {
    return UpdateContextPackInboxAnchorStatusValidationErrorMessage.InboxAnchorRequired;
  }

  if (isBlank(command.targetHatAssignmentId)) {
    return UpdateContextPackInboxAnchorStatusValidationErrorMessage.TargetHatRequired;
  }

  if (!isContextPackInboxAnchorStatus(command.status)) {
    return UpdateContextPackInboxAnchorStatusValidationErrorMessage.StatusInvalid;
  }

  if (!isContextPackInboxAnchorTerminalStatus(command.status)) {
    return UpdateContextPackInboxAnchorStatusValidationErrorMessage.StatusTransitionInvalid;
  }

  if (command.status === ContextPackInboxAnchorStatus.Snoozed && !isFutureIsoTime(command.snoozedUntil, observedAt)) {
    return UpdateContextPackInboxAnchorStatusValidationErrorMessage.SnoozedUntilInvalid;
  }

  return undefined;
}

function inboxAnchorMatchesCommandScope(
  inboxAnchor: ContextPackInboxAnchor,
  command: UpdateContextPackInboxAnchorStatusCommand,
): boolean {
  return inboxAnchor.inboxAnchorId === command.inboxAnchorId &&
    inboxAnchor.organizationId === command.organizationId &&
    inboxAnchor.projectId === command.projectId &&
    sameOptionalScope(inboxAnchor.teamId, command.teamId) &&
    sameOptionalScope(inboxAnchor.workItemId, command.workItemId) &&
    inboxAnchor.targetHatAssignmentId === command.targetHatAssignmentId &&
    sameOptionalScope(inboxAnchor.targetAgentId, command.targetAgentId);
}

function createStatusTransition(
  command: UpdateContextPackInboxAnchorStatusCommand,
  changedAt: string,
): ContextPackInboxAnchorStatusTransition {
  if (!isContextPackInboxAnchorTerminalStatus(command.status)) {
    throw new Error(UpdateContextPackInboxAnchorStatusValidationErrorMessage.StatusTransitionInvalid);
  }

  return {
    inboxAnchorId: command.inboxAnchorId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...optionalValue("teamId", command.teamId),
    ...optionalValue("workItemId", command.workItemId),
    targetHatAssignmentId: command.targetHatAssignmentId,
    ...optionalValue("targetAgentId", command.targetAgentId),
    status: command.status,
    changedAt,
    ...optionalValue("snoozedUntil", command.status === ContextPackInboxAnchorStatus.Snoozed ? command.snoozedUntil : undefined),
    traceId: command.traceId,
  };
}

function createAuditEvent(
  command: UpdateContextPackInboxAnchorStatusCommand,
  dependencies: IdGenerator,
  statusTransition: ContextPackInboxAnchorStatusTransition,
  occurredAt: string,
): AuditEvent {
  return {
    auditEventId: dependencies.createId(UpdateContextPackInboxAnchorStatusIdPrefix.Audit),
    eventName: ContextPackInboxAnchorStatusAuditEventName.StatusUpdated,
    aggregateId: statusTransition.inboxAnchorId,
    actor: command.actor,
    occurredAt,
  };
}

function createRejectedValidationOutcome(
  command: UpdateContextPackInboxAnchorStatusCommand,
  message: UpdateContextPackInboxAnchorStatusValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.ValidationFailed, message);
}

function createRejectedPreconditionOutcome(
  command: UpdateContextPackInboxAnchorStatusCommand,
  message: UpdateContextPackInboxAnchorStatusValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.PreconditionFailed, message);
}

function createRejectedOutcome(
  command: UpdateContextPackInboxAnchorStatusCommand,
  code: CommandErrorCode,
  message: UpdateContextPackInboxAnchorStatusValidationErrorMessage,
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
    contextPackInboxAnchors: [],
    contextPackInboxAnchorStatusTransitions: [],
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

function optionalValue<Key extends string>(
  key: Key,
  value: string | undefined,
): { [Property in Key]?: string } {
  return value === undefined ? {} : { [key]: value } as { [Property in Key]?: string };
}

function sameOptionalScope(left: string | undefined, right: string | undefined): boolean {
  return left === right;
}

function isFutureIsoTime(value: string | undefined, observedAt: string): boolean {
  if (value === undefined) return false;
  const snoozedUntil = Date.parse(value);
  const observed = Date.parse(observedAt);
  return Number.isFinite(snoozedUntil) && Number.isFinite(observed) && snoozedUntil > observed;
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}
