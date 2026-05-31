import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  NoopTelemetry,
  RecordingTelemetry,
  TelemetryMetricKind,
  TelemetrySpanStatusCode,
  W3CTraceHeaderName,
} from "../src/telemetry-port.ts";

describe("telemetry port", () => {
  test("noop telemetry accepts spans, metrics, logs, and context propagation without side effects", () => {
    const telemetry = new NoopTelemetry();
    const span = telemetry.startSpan("org.command", {
      attributes: { "agentic.command.id": "cmd-001" },
    });

    span.setAttribute("result.status", "accepted");
    span.addEvent("org.event", { "agentic.org_event.id": "evt-001" });
    span.setStatus({ code: TelemetrySpanStatusCode.Ok });
    span.end();
    telemetry.recordMetric({
      kind: TelemetryMetricKind.Counter,
      name: "org_command_total",
      value: 1,
      attributes: { "result.status": "accepted" },
    });
    telemetry.log({
      severity: "info",
      body: "command accepted",
      attributes: { "agentic.command.id": "cmd-001" },
    });

    const carrier: Record<string, string> = {};
    telemetry.inject(carrier);
    deepEqual(carrier, {});
    equal(telemetry.extract(carrier), null);
  });

  test("recording telemetry captures span lifecycle, metrics, logs, and W3C trace context", () => {
    const telemetry = new RecordingTelemetry({
      traceContext: {
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        traceFlags: "01",
      },
    });
    const span = telemetry.startSpan("org.lane.tick", {
      attributes: { "agentic.lane": "work-os", "agentic.tick": 7 },
    });

    span.addEvent("org.event", { "agentic.org_event.id": "evt-001" });
    span.setAttribute("result.status", "ok");
    span.setStatus({ code: TelemetrySpanStatusCode.Ok });
    span.end();
    telemetry.recordMetric({
      kind: TelemetryMetricKind.Histogram,
      name: "org_lane_tick_duration_ms",
      value: 12,
      attributes: { "agentic.lane": "work-os" },
    });
    telemetry.log({
      severity: "info",
      body: "lane tick completed",
      attributes: { "agentic.lane": "work-os" },
    });

    deepEqual(telemetry.spans, [
      {
        name: "org.lane.tick",
        attributes: {
          "agentic.lane": "work-os",
          "agentic.tick": 7,
          "result.status": "ok",
        },
        events: [
          {
            name: "org.event",
            attributes: { "agentic.org_event.id": "evt-001" },
          },
        ],
        status: { code: TelemetrySpanStatusCode.Ok },
        ended: true,
      },
    ]);
    equal(telemetry.metrics[0]?.name, "org_lane_tick_duration_ms");
    equal(telemetry.logs[0]?.body, "lane tick completed");

    const carrier: Record<string, string> = {};
    telemetry.inject(carrier);
    deepEqual(carrier, {
      [W3CTraceHeaderName.TraceParent]: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    });
    deepEqual(telemetry.extract(carrier), {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: "01",
    });
  });
});
