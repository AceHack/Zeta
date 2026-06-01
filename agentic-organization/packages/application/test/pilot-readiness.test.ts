import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  PilotDisasterDrillKind,
  PilotSloKind,
  evaluatePilotReadiness,
} from "../src/index.ts";

const NOW = "2026-06-01T00:00:00.000Z";

test("pilot readiness passes only when replay, soak, SLOs, drills, controls, and capabilities clear", () => {
  const report = evaluatePilotReadiness({
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    departmentId: "engineering",
    evaluatedAt: NOW,
    replay: { days: 7, illegalTransitionCount: 0 },
    soak: { hours: 24, degradedTickCount: 0 },
    controls: { estopDrillPassed: true, restoreDrillPassed: true },
    capabilities: {
      observeActPrimary: true,
      reputationUpdates: true,
      workMarketClaims: true,
      scheduleOptimization: true,
      simulatorRequiredPolicyChanges: true,
      telemetryOptimizer: true,
      estop: true,
    },
    slos: [
      slo(PilotSloKind.ConformancePassRatio, 1, 0.995, "higher_or_equal"),
      slo(PilotSloKind.LeadTimeMs, 3_600_000, 7_200_000, "lower_or_equal"),
      slo(PilotSloKind.ReviewLagMs, 900_000, 1_800_000, "lower_or_equal"),
      slo(PilotSloKind.QaBounceBackRate, 0.02, 0.05, "lower_or_equal"),
      slo(PilotSloKind.CostPerCompletedWorkItem, 1.2, 2, "lower_or_equal"),
      slo(PilotSloKind.StaleClaimRecoveryMs, 300_000, 600_000, "lower_or_equal"),
      slo(PilotSloKind.OperatorInterventionCount, 1, 3, "lower_or_equal"),
    ],
    disasterDrills: [
      drill(PilotDisasterDrillKind.AgentSilence),
      drill(PilotDisasterDrillKind.BadModelSelector),
      drill(PilotDisasterDrillKind.QueueOverload),
      drill(PilotDisasterDrillKind.ConformanceBreach),
      drill(PilotDisasterDrillKind.ProviderOutage),
      drill(PilotDisasterDrillKind.Rollback),
    ],
    incidents: [],
  });

  equal(report.status, "ready");
  deepEqual(report.blockers, []);
  deepEqual(report.backlog, []);
  equal(report.report.slos.length, 7);
  equal(report.report.disasterDrills.length, 6);
  ok(report.report.evidenceRefs.includes("pilot:replay:7d"));
  ok(report.report.evidenceRefs.includes("pilot:soak:24h"));
});

test("pilot readiness blocks unsafe pilots and creates backlog from measured gaps", () => {
  const report = evaluatePilotReadiness({
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    departmentId: "engineering",
    evaluatedAt: NOW,
    replay: { days: 6, illegalTransitionCount: 1 },
    soak: { hours: 12, degradedTickCount: 2 },
    controls: { estopDrillPassed: false, restoreDrillPassed: true },
    capabilities: {
      observeActPrimary: true,
      reputationUpdates: true,
      workMarketClaims: true,
      scheduleOptimization: false,
      simulatorRequiredPolicyChanges: true,
      telemetryOptimizer: true,
      estop: true,
    },
    slos: [
      slo(PilotSloKind.ConformancePassRatio, 0.98, 0.995, "higher_or_equal"),
      slo(PilotSloKind.ReviewLagMs, 2_700_000, 1_800_000, "lower_or_equal"),
    ],
    disasterDrills: [
      drill(PilotDisasterDrillKind.AgentSilence),
      drill(PilotDisasterDrillKind.ProviderOutage, "failed", "provider failover timed out"),
    ],
    incidents: [{ incidentId: "inc-1", severity: "high", summary: "provider failover timeout" }],
  });

  equal(report.status, "blocked");
  ok(report.blockers.includes("seven_day_replay_missing"));
  ok(report.blockers.includes("illegal_transitions_present"));
  ok(report.blockers.includes("twenty_four_hour_soak_missing"));
  ok(report.blockers.includes("estop_drill_failed"));
  ok(report.blockers.includes("capability_scheduleOptimization_disabled"));
  ok(report.blockers.includes("slo_conformance_pass_ratio_failed"));
  ok(report.blockers.includes("disaster_drill_provider_outage_failed"));
  ok(report.backlog.some((item) => item.source === "slo" && item.sourceId === PilotSloKind.ReviewLagMs));
  ok(report.backlog.some((item) => item.source === "disaster_drill" && item.sourceId === PilotDisasterDrillKind.ProviderOutage));
  ok(report.backlog.some((item) => item.source === "incident" && item.sourceId === "inc-1"));
});

function slo(
  kind: PilotSloKind,
  observed: number,
  target: number,
  direction: "higher_or_equal" | "lower_or_equal",
) {
  return { kind, observed, target, direction, evidenceRef: `pilot:slo:${kind}` };
}

function drill(
  kind: PilotDisasterDrillKind,
  status: "passed" | "failed" = "passed",
  finding = "passed",
) {
  return { kind, status, finding, evidenceRef: `pilot:drill:${kind}` };
}
