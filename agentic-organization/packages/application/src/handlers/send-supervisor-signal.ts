import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  isSupervisorChainLevel,
  isSupervisorSignalToolType,
  type AuditEvent,
  type OutboxEvent,
  type SupervisorSignal,
  type SupervisorSignalToolType,
} from "../../../domain/src/index.ts";
import { createAgenticEventEnvelope } from "../../../domain/src/index.ts";
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

export const IdPrefix = {
  SupervisorSignal: "supervisor-signal",
  AuditEvent: "audit",
  OutboxEvent: "outbox",
  Event: "evt",
} as const;

export type IdPrefix = (typeof IdPrefix)[keyof typeof IdPrefix];

export const SupervisorSignalValidationErrorMessage = {
  MessageRequired: "supervisor signal message is required",
  MissingRelatedWorkItem: "supervisor signal requires an existing related work item",
  ScopeMismatch: "supervisor signal work item scope does not match the command scope",
  SourceLevelInvalid: "supervisor signal source level is invalid",
  TargetHatRequired: "supervisor signal target hat assignment is required",
  TargetLevelInvalid: "supervisor signal target level is invalid",
  TitleRequired: "supervisor signal title is required",
  ToolTypeInvalid: "supervisor signal tool type is invalid",
  UpwardChainRequired: "supervisor signal must target a higher supervisor chain level",
} as const;

export type SupervisorSignalValidationErrorMessage =
  (typeof SupervisorSignalValidationErrorMessage)[keyof typeof SupervisorSignalValidationErrorMessage];

export type SendSupervisorSignalPolicyContext = {
  scope: {
    teamId: string;
    workItemId: string;
  };
  toolType: SupervisorSignalToolType;
  supervisorChain: {
    sourceLevel: SupervisorChainLevel;
    targetLevel: SupervisorChainLevel;
  };
};

export type SendSupervisorSignalCommand = PipelineCommand & {
  type: typeof CommandType.SendSupervisorSignal;
  targetHatAssignmentId: string;
  title: string;
  message: string;
  policyContext: SendSupervisorSignalPolicyContext;
};

export type SendSupervisorSignalDependencies = Clock &
  IdGenerator & {
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

export function createSendSupervisorSignalHandler(): CommandHandler<SendSupervisorSignalCommand, CommandResult> {
  return {
    commandType: CommandType.SendSupervisorSignal,
    execute: sendSupervisorSignal,
  };
}

export async function sendSupervisorSignal(
  command: SendSupervisorSignalCommand,
  dependencies: SendSupervisorSignalDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const commandValidationError = validateSupervisorSignalCommand(command);

  if (commandValidationError !== undefined) {
    return createRejectedValidationOutcome(command, commandValidationError);
  }

  const anchorValidationResult = await validateRelatedWorkItem(command, dependencies);

  if (anchorValidationResult !== undefined) {
    return anchorValidationResult;
  }

  const occurredAt = dependencies.now();
  const signalContext = command.policyContext;
  const supervisorSignal: SupervisorSignal = {
    supervisorSignalId: dependencies.createId(IdPrefix.SupervisorSignal),
    organizationId: command.organizationId,
    projectId: command.projectId,
    teamId: signalContext.scope.teamId,
    sourceLevel: signalContext.supervisorChain.sourceLevel,
    targetLevel: signalContext.supervisorChain.targetLevel,
    targetHatAssignmentId: command.targetHatAssignmentId,
    sender: command.actor,
    toolType: signalContext.toolType,
    status: SupervisorSignalStatus.Sent,
    title: command.title,
    message: command.message,
    relatedWorkItemId: signalContext.scope.workItemId,
    createdAt: occurredAt,
  };

  const auditEvent: AuditEvent = {
    auditEventId: dependencies.createId(IdPrefix.AuditEvent),
    eventName: AgenticEventType.SupervisorSignalSent,
    aggregateId: supervisorSignal.supervisorSignalId,
    actor: command.actor,
    occurredAt,
  };

  const outboxEvent: OutboxEvent = {
    outboxEventId: dependencies.createId(IdPrefix.OutboxEvent),
    envelope: createAgenticEventEnvelope({
      eventId: dependencies.createId(IdPrefix.Event),
      eventType: AgenticEventType.SupervisorSignalSent,
      occurredAt,
      actor: command.actor,
      scope: {
        organizationId: command.organizationId,
        projectId: command.projectId,
        teamId: signalContext.scope.teamId,
        workItemId: signalContext.scope.workItemId,
      },
      aggregate: {
        aggregateId: supervisorSignal.supervisorSignalId,
        aggregateType: AgenticAggregateType.SupervisorSignal,
        aggregateVersion: 1,
      },
      trace: {
        commandId: command.commandId,
        correlationId: command.correlationId,
        causationId: command.causationId,
        traceId: command.traceId,
        idempotencyKey: command.idempotencyKey,
      },
      payload: {
        sourceLevel: signalContext.supervisorChain.sourceLevel,
        targetLevel: signalContext.supervisorChain.targetLevel,
        targetHatAssignmentId: command.targetHatAssignmentId,
        toolType: signalContext.toolType,
        status: SupervisorSignalStatus.Sent,
        title: command.title,
      },
    }),
  };

  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Accepted,
      artifacts: [
        {
          artifactType: CommandResultArtifactType.SupervisorSignal,
          artifactId: supervisorSignal.supervisorSignalId,
          label: supervisorSignal.title,
        },
      ],
      emittedEvents: [
        {
          eventId: outboxEvent.envelope.eventId,
          eventType: outboxEvent.envelope.eventType,
          aggregateId: outboxEvent.envelope.aggregate.aggregateId,
          aggregateType: outboxEvent.envelope.aggregate.aggregateType,
        },
      ],
      auditEventIds: [auditEvent.auditEventId],
      supervisorSignal,
      idempotency: {
        replayed: false,
      },
    },
    effects: {
      supervisorSignals: [supervisorSignal],
      discussionAnchors: [],
      decisionRecords: [],
      qualityGateEvaluations: [],
      workScheduleBlocks: [],
      auditEvents: [auditEvent],
      outboxEvents: [outboxEvent],
    },
  };
}

