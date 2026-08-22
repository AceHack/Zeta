---
title: Cluster Execution and Memory Substrate
canonical_name: Agentic Organization
status: design
---

# Cluster Execution and Memory Substrate

This document captures the theoretical cluster substrate for the Agentic Organization. It focuses on how Hermes agents run in k3s as isolated session containers, how hats and policies bind to workloads, how credential proxies and Cilium service mesh boundaries protect access, how SPIRE supplies workload identity, and how Hindsight provides persistent memory.

It intentionally avoids deployment YAML details.

## Core Idea

The Organization runs on the cluster.

```text
Organization Work OS
  -> approves work, hats, tools, memory scope, credential scope
  -> Oz/Warp launches Hermes session
  -> OpenZiti supplies private transport/connectivity where required
  -> k3s schedules Docker session container
  -> sandbox boundary constrains execution
  -> Cilium enforces CNI, L7 policy, Gateway API, ingress, Hubble telemetry
  -> SPIRE provides workload identity
  -> cert-manager / Vault / Trust Manager / External Secrets provide TLS, secrets, trust bundles, and secret sync
  -> Credential Proxy mediates protected access
  -> Hindsight provides persistent Hermes memory
  -> NATS carries events, inboxes, reports, and status
  -> TypeScript workers consume Hat CRDs and HatSwap ticks as typed runtime signals
  -> Organization records state, signals, audit, and evidence
```

The app-level Organization is the business brain. The cluster is the execution and enforcement body.

## Session Container Model

Each Hermes work session should run in a Docker container scheduled by k3s.

The container should have:

- Hermes runtime;
- active Organization assignment context;
- hat token and refresh path;
- MCP Gateway endpoint;
- Hindsight memory endpoint;
- Credential Proxy endpoint;
- NATS endpoint for inbox/status events;
- work item/run identifiers;
- trace/correlation identifiers;
- sandbox policy;
- service account and mesh identity.

The simplest starting point is one primary Hermes agent per container. Multi-agent containers can come later only if isolation, attribution, memory scope, and tool authorization remain clear.

## Bubblewrapped Sandbox Boundary

The Hermes process inside the container should run inside a second sandbox boundary.

The purpose of bubblewrap-style isolation is to constrain what the agent process can touch even inside its container.

Sandbox expectations:

- scoped filesystem view;
- explicit workspace mount;
- no uncontrolled host access;
- no raw broad secrets;
- controlled process execution;
- controlled network egress;
- clear artifact export path;
- clear log and trace capture path;
- kill/revoke path when hat assignment expires or is revoked.

The sandbox does not replace Kubernetes, Cilium, SPIRE, OPA, or the Credential Proxy. It adds process-level defense-in-depth for agent sessions.

## Credential Proxy Boundary

Hermes agents should not receive raw broad credentials.

The Credential Proxy should:

- expose scoped tool/API endpoints;
- validate active hat assignment;
- validate Organization policy;
- validate mesh workload identity where possible;
- record credential use;
- deny access when hat token expires;
- deny access when scope does not match work item/project/team;
- emit audit events and denial signals;
- support Security-reviewed endpoint expansion.

Credential proxy access should be tied to:

- agent ID;
- session ID;
- hat assignment ID;
- work item ID;
- project/initiative scope;
- credential scope;
- service account/workload identity;
- trace ID.

## Hindsight Memory Substrate

Hindsight is the persistent memory substrate for Hermes.

From the provided cluster context:

- Hindsight is `vectorize-io/hindsight`;
- the Helm chart is published as an OCI chart at `ghcr.io/vectorize-io/charts/hindsight`;
- target chart version is `0.3.0`;
- Hermes has a Hindsight integration;
- Hermes can use Hindsight as an external memory provider;
- Hindsight automatically recalls relevant context before LLM calls;
- Hindsight retains conversations;
- Hindsight exposes explicit retain, recall, and reflect tools;
- Hermes should point at the in-cluster Hindsight service through `HINDSIGHT_URL=http://hindsight-api.hindsight.svc.cluster.local`.

The design implication: we should treat Hindsight as real runtime infrastructure, not a placeholder memory adapter.

## Memory Persistence Rules

Memory is precious state.

Rules:

