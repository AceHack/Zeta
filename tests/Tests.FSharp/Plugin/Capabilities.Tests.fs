module Zeta.Tests.Plugin.CapabilitiesTests

/// Tests for the algebra-capability tags lifted from plugin-only
/// marker interfaces (`ILinearOperator` etc. in `PluginApi.fs`) onto
/// the `Op` base class in `Circuit.fs`. Three coverage axes:
///
///   1. Internal operators (registered via `Circuit.Map` /
///      `Circuit.Join` / ...) declare the correct capability via
///      direct override on the concrete `Op<'T>` subclass.
///   2. Plugin operators (registered via the `IOperator<'T>`
///      extension) have their capability detected through the
///      non-generic markers (`ILinearMarker`, `IBilinearMarker`,
///      `ISinkMarker`, `IStatefulStrictMarker`) — the runtime
///      `:?` test works because the typed interfaces inherit from
///      the markers.
///   3. Defaults are false — operators that don't override and don't
///      implement any algebra marker report all four capabilities as
///      false (the conservative null hypothesis).

open System
open System.Threading
open System.Threading.Tasks
open Xunit
open FsUnit.Xunit
open Zeta.Core


// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────

/// Find the first operator with a given `Name` in the circuit's
/// registered op set. Internal-op names are stable strings ("map",
/// "filter", "join", etc.) declared on each subclass.
let private opByName (circuit: Circuit) (name: string) : Op =
    circuit.Ops
    |> Seq.find (fun op -> op.Name = name)


// ─────────────────────────────────────────────────────────────────
//  Internal-operator capability tests
//
//  Each test wires a minimal one-or-two-op circuit, then asserts the
//  capability flags on the named operator. Build the circuit but
//  do NOT step — we only inspect the registered metadata.
// ─────────────────────────────────────────────────────────────────

[<Fact>]
let ``MapZSetOp declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ = c.Map(input.Stream, Func<int, int>(fun x -> x * 2))
    c.Build()
    let op = opByName c "map"
    op.IsLinear |> should equal true
    op.IsBilinear |> should equal false
    op.IsSink |> should equal false
    op.IsStatefulStrict |> should equal false


[<Fact>]
let ``FilterZSetOp declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ = c.Filter(input.Stream, Func<int, bool>(fun x -> x > 0))
    c.Build()
    (opByName c "filter").IsLinear |> should equal true


[<Fact>]
let ``FlatMapZSetOp declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ = c.FlatMap(input.Stream, Func<int, ZSet<int>>(fun x -> ZSet.singleton x 1L))
    c.Build()
    (opByName c "flatMap").IsLinear |> should equal true


[<Fact>]
let ``NegZSetOp declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ = c.Negate input.Stream
    c.Build()
    (opByName c "neg").IsLinear |> should equal true


[<Fact>]
let ``PlusZSetOp declares no algebra capability (additive, not unary-linear)`` () =
    let c = Circuit()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<int>()
    let _ = c.Plus(a.Stream, b.Stream)
    c.Build()
    let op = opByName c "plus"
    // Plus is a 2-input additive op: Plus(0, b) = b ≠ 0, so it's
    // neither unary-linear nor bilinear under the strict definitions.
    // A future capability `IsAdditive` could capture the per-input
    // distribution property; for now Plus reports all caps false.
    op.IsLinear |> should equal false
    op.IsBilinear |> should equal false


[<Fact>]
let ``MinusZSetOp declares no algebra capability (same reason as Plus)`` () =
    let c = Circuit()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<int>()
    let _ = c.Minus(a.Stream, b.Stream)
    c.Build()
    let op = opByName c "minus"
    op.IsLinear |> should equal false
    op.IsBilinear |> should equal false


