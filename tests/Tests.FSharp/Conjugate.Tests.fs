module Zeta.Tests.ConjugateTests

open global.Xunit
open Zeta.Core
open Zeta.Core.Conjugate

let private dv (s: string) = DynamicValue.String s

let private sv (xs: (string * float) list) =
    match SoftValue.ofWeighted (xs |> List.map (fun (s, w) -> dv s, w)) with
    | Some v -> v
    | None -> failwith "bad soft value"

[<Fact>]
let ``agreeing frames weave to certainty with zero irreducible error`` () =
    let c = ofFrames (sv [ "x", 1.0 ]) (sv [ "x", 1.0 ])
    Assert.True(converged c)
    Assert.Equal(Some 0.0, residualEntropy c)

[<Fact>]
let ``diverging-but-overlapping frames leave residual irreducible error (entropy > 0)`` () =
    // A favors x, B favors y, both admit both → weave keeps both → residual entropy > 0
    let c = ofFrames (sv [ "x", 0.7; "y", 0.3 ]) (sv [ "x", 0.3; "y", 0.7 ])
    match residualEntropy c with
    | Some e -> Assert.True(e > 0.0)
    | None -> failwith "expected a weave"
    Assert.False(converged c)

[<Fact>]
let ``totally divergent frames (no shared candidate) -> no weave -> None (unbounded irreducible error)`` () =
    let c = ofFrames (sv [ "x", 1.0 ]) (sv [ "y", 1.0 ])
    Assert.Equal(None, weave c)
    Assert.Equal(None, residualEntropy c)
    Assert.False(converged c)

[<Fact>]
let ``weave is the Bayesian product of the two frames (weaveViaProduct agrees)`` () =
    let c = ofFrames (sv [ "x", 0.6; "y", 0.4 ]) (sv [ "x", 0.5; "y", 0.5 ])
    Assert.Equal<SoftValue.SoftValue option>(weave c, weaveViaProduct c)

[<Fact>]
let ``weave favors the agreed candidate (Bayesian conjunction sharpens)`` () =
    // both lean x → woven confidence in x exceeds either frame's
    let c = ofFrames (sv [ "x", 0.6; "y", 0.4 ]) (sv [ "x", 0.7; "y", 0.3 ])
    match weave c with
    | Some w -> Assert.True(SoftValue.confidence w > 0.7)
    | None -> failwith "expected a weave"

// Compare as DISTRIBUTIONS (order-insensitive): SoftValue's candidate list is not canonically ordered, so
// commutativity holds up to reordering of candidates (same multiset of (candidate, weight)), not as a list.
let private norm (s: SoftValue.SoftValue option) =
    s
    |> Option.map (fun v -> v.Candidates |> List.map (fun (d, w) -> (string d, w)) |> List.sortBy fst)

[<Fact>]
let ``mix (additive monoid) is commutative as a distribution (order-insensitive)`` () =
    let a = sv [ "x", 0.5; "y", 0.5 ]
    let b = sv [ "y", 0.5; "z", 0.5 ]
    Assert.Equal<(string * float) list option>(norm (mix a b), norm (mix b a))

[<Fact>]
let ``product (multiplicative monoid) is commutative as a distribution (order-insensitive)`` () =
    let a = sv [ "x", 0.6; "y", 0.4 ]
    let b = sv [ "x", 0.5; "y", 0.5 ]
    Assert.Equal<(string * float) list option>(norm (product a b), norm (product b a))

[<Fact>]
let ``DynamicValue round-trip: ofDynamicValue (toDynamicValue c) = c`` () =
    let c = ofFrames (sv [ "x", 0.6; "y", 0.4 ]) (sv [ "x", 0.3; "y", 0.7 ])
    match ofDynamicValue (toDynamicValue c) with
    | Some c2 ->
        Assert.Equal<SoftValue.SoftValue>(c.FrameA, c2.FrameA)
        Assert.Equal<SoftValue.SoftValue>(c.FrameB, c2.FrameB)
    | None -> failwith "round-trip failed"
