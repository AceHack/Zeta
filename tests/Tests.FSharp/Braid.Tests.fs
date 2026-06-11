module Zeta.Tests.BraidTests

// "Topology is hairdressing" — TESTED (B-1027): the Artin relations hold for our braid engine, far
// strands commute, and the braid REMEMBERS who crossed over whom (it is NOT the symmetric group).
// Exact integers via the faithful free-group action; FsCheck sweeps random words.

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

let private N = 5 // strands (generators sigma_1..sigma_4 as ints 1..4)

[<Fact>]
let ``THE ARTIN RELATION: s1 s2 s1 = s2 s1 s2 — the hairdresser's move is a law`` () =
    Assert.True(Braid.equal N [ 1; 2; 1 ] [ 2; 1; 2 ])
    Assert.True(Braid.equal N [ 2; 3; 2 ] [ 3; 2; 3 ])
    Assert.True(Braid.equal N [ 3; 4; 3 ] [ 4; 3; 4 ])

[<Fact>]
let ``FAR COMMUTATIVITY: distant strands don't care — s1 s3 = s3 s1; s1 s4 = s4 s1`` () =
    Assert.True(Braid.equal N [ 1; 3 ] [ 3; 1 ])
    Assert.True(Braid.equal N [ 1; 4 ] [ 4; 1 ])
    Assert.True(Braid.equal N [ 2; 4 ] [ 4; 2 ])

[<Fact>]
let ``NOT THE SYMMETRIC GROUP: crossing twice is not un-crossing — the braid remembers the over/under`` () =
    Assert.False(Braid.isIdentity N [ 1; 1 ]) // sigma_1^2 != id: history is kept
    Assert.True(Braid.isIdentity N [ 1; -1 ]) // ...but a crossing and its true inverse cancel
    Assert.False(Braid.equal N [ 1; 2 ] [ 2; 1 ]) // adjacent crossings do NOT commute (order matters)

[<Fact>]
let ``the free-group reduction is sound: w * inv w = identity`` () =
    let w = [ 0, 1; 1, -1; 2, 1 ]
    Assert.Equal<Braid.Word>([], Braid.mul w (Braid.inv w))

type private BraidArbs =
    static member Crossing() =
        Arb.fromGen (Gen.elements [ 1; -1; 2; -2; 3; -3; 4; -4 ])
    static member BraidWord() =
        Arb.fromGen (Gen.listOf (Gen.elements [ 1; -1; 2; -2; 3; -3; 4; -4 ]) |> Gen.map (List.truncate 8))

[<Property(Arbitrary = [| typeof<BraidArbs> |])>]
let ``property: every braid word composed with its inverse is the identity (random words)`` (b: int list) =
    let binv = b |> List.rev |> List.map (~-)
    Braid.isIdentity N (b @ binv)

[<Property(Arbitrary = [| typeof<BraidArbs> |])>]
let ``property: the Artin relation holds INSIDE any context — u·(s1 s2 s1)·v = u·(s2 s1 s2)·v`` (u: int list) (v: int list) =
    Braid.equal N (u @ [ 1; 2; 1 ] @ v) (u @ [ 2; 1; 2 ] @ v)
