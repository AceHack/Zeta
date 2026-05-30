module Zeta.Tests.TriBooleanTests

open global.Xunit
open Zeta.Core.FSharp.TriBoolean
open Zeta.Core.FSharp.TriBoolean.TriBoolean

[<Fact>]
let ``cooperate preserves Tri.N and is identity on certain cells`` () =
    Assert.Equal(Tri.N, cooperate Tri.N)
    Assert.Equal(Tri.T, cooperate Tri.T)
    Assert.Equal(Tri.F, cooperate Tri.F)

[<Fact>]
let ``measure resolves certain cells; living Tri.N surfaces feedback`` () =
    Assert.Equal(Ok true, measure Tri.T)
    Assert.Equal(Ok false, measure Tri.F)
    Assert.Equal(Error CollapseFeedback.CollapsedLivingUncertainty, measure Tri.N)

[<Fact>]
let ``null-monad: Tri.N propagates through map and bind`` () =
    Assert.Equal(Tri.N, mapTri not Tri.N)
    Assert.Equal(Tri.F, mapTri not Tri.T)
    Assert.Equal(Tri.N, bindTri (fun _ -> Tri.T) Tri.N)
    Assert.Equal(Tri.F, bindTri (fun b -> fromBool (not b)) Tri.T)

[<Fact>]
let ``Kleene NOT keeps unknown unknown`` () =
    Assert.Equal(Tri.F, notTri Tri.T)
    Assert.Equal(Tri.T, notTri Tri.F)
    Assert.Equal(Tri.N, notTri Tri.N)

[<Fact>]
let ``Kleene AND: F dominates; N only when no F`` () =
    Assert.Equal(Tri.F, andTri Tri.F Tri.N)
    Assert.Equal(Tri.N, andTri Tri.T Tri.N)
    Assert.Equal(Tri.T, andTri Tri.T Tri.T)
    Assert.Equal(Tri.F, andTri Tri.T Tri.F)

[<Fact>]
let ``Kleene OR: T dominates; N only when no T`` () =
    Assert.Equal(Tri.T, orTri Tri.T Tri.N)
    Assert.Equal(Tri.N, orTri Tri.F Tri.N)
    Assert.Equal(Tri.F, orTri Tri.F Tri.F)

[<Fact>]
let ``tri computation expression propagates N and resolves T/F`` () =
    Assert.Equal(Tri.F, tri { let! b = Tri.T in return not b })
    Assert.Equal(Tri.N, tri { let! b = Tri.N in return b })
