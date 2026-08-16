# Merge1 §06 — Formal Verification → Agentic-Org Migration

**Scope:** Port the formal verification tooling from `src/Core.TypeScript/formal-verification/` into the agentic-organization TypeScript codebase. TLA+ specs verify room federation, society-finite-closure certifies all rooms eventually connect, and formal verification wires into the room's promotion gate (≥100 ticks / ≥24h soak).

**Outside sources:**

- `src/Core.TypeScript/formal-verification/run-tlc.ts` — TLA+/TLC model checker wrapper, CATALOGUE of 13 specs
- `tools/formal-verification/society-finite-closure.ts` — `FiniteSocietyClosureCertificate`, finite-society closure
- `src/Core.TypeScript/formal-verification/run-alloy.ts` — Alloy model checker wrapper
- `tools/tla/specs/SocietyEmergence.tla` — society emergence TLA+ spec
- `tools/tla/specs/SocietyRuntimeRefinement.tla` — runtime refinement TLA+ spec

**Agentic-org files touched:**

- `packages/application/src/conformance.ts` — conformance checking
- `packages/application/src/review-gate.ts` — review gate
- `packages/application/src/qa.ts` — QA checks
- `packages/application/src/control-plane-guard.ts` — control plane guard
- `packages/application/src/hat-guardrails.ts` — hat guardrails
- `packages/domain/src/state-reconciliation.ts` — state reconciliation
- `docs/ROOMS_AS_DETERMINISTIC_SIMULATIONS.md` — rooms design doc
- NEW: `packages/application/src/formal-verification-port.ts`
- NEW: `packages/application/src/society-closure-certificate.ts`

**Governing doctrine:** §10 (MP-1 DST Replayability, MP-4 Retraction-Native, MP-7 Result Over Exception, MP-8 Cross-Language Parity)

---

## 1. What's Solved Outside

| Type/Function | File:Line | What it does |
|---|---|---|
| `CATALOGUE` | `run-tlc.ts:67` | 13 TLA+ specs: SmokeCheck, TickMonotonicity, OperatorLifecycleRace, TransactionInterleaving, TwoPCSink, InfoTheoreticSharder, RecursiveCountingLFP, FeatureFlagsResolution, SocietyEmergence, SocietyRuntimeRefinement, DbspSpec, CircuitRegistration, SpineAsyncProtocol |
| `runTlc(specName)` | `run-tlc.ts` | Shell to TLC, parse output, exit accordingly (0=success, 1=violation, 2=toolchain, 3=usage) |
| `runTlcAll()` | `run-tlc.ts` | Run all 13 specs; catalogue drift = failure |
| `checkToolchain()` | `run-tlc.ts` | Verify java + tla2tools.jar present |
| `FiniteSocietyClosureCertificate` | `society-finite-closure.ts:9` | Certificate: agents, unorderedPairCount, steps, finalEdges |
| `finiteSocietyClosureCertificate(agents)` | `society-finite-closure.ts:28` | Build certificate: for each unordered pair, add bidirectional edges |
| `validateFiniteSocietyClosureCertificate(cert)` | `society-finite-closure.ts:59` | Validate: correct pair count, step count, edge count |
| `FiniteSocietyClosureValidation` | `society-finite-closure.ts:16` | `{ ok: true, agentCount, ... } \| { ok: false, reason }` |
| `SocietyEmergence.tla` | `tools/tla/specs/` | TLA+ spec: society emergence from pairwise relations |
| `SocietyRuntimeRefinement.tla` | `tools/tla/specs/` | TLA+ spec: runtime refinement of society protocol |

---

## 2. What Exists in Agentic-Org Today

| TS Type | File:Line | What it does | Gap vs formal-verification |
|---|---|---|---|
| `ConformanceViolation` | `conformance.ts:25` | State transition violation report | No TLA+ backing; ad-hoc checks |
| `ConformanceReport` | `conformance.ts:43` | Conformance report with checked/conformant/nonconformant counts | No formal verification integration |
| `ReviewGate` | `review-gate.ts` | Review gate for promotions | No ≥100 ticks / ≥24h soak gate |
| `QaCheck` | `qa.ts` | QA check | No TLA+ model checking |
| `ControlPlaneGuard` | `control-plane-guard.ts` | Control plane guard | No formal verification |
| `HatGuardrails` | `hat-guardrails.ts` | Hat guardrails (ActionClass) | No OPA-style admission policies |
| `StateReconciliation` | `state-reconciliation.ts` | State reconciliation | No formal model |

---

## 3. Migration Plan

### 3.1 Formal verification port

**Create:** `packages/application/src/formal-verification-port.ts`

Port the TLA+/TLC and Alloy model checker wrappers as a seam-injectable port.

