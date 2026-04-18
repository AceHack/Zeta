namespace Zeta.Core

open System
open System.Collections.Generic


/// Delta-state CRDTs and Dotted Version Vectors — the 2018 anti-
/// entropy story by Almeida, Shoker, Baquero.
///
/// ## Why delta-CRDTs
///
/// Full-state replication ships `|state|` bytes per sync. A δ-mutator
/// returns **only the mutation delta** — so when replica A increments,
/// we ship O(1) bytes instead of O(|state|). The fit with DBSP is
/// natural: our `D` (differentiate) operator already gives us the
/// delta at tick t; `I` (integrate) recomposes state. δ-CRDT merges
/// are the same composition. See Almeida, Shoker, Baquero 2018
/// (arXiv:1603.01529) for the formal framework.
///
/// ## Dotted Version Vectors (Preguiça 2010)
///
/// Standard version vectors `{replica → counter}` lose causal info
/// on concurrent writes by the same replica. DVV fixes this with
/// **dots** — a (replica, counter) pair per causally-unique write —
/// plus an enclosing causal context. Exactly what DBSP nested-circuit
/// iteration numbering needs when distribution lands.


/// **Dotted Version Vector** — causal metadata for a single event.
/// `Context` is a map `replica → latest-counter-seen` (the VV part).
/// `Dot` is `(replica, counter)` of the specific event.
[<Struct; NoComparison>]
type Dvv = {
    Context: Map<string, int64>
    Dot: struct (string * int64) option
}
with
    static member Empty : Dvv = { Context = Map.empty; Dot = None }

    /// Produce a new DVV for a write by `replica`.
    member this.Sync(replica: string) : Dvv =
        let counter =
            match Map.tryFind replica this.Context with
            | Some c -> c + 1L
            | None -> 1L
        { Context = Map.add replica counter this.Context
          Dot = Some (struct (replica, counter)) }

    /// Is `a` causally before `b`?
    static member Before (a: Dvv) (b: Dvv) : bool =
        // a ≺ b iff every (r, n) in a.Context has n ≤ b.Context[r]
        // and ∃ r where a.Context[r] < b.Context[r]
        let mutable allLe = true
        let mutable someLt = false
        for kv in a.Context do
            match Map.tryFind kv.Key b.Context with
            | Some n ->
                if kv.Value > n then allLe <- false
                if kv.Value < n then someLt <- true
            | None -> allLe <- false
        // Also count entries in b not in a — those make b > a.
        for kv in b.Context do
            if not (Map.containsKey kv.Key a.Context) then someLt <- true
        allLe && someLt

    /// Are `a` and `b` **concurrent** (neither before the other)?
    static member Concurrent (a: Dvv) (b: Dvv) : bool =
        not (Dvv.Before a b) && not (Dvv.Before b a) && a <> b

    /// Join two DVVs — elementwise max over the Context map.
    static member Join (a: Dvv) (b: Dvv) : Dvv =
        let merged =
            Map.fold
                (fun acc k v ->
                    match Map.tryFind k acc with
                    | Some existing -> Map.add k (max existing v) acc
                    | None -> Map.add k v acc)
                a.Context
                b.Context
        { Context = merged; Dot = None }


/// A **δ-mutator** transforms a state into a minimal delta that, when
/// merged back, produces the post-mutation state. Generic over the
/// CRDT type; compose with `Dvv` to track causality.
///
/// ```fsharp
/// let delta : Delta<GCounter> = GCounterDelta.increment "replicaA" 5L
/// let shipped : byte[] = Serializer.toBytes serializer delta.AsZSet
/// // ...ship across network...
/// let newLocal = GCounterDelta.applyDelta localState delta
/// ```
type Delta<'T> = {
    /// The state representation of this delta — typically a ZSet-shaped
    /// fragment that can be merged with full-state CRDTs.
    Payload: 'T
    /// Causal metadata so the receiver can order/dedupe this delta
    /// against others it may have already applied.
    Causality: Dvv
}


[<RequireQualifiedAccess>]
module GCounterDelta =

    /// Build a δ for an increment: just the (replica, delta) pair.
    /// Shipping size = O(1), vs O(|replicas|) for full-state merge.
    let increment (replica: string) (delta: int64) (priorCausality: Dvv) : Delta<GCounter> =
        if delta < 0L then invalidArg (nameof delta) "G-Counter increments must be non-negative"
        let partial = GCounter.Empty.Increment(replica, delta)
        { Payload = partial
          Causality = priorCausality.Sync replica }

    /// Apply a received δ to local state — ordinary GCounter merge.
    let apply (local: GCounter) (d: Delta<GCounter>) : GCounter =
        GCounter.Merge local d.Payload


[<RequireQualifiedAccess>]
module PNCounterDelta =

    let increment (replica: string) (delta: int64) (priorCausality: Dvv) : Delta<PNCounter> =
        { Payload = PNCounter.Empty.Increment(replica, delta)
          Causality = priorCausality.Sync replica }

    let apply (local: PNCounter) (d: Delta<PNCounter>) : PNCounter =
        PNCounter.Merge local d.Payload


[<RequireQualifiedAccess>]
module OrSetDelta =

    let addElement<'T when 'T : comparison> (elem: 'T) (replica: string) (priorCausality: Dvv) : Delta<OrSet<'T>> =
        { Payload = OrSet<'T>.Empty.Add elem
          Causality = priorCausality.Sync replica }

    let apply<'T when 'T : comparison> (local: OrSet<'T>) (d: Delta<OrSet<'T>>) : OrSet<'T> =
        OrSet.Merge local d.Payload
