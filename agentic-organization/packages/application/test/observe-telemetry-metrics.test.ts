import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import { RecordingTelemetryQueryPort } from "../../observability/src/index.ts";
import { buildHatDefinitions } from "../src/org-seed.ts";
import {
  asZetaIdDecimal,
  createTelemetryScopedMetricAgents,
  observeAgentSurface,
  ObserveOutcome,
  RunLifecyclePhase,
  RunScope,
  type AgentObserveSnapshot,
} from "../src/observe.ts";

test("telemetry-backed metric agents query metrics, traces, and logs for the current observe scope", async () => {
  const telemetry = new RecordingTelemetryQueryPort({
    metrics: [
      {
        labels: { agentic_scope: "work_item" },
        points: [
          { timestamp: "2026-05-31T11:59:00.000Z", value: 2 },
          { timestamp: "2026-05-31T12:00:00.000Z", value: 5 },
        ],
      },
    ],
    traces: [
      { traceId: "trace-1", rootName: "org.command", spanCount: 4 },
      { traceId: "trace-2", rootName: "org.mcp.dispatch", spanCount: 3 },
    ],
    logs: [
      { timestamp: "2026-05-31T12:00:00.000Z", line: "retry", labels: { level: "warn" } },
    ],
  });
  const range = { start: "2026-05-31T11:00:00.000Z", end: "2026-05-31T12:00:00.000Z" };

  const surface = await observeAgentSurface(agentSnapshot(), {
    clock: { now: () => range.end },
    metricAgents: createTelemetryScopedMetricAgents({ telemetry, range }),
  });

  equal(surface.outcome, ObserveOutcome.Readout);
  if (surface.outcome !== ObserveOutcome.Readout) return;
  deepEqual(surface.metrics.blocks, [
    { id: "telemetry.command_total", label: "commands in range", value: 5, unit: "count" },
    { id: "telemetry.trace_count", label: "traces in range", value: 2, unit: "trace" },
    { id: "telemetry.warning_log_count", label: "warning logs in range", value: 1, unit: "log" },
  ]);
  deepEqual(telemetry.calls, [
    {
      kind: "metrics",
      query: 'sum(org_command_total{agentic_scope="work_item"})',
      range,
    },
    {
      kind: "traces",
      query: '{ agentic.scope = "work_item" }',
      range,
    },
    {
      kind: "logs",
      query: '{app="agentic-org-worker", agentic_scope="work_item", level=~"warn|error"}',
      range,
    },
  ]);
});

function agentSnapshot(): AgentObserveSnapshot {
  const hat = buildHatDefinitions().find((candidate) => candidate.id === "release_operator");
  if (hat === undefined) {
    throw new Error("release_operator hat missing from seed");
  }

  return {
    runId: asZetaIdDecimal("42"),
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.AwaitingGate,
    trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
    hasGateApproval: true,
    hasEvidence: false,
    hatAssignmentId: asZetaIdDecimal("99"),
    hat,
  };
}
