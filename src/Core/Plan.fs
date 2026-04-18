namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Text


/// Query plan metadata — per-operator cost estimates derived from
/// static-heuristic cardinality estimates (filter halves, group-by
/// quarters, 1024 for unknown inputs). Used by `Circuit.Explain()` to
/// produce a cost-annotated plan tree; could feed a future cost-based
/// optimiser. A future revision will wire `Sketch.fs` HLL for real
/// estimates — tracked in `docs/BACKLOG.md` as query-planner P1.
[<Struct>]
type OpCost = {
    EstimatedRows: int64
    EstimatedCpuNanos: int64
}


/// Simple analytic cost model — propagate input cardinalities through
/// operators using DBSP-paper-motivated selectivity heuristics.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Plan =

    /// Rough cardinality propagation for each operator kind, keyed on its
    /// `Name`. Returns `EstimatedRows` as an int64; assumes per-row CPU
    /// cost of 40 ns (order-of-magnitude for a span-indexed primitive).
    let private estimate (opName: string) (inputRows: int64 array) : OpCost =
        let rows =
            match opName, inputRows with
            | "input", _ -> 1024L                        // unknown source
            | "map", [| n |]            -> n             // linear
            | "filter", [| n |]         -> n / 2L        // assume 50% selectivity
            | "flatMap", [| n |]        -> n * 2L        // assume fan-out = 2
            | "plus", [| a ; b |]       -> a + b
            | "minus", [| a ; b |]      -> a + b
            | "neg", [| n |]            -> n
            | "distinct", [| n |]       -> n / 2L        // assume 50% duplicates
            | "join", [| a ; b |]       -> (a * b) / max 1L (max a b)  // primary-key assumption
            | "cartesian", [| a ; b |]  -> a * b
            | "indexedJoin", [| a ; b |]    -> (a * b) / max 1L (max a b)
            | "indexWith", [| n |]      -> n
            | "groupBySum", [| n |]     -> n / 4L        // assume avg group-by fan-in = 4
            | "count", [| n |]          -> n / 4L
            | "average", [| n |]        -> n / 4L
            | "integrate", [| n |]      -> n * 2L        // running accumulation
            | "differentiate", [| n |]  -> n
            | "z^-1", [| n |]           -> n
            | _, inputs                 -> if inputs.Length > 0 then inputs.[0] else 1024L
        { EstimatedRows = max 1L rows
          EstimatedCpuNanos = max 40L rows * 40L }

    /// Compute plan costs for every operator in the circuit via a single
    /// topo walk.
    let compute (circuit: Circuit) : Dictionary<int, OpCost> =
        circuit.Build()
        let costs = Dictionary<int, OpCost>()
        for op in circuit.Ops do
            let inputs =
                op.Inputs |> Array.map (fun d ->
                    match costs.TryGetValue d.Id with
                    | true, c -> c.EstimatedRows
                    | _ -> 1024L)
            costs.[op.Id] <- estimate op.Name inputs
        costs


[<Extension>]
type PlanExtensions =

    /// Human-readable explain plan with per-operator cost estimates.
    /// Format mirrors `EXPLAIN` output: each line is `id: name (rows≈N, ns≈M) [inputs]`.
    [<Extension>]
    static member Explain(this: Circuit) : string =
        let costs = Plan.compute this
        let sb = StringBuilder()
        sb.AppendLine $"Circuit (%d{this.OperatorCount} operators):" |> ignore
        for op in this.Ops do
            let cost = costs.[op.Id]
            let depIds =
                op.Inputs
                |> Array.map (fun d -> (d.Id: int).ToString())
                |> String.concat ","
            let deps =
                if String.IsNullOrEmpty depIds then "source"
                else $"[%s{depIds}]"
            let strict = if op.IsStrict then " *strict*" else ""
            sb.AppendLine $"  %d{op.Id}: %s{op.Name}%s{strict} (rows≈%d{cost.EstimatedRows}, ns≈%d{cost.EstimatedCpuNanos}) %s{deps}" |> ignore
        sb.ToString()

    /// Per-operator cost map (for programmatic use).
    [<Extension>]
    static member Costs(this: Circuit) : IReadOnlyDictionary<int, OpCost> =
        Plan.compute this :> IReadOnlyDictionary<int, OpCost>
