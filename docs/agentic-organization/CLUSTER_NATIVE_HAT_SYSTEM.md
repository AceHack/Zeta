# Cluster-Native Hat System

This document captures the theoretical design for a Kubernetes-native hat system. It focuses on CRDs, OPA policies, graph enforcement, time-bounded hat bindings, succession, reputation, events, and observability. It intentionally avoids deployment YAML details.

The goal is not to replace the Organization Work OS. The goal is to give hats a cluster-native control-plane representation so runtime workloads, policies, and observability can reason about roles consistently across distributed Hermes sessions.

## Core Idea

Hats are persistent roles. Agents wear hats temporarily.

```text
Hat persists
  -> wearer binds for a scoped duration
  -> wearer acts under hat authority
  -> binding expires, cools down, or is returned
  -> next wearer may inherit the hat context
  -> reputation accumulates on the hat and the agent-hat pairing
```

This matters because a hat is not just a person or agent label. It is:

- skills;
- OPA/RBAC authority;
- tool access;
- credential scope;
- memory scope;
- supervisor graph position;
- quorum/voting scope;
- cooldown and warmup rules;
- succession rules;
- reputation and performance history.

The chosen-and-returnable hat model prevents roles from becoming cages. Agents can rotate through hats while the Organization preserves continuity of the role.

## Relationship to the Organization DB

The Organization DB remains the business source of truth.

The cluster-native hat system is an enforcement and runtime projection layer.

| Concern | Source of truth |
|---|---|
| Project, initiative, work item, gate, release, and business state | Organization DB |
| Hat definition, authority, hierarchy, and lifecycle policy | Organization DB, projected to CRDs |
| Active runtime hat binding for Kubernetes workloads | HatBinding CRD/status and Organization DB assignment |
| Policy evaluation | OPA/RBAC plus Organization policy service |
| Runtime events and observability | CRD status, Kubernetes Events, Loki, NATS, traces |
| Reputation and performance rollup | Organization DB, with operator status projection |

The CRDs should not become a second business database. They should mirror and enforce the runtime-relevant parts of hats.

## CRD Concepts

### Hat

`Hat` represents the persistent role.

Important fields:

```ts
type HatSpec = {
  displayName: string;
  departmentId: string;
  skills: string[];
  authority: {
    rbacRoles: string[];
    opaPolicies: string[];
    mcpToolBundles: string[];
    credentialScopes: string[];
    memoryScopes: string[];
    approvalScopes: string[];
    votingScopes: string[];
  };
  supervises: string[];
  conflictsWith: string[];
  quorum?: {
    requiredFor: string[];
    quorumSize: number;
  };
  lifecycle: {
    maxWearers: number;
    tokenTtlSeconds: number;
    warmupSeconds: number;
    cooldownSeconds: number;
    stickyAttribution: boolean;
    successionPolicy: "rotate" | "renew" | "election" | "director_assigned" | "executive_vote";
  };
};
```

Important status:

```ts
type HatStatus = {
  activeWearers: string[];
  coolingDownWearers: string[];
  reputationScore: number;
  recentSwapId?: string;
  policyReady: boolean;
  graphReady: boolean;
  observedGeneration: number;
};
```

### HatBinding

`HatBinding` represents an agent wearing a hat for a specific scope and time.

Important fields:

```ts
type HatBindingSpec = {
  hatRef: string;
  wearerRef: string;
  assignmentRef: string;
  scope: {
    projectId?: string;
    initiativeId?: string;
    workItemId?: string;
    teamId?: string;
    ozRunId?: string;
    namespace?: string;
    serviceAccount?: string;
  };
  requestedBy: string;
  expiresAt: string;
  reason: string;
};
```

Important status:

```ts
type HatBindingStatus = {
  phase: "Pending" | "WarmingUp" | "Active" | "CoolingDown" | "Released" | "Expired" | "Revoked" | "Denied";
  tokenIssuedAt?: string;
  tokenExpiresAt?: string;
  lastRefreshAt?: string;
  lastActivityAt?: string;
  swapId?: string;
  denialReason?: string;
};
```

