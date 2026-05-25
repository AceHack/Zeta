import type { AgenticEventEnvelope } from "../../domain/src/index.ts";

export const AgenticSpanAttributeKey = {
  EventId: "agentic.event.id",
  EventType: "agentic.event.type",
  CommandId: "agentic.command.id",
  CorrelationId: "agentic.correlation.id",
  CausationId: "agentic.causation.id",
  TraceId: "agentic.trace.id",
  IdempotencyKey: "agentic.idempotency.key",
  AgentId: "agentic.agent.id",
  HatAssignmentId: "agentic.hat.assignment.id",
  OrganizationId: "agentic.organization.id",
  ProjectId: "agentic.project.id",
  TeamId: "agentic.team.id",
  WorkItemId: "agentic.work_item.id",
  AggregateId: "agentic.aggregate.id",
  AggregateType: "agentic.aggregate.type",
  AggregateVersion: "agentic.aggregate.version",
  MessagingSystem: "messaging.system",
  MessagingDestinationName: "messaging.destination.name",
} as const;

export type AgenticSpanAttributeKey = (typeof AgenticSpanAttributeKey)[keyof typeof AgenticSpanAttributeKey];

export const MessagingSystemName = {
  Nats: "nats",
} as const;

export type MessagingSystemName = (typeof MessagingSystemName)[keyof typeof MessagingSystemName];

export type AgenticSpanAttributes = Partial<Record<AgenticSpanAttributeKey, string | number>>;

export type BuildAgenticSpanAttributesInput = {
  natsSubject: string;
};

export function buildAgenticSpanAttributes(
  envelope: AgenticEventEnvelope,
  input: BuildAgenticSpanAttributesInput,
): AgenticSpanAttributes {
  const attributes: AgenticSpanAttributes = {
    [AgenticSpanAttributeKey.EventId]: envelope.eventId,
    [AgenticSpanAttributeKey.EventType]: envelope.eventType,
    [AgenticSpanAttributeKey.CommandId]: envelope.trace.commandId,
    [AgenticSpanAttributeKey.CorrelationId]: envelope.trace.correlationId,
    [AgenticSpanAttributeKey.CausationId]: envelope.trace.causationId,
    [AgenticSpanAttributeKey.TraceId]: envelope.trace.traceId,
    [AgenticSpanAttributeKey.IdempotencyKey]: envelope.trace.idempotencyKey,
    [AgenticSpanAttributeKey.AgentId]: envelope.actor.agentId,
    [AgenticSpanAttributeKey.HatAssignmentId]: envelope.actor.hatAssignmentId,
    [AgenticSpanAttributeKey.OrganizationId]: envelope.scope.organizationId,
    [AgenticSpanAttributeKey.ProjectId]: envelope.scope.projectId,
    [AgenticSpanAttributeKey.AggregateId]: envelope.aggregate.aggregateId,
    [AgenticSpanAttributeKey.AggregateType]: envelope.aggregate.aggregateType,
    [AgenticSpanAttributeKey.AggregateVersion]: envelope.aggregate.aggregateVersion,
    [AgenticSpanAttributeKey.MessagingSystem]: MessagingSystemName.Nats,
    [AgenticSpanAttributeKey.MessagingDestinationName]: input.natsSubject,
  };

  if (envelope.scope.teamId !== undefined) {
    attributes[AgenticSpanAttributeKey.TeamId] = envelope.scope.teamId;
  }

  if (envelope.scope.workItemId !== undefined) {
    attributes[AgenticSpanAttributeKey.WorkItemId] = envelope.scope.workItemId;
  }

  return attributes;
}
