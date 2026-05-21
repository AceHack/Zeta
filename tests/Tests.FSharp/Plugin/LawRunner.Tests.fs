module Zeta.Tests.Plugin.LawRunnerTests

open System.Collections.Generic
open System.Threading.Tasks
open Xunit
open FsUnit.Xunit
open Zeta.Core


// ────────────────────────────────────────────────────────────────
// Linearity fixtures
// ────────────────────────────────────────────────────────────────

/// Linear plugin — doubling is linear over integers.
type private DoublerOp(input: Stream<int>) =
    let deps = [| input.AsDependency() |]
    interface ILinearOperator<int, int> with
        member _.Name = "doubler"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish (input.Current * 2)
            ValueTask.CompletedTask


/// **Not** linear — squaring breaks `op(a+b) = op(a)+op(b)`.
/// Falsely tagged `ILinearOperator` so the law runner catches
/// the lie.
type private SquarerOp(input: Stream<int>) =
    let deps = [| input.AsDependency() |]
    interface ILinearOperator<int, int> with
        member _.Name = "squarer-liar"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            let v = input.Current
            out.Publish (v * v)
            ValueTask.CompletedTask


// ────────────────────────────────────────────────────────────────
// Retraction-completeness fixtures
//
// The law checks state restoration: after forward+retract
// cancel, continuation outputs must match a fresh-op run of
// the same continuation. Catches stateful ops that survive
// what was supposed to be a full cancel.
// ────────────────────────────────────────────────────────────────

/// Stateless echo — trivially passes state restoration
/// because it has no state. Keeps a baseline for the law on
/// clean ops.
type private ZSetEchoOp(input: Stream<ZSet<int>>) =
    let deps = [| input.AsDependency() |]
    interface IStatefulStrictOperator<ZSet<int>, unit, ZSet<int>> with
        member _.Name = "zset-echo"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish input.Current
            ValueTask.CompletedTask


/// Genuinely stateful *and* retraction-lossy — a floored per-
/// key counter. Accumulates weights but refuses to go below
/// zero; a `-1` on a key at count 0 is silently dropped. Under
/// forward+retract the dropped decrements leave residual
/// positive state that survives the cancel, so any continuation
/// input sees the leaked state and diverges from a fresh op.
/// Falsely tagged `IStatefulStrictOperator` so the law catches
/// it.
type private FlooredCounterOp(input: Stream<ZSet<int>>) =
    let deps = [| input.AsDependency() |]
    let state = Dictionary<int, int64>()
    interface IStatefulStrictOperator<ZSet<int>, Dictionary<int, int64>, ZSet<int>> with
        member _.Name = "floored-counter-liar"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            let delta = ResizeArray<int * int64>()
            let span = input.Current.AsSpan()
            for i in 0 .. span.Length - 1 do
                let k = span.[i].Key
                let w = span.[i].Weight
                let current =
                    match state.TryGetValue k with
                    | true, v -> v
                    | _ -> 0L
                let proposed = current + w
                let applied = if proposed < 0L then 0L else proposed
                let emitted = applied - current
                if applied = 0L then state.Remove k |> ignore
                else state.[k] <- applied
                if emitted <> 0L then delta.Add (k, emitted)
            out.Publish (ZSet.ofSeq delta)
            ValueTask.CompletedTask


// ────────────────────────────────────────────────────────────────
// Generators
// ────────────────────────────────────────────────────────────────

let private genInt (rng: System.Random) : int = rng.Next(-100, 101)

let private genZSet (rng: System.Random) : ZSet<int> =
    let n = rng.Next(0, 4)
    [ for _ in 1 .. n ->
        let k = rng.Next(0, 5)
        // Exclude zero weight so both polarities are represented
        // without burning a generator draw on a no-op.
        let mutable w = rng.Next(-3, 4)
        if w = 0 then w <- 1
        (k, int64 w) ]
    |> ZSet.ofSeq


// ────────────────────────────────────────────────────────────────
// Linearity
// ────────────────────────────────────────────────────────────────

[<Fact>]
let ``checkLinear passes on a genuine linear op`` () =
    let result =
        LawRunner.checkLinear
            42 20 8
            (fun s -> DoublerOp s :> IOperator<int>)
            genInt (+) (+) (=)
    match result with
    | Ok () -> ()
    | Error v -> Assert.Fail (sprintf "expected Ok, got %A" v)


[<Fact>]
let ``checkLinear catches a falsely-tagged non-linear op`` () =
    let result =
        LawRunner.checkLinear
            42 20 8
            (fun s -> SquarerOp s :> IOperator<int>)
            genInt (+) (+) (=)
    match result with
    | Ok () -> Assert.Fail "expected linearity violation"
    | Error v ->
        v.Seed |> should equal 42
        v.Message |> should haveSubstring "Linearity broke"


