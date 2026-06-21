# Merge1 §07 — K8s Hat-System → Agentic-Org Migration

**Scope:** Port the Kubernetes hat-system operator from `full-ai-cluster/k8s/applications/hat-system/` into the agentic-organization TypeScript codebase. The Hat CRD upgrades our `hat-definition.ts`, the HatBinding lifecycle upgrades our `hat-lifecycle.ts`, the 7 OPA throttles upgrade our `hat-guardrails.ts`, and HatSwap append-only ticks become room events.

**Outside sources:**

- `full-ai-cluster/k8s/applications/hat-system/crds/hat.yaml` — Hat CRD: skills, authority, supervises DAG, throttles
- `full-ai-cluster/k8s/applications/hat-system/crds/hatbinding.yaml` — HatBinding: wearer SPIFFE ID, 5-phase lifecycle
- `full-ai-cluster/k8s/applications/hat-system/crds/hatpolicy.yaml` — HatPolicy: cluster-wide throttle defaults
- `full-ai-cluster/k8s/applications/hat-system/crds/hatswap.yaml` — HatSwap: append-only tick events (7 event types)
- `full-ai-cluster/k8s/applications/hat-system/operator/api/v1alpha1/types.go` — Go types matching CRDs
- `full-ai-cluster/k8s/applications/hat-system/operator/internal/controller/hatbinding_controller.go` — reconciler
- `full-ai-cluster/k8s/applications/hat-system/operator/internal/tick/emitter.go` — tick fan-out (HatSwap CR + k8s Event + slog + NATS)
- `full-ai-cluster/k8s/applications/hat-system/policies/01-cooldown.yaml` through `07-no-supervisor-cycles.yaml` — 7 OPA Gatekeeper throttles
- `full-ai-cluster/k8s/applications/hat-system/hats/hat-designer.yaml` — seed hat

**Agentic-org files touched:**

- `packages/application/src/room.ts` — Room with hatIds[], credentialProxy
- `packages/application/src/rmo.ts` — RMO with planTaskRooms, computeRequiredHatSupply
- `packages/application/src/hat-lifecycle.ts`
- `packages/application/src/hat-authority-port.ts`
- `packages/application/src/hat-guardrails.ts`
- `packages/application/src/reputation.ts`
- `packages/domain/src/hat-definition.ts`
- `packages/domain/src/hat-binding.ts`

**Governing doctrine:** §10 (MP-1 DST Replayability, MP-3 ZetaId Addressability, MP-4 Retraction-Native, MP-5 Freedom-Always-In-Menu, MP-7 Result Over Exception)

---

## 1. What's Solved Outside

| CRD/Type | File:Line | What it does |
|---|---|---|
| Hat CRD | `hat.yaml:39` | `spec: { description, skills[], authority{namespaces[], rules[]}, supervises[], throttles{cooldownSeconds, stickyAttributionSeconds, warmupSeconds, quorumGated, quorumSize, conflictsWith[]} }` |
| Hat.status | `hat.yaml:152` | `{ reputation, currentWearers[], lifetimeWearers, conditions[] }` |
| HatBinding CRD | `hatbinding.yaml:37` | `spec: { hat, wearer{spiffeID, serviceAccountRef}, cosignedBy[], requestedAt }` |
| HatBinding.status.phase | `hatbinding.yaml:83` | 5 phases: Pending, Warmup, Active, Probation, Revoked |
| HatBinding.status.effectiveAuthority | `hatbinding.yaml:91` | Authority actually granted (reduced during Warmup/Probation) |
| HatBinding.status.stickyAttributionEndsAt | `hatbinding.yaml:120` | After swap-off, actions still attributed to this hat until this time |
| HatPolicy CRD | `hatpolicy.yaml:38` | Cluster-wide defaults: cooldownSeconds(300), stickyAttributionSeconds(600), warmupSeconds(180), maxBindingsPerWearer(3), maxNewHatsPerDay(5), quorumDefaultSize(3), swapRetentionDays(365), tickEmit{natsSubject, enableLoki, enableEvents} |
| HatSwap CRD | `hatswap.yaml:48` | `spec: { hat, wearer{spiffeID}, event, occurredAt, reason, message, bindingRef, throttleName, previousWearer }` |
| HatSwap.event | `hatswap.yaml:60` | 7 events: SwapOn, SwapOff, WarmupBegin, WarmupEnd, Probation, QuorumGrant, Throttled |
| OPA 01-cooldown | `01-cooldown.yaml` | Reject HatBinding if wearer had SwapOff for same hat within cooldownSeconds |
| OPA 02-max-bindings | `02-max-bindings.yaml` | Reject if wearer exceeds maxBindingsPerWearer |
| OPA 03-conflict-of-interest | `03-conflict-of-interest.yaml` | Reject if wearer holds a conflicting hat |
| OPA 04-quorum | `04-quorum.yaml` | Reject quorum-gated hat binding without enough cosigners |
| OPA 05-warmup | `05-warmup.yaml` | Enforce warmup probation period |
| OPA 06-max-new-hats | `06-max-new-hats.yaml` | Rate limit on novel Hat creation (maxNewHatsPerDay) |
| OPA 07-no-supervisor-cycles | `07-no-supervisor-cycles.yaml` | Reject Hat create/update if supervises DAG would have a cycle |
| tick emitter | `emitter.go` | Fan-out: HatSwap CR + k8s Event + slog + NATS subject `zeta.society.hats.ticks` |

