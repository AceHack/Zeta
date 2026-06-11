---
id: B-0777
zetaid: 081KSE6WT0008QG0R000JSJ3SR
priority: P1
status: open
title: Industry-sharp plugin categories + per-persona ontology maps + Ace package manager negotiation — sharpening B-0776 plugin authoring contract
effort: M
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on: []
composes_with:
  - B-0247
  - B-0287
  - B-0288
  - B-0428
  - B-0759
  - B-0761
  - B-0765
  - B-0772
tags: [strategy, plugins, ontology, industry-standards, personas, ace-package-manager, negotiation, multi-map]
---

## Problem

Aaron 2026-05-25 mid-iter-3-CI-wait, sharpening B-0776 plugin
sequence: *"any order is fine we just need to start working on
simple shapes addion and max can use for categories that are
also industry sharp so we don't get laughed out of ontology
negoations we can keep multpile maps per perona type if needed
this is the start of ace package manager negoations."*

Three sharpenings to the B-0776 per-plugin authoring contract:

1. **Order is fine; start working on simple shapes — addition
   pattern**: pick any plugin from the B-0776 rank 1-10
   sequence; what matters is shipping the per-plugin pattern
   so subsequent plugins reuse it. Don't optimize the sequence;
   optimize the pattern.

2. **Industry-sharp categories**: every plugin's
   ONTOLOGY POSITIONING must be defensible in industry-
   standards discussions. Max (co-owner, AI cluster architect
   per session lineage) needs to be able to take the plugin
   spec to OASIS / CNCF / IEEE / Linux Foundation / W3C and
   not have it dismissed as ad-hoc. Plugins need to USE the
   established industry vocabulary for their category, not
   invent parallel terms.

3. **Multiple per-persona ontology maps + Ace negotiation**:
   different operator personas use different vocabularies for
   the same underlying capability. Zeta supports MULTIPLE
   per-persona ontology mappings of one substrate; **Ace
   package manager** (Aaron's existing B-0247 / B-0287 /
   B-0288 substrate) handles the cross-vocabulary translation.
   This row + the first plugin shipment IS the kickoff for
   Ace ontology negotiation operating at substrate scope.

## Industry-sharp positioning per plugin (concrete table)

For each B-0776 plugin, the industry-sharp categories +
established academic frames + standards-body positioning:

