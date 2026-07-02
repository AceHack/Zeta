module Zeta.Tests.CayleyWeightedSetTests

open global.Xunit
open Zeta.Core

module WS = Zeta.Core.WeightedSet

// Quaternion = Doubled<Complex> = Doubled<Doubled<float>>
let private cplx a b : Complex = { Real = a; Imag = b }
let private quat a b c d : Quaternion = { Real = cplx a b; Imag = cplx c d }

// the unified floor: a tower is an IStarRing, hence an IRing (and an ISemiring) — drops straight
// into WeightedSet, retraction included (081KWG9JQ9H tower).
let private q = ImaginaryStack.quaternion :> IRing<Quaternion>

let private one = quat 1.0 0.0 0.0 0.0
let private i = quat 0.0 1.0 0.0 0.0

[<Fact>]
let ``WeightedSet carries quaternion weights through the unified floor (ISemiring)`` () =
    let a = WS.ofSeq q [ "x", i; "y", one ]
    Assert.Equal<Quaternion>(i, WS.weight q "x" a)
    Assert.Equal<Quaternion>(one, WS.weight q "y" a)

[<Fact>]
let ``quaternion-weighted WeightedSet is retraction-native: a + (-a) = empty`` () =
    let a = WS.ofSeq q [ "x", i; "y", one ]
    // Add is commutative + associative for every tower, so retraction holds
    Assert.True(WS.isEmpty (WS.add q a (WS.negate q a)))

[<Fact>]
let ``add combines shared coordinates via quaternion addition (i + 1 = 1 + i)`` () =
    let a = WS.ofSeq q [ "x", i ]
    let b = WS.ofSeq q [ "x", one ]
    Assert.Equal<Quaternion>(quat 1.0 1.0 0.0 0.0, WS.weight q "x" (WS.add q a b))

[<Fact>]
let ``scale by One is identity (proves the tower carries a multiplicative identity)`` () =
    let a = WS.ofSeq q [ "x", i; "y", one ]
    Assert.Equal<WS.WeightedSet<string, Quaternion>>(a, WS.scale q one a)

[<Fact>]
let ``scale by Zero annihilates (proves Zero + Mul on the tower)`` () =
    let a = WS.ofSeq q [ "x", i; "y", one ]
    Assert.True(WS.isEmpty (WS.scale q (q.Zero) a))

// ── Hard rungs: Octonion (non-associative Mul) and Sedenion (zero divisors) ──
// The floor promise is "EVERY Cayley–Dickson tower is an IStarRing, hence an ISemiring, so it
// drops into WeightedSet." Quaternion is covered above; here we pin the HARD levels on the
// ADD-SIDE — the retraction-native Z-set core — which is sound at every tower because Add is
// always a commutative group (the ℍ ceiling only bites Mul). The Mul-law DEGRADATION itself
// (octonion non-associativity; octonion alternativity; sedenion zero divisors) is proven at the
// algebra level in Algebra/Octonion.Laws.Tests.fs + Algebra/CayleyDickson.Tests.fs. Consequence,
// per the IStarRing law profile: WeightedSet.inner / scale-CHAINS are order-sensitive above ℍ —
// so these tests assert only the law-safe envelope (additive structure + One/Zero scaling).

let private qzero : Quaternion = quat 0.0 0.0 0.0 0.0
let private ozero : Octonion = { Real = qzero; Imag = qzero }

// Octonion = Doubled<Quaternion>
let private oalg = ImaginaryStack.octonion :> IRing<Octonion>
let private oOne : Octonion = { Real = one; Imag = qzero }
let private oI   : Octonion = { Real = i; Imag = qzero }    // an imaginary unit (lower half)
let private oE4  : Octonion = { Real = qzero; Imag = one }  // the doubling unit e4 (upper half)

[<Fact>]
let ``WeightedSet carries OCTONION weights; retraction holds despite non-associative Mul (add-side sound)`` () =
    let a = WS.ofSeq oalg [ "x", oI; "y", oE4 ]
    Assert.Equal<Octonion>(oI, WS.weight oalg "x" a)
    Assert.True(WS.isEmpty (WS.add oalg a (WS.negate oalg a)))

