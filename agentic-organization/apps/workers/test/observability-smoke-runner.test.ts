import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { runObservabilitySmoke, tempoSearchIncludesTrace } from "../../../deploy/run-observability-smoke.ts";

describe("observability smoke proof runner", () => {
  test("emits a probe span and verifies Tempo and Grafana surfaces", async () => {
    const requestedUrls: string[] = [];
    const metricBodies: unknown[] = [];
    const grafanaAuthorizationHeaders: (string | undefined)[] = [];
    let exportedTraceId = "";
    const proof = await runObservabilitySmoke({
      otlpEndpoint: "http://otel-collector:4318",
      tempoApiUrl: "http://tempo:3200",
      grafanaApiUrl: "http://grafana:3000",
      grafanaBasicAuth: { username: "admin", password: "smoke-token" },
      now: () => "2026-05-31T00:00:00.000Z",
      fetch: async (url, init) => {
        requestedUrls.push(url);
        if (url === "http://otel-collector:4318/v1/traces" && init?.method === "POST") {
          const body = JSON.parse(init.body ?? "{}") as OtlpTestBody;
          exportedTraceId = body.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0]?.traceId ?? "";
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url === "http://otel-collector:4318/v1/metrics" && init?.method === "POST") {
          metricBodies.push(JSON.parse(init.body ?? "{}"));
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url.startsWith("http://tempo:3200/api/search")) {
          return { ok: true, status: 200, json: async () => ({ traces: [{ traceID: exportedTraceId }] }) };
        }
        if (url === "http://grafana:3000/api/search?query=Agentic%20Organization%20Health") {
          grafanaAuthorizationHeaders.push(init?.headers?.Authorization);
          return { ok: true, status: 200, json: async () => ([{ uid: "agentic-org-health" }]) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      },
    });

    equal(proof.PROOF, "PASS");
    equal(proof.spanExported, true);
    equal(proof.metricPostsAccepted, true);
    equal(proof.traceQueryable, true);
    equal(proof.dashboardConfigured, true);
    deepEqual(proof.metricKindMappings, [
      { kind: "counter", otlpShape: "sum", metricName: "org_observability_smoke_total" },
      { kind: "gauge", otlpShape: "gauge", metricName: "org_observability_smoke_pressure_ratio" },
      { kind: "histogram", otlpShape: "histogram", metricName: "org_observability_smoke_latency_ms" },
    ]);
    equal(requestedUrls.includes("http://otel-collector:4318/v1/traces"), true);
    const metrics = metricBodies.map((body) => metricFromSmokeBody(body));
    equal(metrics[0]?.name, "org_observability_smoke_total");
    equal(metrics[0]?.sum?.isMonotonic, true);
    equal(metrics[1]?.name, "org_observability_smoke_pressure_ratio");
    equal(metrics[1]?.gauge?.dataPoints?.[0]?.asDouble, 0.5);
    equal(metrics[2]?.name, "org_observability_smoke_latency_ms");
    equal(metrics[2]?.histogram?.dataPoints?.[0]?.sum, 1);
    equal(grafanaAuthorizationHeaders[0], "Basic YWRtaW46c21va2UtdG9rZW4=");
  });

  test("fails the proof when OTLP metric exports are rejected", async () => {
    const proof = await runObservabilitySmoke({
      otlpEndpoint: "http://otel-collector:4318",
      tempoApiUrl: "http://tempo:3200",
      grafanaApiUrl: "http://grafana:3000",
      tempoQueryMaxAttempts: 1,
      now: () => "2026-05-31T00:00:00.000Z",
      fetch: async (url, init) => {
        if (url === "http://otel-collector:4318/v1/traces" && init?.method === "POST") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url === "http://otel-collector:4318/v1/metrics" && init?.method === "POST") {
          return { ok: false, status: 500, json: async () => ({}) };
        }
        if (url.startsWith("http://tempo:3200/api/search")) {
          return { ok: true, status: 200, json: async () => ({ traces: [{ traceID: "not-checked-because-metrics-fail" }] }) };
        }
        if (url === "http://grafana:3000/api/search?query=Agentic%20Organization%20Health") {
          return { ok: true, status: 200, json: async () => ([{ uid: "agentic-org-health" }]) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      },
    });

    equal(proof.metricPostsAccepted, false);
    equal(proof.PROOF, "FAIL");
  });

  test("fails the proof when the OTLP trace export is rejected", async () => {
    const proof = await runObservabilitySmoke({
      otlpEndpoint: "http://otel-collector:4318",
      tempoApiUrl: "http://tempo:3200",
      grafanaApiUrl: "http://grafana:3000",
      tempoQueryMaxAttempts: 1,
      now: () => "2026-05-31T00:00:00.000Z",
      fetch: async (url, init) => {
        if (url === "http://otel-collector:4318/v1/traces" && init?.method === "POST") {
          return { ok: false, status: 500, json: async () => ({}) };
        }
        if (url === "http://otel-collector:4318/v1/metrics" && init?.method === "POST") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url.startsWith("http://tempo:3200/api/search")) {
          return { ok: true, status: 200, json: async () => ({ traces: [{ traceID: "not-checked-because-export-failed" }] }) };
        }
        if (url === "http://grafana:3000/api/search?query=Agentic%20Organization%20Health") {
          return { ok: true, status: 200, json: async () => ([{ uid: "agentic-org-health" }]) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      },
    });

    equal(proof.spanExported, false);
    equal(proof.PROOF, "FAIL");
  });

  test("fails the proof when Tempo returns no matching trace", async () => {
    const proof = await runObservabilitySmoke({
      otlpEndpoint: "http://otel-collector:4318",
      tempoApiUrl: "http://tempo:3200",
      grafanaApiUrl: "http://grafana:3000",
      tempoQueryMaxAttempts: 1,
      now: () => "2026-05-31T00:00:00.000Z",
      fetch: async (url, init) => {
        if (url === "http://otel-collector:4318/v1/traces" && init?.method === "POST") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url === "http://otel-collector:4318/v1/metrics" && init?.method === "POST") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url.startsWith("http://tempo:3200/api/search")) {
          return { ok: true, status: 200, json: async () => ({ traces: [] }) };
        }
        if (url === "http://grafana:3000/api/search?query=Agentic%20Organization%20Health") {
          return { ok: true, status: 200, json: async () => ([{ uid: "agentic-org-health" }]) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      },
    });

    equal(proof.traceQueryable, false);
    equal(proof.PROOF, "FAIL");
  });

  test("retries Tempo search until the emitted trace becomes queryable", async () => {
    let exportedTraceId = "";
    let tempoQueryCount = 0;
    const proof = await runObservabilitySmoke({
      otlpEndpoint: "http://otel-collector:4318",
      tempoApiUrl: "http://tempo:3200",
      grafanaApiUrl: "http://grafana:3000",
      tempoQueryMaxAttempts: 2,
      tempoQueryRetryDelayMs: 0,
      now: () => "2026-05-31T00:00:00.000Z",
      fetch: async (url, init) => {
        if (url === "http://otel-collector:4318/v1/traces" && init?.method === "POST") {
          const body = JSON.parse(init.body ?? "{}") as OtlpTestBody;
          exportedTraceId = body.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0]?.traceId ?? "";
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url === "http://otel-collector:4318/v1/metrics" && init?.method === "POST") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url.startsWith("http://tempo:3200/api/search")) {
          tempoQueryCount += 1;
          return tempoQueryCount === 1
            ? { ok: true, status: 200, json: async () => ({ traces: [] }) }
            : { ok: true, status: 200, json: async () => ({ traces: [{ traceID: exportedTraceId }] }) };
        }
        if (url === "http://grafana:3000/api/search?query=Agentic%20Organization%20Health") {
          return { ok: true, status: 200, json: async () => ([{ uid: "agentic-org-health" }]) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      },
    });

    equal(tempoQueryCount, 2);
    equal(proof.traceQueryable, true);
    equal(proof.PROOF, "PASS");
  });

  test("matches Tempo trace ids that omit leading zeroes", () => {
    equal(
      tempoSearchIncludesTrace(
        { traces: [{ traceID: "1eca833d5224c8697b1626d29acf304" }] },
        "01eca833d5224c8697b1626d29acf304",
      ),
      true,
    );
  });
});

function metricFromSmokeBody(body: unknown): OtlpTestMetric | undefined {
  return (body as OtlpTestBody).resourceMetrics?.[0]?.scopeMetrics?.[0]?.metrics?.[0];
}

type OtlpTestBody = {
  resourceSpans?: { scopeSpans?: { spans?: { traceId?: string }[] }[] }[];
  resourceMetrics?: { scopeMetrics?: { metrics?: OtlpTestMetric[] }[] }[];
};

type OtlpTestMetric = {
  name: string;
  sum?: {
    isMonotonic?: boolean;
  };
  gauge?: {
    dataPoints?: { asDouble?: number }[];
  };
  histogram?: {
    dataPoints?: { sum?: number }[];
  };
};
