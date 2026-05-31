import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { ChangeArtifactKind, ChangeSetPhase } from "../../domain/src/index.ts";
import { RecordingTelemetryQueryPort, type TelemetryQueryPort } from "../../observability/src/index.ts";
import {
  TelemetryImprovementMetricKind,
  TelemetryImprovementProposalMode,
  createContentAddressedEvidenceRef,
  runTelemetryImprovementOptimizer,
} from "../src/index.ts";

const NOW = "2026-05-31T18:45:00.000Z";
const RANGE = { start: "2026-05-31T17:45:00.000Z", end: NOW };
const TelemetryEvidenceRef = createContentAddressedEvidenceRef("telemetry-regression", { metric: "review_p95" });
const SimulationEvidenceRef = createContentAddressedEvidenceRef("simulation-report", { scenario: "review-p95" });

test("synthetic telemetry latency regression produces an evidence-backed improvement ChangeSet", async () => {
  const queryPort = new RecordingTelemetryQueryPort({
    metrics: [{
      labels: { hat: "code_reviewer", metric: "review_p95_ms" },
      points: [
        { timestamp: "2026-05-31T17:45:00.000Z", value: 100 },
        { timestamp: "2026-05-31T18:00:00.000Z", value: 110 },
        { timestamp: "2026-05-31T18:30:00.000Z", value: 340 },
        { timestamp: "2026-05-31T18:45:00.000Z", value: 360 },
      ],
    }],
    logs: [{ timestamp: NOW, line: "review p95 rose after queue policy change", labels: { hat: "code_reviewer" } }],
    traces: [{ traceId: "trace-review-p95", rootName: "org.review", spanCount: 7 }],
  });

  const result = await runTelemetryImprovementOptimizer({
    organizationId: "org-lfg",
    workItemId: "work-improve-review-p95",
    proposerHatId: "decision_optimizer",
    targetRef: "tenant-config/org-lfg.json",
    now: NOW,
    queryPort,
    range: RANGE,
    telemetryEvidenceRef: TelemetryEvidenceRef,
    simulationEvidenceRef: SimulationEvidenceRef,
    simulationDecision: { status: "accepted", reason: "candidate_beats_baseline" },
    trigger: {
      metricKind: TelemetryImprovementMetricKind.ReviewP95Ms,
      metricQuery: "histogram_quantile(0.95, org_review_duration_ms)",
      logQuery: "{app=\"agentic-org-worker\"} |= \"review p95\"",
      traceQuery: "{ name = \"org.review\" }",
      minimumRelativeChange: 1,
      direction: "increase_bad",
      suspectedCause: "review queue saturation",
      proposedChange: {
        kind: "policy",
        summary: "rebalance reviewer capacity when review p95 doubles",
        before: "static reviewer allocation",
        after: "pressure-aware reviewer allocation",
      },
      expectedMetricMovement: { metric: "review_p95_ms", direction: "decrease", minimumRelativeChange: 0.25 },
      rollbackCondition: "review_p95_ms remains above baseline by 50% for two windows",
    },
  });

  equal(result.kind, "proposed");
  if (result.kind !== "proposed") throw new Error("expected telemetry improvement proposal");
  equal(result.changeSet.phase, ChangeSetPhase.Drafted);
  equal(result.changeSet.artifacts[0]?.kind, ChangeArtifactKind.DecisionRecord);
  equal(result.hypothesis.symptom.metricKind, TelemetryImprovementMetricKind.ReviewP95Ms);
  equal(result.hypothesis.symptom.relativeChange >= 2, true);
  deepEqual(result.event.evidenceRefs, [TelemetryEvidenceRef, SimulationEvidenceRef]);
  deepEqual(queryPort.calls.map((call) => call.kind), ["metrics", "logs", "traces"]);
});