```typescript
// packages/application/src/formal-verification-port.ts

/** The room's formal verification seam.
 * Real = shell to TLC/Alloy; mock = return cached results (DST). */
export interface FormalVerificationPort {
  /** Run TLA+/TLC on a spec. Returns verification result. */
  runTla(specName: string): Promise<TlaVerificationResult>;
  /** Run Alloy on a model. Returns verification result. */
  runAlloy(modelName: string): Promise<AlloyVerificationResult>;
  /** Check toolchain readiness (java + tla2tools.jar). */
  checkToolchain(): Promise<ToolchainStatus>;
  /** List available specs in the catalogue. */
  listSpecs(): readonly string[];
}

export type TlaVerificationResult =
  | { outcome: "pass"; specName: string; durationMs: number }
  | { outcome: "fail"; specName: string; invariant: string; counterexample: string }
  | { outcome: "toolchain_error"; reason: string }
  | { outcome: "usage_error"; reason: string };

export type AlloyVerificationResult =
  | { outcome: "pass"; modelName: string; durationMs: number }
  | { outcome: "fail"; modelName: string; counterexample: string }
  | { outcome: "toolchain_error"; reason: string };

export type ToolchainStatus =
  | { ready: true; javaVersion: string; tlaVersion: string }
  | { ready: false; reason: string };

/** Mock formal verification — returns cached/pass results for DST.
 * Same inputs → same outputs (DST replayable). */
export function createMockFormalVerification(
  cachedResults?: ReadonlyMap<string, TlaVerificationResult>,
): FormalVerificationPort {
  return {
    runTla: async (specName) =>
      cachedResults?.get(specName) ?? { outcome: "pass", specName, durationMs: 0 },
    runAlloy: async (modelName) =>
      ({ outcome: "pass", modelName, durationMs: 0 }),
    checkToolchain: async () => ({ ready: true, javaVersion: "mock", tlaVersion: "mock" }),
    listSpecs: () => [...CATALOGUE],
  };
}

/** Real formal verification — shells to TLC/Alloy.
 * Port of src/Core.TypeScript/formal-verification/run-tlc.ts. */
export function createRealFormalVerification(): FormalVerificationPort {
  // Full implementation ported from src/Core.TypeScript/formal-verification/run-tlc.ts:174 runTlc
}

/** The curated TLA+ spec catalogue.
 * Port of src/Core.TypeScript/formal-verification/run-tlc.ts CATALOGUE. */
export const CATALOGUE: readonly string[] = [
  "SmokeCheck", "TickMonotonicity", "OperatorLifecycleRace",
  "TransactionInterleaving", "TwoPCSink", "InfoTheoreticSharder",
  "RecursiveCountingLFP", "FeatureFlagsResolution",
  "SocietyEmergence", "SocietyRuntimeRefinement",
  "DbspSpec", "CircuitRegistration", "SpineAsyncProtocol",
];
```

**Composes with Room:** Room gains a `formalVerification?: FormalVerificationPort` seam. When present, the room's promotion gate runs TLA+ specs before promoting.

### 3.2 Society finite closure port

**Create:** `packages/application/src/society-closure-certificate.ts`

Port the finite-society closure certificate — proves that all rooms eventually connect via pairwise relations.

```typescript
// packages/application/src/society-closure-certificate.ts

/** Port of tools/formal-verification/society-finite-closure.ts.
 * Proves that a finite society of N agents forms a complete graph
 * via pairwise bidirectional relations. */
export type DirectedEdge = `${string}->${string}`;

export type FiniteSocietyClosureStep = {
  readonly pair: readonly [string, string];
  readonly addedEdges: readonly [DirectedEdge, DirectedEdge];
  readonly edgeCountAfter: number;
};

export type FiniteSocietyClosureCertificate = {
  readonly agents: readonly string[];
  readonly unorderedPairCount: number;
  readonly steps: readonly FiniteSocietyClosureStep[];
  readonly finalEdges: readonly DirectedEdge[];
};

export type FiniteSocietyClosureValidation =
  | { readonly ok: true; readonly agentCount: number; readonly unorderedPairCount: number; readonly directedEdgeCount: number }
  | { readonly ok: false; readonly reason: string };

export function finiteSocietyClosureCertificate(
  agents: readonly string[],
): FiniteSocietyClosureCertificate {
  // Full implementation ported from tools/formal-verification/society-finite-closure.ts:28
}

export function validateFiniteSocietyClosureCertificate(
  certificate: FiniteSocietyClosureCertificate,
): FiniteSocietyClosureValidation {
  // Full implementation ported from tools/formal-verification/society-finite-closure.ts:59
}
```

**Composes with Room Federation:** When rooms federate via the relation protocol (§04), the society closure certificate proves that all rooms will eventually form a complete relation graph. This is the formal guarantee behind "harmonious division" — aperiodic proximity that still achieves full connectivity.

### 3.3 Conformance upgrade — TLA+ backed

**Upgrade `conformance.ts`:** Replace ad-hoc state transition checks with TLA+-backed verification.

**Before:** `ConformanceViolation` is computed by comparing `toState` against `legalToStates` array.

**After:** `ConformanceViolation` is computed by running the `SocietyRuntimeRefinement` TLA+ spec against the event log. If TLC finds an invariant violation, it's a conformance violation.

```typescript
// conformance.ts — AFTER upgrade
export async function checkConformance(
  events: readonly OrgEvent[],
  fvPort: FormalVerificationPort,
): Promise<ConformanceReport> {
  // ... translate events to TLA+ trace
  // ... run SocietyRuntimeRefinement spec
  // ... map TLA+ violations to ConformanceViolation
}
```

