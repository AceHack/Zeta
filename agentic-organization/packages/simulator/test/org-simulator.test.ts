import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import type { OrgEvent } from "../../domain/src/index.ts";
import {
  DefaultSimulationScenarioLibrary,
  SimulationScenarioKind,
  createInMemorySimulationAdapters,
  evaluateSimulationRisk,
  runOrgPolicySimulation,
  type SimulationPolicyOverlay,
  type SimulationWorkEvent,
} from "../src/index.ts";

const Stream: readonly SimulationWorkEvent[] = [
  { eventId: "evt-intake-1", kind: "work_intake", occurredAt: "2026-05-31T12:00:00.000Z", workItemId: "work-1", priority: 90 },
  { eventId: "evt-intake-2", kind: "work_intake", occurredAt: "2026-05-31T12:01:00.000Z", workItemId: "work-2", priority: 70 },
  { eventId: "evt-complete-1", kind: "work_completed", occurredAt: "2026-05-31T12:10:00.000Z", workItemId: "work-1", leadTimeMs: 600_000 },
  { eventId: "evt-review-1", kind: "review_lag", occurredAt: "2026-05-31T12:11:00.000Z", workItemId: "work-1", lagMs: 180_000 },
  { eventId: "evt-defect-1", kind: "escaped_defect", occurredAt: "2026-05-31T12:12:00.000Z", workItemId: "work-1", severity: "class_b" },
  { eventId: "evt-claim-1", kind: "stale_claim", occurredAt: "2026-05-31T12:13:00.000Z", workItemId: "work-2" },
  { eventId: "evt-incident-1", kind: "incident", occurredAt: "2026-05-31T12:14:00.000Z", workItemId: "work-2" },
];

const Baseline: SimulationPolicyOverlay = {
  overlayId: "baseline",
  autonomyLevel: "assisted",
  modelMapping: { code_reviewer: "gpt-5.5" },
  modelCostPerWorkItem: 10,
  throughputMultiplier: 1,
  leadTimeMultiplier: 1,
  defectMultiplier: 1,
  reviewLagMultiplier: 1,
  staleClaimMultiplier: 1,
  incidentMultiplier: 1,
  gateQuorum: 2,
};

test("org policy simulation is deterministic for a fixed seed and input stream", () => {
  const input = {
    organizationId: "org-lfg",
    seed: "sim-seed-1",
    stream: Stream,
    baseline: Baseline,
    candidate: { ...Baseline, overlayId: "candidate", leadTimeMultiplier: 0.75 },
  };

  const first = runOrgPolicySimulation(input);
  const second = runOrgPolicySimulation(input);

  deepEqual(first, second);
  equal(first.seed, "sim-seed-1");
  equal(first.baseline.overlayId, "baseline");
  equal(first.candidate.overlayId, "candidate");
});

test("candidate policy with lower cost but worse Class B quality is rejected", () => {
  const report = runOrgPolicySimulation({
    organizationId: "org-lfg",
    seed: "sim-cost-quality",
    stream: Stream,
    baseline: Baseline,
    candidate: {
      ...Baseline,
      overlayId: "cheap-but-risky",
      modelMapping: { code_reviewer: "qwen2:0.5b" },
      modelCostPerWorkItem: 2,
      defectMultiplier: 3,
    },
  });

  const decision = evaluateSimulationRisk(report, {
    maxEscapedDefectRegression: 0,
    maxClassBEscapedDefectRegression: 0,
    maxIncidentRegression: 0,
    maxConformanceFailureRegression: 0,
    minThroughputDelta: 0,
  });

  equal(decision.status, "rejected");
  equal(decision.reason, "escaped_defect_regression");
  ok(report.candidate.metrics.cost < report.baseline.metrics.cost);
  ok(report.candidate.metrics.escapedDefects > report.baseline.metrics.escapedDefects);
});

test("candidate policy with Class B quality regression is rejected even when total defects are flat", () => {
  const report = runOrgPolicySimulation({
    organizationId: "org-lfg",
    seed: "sim-class-b-risk",
    stream: Stream,
    baseline: { ...Baseline, classBEscapedDefectMultiplier: 1 },
    candidate: {
      ...Baseline,
      overlayId: "class-b-regressed",
      classBEscapedDefectMultiplier: 2,
    },
  });

  const decision = evaluateSimulationRisk(report, {
    maxEscapedDefectRegression: 0,
    maxClassBEscapedDefectRegression: 0,
    maxIncidentRegression: 0,
    maxConformanceFailureRegression: 0,
    minThroughputDelta: 0,
  });

  equal(decision.status, "rejected");
  equal(decision.reason, "class_b_escaped_defect_regression");
  equal(report.candidate.metrics.escapedDefects, report.baseline.metrics.escapedDefects);
  ok(report.candidate.metrics.classBEscapedDefects > report.baseline.metrics.classBEscapedDefects);
});

test("candidate schedule that improves lead time without raising defects is accepted", () => {
  const report = runOrgPolicySimulation({
    organizationId: "org-lfg",
    seed: "sim-schedule",
    stream: Stream,
    baseline: Baseline,
    candidate: {
      ...Baseline,
      overlayId: "schedule-rebalance",
      schedulePolicy: "rebalance_critical_hats",
      leadTimeMultiplier: 0.5,
      reviewLagMultiplier: 0.5,
      staleClaimMultiplier: 0.5,
    },
  });

  const decision = evaluateSimulationRisk(report, {
    maxEscapedDefectRegression: 0,
    maxClassBEscapedDefectRegression: 0,
    maxIncidentRegression: 0,
    maxConformanceFailureRegression: 0,
    minThroughputDelta: 0,
  });

  equal(decision.status, "accepted");
  equal(decision.reason, "candidate_beats_baseline");
  ok(report.candidate.metrics.leadTimeP50Ms < report.baseline.metrics.leadTimeP50Ms);
  equal(report.candidate.metrics.escapedDefects, report.baseline.metrics.escapedDefects);
});

