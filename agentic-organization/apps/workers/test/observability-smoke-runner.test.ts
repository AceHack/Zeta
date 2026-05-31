import { equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { runObservabilitySmoke } from "../../../deploy/run-observability-smoke.ts";

describe("observability smoke proof runner", () => {
  test("emits a probe span and verifies Tempo and Grafana surfaces", async () => {
    const requestedUrls: string[] = [];
    const proof = await runObservabilitySmoke({
      otlpEndpoint: "http://otel-collector:4318",
      tempoApiUrl: "http://tempo:3200",
      grafanaApiUrl: "http://grafana:3000",
      now: () => "2026-05-31T00:00:00.000Z",
      fetch: async (url, init) => {
        requestedUrls.push(url);
        if (url === "http://otel-collector:4318/v1/traces" && init?.method === "POST") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url.startsWith("http://tempo:3200/api/search")) {
          return { ok: true, status: 200, json: async () => ({ traces: [{ traceID: "observability-smoke-trace" }] }) };
        }
        if (url === "http://grafana:3000/api/search?query=Agentic%20Organization%20Health") {
          return { ok: true, status: 200, json: async () => ([{ uid: "agentic-org-health" }]) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      },
    });

    equal(proof.PROOF, "PASS");
    equal(proof.spanExported, true);
    equal(proof.traceQueryable, true);
    equal(proof.dashboardConfigured, true);
    equal(requestedUrls.includes("http://otel-collector:4318/v1/traces"), true);
  });
});
