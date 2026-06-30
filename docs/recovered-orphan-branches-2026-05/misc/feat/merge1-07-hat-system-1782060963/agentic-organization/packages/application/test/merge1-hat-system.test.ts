import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { HatBindingPhase, type HatBinding } from "../../domain/src/hat-binding.ts";
import { HatLevel, RiskLevel, SuccessionPolicy, type HatDefinition } from "../../domain/src/hat-definition.ts";
import { emitSwap, makeHatSwap, type HatSwap } from "../src/hat-swap-event.ts";
import { DEFAULT_HAT_POLICY } from "../src/hat-policy.ts";
import {
  conflictOfInterestPolicy,
  cooldownPolicy,
  evaluateAdmission,
  maxBindingsPolicy,
  maxNewHatsPolicy,
  noSupervisorCyclesPolicy,
  quorumPolicy,
  warmupPolicy,
  type AdmissionRequest,
} from "../src/hat-admission.ts";
import { recordWearerOff, recordWearerOn, updateHatReputation } from "../src/hat-status.ts";

const NOW = "2026-06-21T00:00:00.000Z";

function hat(id: string, overrides: Partial<HatDefinition> = {}): HatDefinition {
  return {
    id,
    name: id,
    departmentId: "engineering",
    level: HatLevel.IndividualContributor,
    supervisesHatIds: [],
    reportsToHatIds: [],
    conflictsWithHatIds: [],
    assignableByHatIds: [],
    allowedToolBundles: [],
    skills: [],
    approvalScopes: [],
    votingScopes: [],
    memoryScopes: [],
    credentialScopes: [],
    documentationScopes: [],
    lifecycleTransitions: [],
    requiredEvidence: [],
    maxConcurrentAssignments: 1,
    tokenTtlSeconds: 3600,
    warmupSeconds: 180,
    cooldownSeconds: 300,
    successionPolicy: SuccessionPolicy.Rotate,
    stickyAttribution: false,
    reputationScope: [],
    riskLevel: RiskLevel.Low,
    requiresTwoPersonApproval: false,
    requiresHumanApproval: false,
    ...overrides,
  };
}

function binding(id: string, hatId: string, wearerAgentId: string, phase: HatBindingPhase): HatBinding {
  return {
    id,
    hatId,
    organizationId: "org-1",
    wearerAgentId,
    phase,
    boundAt: NOW,
    warmupEndsAt: NOW,
    expiresAt: NOW,
  };
}

function baseRequest(over: Partial<AdmissionRequest>): AdmissionRequest {
  return {
    operation: "create-binding",
    hatId: "hat-1",
    wearerId: "agent-a",
    nowIso: NOW,
    existingBindings: [],
    existingHats: [],
    recentSwaps: [],
    ...over,
  };
}

// --- §6.1 cooldown ----------------------------------------------------------

test("cooldown rejects re-binding within cooldownSeconds", () => {
  const recentSwaps: HatSwap[] = [
    {
      id: "1",
      hat: "hat-1",
      wearer: { spiffeID: "agent-a" },
      event: "SwapOff",
      occurredAt: "2026-06-20T23:58:20.000Z", // 100s before NOW < 300s cooldown
      previousWearer: { spiffeID: "agent-a", revokedAt: "" },
    },
  ];
  const result = cooldownPolicy.evaluate(baseRequest({ recentSwaps }), DEFAULT_HAT_POLICY);
  equal(result.outcome, "deny");
});

test("cooldown allows re-binding after cooldownSeconds elapse", () => {
  const recentSwaps: HatSwap[] = [
    {
      id: "1",
      hat: "hat-1",
      wearer: { spiffeID: "agent-a" },
      event: "SwapOff",
      occurredAt: "2026-06-20T23:00:00.000Z", // 3600s before NOW > 300s
      previousWearer: { spiffeID: "agent-a", revokedAt: "" },
    },
  ];
  const result = cooldownPolicy.evaluate(baseRequest({ recentSwaps }), DEFAULT_HAT_POLICY);
  equal(result.outcome, "allow");
});

