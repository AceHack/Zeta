import type {
  PilotImprovementBacklogItem,
  PilotReadinessEvaluation,
} from "./pilot-readiness.ts";

export const Phase2ReadinessProperty = {
  LegalActionSurface: "legal_action_surface",
  LearningAssignment: "learning_assignment",
  NoDuplicateSameHatWork: "no_duplicate_same_hat_work",
  PressureAwareHierarchy: "pressure_aware_hierarchy",
  SimulationBeforePolicyMutation: "simulation_before_policy_mutation",
  SelfImprovementWithEvidence: "self_improvement_with_evidence",
  OperationalKillSwitches: "operational_kill_switches",
  ContinuousProof: "continuous_proof",
} as const;
export type Phase2ReadinessProperty = (typeof Phase2ReadinessProperty)[keyof typeof Phase2ReadinessProperty];

export type Phase2ReadinessPropertyEvidence = {
  readonly property: Phase2ReadinessProperty;
  readonly status: "passed" | "failed";
  readonly finding: string;
  readonly evidenceRefs: readonly string[];
};

export type Phase2ProductionReadinessInput = {
  readonly organizationId: string;
  readonly evaluatedAt: string;
  readonly pilot: PilotReadinessEvaluation;
  readonly properties: readonly Phase2ReadinessPropertyEvidence[];
};

export type Phase2ProductionReadinessReport = {
  readonly organizationId: string;
  readonly evaluatedAt: string;
  readonly properties: readonly Phase2ReadinessPropertyEvidence[];
  readonly pilotStatus: PilotReadinessEvaluation["status"];
  readonly evidenceRefs: readonly string[];
};

export type Phase2ProductionReadinessEvaluation = {
  readonly status: "ready" | "blocked";
  readonly blockers: readonly string[];
  readonly report: Phase2ProductionReadinessReport;
  readonly backlog: readonly PilotImprovementBacklogItem[];
};

const RequiredPhase2ReadinessProperties: readonly Phase2ReadinessProperty[] = [
  Phase2ReadinessProperty.LegalActionSurface,
  Phase2ReadinessProperty.LearningAssignment,
  Phase2ReadinessProperty.NoDuplicateSameHatWork,
  Phase2ReadinessProperty.PressureAwareHierarchy,
  Phase2ReadinessProperty.SimulationBeforePolicyMutation,
  Phase2ReadinessProperty.SelfImprovementWithEvidence,
  Phase2ReadinessProperty.OperationalKillSwitches,
  Phase2ReadinessProperty.ContinuousProof,
];

export function evaluatePhase2ProductionReadiness(
  input: Phase2ProductionReadinessInput,
): Phase2ProductionReadinessEvaluation {
  const blockers: string[] = input.pilot.blockers.map((blocker) => `pilot_${blocker}`);
  const propertyByName = new Map(input.properties.map((property) => [property.property, property]));
  const backlog: PilotImprovementBacklogItem[] = [...input.pilot.backlog];

  for (const property of RequiredPhase2ReadinessProperties) {
    const evidence = propertyByName.get(property);
    if (evidence === undefined) {
      blockers.push(`property_${property}_missing`);
      backlog.push(propertyBacklog(input.organizationId, property, "missing", []));
      continue;
    }

    if (evidence.evidenceRefs.length === 0) {
      blockers.push(`property_${property}_missing_evidence`);
      backlog.push(propertyBacklog(input.organizationId, property, "missing evidence", []));
    }

    if (evidence.status === "failed") {
      blockers.push(`property_${property}_failed`);
      backlog.push(propertyBacklog(input.organizationId, property, evidence.finding, evidence.evidenceRefs));
    }
  }

  const evidenceRefs = uniqueSorted([
    `phase2:pilot:${input.pilot.status}`,
    ...input.pilot.report.evidenceRefs,
    ...input.properties.flatMap((property) => property.evidenceRefs),
  ]);

  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers: uniqueSorted(blockers),
    report: {
      organizationId: input.organizationId,
      evaluatedAt: input.evaluatedAt,
      properties: input.properties,
      pilotStatus: input.pilot.status,
      evidenceRefs,
    },
    backlog,
  };
}

function propertyBacklog(
  organizationId: string,
  property: Phase2ReadinessProperty,
  finding: string,
  evidenceRefs: readonly string[],
): PilotImprovementBacklogItem {
  return {
    backlogItemId: `phase2-backlog:${organizationId}:property:${property}`,
    source: "incident",
    sourceId: `phase2:${property}`,
    title: `Close Phase 2 readiness property ${property}: ${finding}`,
    evidenceRefs,
  };
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}
