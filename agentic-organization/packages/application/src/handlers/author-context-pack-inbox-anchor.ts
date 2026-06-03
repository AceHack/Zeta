import {
  CommandType,
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  isContextPackInboxAnchorPriority,
  type AuditEvent,
  type ContextPackInboxAnchor,
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
  IdGenerator,
  WorkAnchorStateReaderPort,
} from "../ports.ts";

export const AuthorContextPackInboxAnchorIdPrefix = {
  Audit: "audit",
  InboxAnchor: "context-pack-inbox-anchor",
} as const;

export type AuthorContextPackInboxAnchorIdPrefix =
  (typeof AuthorContextPackInboxAnchorIdPrefix)[keyof typeof AuthorContextPackInboxAnchorIdPrefix];

export const ContextPackInboxAnchorAuditEventName = {
  Authored: "context_pack.inbox_anchor.authored",
} as const;

export type ContextPackInboxAnchorAuditEventName =
  (typeof ContextPackInboxAnchorAuditEventName)[keyof typeof ContextPackInboxAnchorAuditEventName];

export const ContextPackInboxAnchorValidationErrorMessage = {
  MissingRelatedWorkItem: "context-pack inbox anchor requires an existing related work item",
  PriorityInvalid: "context-pack inbox anchor priority is invalid",
  ScopeMismatch: "context-pack inbox anchor work item scope does not match the command scope",
  SummaryRequired: "context-pack inbox anchor summary is required",
  TargetHatRequired: "context-pack inbox anchor target hat assignment is required",
  TitleRequired: "context-pack inbox anchor title is required",
} as const;

export type ContextPackInboxAnchorValidationErrorMessage =
  (typeof ContextPackInboxAnchorValidationErrorMessage)[keyof typeof ContextPackInboxAnchorValidationErrorMessage];

export type AuthorContextPackInboxAnchorCommand = PipelineCommand & {
  type: typeof CommandType.AuthorContextPackInboxAnchor;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  targetHatAssignmentId: string;
  targetAgentId?: string | undefined;
  title: string;
  summary: string;
  priority: ContextPackInboxAnchorPriority;
  sourceRef?: string | undefined;
};

export type AuthorContextPackInboxAnchorDependencies = Clock &
  IdGenerator & {
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

export function createAuthorContextPackInboxAnchorHandler(): CommandHandler<
  AuthorContextPackInboxAnchorCommand,
  CommandResult
> {
  return {
    commandType: CommandType.AuthorContextPackInboxAnchor,
    execute: authorContextPackInboxAnchor,
  };
}

export async function authorContextPackInboxAnchor(
  command: AuthorContextPackInboxAnchorCommand,
  dependencies: AuthorContextPackInboxAnchorDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const validationError = validateCommand(command);
  if (validationError !== undefined) {
    return createRejectedValidationOutcome(command, validationError);
  }

  const workScopeValidationError = await validateWorkScope(command, dependencies);
  if (workScopeValidationError !== undefined) {
    return createRejectedPreconditionOutcome(command, workScopeValidationError);
  }

  const occurredAt = dependencies.now();
  const inboxAnchor = createContextPackInboxAnchor(command, dependencies, occurredAt);
  const auditEvent = createAuditEvent(command, dependencies, inboxAnchor, occurredAt);

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
      contextPackInboxAnchors: [inboxAnchor],
      auditEvents: [auditEvent],
      outboxEvents: [],
      workAnchors: createEmptyWorkAnchorCommandEffects(),
    },
  };
}

