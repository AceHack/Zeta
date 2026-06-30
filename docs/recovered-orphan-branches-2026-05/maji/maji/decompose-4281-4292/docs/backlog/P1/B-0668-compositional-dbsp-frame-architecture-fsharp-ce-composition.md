---
id: B-0668
priority: P1
status: open
title: "Compositional DBSP frame architecture — F# CE composition operator + Rx ↔ DBSP bridge"
tier: design
effort: L
created: 2026-05-19
last_updated: 2026-05-19
depends_on: [B-0644, B-0665, B-0666, B-0667, B-0640]
composes_with: [B-0635, B-0637, B-0664]
tags: [design, aaron, dbsp, fsharp, compositional-architecture, fsharp-computation-expressions, monadic-composition, beacon-tier-eligible]
type: design
---

# Compositional DBSP frame architecture — F# computation expressions and Rx ↔ DBSP bridge

## Why
The default DBSP DB frame in F# requires temporal and focus dimensions for incremental computation. Additional meta-frames compose ON TOP of the base via F# computation expressions.

- **F# computation expression composition** — operationally clean composition operator: monadic let-bang composition is F#'s native mechanism for adding context-dimensions to a base computation; each meta-frame is a typed CE that composes with the base; type system enforces correctness.
- The compositional schema is **recursive**: each meta-frame adds dimensions; each addition is itself a F# computation expression that composes with the base.

## Open technical problem — Rx ↔ DBSP impedance mismatch (Kestrel critique)

1. Rx `IObservable<T>` is push-based + observer-protocol; no native retraction semantics
2. DBSP Z-set algebra requires retraction = additive inverse (group structure for incremental-view-maintenance)
3. F# computation expression composition is the SHAPE of the bridge but does NOT automatically resolve the algebra mismatch
4. The bridge requires: lifting Rx push-notifications into Z-set-encoded change-streams with retraction lattice + defining the inverse direction (DBSP change-stream → Rx observer notifications)
5. The bridge spec needs property tests (FsCheck) covering: retraction commutativity, group-laws preservation, push-vs-pull duality preservation

## Deployment topology (Aaron 2026-05-19)
- **20-computer home Kubernetes cluster — 20-Node Physical Tier / NVMe storage / 64-core compute**
- **Distributed DB hosting intelligence**: LLMs + Bayesian inference run AS the database, spread across nodes.

## Acceptance
- **Single-F#-instance → Kubernetes-cluster mapping for clustered observables**: concrete stack pipeline **F# → Orleans → our-own-fork-of-Azure/durabletask → Kubernetes → cluster observables**.
  - **F#** = typed CE-composition layer
  - **Orleans** = virtual-actor framework providing location-transparent distributed objects
  - **Azure/durabletask** = workflow orchestration with state-persistent durable tasks; saga compensation = retraction = additive inverse in Z-set algebra.
  - **Kubernetes** = container orchestration runtime
- **Rx ↔ DBSP bridge spec**: formal type-level + algebraic specification of how Rx `IObservable<T>` push-notifications lift into DBSP Z-set change-streams.
- **kind (Kubernetes IN Docker) for local k8s + multi-node testing**
- Property tests (FsCheck) for: retraction commutativity, group-laws preservation, push-vs-pull duality preservation, compositional invariants.

## Proposed mechanization

```fsharp
type DbspFrame<'TBase, 'TMeta> = ...
type FrameComposition<'TBase, 'TMeta, 'TNewMeta> = ...

// Composition via CE
let compositionBuilder = ...
compositionBuilder {
  let! base = dbspBase
  // other meta-frames to be injected
  return composedFrame
}
```
