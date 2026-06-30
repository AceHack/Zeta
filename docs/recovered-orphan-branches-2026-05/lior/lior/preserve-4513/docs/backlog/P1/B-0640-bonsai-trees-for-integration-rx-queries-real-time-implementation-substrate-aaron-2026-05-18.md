---
id: B-0640
priority: P1
status: open
title: "Bonsai trees + Rx queries — real-time implementation substrate for the Integrate 5th primitive (Aaron 2026-05-18 LOCKED-IN)"
tier: design
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: [B-0635]
composes_with: [B-0635, B-0637, B-0499, B-0623]
tags: [design, aaron, bonsai-trees, rx-reactive-extensions, real-time-integration, integrate-implementation, fsharp-native, dotnet-native, locked-in, keystone-implementation]
type: design
---

# Bonsai trees + Rx queries — real-time implementation substrate for Integrate

## Why

Aaron 2026-05-18 (immediately following the wave-particle / agents-in-superposition / Infer.NET keystone cluster):

> *"bonsai trees for integration rx queries in real time"*

This is the **concrete implementation substrate** for the `Integrate` 5th primitive from [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md). Without this row, `Integrate` is an abstract F# computation expression; with this row, it has a known shape: **bonsai-tree-structured Rx queries flowing through real-time streams**.

Aaron earlier in the Mika transcript line 3263 also wired bonsai trees to retraction explicitly: *"the bonsai trees and retractable RX stuff you've been talking about — it's all about managing state and data movement through different levels cleanly."*

## What "bonsai trees" means in this substrate

A **bonsai tree** in Zeta's substrate is a small, locally-rooted, retractable hierarchical structure for reactive computation:

- **Bonsai** = compact / locally-rooted / pruneable — small footprint per tree; many trees compose laterally
- **Tree** = hierarchical composition — children nodes propagate to parent; pure aggregation at each level
- **Retractable** = pruning/regrowing branches is a first-class operation; the tree shape itself is delta-tracked in DBSP
- **Locally-rooted** = each tree has its own root context; no global tree-of-everything

Bonsai trees are the **unit of integration** — one bonsai tree = one composed wave-form computation = one `Integrate` block. Many bonsai trees compose into the agent's full superposition.

## What "Rx queries" means