// --- §6 max-bindings / conflict / quorum / warmup / max-new-hats -----------

test("max-bindings rejects a wearer at the cap", () => {
  const existingBindings = [
    binding("b1", "hat-x", "agent-a", HatBindingPhase.Active),
    binding("b2", "hat-y", "agent-a", HatBindingPhase.Active),
    binding("b3", "hat-z", "agent-a", HatBindingPhase.Warmup),
  ];
  const result = maxBindingsPolicy.evaluate(baseRequest({ existingBindings }), DEFAULT_HAT_POLICY);
  equal(result.outcome, "deny");
});

test("max-bindings ignores terminal bindings", () => {
  const existingBindings = [
    binding("b1", "hat-x", "agent-a", HatBindingPhase.Revoked),
    binding("b2", "hat-y", "agent-a", HatBindingPhase.Expired),
    binding("b3", "hat-z", "agent-a", HatBindingPhase.Released),
  ];
  const result = maxBindingsPolicy.evaluate(baseRequest({ existingBindings }), DEFAULT_HAT_POLICY);
  equal(result.outcome, "allow");
});

test("conflict-of-interest rejects holding a conflicting hat", () => {
  const target = hat("hat-1", { conflictsWithHatIds: ["hat-rival"] });
  const existingBindings = [binding("b1", "hat-rival", "agent-a", HatBindingPhase.Active)];
  const result = conflictOfInterestPolicy.evaluate(
    baseRequest({ existingHats: [target], existingBindings }),
    DEFAULT_HAT_POLICY,
  );
  equal(result.outcome, "deny");
});

test("quorum rejects a gated hat without enough cosignatures", () => {
  const target = hat("hat-1", { quorumSize: 3 });
  const result = quorumPolicy.evaluate(baseRequest({ existingHats: [target], cosignerCount: 1 }), DEFAULT_HAT_POLICY);
  equal(result.outcome, "deny");
});

test("quorum allows a gated hat with enough cosignatures", () => {
  const target = hat("hat-1", { quorumSize: 3 });
  const result = quorumPolicy.evaluate(baseRequest({ existingHats: [target], cosignerCount: 3 }), DEFAULT_HAT_POLICY);
  equal(result.outcome, "allow");
});

test("warmup rejects promotion to Active before warmup completes", () => {
  const result = warmupPolicy.evaluate(
    baseRequest({ operation: "promote-active", warmupEndsAt: "2026-06-21T00:01:00.000Z" }),
    DEFAULT_HAT_POLICY,
  );
  equal(result.outcome, "deny");
});

test("max-new-hats rejects exceeding the 24h novelty budget", () => {
  const recentHatCreations = [
    "2026-06-20T23:00:00.000Z",
    "2026-06-20T22:00:00.000Z",
    "2026-06-20T21:00:00.000Z",
    "2026-06-20T20:00:00.000Z",
    "2026-06-20T19:00:00.000Z",
  ];
  const result = maxNewHatsPolicy.evaluate(
    baseRequest({ operation: "create-hat", recentHatCreations }),
    DEFAULT_HAT_POLICY,
  );
  equal(result.outcome, "deny");
});

// --- §6.2 no supervisor cycles ---------------------------------------------

test("no-supervisor-cycles rejects a supervises cycle", () => {
  const a = hat("A", { supervisesHatIds: ["B"] });
  const b = hat("B", { supervisesHatIds: ["A"] }); // cycle!
  const result = noSupervisorCyclesPolicy.evaluate(
    baseRequest({ operation: "create-hat", existingHats: [a], candidateHat: b }),
    DEFAULT_HAT_POLICY,
  );
  equal(result.outcome, "deny");
});