test("telemetry backend outage blocks telemetry-driven proposal with degraded evidence", async () => {
  const queryPort: TelemetryQueryPort = {
    queryMetrics: async () => ({
      status: "degraded",
      source: "mimir",
      reason: "timeout",
      message: "mimir telemetry query timed out",
    }),
    queryLogs: async () => ({ status: "ok", source: "recording", data: [] }),
    queryTraces: async () => ({ status: "ok", source: "recording", data: [] }),
  };

  const result = await runTelemetryImprovementOptimizer({
    organizationId: "org-lfg",
    workItemId: "work-improve-review-p95",
    proposerHatId: "decision_optimizer",
    targetRef: "tenant-config/org-lfg.json",
    now: NOW,
    queryPort,
    range: RANGE,
    telemetryEvidenceRef: TelemetryEvidenceRef,
    simulationEvidenceRef: SimulationEvidenceRef,
    simulationDecision: { status: "accepted", reason: "candidate_beats_baseline" },
    trigger: defaultTrigger(),
  });

  deepEqual(result, {
    kind: "no_proposal",
    reason: "telemetry_degraded",
    degradedSources: ["mimir:timeout"],
  });
});

test("noisy metric fluctuation below threshold does not produce a proposal", async () => {
  const queryPort = new RecordingTelemetryQueryPort({
    metrics: [{
      labels: { hat: "code_reviewer", metric: "review_p95_ms" },
      points: [
        { timestamp: "2026-05-31T17:45:00.000Z", value: 100 },
        { timestamp: "2026-05-31T18:00:00.000Z", value: 105 },
        { timestamp: "2026-05-31T18:30:00.000Z", value: 112 },
        { timestamp: "2026-05-31T18:45:00.000Z", value: 108 },
      ],
    }],
  });

  const result = await runTelemetryImprovementOptimizer({
    organizationId: "org-lfg",
    workItemId: "work-improve-review-p95",
    proposerHatId: "decision_optimizer",
    targetRef: "tenant-config/org-lfg.json",
    now: NOW,
    queryPort,
    range: RANGE,
    telemetryEvidenceRef: TelemetryEvidenceRef,
    simulationEvidenceRef: SimulationEvidenceRef,
    simulationDecision: { status: "accepted", reason: "candidate_beats_baseline" },
    trigger: defaultTrigger(),
  });

  deepEqual(result, {
    kind: "no_proposal",
    reason: "below_change_threshold",
    observedRelativeChange: 0.073,
  });
});

test("post-change regression produces a rollback proposal instead of another rollout", async () => {
  const queryPort = new RecordingTelemetryQueryPort({
    metrics: [{
      labels: { hat: "code_reviewer", metric: "review_p95_ms" },
      points: [
        { timestamp: "2026-05-31T17:45:00.000Z", value: 180 },
        { timestamp: "2026-05-31T18:00:00.000Z", value: 170 },
        { timestamp: "2026-05-31T18:30:00.000Z", value: 390 },
        { timestamp: "2026-05-31T18:45:00.000Z", value: 410 },
      ],
    }],
    logs: [{ timestamp: NOW, line: "post-change review p95 regression after cs-123", labels: { changeSetId: "cs-123" } }],
  });

  const result = await runTelemetryImprovementOptimizer({
    organizationId: "org-lfg",
    workItemId: "work-rollback-review-p95",
    proposerHatId: "decision_optimizer",
    targetRef: "change-sets/cs-123",
    now: NOW,
    queryPort,
    range: RANGE,
    telemetryEvidenceRef: TelemetryEvidenceRef,
    simulationEvidenceRef: SimulationEvidenceRef,
    simulationDecision: { status: "accepted", reason: "candidate_beats_baseline" },
    rolledOutChangeSetId: "cs-123",
    trigger: { ...defaultTrigger(), logQuery: "{app=\"agentic-org-worker\"} |= \"post-change review p95\"" },
  });

  equal(result.kind, "proposed");
  if (result.kind !== "proposed") throw new Error("expected rollback proposal");
  equal(result.hypothesis.proposedChange.kind, "rollback");
  ok(result.changeSet.title.includes("Rollback cs-123"));
  deepEqual(result.event.evidenceRefs, [TelemetryEvidenceRef, SimulationEvidenceRef]);
});