| Plugin | Industry-sharp categories | Established academic frames | Standards-body candidates |
|---|---|---|---|
| **`Zeta.Storage.KeyValue`** | NoSQL key-value store; distributed cache; session store; rate-limiter substrate; in-memory data structure store | Dynamo (Amazon 2007); Bigtable (Google 2006); CRDT-compatible (Shapiro et al. 2011); RESP wire protocol (Redis); Voldemort (LinkedIn) | CNCF: Valkey graduated; Redis OSS pre-fork; OASIS: KMIP (key mgmt; tangential) |
| **`Zeta.Messaging.PubSub`** | Publish-subscribe messaging; event-driven architecture; message broker; durable streaming | OMG DDS (1980s+); MQTT (IBM 1999); AMQP (JPMC 2003); Kafka log-structured (LinkedIn 2010); NATS (Apcera 2011) | CNCF: NATS incubating; Knative Eventing; CloudEvents; OASIS: AMQP graduated, MQTT graduated |
| **`Zeta.Storage.Document`** | Document database; NoSQL document store; JSON-document store; aggregate-oriented database | Aggregate-oriented (Sadalage + Fowler 2012); MongoDB (10gen 2007); CouchDB (Apache 2005); BSON wire | IETF: JSON RFC 8259; ECMA-404 (JSON); ISO/IEC 21778 (JSON); W3C: JSON-LD |
| **`Zeta.Storage.SQL`** | Relational database; SQL DBMS; OLTP store; distributed SQL | Codd 1970 relational model; Spanner (Google 2012); Calvin (Yale 2012); CockroachDB; YugabyteDB | ISO/IEC 9075 (SQL standard); ANSI/INCITS DM32.2 (SQL); CNCF: Cilium not relevant; SQL/MM |
| **`Zeta.Workflow`** | Workflow orchestration engine; business process management; durable execution; saga orchestration | BPMN 2.0 (OMG); WS-BPEL 2.0 (OASIS); CIFF (OASIS); Saga pattern (Garcia-Molina + Salem 1987) | OMG: BPMN; OASIS: BPEL; CNCF: Argo Workflows incubating; Temporal pending |
| **`Zeta.Actors`** | Actor model; concurrent computing; virtual actors; grain-based stateful compute | Hewitt 1973 (actor model); Erlang/OTP; Akka (Lightbend); Orleans (MS Research 2011); Pony language | CNCF: KubeEdge (tangential); Linux Foundation: Akka pre-license-change; ISO/IEC: actor model in concurrent computing standards |
| **`Zeta.Policy.Engine`** | Policy engine; policy-as-code; admission control; RBAC/ABAC | Rego (OPA 2017); XACML 3.0 (OASIS 2013); RBAC NIST RFC; Cedar (AWS 2023) | OASIS: XACML graduated; CNCF: OPA graduated, Kyverno incubating |
| **`Zeta.Identity.Workload`** | Workload identity; service mesh identity; SPIFFE/SPIRE; zero-trust workload identity | SPIFFE specification (CNCF); X.509-SVID; JWT-SVID; OAuth 2.0; OpenID Connect | CNCF: SPIFFE+SPIRE graduated; OASIS: SAML graduated; IETF: OAuth/OIDC RFCs |
| **`Zeta.Distributed.AppRuntime`** | Distributed application runtime; sidecar pattern; building-block APIs; multi-runtime microservices | Sidecar pattern (Burns + Oppenheimer 2016); multi-runtime microservices (Bilgin Ibryam); DAPR | CNCF: DAPR incubating |
| **`Zeta.Inference`** | Machine learning model serving; AI inference runtime; LLM serving | Triton (NVIDIA 2018); TorchServe; TensorFlow Serving; vLLM (UC Berkeley 2023); ONNX Runtime (Microsoft 2018) | LF AI & Data: ONNX (graduated); MLCommons: MLPerf Inference benchmark |
| **`Zeta.Compute.NPU`** (B-0771) | Neural processing unit; AI accelerator; on-chip ML accelerator | Heterogeneous compute models; OpenVINO (Intel); CUDA (NVIDIA); ROCm (AMD); Core ML (Apple); MLIR (LLVM project) | LF AI & Data: ONNX; MLPerf benchmarks; Khronos: SYCL, OpenCL |
| **`Zeta.Network.Mesh`** | Service mesh; sidecar proxy mesh; eBPF mesh; data-plane proxy | Envoy (Lyft 2016); Istio data plane; Cilium eBPF mesh; XDP | CNCF: Cilium graduated, Envoy graduated, Istio graduated; SMI graduated (deprecated since 2023) |

Each plugin's interface naming + documentation uses the
industry-sharp categories explicitly. Operators (and AI systems
training on the substrate per B-0761) see the plugin in its
established taxonomy position immediately.

## Per-persona ontology maps (multi-map substrate)

Different operator personas see the same underlying capability
through different vocabulary lenses. Zeta substrate supports
multiple per-persona ontology projections of the SAME plugin:

