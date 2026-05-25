# V0 Executable Contract

## Purpose

This document narrows the Agentic Organization reference design into
the first executable slice. It is intentionally smaller than the full
Organization. The goal is to prove that one governed agent work loop can
run on the `full-ai-cluster` substrate with durable state, hat-scoped
authority, evidence, and review.

V0 should be boring enough to ship and rich enough to teach the rest of
the system what to build next.

## Cluster Assumption

Agentic Organization is a workload that runs on `full-ai-cluster`. It is
not a parallel substrate.

The current `origin/main` cluster shape gives V0 these host primitives:

| Cluster component                                           | V0 use                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| K3S + ArgoCD App-of-Apps                                    | deploy Agentic Organization as a future `full-ai-cluster/k8s/applications/agentic-organization/` application |
| Cilium + Hubble                                             | pod networking, L7 policy, flow observability, and service-mesh behavior without Istio                       |
| cert-manager, Vault, SPIRE, Trust Manager, External Secrets | workload identity, TLS trust, and secret delivery                                                            |
| CockroachDB                                                 | first durable SQL adapter for the authoritative Organization database boundary                               |
| NATS JetStream                                              | event transport, outbox fanout, live UI updates, and replayable integration streams                          |
| Temporal TS                                                 | durable workflows after the native command model is proven                                                   |
| Dapr Actors                                                 | hot entity coordination after the DB-backed service contract is proven                                       |
| Hindsight                                                   | Hermes memory backend, wrapped with Organization attribution and scope                                       |
| Hermes                                                      | agent runtime that performs the work                                                                         |
| OZ/OpenZiti                                                 | zero-trust transport, not the Organization business orchestrator                                             |
| hat-system                                                  | Kubernetes hat enforcement/projection surface using Hat, HatBinding, HatSwap, and HatPolicy CRDs             |
| Loki, Tempo, Alloy, Mimir, kube-prometheus-stack            | logs, traces, metrics, dashboards, and audit correlation                                                     |

Sync-wave implication: Agentic Organization is a consumer app. It should
land after the foundation, data planes, hat-system CRDs, Hindsight,
Temporal, and Hermes are available. A future ArgoCD application should
therefore use a late consumer wave, likely wave `20` or later, unless a
split bootstrap app is created for CRDs only.

## Non-Goals

V0 does not need:

- the full executive, director, TPM, manager, QA, security, and memory
  department lattice;
- every hat in the inventory;
- a full Hindsight fork;
- a full Temporal workflow catalog;
- a Dapr actor for every entity;
- live CRD writeback from day one;
- complete performance review and budget systems;
- autonomous creation of new tools, workflows, or credential proxy
  endpoints.

V0 should still model those future paths as supervisor-chain signals and
capability requests, so the Organization can later route them through
its own lifecycle.

## First Vertical Slice

The first executable slice is:

```text
supervisor-chain signal or capability request
  -> anchored work item, discussion anchor, and context pack
  -> one readiness or review gate
  -> hat assignment
  -> scheduled prompt-flow run
  -> Hermes run through the Organization runtime adapter
  -> evidence submission
  -> reviewer decision
  -> outcome review
```

This is the smallest useful loop because it proves:

- work has a durable source of truth;
- every discussion is tied to a work item;
- a hat can be assigned, tokenized, and revoked;
- a Hermes agent can work inside an Organization-scoped context;
- the system can capture actions, observations, artifacts, and memory
  events;
- a reviewer can approve or reject without self-approval;
- a completed run can create follow-up work when gaps are found.

## Required V0 Hats

Keep the first hat set small:

| Hat                 | V0 reason                                                                           |
| ------------------- | ----------------------------------------------------------------------------------- |
| Director            | accepts or rejects escalated supervisor signals or capability requests for V0 scope |
| Engineering Manager | grooms the work item, selects schedule, assigns implementer and reviewer hats       |
| Implementer         | executes the prompt flow and submits evidence                                       |
| Code Reviewer       | reviews the evidence and blocks self-approval                                       |
| Memory Curator      | reviews memory writes or flags memory gaps when the run ends                        |
| Platform Operator   | handles runtime failure, pod/session issues, and integration health                 |
| Security Reviewer   | required only when the request needs a new credential or external tool scope        |