[<Fact>]
let ``checkLinear reproduces bit-exact on the same seed`` () =
    let run () =
        LawRunner.checkLinear 99 10 5
            (fun s -> SquarerOp s :> IOperator<int>)
            genInt (+) (+) (=)
    let first = run ()
    let second = run ()
    first |> should equal second


[<Fact>]
let ``checkLinear returns Error on bad samples arg`` () =
    let result =
        LawRunner.checkLinear 0 0 1
            (fun s -> DoublerOp s :> IOperator<int>)
            genInt (+) (+) (=)
    match result with
    | Ok () -> Assert.Fail "expected bad-args Error"
    | Error v -> v.Message |> should haveSubstring "samples"


// ────────────────────────────────────────────────────────────────
// Retraction completeness
// ────────────────────────────────────────────────────────────────

[<Fact>]
let ``checkRetractionCompleteness passes on a stateless echo`` () =
    let result =
        LawRunner.checkRetractionCompleteness
            7 15 6 4
            (fun s -> ZSetEchoOp s :> IOperator<ZSet<int>>)
            genZSet
    match result with
    | Ok () -> ()
    | Error v -> Assert.Fail (sprintf "expected Ok, got %A" v)


[<Fact>]
let ``checkRetractionCompleteness catches a stateful retraction-lossy op`` () =
    let result =
        LawRunner.checkRetractionCompleteness
            7 15 6 4
            (fun s -> FlooredCounterOp s :> IOperator<ZSet<int>>)
            genZSet
    match result with
    | Ok () -> Assert.Fail "expected retraction-completeness violation"
    | Error v ->
        v.Seed |> should equal 7
        v.Message |> should haveSubstring "Retraction incomplete"


[<Fact>]
let ``checkRetractionCompleteness reproduces bit-exact on the same seed`` () =
    let run () =
        LawRunner.checkRetractionCompleteness 13 8 5 3
            (fun s -> FlooredCounterOp s :> IOperator<ZSet<int>>)
            genZSet
    let first = run ()
    let second = run ()
    first |> should equal second


// ────────────────────────────────────────────────────────────────
// Bilinearity fixtures
//
// `checkBilinear` exercises three sub-properties:
//   L1 — op(a₁+a₂, b) ≡ op(a₁, b) + op(a₂, b)   (left-linearity)
//   L2 — op(a, b₁+b₂) ≡ op(a, b₁) + op(a, b₂)   (right-linearity)
//   L3 — op(-a, b) ≡ -op(a, b)                   (sign-distribution)
//
// **Math note for these fixtures.** Over the abelian-group output
// types used here (`int` with standard `(+)`), L1 + L2 *imply* L3 —
// any algebraic failure that violates L3 also violates L1 first
// (the affine-offset case below illustrates this). So the L1 and L2
// fixtures below cover both linearity failure modes and most
// classical bilinearity failures; L3 is the cleanup law that
// becomes load-bearing only when the caller supplies a non-abelian-
// group `(addOut, negOut)` pair — outside the scope of these
// fixtures. See `LawRunner.checkBilinear` docstring for the full
// math note.
// ────────────────────────────────────────────────────────────────

/// Genuine bilinear: integer multiplication. Satisfies L1, L2,
/// and L3 over the integer ring (with `op(0, b) = 0`).
type private BilinearMultOp(a: Stream<int>, b: Stream<int>) =
    let deps = [| a.AsDependency(); b.AsDependency() |]
    interface IBilinearOperator<int, int, int> with
        member _.Name = "bilinear-mult"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish (a.Current * b.Current)
            ValueTask.CompletedTask


/// **L1 liar** — adds the inputs before multiplying. Fails left-
/// linearity for any nonzero `b`:
///   op(a₁+a₂, b) = (a₁+a₂+b)*2
///   op(a₁, b)+op(a₂, b) = 2(a₁+b)+2(a₂+b) = 2a₁+2a₂+4b
/// Falsely tagged `IBilinearOperator` so the law catches the lie.
type private LinearOffsetLiar(a: Stream<int>, b: Stream<int>) =
    let deps = [| a.AsDependency(); b.AsDependency() |]
    interface IBilinearOperator<int, int, int> with
        member _.Name = "linear-offset-liar"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish ((a.Current + b.Current) * 2)
            ValueTask.CompletedTask


/// **Affine offset liar** — `op(a, b) = a*b + 7`. The constant
/// offset breaks bilinearity in *multiple* ways; over the integer
/// abelian group L1 fails first (the constant lands once on LHS:
/// `(a₁+a₂)*b + 7`, twice on RHS: `(a₁*b + 7) + (a₂*b + 7)`, so
/// the difference is `7`, never equal). L3 would also fail
/// independently (`op(-a, b) = -a*b + 7` vs `-op(a, b) = -a*b - 7`)
/// but in the check ordering L1 trips first. The fixture catches
/// the additive-offset failure mode regardless of which sub-law
/// fires first; the test below documents which one fires for `int`.
type private AffineBilinearLiar(a: Stream<int>, b: Stream<int>) =
    let deps = [| a.AsDependency(); b.AsDependency() |]
    interface IBilinearOperator<int, int, int> with
        member _.Name = "affine-bilinear-liar"
        member _.ReadDependencies = deps
        member _.StepAsync(out, _ct) =
            out.Publish (a.Current * b.Current + 7)
            ValueTask.CompletedTask


