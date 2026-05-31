import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { HatLevel, type HatBinding, type OrgEvent } from "../../domain/src/index.ts";
import {
  runOrgCycle,
  type OrgCycleRmoCandidateSource,
} from "../src/org-runtime.ts";
import { createDemoOrgCycleRmoCandidateSource } from "../src/org-runtime-demo.ts";
import { PipelineStage } from "../src/pipeline.ts";

function harness() {
  const events: OrgEvent[] = [];
  const bindings = new Map<string, HatBinding>();
  let n = 0;
  return {
    events, bindings,
    deps: {
      organizationId: "org-lfg",
      workItemId: "wi-customer-goal-1",
      baseTimeMs: Date.parse("2026-05-30T10:00:00.000Z"),
      createId: (prefix: string) => `${prefix}-${++n}`,
      appendEvent: async (e: OrgEvent) => void events.push(e),
      upsertBinding: async (b: HatBinding) => void bindings.set(b.id, b),
      rmoCandidateSource: createDemoOrgCycleRmoCandidateSource(),
    },
  };
}

async function rejectsWithMessage(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    equal(error instanceof Error ? error.message : String(error), message);
    return;
  }
  throw new Error(`expected promise to reject with '${message}'`);
}

test("org cycle requires an explicit RMO candidate source instead of silently using demo staffing", async () => {
  const h = harness();
  const { rmoCandidateSource: _demoSource, ...depsWithoutSource } = h.deps;
  await rejectsWithMessage(
    runOrgCycle(depsWithoutSource as unknown as Parameters<typeof runOrgCycle>[0]),
    "runOrgCycle requires an explicit rmoCandidateSource; pass createDemoOrgCycleRmoCandidateSource() only for demos/tests",
  );
});

test("org cycle uses the supplied RMO candidate source as the staffing boundary", async () => {
  const h = harness();
  const calls: string[] = [];
  const source: OrgCycleRmoCandidateSource = {
    sourceName: "test-production-candidates",
    candidatesForHat: ({ hatId }) => {
      calls.push(hatId);
      const eligibleCandidates = [
        { agentId: `agent-production-${hatId}-a`, reputationByHat: { [hatId]: 2 } },
        { agentId: `agent-production-${hatId}-b`, reputationByHat: { [hatId]: 9 } },
      ];
      return {
        eligibleCandidates,
        rmoCandidates: eligibleCandidates.map((candidate, index) => ({
          agentId: candidate.agentId,
          hatId,
          agentHatReputation: index === 0 ? 0.2 : 0.95,
          recentOutcomeScore: index === 0 ? 0.2 : 0.95,
          scheduleReliability: 0.95,
          reviewQuality: 0.9,
          qaPassRate: 0.9,
          completionRate: 0.9,
          contextFit: 0.9,
          currentLoad: 0,
          freshness: index === 0 ? 0.2 : 0.95,
          explorationBonus: index === 0 ? 0 : 0.2,
          consecutiveAssignmentCount: 0,
          recentSameHatAssignments: 0,
        })),
      };
    },
  };

  await runOrgCycle({ ...h.deps, rmoCandidateSource: source });

  ok(calls.length > 0);
  ok([...h.bindings.values()].every((binding) => binding.wearerAgentId.startsWith("agent-production-")));
  const rmoAssignments = h.events.filter((e) => e.kind === "hat_assignment" && e.actorHatId === "rmo_office");
  ok(rmoAssignments.every((event) => event.evidenceRefs.includes("rmo-candidate-source:test-production-candidates")));
});

test("org cycle rejects RMO source candidates that are not eligible for assignment", async () => {
  const h = harness();
  const source: OrgCycleRmoCandidateSource = {
    sourceName: "bad-production-candidates",
    candidatesForHat: ({ hatId }) => ({
      eligibleCandidates: [{ agentId: `agent-eligible-${hatId}`, reputationByHat: { [hatId]: 10 } }],
      rmoCandidates: [
        {
          agentId: "agent-outsider",
          hatId,
          agentHatReputation: 1,
          recentOutcomeScore: 1,
          scheduleReliability: 1,
          reviewQuality: 1,
          qaPassRate: 1,
          completionRate: 1,
          contextFit: 1,
          currentLoad: 0,
          freshness: 1,
          explorationBonus: 0,
          consecutiveAssignmentCount: 0,
          recentSameHatAssignments: 0,
        },
      ],
    }),
  };

  await rejectsWithMessage(
    runOrgCycle({ ...h.deps, rmoCandidateSource: source }),
    "RMO candidate source bad-production-candidates returned ineligible agents for product_owner: agent-outsider",
  );
});