---

## 2. What Exists in Agentic-Org Today

| TS Type | File:Line | What it does | Gap vs K8s hat-system |
|---|---|---|---|
| `HatDefinition` | `hat-definition.ts:96` | Hat with skills, authority, supervises DAG, throttles | Missing SPIFFE wearer ID; missing `conflictsWith` as throttle; missing `quorumGated` |
| `HatBinding` | `hat-binding.ts:34` | Binding with wearer, phase, timestamps | Missing SPIFFE ID; missing `cosignedBy[]`; missing `effectiveAuthority`; missing `stickyAttributionEndsAt` |
| `HatBindingPhase` | `hat-binding.ts:13` | 8 phases: Pending, Warmup, Active, Probation, Expired, Released, Succeeded, Revoked | Has more phases than K8s (5), but missing the K8s semantics of effectiveAuthority |
| `hat-lifecycle.ts` | `hat-lifecycle.ts` | Deterministic binding transitions | No tick emission; no OPA throttle enforcement |
| `hat-guardrails.ts` | `hat-guardrails.ts` | ActionClass guardrails | No OPA-style admission policies |
| `reputation.ts` | `reputation.ts` | Reputation scoring | No `Hat.status.reputation` equivalent |

---

## 3. Migration Plan

### 3.1 Hat CRD → hat-definition.ts upgrade

**Upgrade `hat-definition.ts`:** Add the K8s Hat CRD fields that are missing.

```typescript
// hat-definition.ts — AFTER upgrade
export type HatThrottles = {
  cooldownSeconds: number;
  stickyAttributionSeconds: number;
  warmupSeconds: number;
  quorumGated: boolean;
  quorumSize?: number;
  conflictsWith: readonly string[];  // K8s: conflictsWith — anti-collusion
};

export type HatAuthority = {
  namespaces: readonly string[];     // empty = cluster-wide (requires quorum)
  rules: readonly {
    verbs: readonly string[];
    resources: readonly string[];
    apiGroups: readonly string[];
  }[];
};

export type HatSkill = {
  name: string;
  level: "novice" | "intermediate" | "expert";
  providedBy?: string;
};

export type HatStatus = {
  reputation: number;
  currentWearers: readonly string[];  // SPIFFE IDs
  lifetimeWearers: number;
};

export type HatDefinition = {
  id: string;
  name: string;
  departmentId: DepartmentId;
  level: HatLevel;
  supervisesHatIds: readonly string[];
  reportsToHatIds: readonly string[];
  conflictsWithHatIds: readonly string[];
  assignableByHatIds: readonly string[];
  allowedToolBundles: readonly ToolBundle[];
  // NEW: K8s Hat CRD fields
  skills: readonly HatSkill[];
  authority: HatAuthority;
  throttles: HatThrottles;
  // ... existing fields remain
  status?: HatStatus;
};
```

### 3.2 HatBinding CRD → hat-binding.ts upgrade

**Upgrade `hat-binding.ts`:** Add SPIFFE wearer ID, cosigners, effective authority, and sticky attribution.

