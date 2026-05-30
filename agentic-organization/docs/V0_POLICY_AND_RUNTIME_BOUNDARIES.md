---
title: V0 Policy and Runtime Boundaries
canonical_name: Agentic Organization
status: design
---

# V0 Policy and Runtime Boundaries

## Purpose

This document defines the first boundary rules for Agentic Organization:
what each runtime owns, which hats can perform which V0 actions, and how
MCP tools execute with agent, hat, task, and cluster context.

The main rule is simple: infrastructure can execute, schedule, transport,
or project state, but Organization command services own business
decisions.

## Source-of-Truth Boundary

| Surface                                        | Owns                                                              | Does not own                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Organization DB on CockroachDB                 | business state, work lifecycle, assignments, gates, audit, outbox | LLM reasoning, Kubernetes admission, workflow history              |
| NestJS API                                     | command handlers, reads, policy checks, MCP gateway, adapters     | durable workflow history, actor placement, raw cluster ownership   |
| Temporal TS                                    | durable timers, retries, waits, workflow history                  | direct DB mutation, direct LLM calls, final business authority     |
| Dapr Actors                                    | hot per-entity coordination, serialized local state, reminders    | global truth, broad policy, long-running cross-entity process      |
| NATS JetStream                                 | event transport, replay, fanout, inboxes                          | authoritative state                                                |
| Hermes                                         | reasoning and tool-using work                                     | granting itself authority, bypassing gates                         |
| OZ/OpenZiti                                    | zero-trust transport paths                                        | Organization run orchestration semantics                           |
| Hindsight                                      | memory recall, retain, reflect                                    | Organization work graph, hat assignment authority                  |
| hat-system CRDs                                | cluster hat enforcement and runtime projection                    | Organization business intent until writeback is explicitly enabled |
| Cilium, SPIRE, Vault, ESO                      | network policy, identity, trust, secret delivery                  | Organization lifecycle or review decisions                         |
| Loki, Tempo, Alloy, Mimir, Prometheus, Grafana | observability storage and dashboards                              | business truth                                                     |

Every adapter should call Organization commands. No adapter should update
authoritative tables directly.

## V0 Policy Matrix

| Hat                 | Can do in V0                                                                                     | Cannot do in V0                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Director            | accept capability request, route to project/initiative, assign manager                           | approve own implementation work                                         |
| Engineering Manager | groom work, mark ready, assign implementer/reviewer, set schedule block, request outcome review  | bypass reviewer gate, create new credential scope alone                 |
| Implementer         | run assigned prompt flow, call allowed MCP tools, submit evidence, request review                | approve own work, change hat supply, create unanchored discussions      |
| Code Reviewer       | approve, reject, or request changes on assigned review gate                                      | review work they implemented under the same assignment                  |
| Memory Curator      | review memory events, request memory cleanup/follow-up work, approve memory adaptation           | grant tool or credential scope                                          |
| Platform Operator   | reconcile failed runs, inspect runtime health, restart or cancel runtime sessions through policy | change product acceptance criteria                                      |
| Security Reviewer   | approve or reject credential/tool expansion, require narrower scopes                             | implement the requested capability and approve its security scope alone |

Human operators may hold these hats too. The policy model should treat a
human and a Hermes agent the same at the command boundary: both need an
actor identity, active authority, scope, and audit trail.

## Required Policy Invariants

V0 must enforce:

- no self-approval for implementation review;
- every discussion, meeting, message thread, and broadcast has a work
  anchor;
- every MCP tool call has an active agent session;
- every privileged MCP tool call has an active hat token;
- every hat token has an expiry and refresh path;
- expired or revoked hats lose credential and tool authority;
- every Organization command is authorized against active hat authority
  before idempotency lookup, handler dispatch, or state persistence;
- every work transition uses a command, not a direct field update;
- every command writes audit and outbox records in the same transaction;
- every memory event is attributed to agent, hat assignment, work item,
  project, and prompt-flow context when available;
- every credential expansion request goes through security review;
- every runtime callback is idempotent;
- every denial returns a structured reason agents can learn from;
- every denied command is observed through a policy decision observation
  port without creating successful business state;
- durable policy decision observation storage and UI/agent projection are
  available before real API, MCP, Hermes, Temporal, or Dapr entrypoints
  are exposed.

## MCP Preflight

The MCP Gateway is stateless at the edge but policy-rich at execution.
Its preflight checks should feed the same generic
`CommandAuthorizationPort` used by API, worker, Temporal, Dapr, and
Hermes paths. No entrypoint gets a special bypass.

Flow:

```text
Hermes
  -> Organization MCP Gateway
      -> validate JWT and session
      -> load AgentSessionActor or DB-backed session context
      -> load work item, schedule block, prompt-flow run, and hat assignment
      -> validate policy
      -> execute command/tool handler
      -> write audit, observation, outbox, trace
      -> update session activity
```

Minimum preflight checks:

| Check                                 | Purpose                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `validate_actor_context`              | confirms agent/session identity                                               |
| `validate_hat_token`                  | confirms active, unexpired, unrevoked hat authority                           |
| `validate_scope`                      | confirms project, initiative, work item, memory, and credential scope         |
| `validate_discussion_anchor`          | blocks unanchored discussion                                                  |
| `validate_schedule_block`             | confirms the agent is in an allowed work mode                                 |
| `validate_prompt_flow_start`          | confirms the hat can run the selected flow                                    |
| `validate_prompt_flow_phase_gate`     | enforces phase review gates                                                   |
| `validate_universal_action`           | validates the action grammar and allowed side effects                         |
| `validate_action_reversibility`       | flags actions that need approval or rollback plan                             |
| `validate_required_docs_acknowledged` | confirms BRD, CA, ADR, test plan, or runbook context was loaded when required |
| `validate_no_blocking_contradictions` | blocks work when the context graph has unresolved critical contradictions     |
| `validate_lifecycle_transition`       | confirms legal state movement                                                 |