The Executive Board, TPM, Product Owner, Architect, QA Reviewer, Hat
Designer, and department directors remain first-class in the reference
model, but V0 can simulate or defer them unless the first example
requires their gate.

## Required V0 Work Objects

V0 must persist these objects:

- agent;
- department;
- hat definition;
- hat assignment;
- hat token;
- project;
- initiative;
- work item;
- discussion anchor;
- context pack;
- schedule block;
- prompt-flow definition;
- prompt-flow run;
- prompt-flow phase run;
- universal action record;
- action observation;
- Hermes run binding;
- artifact;
- memory event;
- gate;
- gate decision;
- audit event;
- outbox event.

Anything else should be added only when a V0 command cannot be expressed
without it.

## Required V0 Flow

1. `send_supervisor_signal` creates the chain communication record and
   first audit/outbox events against an anchored work item and
   discussion anchor. Capability request inputs enter through the same
   V0 command path.
2. `triage_supervisor_signal` selects the responsible project,
   initiative, owner hat, lifecycle, and required gate.
3. `create_context_pack` links relevant docs, prior decisions, task
   graph nodes, memory references, and acceptance criteria.
4. `decide_gate` moves the request into ready state or asks for more
   information.
5. `reserve_hat` creates a hat assignment and maps it to the hat-system
   projection boundary.
6. `issue_hat_token` creates the time-bounded runtime authority for the
   selected Hermes agent/session.
7. `start_schedule_block` enters prioritized work time for the active
   hat.
8. `start_prompt_flow` locks the agent into the selected deterministic
   work protocol.
9. `launch_hermes_run` binds the Organization work item, agent, session,
   hat assignment, and prompt-flow run to the Hermes/OZ runtime adapter.
10. `record_universal_action` and `record_action_observation` capture
    what the agent did and what the system observed.
11. `submit_evidence` attaches logs, screenshots, code refs, traces, or
    documents to the work item.
12. `request_gate_review` moves the work to reviewer attention.
13. `decide_gate` approves, rejects, or requests changes.
14. `complete_outcome_review` records what was learned and creates
    follow-up work if the run exposed a capability, memory, test, or
    process gap.

## Runtime Mode

V0 can start with a native NestJS modular monolith and in-process fakes
for Temporal, Dapr, and Hermes/OZ adapters, but the contracts must match
the cluster runtime.

The first deployable shape should be:

```text
apps/api
  Organization commands, reads, auth, policy, MCP gateway

apps/web
  work board, role workspace, review center, evidence timeline

apps/workers
  outbox publisher, schedulers, reconcilers, NATS consumers

packages/*
  domain, state, policy, work-os, hats, prompt-flows, mcp, memory,
  observability, k8s-hats, hermes adapter
```

Temporal and Dapr can be introduced once the same commands work through
the native service layer:

```text
Temporal workflow or Dapr actor
  -> Organization command service
  -> durable state transaction through the state adapter
  -> outbox event
  -> NATS publish
  -> trace, log, metric
```

## Hat-System Boundary

The Organization DB owns business intent. The cluster hat-system owns
runtime enforcement/projection.

For V0:

- read hat-system CRDs through typed TypeScript clients;
- decode HatSwap records and NATS hat ticks into Organization signals;
- map Organization hat assignments to the CRD vocabulary;
- do not require bidirectional CRD writes before the DB state machine is
  stable.

Later:

- Organization-approved assignments can create HatBinding proposals;
- HatSwap can become the runtime confirmation record;
- Hubble, Loki, and HatSwap can be joined by SPIFFE ID for per-hat
  runtime attribution.

## Definition of Done

V0 is done when a human or agent can submit one internal capability
request and watch it move through:

```text
request -> ready gate -> hat assignment -> prompt-flow run
  -> Hermes work -> evidence -> review decision -> outcome review
```

The demo must show:

- durable state for the work item and assignment, backed by CockroachDB
  in the first cluster adapter;
- NATS/outbox events for every transition;
- a discussion anchor tied to the work item;
- a hat token with expiry;
- a Hermes run binding, even if the runtime adapter is still simulated;
- evidence attached to the work item;
- review denial of self-approval;
- trace IDs and audit events across the whole run;
- a UI read model that shows status without reading raw logs.
