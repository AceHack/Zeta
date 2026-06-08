namespace Zeta.Core

open System.Collections.Generic
open Zeta.Core.Abstractions

/// **Ray-traceable sparse tensor — the full capability vector in F# (the reference oracle).**
///
/// Composes a `WeightedSet<'K,'W>` (sparse storage / Z-set generalization) with a **geospatial embedding**
/// (`position: 'K -> double[]` — a coordinate's point in the metric locality space) and its weight
/// `ISemiring<'W>`, and implements the unified `IRayTraceable<'K,'W>` contract = `ITensor` (skip empty) +
/// `ISampleable` (light) + `IIntrospectable` (walk) + `IGeospatial` (locality) + `Trace` (accumulate via a
/// semiring). This is the F# implementation Vera/Lior port to C#/Rust/TS (4-oracle parity); F# is the
/// reference.
///
/// Design notes:
/// - `Sample` returns the semiring `Zero` where a coordinate is absent (sparse default) — exactly the
///   `ISampleable` contract and `WeightedSet.weight`'s behaviour.
/// - `Neighbors` are the stored support coordinates other than `at`, **nearest-first by Euclidean distance in
///   position space** — locality stepping (the geospatial analogue of graph adjacency for a sparse field).
/// - `Trace` folds the ray, sampling each coordinate and combining via the *passed* `accumulate` semiring;
///   absent coordinates are **skipped** (sparsity), so the ray skips empty space. The trace is deterministic
///   (a left fold over the ray), hence replayable — a *proof* when cast from an `ITravelerFrame` whose
///   `IsDeterministic` holds. With `'W = SoftValue` + a probability semiring it propagates irreducible
///   uncertainty (the result is itself soft), per the `IRayTraceable` contract.
///
/// API-review pending (Ilyana) before any public/NuGet exposure.
type RayTensor<'K, 'W when 'K: comparison and 'W: equality>
    (sr: ISemiring<'W>, dimensions: int, position: 'K -> double[], data: WeightedSet.WeightedSet<'K, 'W>) =

    /// The backing sparse tensor.
    member _.Data = data
    /// The weight semiring (sampling / Zero-where-absent).
    member _.Semiring = sr

    /// Euclidean distance in position space (locality metric for stepping).
    static member private Distance(a: double[], b: double[]) : double =
        let mutable acc = 0.0
        for d in 0 .. min a.Length b.Length - 1 do
            let diff = a.[d] - b.[d]
            acc <- acc + diff * diff
        sqrt acc

    // ── ITensor (read contract) — delegate to the WeightedSet (semiring-free stored support) ──
    interface ITensor<'K, 'W> with
        member _.StoredCount = (data :> ITensor<'K, 'W>).StoredCount
        member _.IsSparse = true
        member _.StoredEntries = (data :> ITensor<'K, 'W>).StoredEntries

    // ── ISampleable (light) — value at a coordinate, semiring Zero where absent ──
    interface ISampleable<'K, 'W> with
        member _.Sample(at: 'K) : 'W = WeightedSet.weight sr at data

    // ── IIntrospectable — exists + locality-ordered stepping ──
    interface IIntrospectable<'K> with
        member _.Exists(at: 'K) : bool = WeightedSet.weight sr at data <> sr.Zero

        member _.Neighbors(at: 'K) : IEnumerable<'K> =
            let pa = position at
            (data :> ITensor<'K, 'W>).StoredEntries
            |> Seq.map (fun kv -> kv.Key)
            |> Seq.filter (fun k -> k <> at)
            |> Seq.sortBy (fun k -> RayTensor<'K, 'W>.Distance(pa, position k))

    // ── IGeospatial — locality topology (where/when/what-to-attend) ──
    interface IGeospatial<'K> with
        member _.Dimensions = dimensions
        member _.Position(at: 'K) : IReadOnlyList<double> = position at :> IReadOnlyList<double>

        member _.Within(lo: IReadOnlyList<double>, hi: IReadOnlyList<double>) : IEnumerable<'K> =
            (data :> ITensor<'K, 'W>).StoredEntries
            |> Seq.map (fun kv -> kv.Key)
            |> Seq.filter (fun k ->
                let p = position k
                let mutable inside = true
                for d in 0 .. dimensions - 1 do
                    if d < p.Length && d < lo.Count && d < hi.Count then
                        if p.[d] < lo.[d] || p.[d] > hi.[d] then inside <- false
                inside)

    // ── IRayTraceable — cast a ray from any frame, accumulate sampled values along it ──
    interface IRayTraceable<'K, 'W> with
        member _.Trace(_from: IFrame, ray: IReadOnlyList<'K>, accumulate: ISemiring<'W>) : 'W =
            // Skip-empty via sparsity (absent coords sample to Zero and are dropped); combine via the
            // passed accumulate semiring's Add. Deterministic left fold ⇒ replayable ⇒ a proof from a
            // deterministic traveler frame.
            let mutable acc = accumulate.Zero
            for k in ray do
                let v = WeightedSet.weight sr k data
                if v <> sr.Zero then
                    acc <- accumulate.Add(acc, v)
            acc


/// Construction helpers for `RayTensor`.
[<RequireQualifiedAccess>]
module RayTensor =

    /// Wrap an existing `WeightedSet` with a geospatial embedding.
    let create
        (sr: ISemiring<'W>)
        (dimensions: int)
        (position: 'K -> double[])
        (data: WeightedSet.WeightedSet<'K, 'W>)
        : RayTensor<'K, 'W> =
        RayTensor<'K, 'W>(sr, dimensions, position, data)

    /// Build a `RayTensor` from (coordinate, weight) pairs + a geospatial embedding.
    let ofSeq
        (sr: ISemiring<'W>)
        (dimensions: int)
        (position: 'K -> double[])
        (pairs: ('K * 'W) seq)
        : RayTensor<'K, 'W> =
        RayTensor<'K, 'W>(sr, dimensions, position, WeightedSet.ofSeq sr pairs)