### HatPolicy

`HatPolicy` captures global or scoped rules for assignment, succession, quorum, throttling, and graph constraints.

Policy examples:

- no supervisor cycles;
- hat designer quorum required;
- sensitive hats require two-person approval;
- executor hats conflict with hat designer hats;
- cooldown before same wearer can retake high-power hat;
- max concurrent wearers by department/project;
- warmup required before approval power activates;
- sticky attribution for memory and reputation.

### HatSwap

`HatSwap` is the durable event produced for every binding transition.

Every state transition should emit exactly one `HatSwap` record.

Important fields:

```ts
type HatSwapSpec = {
  hatRef: string;
  previousWearerRef?: string;
  nextWearerRef?: string;
  bindingRef: string;
  transition: "bind" | "activate" | "refresh" | "cooldown" | "release" | "expire" | "revoke" | "deny";
  reason: string;
  organizationCorrelationId: string;
  traceId: string;
};
```

This should also produce:

- Kubernetes Event;
- structured log;
- Loki-visible event;
- NATS publish;
- Organization signal/outbox event.

## OPA Policy Model

OPA should enforce graph and authority constraints near the cluster control plane.

Initial OPA constraints:

- no supervisor cycles in `spec.supervises`;
- `conflictsWith` hats cannot be held by the same wearer in overlapping scopes;
- high-power hats require quorum or approved issuer;
- hat designer cannot self-approve unrestricted hat creation;
- cooldown must pass before the same wearer retakes a constrained hat;
- warmup must complete before approval/voting authority activates;
- max wearers cannot be exceeded;
- scope must match the requesting work item/team/namespace/service account;
- credential-bearing hats require approved credential policy;
- expired bindings cannot authorize runtime access.

OPA should block invalid cluster state. The Organization policy service should still explain business denials and enforce application-level transitions.

## Supervisor Graph

The supervisor graph is first-class.

`spec.supervises` forms a directed acyclic graph:

```text
Executive Board
  -> CEO / CTO / COO
      -> Department Directors
          -> TPMs / Engineering Managers / QA Managers
              -> Team Leads / Reviewers / Implementers
```

The graph is not just visualization. It controls:

- who can assign which hats;
- who can escalate to whom;
- who can open which meetings;
- who can review which outcomes;
- which votes are in scope;
- which memory and performance rollups are visible.

The live graph should be renderable as Graphviz DOT so policy authors can reason in hat-graph language.

Graph rendering should support:

- all hats;
- active bindings;
- supervisor edges;
- conflicts;
- quorum-gated hats;
- bottleneck hats;
- cooling-down hats;
- stale or denied bindings.

## Time-Bounded Hat Binding

Every binding has time semantics.

| Concept | Purpose |
|---|---|
| TTL | Forces periodic authorization refresh |
| Warmup | Prevents immediate high-risk authority before context is loaded |
| Cooldown | Prevents rapid recapture or concentration of authority |
| Sticky attribution | Links memory, reputation, and outputs to the hat binding even after release |
| Succession | Defines how the next wearer is chosen |

This matches the Organization model where agents do not keep role authority forever. Hats can be chosen, returned, rotated, renewed, or reassigned.

## Reputation Model

Reputation should accumulate primarily on:

- the hat;
- the agent-hat pairing;
- the department-hat pairing;
- the project-hat pairing.

Do not treat reputation as only an agent score. The same agent can be strong in one hat and weak in another. The same hat may need better skills, authority, memory, or review gates even if individual agents are competent.

Reputation inputs:

- successful work completion;
- review quality;
- QA bounce-back rate;
- blocker resolution speed;
- policy violations;
- memory quality;
- release outcomes;
- incident outcomes;
- cost/budget efficiency;
- peer or supervisor reviews.

Reputation outputs:

- candidate ranking for future hat assignments;
- cooldown or warmup adjustments;
- hat effectiveness review;
- memory adaptation requests;
- project skill recommendations;
- hat redesign proposals.

