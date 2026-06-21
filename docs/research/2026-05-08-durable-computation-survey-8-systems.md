---
Scope: durable computation research
Attribution: Otto
Operational status: research-grade
Non-fusion disclaimer: Agreement, shared language, or repeated interaction does not imply shared identity, merged agency, consciousness, or personhood.
---

# Durable Computation Survey — 8 Systems vs Zeta's Gap

081KR2E4K0008QG0R001GFXN05. Compare systems that solve durable computation at
different layers against Zeta's `DurabilityMode.StableStorage`
gap in `src/Core/Durability.fs`.

## The gap

`Durability.fs` defines `DurabilityMode` with `InMemory` and
`OsBuffered` modes. `StableStorage` is declared but falls back
to `OsBuffered`. The gap: no crash-safe checkpoint that
survives process restart with guaranteed consistency.

## Systems compared

### 1. Temporal (temporal.io)

**What it solves:** Workflow durability via event sourcing.
Every workflow step is persisted; on crash, replay from log.

**What it doesn't:** Not a data-plane operator. Temporal
orchestrates WHEN code runs, not HOW data flows. Zeta's
operators need data-plane durability (the Z-set state), not
workflow orchestration.

**Composability:** Temporal could orchestrate Zeta circuit
lifecycle (start/stop/checkpoint) but doesn't replace the
checkpoint itself.

### 2. Reaqtor (github.com/reaqtive/reaqtor)

**What it solves:** Durable standing Rx queries. Periodic
checkpoint of IStatefulOperator state via Nuqleon
serialization. Billions of queries in Bing/MSN/M365.

**What it doesn't:** Tightly coupled to Nuqleon expression
tree serialization. Not trivially portable to F#/Zeta's
operator algebra.

**Composability:** The checkpoint PATTERN (IStatefulOperator +
periodic snapshot + replay) maps directly to Zeta's
ICheckpointable. The serialization FORMAT needs adaptation.

### 3. Orleans (github.com/dotnet/orleans)

**What it solves:** Virtual actor state persistence. Grains
checkpoint state to configurable storage (SQL, Azure, file).
Activation/deactivation lifecycle handles process restart.

**What it doesn't:** Actor-granularity, not operator-
granularity. Each grain is independent; Zeta's circuit is a
DAG of connected operators that must checkpoint atomically.

**Composability:** Orleans grain storage could BACK Zeta's
StableStorage mode. Each Zeta operator becomes an Orleans
grain; the grain's state IS the operator's checkpoint.

### 4. Bonsai (part of Reaqtor)

**What it solves:** Expression tree serialization. Compact,
self-describing, version-tolerant binary format for .NET
expressions.

**What it doesn't:** Not a durability system itself. It's
the serialization layer that Reaqtor uses for checkpoints.

**Composability:** Bonsai serialization could replace F#
binary serialization for Zeta checkpoints. More compact,
version-tolerant, but requires expression-tree representation
of operator state.

### 5. Azure Durable Functions

**What it solves:** Serverless workflow durability. Similar
to Temporal but Azure-native. Orchestrator replay pattern.

**What it doesn't:** Cloud-dependent. Zeta is local-first.
The replay pattern is useful; the Azure dependency is not.

**Composability:** The replay pattern (event-source the
orchestrator, replay on restart) applies. The cloud
dependency doesn't.

### 6. AWS Step Functions

**What it solves:** State machine orchestration with
durability. Each state transition is persisted.

**What it doesn't:** State-machine granularity, not
operator granularity. AWS-dependent.

**Composability:** The state-machine-transition-as-checkpoint
pattern maps to Zeta's Phase type in Consensus.fs. Not
directly useful for operator state.

### 7. Apache Beam / Dataflow

**What it solves:** Streaming pipeline durability via
checkpointing. Exactly-once semantics via checkpoint
barriers (Flink-style).

**What it doesn't:** JVM ecosystem. The checkpoint barrier
protocol is the transferable idea.

**Composability:** The checkpoint barrier (inject marker
into stream, all operators checkpoint when they see the
marker) is the pattern Zeta should adopt for atomic DAG
checkpoint.

### 8. TPL Dataflow

**What it solves:** .NET in-process dataflow blocks with
bounded buffers and backpressure.

**What it doesn't:** No built-in durability. In-memory only.
Blocks lose state on crash.

**Composability:** TPL Dataflow IS the .NET-native shape
for Zeta's operator pipeline. The durability gap in TPL
Dataflow is exactly Zeta's gap. Solving it for Zeta solves
it for TPL Dataflow consumers too.

## Recommendation

The checkpoint barrier pattern (from Beam/Flink) + the
IStatefulOperator interface (from Reaqtor) + Orleans grain
storage as the backend. Three layers composed:

1. **Interface:** `ICheckpointable` (already in Zeta)
2. **Protocol:** checkpoint barrier injected into circuit
3. **Storage:** Orleans grain state or file-based snapshot

This avoids cloud dependency (no Temporal/Durable Functions/
Step Functions) while using proven patterns from systems
running at Bing/M365 scale (Reaqtor) and .NET-native
infrastructure (Orleans).