```typescript
// hat-binding.ts — AFTER upgrade
export type HatBindingWearer = {
  spiffeID: string;               // K8s: SPIFFE ID of the workload
  serviceAccountRef?: { name: string; namespace: string };
};

export type HatBindingCosigner = {
  spiffeID: string;
  signedAt: string;
  attestation?: string;
};

export type EffectiveAuthority = {
  namespaces: readonly string[];
  rules: readonly { verbs: readonly string[]; resources: readonly string[]; apiGroups: readonly string[] }[];
};

export type HatBinding = {
  id: string;
  hatId: string;
  organizationId: string;
  // UPGRADE: wearer is now a structured type with SPIFFE ID
  wearer: HatBindingWearer;
  wearerAgentId: string;          // back-compat: derived from wearer.spiffeID
  phase: HatBindingPhase;
  boundAt: string;
  warmupEndsAt: string;
  expiresAt: string;
  activatedAt?: string;
  endedAt?: string;
  cooldownUntil?: string;
  reason?: string;
  // NEW: K8s HatBinding CRD fields
  cosignedBy?: readonly HatBindingCosigner[];
  requestedAt?: string;
  effectiveAuthority?: EffectiveAuthority;  // reduced during Warmup/Probation
  stickyAttributionEndsAt?: string;
};
```

### 3.3 HatPolicy → hat-policy.ts

**Create:** `packages/application/src/hat-policy.ts`

Port the cluster-wide HatPolicy singleton with default throttle values.

```typescript
// packages/application/src/hat-policy.ts

/** Port of full-ai-cluster/k8s/applications/hat-system/crds/hatpolicy.yaml.
 * Cluster-wide singleton with default throttle values.
 * Per-Hat overrides live in HatDefinition.throttles. */
export interface HatPolicy {
  throttles: {
    cooldownSeconds: number;           // default: 300
    stickyAttributionSeconds: number;  // default: 600
    warmupSeconds: number;             // default: 180
    maxBindingsPerWearer: number;      // default: 3
    maxNewHatsPerDay: number;          // default: 5
    quorumDefaultSize: number;         // default: 3
  };
  swapRetentionDays: number;           // default: 365
  tickEmit: {
    natsSubject: string;               // default: "zeta.society.hats.ticks"
    enableLokiStructuredLogs: boolean; // default: true
    enableEvents: boolean;             // default: true
  };
}

export const DEFAULT_HAT_POLICY: HatPolicy = {
  throttles: {
    cooldownSeconds: 300,
    stickyAttributionSeconds: 600,
    warmupSeconds: 180,
    maxBindingsPerWearer: 3,
    maxNewHatsPerDay: 5,
    quorumDefaultSize: 3,
  },
  swapRetentionDays: 365,
  tickEmit: {
    natsSubject: "zeta.society.hats.ticks",
    enableLokiStructuredLogs: true,
    enableEvents: true,
  },
};
```

### 3.4 HatSwap → room events

**Create:** `packages/application/src/hat-swap-event.ts`

Port the HatSwap append-only tick events as room events.

```typescript
// packages/application/src/hat-swap-event.ts

/** Port of full-ai-cluster/k8s/applications/hat-system/crds/hatswap.yaml.
 * Append-only event record of a single hat binding transition.
 * Immutable — controllers WRITE them on transition and never UPDATE them. */
export type HatSwapEvent =
  | "SwapOn" | "SwapOff" | "WarmupBegin" | "WarmupEnd"
  | "Probation" | "QuorumGrant" | "Throttled";

export interface HatSwap {
  readonly id: string;             // ZetaId
  readonly hat: string;
  readonly wearer: { spiffeID: string };
  readonly event: HatSwapEvent;
  readonly occurredAt: string;     // ISO-8601
  readonly reason?: string;
  readonly message?: string;
  readonly bindingRef?: { name: string; namespace: string; uid: string };
  readonly throttleName?: string;
  readonly previousWearer?: { spiffeID: string; revokedAt: string };
}
```

**Composes with Room:** Every hat binding transition emits a HatSwap event. The event is append-only (retraction-native — no UPDATE, only new events). Room telemetry streams HatSwap events via the bus (§04) to NATS subject `zeta.society.hats.ticks`.

### 3.5 7 OPA throttles → hat-guardrails.ts

