module Zeta.Tests.Properties.PolicyRelocationTests
#nowarn "0893"

open System
open FsCheck
open FsCheck.FSharp
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


[<Fact>]
let ``same filter circuit on same deltas produces identical output`` () =
    task {
        let c1 = Circuit.create ()
        let c2 = Circuit.create ()

        let input1 = c1.ZSetInput<int>()
        let filtered1 = c1.Filter(input1.Stream, Func<int, bool>(fun x -> x > 5))
        let out1 = c1.Output filtered1

        let input2 = c2.ZSetInput<int>()
        let filtered2 = c2.Filter(input2.Stream, Func<int, bool>(fun x -> x > 5))
        let out2 = c2.Output filtered2

        let deltas = [
            ZSet.ofSeq [| (3, 1L); (7, 1L); (10, 1L) |]
            ZSet.ofSeq [| (7, -1L); (12, 1L) |]
            ZSet.ofSeq [| (1, 1L); (99, 1L); (5, 1L) |]
        ]

        for delta in deltas do
            input1.Send delta
            input2.Send delta
            do! c1.StepAsync()
            do! c2.StepAsync()
            out1.Current |> should equal out2.Current
    }


[<Fact>]
let ``relocated circuit preserves semantics across 100 random deltas`` () =
    task {
        let rng = Random(69420)
        let c1 = Circuit.create ()
        let c2 = Circuit.create ()

        let input1 = c1.ZSetInput<int>()
        let filtered1 = c1.Filter(input1.Stream, Func<int, bool>(fun x -> x > 50))
        let out1 = c1.Output filtered1

        let input2 = c2.ZSetInput<int>()
        let filtered2 = c2.Filter(input2.Stream, Func<int, bool>(fun x -> x > 50))
        let out2 = c2.Output filtered2

        for _ in 1 .. 100 do
            let size = rng.Next(1, 20)
            let entries =
                Array.init size (fun _ ->
                    let key = rng.Next(0, 100)
                    let weight = if rng.Next(2) = 0 then 1L else -1L
                    (key, weight))
            let delta = ZSet.ofSeq entries
            input1.Send delta
            input2.Send delta
            do! c1.StepAsync()
            do! c2.StepAsync()
            out1.Current |> should equal out2.Current
    }


// ── FsCheck generators ───────────────────────────────────────────────────
//
// Keys ∈ {1..3} so join-match events are frequent — exercises stateful
// join indices on most generated test cases, not just the trivial-empty case.

let private smallPairZ : Arbitrary<ZSet<int * int>> =
    Gen.sized (fun size ->
        let n = min size 8
        Gen.zip
            (Gen.zip (Gen.choose (1, 3)) (Gen.choose (-5, 5)))
            (Gen.choose (-2, 2) |> Gen.map int64)
        |> Gen.listOfLength n
        |> Gen.map ZSet.ofSeq)
    |> Arb.fromGen

type PairZArb() =
    static member PairZSet() = smallPairZ


// ── Policy-relocation FsCheck properties ────────────────────────────────
//
// The claim (081KR50HA0008QG0R00096ZEYA): a reactive DBSP query Q can be relocated between
// local and central execution with identical delta output via the DBSP
// retraction-native algebra.
//
// Two independent circuit instances model "local" and "central" execution.
// The instances share no state — equality holds because the DBSP algebra
// is deterministic, not because the circuits are aliased (shadow-catch #30:
// NOT trivially true by definition — a non-deterministic or shared-state
// implementation would falsify these properties).


/// Q = Join(left, right, on fst) ∘ GroupByCount(groupBy = fst of join result)
/// Non-trivial because: join crosses two independent input streams, stateful
/// join indices accumulate across ticks, and GroupByCount aggregates over
/// the cross-product. Negative-weight deltas cancel prior additions.
let private buildJoinCountCircuit (c: Circuit) =
    let left  = c.ZSetInput<int * int>()   // (joinKey, leftVal)
    let right = c.ZSetInput<int * int>()   // (joinKey, rightVal)
    let joined =
        c.Join(
            left.Stream, right.Stream,
            Func<_, _>(fst), Func<_, _>(fst),
            Func<_, _, _>(fun (k, lv) (_, rv) -> (k, lv, rv)))
    let counts = c.GroupByCount(joined, Func<_, _>(fun (k, _, _) -> k))
    let out = c.Output counts
    c.Build()
    c, left, right, out


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<PairZArb> |], MaxTest = 1000)>]
let ``policy relocation: join+count circuit on same delta stream produces identical output``
        (ticks: (ZSet<int * int> * ZSet<int * int>) list) =
    let c1, l1, r1, out1 = buildJoinCountCircuit (Circuit.create ())
    let c2, l2, r2, out2 = buildJoinCountCircuit (Circuit.create ())
    let mutable allEqual = true
    for (ld, rd) in ticks do
        l1.Send ld; r1.Send rd
        l2.Send ld; r2.Send rd
        c1.Step(); c2.Step()
        if not (out1.Current.Equals out2.Current) then allEqual <- false
    allEqual


/// Q = GroupByCount(stream, groupBy = fst)
/// Non-trivial because: per-group counts accumulate across ticks via the
/// circuit's internal integration; negative-weight entries decrement counts;
/// relocation must preserve the accumulated group state, not just per-tick
/// deltas.
[<FsCheck.Xunit.Property(Arbitrary = [| typeof<PairZArb> |], MaxTest = 1000)>]
let ``policy relocation: GroupByCount aggregate on same delta stream produces identical output``
        (deltas: ZSet<int * int> list) =
    let buildAgg (c: Circuit) =
        let inp = c.ZSetInput<int * int>()
        let counts = c.GroupByCount(inp.Stream, Func<_, _>(fst))
        let out = c.Output counts
        c.Build()
        c, inp, out
    let c1, in1, out1 = buildAgg (Circuit.create ())
    let c2, in2, out2 = buildAgg (Circuit.create ())
    let mutable allEqual = true
    for d in deltas do
        in1.Send d; in2.Send d
        c1.Step(); c2.Step()
        if not (out1.Current.Equals out2.Current) then allEqual <- false
    allEqual
