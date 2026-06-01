import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { OrgEventKind } from "../../domain/src/org-event.ts";
import { replayLedger } from "../src/conformance.ts";
import {
  ReputationOutcomeClass,
  ReputationRiskTier,
  createReputationOutcomeOrgEvent,
  decideRmoHatAssignment,
  materializeRmoCandidateReputation,
  projectReputationReadModelFromOrgEvents,
  projectReputationReadModel,
  rankRmoHatCandidates,
  selectRmoCandidateWithExploration,
} from "../src/index.ts";

const observedAt = "2026-05-31T12:00:00.000Z";

test("posterior projection learns per agent, hat, work type, and outcome class from append-only observations", () => {
  const readModel = projectReputationReadModel({
    observations: [
      quality("agent-steady", true),
      quality("agent-steady", true),
      quality("agent-steady", false),
      quality("agent-new", true, { workType: "frontend_task" }),
      latency("agent-steady", 20),
      latency("agent-steady", 40),
      cost("agent-steady", 1.5),
      collaboration("agent-steady", true),
    ],
  });

  const steadyQuality = readModel.summaryFor({
    organizationId: "org-1",
    agentId: "agent-steady",
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Quality,
  });
  const unrelatedQuality = readModel.summaryFor({
    organizationId: "org-1",
    agentId: "agent-new",
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Quality,
  });
  const steadyLatency = readModel.summaryFor({
    organizationId: "org-1",
    agentId: "agent-steady",
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Latency,
  });

  equal(steadyQuality.sampleCount, 3);
  equal(steadyQuality.kind, "beta_bernoulli");
  equal(steadyQuality.mean, 0.6);
  ok(steadyQuality.uncertainty < unrelatedQuality.uncertainty);
  equal(unrelatedQuality.sampleCount, 0);
  equal(unrelatedQuality.mean, 0.5);
  equal(steadyLatency.kind, "normal_gamma");
  if (steadyLatency.kind === "normal_gamma") {
    equal(steadyLatency.mean, 30);
    ok(steadyLatency.posteriorAlpha > 1);
    ok(steadyLatency.posteriorBeta > 1);
  }
});

test("posterior projection decays stale evidence while preserving evidence refs", () => {
  const readModel = projectReputationReadModel({
    observations: [
      quality("agent-stale", true, {
        observedAt: "2026-01-01T00:00:00.000Z",
        evidenceRef: "evidence:agent-stale:old-pass",
      }),
      quality("agent-recent", true, {
        observedAt: "2026-05-31T12:00:00.000Z",
        evidenceRef: "evidence:agent-recent:recent-pass",
      }),
    ],
    decay: {
      asOf: "2026-05-31T12:00:00.000Z",
      halfLifeDays: 30,
    },
  });

  const stale = readModel.summaryFor({
    organizationId: "org-1",
    agentId: "agent-stale",
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Quality,
  });
  const recent = readModel.summaryFor({
    organizationId: "org-1",
    agentId: "agent-recent",
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Quality,
  });

  ok(stale.sampleCount < recent.sampleCount);
  ok(stale.mean < recent.mean);
  ok(stale.uncertainty > recent.uncertainty);
  deepEqual(stale.evidenceRefs, ["evidence:agent-stale:old-pass"]);
});

test("severe incident contribution retains a minimum negative weight under decay", () => {
  const readModel = projectReputationReadModel({
    observations: [
      {
        ...quality("agent-incident", true),
        outcomeClass: ReputationOutcomeClass.IncidentContribution,
        observedAt: "2026-01-01T00:00:00.000Z",
        signal: { kind: "binary", success: true, weight: 1 },
        evidenceRef: "evidence:agent-incident:sev1",
      },
    ],
    decay: {
      asOf: "2026-05-31T12:00:00.000Z",
      halfLifeDays: 1,
      severeIncidentMinimumWeight: 0.75,
    },
  });

  const incident = readModel.summaryFor({
    organizationId: "org-1",
    agentId: "agent-incident",
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.IncidentContribution,
  });

  equal(incident.kind, "beta_bernoulli");
  equal(incident.sampleCount, 0.75);
  ok(incident.mean < 0.5);
  deepEqual(incident.evidenceRefs, ["evidence:agent-incident:sev1"]);
});