Request-provided IDs are hints. The gateway must verify authority from
the Organization DB, session context, and policy engine.

## Runtime Failure Rules

V0 should treat distributed failure as normal.

| Failure                           | Required behavior                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| Duplicate command                 | return the idempotent prior result or reject hash conflict                                    |
| Duplicate Hermes callback         | update only once, attach duplicate observation if useful                                      |
| NATS publish failure              | keep outbox row pending and retry                                                             |
| NATS consumer replay              | process idempotently from event ID and aggregate version                                      |
| Temporal activity retry           | call Organization command with the same idempotency key                                       |
| Dapr reminder duplicate           | call Organization command with the same idempotency key                                       |
| Hindsight unavailable             | continue only if memory is optional for that phase; otherwise block with a recoverable signal |
| Hat token expires during run      | stop privileged tools, request refresh, and record schedule interruption                      |
| Hat assignment revoked during run | cancel or quarantine the Hermes run and revoke credentials                                    |
| Credential denied                 | create a blocked state or lower-scope alternate-work item                                     |
| Pod or session silent             | mark heartbeat late, notify Platform Operator, reconcile or cancel                            |
| Reviewer unavailable              | escalate to manager after SLO, but do not auto-approve                                        |
| Hat-system projection lag         | keep Organization state, mark projection stale, do not assume enforcement                     |

## Cluster-Native Runtime Contract

Agentic Organization should eventually deploy as:

```text
full-ai-cluster/k8s/applications/agentic-organization/
  Application.yaml
  namespace.yaml
  api deployment/service
  web deployment/service
  worker deployment
  temporal-worker deployment
  dapr-actor deployment
  mcp-gateway deployment/service
  ExternalSecret refs
  CiliumNetworkPolicy
  ServiceAccount/RBAC
```

The TypeScript worker host now has the first durable composition seam
that maps this cluster contract into package ports:

```text
ExternalSecret / Secret
  -> COCKROACH_DATABASE_URL + worker/NATS batch env
  -> apps/workers config parser
  -> process-provided Cockroach client
  -> state-cockroach generic SQL executor
  -> Cockroach durable adapter factory
  -> worker outbox + event-ingestion ports
  -> Organization worker host
```

The concrete Cockroach client and pool are still process concerns. The
application, runtime, policy, messaging, and worker packages see only
generic Organization ports.

The first docs-only and app-code PRs do not need deployment YAML. When
deployment is added, it should follow the existing App-of-Apps model:

- `targetRevision: main`;
- `path: full-ai-cluster/k8s/applications/agentic-organization`;
- `CreateNamespace=true`;
- `ServerSideApply=true`;
- sync wave after data planes and dependent runtimes;
- no plaintext secrets in Git;
- Cilium policy for egress to only required services;
- SPIFFE/SPIRE identity for service accounts when enabled;
- External Secrets from Vault for DB, NATS, Temporal, Hindsight, and
  provider credentials;
- OpenTelemetry export to the existing observability stack.

## Dependency Order

Agentic Organization runtime depends on the current cluster order:

```text
Cilium
  -> cert-manager
  -> Vault
  -> SPIRE
  -> Trust Manager
  -> External Secrets
  -> ArgoCD
  -> OPA Gatekeeper
  -> Longhorn
  -> hat-system CRDs
  -> CockroachDB, NATS, Dapr, OZ/OpenZiti, observability
  -> Hindsight, Temporal, Hermes
  -> Agentic Organization
```

If Agentic Organization later ships CRDs of its own, split them into an
earlier app. Do not make the main application block the cluster
foundation.

## TypeScript First-Class Consumption

TypeScript should be a first-class consumer of the cluster contracts.

Required packages:

| Package                      | Responsibility                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `@agentic-org/k8s-hats`      | generated or checked Hat, HatBinding, HatSwap, and HatPolicy types, informers, NATS tick decoding |
| `@agentic-org/state`         | Drizzle schema, repositories, outbox, idempotency                                                 |
| `@agentic-org/policy`        | command authorization port, hat-authority port, typed policy engine, and later OPA bundle adapter |
| `@agentic-org/mcp`           | MCP gateway contracts, preflight checks, tool registry                                            |
| `@agentic-org/hermes`        | Hermes run/session adapter and callback contract                                                  |
| `@agentic-org/memory`        | Hindsight attribution and scoped recall/retain/reflect                                            |
| `@agentic-org/observability` | OpenTelemetry span helpers and correlation envelope                                               |

The TypeScript CRD package should be mechanically checked against the
CRD YAML from `full-ai-cluster/k8s/applications/hat-system/crds/`.

## What Not to Blur

Keep these boundaries explicit:

- OZ/OpenZiti is transport. If a future component orchestrates runs,
  name it separately from OpenZiti.
- Hindsight is memory. Organization graph retrieval is work context,
  decisions, documents, discussions, and evidence.
- Temporal coordinates durable workflows. It does not decide policy.
- Dapr Actors serialize hot entity state. They do not own global truth.
- hat-system CRDs enforce/project runtime hats. Organization DB owns the
  assignment request and business reason.
- Cilium/SPIRE/Vault secure the cluster. They do not replace hat RBAC.

## V0 Review Checklist

Before coding any endpoint, worker, or MCP tool, confirm:

- which command owns the state transition;
- which hat can call it;
- which policy checks run;
- which state rows change;
- which audit and outbox events are emitted;
- which graph nodes or edges are created;
- which trace fields are attached;
- how duplicate calls behave;
- how denial is explained to the agent;
- how the UI can display the result without scraping logs.