function createContextPackInboxAnchor(
  command: AuthorContextPackInboxAnchorCommand,
  dependencies: IdGenerator,
  occurredAt: string,
): ContextPackInboxAnchor {
  return {
    inboxAnchorId: dependencies.createId(AuthorContextPackInboxAnchorIdPrefix.InboxAnchor),
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...optionalValue("teamId", command.teamId),
    ...optionalValue("workItemId", command.workItemId),
    targetHatAssignmentId: command.targetHatAssignmentId,
    ...optionalValue("targetAgentId", command.targetAgentId),
    title: command.title,
    summary: command.summary,
    priority: command.priority,
    status: ContextPackInboxAnchorStatus.Unread,
    deliveredAt: occurredAt,
    ...optionalValue("sourceRef", command.sourceRef),
    traceId: command.traceId,
  };
}

function createAuditEvent(
  command: AuthorContextPackInboxAnchorCommand,
  dependencies: IdGenerator,
  inboxAnchor: ContextPackInboxAnchor,
  occurredAt: string,
): AuditEvent {
  return {
    auditEventId: dependencies.createId(AuthorContextPackInboxAnchorIdPrefix.Audit),
    eventName: ContextPackInboxAnchorAuditEventName.Authored,
    aggregateId: inboxAnchor.inboxAnchorId,
    actor: command.actor,
    occurredAt,
  };
}

function validateCommand(
  command: AuthorContextPackInboxAnchorCommand,
): ContextPackInboxAnchorValidationErrorMessage | undefined {
  if (isBlank(command.targetHatAssignmentId)) {
    return ContextPackInboxAnchorValidationErrorMessage.TargetHatRequired;
  }

  if (isBlank(command.title)) {
    return ContextPackInboxAnchorValidationErrorMessage.TitleRequired;
  }

  if (isBlank(command.summary)) {
    return ContextPackInboxAnchorValidationErrorMessage.SummaryRequired;
  }

  if (!isContextPackInboxAnchorPriority(command.priority)) {
    return ContextPackInboxAnchorValidationErrorMessage.PriorityInvalid;
  }

  return undefined;
}

async function validateWorkScope(
  command: AuthorContextPackInboxAnchorCommand,
  dependencies: AuthorContextPackInboxAnchorDependencies,
): Promise<ContextPackInboxAnchorValidationErrorMessage | undefined> {
  if (command.workItemId === undefined || dependencies.workAnchorStateReader === undefined) {
    return undefined;
  }

  const workItem = await dependencies.workAnchorStateReader.findWorkItem(command.workItemId);
  if (workItem === undefined) {
    return ContextPackInboxAnchorValidationErrorMessage.MissingRelatedWorkItem;
  }

  return workItemMatchesCommandScope(workItem, command)
    ? undefined
    : ContextPackInboxAnchorValidationErrorMessage.ScopeMismatch;
}

function workItemMatchesCommandScope(
  workItem: CommandWorkAnchorWorkItem,
  command: AuthorContextPackInboxAnchorCommand,
): boolean {
  return workItem.workItemId === command.workItemId &&
    workItem.organizationId === command.organizationId &&
    workItem.projectId === command.projectId &&
    optionalScopeValueMatches(readOptionalTeamId(workItem), command.teamId);
}

function readOptionalTeamId(workItem: CommandWorkAnchorWorkItem): string | undefined {
  if (!("teamId" in workItem)) {
    return undefined;
  }

  const value = (workItem as { teamId?: unknown }).teamId;
  return typeof value === "string" ? value : undefined;
}

function optionalScopeValueMatches(recordValue: string | undefined, commandValue: string | undefined): boolean {
  return recordValue === undefined || recordValue === commandValue;
}

function createRejectedValidationOutcome(
  command: AuthorContextPackInboxAnchorCommand,
  message: ContextPackInboxAnchorValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.ValidationFailed, message);
}

function createRejectedPreconditionOutcome(
  command: AuthorContextPackInboxAnchorCommand,
  message: ContextPackInboxAnchorValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.PreconditionFailed, message);
}

function createRejectedOutcome(
  command: AuthorContextPackInboxAnchorCommand,
  code: CommandErrorCode,
  message: ContextPackInboxAnchorValidationErrorMessage,
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

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}