| Plugin | Web-dev persona | Enterprise architect | AI/ML researcher | Industrial IoT engineer | Game developer |
|---|---|---|---|---|---|
| `Zeta.Storage.KeyValue` | "Redis cache layer / session store" | "Distributed KV store with HA replication" | "Feature cache / embedding cache / inference cache" | "Device twin shadow store / time-series state cache" | "Player session / leaderboard / matchmaking queue" |
| `Zeta.Messaging.PubSub` | "Pub/sub queue" | "Event bus / message broker" | "Training event stream / inference event log" | "MQTT-equivalent device telemetry pipeline" | "Game-state event broadcast / chat messaging" |
| `Zeta.Storage.Document` | "MongoDB-style document store" | "Aggregate-oriented NoSQL" | "Experiment metadata store / model registry" | "Device configuration store / SCADA tag store" | "Player profile store / inventory store" |
| `Zeta.Storage.SQL` | "Postgres-style relational DB" | "Distributed SQL / NewSQL" | "Experiment results warehouse / metrics store" | "Historian database / time-series + relational" | "Player progression DB / economy ledger" |
| `Zeta.Workflow` | "Job queue / background processor" | "BPM / workflow orchestrator" | "Training pipeline / experiment runner" | "Operational procedure orchestrator / batch process scheduler" | "Quest / progression / event-trigger orchestrator" |
| `Zeta.Actors` | "Stateful service / WebSocket session manager" | "Distributed actor system / virtual actors" | "Per-agent / per-experiment stateful compute" | "Per-device state machine / per-PLC controller" | "Per-player / per-NPC / per-room stateful entity" |
| `Zeta.Policy.Engine` | "Authz middleware / feature flag engine" | "Policy-as-code / governance enforcement" | "Model deployment policy / data access policy" | "Safety interlock policy / operational mode policy" | "Anti-cheat policy / content moderation policy" |

Each row is one substrate; multiple vocabulary projections.
Operator reads the projection that matches their mental model;
substrate underneath is the same; Ace package manager handles
the cross-vocabulary translation when needed.

## Ace package manager as ontology negotiator

Per B-0247 / B-0287 / B-0288 (existing Ace substrate) + B-0741
(ontology negotiation):

**Ace is the package-manager-of-managers**. It composes other
package managers (npm / pip / cargo / helm / krew / nix / etc.)
into a single substrate. Per B-0741 ontology negotiation: Ace
also bridges cross-vocabulary translation between ecosystems.

For Zeta plugin substrate: Ace becomes the ONTOLOGY NEGOTIATOR
that maps:

- Operator's vocabulary (web-dev / enterprise / AI-ML /
  industrial-IoT / game-dev / per-persona-table-above) →
  industry-sharp category (canonical position in established
  taxonomy) → backend implementation (Redis / NATS /
  CockroachDB / Temporal / Orleans / OPA / etc.)
- Cross-ecosystem: Helm chart for Redis ↔ Crossplane composition
  for Redis-OperatorCluster ↔ kro ResourceGraphDefinition ↔
  Zeta's `Zeta.Storage.KeyValue` plugin spec ↔ DAPR state-store
  Component → all the same underlying capability, different
  vocabularies + different runtime substrates; Ace bridges

The first plugin shipment (per B-0776 — pick any rank 1-10)
becomes the **kickoff for Ace ontology negotiation operating at
substrate scope**. Aaron 2026-05-25: *"this is the start of ace
package manager negoations."*

## Acceptance

- [ ] Plugin authoring contract document updated with the
      industry-sharp-categories requirement:
      `docs/PLUGIN-AUTHOR.md` — every plugin MUST
      include (a) industry-sharp categories from the established
      taxonomy, (b) academic frames cited, (c) standards-body
      positioning, (d) per-persona ontology map (minimum 3
      persona variants per plugin)
- [ ] First plugin (pick any rank; substrate-honest proves the
      pattern regardless of which) ships with the
      industry-sharp positioning included; not just "Redis
      wrapper" — "NoSQL key-value store (Dynamo / RESP lineage;
      candidate per OASIS KMIP-adjacent positioning); per-
      persona ontology map covers web-dev / enterprise / AI-ML /
      industrial-IoT / game-dev"
- [ ] Ace integration: Ace package manager substrate
      (B-0247/B-0287/B-0288) acquires "Zeta plugin spec"
      handler; can resolve "operator asks for KeyValue store"
      → traverse industry-sharp categories → pick Zeta plugin
      OR equivalent → install via appropriate backend package
      manager (helm / nix / etc.)
- [ ] Documentation: create `docs/personas/persona-ontology-maps.md`
      shipping the per-persona table from this row, under the
      existing `docs/personas/` directory; updated as plugins land
- [ ] Standards-body engagement readiness: when Max takes
      Zeta plugin specs to industry standards discussions,
      the per-plugin doc IS the conversation starter; not
      "we invented X" but "we operate at the intersection of
      well-established X / Y / Z; here's our specific
      composition"
