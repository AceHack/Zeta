import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  Phase2ReadinessProperty,
  PilotDisasterDrillKind,
  PilotSloKind,
  evaluatePhase2ProductionReadiness,
  evaluatePilotReadiness,
  type Phase2ReadinessPropertyEvidence,
  type PilotReadinessEvaluation,
} from "../src/index.ts";

const NOW = "2026-06-01T00:00:00.000Z";

test("Phase 2 production readiness passes only when the pilot and every readiness property carry evidence", () => {
  const report = evaluatePhase2ProductionReadiness({
    organizationId: "org-lfg",
    evaluatedAt: NOW,
    pilot: readyPilot(),
    properties: allProperties("passed"),
  });

  equal(report.status, "ready");
  deepEqual(report.blockers, []);
  deepEqual(report.backlog, []);
  ok(report.report.evidenceRefs.includes("phase2:pilot:ready"));
  ok(report.report.evidenceRefs.includes("phase2:evidence:legal_action_surface"));
});

test("Phase 2 production readiness blocks failed, missing, and unevidenced properties", () => {
  const properties = allProperties("passed").filter((property) =>
    property.property !== Phase2ReadinessProperty.ContinuousProof,
  );
  const failed = properties.find((property) =>
    property.property === Phase2ReadinessProperty.LearningAssignment,
  );
  if (failed === undefined) throw new Error("missing test property");
  const unevidenced = properties.find((property) =>
    property.property === Phase2ReadinessProperty.OperationalKillSwitches,
  );
  if (unevidenced === undefined) throw new Error("missing test property");

  const report = evaluatePhase2ProductionReadiness({
    organizationId: "org-lfg",
    evaluatedAt: NOW,
    pilot: blockedPilot(),
    properties: [
      ...properties.filter((property) =>
        property.property !== Phase2ReadinessProperty.LearningAssignment &&
        property.property !== Phase2ReadinessProperty.OperationalKillSwitches
      ),
      {
        ...failed,
        status: "failed",
        finding: "exploration confidence window regressed",
      },
      {
        ...unevidenced,
        evidenceRefs: [],
      },
    ],
  });

  equal(report.status, "blocked");
  ok(report.blockers.includes("pilot_seven_day_replay_missing"));
  ok(report.blockers.includes("property_learning_assignment_failed"));
  ok(report.blockers.includes("property_operational_kill_switches_missing_evidence"));
  ok(report.blockers.includes("property_continuous_proof_missing"));
  ok(report.backlog.some((item) => item.sourceId === "phase2:learning_assignment"));
  ok(report.backlog.some((item) => item.sourceId === "phase2:continuous_proof"));
});

function readyPilot(): PilotReadinessEvaluation {
  return evaluatePilotReadiness({
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
}

function blockedPilot(): PilotReadinessEvaluation {
  return evaluatePilotReadiness({
    ...readyPilot().report,
    replay: { days: 6, illegalTransitionCount: 0 },
    slos: [],
    disasterDrills: [],
  });
}

function allProperties(status: "passed" | "failed"): readonly Phase2ReadinessPropertyEvidence[] {
  return Object.values(Phase2ReadinessProperty).map((property) => ({
    property,
    status,
    finding: `${property} ${status}`,
    evidenceRefs: [`phase2:evidence:${property}`],
  }));
}

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
) {
  return { kind, status, finding: status, evidenceRef: `pilot:drill:${kind}` };
}