**Upgrade `hat-guardrails.ts`:** Port the 7 OPA Gatekeeper policies as admission policies.

```typescript
// hat-guardrails.ts — AFTER upgrade

/** Port of full-ai-cluster/k8s/applications/hat-system/policies/.
 * 7 OPA Gatekeeper throttles as admission policies. */
export type AdmissionPolicy = {
  readonly name: string;
  readonly evaluate: (request: AdmissionRequest, policy: HatPolicy) => AdmissionDecision;
};

export type AdmissionRequest = {
  readonly hatId: string;
  readonly wearerSpiffeID: string;
  readonly existingBindings: readonly HatBinding[];
  readonly existingHats: readonly HatDefinition[];
  readonly recentSwaps: readonly HatSwap[];
};

export type AdmissionDecision =
  | { outcome: "allow" }
  | { outcome: "deny"; reason: string; throttleName: string };

/** 01-cooldown: Reject if wearer had SwapOff for same hat within cooldownSeconds. */
export const cooldownPolicy: AdmissionPolicy = {
  name: "cooldown",
  evaluate: (req, policy) => {
    const cooldownSeconds = policy.throttles.cooldownSeconds;
    const recentSwapOff = req.recentSwaps.find(
      (s) => s.event === "SwapOff" && s.hat === req.hatId && s.previousWearer?.spiffeID === req.wearerSpiffeID
    );
    if (recentSwapOff) {
      const elapsed = (Date.now() - Date.parse(recentSwapOff.occurredAt)) / 1000;
      if (elapsed < cooldownSeconds) {
        return { outcome: "deny", reason: `cooldown: ${elapsed}s < ${cooldownSeconds}s`, throttleName: "cooldown" };
      }
    }
    return { outcome: "allow" };
  },
};

/** 02-max-bindings: Reject if wearer exceeds maxBindingsPerWearer. */
export const maxBindingsPolicy: AdmissionPolicy = {
  name: "max-bindings",
  evaluate: (req, policy) => {
    const active = req.existingBindings.filter(
      (b) => b.wearer.spiffeID === req.wearerSpiffeID && !isTerminalHatBinding(b)
    );
    if (active.length >= policy.throttles.maxBindingsPerWearer) {
      return { outcome: "deny", reason: `max-bindings: ${active.length} >= ${policy.throttles.maxBindingsPerWearer}`, throttleName: "max-bindings" };
    }
    return { outcome: "allow" };
  },
};

// 03-conflict-of-interest, 04-quorum, 05-warmup, 06-max-new-hats, 07-no-supervisor-cycles
// ... (same pattern)

export const ADMISSION_POLICIES: readonly AdmissionPolicy[] = [
  cooldownPolicy,
  maxBindingsPolicy,
  conflictOfInterestPolicy,
  quorumPolicy,
  warmupPolicy,
  maxNewHatsPolicy,
  noSupervisorCyclesPolicy,
];

/** Evaluate all admission policies. Deny if ANY policy denies. */
export function evaluateAdmission(
  request: AdmissionRequest,
  policy: HatPolicy,
): AdmissionDecision {
  for (const p of ADMISSION_POLICIES) {
    const result = p.evaluate(request, policy);
    if (result.outcome === "deny") return result;
  }
  return { outcome: "allow" };
}
```

### 3.6 Reputation → Hat.status.reputation

**Upgrade `reputation.ts`:** Absorb the `Hat.status.reputation` field from the K8s Hat CRD.

```typescript
// reputation.ts — AFTER upgrade
/** Reputation accrues on the hat AND the pairings — never only the agent.
 * Port of Hat.status.reputation from the K8s Hat CRD. */
export function updateHatReputation(
  hat: HatDefinition,
  delta: number,
): HatDefinition {
  const current = hat.status?.reputation ?? 0;
  return {
    ...hat,
    status: {
      ...(hat.status ?? { reputation: 0, currentWearers: [], lifetimeWearers: 0 }),
      reputation: current + delta,
    },
  };
}
```

---

## 4. Upgrade Path

### 4.1 `hat-definition.ts` — EXTEND

**Before:** HatDefinition has `conflictsWithHatIds`, `maxConcurrentAssignments`, `tokenTtlSeconds`, `warmupSeconds`, `cooldownSeconds` as flat fields.