test("incident and review reversal posteriors lower RMO candidate reputation", () => {
  const readModel = projectReputationReadModel({
    observations: [
      quality("agent-clean", true),
      quality("agent-clean", true),
      incidentContribution("agent-clean", false),
      reviewReversal("agent-clean", false),
      quality("agent-risk", true),
      quality("agent-risk", true),
      incidentContribution("agent-risk", true),
      reviewReversal("agent-risk", true),
    ],
    decay: {
      asOf: "2026-05-31T12:00:00.000Z",
      halfLifeDays: 30,
      severeIncidentMinimumWeight: 0.75,
    },
  });

  const clean = materializeRmoCandidateReputation({
    readModel,
    organizationId: "org-1",
    agentId: "agent-clean",
    hatId: "backend_implementer",
    workType: "code_change",
    currentLoad: 0,
    consecutiveAssignmentCount: 0,
    recentSameHatAssignments: 0,
  });
  const risky = materializeRmoCandidateReputation({
    readModel,
    organizationId: "org-1",
    agentId: "agent-risk",
    hatId: "backend_implementer",
    workType: "code_change",
    currentLoad: 0,
    consecutiveAssignmentCount: 0,
    recentSameHatAssignments: 0,
  });

  ok(clean.agentHatReputation > risky.agentHatReputation);
  ok(clean.reviewQuality > risky.reviewQuality);
  ok((risky.posterior?.incidentContribution.mean ?? 1) < 0.5);
  ok(risky.posterior?.evidenceRefs.includes("evidence:agent-risk:incident") ?? false);
});

test("RMO candidates are materialized from posterior evidence with uncertainty and bounded lock-in penalties", () => {
  const readModel = projectReputationReadModel({
    observations: [
      quality("agent-incumbent", true),
      quality("agent-incumbent", true),
      quality("agent-incumbent", true),
      quality("agent-incumbent", true),
      collaboration("agent-incumbent", true),
      quality("agent-recovered", true),
    ],
  });

  const incumbent = materializeRmoCandidateReputation({
    readModel,
    organizationId: "org-1",
    agentId: "agent-incumbent",
    hatId: "backend_implementer",
    workType: "code_change",
    currentLoad: 0,
    consecutiveAssignmentCount: 6,
    recentSameHatAssignments: 7,
  });
  const recovered = materializeRmoCandidateReputation({
    readModel,
    organizationId: "org-1",
    agentId: "agent-recovered",
    hatId: "backend_implementer",
    workType: "code_change",
    currentLoad: 0,
    consecutiveAssignmentCount: 0,
    recentSameHatAssignments: 0,
  });

  ok(incumbent.posterior?.quality.sampleCount! > recovered.posterior?.quality.sampleCount!);
  ok(recovered.explorationBonus > incumbent.explorationBonus);

  const ranked = rankRmoHatCandidates({ hatId: "backend_implementer", candidates: [incumbent, recovered] });
  ok(ranked[0]?.reasonCodes.includes("posterior_reputation_evidence"));
  ok(ranked.some((candidate) => candidate.reasonCodes.includes("lock_in_penalty")));

  const decision = decideRmoHatAssignment(
    {
      hatId: "backend_implementer",
      hatName: "Backend Implementer",
      rankedCandidates: ranked,
      chooser: () => ({ index: 0, reason: "choose posterior-backed candidate" }),
    },
    {
      createEventId: () => "evt-rmo-reputation",
      nowIso: () => observedAt,
      organizationId: "org-1",
      supervisorChain: ["rmo_office"],
      correlationId: "corr-1",
      causationId: "cause-1",
      traceId: "trace-1",
    },
  );

  equal(decision.outcome, "assigned");
  if (decision.outcome === "assigned") {
    ok(decision.event.evidenceRefs.some((ref) => ref.startsWith("evidence:agent-")));
  }
});

test("normal-risk exploration samples uncertainty but high-risk work requires a minimum lower confidence bound", () => {
  const readModel = projectReputationReadModel({
    observations: [
      quality("agent-safe", true),
      quality("agent-safe", true),
      quality("agent-safe", true),
      quality("agent-risky", false),
      quality("agent-risky", false),
      quality("agent-new", true),
    ],
  });
  const ranked = rankRmoHatCandidates({
    hatId: "backend_implementer",
    candidates: ["agent-safe", "agent-risky", "agent-new"].map((agentId) =>
      materializeRmoCandidateReputation({
        readModel,
        organizationId: "org-1",
        agentId,
        hatId: "backend_implementer",
        workType: "code_change",
        currentLoad: 0,
        consecutiveAssignmentCount: agentId === "agent-safe" ? 5 : 0,
        recentSameHatAssignments: agentId === "agent-safe" ? 5 : 0,
      })),
  });

  const normalSelection = selectRmoCandidateWithExploration({
    rankedCandidates: ranked,
    riskTier: ReputationRiskTier.Normal,
    explorationSeed: "sample-new-agent",
    explorationRate: 1,
  });
  equal(normalSelection.outcome, "selected");
  if (normalSelection.outcome === "selected") {
    equal(normalSelection.selected.agentId, "agent-new");
    ok(normalSelection.reason.includes("exploration"));
  }

  const exploitSelection = selectRmoCandidateWithExploration({
    rankedCandidates: ranked,
    riskTier: ReputationRiskTier.Normal,
    explorationSeed: "sample-new-agent",
    explorationRate: 0,
  });
  equal(exploitSelection.outcome, "selected");
  if (exploitSelection.outcome === "selected") {
    equal(exploitSelection.selected.agentId, ranked[0]?.agentId);
    ok(exploitSelection.reason.includes("exploitation"));
  }

  const highRiskSelection = selectRmoCandidateWithExploration({
    rankedCandidates: ranked,
    riskTier: ReputationRiskTier.High,
    explorationSeed: "sample-risky-agent",
    minimumLowerConfidenceBound: 0.55,
  });
  equal(highRiskSelection.outcome, "selected");
  if (highRiskSelection.outcome === "selected") {
    equal(highRiskSelection.selected.agentId, "agent-safe");
  }
});