## Hat Designer Bootstrap

The `hat-designer` role must not be a single point of failure.

Recommended bootstrap policy:

- `hat-designer` is itself a hat;
- quorum-gated with quorum size 3;
- multiple wearers can hold it;
- conflicts with executor hats for sensitive scopes;
- cooldown applies before the same wearer can retake it;
- new high-power hats require Executive Board approval;
- credential-bearing hats require Security approval;
- runtime/actor/workflow-bearing hats require Architecture approval.

This lets the Organization expand its own hat graph without letting one wearer define all authority.

## Operator Responsibilities

A Kubernetes operator can provide mechanical reconciliation, not organizational judgment.

Operator responsibilities:

- reconcile Hat, HatBinding, HatPolicy, and HatSwap resources;
- validate graph readiness;
- update status;
- emit exactly one durable HatSwap per state transition;
- publish Kubernetes Events;
- write structured logs;
- publish NATS events;
- expose graph rendering;
- surface policy denials;
- roll up status for Organization projections.

The operator should not decide business priority, assign hats because it feels useful, or bypass Organization gates. Those decisions come from Organization services and authorized hats.

## Event Flow

```text
Organization approves hat assignment
  -> Organization writes HatAssignment
  -> Organization projects/updates HatBinding CRD
  -> OPA validates graph, scope, conflicts, quorum, TTL, cooldown
  -> Cilium/SPIRE enforce workload-level access identity and network policy
  -> operator observes HatBinding
  -> status moves Pending/WarmingUp/Active/etc.
  -> exactly one HatSwap emitted per transition
  -> Kubernetes Event + structured log + NATS event + Organization signal
  -> MCP Gateway and Credential Proxy can verify active binding
```

This gives us a structured tick source for hat transitions without turning Kubernetes into the business brain.

## Observability

Hat state should be visible from several directions:

- Organization UI;
- Kubernetes Events;
- Loki queries;
- Hubble/Cilium service flow queries;
- NATS streams;
- graph renderer;
- audit event explorer;
- assignment/reputation dashboards.

Useful queries:

- current wearer of a hat;
- hats in cooldown;
- denied bindings by policy;
- supervisor graph cycles blocked;
- conflicts prevented;
- high-power hats nearing expiry;
- hat swaps per hour;
- stale bindings with no activity;
- reputation change after releases or reviews.

## How This Fits the Work OS

The Work OS should still drive work.

The cluster-native hat system helps by:

- making active hat bindings observable and enforceable at runtime;
- aligning Kubernetes service accounts/workloads with Organization hats;
- giving policy authors a graph-native language;
- producing durable swap events;
- enforcing no-cycle and conflict constraints;
- making cooldown, warmup, and succession visible;
- connecting cluster telemetry to Organization assignments.

The Work OS uses this state for:

- reliable hat assignment;
- scarce hat supply checks;
- stuck assignment reconciliation;
- role-specific UI;
- MCP tool authorization;
- credential proxy access;
- reputation and outcome review.

## Intentional Gaps Before Implementation

The theoretical model is useful before these are implemented:

- validating webhook;
- mutating webhook;
- finalizer flow;
- Hat reconciler reputation rollup;
- HatPolicy reconciler status rollup;
- envtest suite;
- CI image build;
- production deployment manifests.

For now, the important implementation contract is the shape of the hat lifecycle and how Organization state maps to cluster-native enforcement.

## Open Design Questions

- Which hat fields are authored in the Organization DB versus directly in CRDs?
- Should CRDs be generated projections only, or can cluster operators propose CRD changes back to the Organization?
- Which binding phases should block MCP tools?
- How much reputation should appear in CRD status versus Organization UI only?
- Does `HatSwap` live as a CRD, an event stream, or both?
- How should Graphviz rendering map OPA throttles and graph constraints to human-readable policy explanations?
- What is the minimum set of OPA constraints required before the first live cluster run?