function validateSupervisorSignalCommand(
  command: SendSupervisorSignalCommand,
): SupervisorSignalValidationErrorMessage | undefined {
  if (isBlank(command.targetHatAssignmentId)) {
    return SupervisorSignalValidationErrorMessage.TargetHatRequired;
  }

  if (isBlank(command.title)) {
    return SupervisorSignalValidationErrorMessage.TitleRequired;
  }

  if (isBlank(command.message)) {
    return SupervisorSignalValidationErrorMessage.MessageRequired;
  }

  if (!isSupervisorSignalToolType(command.policyContext.toolType)) {
    return SupervisorSignalValidationErrorMessage.ToolTypeInvalid;
  }

  if (!isSupervisorChainLevel(command.policyContext.supervisorChain.sourceLevel)) {
    return SupervisorSignalValidationErrorMessage.SourceLevelInvalid;
  }

  if (!isSupervisorChainLevel(command.policyContext.supervisorChain.targetLevel)) {
    return SupervisorSignalValidationErrorMessage.TargetLevelInvalid;
  }

  if (!isUpwardSupervisorChain(command.policyContext.supervisorChain.sourceLevel, command.policyContext.supervisorChain.targetLevel)) {
    return SupervisorSignalValidationErrorMessage.UpwardChainRequired;
  }

  return undefined;
}

async function validateRelatedWorkItem(
  command: SendSupervisorSignalCommand,
  dependencies: SendSupervisorSignalDependencies,
): Promise<CommandHandlerOutcome<CommandResult> | undefined> {
  if (dependencies.workAnchorStateReader === undefined) {
    return undefined;
  }

  const relatedWorkItem = await dependencies.workAnchorStateReader.findWorkItem(command.policyContext.scope.workItemId);

  if (relatedWorkItem === undefined) {
    return createRejectedValidationOutcome(command, SupervisorSignalValidationErrorMessage.MissingRelatedWorkItem);
  }

  if (!hasMatchingCommandScope(command, relatedWorkItem)) {
    return createRejectedValidationOutcome(command, SupervisorSignalValidationErrorMessage.ScopeMismatch);
  }

  return undefined;
}

function hasMatchingCommandScope(command: SendSupervisorSignalCommand, workItem: CommandWorkAnchorWorkItem): boolean {
  return (
    workItem.workItemId === command.policyContext.scope.workItemId &&
    workItem.organizationId === command.organizationId &&
    workItem.projectId === command.projectId
  );
}

function createRejectedValidationOutcome(
  command: SendSupervisorSignalCommand,
  message: SupervisorSignalValidationErrorMessage,
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

function createEmptyCommandEffects(): CommandEffects {
  return {
    supervisorSignals: [],
    discussionAnchors: [],
    decisionRecords: [],
    qualityGateEvaluations: [],
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

function isUpwardSupervisorChain(sourceLevel: SupervisorChainLevel, targetLevel: SupervisorChainLevel): boolean {
  return getSupervisorChainRank(targetLevel) > getSupervisorChainRank(sourceLevel);
}

function getSupervisorChainRank(level: SupervisorChainLevel): number {
  if (level === SupervisorChainLevel.TeamMember) {
    return 0;
  }

  if (level === SupervisorChainLevel.Manager) {
    return 1;
  }

  if (level === SupervisorChainLevel.Director) {
    return 2;
  }

  if (level === SupervisorChainLevel.CSuite) {
    return 3;
  }

  return 4;
}
