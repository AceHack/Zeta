import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { OrgEventKind } from "../../domain/src/org-event.ts";
import {
  decideRmoHatAssignment,
  rankRmoHatCandidates,
  type RmoHatCandidateReputation,
} from "../src/rmo.ts";

const ctx = {
  createEventId: () => "evt-rmo-choice-1",
  nowIso: () => "2026-05-31T12:00:00.000Z",
  organizationId: "org-1",
  supervisorChain: ["executive_board_member", "ceo", "cto", "engineering_director"],
  correlationId: "corr-1",
  causationId: "cause-1",
  traceId: "trace-1",
};

function candidate(
  agentId: string,
  overrides: Partial<Omit<RmoHatCandidateReputation, "agentId" | "hatId">>,
): RmoHatCandidateReputation {
  return {
    agentId,
    hatId: "backend_implementer",
    agentHatReputation: 0.5,
    recentOutcomeScore: 0.5,
    scheduleReliability: 0.5,
    reviewQuality: 0.5,
    qaPassRate: 0.5,
    completionRate: 0.5,
    contextFit: 0.5,
    currentLoad: 0,
    freshness: 0.5,
    explorationBonus: 0,
    consecutiveAssignmentCount: 0,
    recentSameHatAssignments: 0,
    ...overrides,
  };
}

test("RMO ranks legal candidates by reputation evidence while penalizing lock-in", () => {
  const ranked = rankRmoHatCandidates({
    hatId: "backend_implementer",
    candidates: [
      candidate("agent-incumbent", {
        agentHatReputation: 0.95,
        recentOutcomeScore: 0.9,
        consecutiveAssignmentCount: 4,
        recentSameHatAssignments: 5,
      }),
      candidate("agent-balanced", {
        agentHatReputation: 0.78,
        recentOutcomeScore: 0.82,
        scheduleReliability: 0.9,
        reviewQuality: 0.85,
        qaPassRate: 0.88,
        completionRate: 0.9,
        contextFit: 0.8,
        freshness: 0.65,
      }),
      candidate("agent-explorer", {
        agentHatReputation: 0.55,
        recentOutcomeScore: 0.62,
        explorationBonus: 0.8,
        freshness: 0.95,
      }),
    ],
  });

  equal(ranked.map((c) => c.agentId).join(","), "agent-balanced,agent-explorer,agent-incumbent");
  equal(ranked[0]?.rank, 1);
  ok(ranked[0]?.reasonCodes.includes("strong_schedule_reliability"));
  ok(ranked[1]?.reasonCodes.includes("exploration_candidate"));
  ok(ranked[2]?.reasonCodes.includes("lock_in_penalty"));
});

test("RMO office chooser selects from ranked legal candidates and records alternatives", () => {
  const ranked = rankRmoHatCandidates({
    hatId: "backend_implementer",
    candidates: [
      candidate("agent-a", { agentHatReputation: 0.9 }),
      candidate("agent-b", { agentHatReputation: 0.7, explorationBonus: 0.9, freshness: 0.9 }),
    ],
  });

  const decision = decideRmoHatAssignment(
    {
      hatId: "backend_implementer",
      hatName: "Backend Implementer",
      rankedCandidates: ranked,
      chooser: () => ({ index: 1, reason: "RMO chooses an exploration candidate while scores are close" }),
    },
    ctx,
  );

  equal(decision.outcome, "assigned");
  if (decision.outcome !== "assigned") return;
  equal(decision.selected.agentId, "agent-b");
  equal(decision.event.kind, OrgEventKind.HatAssignment);
  equal(decision.event.actorHatId, "rmo_office");
  equal(decision.event.actorAgentId, "agent-b");
  ok(decision.event.decision.includes("selected agent-b"));
  ok(decision.event.decision.includes("alternatives:"));
  equal(decision.rankedCandidates.length, 2);
});

test("RMO office chooser is clamped to the ranked legal list", () => {
  const ranked = rankRmoHatCandidates({
    hatId: "backend_implementer",
    candidates: [
      candidate("agent-a", { agentHatReputation: 0.9 }),
      candidate("agent-b", { agentHatReputation: 0.7 }),
    ],
  });

  const decision = decideRmoHatAssignment(
    {
      hatId: "backend_implementer",
      hatName: "Backend Implementer",
      rankedCandidates: ranked,
      chooser: () => ({ index: 99, reason: "model attempted to choose outside the list" }),
    },
    ctx,
  );

  equal(decision.outcome, "assigned");
  if (decision.outcome !== "assigned") return;
  equal(decision.selected.agentId, "agent-b");
  ok(decision.event.decision.includes("rank #2"));
});

test("RMO office reports no legal candidate without inventing an assignment", () => {
  const decision = decideRmoHatAssignment(
    {
      hatId: "backend_implementer",
      hatName: "Backend Implementer",
      rankedCandidates: [],
      chooser: () => ({ index: 0, reason: "no candidates" }),
    },
    ctx,
  );

  equal(decision.outcome, "no_legal_candidate");
});