- do not prune memory store by default;
- use persistent storage;
- treat memory deletion or migration as a reviewed operation;
- back memory with a reliable database;
- start with bundled Postgres if needed;
- plan migration to external CockroachDB once healthy and supported by the Hindsight deployment shape;
- keep API keys in Vault-backed secrets, not Git;
- record memory reads and writes in Organization audit;
- attribute memory writes by active hat assignment;
- enforce scoped recall through Organization memory policy.

The initial chart context uses bundled Postgres with persistent storage. That is acceptable for Hindsight bootstrap, but the Organization-owned source of truth is CockroachDB, and long-term memory storage should move to external CockroachDB if Hindsight supports that deployment path.

## Hindsight and Hat-Scoped Memory

Hermes may recall context automatically before every LLM call, but the Organization still needs memory governance.

The memory adapter should enforce:

- active hat scope;
- project scope;
- initiative/work item scope;
- team scope;
- meeting scope;
- credential/security sensitivity;
- memory visibility policy;
- sticky attribution after hat release;
- audit of retain/recall/reflect operations.

Recommended flow:

```text
Hermes prepares LLM call
  -> Hindsight integration requests relevant memory
  -> Organization memory adapter injects active context and policy scope
  -> Hindsight returns scoped recall
  -> Hermes reasons with recalled context
  -> retain/reflect writes are attributed to agent + hat assignment + work scope
  -> Organization records memory event and signal
```

If native Hindsight integration cannot enforce this metadata and policy boundary directly, wrap it. Fork only if the wrapper cannot guarantee scoped recall and attribution.

## Cluster Security and Service Mesh

Cilium Service Mesh is the service mesh and Gateway layer.

Cilium should provide:

- CNI;
- L7-aware policy;
- Envoy-backed L7 proxy support managed through Cilium;
- service-to-service authorization;
- traffic routing;
- traffic shifting;
- Gateway API;
- ingress;
- egress policy;
- BPF masquerade support;
- Hubble telemetry;
- node-to-node encryption, such as WireGuard when enabled;
- access boundary around Credential Proxy, MCP Gateway, Hindsight, and NATS.

The cluster direction is sidecarless for service mesh behavior. Cilium provides L7-aware policy, mTLS-capable service mesh behavior, traffic shifting, Gateway API, and ingress natively through the CNI layer rather than injecting an Envoy sidecar into every Hermes pod.

SPIRE should provide workload identity. Trust Manager should distribute CA bundles. cert-manager should manage TLS certificates. Vault should act as the secrets backend. External Secrets Operator should sync approved Vault secrets into Kubernetes Secrets.

This lets the cluster inject dependencies around Hermes containers without handing agents uncontrolled network access.

The Organization should be able to say:

```text
this session may talk to:
  - MCP Gateway
  - Hindsight
  - NATS
  - Credential Proxy endpoint X
  - repo/project service Y
and nothing else unless policy changes
```

## Secrets and External Configuration

Secrets should be externalized.

Rules:

- no plaintext API keys in Git;
- use Vault-backed ExternalSecret or equivalent;
- LLM provider secrets for Hindsight should be secret references;
- Credential Proxy secrets should stay behind proxy services;
- Hermes session containers should receive references and scoped endpoints, not broad credentials;
- secret access should be auditable by hat assignment and workload identity.

The Hindsight cluster context uses a provider configuration like Groq with an existing secret reference. The specific provider can change, but the pattern should remain.

## Bootstrap Dependency Order

The k3s bootstrap order matters because each layer enables the next.

The theoretical dependency sequence is:

1. Cilium: CNI, Hubble, Service Mesh, BPF masquerade, Gateway API, ingress, and encryption.
2. cert-manager: TLS issuance for Vault and later services.
3. Vault: secrets backend.
4. SPIRE: workload identity, with Vault upstream authority once Vault is healthy.
5. Trust Manager: CA bundle distribution from SPIRE/Vault trust roots.
6. External Secrets Operator: Vault-to-Kubernetes Secret synchronization.
7. ArgoCD: reconciles everything else after the platform security substrate is ready.

The Organization does not need to own these manifests directly, but its runtime assumptions should follow this order.

## Runtime Identity and Hat Binding

Cluster execution must line up with hat assignment.

Each session should be able to prove:

- Kubernetes namespace;
- pod;
- container;
- service account;
- mesh identity;
- Oz run ID;
- Organization session ID;
- agent ID;
- active hat assignment ID;
- work item ID;
- project/initiative scope;
- token status.

