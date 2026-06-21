---
id: 081KSE6WT0008QG0R002275NDE
priority: P1
status: open
title: Simplest-first plugin sequence — wrap already-deployed cluster substrate (Redis / NATS / CockroachDB / Temporal / Orleans / OPA) as Zeta interfaces, one at a time
effort: M
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R00063R6HB
composes_with:
  - 081KRFA460008QG0R0018SN61J
  - 081KSE6WT0008QG0R0009YYNP4
  - 081KSE6WT0008QG0R00049EFBD
  - 081KSE6WT0008QG0R003WMG4XV
  - 081KSE6WT0008QG0R0008483B2
  - 081KSE6WT0008QG0R001AZQA5Z
  - 081KSE6WT0008QG0R000QXSG91
tags: [cluster, plugins, interfaces, sequencing, redis, nats, cockroachdb, temporal, orleans, opa, incremental]
---

## Problem

Aaron 2026-05-25 mid-iter-3-CI-wait, after the 081KSE6WT0008QG0R001AZQA5Z etcd-less +
081KSE6WT0008QG0R000QXSG91 scale-architecture rows: *"okay we already have coackroack
in cluster lets start finding shapes of ontologies and supporing
plugin model and adding one at a time over time starting with
simplest."*

Substrate-honest recalibration: 081KSE6WT0008QG0R000WVYAJ2 + 081KSE6WT0008QG0R003WMG4XV + 081KSE6WT0008QG0R0008483B2 + 081KSE6WT0008QG0R001AZQA5Z +
081KSE6WT0008QG0R000QXSG91 named the ABSTRACT pattern. This row picks the
SIMPLEST concrete starting point — wrap something already
deployed in the cluster with a thin Zeta interface, ship it, learn,
repeat.

The cluster already deploys (per `full-ai-cluster/k8s/applications/`):

| Category | Apps deployed |
|---|---|
| Databases | cockroachdb, redis |
| Streaming / messaging | nats (JetStream) |
| Workflow / actors | temporal, orleans, argo-workflows |
| Policy / identity | open-policy-agent, spire, trust-manager, cert-manager, sealed-secrets |
| Distributed app runtime | dapr |
| Storage | longhorn |
| Observability | loki, mimir, tempo, alloy, kube-prometheus-stack |
| GitOps + delivery | argocd, argo-rollouts, forgejo, gitlab |
| AI inference / serving | vllm, qwen-coder, deepseek-coder |
| Hardware / scheduling | node-feature-discovery (NFD) |
| Zeta-native apps | hat-system, oz, hermes, hindsight |

This is a serious working cluster. Aaron's ask isn't "add more
things" — it's "wrap what's deployed as Zeta interfaces, one at
a time, simplest first."

## Simplest-first plugin sequence (proposed)

Substrate-honest ordering by **interface surface size + backend
availability + operator-visible value**:

| Rank | Interface | Backend (already deployed) | Surface size | Value | Substrate composition |
|---|---|---|---|---|---|
| **1 (simplest)** | **`Zeta.Storage.KeyValue`** | **Redis** | ~4 methods (get/set/delete/scan) | Universal — every app needs KV | Thinnest possible wrapper; operator validates by `kubectl exec` into Redis |
| 2 | `Zeta.Messaging.PubSub` | **NATS JetStream** | ~4 methods (publish/subscribe/unsubscribe/ack) | Universal event-driven app pattern | NATS subjects ARE Observable-shaped natively (081KSE6WT0008QG0R003WMG4XV); composes with Rx Observable + Observer dualities |
| 3 | `Zeta.Storage.Document` | **MongoDB** *(if deployed — not in current list; skip if not)* OR `Zeta.Storage.JSONB` over CockroachDB | ~6 methods (insert/find/update/delete/aggregate/index) | Document-DB workloads | Composes with 081KSE6WT0008QG0R001AZQA5Z CockroachDB-as-document-DB pattern |
| 4 | `Zeta.Storage.SQL` | **CockroachDB** | Larger surface (DDL + DML + transactions); operator already speaks SQL | Foundational; unblocks 081KSE6WT0008QG0R001AZQA5Z CockroachDB-as-kine backend for control plane | Same connection pool serves apps + (eventually) kine etcd-API shim |
| 5 | `Zeta.Workflow` | **Temporal** OR **Argo Workflows** | Workflow surface (start/signal/query/cancel/history) | Long-running orchestration; saga patterns | Composes with 081KSE6WT0008QG0R003WMG4XV fabric (workflow steps as Observable events) |
| 6 | `Zeta.Actors` | **Orleans** | Grain pattern (call/observe/snapshot) | Stateful distributed compute; F# + .NET native; perfect Zeta substrate fit | Composes with 081KRFA460008QG0R0018SN61J F# substrate + 081KSE6WT0008QG0R003WMG4XV fabric |
| 7 | `Zeta.Policy.Engine` | **OPA** Rego | Policy eval (eval/decide); admission control | Cluster-wide policy enforcement | Composes with 081KSE6WT0008QG0R003WMG4XV fabric (policy decisions as Observable events) |
| 8 | `Zeta.Identity.Workload` | **SPIRE** | SPIFFE ID issuance + verification | Workload identity (zero-trust foundation) | Composes with 081KSE6WT0008QG0R003WZAQKV "I execute, you fingerprint" extended to workload-identity scope |
| 9 | `Zeta.Distributed.AppRuntime` | **DAPR** | State / pubsub / service-invocation / bindings / actors / secrets | Multi-building-block app runtime | Already abstracts vendors per DAPR pattern; Zeta wrapper is thin |
| 10 | `Zeta.Inference` | **vLLM** (+ ONNX Runtime per 081KSE6WT0008QG0R0022D6GN8) | Inference surface (generate / embed / chat) | AI workload primitive | Composes with 081KSE6WT0008QG0R0022D6GN8 ONNX contract |

## Why Redis KV is the simplest

Substrate-honest argument for Rank 1:

1. **Smallest interface surface**: get / set / delete / scan
   (4 methods). Less code = less to get wrong on the first
   plugin.
2. **Existing infra**: Redis already deployed; operator can
   `kubectl exec` into Redis + verify state independently.
3. **Operator-visible value immediately**: even the thinnest
   wrapper lets operators write F# code like
   `Zeta.Storage.KeyValue.set("config:foo", "bar")` and
   verify via `redis-cli get config:foo`.
4. **No transactions / DDL / schema concerns**: pure KV.
5. **Plugs into existing standards** (per 081KSE6WT0008QG0R00063R6HB ServiceTitan):
   RESP protocol is established; Redis client libraries exist
   in every language; Zeta wraps the Microsoft `StackExchange.Redis`
   client (or equivalent).