test("org cycle rejects unsafe RMO source ids before writing evidence refs", async () => {
  const h = harness();
  const source: OrgCycleRmoCandidateSource = {
    sourceName: "bad source/id",
    candidatesForHat: () => ({ eligibleCandidates: [], rmoCandidates: [] }),
  };

  await rejectsWithMessage(
    runOrgCycle({ ...h.deps, rmoCandidateSource: source }),
    "runOrgCycle requires rmoCandidateSource.sourceName to match /^[a-z][a-z0-9._-]{0,63}$/",
  );
});

test("org cycle uses the validated RMO source id even if a source mutates itself", async () => {
  const h = harness();
  const source: OrgCycleRmoCandidateSource = {
    sourceName: "mutating-source",
    candidatesForHat: ({ hatId }) => {
      source.sourceName = "bad source/id";
      const eligibleCandidates = [{ agentId: `agent-${hatId}-stable`, reputationByHat: { [hatId]: 10 } }];
      return {
        eligibleCandidates,
        rmoCandidates: [
          {
            agentId: eligibleCandidates[0]!.agentId,
            hatId,
            agentHatReputation: 1,
            recentOutcomeScore: 1,
            scheduleReliability: 1,
            reviewQuality: 1,
            qaPassRate: 1,
            completionRate: 1,
            contextFit: 1,
            currentLoad: 0,
            freshness: 1,
            explorationBonus: 0,
            consecutiveAssignmentCount: 0,
            recentSameHatAssignments: 0,
          },
        ],
      };
    },
  };

  await runOrgCycle({ ...h.deps, rmoCandidateSource: source });

  const rmoAssignments = h.events.filter((e) => e.kind === "hat_assignment" && e.actorHatId === "rmo_office");
  ok(rmoAssignments.every((event) => event.evidenceRefs.includes("rmo-candidate-source:mutating-source")));
  ok(rmoAssignments.every((event) => !event.evidenceRefs.includes("rmo-candidate-source:bad source/id")));
});

test("one org cycle drives a customer goal all the way to Merged", async () => {
  const h = harness();
  const report = await runOrgCycle(h.deps);
  equal(report.finalStage, PipelineStage.Merged);
  equal(report.gatesPassed, 7); // all 7 gates passed
});

test("the entire hierarchy acts: events at Executive Board → C-suite → Director → Manager → Lead → IC", async () => {
  const h = harness();
  const report = await runOrgCycle(h.deps);
  for (const level of Object.values(HatLevel)) {
    ok(report.eventsByLevel[level]! >= 1, `no events at hierarchy level ${level}`);
  }
  // and the top of the chain genuinely acted
  ok(report.eventsByLevel[HatLevel.ExecutiveBoard]! >= 1);
  ok(report.eventsByLevel[HatLevel.CSuite]! >= 1);
});

test("hats are staffed and the binding lifecycle is exercised (expiry + succession observed)", async () => {
  const h = harness();
  const report = await runOrgCycle(h.deps);
  ok(report.bindingsCreated >= 5);
  equal(report.expiriesObserved, 1);
  equal(report.successionsPlanned, 1);
  // a binding actually ended up Expired in the persisted state
  ok([...h.bindings.values()].some((b) => b.phase === "expired"));
});

test("the cycle emits a rich, attributed trace (every event names its decision)", async () => {
  const h = harness();
  await runOrgCycle(h.deps);
  ok(h.events.length >= 20);
  // every event carries a human-readable decision and a supervisor chain
  for (const e of h.events) {
    ok(e.decision.length > 0);
    ok(Array.isArray(e.supervisorChain));
  }
  // gate evaluations + pipeline transitions + priority + supply + assignment + lifecycle are all present
  const kinds = new Set(h.events.map((e) => e.kind));
  ok(kinds.has("priority_decision"));
  ok(kinds.has("hat_supply_decision"));
  ok(kinds.has("hat_assignment"));
  ok(kinds.has("quality_gate_evaluation"));
  ok(kinds.has("pipeline_stage_transition"));
  ok(kinds.has("hat_binding_transition"));
  ok(kinds.has("succession_planned"));
});

test("RMO office chooses hat wearers from ranked reputation alternatives during the org cycle", async () => {
  const h = harness();
  await runOrgCycle(h.deps);
  const rmoAssignments = h.events.filter((e) => e.kind === "hat_assignment" && e.actorHatId === "rmo_office");
  ok(rmoAssignments.length >= 1);
  ok(rmoAssignments.every((e) => e.decision.includes("alternatives:")));
});
