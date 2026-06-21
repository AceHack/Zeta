---
id: 081KQZVQW0008QG0R000PPQ3MH
priority: P1
status: open
title: "Durable computation stack research — Temporal + Reaqtor + Orleans + Bonsai composition for DurabilityMode.StableStorage"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [081KQZVQW0008QG0R001FG05RZ]
decomposition: decomposed
children: [081KR2E4K0008QG0R001GFXN05, 081KR2E4K0008QG0R000YTJS3Q, 081KR2E4K0008QG0R0022RVRCZ]
owners: [architect]
composes_with: [081KQ3HBZ0008QG0R000RP1WDN, 081KQZVQW0008QG0R001FG05RZ]
tags: [durability, temporal, reaqtor, orleans, bonsai, standing-query, rx, durable-functions]
type: feature
---

## What

Close the `DurabilityMode.StableStorage` gap in
`src/Core/Durability.fs` by studying and composing
8 systems that solve durable computation at different
layers:

| System | Layer | License |
| ------ | ----- | ------- |
| Bonsai/Nuqleon | Expr tree serialization | MIT |
| Temporal | Durable execution (replay) | MIT |
| Reaqtor | Stateful Rx (checkpoint) | MIT |
| Orleans | Virtual actors (grains) | MIT |
| Durable Functions | MS managed workflows | MIT |
| AWS Step Functions | Amazon state machines | Proprietary |
| Dataflow/Beam | Streaming + windowing | Apache 2.0 |
| TPL Dataflow | .NET in-process dataflow | MIT |

## Why these compose (not compete)

- **Bonsai** = serialize the query definition (expression tree → compact JSON/binary)
- **Temporal** = make execution durable (event history replay; deterministic re-execution)
- **Reaqtor** = make Rx operators stateful (checkpoint/restore at operator boundaries)
- **Orleans** = address and locate the computation (grain = subscriber; silo = node)
- **TPL Dataflow** = in-process pipeline (mailbox pattern)

## The DBSP unification

DBSP's Z-set algebra unifies the streaming and workflow
models because Z-sets are both the event stream AND the
state:

- `D` (differentiate) converts state → stream
- `I` (integrate) converts stream → state
- They're inverses: `I(D(x)) = x`

This means:

- **Temporal's event-history replay** = replaying the Z-set
  stream through the deterministic circuit
- **Reaqtor's operator checkpoint** = serializing the `I`
  (integrated state) at operator boundaries
- **Orleans grain persistence** = the grain IS the integrated
  state of one standing query
- **Bonsai** = how to serialize the circuit topology itself

## The gap in src/Core/Durability.fs

```fsharp
type DurabilityMode =
    | StableStorage    // "advertised but not fulfilled"
    | OsBuffered       // works
    | InMemoryOnly     // works
    | WitnessDurable   // research skeleton
```

`StableStorage` is defined but falls back to `OsBuffered`
semantics (DiskBackingStore without per-Save fsync).
`WitnessDurable` throws until the WDC protocol lands.
The checkpoint boundary already exists:
`Circuit.StepAsync` is the yield point. The owed work:

1. After each `StepAsync`, optionally serialize operator state
2. Persist the Z-set input stream for replay
3. On recovery, replay from last checkpoint

## Aaron's lineage on this

- dotnet/orleans #4985 (2018) — "Durability Guarantees"
- dotnet/orleans #3608 (2017) — "Productizing Orleans"
- dotnet/orleans #2580 (2017) — "Separate health checks from membership"
- Azure/Azure-Functions #2451 (2024) — Dapr Workflow vs Durable Functions hops
- microsoft/durabletask-go #64 (2024) — Durable Entities support
- Zeta src/Core/Rx.fs — already bridges Circuit → IObservable with Reaqtor references

## Candidate atomic children

- Study Temporal .NET SDK interface (`temporalio/sdk-dotnet`)
- Study Reaqtor IStatefulOperator checkpoint pattern
- Study Bonsai expression tree serialization for circuit topology
- Study Orleans grain persistence for standing query state
- Implement StableStorage backing store with fsync
- Implement checkpoint at StepAsync boundary
- Implement Z-set stream persistence for replay
- Wire RxAdapter.asObservable to checkpoint-aware circuit
- Test: crash recovery from checkpoint
- Test: deterministic replay produces identical state
