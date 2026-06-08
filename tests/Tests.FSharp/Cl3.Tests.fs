module Zeta.Tests.Cl3Tests

open System
open global.Xunit
open Zeta.Core

let private e1 = Cl3.vector 1.0 0.0 0.0
let private e2 = Cl3.vector 0.0 1.0 0.0
let private e3 = Cl3.vector 0.0 0.0 1.0

[<Fact>]
let ``e_i squared = 1 (Euclidean signature)`` () =
    Assert.Equal(1.0, (Cl3.gp e1 e1).S, 9)
    Assert.Equal(1.0, (Cl3.gp e2 e2).S, 9)
    Assert.Equal(1.0, (Cl3.gp e3 e3).S, 9)

[<Fact>]
let ``e1 e2 = e12 and anticommutes (e2 e1 = -e12)`` () =
    Assert.Equal(1.0, (Cl3.gp e1 e2).E12, 9)
    Assert.Equal(-1.0, (Cl3.gp e2 e1).E12, 9)
    // pure bivector — no scalar part for orthogonal vectors
    Assert.Equal(0.0, (Cl3.gp e1 e2).S, 9)

[<Fact>]
let ``e1 e2 e3 = pseudoscalar I (e123)`` () =
    let i = Cl3.gp (Cl3.gp e1 e2) e3
    Assert.Equal(1.0, i.E123, 9)

[<Fact>]
let ``geometric product is associative`` () =
    let a = Cl3.add e1 (Cl3.smul 2.0 e2)
    let b = Cl3.add e2 (Cl3.smul 3.0 e3)
    let c = Cl3.add e1 e3
    let left = Cl3.gp (Cl3.gp a b) c
    let right = Cl3.gp a (Cl3.gp b c)
    Assert.Equal(left.S, right.S, 9)
    Assert.Equal(left.E12, right.E12, 9)
    Assert.Equal(left.E123, right.E123, 9)

[<Fact>]
let ``dot is the vector inner product (e1.e1=1, e1.e2=0)`` () =
    Assert.Equal(1.0, Cl3.dot e1 e1, 9)
    Assert.Equal(0.0, Cl3.dot e1 e2, 9)

[<Fact>]
let ``distSq is squared Euclidean distance (the memory-distance metric)`` () =
    let a = Cl3.vector 1.0 2.0 3.0
    let b = Cl3.vector 4.0 6.0 3.0 // dx=3, dy=4, dz=0 -> dist 5, distSq 25
    Assert.Equal(25.0, Cl3.distSq a b, 9)
    Assert.Equal(5.0, Cl3.dist a b, 9)

[<Fact>]
let ``rotor by 90 degrees in e12 plane rotates e1 -> e2`` () =
    let r = Cl3.rotor (Math.PI / 2.0) Cl3.e12
    let rotated = Cl3.rotate r e1
    Assert.Equal(0.0, rotated.E1, 6)
    Assert.Equal(1.0, rotated.E2, 6)
    Assert.Equal(0.0, rotated.E3, 6)

[<Fact>]
let ``rotation preserves magnitude (rigid) - forward momentum keeps its speed`` () =
    let p = Cl3.momentum 1.0 0.0 0.0 7.0 // speed 7 along e1
    Assert.Equal(7.0, Cl3.norm p, 9)
    let turned = Cl3.rotate (Cl3.rotor 1.234 Cl3.e23) p
    Assert.Equal(7.0, Cl3.norm turned, 6) // speed conserved through the turn