**After:** HatDefinition gains structured `authority: HatAuthority`, `throttles: HatThrottles` (with `quorumGated`, `quorumSize`, `conflictsWith`), `skills: HatSkill[]` (with level + providedBy), and `status?: HatStatus`. Existing flat fields remain for back-compat.

### 4.2 `hat-binding.ts` — EXTEND

**Before:** HatBinding has `wearerAgentId: string` as a flat field.

**After:** HatBinding gains `wearer: HatBindingWearer` (with `spiffeID`), `cosignedBy?: HatBindingCosigner[]`, `effectiveAuthority?: EffectiveAuthority`, `stickyAttributionEndsAt?: string`. `wearerAgentId` remains as a derived back-compat field.

### 4.3 `hat-lifecycle.ts` — EXTEND

**Before:** Deterministic binding transitions with no tick emission.

**After:** Each transition emits a HatSwap event (append-only). The lifecycle function returns `{ binding, event, swap }` instead of just `{ binding, event }`.

### 4.4 `hat-guardrails.ts` — EXTEND

**Before:** `ActionClass` enum (WriteCode, ReviewCode, etc.).

**After:** `ActionClass` + 7 OPA-style admission policies. `evaluateAdmission()` runs all 7 policies before allowing a hat binding.

---

## 5. Dependencies

- **Depends on:** §10 (doctrine), §01 (F# core — ZetaId for HatSwap IDs), §03 (agent-loop — AgentState maps to HatBindingPhase), §04 (bus — HatSwap events stream via bus)
- **Blocks:** §06 (formal verification — OPA policies are verified by TLA+)

---

## 6. Testing Strategy

### 6.1 OPA throttle: cooldown

```typescript
Deno.test("Cooldown rejects re-binding within cooldownSeconds", () => {
  const recentSwaps: HatSwap[] = [
    { id: "1", hat: "hat-1", wearer: { spiffeID: "spiffe://x/agent" }, event: "SwapOff", occurredAt: new Date(Date.now() - 100_000).toISOString(), previousWearer: { spiffeID: "spiffe://x/agent", revokedAt: "" } },
  ];
  const result = cooldownPolicy.evaluate({ hatId: "hat-1", wearerSpiffeID: "spiffe://x/agent", existingBindings: [], existingHats: [], recentSwaps }, DEFAULT_HAT_POLICY);
  assertEquals(result.outcome, "deny");
});
```

### 6.2 OPA throttle: no supervisor cycles

```typescript
Deno.test("Supervisor cycle rejected", () => {
  const hats: HatDefinition[] = [
    { id: "A", supervisesHatIds: ["B"], ... },
    { id: "B", supervisesHatIds: ["A"], ... },  // cycle!
  ];
  const result = noSupervisorCyclesPolicy.evaluate({ hatId: "B", ... }, DEFAULT_HAT_POLICY);
  assertEquals(result.outcome, "deny");
});
```

### 6.3 HatSwap append-only

```typescript
Deno.test("HatSwap events are append-only", () => {
  const swaps: HatSwap[] = [];
  emitSwap(swaps, { event: "SwapOn", hat: "hat-1", ... });
  emitSwap(swaps, { event: "SwapOff", hat: "hat-1", ... });
  assertEquals(swaps.length, 2);
  // No UPDATE — only new events
});
```

### 6.4 Reputation accrual

```typescript
Deno.test("Reputation accrues on the hat", () => {
  const hat: HatDefinition = { id: "hat-1", status: { reputation: 10, currentWearers: [], lifetimeWearers: 1 }, ... };
  const updated = updateHatReputation(hat, 5);
  assertEquals(updated.status?.reputation, 15);
});
```

### 6.5 DST replay of admission

```typescript
Deno.test("Admission evaluation is deterministic", () => {
  const env = createVirtualEnvironment(42n);
  const request = buildAdmissionRequest(env, ...);
  const r1 = evaluateAdmission(request, DEFAULT_HAT_POLICY);
  const env2 = createVirtualEnvironment(42n);
  const request2 = buildAdmissionRequest(env2, ...);
  const r2 = evaluateAdmission(request2, DEFAULT_HAT_POLICY);
  assertEquals(r1, r2);
});
```
