export const PilotSloKind = {
  ConformancePassRatio: "conformance_pass_ratio",
  LeadTimeMs: "lead_time_ms",
  ReviewLagMs: "review_lag_ms",
  QaBounceBackRate: "qa_bounce_back_rate",
  CostPerCompletedWorkItem: "cost_per_completed_work_item",
  StaleClaimRecoveryMs: "stale_claim_recovery_ms",
  OperatorInterventionCount: "operator_intervention_count",
} as const;
export type PilotSloKind = (typeof PilotSloKind)[keyof typeof PilotSloKind];

export const PilotDisasterDrillKind = {
  AgentSilence: "agent_silence",
  BadModelSelector: "bad_model_selector",
  QueueOverload: "queue_overload",
  ConformanceBreach: "conformance_breach",
  ProviderOutage: "provider_outage",
  Rollback: "rollback",
} as const;
export type PilotDisasterDrillKind = (typeof PilotDisasterDrillKind)[keyof typeof PilotDisasterDrillKind];

export type PilotSloObservation = {
  readonly kind: PilotSloKind;
  readonly observed: number;
  readonly target: number;
  readonly direction: "higher_or_equal" | "lower_or_equal";
  readonly evidenceRef: string;
};

export type PilotDisasterDrillResult = {
  readonly kind: PilotDisasterDrillKind;
  readonly status: "passed" | "failed";
  readonly finding: string;
  readonly evidenceRef: string;
};

export type PilotIncidentSummary = {
  readonly incidentId: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly summary: string;
};

export type PilotReadinessCapabilities = {
  readonly observeActPrimary: boolean;
  readonly reputationUpdates: boolean;
  readonly workMarketClaims: boolean;
  readonly scheduleOptimization: boolean;
  readonly simulatorRequiredPolicyChanges: boolean;
  readonly telemetryOptimizer: boolean;
  readonly estop: boolean;
};

export type PilotReadinessInput = {
  readonly organizationId: string;
  readonly projectId: string;
  readonly departmentId: string;
  readonly evaluatedAt: string;
  readonly replay: {
    readonly days: number;
    readonly illegalTransitionCount: number;
  };
  readonly soak: {
    readonly hours: number;
    readonly degradedTickCount: number;
  };
  readonly controls: {
    readonly estopDrillPassed: boolean;
    readonly restoreDrillPassed: boolean;
  };
  readonly capabilities: PilotReadinessCapabilities;
  readonly slos: readonly PilotSloObservation[];
  readonly disasterDrills: readonly PilotDisasterDrillResult[];
  readonly incidents: readonly PilotIncidentSummary[];
};

export type PilotSloReport = PilotSloObservation & {
  readonly status: "passed" | "failed";
};

export type PilotDisasterDrillReport = PilotDisasterDrillResult;

export type PilotImprovementBacklogItem = {
  readonly backlogItemId: string;
  readonly source: "slo" | "disaster_drill" | "incident";
  readonly sourceId: string;
  readonly title: string;
  readonly evidenceRefs: readonly string[];
};

export type PilotReadinessReport = {
  readonly organizationId: string;
  readonly projectId: string;
  readonly departmentId: string;
  readonly evaluatedAt: string;
  readonly replay: PilotReadinessInput["replay"];
  readonly soak: PilotReadinessInput["soak"];
  readonly controls: PilotReadinessInput["controls"];
  readonly capabilities: PilotReadinessCapabilities;
  readonly slos: readonly PilotSloReport[];
  readonly disasterDrills: readonly PilotDisasterDrillReport[];
  readonly incidents: readonly PilotIncidentSummary[];
  readonly evidenceRefs: readonly string[];
};

export type PilotReadinessEvaluation = {
  readonly status: "ready" | "blocked";
  readonly blockers: readonly string[];
  readonly report: PilotReadinessReport;
  readonly backlog: readonly PilotImprovementBacklogItem[];
};

const RequiredCapabilities: readonly (keyof PilotReadinessCapabilities)[] = [
  "observeActPrimary",
  "reputationUpdates",
  "workMarketClaims",
  "scheduleOptimization",
  "simulatorRequiredPolicyChanges",
  "telemetryOptimizer",
  "estop",
];