- [ ] Multi-map per-plugin tests: substrate-honest verification
      that each persona's mental model maps cleanly through Ace
      to the canonical industry-sharp position to the actual
      backend; operator can use ANY persona vocabulary + reach
      the same substrate

## Why industry-sharp matters (defensibility)

Aaron's framing: *"max can use for categories that are also
industry sharp so we don't get laughed out of ontology
negoations"*. Substrate-honest argument:

**Without industry-sharp positioning**: Zeta plugin specs look
like "yet another wrapper around Redis" — dismissed in
standards discussions; treated as ad-hoc by serious
infrastructure operators; AI systems training on the substrate
miss the established academic + industry grounding.

**With industry-sharp positioning**: Zeta plugin specs ARE the
well-known categories at well-known positions in established
taxonomies; the value-add is COMPOSITION (substrate-honest
coherent multi-plugin substrate per B-0772 / B-0773 / B-0776) +
COMPETITIVE-FREE SWAP (per B-0763) + AI-TRAINABLE (per B-0761) + DBSP-GROUNDED (per B-0428) — not naming-novelty.

The naming discipline IS the substrate that makes Zeta
defensible in industry conversations + makes AI systems
training on it inherit the established frames + makes operators
recognize what they're adopting.

## Composes with

- B-0247 / B-0287 / B-0288 — existing Ace package-manager
  substrate (Aaron's prior work that this row's ontology-
  negotiation extension builds on)
- B-0428 — F# fork for AI safety (the substrate base; plugin
  interfaces are F# native)
- B-0741 — ontology+category negotiation (the substrate this
  row operationalizes per-plugin)
- B-0759 — first-time-CLI-user persona (one of many personas
  this row's multi-map approach supports)
- B-0761 — open AI-trainable reference architecture (each
  plugin's industry-sharp positioning + per-persona maps
  are training data for AI systems)
- B-0763 — operator-in-the-negotiation-high-seat (industry-
  sharp positioning IS what defends the operator's high-seat
  position in standards discussions)
- B-0765 — ServiceTitan route (industry-sharp positioning IS
  per the ServiceTitan principle — adopt existing categories,
  don't invent)
- B-0768 — Itron-mode (Max's standards-body engagement work
  IS the Itron-mode-Phase-2 substrate this row prepares for)
- B-0772 — observable+controllable cluster fabric (each plugin
  contributes to fabric per its industry-sharp category position)
- B-0773 — cluster as digital twin (twin substrate uses
  industry-sharp categories for first-class taxonomy)
- B-0776 — simplest-first plugin sequence (this row sharpens
  B-0776's per-plugin authoring contract to require industry-
  sharp + multi-map + Ace-aware)

## Out of scope

- Cataloging EVERY industry-sharp category for EVERY plugin
  upfront — handle per-plugin as each ships; this row
  documents the requirement + first table of canonical
  positions
- Ace package manager full implementation — already in flight
  via Aaron's existing B-0247 / B-0287 / B-0288 substrate;
  this row composes with existing work
- Standards-body engagement (CNCF / OASIS / W3C / IEEE
  membership) — that's Itron-mode (B-0768) work; this row
  prepares the substrate Max can take to those bodies
- Mechanical translation between persona vocabularies via
  LLM — composes with B-0762 telemetry flywheel + B-0772
  fabric; not this row's v1 scope

## Origin

Aaron 2026-05-25 mid-iter-3-CI-wait, after B-0776 simplest-first
plugin sequence: 'any order is fine we just need to start
working on simple shapes addion and max can use for categories
that are also industry sharp so we don't get laughed out of
ontology negoations we can keep multpile maps per perona type
if needed this is the start of ace package manager negoations.'

Three sharpenings to B-0776 per-plugin authoring contract:
order doesn't matter (any plugin proves the pattern); industry-
sharp positioning is mandatory (defensibility in standards
discussions); multiple per-persona ontology maps supported with
Ace package manager as the cross-vocabulary negotiator.

This row + the first plugin shipment IS the substrate kickoff
for Ace operating at ontology-negotiation scope per B-0741 +
existing Ace substrate.
