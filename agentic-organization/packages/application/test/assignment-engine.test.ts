import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { HatBindingPhase } from "../../domain/src/hat-binding.ts";
import { buildHatDefinitions } from "../src/org-seed.ts";
import { firstLegalChooser } from "../src/org-decision.ts";
import {
  assignHat,
  rankEligibleCandidates,
  rankEligibleCandidatesWithReputation,
  type ActiveBindingSummary,
  type AgentCandidate,
} from "../src/assignment-engine.ts";
import { ReputationOutcomeClass, projectReputationReadModel } from "../src/reputation.ts";

const hats = buildHatDefinitions();
const backend = hats.find((h) => h.id === "backend_implementer")!; // hat_designer conflicts with it (see conflicting-hat test)

const ctx = {
  createEventId: () => "evt-1",
  nowIso: () => "2026-05-30T09:00:00.000Z",
  organizationId: "org-1",
  supervisorChain: ["executive_board_member", "cto", "engineering_director", "backend_implementer"],
  correlationId: "c", causationId: "c", traceId: "t",
};

function candidate(agentId: string, rep: number): AgentCandidate {
  return { agentId, reputationByHat: { backend_implementer: rep } };
}

test("ranks eligible candidates by agent-hat reputation, highest first", () => {
  const ranked = rankEligibleCandidates({
    hat: backend,
    candidates: [candidate("a", 3), candidate("b", 9), candidate("c", 5)],
    activeBindings: [],
    nowMs: 1_000_000,
  });
  equal(ranked.map((c) => c.agentId).join(","), "b,c,a");
});

test("ranks eligible candidates from the posterior reputation read model when provided", () => {
  const readModel = projectReputationReadModel({
    observations: [
      reputationObservation("a", true),
      reputationObservation("b", true),
      reputationObservation("b", true),
      reputationObservation("c", false),
    ],
  });
  const ranked = rankEligibleCandidatesWithReputation({
    hat: backend,
    candidates: [{ agentId: "a" }, { agentId: "b" }, { agentId: "c" }],
    activeBindings: [],
    nowMs: 1_000_000,
    reputation: {
      readModel,
      organizationId: "org-1",
      workType: "code_change",
    },
  });

  equal(ranked.map((c) => c.agentId).join(","), "b,a,c");
  ok((ranked[0]?.reputationByHat.backend_implementer ?? 0) > (ranked[2]?.reputationByHat.backend_implementer ?? 0));
  ok((ranked[0]?.posteriorReputationByHat?.backend_implementer?.quality.sampleCount ?? 0) > 0);
});

test("excludes an agent already wearing the hat, in cooldown, or in a conflicting hat", () => {
  const now = 1_000_000;
  const bindings: ActiveBindingSummary[] = [
    { hatId: "backend_implementer", wearerAgentId: "a", phase: HatBindingPhase.Active }, // already wearing
    { hatId: "backend_implementer", wearerAgentId: "b", phase: HatBindingPhase.Expired, cooldownUntil: new Date(now + 10_000).toISOString() }, // cooldown
    { hatId: "hat_designer", wearerAgentId: "c", phase: HatBindingPhase.Active }, // conflicts with backend
  ];
  const ranked = rankEligibleCandidates({
    hat: backend,
    candidates: [candidate("a", 9), candidate("b", 8), candidate("c", 7), candidate("d", 1)],
    activeBindings: bindings,
    nowMs: now,
  });
  // only d is eligible
  equal(ranked.map((c) => c.agentId).join(","), "d");
});

test("respects the per-agent active-hat cap", () => {
  const bindings: ActiveBindingSummary[] = [
    { hatId: "code_reviewer", wearerAgentId: "a", phase: HatBindingPhase.Active },
    { hatId: "qa_reviewer", wearerAgentId: "a", phase: HatBindingPhase.Active },
    { hatId: "tpm", wearerAgentId: "a", phase: HatBindingPhase.Active },
  ];
  const ranked = rankEligibleCandidates({ hat: backend, candidates: [candidate("a", 9)], activeBindings: bindings, nowMs: 1, agentMaxActiveHats: 3 });
  equal(ranked.length, 0); // a is at cap
});

test("assigns the top-ranked eligible candidate when supply has room", () => {
  const ranked = rankEligibleCandidates({ hat: backend, candidates: [candidate("a", 3), candidate("b", 9)], activeBindings: [], nowMs: 1 });
  const result = assignHat({ hat: backend, eligibleRanked: ranked, activeWearerCount: 0, supplyTarget: 2, chooser: firstLegalChooser() }, ctx);
  equal(result.outcome, "assigned");
  if (result.outcome !== "assigned") return;
  equal(result.agentId, "b"); // highest reputation
  ok(result.event.decision.includes("assigned to b"));
});

test("refuses to over-staff: supply exhausted routes to RMO", () => {
  const ranked = rankEligibleCandidates({ hat: backend, candidates: [candidate("a", 9)], activeBindings: [], nowMs: 1 });
  const result = assignHat({ hat: backend, eligibleRanked: ranked, activeWearerCount: 2, supplyTarget: 2, chooser: firstLegalChooser() }, ctx);
  equal(result.outcome, "supply_exhausted");
  if (result.outcome !== "supply_exhausted") return;
  ok(result.event.decision.includes("supply exhausted"));
});

test("no eligible candidate is reported distinctly", () => {
  const result = assignHat({ hat: backend, eligibleRanked: [], activeWearerCount: 0, supplyTarget: 2, chooser: firstLegalChooser() }, ctx);
  equal(result.outcome, "no_eligible_candidate");
});

function reputationObservation(agentId: string, success: boolean) {
  return {
    organizationId: "org-1",
    agentId,
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass: ReputationOutcomeClass.Quality,
    observedAt: "2026-05-31T12:00:00.000Z",
    signal: { kind: "binary" as const, success },
    evidenceRef: `evidence:${agentId}:${success ? "pass" : "fail"}`,
  };
}
