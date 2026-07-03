module Zeta.Tests.SoftValueMonadTests

// SOFTVALUE IS THE DISTRIBUTION (GIRY) MONAD, and lowering is a Kleisli descent (shadow*, Aaron
// 2026-07-02: "build lowering as the kleisli descent"). `certain` is the unit; `bind` is `>>=`.
// Proofs:
//   1. MONAD LAWS — left identity, right identity, associativity (up to float).
//   2. KLEISLI DESCENT — ParseSoft.lower carries a distribution over parses THROUGH a semantic map
//      into a distribution over lowered forms; the superposition is preserved, weighted correctly.
//
// Anchors: Giry (probability monad); Moggi (monads as computation); Mac Lane; SoftValue.

open global.Xunit
open Zeta.Core

module SV = SoftValue

let private s (x: string) = DynamicValue.String x
let private w (xs: (DynamicValue * float) list) = SV.ofWeighted xs |> Option.get

/// Two distributions equal up to per-candidate float tolerance (DynamicValue has equality but
/// not comparison, so match by `=`, not `Map`).
let private approx (a: SV.SoftValue) (b: SV.SoftValue) : bool =
    List.length a.Candidates = List.length b.Candidates
    && a.Candidates
       |> List.forall (fun (d, v) ->
           match b.Candidates |> List.tryFind (fun (d2, _) -> d2 = d) with
           | Some(_, v2) -> abs (v - v2) < 1e-9
           | None -> false)

/// A Kleisli arrow that depends on its input.
let private f (d: DynamicValue) : SV.SoftValue =
    match d with
    | DynamicValue.String "a" -> w [ s "a1", 0.5; s "a2", 0.5 ]
    | _ -> SV.certain (s "other")

let private g (d: DynamicValue) : SV.SoftValue =
    match d with
    | DynamicValue.String "a1" -> w [ s "x", 0.25; s "y", 0.75 ]
    | _ -> SV.certain (s "z")

let private m = w [ s "a", 0.6; s "b", 0.4 ]

[<Fact>]
let ``MONAD LAW — left identity: bind f (certain a) = f a`` () =
    Assert.True(approx (SV.bind f (SV.certain (s "a"))) (f (s "a")))

[<Fact>]
let ``MONAD LAW — right identity: bind certain m = m`` () =
    Assert.True(approx (SV.bind SV.certain m) m)

[<Fact>]
let ``MONAD LAW — associativity: bind g (bind f m) = bind (x -> bind g (f x)) m`` () =
    let lhs = SV.bind g (SV.bind f m)
    let rhs = SV.bind (fun x -> SV.bind g (f x)) m
    Assert.True(approx lhs rhs)

[<Fact>]
let ``KLEISLI DESCENT: ParseSoft.lower carries the parse distribution through a semantic map, superposition preserved`` () =
    // a distribution over two parses…
    let parses = w [ s "p1", 0.6; s "p2", 0.4 ]
    // …a semantic map: p1 lowers to one program; p2 lowers to a 50/50 superposition of two.
    let lowerParse (d: DynamicValue) : SV.SoftValue =
        match d with
        | DynamicValue.String "p1" -> SV.certain (s "i1")
        | _ -> w [ s "i2", 0.5; s "i3", 0.5 ]
    // lower = bind ⇒ distribution over lowered forms: i1=0.6, i2=0.2, i3=0.2 (0.4·0.5 each)
    let lowered = ParseSoft.lower lowerParse parses
    Assert.True(approx lowered (w [ s "i1", 0.6; s "i2", 0.2; s "i3", 0.2 ]))
    // the superposition survived: three candidates, none collapsed
    Assert.Equal(3, List.length lowered.Candidates)

[<Fact>]
let ``KLEISLI DESCENT: the identity lowering (certain) leaves the distribution unchanged`` () =
    // lowering every parse to itself as a point mass = the identity Kleisli arrow ⇒ no change.
    let parses = w [ s "p1", 0.7; s "p2", 0.3 ]
    Assert.True(approx (ParseSoft.lower SV.certain parses) parses)