6. **Substrate-honest minimal**: builds the per-plugin pattern
   (interface in `Zeta.Storage.KeyValue.fs`; backend adapter
   in `Zeta.Storage.KeyValue.Redis.fs`; conformance test suite;
   F# + C# facade; per 081KSE6WT0008QG0R003WMG4XV polyglot Rx wrapper as v2) on
   the smallest possible scope.

After Redis KV ships, the per-plugin pattern is proven; each
subsequent plugin reuses the substrate decisions made for Redis
KV (interface authoring contract, backend conformance test, F# +
C# facade, polyglot Rx wrapping).

## Acceptance (Rank 1 = first scope to ship; rest follow)

- [ ] `Zeta.Storage.KeyValue` interface F# project:
      ```fsharp
      type IKeyValueStore =
        abstract Get<'T>: key: string -> Async<Option<'T>>
        abstract Set<'T>: key: string * value: 'T * ttl: TimeSpan option -> Async<unit>
        abstract Delete: key: string -> Async<bool>
        abstract Scan: prefix: string -> AsyncSeq<string * obj>
      ```
- [ ] `Zeta.Storage.KeyValue.Redis` backend adapter using
      StackExchange.Redis; wraps standard Redis client + RESP
      protocol
- [ ] Conformance test suite per `IKeyValueStore` interface:
      every backend MUST pass; future backends (Valkey,
      DragonflyDB, KeyDB, in-memory, etc.) reuse the suite
- [ ] C# facade per existing Zeta.Core.CSharp pattern (for
      .NET ecosystem operators)
- [ ] k8s deployment recipe: operator deploys
      `Zeta.Storage.KeyValue.Redis` adapter as a sidecar OR
      library; connects to existing Redis cluster via service
      DNS
- [ ] Documentation: `docs/plugins/zeta-storage-keyvalue.md`
      naming the operator contract + the Redis backend +
      future alternative backends
- [ ] Per-plugin pattern documented: future plugins follow
      same shape (`Zeta.<Capability>.<Family>.fs` interface;
      `Zeta.<Capability>.<Family>.<Backend>.fs` adapter; F# +
      C# facade; conformance suite; per-plugin docs)
- [ ] Roadmap: ranks 2-10 each become sub-rows when ready to
      ship; pattern reused

## Per-plugin authoring contract (the substrate Redis KV creates)

After Redis KV ships, every future plugin follows the same shape:

```
plugins/
  Zeta.Storage.KeyValue/
    Zeta.Storage.KeyValue.fsproj
    IKeyValueStore.fs             ← interface
    BackendRegistry.fs            ← runtime backend selection
    Conformance.fs                ← shared test suite
  Zeta.Storage.KeyValue.Redis/    ← backend adapter
    Zeta.Storage.KeyValue.Redis.fsproj
    RedisKeyValueStore.fs
    RedisKeyValueStoreTests.fs    ← runs Conformance suite
  Zeta.Storage.KeyValue.CSharp/   ← C# facade
    Zeta.Storage.KeyValue.CSharp.csproj
    KeyValueStoreExtensions.cs
```

Every subsequent plugin (Rank 2 NATS, Rank 3 CockroachDB, etc.)
gets a parallel directory + same file shape. AI systems learning
the pattern after seeing 2-3 plugins can author the rest.

## ServiceTitan-route + Itron composition

Per 081KSE6WT0008QG0R00063R6HB ServiceTitan route: each Zeta plugin wraps an EXISTING
standard (Redis = RESP; NATS = NATS protocol; CockroachDB = PG
wire; Temporal = Temporal protocol; Orleans = Orleans grain API;
OPA = Rego eval). Operator using vanilla client libraries
unchanged; Zeta substrate adds composition + observability + AI-
trainable substrate per 081KSE6WT0008QG0R0015ZF2G6.

Per 081KSE6WT0008QG0R0004ZPPRP Itron route: once Zeta substrate has meaningful
adoption + concrete patterns from the first few plugins, the
Zeta plugin authoring contract itself becomes a candidate
standard for co-creation with incumbents (e.g., per 081KSE6WT0008QG0R0009YYNP4 CNCF
projects: contribute Zeta plugin authoring patterns back to
upstream OPA / DAPR / etc.).

## Composes with

- 081KRFA460008QG0R0018SN61J — F# fork for AI safety (the F# substrate Redis KV
  + future plugins build on)
- 081KSE6WT0008QG0R000WVYAJ2 — operator-in-the-negotiation-high-seat (each plugin
  contract is operator-owned; backends compete underneath)
- 081KSE6WT0008QG0R0009YYNP4 — CNCF force multipliers (most backends ARE CNCF
  projects already adopted)
- 081KSE6WT0008QG0R00063R6HB — ServiceTitan route (each plugin wraps existing
  standard; doesn't invent new)
- 081KSE6WT0008QG0R00049EFBD — slow-replace k8s (plugin substrate is the
  Wave-2-operator-surface ramp for 081KSE6WT0008QG0R00049EFBD's binary-compat
  endgame)
- 081KSE6WT0008QG0R003WMG4XV — observable+controllable cluster fabric (each
  plugin's events become Observables in the fabric; each
  plugin's commands become Observers)
- 081KSE6WT0008QG0R0008483B2 — cluster as digital twin (plugin events feed the
  twin; plugin commands flow through twin)
- 081KSE6WT0008QG0R001AZQA5Z — etcd-less options (CockroachDB-as-kine backend
  becomes Rank 4 substrate; the SQL plugin also serves as
  control-plane backing store option)
- 081KSE6WT0008QG0R000QXSG91 — HA-that-scales-beyond-etcd (NATS-JetStream Rank 2
  + CockroachDB Rank 4 both compose with scale-tier
  recommendations)

## What this preserves vs prevents

**Preserves**: 081KSE6WT0008QG0R000WVYAJ2's "operator-in-the-negotiation-high-seat"
principle. Every plugin contract is operator-facing + portable.
Backend swap-out per 081KSE6WT0008QG0R000WVYAJ2 vendor-swap.

**Prevents**: scope creep into "ship all 10 plugins at once"
which would burn engineering on the abstract framework before
proving the per-plugin pattern works for ONE backend. Per
Aaron's "starting with simplest" — Redis KV first; reuse pattern
for everything else.

## Operator-visible payoff at each rank

- After Rank 1 (Redis KV): operator writes `Zeta.Storage.KeyValue`
  code; backend swappable to alternative KV stores (Valkey,
  DragonflyDB, etc.) without code change
- After Rank 2 (NATS PubSub): operator writes event-driven
  apps in Zeta substrate; backend swappable; composes with
  081KSE6WT0008QG0R003WMG4XV Rx fabric natively
- After Rank 3-4 (Document + SQL): full data-tier interfaces
  cover most app workloads
- After Rank 5-6 (Workflow + Actors): higher-level
  orchestration substrate
- After Rank 7-10: full cluster substrate exposed via Zeta
  interfaces; 081KSE6WT0008QG0R0008483B2 digital twin substantively complete

## Out of scope

- Implementing all 10 plugins in one row — handle each as
  separate sub-row when ready (081KSE6WT0008QG0R000JSJ3SR = Redis KV; 081KSE6WT0008QG0R0004AP0ZA =
  NATS PubSub; etc.)
- Substituting alternative backends in v1 (Valkey for Redis,
  YugabyteDB for CockroachDB, etc.) — establish pattern with
  primary backend first; alternatives follow per 081KSE6WT0008QG0R000WVYAJ2
  vendor-swap
- Polyglot Rx wrapping per plugin (per 081KSE6WT0008QG0R003WMG4XV) — F# + C#
  facade in v1; polyglot SDKs in v2 per 081KSE6WT0008QG0R003WMG4XV
- Choosing between Temporal and Argo Workflows for Rank 5 —
  defer to operator; if both deployed, ship both adapters
  behind same interface

## Origin

Aaron 2026-05-25 mid-iter-3-CI-wait, after 081KSE6WT0008QG0R001AZQA5Z etcd-less +
081KSE6WT0008QG0R000QXSG91 scale-architecture: 'okay we already have coackroack in
cluster lets start finding shapes of ontologies and supporing
plugin model and adding one at a time over time starting with
simplest.' Substrate-honest recalibration: 081KSE6WT0008QG0R000WVYAJ2 + 081KSE6WT0008QG0R003WMG4XV +
081KSE6WT0008QG0R0008483B2 + 081KSE6WT0008QG0R001AZQA5Z + 081KSE6WT0008QG0R000QXSG91 named the ABSTRACT pattern; this row
picks the SIMPLEST concrete starting point (Redis KV) + names
the per-plugin pattern that follows.
