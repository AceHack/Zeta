module Zeta.Tests.TsirelsonTests

// REPORT #6's build plan, executed: Tsirelson's bound locked as INTEGER identities.
// S² = 8 exactly; the √2 appears only when a human reads the answer out loud.

open global.Xunit
open Zeta.Core

let private eq (a: Tsirelson.M) (b: Tsirelson.M) =
    Seq.forall2 (fun (r1: int[]) (r2: int[]) -> r1 = r2) a b

[<Fact>]
let ``THE LANDAU IDENTITY, exact: C² = 4I − 4Ω and Ω² = I`` () =
    let c2 = Tsirelson.mul Tsirelson.C Tsirelson.C
    let rhs = Tsirelson.sub (Tsirelson.scale 4 Tsirelson.identity) (Tsirelson.scale 4 Tsirelson.Omega)
    Assert.True(eq c2 rhs)
    Assert.True(eq (Tsirelson.mul Tsirelson.Omega Tsirelson.Omega) Tsirelson.identity)

[<Fact>]
let ``TSIRELSON AS AN INTEGER IDENTITY: C⁴ = 8·C² (hence spec(C) ⊆ {0, ±2√2}, S² ≤ 8)`` () =
    let c2 = Tsirelson.mul Tsirelson.C Tsirelson.C
    let c4 = Tsirelson.mul c2 c2
    Assert.True(eq c4 (Tsirelson.scale 8 c2))

[<Fact>]
let ``SATURATION WITNESS: the integer vector v = (1,0,0,−1) attains C²v = 8v`` () =
    let v = [| 1; 0; 0; -1 |]
    let c2 = Tsirelson.mul Tsirelson.C Tsirelson.C
    Assert.Equal<int[]>([| 8; 0; 0; -8 |], Tsirelson.apply c2 v)

[<Fact>]
let ``THE COCYCLE, PRICED: replace A′ with a commuting partner and the classical bound returns — C² = 4I exactly`` () =
    // A′ := A (commutes with itself); both Bob pairs unchanged. The anticommuting entry is
    // literally the term you pay for S > 2 — remove it and S² caps at 4 (S ≤ 2, Bell classical).
    let c = Tsirelson.chshOf Tsirelson.A Tsirelson.A Tsirelson.B Tsirelson.B'
    let c2 = Tsirelson.mul c c
    Assert.True(eq c2 (Tsirelson.scale 4 Tsirelson.identity))

[<Fact>]
let ``the saturating pairs anticommute and the commuting control does not (the sign rule located)`` () =
    let zero = Tsirelson.scale 0 Tsirelson.identity
    Assert.True(eq (Tsirelson.anticommutator Tsirelson.A Tsirelson.A') zero) // {X₁,Z₁} = 0
    Assert.True(eq (Tsirelson.anticommutator Tsirelson.B Tsirelson.B') zero) // {X₂,Z₂} = 0
    Assert.False(eq (Tsirelson.anticommutator Tsirelson.A Tsirelson.A) zero) // {X₁,X₁} = 2X₁² ≠ 0

[<Fact>]
let ``EXHAUSTIVE RIGIDITY over the real-Pauli family: spec(C²) ⊆ {0,4,8} always; 8 attained ⟺ both pairs anticommute`` () =
    // Alice observables: ±I₁, ±X₁, ±Z₁; Bob likewise on qubit 2 — 6⁴ = 1296 CHSH instances,
    // every one checked by exact integer polynomial identity C²(C²−4I)(C²−8I) = 0.
    let ops2x2 = [ [| [| 1; 0 |]; [| 0; 1 |] |]; [| [| 0; 1 |]; [| 1; 0 |] |]; [| [| 1; 0 |]; [| 0; -1 |] |] ]
    let i2 = [| [| 1; 0 |]; [| 0; 1 |] |]
    let aliceOps = [ for p in ops2x2 do for s in [ 1; -1 ] -> Tsirelson.scale s (Tsirelson.kron p i2) ]
    let bobOps = [ for p in ops2x2 do for s in [ 1; -1 ] -> Tsirelson.scale s (Tsirelson.kron i2 p) ]
    let zero = Tsirelson.scale 0 Tsirelson.identity
    let id4 = Tsirelson.identity
    for a in aliceOps do
        for a' in aliceOps do
            for b in bobOps do
                for b' in bobOps do
                    let c = Tsirelson.chshOf a a' b b'
                    let c2 = Tsirelson.mul c c
                    // spec(C²) ⊆ {0,4,8}: the cubic annihilates
                    let poly =
                        Tsirelson.mul (Tsirelson.mul c2 (Tsirelson.sub c2 (Tsirelson.scale 4 id4)))
                                      (Tsirelson.sub c2 (Tsirelson.scale 8 id4))
                    Assert.True(eq poly zero)
                    // 8 attained ⟺ both pairs anticommute
                    let attains8 = not (eq (Tsirelson.mul c2 (Tsirelson.sub c2 (Tsirelson.scale 4 id4))) zero)
                    let bothAnticommute =
                        eq (Tsirelson.anticommutator a a') zero && eq (Tsirelson.anticommutator b b') zero
                    Assert.Equal(bothAnticommute, attains8)