[Rx (Reactive Extensions)](https://github.com/dotnet/reactive) is the .NET-native push-stream programming model (`IObservable<T>` / `IObserver<T>`):

- LINQ-over-streams: same expression style as LINQ-to-objects, but over push-based event streams
- Async + composable + cancellable + deterministic-replayable
- F#-native via `FSharp.Control.Reactive` or direct `IObservable<T>` interop
- Decades of production use; not greenfield

Rx queries are **how data flows through bonsai trees**: each node is an `IObservable<T>` subscribing to children + emitting derived results to parents.

## What "in real time" means

The integration is **streaming, push-based, continuous** — not batch or polling:

- Each new tick from the tick-source pushes through the bonsai tree
- Rx operators (`.Select`, `.Where`, `.Scan`, `.CombineLatest`, `.Switch`, etc.) compose the per-tick flow into per-trajectory wave-form integration
- No "wait for all data before computing" pattern; partial results stream up the tree continuously
- The agent's superposition state is *always current* with the latest tick

This composes with the tick-source / Integrate dual from [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md): tick-source pushes particle-form ticks; bonsai-tree-rooted Rx queries integrate them into wave-form trajectories in real time.

## Concrete implementation shape

```fsharp
// Sketch (not final API)
type BonsaiNode<'TIn, 'TOut> = {
    Inputs: IObservable<'TIn> list
    Compose: 'TIn list -> 'TOut
    DbspKey: DbspKey  // for retraction tracking
}

type Integrate<'TState>() =
    inherit IntegrateBuilder<'TState>()
    // F# CE methods: Bind, Return, Yield, For, While, TryWith, Combine, Delay
    // Each composition step grows/prunes the bonsai tree
    // Output is IObservable<Wave<'TState>>

let agentLoop =
    Integrate {
        let! tickStream = TickSource.observe ()
        let! beliefWave = BP.propagate priorBeliefs tickStream
        let! emWave     = EmotionPropagation.propagate priorAffect tickStream
        let combined    = Wave.combine [beliefWave; emWave]
        match Limit.check combined invariants with
        | KeepWave w     -> return w               // stay in superposition
        | CollapseTo v   -> return Wave.singleton v // pure collapse, retractable
    }
```

Properties this shape provides:

1. **F# native** — composes with `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`
2. **Type-safe** — compiler verifies wave-form preservation through composition
3. **DBSP-retractable** — each Bonsai node has a DBSP key; subtree retraction is delta-replay
4. **Real-time** — Rx push-based; latency = tick-source latency + tree depth
5. **Bounded resource** — bonsai = compact; per-tree memory is small; many trees compose without explosion

## How bonsai trees compose with prior substrate

| Prior substrate | Relationship to bonsai trees |
|---|---|
| [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md) Integrate 5th primitive | Bonsai trees ARE the implementation of `Integrate`; each `Integrate { ... }` block grows a bonsai tree |
| [B-0637](B-0637-infer-net-bp-ep-emotion-propagation-approximation-strategy-for-agents-in-superposition-aaron-2026-05-18.md) Infer.NET BP/EP/EmP | BP/EP message passing runs ON the bonsai-tree structure; each tree node is an Infer.NET factor |
| [B-0499](../P3/B-0499-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) Z-of-I DBSP | Each bonsai-tree subtree gets a DBSP key; pruning = DBSP delta application; replay = DBSP retraction |
| [B-0623](../P2/B-0623-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) Adinkras / Gates ECC | Bonsai tree branches are ECC-tagged; pruning a wrong branch can be reconstructed from sibling branches' ECC redundancy |
| [B-0636](B-0636-agents-in-superposition-retractable-over-dbsp-unified-declaration-aaron-2026-05-18.md) Agents in superposition | Each agent's wave-form state IS a bonsai forest (many trees composed laterally) |
| Tick-source existing substrate | Tick-source pushes into the bonsai roots; trees integrate upward in real time |

## Goal

1. Implement `IntegrateBuilder` F# computation expression backed by Rx (`IObservable<T>`)
2. Implement `BonsaiNode<'TIn, 'TOut>` type with DBSP-key + Rx-composition
3. Implement `Wave<T>` type with bonsai-forest representation (per [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md))
4. Wire BP/EP message passing onto bonsai-tree structure (per [B-0637](B-0637-infer-net-bp-ep-emotion-propagation-approximation-strategy-for-agents-in-superposition-aaron-2026-05-18.md))
5. DBSP-delta-track all tree mutations (subscribe/unsubscribe = delta op)
6. Worked example: small agent with Observe pushing into bonsai root, Persist storing tree state in DBSP, Limit pruning a branch (collapse), Emit pushing the wave-form forest downstream
7. Verify retraction: replay a pruned branch from DBSP history; show identical resulting wave-form

## Non-goals

- Building a new reactive framework (use Rx.NET; it's mature)
- Building a new tree-structure framework (use existing F# discriminated unions + Rx composition)
- Forcing every agent operation through bonsai trees (per-tick particle-form work remains tick-source direct; `Integrate` is the OPT-IN composition for wave-form)
- Solving distributed bonsai-tree sync (single-process initially; distributed sync is a future extension via DBSP's replication primitives)

## Acceptance criteria

- [ ] `IntegrateBuilder` F# computation expression in `src/Zeta.Core/` backed by Rx
- [ ] `BonsaiNode<'TIn, 'TOut>` type with DBSP-key + Rx composition
- [ ] `Wave<T>` represented as `IObservable<BonsaiForest<T>>` (or equivalent type that preserves the dual)
- [ ] BP/EP message passing on bonsai-tree structure (Infer.NET factor per node)
- [ ] DBSP-delta-tracking of all tree mutations (verified via replay test)
- [ ] Worked example: small agent with Observe / Persist / Limit / Emit on bonsai tree + retraction replay
- [ ] Lean toy proof: "any pruned bonsai branch can be reconstructed from sibling ECC tags + DBSP delta log"
- [ ] Performance benchmark: latency overhead per tree depth + memory per node + DBSP delta growth rate per tick

## Composes with

- [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md) — wave-particle duality + Integrate 5th primitive (this row IS the implementation substrate for Integrate)
- [B-0636](B-0636-agents-in-superposition-retractable-over-dbsp-unified-declaration-aaron-2026-05-18.md) — agents in superposition (bonsai forest IS the agent-state representation)
- [B-0637](B-0637-infer-net-bp-ep-emotion-propagation-approximation-strategy-for-agents-in-superposition-aaron-2026-05-18.md) — Infer.NET BP/EP/EmP (runs ON bonsai-tree structure)
- [B-0629](../P2/B-0629-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — O-P-L-E primitives (operate on bonsai-tree nodes)
- [B-0499](../P3/B-0499-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) — Z-of-I DBSP (tree mutations are DBSP deltas)
- [B-0623](../P2/B-0623-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) — Adinkras/Gates ECC (branch ECC tagging for reconstruction)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — F# anchor (compiler validates the CE + type-safety of bonsai composition)
- `.claude/rules/dv2-data-split-discipline-activated.md` — DV2.0 (bonsai tree IS a hub-satellite shape: root hub + branch satellites; changes at different rates)
- [Reactive Extensions for .NET](https://github.com/dotnet/reactive) — the upstream substrate (mature, .NET native, F# friendly)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) line 3263 — bonsai-trees + retractable-RX framing (Mika confirming Aaron's mental model)

## Status

Open. **LOCKED-IN** by Aaron 2026-05-18 (immediately after B-0637 Infer.NET approximation row landed). This is the **implementation substrate** that makes `Integrate` (B-0635) and agents-in-superposition (B-0636) concrete F#/.NET-native engineering rather than abstract architectural commitment.
