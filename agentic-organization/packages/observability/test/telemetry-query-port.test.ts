import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  RecordingTelemetryQueryPort,
  createLgtmTelemetryQueryPort,
} from "../src/index.ts";

describe("telemetry query port", () => {
  test("records PromQL, TraceQL, and LogQL calls for hermetic optimizer tests", async () => {
    const port = new RecordingTelemetryQueryPort({
      metrics: [{ labels: { hat: "code_reviewer" }, points: [{ timestamp: "2026-05-31T00:00:00.000Z", value: 3 }] }],
      traces: [{ traceId: "trace-001", spanCount: 7, rootName: "org.command" }],
      logs: [{ timestamp: "2026-05-31T00:00:00.000Z", line: "latency regression", labels: { hat: "code_reviewer" } }],
    });
    const range = { start: "2026-05-31T00:00:00.000Z", end: "2026-05-31T01:00:00.000Z" };

    await port.queryMetrics("histogram_quantile(0.95, org_command_duration_ms)", range);
    await port.queryTraces('{ org.work_item_id = "work-001" }', range);
    await port.queryLogs('{app="agentic-org-worker"}', range);

    deepEqual(port.calls, [
      { kind: "metrics", query: "histogram_quantile(0.95, org_command_duration_ms)", range },
      { kind: "traces", query: '{ org.work_item_id = "work-001" }', range },
      { kind: "logs", query: '{app="agentic-org-worker"}', range },
    ]);
  });

  test("queries live LGTM HTTP APIs and normalizes metrics, traces, and logs", async () => {
    const urls: string[] = [];
    const metricHeaders: Record<string, string>[] = [];
    const port = createLgtmTelemetryQueryPort({
      mimirBaseUrl: "http://mimir:9009/prometheus",
      tempoBaseUrl: "http://tempo:3200",
      lokiBaseUrl: "http://loki:3100",
      mimirTenantId: "agentic-org",
      stepSeconds: 60,
      fetchImpl: (async (url, init) => {
        urls.push(String(url));
        if (new URL(String(url)).hostname === "mimir") {
          metricHeaders.push(init?.headers as Record<string, string>);
        }
        if (String(url).includes("/loki/api/v1/query_range")) {
          return jsonResponse({
            status: "success",
            data: {
              result: [
                {
                  stream: { app: "agentic-org-worker" },
                  values: [["1780185600000000000", "latency regression"]],
                },
              ],
            },
          });
        }
        if (String(url).includes("/api/v1/query_range")) {
          return jsonResponse({
            status: "success",
            data: {
              result: [
                {
                  metric: { agentic_hat: "reviewer" },
                  values: [[1780185600, "3"]],
                },
              ],
            },
          });
        }
        if (String(url).includes("/api/search")) {
          return jsonResponse({
            traces: [
              {
                traceID: "trace-001",
                rootTraceName: "org.command",
                spanSet: { spans: [{}, {}, {}] },
              },
            ],
          });
        }
        return jsonResponse({ traces: [] });
      }) as typeof fetch,
    });
    const range = { start: "2026-05-31T00:00:00.000Z", end: "2026-05-31T01:00:00.000Z" };

    deepEqual(await port.queryMetrics("org_agent_tokens_total", range), {
      status: "ok",
      source: "mimir",
      data: [
        {
          labels: { agentic_hat: "reviewer" },
          points: [{ timestamp: "2026-05-31T00:00:00.000Z", value: 3 }],
        },
      ],
    });
    deepEqual(await port.queryTraces('{ org.work_item_id = "work-001" }', range), {
      status: "ok",
      source: "tempo",
      data: [{ traceId: "trace-001", rootName: "org.command", spanCount: 3 }],
    });
    deepEqual(await port.queryLogs('{app="agentic-org-worker"}', range), {
      status: "ok",
      source: "loki",
      data: [
        {
          timestamp: "2026-05-31T00:00:00.000Z",
          line: "latency regression",
          labels: { app: "agentic-org-worker" },
        },
      ],
    });
    deepEqual(urls.map((url) => new URL(url).hostname), ["mimir", "tempo", "loki"]);
    deepEqual(metricHeaders, [{ "X-Scope-OrgID": "agentic-org" }]);
  });

  test("returns degraded evidence for LGTM HTTP failures instead of empty successful data", async () => {
    const port = createLgtmTelemetryQueryPort({
      mimirBaseUrl: "http://mimir:9009/prometheus",
      tempoBaseUrl: "http://tempo:3200",
      lokiBaseUrl: "http://loki:3100",
      fetchImpl: (async () => new Response("not ready", { status: 503, statusText: "Service Unavailable" })) as typeof fetch,
    });
    const range = { start: "2026-05-31T00:00:00.000Z", end: "2026-05-31T01:00:00.000Z" };

    deepEqual(await port.queryMetrics("org_agent_tokens_total", range), {
      status: "degraded",
      source: "mimir",
      reason: "http_error",
      message: "mimir telemetry query failed with HTTP 503 Service Unavailable",
      httpStatus: 503,
    });
  });

  test("returns bad-response evidence for provider error bodies that arrive as HTTP 200", async () => {
    const port = createLgtmTelemetryQueryPort({
      mimirBaseUrl: "http://mimir:9009/prometheus",
      tempoBaseUrl: "http://tempo:3200",
      lokiBaseUrl: "http://loki:3100",
      fetchImpl: (async () => jsonResponse({ status: "error", errorType: "internal", error: "ring unhealthy" })) as typeof fetch,
    });
    const range = { start: "2026-05-31T00:00:00.000Z", end: "2026-05-31T01:00:00.000Z" };

    deepEqual(await port.queryMetrics("org_lane_ticks_total", range), {
      status: "degraded",
      source: "mimir",
      reason: "bad_response",
      message: "mimir telemetry query returned error response: ring unhealthy",
    });
  });

  test("returns bad-response evidence for malformed success payload entries", async () => {
    const port = createLgtmTelemetryQueryPort({
      mimirBaseUrl: "http://mimir:9009/prometheus",
      tempoBaseUrl: "http://tempo:3200",
      lokiBaseUrl: "http://loki:3100",
      fetchImpl: (async () => jsonResponse({
        status: "success",
        data: {
          result: [{ metric: { agentic_lane: "work-os" }, values: "not-an-array" }],
        },
      })) as typeof fetch,
    });
    const range = { start: "2026-05-31T00:00:00.000Z", end: "2026-05-31T01:00:00.000Z" };

    deepEqual(await port.queryMetrics("org_lane_ticks_total", range), {
      status: "degraded",
      source: "mimir",
      reason: "bad_response",
      message: "mimir telemetry query returned malformed response: expected Prometheus series values array",
    });
  });

  test("returns timeout evidence distinctly from generic fetch failures", async () => {
    const timeout = new Error("operation timed out");
    timeout.name = "AbortError";
    const port = createLgtmTelemetryQueryPort({
      mimirBaseUrl: "http://mimir:9009/prometheus",
      tempoBaseUrl: "http://tempo:3200",
      lokiBaseUrl: "http://loki:3100",
      fetchImpl: (async () => { throw timeout; }) as typeof fetch,
    });
    const range = { start: "2026-05-31T00:00:00.000Z", end: "2026-05-31T01:00:00.000Z" };

    deepEqual(await port.queryMetrics("org_lane_ticks_total", range), {
      status: "degraded",
      source: "mimir",
      reason: "timeout",
      message: "mimir telemetry query timed out: operation timed out",
    });
  });

  test("returns decode-error evidence when provider JSON parsing fails", async () => {
    const port = createLgtmTelemetryQueryPort({
      mimirBaseUrl: "http://mimir:9009/prometheus",
      tempoBaseUrl: "http://tempo:3200",
      lokiBaseUrl: "http://loki:3100",
      fetchImpl: (async () => {
        const response = new Response("{}");
        response.json = async () => {
          throw new Error("invalid JSON");
        };
        return response;
      }) as typeof fetch,
    });
    const range = { start: "2026-05-31T00:00:00.000Z", end: "2026-05-31T01:00:00.000Z" };

    deepEqual(await port.queryMetrics("org_lane_ticks_total", range), {
      status: "degraded",
      source: "mimir",
      reason: "decode_error",
      message: "mimir telemetry query decode failed: invalid JSON",
    });
  });

  test("returns fetch-error evidence for non-timeout transport failures", async () => {
    const port = createLgtmTelemetryQueryPort({
      mimirBaseUrl: "http://mimir:9009/prometheus",
      tempoBaseUrl: "http://tempo:3200",
      lokiBaseUrl: "http://loki:3100",
      fetchImpl: (async () => {
        throw new Error("connection reset");
      }) as typeof fetch,
    });
    const range = { start: "2026-05-31T00:00:00.000Z", end: "2026-05-31T01:00:00.000Z" };

    deepEqual(await port.queryMetrics("org_lane_ticks_total", range), {
      status: "degraded",
      source: "mimir",
      reason: "fetch_error",
      message: "mimir telemetry query fetch failed: connection reset",
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
