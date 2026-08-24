module Zeta.Tests.Properties.PolicyRelocationTests
#nowarn "0893"

open System
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
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


// ── identity-query relocation, stated over a PAIR of executions ──────────────────────────────────
//
// MOVED HERE 2026-08-23 (Soraya), workitem 081M0RAX8AC087G0R003NQM7P9, from
// `tests/Tests.FSharp/Properties/Policy.Relocation.Tests.fs` — which was DELETED in the same commit
// for two independent reasons, and the second one is the worse:
//
//   1. Its single property read
//          let localResult = delta          // "Local execution" of identity query on delta
//          let centralResult = delta        // "Central execution" + reintegration via same algebra
//          localResult = centralResult
//      Both names were bound to the SAME value. It compared `delta` to itself and could not fail for
//      any implementation of anything. A `X = X` grep never sees it: the self-comparison is
//      NAME-BOUND, which is exactly the form that survives a syntactic sweep.
//
//   2. THE FILE WAS NEVER IN `Tests.FSharp.fsproj`. Added by #2329 and never compiled since, so its
//      header claim "1000+ inputs via FsCheck default" was not weakly true — it was zero runs. An
//      uncompiled test file is a check of arity ZERO wearing a coverage number.
//
// What is kept is the claim, now made over two executions. CENTRAL folds every row in one location.
// LOCAL splits the same rows at a generated cut, folds each site independently, and reintegrates
// with `ZSet.add`. Their equality IS the statement that `ZSet.ofSeq` is a monoid homomorphism from
// list concatenation to `ZSet.add` — what identity-query relocation rests on, and what
// 081KT07NV0008QG0R001YDB73K broke once already (a collation mismatch inside consolidation made the
// fold non-associative on special keys).

[<Property(MaxTest = 1000)>]
let ``identity policy relocation preserves DBSP delta semantics`` (pairs: (int * int64) list) (cut: int) =
    let clamp w =
        if w > 1000000L then 1000000L
        elif w < -1000000L then -1000000L
        else w

    let rows = pairs |> List.map (fun (k, w) -> (k, clamp w))
    // CENTRAL: one location sees every row.
    let central = ZSet.ofSeq rows
    // LOCAL: the same rows relocated across two sites at an arbitrary cut, each site folding only
    // what it holds, then reintegrated by the algebra itself.
    let at = if List.isEmpty rows then 0 else abs (cut % (List.length rows + 1))
    let here, there = List.splitAt at rows
    let local = ZSet.add (ZSet.ofSeq here) (ZSet.ofSeq there)
    local = central