// ────────────────────────────────────────────────────────────────
// Bilinearity tests
// ────────────────────────────────────────────────────────────────

[<Fact>]
let ``checkBilinear passes on a genuine bilinear op (integer multiplication)`` () =
    let result =
        LawRunner.checkBilinear
            42 20 8
            (fun a b -> BilinearMultOp(a, b) :> IOperator<int>)
            genInt genInt
            (+) (~-)
            (+)
            (+) (~-) (=)
    match result with
    | Ok () -> ()
    | Error v -> Assert.Fail (sprintf "expected Ok, got %A" v)


[<Fact>]
let ``checkBilinear catches an L1 (left-linearity) violation`` () =
    let result =
        LawRunner.checkBilinear
            42 20 8
            (fun a b -> LinearOffsetLiar(a, b) :> IOperator<int>)
            genInt genInt
            (+) (~-)
            (+)
            (+) (~-) (=)
    match result with
    | Ok () -> Assert.Fail "expected L1 violation"
    | Error v ->
        v.Seed |> should equal 42
        // The first failing law per sample wins — for LinearOffsetLiar
        // the L1 case fires before L2 or L3 are checked.
        v.Message |> should haveSubstring "Left-linearity"


[<Fact>]
let ``checkBilinear catches the affine-offset liar (additive constant breaks bilinearity)`` () =
    let result =
        LawRunner.checkBilinear
            42 20 8
            (fun a b -> AffineBilinearLiar(a, b) :> IOperator<int>)
            genInt genInt
            (+) (~-)
            (+)
            (+) (~-) (=)
    match result with
    | Ok () -> Assert.Fail "expected bilinearity violation"
    | Error v ->
        v.Seed |> should equal 42
        // Math note: over an abelian group (the integer case here),
        // L1 + L2 jointly *imply* L3 — the additive offset that
        // breaks `op(0, b) = 0` also breaks `op(a₁+a₂, b) = op(a₁,
        // b) + op(a₂, b)` because the constant is added once on the
        // LHS and twice on the RHS. So the affine liar trips L1
        // first; L3 is the cleanup law for pathological cases where
        // the user supplies a non-group addOut/negOut pair.
        // L1 fires first per the check ordering in checkBilinear.
        v.Message |> should haveSubstring "Left-linearity"


[<Fact>]
let ``checkBilinear reproduces bit-exact on the same seed`` () =
    let run () =
        LawRunner.checkBilinear 99 10 5
            (fun a b -> AffineBilinearLiar(a, b) :> IOperator<int>)
            genInt genInt
            (+) (~-)
            (+)
            (+) (~-) (=)
    let first = run ()
    let second = run ()
    first |> should equal second


[<Fact>]
let ``checkBilinear returns Error on bad samples arg`` () =
    let result =
        LawRunner.checkBilinear 0 0 1
            (fun a b -> BilinearMultOp(a, b) :> IOperator<int>)
            genInt genInt
            (+) (~-)
            (+)
            (+) (~-) (=)
    match result with
    | Ok () -> Assert.Fail "expected bad-args Error"
    | Error v -> v.Message |> should haveSubstring "samples"


[<Fact>]
let ``checkBilinear returns Error on bad scheduleLength arg`` () =
    let result =
        LawRunner.checkBilinear 0 1 0
            (fun a b -> BilinearMultOp(a, b) :> IOperator<int>)
            genInt genInt
            (+) (~-)
            (+)
            (+) (~-) (=)
    match result with
    | Ok () -> Assert.Fail "expected bad-args Error"
    | Error v -> v.Message |> should haveSubstring "scheduleLength"


// ────────────────────────────────────────────────────────────────
// PluginHarness.runTwoInputs tests
// ────────────────────────────────────────────────────────────────

[<Fact>]
let ``runTwoInputs drives a two-input plugin in lock-step`` () =
    let outputs =
        PluginHarness.runTwoInputs
            (fun a b -> BilinearMultOp(a, b) :> IOperator<int>)
            [ 1; 2; 3; 10 ]
            [ 5; 5; 5; 100 ]
    outputs |> should equal [ 5; 10; 15; 1000 ]


[<Fact>]
let ``runTwoInputs truncates to the shorter input sequence`` () =
    let outputs =
        PluginHarness.runTwoInputs
            (fun a b -> BilinearMultOp(a, b) :> IOperator<int>)
            [ 1; 2; 3; 4; 5 ]
            [ 10; 20 ]
    outputs |> should equal [ 10; 40 ]