### 3.4 Review gate upgrade — soak test

**Upgrade `review-gate.ts`:** Add ≥100 ticks / ≥24h soak gate before promotion.

```typescript
// review-gate.ts — AFTER upgrade
export type ReviewGateCriteria = {
  /** Minimum ticks the room must survive before promotion. */
  minTicks: number;       // default: 100
  /** Minimum wall-clock duration before promotion. */
  minSoakMs: number;      // default: 86_400_000 (24h)
  /** TLA+ specs that must pass. */
  requiredSpecs: readonly string[];  // default: ["SocietyEmergence", "SocietyRuntimeRefinement"]
  /** Society closure certificate (if federated). */
  closureCertificate?: FiniteSocietyClosureCertificate;
};

export type ReviewGateResult =
  | { outcome: "promoted"; criteria: ReviewGateCriteria; ticksSurvived: number; soakMs: number }
  | { outcome: "blocked"; reason: string; missingCriteria: readonly string[] };
```

### 3.5 Hat guardrails upgrade — OPA-style admission

**Upgrade `hat-guardrails.ts`:** Back guardrails with OPA-style admission policies (ported from the K8s hat-system's 7 OPA policies — see §07).

```typescript
// hat-guardrails.ts — AFTER upgrade
export type AdmissionPolicy = {
  readonly name: string;
  readonly evaluate: (request: AdmissionRequest) => AdmissionDecision;
};

export type AdmissionRequest = {
  readonly hatId: string;
  readonly agentId: string;
  readonly action: string;
  readonly context: Record<string, unknown>;
};

export type AdmissionDecision =
  | { outcome: "allow" }
  | { outcome: "deny"; reason: string };

/** The 7 OPA policies — ported from full-ai-cluster/k8s/applications/hat-system/policies/. */
export const ADMISSION_POLICIES: readonly AdmissionPolicy[] = [
  cooldownPolicy,           // 01-cooldown
  maxBindingsPolicy,        // 02-max-bindings
  conflictOfInterestPolicy, // 03-conflict-of-interest
  quorumPolicy,             // 04-quorum
  warmupPolicy,             // 05-warmup
  maxNewHatsPolicy,         // 06-max-new-hats
  noSupervisorCyclesPolicy, // 07-no-supervisor-cycles
];
```

---

## 4. Upgrade Path

### 4.1 `conformance.ts` — EXTEND

**Before:** Ad-hoc state transition checks against `legalToStates` arrays.

**After:** TLA+-backed verification via `FormalVerificationPort`. Ad-hoc checks remain as a fast path; TLA+ is the formal backstop.

### 4.2 `review-gate.ts` — EXTEND

**Before:** Review gate with no soak test.

**After:** Review gate with ≥100 ticks / ≥24h soak + TLA+ spec requirements + society closure certificate.

### 4.3 `hat-guardrails.ts` — EXTEND

**Before:** `ActionClass` enum (WriteCode, ReviewCode, ApproveReview, WriteDoc, Prioritize).

**After:** `ActionClass` + 7 OPA-style admission policies (cooldown, max-bindings, conflict-of-interest, quorum, warmup, max-new-hats, no-supervisor-cycles).

---

## 5. Dependencies

- **Depends on:** §10 (doctrine), §01 (F# core — DST for replayable verification), §04 (bus — relation protocol for society closure), §07 (hat-system — OPA policies)
- **Blocks:** None (this is a verification layer, not a runtime dependency)

---

## 6. Testing Strategy

### 6.1 Society closure certificate

```typescript
Deno.test("3 agents → 3 pairs → 6 directed edges", () => {
  const cert = finiteSocietyClosureCertificate(["a", "b", "c"]);
  assertEquals(cert.unorderedPairCount, 3);
  assertEquals(cert.finalEdges.length, 6);
  const validation = validateFiniteSocietyClosureCertificate(cert);
  assertEquals(validation.ok, true);
});
```

### 6.2 Mock formal verification (DST)

```typescript
Deno.test("Mock FV port is deterministic", async () => {
  const fv = createMockFormalVerification();
  const r1 = await fv.runTla("SocietyEmergence");
  const r2 = await fv.runTla("SocietyEmergence");
  assertEquals(r1, r2);
});
```

### 6.3 Review gate soak test

```typescript
Deno.test("Room with <100 ticks is blocked", () => {
  const result = evaluateReviewGate({
    ticksSurvived: 50,
    soakMs: 3_600_000,
    criteria: { minTicks: 100, minSoakMs: 86_400_000, requiredSpecs: [] },
  });
  assertEquals(result.outcome, "blocked");
});
```

### 6.4 CI integration

```yaml
# .github/workflows/formal-verification.yml
- name: Run TLA+ specs
  run: bun src/Core.TypeScript/formal-verification/run-tlc.ts --all
- name: Validate society closure
  run: bun test packages/application/test/society-closure.test.ts
```

### 6.5 Cross-language parity

TLA+ specs verify TS models. The same specs verify F# models. Golden vectors ensure both produce the same counterexamples.
