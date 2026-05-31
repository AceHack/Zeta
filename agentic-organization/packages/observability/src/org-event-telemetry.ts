import type { OrgEvent } from "../../domain/src/index.ts";
import {
  TelemetryMetricKind,
  TelemetrySpanStatusCode,
  type TelemetryAttributes,
  type TelemetryPort,
} from "./telemetry-port.ts";

export function recordOrgEventTelemetry(telemetry: TelemetryPort, event: OrgEvent): void {
  const attributes = buildOrgEventTelemetryAttributes(event);
  const span = telemetry.startSpan("org.org_event.append", { attributes });
  span.addEvent("org.event", {
    "agentic.org_event.id": event.id,
    "agentic.org_event.kind": event.kind,
    "agentic.decision": event.decision,
    "agentic.evidence_refs": event.evidenceRefs.join(","),
  });
  span.setStatus({ code: TelemetrySpanStatusCode.Ok });
  span.end();

  telemetry.recordMetric({
    kind: TelemetryMetricKind.Counter,
    name: "org_events_total",
    value: 1,
    attributes: {
      "agentic.org_event.kind": event.kind,
      "agentic.organization.id": event.organizationId,
    },
  });

  telemetry.log({
    severity: "info",
    body: event.decision,
    timestamp: event.occurredAt,
    attributes,
  });
}

export function buildOrgEventTelemetryAttributes(event: OrgEvent): TelemetryAttributes {
  const attributes: TelemetryAttributes = {
    "agentic.org_event.id": event.id,
    "agentic.org_event.kind": event.kind,
    "agentic.organization.id": event.organizationId,
    "agentic.subject.id": event.subjectId,
    "agentic.trace.id": event.traceId,
    "agentic.correlation.id": event.correlationId,
    "agentic.causation.id": event.causationId,
    "org.org_event_id": event.id,
    "org.org_event_kind": event.kind,
    "org.id": event.organizationId,
    "org.work_item_id": event.subjectId,
  };

  if (event.actorHatId !== undefined) {
    attributes["agentic.hat.id"] = event.actorHatId;
  }
  if (event.actorAgentId !== undefined) {
    attributes["agentic.agent.id"] = event.actorAgentId;
  }
  if (event.departmentId !== undefined) {
    attributes["agentic.department.id"] = event.departmentId;
  }
  if (event.fromState !== undefined) {
    attributes["agentic.from_state"] = event.fromState;
  }
  if (event.toState !== undefined) {
    attributes["agentic.to_state"] = event.toState;
  }

  return attributes;
}