export function evaluatePilotReadiness(input: PilotReadinessInput): PilotReadinessEvaluation {
  const blockers: string[] = [];
  if (input.replay.days < 7) blockers.push("seven_day_replay_missing");
  if (input.replay.illegalTransitionCount > 0) blockers.push("illegal_transitions_present");
  if (input.soak.hours < 24) blockers.push("twenty_four_hour_soak_missing");
  if (input.soak.degradedTickCount > 0) blockers.push("degraded_soak_ticks_present");
  if (!input.controls.estopDrillPassed) blockers.push("estop_drill_failed");
  if (!input.controls.restoreDrillPassed) blockers.push("restore_drill_failed");

  for (const capability of RequiredCapabilities) {
    if (!input.capabilities[capability]) {
      blockers.push(`capability_${capability}_disabled`);
    }
  }

  const slos = input.slos.map((slo): PilotSloReport => {
    const status = sloPasses(slo) ? "passed" : "failed";
    if (status === "failed") blockers.push(`slo_${slo.kind}_failed`);
    return { ...slo, status };
  });

  const disasterDrills = input.disasterDrills.map((drill) => {
    if (drill.status === "failed") blockers.push(`disaster_drill_${drill.kind}_failed`);
    return drill;
  });

  const evidenceRefs = uniqueSorted([
    `pilot:replay:${input.replay.days}d`,
    `pilot:soak:${input.soak.hours}h`,
    `pilot:control:estop:${input.controls.estopDrillPassed ? "passed" : "failed"}`,
    `pilot:control:restore:${input.controls.restoreDrillPassed ? "passed" : "failed"}`,
    ...input.slos.map((slo) => slo.evidenceRef),
    ...input.disasterDrills.map((drill) => drill.evidenceRef),
    ...input.incidents.map((incident) => `pilot:incident:${incident.incidentId}`),
  ]);
  const report: PilotReadinessReport = {
    organizationId: input.organizationId,
    projectId: input.projectId,
    departmentId: input.departmentId,
    evaluatedAt: input.evaluatedAt,
    replay: input.replay,
    soak: input.soak,
    controls: input.controls,
    capabilities: input.capabilities,
    slos,
    disasterDrills,
    incidents: input.incidents,
    evidenceRefs,
  };

  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers: uniqueSorted(blockers),
    report,
    backlog: createBacklog(input, slos, disasterDrills),
  };
}

function createBacklog(
  input: PilotReadinessInput,
  slos: readonly PilotSloReport[],
  drills: readonly PilotDisasterDrillReport[],
): readonly PilotImprovementBacklogItem[] {
  return [
    ...slos.filter((slo) => slo.status === "failed").map((slo) => ({
      backlogItemId: backlogId(input.organizationId, "slo", slo.kind),
      source: "slo" as const,
      sourceId: slo.kind,
      title: `Improve pilot SLO ${slo.kind}`,
      evidenceRefs: [slo.evidenceRef],
    })),
    ...drills.filter((drill) => drill.status === "failed").map((drill) => ({
      backlogItemId: backlogId(input.organizationId, "disaster_drill", drill.kind),
      source: "disaster_drill" as const,
      sourceId: drill.kind,
      title: `Fix failed pilot disaster drill ${drill.kind}`,
      evidenceRefs: [drill.evidenceRef],
    })),
    ...input.incidents.map((incident) => ({
      backlogItemId: backlogId(input.organizationId, "incident", incident.incidentId),
      source: "incident" as const,
      sourceId: incident.incidentId,
      title: `Address pilot incident ${incident.incidentId}: ${incident.summary}`,
      evidenceRefs: [`pilot:incident:${incident.incidentId}`],
    })),
  ];
}

function sloPasses(slo: PilotSloObservation): boolean {
  return slo.direction === "higher_or_equal"
    ? slo.observed >= slo.target
    : slo.observed <= slo.target;
}

function backlogId(organizationId: string, source: string, sourceId: string): string {
  return `pilot-backlog:${organizationId}:${source}:${sourceId}`;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}