test("replay dedupes identical event ids and rejects conflicting duplicate ids", () => {
  const duplicate = runOrgPolicySimulation({
    organizationId: "org-lfg",
    seed: "sim-duplicate",
    stream: [...Stream, Stream[2]!],
    baseline: Baseline,
    candidate: { ...Baseline, overlayId: "candidate" },
  });

  equal(duplicate.baseline.metrics.completed, 1);
  deepEqual(duplicate.replayedEventIds.filter((eventId) => eventId === "evt-complete-1"), ["evt-complete-1"]);

  throws(
    () => runOrgPolicySimulation({
      organizationId: "org-lfg",
      seed: "sim-conflict",
      stream: [
        ...Stream,
        { eventId: "evt-complete-1", kind: "work_completed", occurredAt: "2026-05-31T12:10:00.000Z", workItemId: "work-1", leadTimeMs: 900_000 },
      ],
      baseline: Baseline,
      candidate: { ...Baseline, overlayId: "candidate" },
    }),
    /conflicting duplicate simulation event id: evt-complete-1/,
  );
});

test("in-memory org adapters feed cadence and observe-act replay decisions", () => {
  const adapters = createInMemorySimulationAdapters({
    orgStateItems: [{ itemId: "project-1", kind: "project", status: "active" }],
    hatQueues: [{
      queueId: "queue-backend",
      hatId: "backend_implementer",
      priorityClass: "p1",
      readyShards: 3,
      claimedShards: 1,
      slaDeadlineAt: "2026-05-31T13:00:00.000Z",
    }],
    reputations: [{
      agentId: "agent-1",
      hatId: "backend_implementer",
      mean: 0.8,
      confidence: 0.7,
    }],
    schedules: [{
      scheduleId: "schedule-1",
      hatId: "backend_implementer",
      activeBlocks: 1,
      staleBlocks: 1,
    }],
    promptFlowRuns: [{
      runId: "flow-1",
      hatId: "backend_implementer",
      state: "running",
      blocked: false,
    }],
    telemetrySummaries: [{
      metricId: "review_lag_p95",
      hatId: "backend_implementer",
      value: 120_000,
      unit: "ms",
    }],
  });

  const report = runOrgPolicySimulation({
    organizationId: "org-lfg",
    seed: "sim-adapters",
    stream: Stream,
    adapters,
    baseline: Baseline,
    candidate: {
      ...Baseline,
      overlayId: "queue-aware-scheduler",
      schedulePolicy: "rebalance_critical_hats",
      queuePriorityWeights: { p1: 2 },
      rmoParams: { capacityMultiplier: 1.5 },
      reputationExplorationRate: 0.2,
    },
  });

  equal(report.adapterSnapshot.hatQueues.length, 1);
  ok(report.candidate.metrics.throughput > report.baseline.metrics.throughput);
  ok(report.candidate.metrics.reviewLagP95Ms < report.baseline.metrics.reviewLagP95Ms);
  ok(report.candidate.cadenceLaneDecisions.some((decision) => decision.lane === "observe_act" && decision.action === "execute_prompt_flow"));
});

test("recorded org_event slices replay into simulator work events", () => {
  const orgEvents: readonly OrgEvent[] = [
    orgEvent("evt-org-intake", "intake_received", "work-org-1", "intake accepted", { occurredAt: "2026-05-31T12:00:00.000Z" }),
    orgEvent("evt-org-complete", "work_item_transition", "work-org-1", "completed work", { occurredAt: "2026-05-31T12:05:00.000Z", toState: "done" }),
    orgEvent("evt-org-review", "review_finding_raised", "work-org-1", "review finding", { occurredAt: "2026-05-31T12:06:00.000Z" }),
    orgEvent("evt-org-incident", "recovery_incident_detected", "work-org-1", "incident", { occurredAt: "2026-05-31T12:07:00.000Z" }),
  ];

  const report = runOrgPolicySimulation({
    organizationId: "org-lfg",
    seed: "sim-org-events",
    stream: [],
    orgEvents,
    baseline: Baseline,
    candidate: { ...Baseline, overlayId: "candidate" },
  });

  deepEqual(report.replayedEventIds, ["evt-org-intake", "evt-org-complete", "evt-org-review", "evt-org-incident"]);
  equal(report.baseline.metrics.intake, 1);
  equal(report.baseline.metrics.completed, 1);
  equal(report.baseline.metrics.escapedDefects, 1);
  equal(report.baseline.metrics.incidentCount, 1);
});

test("scenario library covers the Phase 2 production stress cases", () => {
  deepEqual(
    DefaultSimulationScenarioLibrary.map((scenario) => scenario.kind),
    [
      SimulationScenarioKind.IncidentSpike,
      SimulationScenarioKind.ReviewBottleneck,
      SimulationScenarioKind.QaChurn,
      SimulationScenarioKind.AgentLoss,
      SimulationScenarioKind.DependencyOutage,
      SimulationScenarioKind.ModelDegradation,
    ],
  );
});

function orgEvent(
  id: string,
  kind: OrgEvent["kind"],
  subjectId: string,
  decision: string,
  override: Partial<OrgEvent> = {},
): OrgEvent {
  return {
    id,
    kind,
    occurredAt: "2026-05-31T12:00:00.000Z",
    organizationId: "org-lfg",
    actorHatId: "backend_implementer",
    subjectId,
    decision,
    supervisorChain: ["executive_board", "coo", "backend_implementer"],
    evidenceRefs: [],
    correlationId: id,
    causationId: id,
    traceId: id,
    ...override,
  };
}
