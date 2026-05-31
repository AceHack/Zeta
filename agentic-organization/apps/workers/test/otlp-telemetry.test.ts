import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  TelemetryMetricKind,
  TelemetrySpanStatusCode,
} from "../../../packages/observability/src/index.ts";
import { createOtlpTelemetry } from "../src/adapters/otlp-telemetry.ts";

describe("OTLP telemetry adapter", () => {
  test("posts spans, metrics, and logs to OTLP HTTP JSON endpoints", async () => {
    const requests: { url: string; body: unknown }[] = [];
    const telemetry = createOtlpTelemetry({
      endpoint: "http://otel-collector:4318",
      serviceName: "agentic-org-worker",
      resourceAttributes: {
        "deployment.environment": "dev",
        "agentic.organization.id": "org-lfg",
      },
      fetch: async (url, init) => {
        requests.push({ url, body: JSON.parse(String(init?.body)) as unknown });
        return { ok: true, status: 200 };
      },
    });
    const span = telemetry.startSpan("org.command", {
      attributes: { "agentic.command.id": "cmd-001" },
    });

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
      timestamp: "2026-05-31T00:00:00.000Z",
    });
    await telemetry.flush();

    deepEqual(
      requests.map((request) => request.url),
      [
        "http://otel-collector:4318/v1/traces",
        "http://otel-collector:4318/v1/metrics",
        "http://otel-collector:4318/v1/logs",
      ],
    );
    equal(
      ((requests[0]?.body as OtlpTestBody).resourceSpans?.[0]?.resource.attributes ?? []).some(
        (attribute) => attribute.key === "service.name" && attribute.value.stringValue === "agentic-org-worker",
      ),
      true,
    );
    equal(
      (requests[0]?.body as OtlpTestBody).resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0]?.name,
      "org.command",
    );
    equal(
      (requests[1]?.body as OtlpTestBody).resourceMetrics?.[0]?.scopeMetrics?.[0]?.metrics?.[0]?.name,
      "org_command_total",
    );
    equal(
      (requests[2]?.body as OtlpTestBody).resourceLogs?.[0]?.scopeLogs?.[0]?.logRecords?.[0]?.body.stringValue,
      "command accepted",
    );
  });
});

type OtlpTestBody = {
  resourceSpans?: {
    resource: {
      attributes: { key: string; value: { stringValue?: string } }[];
    };
    scopeSpans?: { spans?: { name: string }[] }[];
  }[];
  resourceMetrics?: { scopeMetrics?: { metrics?: { name: string }[] }[] }[];
  resourceLogs?: { scopeLogs?: { logRecords?: { body: { stringValue: string } }[] }[] }[];
};
