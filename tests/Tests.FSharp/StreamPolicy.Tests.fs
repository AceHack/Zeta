module Zeta.Tests.StreamPolicyTests

open System
open System.Reactive.Linq
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// StreamPolicy — the νF (stream/traveler) interpreter of the policy
// kernel (081KT7YW00008QG0R003N6PF8A #2). The SAME `Policy` value, interpreted over an Rx
// push-stream (νF) instead of the finite DynamicValue tree (μF).
//
// Determinism: every source is a finite array turned into an observable
// (`ToObservable`), and results are collected synchronously via
// `Observable.ToEnumerable |> List.ofSeq`. No TestScheduler needed for
// finite, eager sources.
// ═══════════════════════════════════════════════════════════════════

/// A simple shared policy: positive ints accept, others reject — used to
/// demonstrate the interpret-twice faithfulness.
let private posPolicy : Policy.Policy<int, bool, string> =
    Policy.ofPredicate (fun n -> n > 0) (true, "pos") (false, "non-pos")

let private obsOf (xs: 'a array) : IObservable<'a> = xs.ToObservable()

let private collect (obs: IObservable<'a>) : 'a list =
    Observable.ToEnumerable obs |> List.ofSeq

[<Fact>]
let ``applyPolicy pairs each element with the correct decision + feedback`` () =
    let src = obsOf [| 3; -1; 0; 7 |]
    let got = StreamPolicy.applyPolicy posPolicy src |> collect
    let expected =
        [ 3, Policy.result true "pos"
          -1, Policy.result false "non-pos"
          0, Policy.result false "non-pos"
          7, Policy.result true "pos" ]
    Assert.Equal<(int * Policy.PolicyResult<bool, string>) list>(expected, got)

[<Fact>]
let ``interpret-twice: the νF stream interpreter is faithful to the direct kernel`` () =
    // The SAME Policy value, applied element-wise over a stream, yields the
    // same per-element decisions it would yield called directly (μF/direct).
    let inputs = [| -5; 0; 1; 2; -3; 42 |]
    let direct = inputs |> Array.map posPolicy |> Array.toList
    let viaStream = StreamPolicy.decisions posPolicy (obsOf inputs) |> collect
    Assert.Equal<Policy.PolicyResult<bool, string> list>(direct, viaStream)

[<Fact>]
let ``partition splits accepted / rejected by the boolean decision`` () =
    let src = obsOf [| 3; -1; 0; 7; -2 |]
    let accepted, rejected = StreamPolicy.partition posPolicy src
    Assert.Equal<int list>([ 3; 7 ], collect accepted)
    Assert.Equal<int list>([ -1; 0; -2 ], collect rejected)

[<Fact>]
let ``route filters elements whose decision maps to the target key`` () =
    // key = the decision itself (bool); route the rejects to a dead-letter.
    let src = obsOf [| 3; -1; 0; 7; -2 |]
    let deadLetter = StreamPolicy.route id posPolicy false src
    Assert.Equal<int list>([ -1; 0; -2 ], collect deadLetter)
    let live = StreamPolicy.route id posPolicy true src
    Assert.Equal<int list>([ 3; 7 ], collect live)

[<Fact>]
let ``route with a mapping key filters correctly`` () =
    // Map the bool decision to a string lane, then route by lane.
    let key b = if b then "live" else "dead"
    let src = obsOf [| 1; -1; 2 |]
    let got = StreamPolicy.route key posPolicy "live" src
    Assert.Equal<int list>([ 1; 2 ], collect got)

[<Fact>]
let ``traveler preserves its address and stream`` () =
    let t = StreamPolicy.traveler "bus/in" (obsOf [| 1; 2; 3 |])
    Assert.Equal("bus/in", t.Address)
    Assert.Equal<int list>([ 1; 2; 3 ], collect t.Stream)

[<Fact>]
let ``zip2 combines two travelers element-wise and stops at the shorter`` () =
    let a = StreamPolicy.traveler "a" (obsOf [| 1; 2; 3 |])
    let b = StreamPolicy.traveler "b" (obsOf [| "x"; "y" |]) // shorter
    let z = StreamPolicy.zip2 "ab" a b
    Assert.Equal("ab", z.Address)
    Assert.Equal<(int * string) list>([ 1, "x"; 2, "y" ], collect z.Stream)

[<Fact>]
let ``zip3 combines three travelers element-wise (multidispatch) and stops at the shortest`` () =
    let a = StreamPolicy.traveler "a" (obsOf [| 1; 2; 3 |])
    let b = StreamPolicy.traveler "b" (obsOf [| "x"; "y"; "z" |])
    let c = StreamPolicy.traveler "c" (obsOf [| true; false |]) // shortest
    let z = StreamPolicy.zip3 "abc" a b c
    Assert.Equal("abc", z.Address)
    Assert.Equal<(int * string * bool) list>([ 1, "x", true; 2, "y", false ], collect z.Stream)


// ═══════════════════════════════════════════════════════════════════
// Rx-combinator IRREDUCIBILITY check (Aaron 2026-06-04). The question:
// do the combinators form an irreducible base, or does one reduce to
// the others? Result for the νF/stream combinators:
//
//   zip3 (and every N-ary zip, N≥3) REDUCES to nested binary `zip2`
//   — so N-ary zip is NOT in the irreducible base. `zip2` IS the
//   irreducible BINARY stream combinator: it cannot be built from
//   unary stream ops (it joins two independent streams element-wise;
//   no single-stream map/filter produces a cross-stream pairing).
//
// The irreducible base spans the two fixpoints (one combinator each):
//   • νF (streams):       zip2   — binary stream join (this file)
//   • μF (finite trees):  bananaSplit — binary tupling fold
//     (DynamicValueFold; two folds over ONE structure in one pass)
// These are in DIFFERENT functor domains (two-streams→pairs vs
// one-tree→pair), so neither reduces to the other — they are the two
// irreducible binary combinators, one per fixpoint. N-ary forms of
// each reduce to the binary one (proven below for zip).
//
// NOTE (Kestrel / CALM): monotone-vs-non-monotone is a DIFFERENT axis
// — it CLASSIFIES combinators (which are coordination-free) rather than
// generating them. The irreducible-base question (here) is the
// generating-set axis; CALM is the classification axis. Don't conflate.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``zip3 reduces to nested zip2 (N-ary zip is not irreducible; zip2 is the binary generator)`` () =
    let a = StreamPolicy.traveler "a" (obsOf [| 1; 2; 3 |])
    let b = StreamPolicy.traveler "b" (obsOf [| 4; 5; 6 |])
    let c = StreamPolicy.traveler "c" (obsOf [| 7; 8; 9 |])
    // direct N-ary combinator
    let viaZip3 = StreamPolicy.zip3 "z3" a b c |> fun t -> collect t.Stream
    // built from the binary generator: zip2 (zip2 a b) c, then re-associate ((x,y),z) -> (x,y,z)
    let nested = StreamPolicy.zip2 "outer" (StreamPolicy.zip2 "inner" a b) c
    let viaZip2 = nested.Stream.Select(fun ((x, y), z) -> (x, y, z)) |> collect
    Assert.Equal<(int * int * int) list>(viaZip3, viaZip2)
    // and the reduction is exact on the shared content (zip stops at shortest, both same here)
    Assert.Equal<(int * int * int) list>([ (1, 4, 7); (2, 5, 8); (3, 6, 9) ], viaZip3)
