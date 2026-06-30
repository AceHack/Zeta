import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  CATALOGUE,
  createMockFormalVerification,
  type TlaVerificationResult,
} from "../src/formal-verification-port.ts";
import {
  finiteSocietyClosureCertificate,
  validateFiniteSocietyClosureCertificate,
} from "../src/society-closure-certificate.ts";
import {
  DEFAULT_MIN_SOAK_MS,
  DEFAULT_MIN_TICKS,
  evaluateSoakGate,
  type SoakGateCriteria,
} from "../src/review-gate-soak.ts";

// --- §6.1 society closure certificate --------------------------------------

test("3 agents → 3 pairs → 6 directed edges", () => {
  const cert = finiteSocietyClosureCertificate(["a", "b", "c"]);
  equal(cert.unorderedPairCount, 3);
  equal(cert.finalEdges.length, 6);
  equal(cert.steps.length, 3);
  const validation = validateFiniteSocietyClosureCertificate(cert);
  equal(validation.ok, true);
});

test("closure certificate edges are bidirectional + distinct", () => {
  const cert = finiteSocietyClosureCertificate(["a", "b"]);
  deepEqual([...cert.finalEdges].sort(), ["a->b", "b->a"]);
  equal(new Set(cert.finalEdges).size, 2);
});

test("closure certificate deduplicates agents (canonical)", () => {
  const cert = finiteSocietyClosureCertificate(["a", "b", "a", "c", "b"]);
  deepEqual(cert.agents, ["a", "b", "c"]);
  equal(cert.unorderedPairCount, 3);
});

test("singleton / empty society has no edges", () => {
  equal(finiteSocietyClosureCertificate(["a"]).finalEdges.length, 0);
  equal(finiteSocietyClosureCertificate([]).finalEdges.length, 0);
});

test("validation rejects a tampered edge count", () => {
  const cert = finiteSocietyClosureCertificate(["a", "b", "c"]);
  const tampered = { ...cert, finalEdges: cert.finalEdges.slice(0, 4) };
  const validation = validateFiniteSocietyClosureCertificate(tampered);
  ok(validation.ok === false);
});

// --- §6.2 mock formal verification (DST) -----------------------------------

test("mock FV port is deterministic", async () => {
  const fv = createMockFormalVerification();
  const r1 = await fv.runTla("SocietyEmergence");
  const r2 = await fv.runTla("SocietyEmergence");
  deepEqual(r1, r2);
  equal(r1.outcome, "pass");
});

test("mock FV returns cached results when supplied", async () => {
  const cached = new Map<string, TlaVerificationResult>([
    ["TickMonotonicity", { outcome: "fail", specName: "TickMonotonicity", invariant: "Mono", counterexample: "cx" }],
  ]);
  const fv = createMockFormalVerification(cached);
  const r = await fv.runTla("TickMonotonicity");
  equal(r.outcome, "fail");
});

test("mock FV flags an unknown spec (catalogue drift)", async () => {
  const fv = createMockFormalVerification();
  const r = await fv.runTla("NotARealSpec");
  equal(r.outcome, "usage_error");
});

test("catalogue lists 13 specs and is exposed via listSpecs", () => {
  equal(CATALOGUE.length, 13);
  deepEqual(createMockFormalVerification().listSpecs(), [...CATALOGUE]);
});

// --- §6.3 review gate soak test --------------------------------------------

const NO_SPEC_CRITERIA: SoakGateCriteria = {
  minTicks: DEFAULT_MIN_TICKS,
  minSoakMs: DEFAULT_MIN_SOAK_MS,
  requiredSpecs: [],
};

test("room with <100 ticks is blocked", () => {
  const result = evaluateSoakGate({ ticksSurvived: 50, soakMs: 3_600_000, criteria: NO_SPEC_CRITERIA });
  equal(result.outcome, "blocked");
});

test("room meeting ticks + soak + no specs is promoted", () => {
  const result = evaluateSoakGate({
    ticksSurvived: 100,
    soakMs: DEFAULT_MIN_SOAK_MS,
    criteria: NO_SPEC_CRITERIA,
  });
  equal(result.outcome, "promoted");
});

test("review gate blocks when a required spec did not pass", () => {
  const specResults = new Map<string, TlaVerificationResult>([
    ["SocietyEmergence", { outcome: "pass", specName: "SocietyEmergence", durationMs: 1 }],
    ["SocietyRuntimeRefinement", { outcome: "fail", specName: "SocietyRuntimeRefinement", invariant: "I", counterexample: "cx" }],
  ]);
  const result = evaluateSoakGate({
    ticksSurvived: 200,
    soakMs: DEFAULT_MIN_SOAK_MS,
    criteria: { minTicks: 100, minSoakMs: DEFAULT_MIN_SOAK_MS, requiredSpecs: ["SocietyEmergence", "SocietyRuntimeRefinement"] },
    specResults,
  });
  ok(result.outcome === "blocked");
  ok(result.missingCriteria.some((m) => m.includes("SocietyRuntimeRefinement")));
});

test("review gate blocks when a required spec was not run", () => {
  const result = evaluateSoakGate({
    ticksSurvived: 200,
    soakMs: DEFAULT_MIN_SOAK_MS,
    criteria: { minTicks: 100, minSoakMs: DEFAULT_MIN_SOAK_MS, requiredSpecs: ["SocietyEmergence"] },
  });
  equal(result.outcome, "blocked");
});

test("review gate blocks on an invalid closure certificate", () => {
  const cert = finiteSocietyClosureCertificate(["a", "b", "c"]);
  const tampered = { ...cert, finalEdges: cert.finalEdges.slice(0, 2) };
  const result = evaluateSoakGate({
    ticksSurvived: 200,
    soakMs: DEFAULT_MIN_SOAK_MS,
    criteria: NO_SPEC_CRITERIA,
    closureCertificate: tampered,
  });
  equal(result.outcome, "blocked");
});

test("review gate promotes a fully-federated room", () => {
  const cert = finiteSocietyClosureCertificate(["a", "b", "c"]);
  const specResults = new Map<string, TlaVerificationResult>([
    ["SocietyEmergence", { outcome: "pass", specName: "SocietyEmergence", durationMs: 1 }],
  ]);
  const result = evaluateSoakGate({
    ticksSurvived: 100,
    soakMs: DEFAULT_MIN_SOAK_MS,
    criteria: { minTicks: 100, minSoakMs: DEFAULT_MIN_SOAK_MS, requiredSpecs: ["SocietyEmergence"] },
    specResults,
    closureCertificate: cert,
  });
  equal(result.outcome, "promoted");
});

// --- determinism (MP-1) -----------------------------------------------------

test("review gate evaluation is deterministic", () => {
  const input = { ticksSurvived: 50, soakMs: 100, criteria: NO_SPEC_CRITERIA };
  deepEqual(evaluateSoakGate(input), evaluateSoakGate(input));
});