test("no-supervisor-cycles allows an acyclic DAG", () => {
  const a = hat("A", { supervisesHatIds: ["B"] });
  const b = hat("B", { supervisesHatIds: ["C"] });
  const c = hat("C", { supervisesHatIds: [] });
  const result = noSupervisorCyclesPolicy.evaluate(
    baseRequest({ operation: "create-hat", existingHats: [a, b], candidateHat: c }),
    DEFAULT_HAT_POLICY,
  );
  equal(result.outcome, "allow");
});

// --- evaluateAdmission composition -----------------------------------------

test("evaluateAdmission denies if any policy denies (cooldown wins)", () => {
  const recentSwaps: HatSwap[] = [
    {
      id: "1",
      hat: "hat-1",
      wearer: { spiffeID: "agent-a" },
      event: "SwapOff",
      occurredAt: "2026-06-20T23:58:20.000Z",
      previousWearer: { spiffeID: "agent-a", revokedAt: "" },
    },
  ];
  const result = evaluateAdmission(baseRequest({ recentSwaps }), DEFAULT_HAT_POLICY);
  ok(result.outcome === "deny");
  equal(result.throttleName, "cooldown");
});

test("evaluateAdmission allows a clean request", () => {
  const result = evaluateAdmission(baseRequest({}), DEFAULT_HAT_POLICY);
  equal(result.outcome, "allow");
});

// --- §6.3 HatSwap append-only ----------------------------------------------

test("HatSwap events are append-only", () => {
  let log: readonly HatSwap[] = [];
  log = emitSwap(log, makeHatSwap({ id: "s1", hat: "hat-1", wearer: { spiffeID: "agent-a" }, event: "SwapOn", occurredAt: NOW }));
  log = emitSwap(log, makeHatSwap({ id: "s2", hat: "hat-1", wearer: { spiffeID: "agent-a" }, event: "SwapOff", occurredAt: NOW }));
  equal(log.length, 2);
  equal(log[0]!.event, "SwapOn");
  equal(log[1]!.event, "SwapOff");
});

test("emitSwap does not mutate the prior log (retraction-native)", () => {
  const log0: readonly HatSwap[] = [];
  const log1 = emitSwap(log0, makeHatSwap({ id: "s1", hat: "h", wearer: { spiffeID: "a" }, event: "SwapOn", occurredAt: NOW }));
  equal(log0.length, 0);
  equal(log1.length, 1);
});

// --- §6.4 reputation accrual -----------------------------------------------

test("reputation accrues on the hat", () => {
  const h = hat("hat-1", { status: { reputation: 10, currentWearers: [], lifetimeWearers: 1 } });
  const updated = updateHatReputation(h, 5);
  equal(updated.status?.reputation, 15);
});

test("reputation works on a hat with no prior status", () => {
  const updated = updateHatReputation(hat("hat-1"), 7);
  equal(updated.status?.reputation, 7);
});

test("recordWearerOn / recordWearerOff track current wearers + lifetime", () => {
  let h = recordWearerOn(hat("hat-1"), "agent-a");
  equal(h.status?.currentWearers.length, 1);
  equal(h.status?.lifetimeWearers, 1);
  h = recordWearerOn(h, "agent-b");
  equal(h.status?.currentWearers.length, 2);
  equal(h.status?.lifetimeWearers, 2);
  h = recordWearerOff(h, "agent-a");
  equal(h.status?.currentWearers.length, 1);
  equal(h.status?.lifetimeWearers, 2); // lifetime never decreases
});

// --- §6.5 DST replay of admission ------------------------------------------

test("admission evaluation is deterministic (same inputs → identical decision)", () => {
  const req = baseRequest({
    existingBindings: [binding("b1", "hat-x", "agent-a", HatBindingPhase.Active)],
    existingHats: [hat("hat-1", { conflictsWithHatIds: ["hat-rival"] })],
  });
  const r1 = evaluateAdmission(req, DEFAULT_HAT_POLICY);
  const r2 = evaluateAdmission(req, DEFAULT_HAT_POLICY);
  equal(JSON.stringify(r1), JSON.stringify(r2));
});