test("post-change rollback is rejected without an explicit rolled-out ChangeSet target", async () => {
  const queryPort = new RecordingTelemetryQueryPort({
    metrics: [{
      labels: { hat: "code_reviewer", metric: "review_p95_ms" },
      points: [
        { timestamp: "2026-05-31T17:45:00.000Z", value: 100 },
        { timestamp: "2026-05-31T18:00:00.000Z", value: 100 },
        { timestamp: "2026-05-31T18:30:00.000Z", value: 300 },
        { timestamp: "2026-05-31T18:45:00.000Z", value: 300 },
      ],
    }],
    logs: [{ timestamp: NOW, line: "post-change review p95 regression", labels: { changeSetId: "cs-123" } }],
  });

  const result = await runTelemetryImprovementOptimizer({
    organizationId: "org-lfg",
    workItemId: "work-rollback-review-p95",
    proposerHatId: "decision_optimizer",
    targetRef: "change-sets/cs-123",
    now: NOW,
    queryPort,
    range: RANGE,
    telemetryEvidenceRef: TelemetryEvidenceRef,
    simulationEvidenceRef: SimulationEvidenceRef,
    simulationDecision: { status: "accepted", reason: "candidate_beats_baseline" },
    mode: TelemetryImprovementProposalMode.Rollback,
    trigger: { ...defaultTrigger(), logQuery: "{app=\"agentic-org-worker\"} |= \"post-change review p95\"" },
  });

  deepEqual(result, { kind: "no_proposal", reason: "missing_rollback_target" });
});

test("corroborating log or trace evidence is required before proposing a telemetry improvement", async () => {
  const queryPort = new RecordingTelemetryQueryPort({
    metrics: [{
      labels: { hat: "code_reviewer", metric: "review_p95_ms" },
      points: [
        { timestamp: "2026-05-31T17:45:00.000Z", value: 100 },
        { timestamp: "2026-05-31T18:00:00.000Z", value: 100 },
        { timestamp: "2026-05-31T18:30:00.000Z", value: 300 },
        { timestamp: "2026-05-31T18:45:00.000Z", value: 300 },
      ],
    }],
    logs: [],
    traces: [],
  });

  const result = await runTelemetryImprovementOptimizer({
    organizationId: "org-lfg",
    workItemId: "work-improve-review-p95",
    proposerHatId: "decision_optimizer",
    targetRef: "tenant-config/org-lfg.json",
    now: NOW,
    queryPort,
    range: RANGE,
    telemetryEvidenceRef: TelemetryEvidenceRef,
    simulationEvidenceRef: SimulationEvidenceRef,
    simulationDecision: { status: "accepted", reason: "candidate_beats_baseline" },
    trigger: {
      ...defaultTrigger(),
      logQuery: "{app=\"agentic-org-worker\"} |= \"review p95\"",
      traceQuery: "{ name = \"org.review\" }",
    },
  });

  deepEqual(result, { kind: "no_proposal", reason: "missing_causal_evidence" });
});

test("threshold decisions use raw relative change before rounding", async () => {
  const queryPort = new RecordingTelemetryQueryPort({
    metrics: [{
      labels: { hat: "code_reviewer", metric: "review_p95_ms" },
      points: [
        { timestamp: "2026-05-31T17:45:00.000Z", value: 10000 },
        { timestamp: "2026-05-31T18:00:00.000Z", value: 10000 },
        { timestamp: "2026-05-31T18:30:00.000Z", value: 19995 },
        { timestamp: "2026-05-31T18:45:00.000Z", value: 19995 },
      ],
    }],
    logs: [{ timestamp: NOW, line: "review p95 nearly doubled", labels: { hat: "code_reviewer" } }],
  });

  const result = await runTelemetryImprovementOptimizer({
    organizationId: "org-lfg",
    workItemId: "work-improve-review-p95",
    proposerHatId: "decision_optimizer",
    targetRef: "tenant-config/org-lfg.json",
    now: NOW,
    queryPort,
    range: RANGE,
    telemetryEvidenceRef: TelemetryEvidenceRef,
    simulationEvidenceRef: SimulationEvidenceRef,
    simulationDecision: { status: "accepted", reason: "candidate_beats_baseline" },
    trigger: { ...defaultTrigger(), logQuery: "{app=\"agentic-org-worker\"} |= \"review p95\"" },
  });

  deepEqual(result, {
    kind: "no_proposal",
    reason: "below_change_threshold",
    observedRelativeChange: 1,
  });
});