[<Fact>]
let ``DistinctZSetOp does NOT declare IsLinear (clamps weights)`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ = c.Distinct input.Stream
    c.Build()
    let op = opByName c "distinct"
    // distinct(a + b) ≠ distinct(a) + distinct(b) when both share
    // a positive-weighted key — distinct clamps to {0, 1}.
    op.IsLinear |> should equal false
    op.IsBilinear |> should equal false


[<Fact>]
let ``JoinZSetOp declares IsBilinear`` () =
    let c = Circuit()
    let a = c.ZSetInput<int * string>()
    let b = c.ZSetInput<int * int>()
    let _ =
        c.Join(
            a.Stream, b.Stream,
            Func<int * string, int>(fst),
            Func<int * int, int>(fst),
            Func<int * string, int * int, string>(fun (_, s) (_, n) -> $"%s{s}-%d{n}"))
    c.Build()
    let op = opByName c "join"
    op.IsLinear |> should equal false
    op.IsBilinear |> should equal true


[<Fact>]
let ``CartesianZSetOp declares IsBilinear`` () =
    let c = Circuit()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<string>()
    let _ = c.Cartesian(a.Stream, b.Stream)
    c.Build()
    (opByName c "cartesian").IsBilinear |> should equal true


[<Fact>]
let ``IndexWithOp declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int * string>()
    let _ =
        c.IndexWith(
            input.Stream,
            Func<int * string, int>(fst),
            Func<int * string, string>(snd))
    c.Build()
    (opByName c "indexWith").IsLinear |> should equal true


[<Fact>]
let ``IndexedJoinOp declares IsBilinear`` () =
    let c = Circuit()
    let a = c.ZSetInput<int * string>()
    let b = c.ZSetInput<int * int>()
    let ia =
        c.IndexWith(
            a.Stream, Func<int * string, int>(fst), Func<int * string, string>(snd))
    let ib =
        c.IndexWith(
            b.Stream, Func<int * int, int>(fst), Func<int * int, int>(snd))
    let _ =
        c.IndexedJoin(
            ia, ib,
            Func<int, string, int, string>(fun _ s n -> $"%s{s}-%d{n}"))
    c.Build()
    (opByName c "indexedJoin").IsBilinear |> should equal true


[<Fact>]
let ``DelayOp declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ = c.DelayZSet input.Stream
    c.Build()
    let op = opByName c "z^-1"
    op.IsLinear |> should equal true
    // z⁻¹ is also strict — preserved unchanged from before.
    op.IsStrict |> should equal true


[<Fact>]
let ``IntegrateOp declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ = c.IntegrateZSet input.Stream
    c.Build()
    (opByName c "integrate").IsLinear |> should equal true


[<Fact>]
let ``DifferentiateOp declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ = c.DifferentiateZSet input.Stream
    c.Build()
    (opByName c "differentiate").IsLinear |> should equal true


[<Fact>]
let ``ConstantOp does NOT declare IsLinear (affine, not linear)`` () =
    let c = Circuit()
    let _ = c.Constant 42
    c.Build()
    // const_c(0) = c ≠ 0 (unless c = 0), so Constant is affine
    // in general — not linear. We default to false.
    (opByName c "const").IsLinear |> should equal false


[<Fact>]
let ``FilterMapOp (fused) declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ =
        c.FilterMap(
            input.Stream,
            Func<int, bool>(fun x -> x > 0),
            Func<int, int>(fun x -> x * 2))
    c.Build()
    (opByName c "filterMap").IsLinear |> should equal true


// ─────────────────────────────────────────────────────────────────
//  Plugin-marker detection tests
//
//  These exercise the non-generic-marker pattern: a plugin that
//  implements `ILinearOperator<'A, 'B>` automatically satisfies
//  `ILinearMarker` via interface inheritance, and the
//  `PluginOperatorAdapter` constructor caches a `:? ILinearMarker`
//  test result that's then surfaced via `Op.IsLinear`.
//
//  Critical: we test the GENERIC interface implementation, not the
//  marker directly. If the inheritance chain is broken, the runtime
//  `:?` test returns false even though the typed interface is
//  declared — that's the bug class this layer is preventing.
// ─────────────────────────────────────────────────────────────────

/// Plugin that implements `ILinearOperator<int, int>` — the adapter
/// should detect `ILinearMarker` and surface `IsLinear = true`.
type private LinearPluginOp(input: Stream<int>) =
    let deps = [| input.AsDependency() |]
    interface ILinearOperator<int, int> with
        member _.Name = "test-linear"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish (input.Current * 3)
            ValueTask.CompletedTask


/// Plugin that implements `IBilinearOperator<int, int, int>` —
/// adapter should detect `IBilinearMarker`. Uses a single input for
/// test simplicity; bilinearity is declarative here, not exercised.
type private BilinearPluginOp(input: Stream<int>) =
    let deps = [| input.AsDependency() |]
    interface IBilinearOperator<int, int, int> with
        member _.Name = "test-bilinear"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish input.Current
            ValueTask.CompletedTask


/// Plugin that implements `ISinkOperator<int, int>` — adapter
/// should detect `ISinkMarker`.
type private SinkPluginOp(input: Stream<int>) =
    let deps = [| input.AsDependency() |]
    interface ISinkOperator<int, int> with
        member _.Name = "test-sink"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish input.Current
            ValueTask.CompletedTask


/// Plugin that implements `IStatefulStrictOperator<int, unit, int>` —
/// adapter should detect `IStatefulStrictMarker`.
type private StatefulStrictPluginOp(input: Stream<int>) =
    let deps = [| input.AsDependency() |]
    interface IStatefulStrictOperator<int, unit, int> with
        member _.Name = "test-stateful-strict"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish input.Current
            ValueTask.CompletedTask


/// Plugin that implements ONLY `IOperator<int>` — no algebra
/// marker. All four capabilities must report false.
type private PlainPluginOp(input: Stream<int>) =
    let deps = [| input.AsDependency() |]
    interface IOperator<int> with
        member _.Name = "test-plain"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish input.Current
            ValueTask.CompletedTask


[<Fact>]
let ``Plugin ILinearOperator → adapter reports IsLinear = true`` () =
    let c = Circuit()
    let input = c.Constant 0
    let _ = c.RegisterStream (LinearPluginOp input :> IOperator<int>)
    c.Build()
    let op = opByName c "test-linear"
    op.IsLinear |> should equal true
    op.IsBilinear |> should equal false
    op.IsSink |> should equal false
    op.IsStatefulStrict |> should equal false


[<Fact>]
let ``Plugin IBilinearOperator → adapter reports IsBilinear = true`` () =
    let c = Circuit()
    let input = c.Constant 0
    let _ = c.RegisterStream (BilinearPluginOp input :> IOperator<int>)
    c.Build()
    let op = opByName c "test-bilinear"
    op.IsLinear |> should equal false
    op.IsBilinear |> should equal true
    op.IsSink |> should equal false
    op.IsStatefulStrict |> should equal false


[<Fact>]
let ``Plugin ISinkOperator → adapter reports IsSink = true`` () =
    let c = Circuit()
    let input = c.Constant 0
    let _ = c.RegisterStream (SinkPluginOp input :> IOperator<int>)
    c.Build()
    let op = opByName c "test-sink"
    op.IsLinear |> should equal false
    op.IsBilinear |> should equal false
    op.IsSink |> should equal true
    op.IsStatefulStrict |> should equal false


[<Fact>]
let ``Plugin IStatefulStrictOperator → adapter reports IsStatefulStrict = true`` () =
    let c = Circuit()
    let input = c.Constant 0
    let _ = c.RegisterStream (StatefulStrictPluginOp input :> IOperator<int>)
    c.Build()
    let op = opByName c "test-stateful-strict"
    op.IsStatefulStrict |> should equal true


[<Fact>]
let ``Plain IOperator plugin → adapter reports all algebra caps false`` () =
    let c = Circuit()
    let input = c.Constant 0
    let _ = c.RegisterStream (PlainPluginOp input :> IOperator<int>)
    c.Build()
    let op = opByName c "test-plain"
    op.IsLinear |> should equal false
    op.IsBilinear |> should equal false
    op.IsSink |> should equal false
    op.IsStatefulStrict |> should equal false


// ─────────────────────────────────────────────────────────────────
//  BayesianRateOp end-to-end — the canonical real-world sink
//
//  This test verifies that the ISinkMarker inheritance correctly
//  surfaces through Zeta.Bayesian's `BayesianRateOp`. We can't
//  exercise it directly here (Zeta.Bayesian isn't a test-project
//  reference and shouldn't be — that'd be a circular-shape
//  test), so we rely on the SinkPluginOp above as the structural
//  proof. Adding Zeta.Bayesian to this project's references is
//  out of scope for PR 1.
// ─────────────────────────────────────────────────────────────────
