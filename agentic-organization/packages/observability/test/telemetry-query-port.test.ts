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
    const port = createLgtmTelemetryQueryPort({
      mimirBaseUrl: "http://mimir:9009/prometheus",
      tempoBaseUrl: "http://tempo:3200",
      lokiBaseUrl: "http://loki:3100",
      stepSeconds: 60,
      fetchImpl: (async (url) => {
        urls.push(String(url));
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

    deepEqual(await port.queryMetrics("org_agent_tokens_total", range), [
      {
        labels: { agentic_hat: "reviewer" },
        points: [{ timestamp: "2026-05-31T00:00:00.000Z", value: 3 }],
      },
    ]);
    deepEqual(await port.queryTraces('{ org.work_item_id = "work-001" }', range), [
      { traceId: "trace-001", rootName: "org.command", spanCount: 3 },
    ]);
    deepEqual(await port.queryLogs('{app="agentic-org-worker"}', range), [
      {
        timestamp: "2026-05-31T00:00:00.000Z",
        line: "latency regression",
        labels: { app: "agentic-org-worker" },
      },
    ]);
    deepEqual(urls.map((url) => new URL(url).hostname), ["mimir", "tempo", "loki"]);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