[<Fact>]
let ``octonion WeightedSet: add combines coordinates; scale by One identity, by Zero annihilates`` () =
    let a = WS.ofSeq oalg [ "x", oI ]
    let b = WS.ofSeq oalg [ "x", oE4 ]
    Assert.Equal<Octonion>({ Real = i; Imag = one }, WS.weight oalg "x" (WS.add oalg a b))
    let c = WS.ofSeq oalg [ "x", oI; "y", oOne ]
    Assert.Equal<WS.WeightedSet<string, Octonion>>(c, WS.scale oalg oOne c)
    Assert.True(WS.isEmpty (WS.scale oalg oalg.Zero c))

// Sedenion = Doubled<Octonion>
let private salg = ImaginaryStack.sedenion :> IRing<Sedenion>
let private sOne : Sedenion = { Real = oOne; Imag = ozero }
let private sI   : Sedenion = { Real = oI;   Imag = ozero }
let private sE8  : Sedenion = { Real = ozero; Imag = oOne }  // the doubling unit e8

[<Fact>]
let ``WeightedSet carries SEDENION weights; retraction + One/Zero scaling hold despite zero divisors`` () =
    let a = WS.ofSeq salg [ "x", sI; "y", sE8 ]
    Assert.Equal<Sedenion>(sI, WS.weight salg "x" a)
    // Add is a commutative group at every tower — retraction is sound even though Mul has zero divisors here
    Assert.True(WS.isEmpty (WS.add salg a (WS.negate salg a)))
    // One is never a zero divisor, so scale-by-One is identity even in 𝕊
    Assert.Equal<WS.WeightedSet<string, Sedenion>>(a, WS.scale salg sOne a)
    Assert.True(WS.isEmpty (WS.scale salg salg.Zero a))

// ── The ℍ ceiling at the WeightedSet API: scale-CHAINS are order-sensitive above ℍ ──
// scale w1 (scale w2 a)  applies  Mul(w1, Mul(w2, x))  per element;
// scale (Mul w1 w2) a    applies  Mul(Mul(w1, w2), x).
// These agree iff Mul is associative. Quaternion (ℍ): associative ⇒ they AGREE. Octonion (𝕆):
// non-associative ⇒ they can DIFFER. This pins, at the WeightedSet level, the IStarRing law-profile
// boundary "loses associativity above ℍ" — so callers needing scale-chain/inner associativity must
// stay ≤ ℍ. (The algebra-level non-associativity proof lives in Algebra/CayleyDickson.Tests.fs.)

// k-th basis octonion (coordinate k = 1.0), k ∈ 0..7 (0 = real, 1..7 = imaginary units).
let private oBasis (k: int) : Octonion =
    let a = Array.zeroCreate 8
    a.[k] <- 1.0
    let mkC i : Complex = { Real = a.[i]; Imag = a.[i + 1] }
    let mkQ i : Quaternion = { Real = mkC i; Imag = mkC (i + 2) }
    { Real = mkQ 0; Imag = mkQ 4 }

[<Fact>]
let ``quaternion scale-chain is associative: scale w1 (scale w2 a) = scale (Mul w1 w2) a`` () =
    let a = WS.ofSeq q [ "x", i ]
    let w1, w2 = quat 0.0 1.0 0.0 0.0, quat 0.0 0.0 1.0 0.0   // i, j
    Assert.Equal<WS.WeightedSet<string, Quaternion>>(
        WS.scale q w1 (WS.scale q w2 a),
        WS.scale q (q.Mul(w1, w2)) a)

[<Fact>]
let ``octonion scale-chain is ORDER-SENSITIVE above ℍ (pins the non-associativity boundary)`` () =
    // Find any non-associating octonion unit triple (u,v,x): Mul(Mul(u,v),x) <> Mul(u,Mul(v,x)).
    let units = [ for k in 1..7 -> oBasis k ]
    let triple =
        seq { for u in units do
                for v in units do
                  for x in units do
                    if oalg.Mul(oalg.Mul(u, v), x) <> oalg.Mul(u, oalg.Mul(v, x)) then yield (u, v, x) }
        |> Seq.tryHead
    match triple with
    | None -> failwith "expected a non-associating octonion triple (Mul should not be associative on 𝕆)"
    | Some (u, v, x) ->
        let a = WS.ofSeq oalg [ "k", x ]
        // scale-chain differs exactly because Mul is non-associative on 𝕆
        Assert.NotEqual<WS.WeightedSet<string, Octonion>>(
            WS.scale oalg u (WS.scale oalg v a),
            WS.scale oalg (oalg.Mul(u, v)) a)
