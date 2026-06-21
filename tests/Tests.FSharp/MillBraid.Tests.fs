module Zeta.Tests.MillBraidTests

// 081KTSZN10008QG0R001BW91GT's remaining step, answered HONESTLY: is the mill's weave a braid action? NO — and the
// counterexample is the finding. A mill crossing (two adjacent strands averaging toward each other)
// satisfies FAR COMMUTATIVITY but FAILS the Artin relation: averaging COLLAPSES history (a join),
// while a braid PRESERVES it (who crossed over whom). So WEAVE and BRAID are now PROVABLY distinct
// verbs — exactly the precision the craft registry wanted:
//   weave (mill) = a converging, history-collapsing fold (CRDT/join-flavored);
//   braid        = a history-preserving, order-sensitive group action (Artin, #7671).

open global.Xunit
open Zeta.Core

/// A mill crossing: strands i and i+1 are replaced by their meeting point (integer mean) — the
/// mill's weaveStep restricted to one adjacent pair (the crossing-shaped version of its global fold).
let private millCross (i: int) (strands: int list) : int list =
    strands
    |> List.mapi (fun j v ->
        if j = i || j = i + 1 then (strands.[i] + strands.[i + 1]) / 2
        else v)

let private millFold (braidWord: int list) (strands: int list) : int list =
    braidWord |> List.fold (fun s c -> millCross (abs c - 1) s) strands

[<Fact>]
let ``the mill crossing DOES satisfy far commutativity (distant pairs are independent)`` () =
    let s = [ 0; 2; 4; 6; 8 ]
    Assert.Equal<int list>(millFold [ 1; 3 ] s, millFold [ 3; 1 ] s)
    Assert.Equal<int list>(millFold [ 1; 4 ] s, millFold [ 4; 1 ] s)

[<Fact>]
let ``COUNTEREXAMPLE: the mill weave FAILS the Artin relation — averaging collapses history`` () =
    let s = [ 0; 2; 4 ]
    let lhs = millFold [ 1; 2; 1 ] s // σ1σ2σ1-shaped: -> (1,1,4) -> (1,2,2) -> (1,1,2)
    let rhs = millFold [ 2; 1; 2 ] s // σ2σ1σ2-shaped: -> (0,3,3) -> (1,1,3) -> (1,2,2)
    Assert.Equal<int list>([ 1; 1; 2 ], lhs)
    Assert.Equal<int list>([ 1; 2; 2 ], rhs)
    Assert.NotEqual<int list>(lhs, rhs) // the hairdresser's move is NOT a law for the mill

[<Fact>]
let ``the discriminator, stated: the mill is a JOIN (idempotent crossing), the braid is a GROUP (remembers)`` () =
    // mill: crossing the same pair twice = crossing once (idempotent — history collapsed)
    let s = [ 0; 2; 4 ]
    Assert.Equal<int list>(millFold [ 1 ] s, millFold [ 1; 1 ] s)
    // braid: crossing twice is NOT crossing once and NOT identity (history kept — proven in #7671)
    Assert.False(Braid.isIdentity 3 [ 1; 1 ])
    Assert.False(Braid.equal 3 [ 1 ] [ 1; 1 ])