The MCP Gateway, Credential Proxy, Hindsight adapter, and NATS consumers should not trust only self-reported agent context. They should resolve runtime context through Organization state, actor/session state, and cluster identity.

## Events and Observability

Every runtime transition should be observable.

Required event streams:

- Oz run requested/started/completed/failed/cancelled;
- pod scheduled/ready/not ready/terminated;
- sandbox started/stopped/denied;
- hat binding activated/refreshed/revoked/released;
- MCP tool call allowed/denied;
- credential proxy request allowed/denied;
- Hindsight recall/retain/reflect events;
- NATS publish/consume/dead-letter;
- artifact produced;
- log/trace/screenshot linked to work item.

These should roll up into:

- Organization signal feed;
- audit events;
- UI evidence timeline;
- Loki logs;
- metrics/SLOs;
- NATS streams;
- incident reports when needed.

## Cluster-Native Hat Integration

The cluster-native hat system should connect here.

`HatBinding` should map active Organization hat assignments to cluster-visible runtime state. OPA policies should validate:

- correct hat for workload;
- allowed service account;
- allowed namespace;
- allowed Credential Proxy scope;
- allowed memory scope;
- no conflicting hat binding;
- TTL/warmup/cooldown;
- supervisor/quorum rules where relevant.

The Organization still decides who should wear a hat. The cluster enforces that the workload actually behaves like the approved hat.

## NATS and Status Flow

NATS should carry:

- session status;
- task status;
- inbox messages;
- reports;
- HatSwap events;
- memory events;
- credential denial events;
- runtime health events;
- UI live update events.

NATS is not the source of truth. It is the event transport and live update layer. Organization DB and audit events remain authoritative.

TypeScript consumers should treat hat CRDs as a typed external control-plane API. Organization workers can watch `HatBinding` status and `HatSwap` records with `@kubernetes/client-node`, correlate them with NATS events, and update CockroachDB projections. They should not infer business approval from Kubernetes state alone; Kubernetes proves runtime enforcement, while Organization state proves why the assignment exists.

`HatSwap` as a CRD is the replayable transition record. `HatSwap` over NATS is the wake-up path. Both projections need a stable durable identity and correlation fields so the Organization can dedupe and avoid counting one lifecycle transition twice.

## Failure Modes

The substrate should detect and route:

- Hermes session silent;
- pod scheduled but no session heartbeat;
- Oz run started but no Organization binding;
- Hindsight unavailable or slow;
- memory database storage pressure;
- Credential Proxy denied unexpectedly;
- Credential Proxy allowed unexpectedly;
- hat token expired but process still running;
- sandbox violation;
- NATS stream lag or dead letter;
- Cilium policy or Gateway API mismatch;
- SPIRE workload identity mismatch;
- Trust Manager CA bundle mismatch;
- secret missing or stale;
- memory write without hat attribution.

Each failure should create an Organization signal and route to the appropriate hat-owned routine: Platform Operator, SRE, Memory Manager, Security Reviewer, TPM, Engineering Manager, or Director.

## MVP Contract

The first cluster-backed MVP should prove:

- Organization creates work and hat assignment;
- Oz launches a Hermes session container;
- session has scoped MCP, Hindsight, NATS, and Credential Proxy endpoints;
- memory recall works through Hindsight;
- memory write is attributed to agent, hat, project, and work item;
- credential access is denied without approved scope;
- session logs, traces, and artifacts link back to the work item;
- hat expiry or revocation removes tool and credential authority;
- runtime status appears in the UI.

## Open Decisions

- Do we start with bubblewrap inside each session container, or model the contract first and add it after baseline container execution?
- Is Hindsight accessed directly by Hermes, through an Organization memory adapter, or via a sidecar/proxy that injects scope?
- What is the first storage backend for Hindsight in local cluster bootstrap?
- When do we swap Hindsight from bundled Postgres to external CockroachDB?
- Which services require Cilium L7 policy from day one?
- When should Cilium mutual authentication through SPIRE be flipped on?
- Does HatBinding CRD enforcement ship before or after v0 Organization assignment?
- How do we handle multi-agent containers without mixing memory and authority attribution?
- Which runtime events are mandatory before a session can be considered production-safe?
