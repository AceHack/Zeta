import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { OrgEventKind, type OrgEvent } from "../../domain/src/index.ts";
import {
  RecordingTelemetry,
  TelemetryMetricKind,
  TelemetrySpanStatusCode,
  recordOrgEventTelemetry,
} from "../src/index.ts";

describe("org_event telemetry bridge", () => {
  test("projects each durable org_event into a span event, structured log, and metric", () => {
    const telemetry = new RecordingTelemetry();

    recordOrgEventTelemetry(telemetry, sampleOrgEvent());

    deepEqual(telemetry.spans, [
      {
        name: "org.org_event.append",
        attributes: {
          "agentic.org_event.id": "evt-work-ready-001",
          "agentic.org_event.kind": OrgEventKind.WorkItemTransition,
          "agentic.organization.id": "org-lfg",
          "agentic.subject.id": "work-001",
          "agentic.trace.id": "trace-work-001",
          "agentic.correlation.id": "corr-work-001",
          "agentic.causation.id": "cause-work-001",
          "agentic.hat.id": "engineering_manager",
          "agentic.agent.id": "agent-em-001",
          "agentic.from_state": "created",
          "agentic.to_state": "ready",
          "org.org_event_id": "evt-work-ready-001",
          "org.org_event_kind": OrgEventKind.WorkItemTransition,
          "org.id": "org-lfg",
          "org.work_item_id": "work-001",
        },
        events: [
          {
            name: "org.event",
            attributes: {
              "agentic.org_event.id": "evt-work-ready-001",
              "agentic.org_event.kind": OrgEventKind.WorkItemTransition,
              "agentic.decision": "triage moved work-001 to ready",
              "agentic.evidence_refs": "evidence-001,evidence-002",
            },
          },
        ],
        status: { code: TelemetrySpanStatusCode.Ok },
        ended: true,
      },
    ]);
    deepEqual(telemetry.metrics, [
      {
        kind: TelemetryMetricKind.Counter,
        name: "org_events_total",
        value: 1,
        attributes: {
          "agentic.org_event.kind": OrgEventKind.WorkItemTransition,
          "agentic.organization.id": "org-lfg",
        },
      },
    ]);
    equal(telemetry.logs.length, 1);
    deepEqual(telemetry.logs[0], {
      severity: "info",
      body: "triage moved work-001 to ready",
      timestamp: "2026-05-31T12:00:00.000Z",
      attributes: {
        "agentic.org_event.id": "evt-work-ready-001",
        "agentic.org_event.kind": OrgEventKind.WorkItemTransition,
        "agentic.organization.id": "org-lfg",
        "agentic.subject.id": "work-001",
        "agentic.trace.id": "trace-work-001",
        "agentic.correlation.id": "corr-work-001",
        "agentic.causation.id": "cause-work-001",
        "agentic.hat.id": "engineering_manager",
        "agentic.agent.id": "agent-em-001",
        "agentic.from_state": "created",
        "agentic.to_state": "ready",
        "org.org_event_id": "evt-work-ready-001",
        "org.org_event_kind": OrgEventKind.WorkItemTransition,
        "org.id": "org-lfg",
        "org.work_item_id": "work-001",
      },
    });
  });
});

function sampleOrgEvent(): OrgEvent {
  return {
    id: "evt-work-ready-001",
    kind: OrgEventKind.WorkItemTransition,
    occurredAt: "2026-05-31T12:00:00.000Z",
    organizationId: "org-lfg",
    actorHatId: "engineering_manager",
    actorAgentId: "agent-em-001",
    subjectId: "work-001",
    fromState: "created",
    toState: "ready",
    decision: "triage moved work-001 to ready",
    supervisorChain: ["executive_board", "cto", "engineering_manager"],
    evidenceRefs: ["evidence-001", "evidence-002"],
    correlationId: "corr-work-001",
    causationId: "cause-work-001",
    traceId: "trace-work-001",
  };
}