test("multiple telemetry proposals for one work target get distinct durable ids", async () => {
  const first = await runTelemetryImprovementOptimizer({
    organizationId: "org-lfg",
    workItemId: "work-improve-review-p95",
    proposerHatId: "decision_optimizer",
    targetRef: "tenant-config/org-lfg.json",
    now: NOW,
    queryPort: new RecordingTelemetryQueryPort({
      metrics: [{
        labels: { hat: "code_reviewer" },
        points: [
          { timestamp: "2026-05-31T17:45:00.000Z", value: 100 },
          { timestamp: "2026-05-31T18:00:00.000Z", value: 100 },
          { timestamp: "2026-05-31T18:30:00.000Z", value: 300 },
          { timestamp: "2026-05-31T18:45:00.000Z", value: 300 },
        ],
      }],
      logs: [{ timestamp: NOW, line: "review p95 doubled", labels: { hat: "code_reviewer" } }],
    }),
    range: RANGE,
    telemetryEvidenceRef: createContentAddressedEvidenceRef("telemetry-regression", { metric: "review_p95", window: 1 }),
    simulationEvidenceRef: SimulationEvidenceRef,
    simulationDecision: { status: "accepted", reason: "candidate_beats_baseline" },
    trigger: { ...defaultTrigger(), logQuery: "{app=\"agentic-org-worker\"} |= \"review p95\"" },
  });
  const second = await runTelemetryImprovementOptimizer({
    organizationId: "org-lfg",
    workItemId: "work-improve-review-p95",
    proposerHatId: "decision_optimizer",
    targetRef: "tenant-config/org-lfg.json",
    now: NOW,
    queryPort: new RecordingTelemetryQueryPort({
      metrics: [{
        labels: { hat: "code_reviewer" },
        points: [
          { timestamp: "2026-05-31T17:45:00.000Z", value: 200 },
          { timestamp: "2026-05-31T18:00:00.000Z", value: 200 },
          { timestamp: "2026-05-31T18:30:00.000Z", value: 500 },
          { timestamp: "2026-05-31T18:45:00.000Z", value: 500 },
        ],
      }],
      logs: [{ timestamp: NOW, line: "review p95 doubled again", labels: { hat: "code_reviewer" } }],
    }),
    range: RANGE,
    telemetryEvidenceRef: createContentAddressedEvidenceRef("telemetry-regression", { metric: "review_p95", window: 2 }),
    simulationEvidenceRef: SimulationEvidenceRef,
    simulationDecision: { status: "accepted", reason: "candidate_beats_baseline" },
    trigger: { ...defaultTrigger(), logQuery: "{app=\"agentic-org-worker\"} |= \"review p95\"" },
  });

  equal(first.kind, "proposed");
  equal(second.kind, "proposed");
  if (first.kind !== "proposed" || second.kind !== "proposed") throw new Error("expected proposals");
  ok(first.changeSet.changeSetId !== second.changeSet.changeSetId);
  ok(first.event.id !== second.event.id);
});

function defaultTrigger() {
  return {
    metricKind: TelemetryImprovementMetricKind.ReviewP95Ms,
    metricQuery: "histogram_quantile(0.95, org_review_duration_ms)",
    minimumRelativeChange: 1,
    direction: "increase_bad" as const,
    suspectedCause: "review queue saturation",
    proposedChange: {
      kind: "policy" as const,
      summary: "rebalance reviewer capacity when review p95 doubles",
      before: "static reviewer allocation",
      after: "pressure-aware reviewer allocation",
    },
    expectedMetricMovement: { metric: "review_p95_ms", direction: "decrease" as const, minimumRelativeChange: 0.25 },
    rollbackCondition: "review_p95_ms remains above baseline by 50% for two windows",
  };
}
