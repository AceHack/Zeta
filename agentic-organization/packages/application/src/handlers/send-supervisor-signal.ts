import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  SupervisorSignalStatus,
  type AuditEvent,
  type OutboxEvent,
  type SupervisorChainLevel,
  type SupervisorSignal,
  type SupervisorSignalToolType,
} from "../../../domain/src/index.ts";
import { createAgenticEventEnvelope } from "../../../domain/src/index.ts";
import type { CommandHandler, CommandHandlerOutcome } from "../command-handler-registry.ts";
import type { PipelineCommand } from "../command-contract.ts";
import {
  CommandResultArtifactType,
  CommandResultStatus,
  type CommandResult,
} from "../command-result.ts";
import type { Clock, IdGenerator } from "../ports.ts";

export const IdPrefix = {
  SupervisorSignal: "supervisor-signal",
  AuditEvent: "audit",
  OutboxEvent: "outbox",
  Event: "evt",
} as const;

export type IdPrefix = (typeof IdPrefix)[keyof typeof IdPrefix];

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

export type SendSupervisorSignalDependencies = Clock & IdGenerator;

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
      auditEvents: [auditEvent],
      outboxEvents: [outboxEvent],
    },
  };
}
