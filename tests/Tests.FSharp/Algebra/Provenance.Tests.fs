module Zeta.Tests.Algebra.ProvenanceTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Provenance — how-provenance ℤ[X] as an IRing (R2 safe-fragment).
// The load-bearing R2 property: LINEAGE RETRACTS EXACTLY through a Z-set
// delta — a +1 tuple's provenance is cancelled by its −1, by the ring.
// ═══════════════════════════════════════════════════════════════════

module P = Provenance
let private ring : IRing<ProvenancePoly> = ProvenanceRing.Instance
let private a = P.token "a"
let private b = P.token "b"
let private c = P.token "c"

[<Fact>]
let ``token ⊗ token is the joint monomial; ⊕ is alternative derivations`` () =
    // a ⊗ b = the monomial ab; a ⊕ b = two separate derivations
    let ab = P.mul a b
    Assert.Equal<Set<string>>(Set.ofList [ "a"; "b" ], P.support ab)  // ab touches both
    Assert.Equal(1, ab.Terms.Count)             // a⊗b = ONE monomial {ab}
    Assert.Equal(2, (P.add a b).Terms.Count)    // a⊕b = TWO derivations {a, b}

[<Fact>]
let ``ring inverse law over ℤ[X]: p ⊕ (−p) = 0 (this is why retraction works)`` () =
    let p = P.add (P.mul a b) (P.mul (P.token "x") c)   // ab + xc
    Assert.Equal(P.zero, ring.Add(p, ring.Negate p))

[<Property>]
let ``ProvenanceRing is a lawful commutative ring (add comm/assoc, distributive, inverse)`` () =
    // small random polynomials over a fixed token pool
    let toks = [| "a"; "b"; "c"; "d" |]
    let genPoly =
        gen {
            let! n = Gen.choose (0, 3)
            let! terms =
                Gen.listOfLength n (gen {
                    let! t1 = Gen.elements toks
                    let! t2 = Gen.elements toks
                    let! coeff = Gen.choose (-4, 4) |> Gen.map int64
                    return P.mul (P.token t1) (P.token t2), coeff
                })
            return terms |> List.fold (fun acc (m, c) -> P.add acc (P.mul m { Terms = Map.ofList [ { Factors = Map.empty }, c ] })) P.zero
        }
    Prop.forAll (Arb.fromGen (Gen.three genPoly)) (fun (p, q, r) ->
        ring.Add(p, q) = ring.Add(q, p)                                   // comm
        && ring.Add(ring.Add(p, q), r) = ring.Add(p, ring.Add(q, r))     // assoc
        && ring.Add(p, ring.Zero) = p                                     // identity
        && ring.Add(p, ring.Negate p) = ring.Zero                        // inverse
        && ring.Mul(p, ring.Add(q, r)) = ring.Add(ring.Mul(p, q), ring.Mul(p, r))) // distributive

// ── THE R2 PAYOFF: lineage propagates + retracts through Z-set deltas ──

[<Fact>]
let ``lineage-annotated ZSet retracts a tuple's provenance EXACTLY`` () =
    // a relation where each tuple's weight IS its provenance
    let rel = ZSetW.ofSeq ring [ "t1", a; "t2", b ]
    // retract t1 (a −1-style delta carrying t1's provenance)
    let delta = ZSetW.ofSeq ring [ "t1", ring.Negate a ]
    let after = ZSetW.sum ring rel delta
    // t1's lineage is gone (zero-weight dropped); t2 intact
    Assert.Equal(P.zero, ZSetW.lookup ring "t1" after)
    Assert.Equal(b, ZSetW.lookup ring "t2" after)
    Assert.Equal(1, ZSetW.count after)

[<Fact>]
let ``incremental JOIN provenance: derived tuple carries a⊗b, and retracting base a retracts it`` () =
    // safe plan: a join derives tuple "ab" with provenance a⊗b.
    // Model the derived relation's provenance; then a base retraction of "a"
    // propagates as multiplying the derived contribution by (−a's provenance)…
    // demonstrated at the annotation level: derived = a⊗b; its retraction = (−a)⊗b.
    let derived = ZSetW.ofSeq ring [ "ab", P.mul a b ]
    let retractViaA = ZSetW.ofSeq ring [ "ab", P.mul (ring.Negate a) b ]  // (−a)⊗b = −(a⊗b)
    let after = ZSetW.sum ring derived retractViaA
    Assert.True(ZSetW.isEmpty after)   // the joint derivation cancels exactly

[<Fact>]
let ``struct-ring hot path agrees with instance path on provenance`` () =
    let r = ZSetW.ofSeq ring [ "x", P.mul a b; "y", c ]
    Assert.True((ZSetW.difference ring r r = ZSetW.differenceBy (ProvenanceRing()) r r))
    Assert.True(ZSetW.isEmpty (ZSetW.differenceBy (ProvenanceRing()) r r))