test("reputation outcome org events are conformance-classified as append-only non-transitions", () => {
  const event = createReputationOutcomeOrgEvent({
    eventId: "evt-reputation-1",
    observedAt,
    organizationId: "org-1",
    observation: quality("agent-steady", true),
    correlationId: "corr-1",
    causationId: "cause-1",
    traceId: "trace-1",
  });

  equal(event.kind, OrgEventKind.ReputationOutcomeObserved);
  equal(event.subjectId, "agent-steady:backend_implementer:code_change:quality");
  ok(event.evidenceRefs.some((ref) => ref.startsWith("reputation:quality:success")));

  const report = replayLedger([event], { maxSkippedAmbiguous: 0 });
  equal(report.checked, 0);
  equal(report.skippedAmbiguous, 0);
  deepEqual(report.skipReasonCounts, { "event kind is explicitly classified as non-transition": 1 });
});

test("reputation read model replays structured observations from durable org events", () => {
  const events = [
    createReputationOutcomeOrgEvent({
      eventId: "evt-reputation-pass",
      observedAt,
      organizationId: "org-1",
      observation: quality("agent-ledger", true),
      correlationId: "corr-1",
      causationId: "cause-1",
      traceId: "trace-1",
    }),
    createReputationOutcomeOrgEvent({
      eventId: "evt-reputation-fail",
      observedAt,
      organizationId: "org-1",
      observation: quality("agent-ledger", false),
      correlationId: "corr-1",
      causationId: "cause-1",
      traceId: "trace-1",
    }),
  ];

  const readModel = projectReputationReadModelFromOrgEvents({ events });
  const summary = readModel.summaryFor({
    organizationId: "org-1",
    agentId: "agent-ledger",
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Quality,
  });

  equal(summary.kind, "beta_bernoulli");
  equal(summary.sampleCount, 2);
  equal(summary.mean, 0.5);
  deepEqual(summary.evidenceRefs, ["evidence:agent-ledger:fail", "evidence:agent-ledger:pass"]);
});

function quality(
  agentId: string,
  success: boolean,
  overrides: Partial<Parameters<typeof projectReputationReadModel>[0]["observations"][number]> = {},
): Parameters<typeof projectReputationReadModel>[0]["observations"][number] {
  return {
    organizationId: "org-1",
    agentId,
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Quality,
    observedAt,
    signal: { kind: "binary", success },
    evidenceRef: `evidence:${agentId}:${success ? "pass" : "fail"}`,
    ...overrides,
  };
}

function collaboration(agentId: string, success: boolean): Parameters<typeof projectReputationReadModel>[0]["observations"][number] {
  return {
    organizationId: "org-1",
    agentId,
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Collaboration,
    observedAt,
    signal: { kind: "binary", success },
    evidenceRef: `evidence:${agentId}:collaboration`,
  };
}

function latency(agentId: string, value: number): Parameters<typeof projectReputationReadModel>[0]["observations"][number] {
  return {
    organizationId: "org-1",
    agentId,
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Latency,
    observedAt,
    signal: { kind: "continuous", value, unit: "minutes", lowerIsBetter: true },
    evidenceRef: `evidence:${agentId}:latency:${value}`,
  };
}

function cost(agentId: string, value: number): Parameters<typeof projectReputationReadModel>[0]["observations"][number] {
  return {
    organizationId: "org-1",
    agentId,
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Cost,
    observedAt,
    signal: { kind: "continuous", value, unit: "usd", lowerIsBetter: true },
    evidenceRef: `evidence:${agentId}:cost:${value}`,
  };
}

function incidentContribution(agentId: string, contributed: boolean): Parameters<typeof projectReputationReadModel>[0]["observations"][number] {
  return {
    organizationId: "org-1",
    agentId,
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.IncidentContribution,
    observedAt,
    signal: { kind: "binary", success: contributed },
    evidenceRef: `evidence:${agentId}:incident`,
  };
}

function reviewReversal(agentId: string, reversed: boolean): Parameters<typeof projectReputationReadModel>[0]["observations"][number] {
  return {
    organizationId: "org-1",
    agentId,
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.ReviewReversal,
    observedAt,
    signal: { kind: "binary", success: reversed },
    evidenceRef: `evidence:${agentId}:review-reversal`,
  };
}
