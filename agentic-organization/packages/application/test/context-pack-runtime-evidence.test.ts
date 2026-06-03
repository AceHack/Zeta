import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { GraphNodeKind, graphNodeId } from "../../domain/src/index.ts";
import { RecordingTelemetryQueryPort, type TelemetryQueryPort } from "../../observability/src/index.ts";
import {
  ContextPackFreshness,
  ContextPackItemKind,
  ContextPackOmissionReason,
  ContextPackSourcePointerKind,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  buildHatDefinitions,
  createLgtmContextPackRuntimeEvidencePort,
  type ContextPackItem,
  type ContextPackTelemetryEvidenceRequest,
} from "../src/index.ts";

const observedAt = "2026-06-01T00:00:00.000Z";
const releaseOperator = buildHatDefinitions().find((hat) => hat.id === "release_operator")!;

test("LGTM context-pack runtime evidence returns trace context for scoped lifecycle trace anchors", async () => {
  const telemetry = new RecordingTelemetryQueryPort({
    traces: [{ traceId: "trace-release-timeout", rootName: "release.worker", spanCount: 7 }],
    logs: [{
      timestamp: "2026-06-01T00:00:03.000Z",
      line: "trace-release-timeout release worker timeout",
      labels: { trace_id: "trace-release-timeout", level: "error" },
    }],
    metrics: [{
      labels: { trace_id: "trace-release-timeout", __name__: "agentic_runtime_signal" },
      points: [{ timestamp: "2026-06-01T00:00:00.000Z", value: 1 }],
    }],
  });
  const port = createLgtmContextPackRuntimeEvidencePort({
    telemetry,
    range: { start: "2026-05-31T23:00:00.000Z", end: observedAt },
  });

  const result = await port.load(runtimeEvidenceRequest([lifecycleTraceItem("trace-release-timeout", "work-release")]));

  equal(result.items.length, 1);
  equal(result.items[0]?.kind, ContextPackItemKind.Trace);
  equal(result.items[0]?.freshness, ContextPackFreshness.Live);
  ok(result.items[0]?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.Trace &&
    pointer.traceId === "trace-release-timeout"
  ));
  ok(result.items[0]?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.Log &&
    pointer.source === "loki"
  ));
  ok(result.items[0]?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.Metric &&
    pointer.source === "mimir"
  ));
  ok(result.graphRootSeeds?.some((seed) =>
    seed.nodeId === graphNodeId("org-1", GraphNodeKind.Trace, "trace-release-timeout")
  ));
  equal(telemetry.calls.map((call) => call.kind).join(","), "traces,logs,metrics");
});

test("LGTM context-pack runtime evidence turns degraded telemetry into omissions", async () => {
  const telemetry: TelemetryQueryPort = {
    queryTraces: async () => ({
      status: "degraded",
      source: "tempo",
      reason: "fetch_error",
      message: "tempo unavailable",
    }),
    queryLogs: async () => ({ status: "ok", source: "loki", data: [] }),
    queryMetrics: async () => ({ status: "ok", source: "mimir", data: [] }),
  };
  const port = createLgtmContextPackRuntimeEvidencePort({
    telemetry,
    range: { start: "2026-05-31T23:00:00.000Z", end: observedAt },
  });

  const result = await port.load(runtimeEvidenceRequest([lifecycleTraceItem("trace-release-timeout", "work-release")]));

  equal(result.items.length, 0);
  ok(result.omittedItemsWithReason?.some((item) =>
    item.nodeId === "telemetry_evidence:trace" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("tempo unavailable")
  ));
});

test("LGTM context-pack runtime evidence refuses trace evidence without active scoped work anchor", async () => {
  const telemetry = new RecordingTelemetryQueryPort({
    traces: [{ traceId: "trace-other", rootName: "other.worker", spanCount: 2 }],
  });
  const port = createLgtmContextPackRuntimeEvidencePort({
    telemetry,
    range: { start: "2026-05-31T23:00:00.000Z", end: observedAt },
  });

  const result = await port.load(runtimeEvidenceRequest([lifecycleTraceItem("trace-other", "work-other")]));

  equal(result.items.length, 0);
  equal(telemetry.calls.length, 0);
});

function runtimeEvidenceRequest(items: readonly ContextPackItem[]): ContextPackTelemetryEvidenceRequest {
  return {
    query: "release context",
    observedAt,
    request: {
      observedAt,
      snapshot: {
        runId: asZetaIdDecimal("1"),
        scope: RunScope.WorkItem,
        phase: RunLifecyclePhase.Failed,
        trace: { correlationId: "corr-release", causationId: "cause-release", traceId: "trace-release" },
        hasGateApproval: false,
        hasEvidence: true,
        hatAssignmentId: asZetaIdDecimal("99"),
        hat: releaseOperator,
        agentId: "agent-release",
        organizationId: "org-1",
        projectId: "project-release",
        teamId: "team-release",
        workItemId: "work-release",
      },
      readout: {
        runId: asZetaIdDecimal("1"),
        scope: RunScope.WorkItem,
        phase: RunLifecyclePhase.Failed,
        trace: { correlationId: "corr-release", causationId: "cause-release", traceId: "trace-release" },
        observedAt,
        options: [],
        vetoedOptions: [],
        deterministicRulesApplied: [],
      },
      metrics: { scope: RunScope.WorkItem, blocks: [] },
      promptFlows: { tasks: [], vetoedTasks: [] },
      hierarchy: {
        level: releaseOperator.level,
        projects: [],
        initiatives: [],
        metrics: [],
        policyViolations: [],
        priorityScope: "current_work_item",
        priorityItems: [],
        scopedMetrics: [],
        actions: [],
        vetoedActions: [],
      },
    },
    items,
  };
}

function lifecycleTraceItem(traceId: string, workItemId: string): ContextPackItem {
  return {
    id: `quality_gate:${traceId}`,
    kind: ContextPackItemKind.Evidence,
    title: "Runtime gate evidence",
    summary: "Runtime evidence points at an LGTM trace.",
    sourceRef: `quality_gate:${traceId}`,
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 0.97,
    reasons: ["lifecycle_anchor:quality_gate"],
    sourcePointers: [
      { kind: ContextPackSourcePointerKind.Trace, traceId },
      { kind: ContextPackSourcePointerKind.WorkItem, workItemId },
    ],
  };
}
