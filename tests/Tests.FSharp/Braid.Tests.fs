module Zeta.Tests.BraidTests

// "Topology is hairdressing" — TESTED (081KTSZN10008QG0R001BW91GT): the Artin relations hold for our braid engine, far
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

// ── Math REPORT #3 Round-1 kernel laws + ferry-12 density measures (2026-06-12) ──────────────────

[<Property(Arbitrary = [| typeof<BraidArbs> |])>]
let ``REPRESENTATION LAW: act of a concatenation = composition of the actions (the functor law)`` (b1: int list) (b2: int list) =
    [ 0 .. N - 1 ]
    |> List.forall (fun i -> Braid.act (b1 @ b2) (Braid.gen i) = Braid.act b2 (Braid.act b1 (Braid.gen i)))

[<Property(Arbitrary = [| typeof<BraidArbs> |])>]
let ``THE COMMUTING SQUARE: writheParity = sign ∘ permutation — the χ : Bₙ → ℤ/2 character factors through Sₙ`` (b: int list) =
    Braid.writheParity b = Braid.permutationSign (Braid.permutation N b)

[<Property(Arbitrary = [| typeof<BraidArbs> |])>]
let ``writheParity is a homomorphism: parity of a concatenation = sum of parities mod 2`` (b1: int list) (b2: int list) =
    Braid.writheParity (b1 @ b2) = (Braid.writheParity b1 + Braid.writheParity b2) % 2

[<Property(Arbitrary = [| typeof<BraidArbs> |])>]
let ``writhe is a homomorphism to ℤ and writhe ≡ length mod 2`` (b1: int list) (b2: int list) =
    Braid.writhe (b1 @ b2) = Braid.writhe b1 + Braid.writhe b2
    && (abs (Braid.writhe b1) % 2 = List.length b1 % 2)

[<Property(Arbitrary = [| typeof<BraidArbs> |])>]
let ``DENSITY: pairLoad sums to word length and covers exactly the adjacent pairs`` (b: int list) =
    let load = Braid.pairLoad N b
    (load |> Map.toList |> List.sumBy snd) = List.length b
    && (load |> Map.toList |> List.map fst) = [ 0 .. N - 2 ]

[<Fact>]
let ``DENSITY: dense vs sparse braiding are distinguishable by pairLoad (ferry 12's axis, measured)`` () =
    // dense: all load on one pair, repeatedly (σ₁⁶ — six crossings, one pair)
    let dense = Braid.pairLoad N [ 1; 1; 1; 1; 1; 1 ]
    // sparse: the same six crossings spread across three far pairs
    let sparse = Braid.pairLoad N [ 1; 3; 1; 3; 1; 3 ]
    Assert.Equal(6, dense.[0])
    Assert.Equal(3, sparse.[0])
    Assert.Equal(3, sparse.[2])

[<Fact>]
let ``the permutation is the order-forgetting quotient: σ₁² has trivial permutation but is NOT the identity braid`` () =
    Assert.Equal<int list>([ 0 .. N - 1 ], Braid.permutation N [ 1; 1 ])
    Assert.False(Braid.isIdentity N [ 1; 1 ]) // the kernel (pure braid group) is the memory

// --- BraidEntropy: the Thurston–Nielsen–Boyland bridge (a braid forces topological entropy h ≥ log λ) ---

[<Fact>]
let ``BRAID ENTROPY: σ₁σ₂⁻¹ is pseudo-Anosov with dilatation (3+√5)/2 — the canonical pA on 3 strands`` () =
    // [1;-2] = σ₁σ₂⁻¹.  Dilatation λ = (3+√5)/2 ≈ 2.6180 (golden φ²), log λ ≈ 0.9624 — the entropy it forces.
    let h = BraidEntropy.growthRate 3 [ 1; -2 ]
    let lam = BraidEntropy.dilatationEstimate 3 [ 1; -2 ]
    Assert.True(abs (h - 0.9624) < 0.02, sprintf "log λ = %f, expected ≈ 0.9624" h)
    Assert.True(abs (lam - 2.6180) < 0.05, sprintf "λ = %f, expected ≈ 2.618" lam)

[<Fact>]
let ``BRAID ENTROPY: a single crossing is reducible — entropy ≈ 0 (no exponential stretch)`` () =
    let h = BraidEntropy.growthRate 3 [ 1 ]
    Assert.True(h < 0.1, sprintf "reducible braid should force ≈0 entropy, got %f" h)
    Assert.True(BraidEntropy.dilatationEstimate 3 [ 1 ] < 1.15)

[<Fact>]
let ``BRAID ENTROPY: the empty braid forces no entropy`` () =
    Assert.Equal(0.0, BraidEntropy.growthRate 3 [])

[<Fact>]
let ``BRAID ENTROPY is a braid invariant: Artin-equal words force equal entropy`` () =
    // σ₁σ₂σ₁ = σ₂σ₁σ₂ (the Artin relation) ⇒ the same braid ⇒ the same forced entropy.
    let a = BraidEntropy.growthRate 3 [ 1; 2; 1 ]
    let b = BraidEntropy.growthRate 3 [ 2; 1; 2 ]
    Assert.True(abs (a - b) < 1e-9, sprintf "equal braids gave %f vs %f" a b)

[<Fact>]
let ``BRAID ENTROPY: pseudo-Anosov strictly dominates reducible (the bridge separates the classes)`` () =
    let pA = BraidEntropy.growthRate 3 [ 1; -2 ]
    let reducible = BraidEntropy.growthRate 3 [ 1 ]
    Assert.True(pA > reducible + 0.5, sprintf "pA %f should dominate reducible %f" pA reducible)

// --- MenoBraided: the genuine (conjugation-rack) braiding — earns braided, NOT symmetric ---

let private x0 : MenoBraided.V = Braid.gen 0
let private x1 : MenoBraided.V = Braid.gen 1
let private swapVV : Meno.Arrow<MenoBraided.V * MenoBraided.V, MenoBraided.V * MenoBraided.V> = Meno.braid

let private applyBraid (arrow: Meno.Arrow<MenoBraided.V * MenoBraided.V, MenoBraided.V * MenoBraided.V>) (p: MenoBraided.V * MenoBraided.V) =
    let (Meno.MenoArrow f) = arrow
    [ for e in f (ZSet.singleton p 1L) -> e.Key ]

[<Fact>]
let ``MENO-BRAID P4: braidR is non-symmetric — σ²≠id (earns braided, unlike the swap)`` () =
    // The tripwire that goes RED on the swap: braidR ∘ braidR must NOT return the input.
    let braidSq = applyBraid (Meno.compose MenoBraided.braidR MenoBraided.braidR) (x0, x1)
    Assert.DoesNotContain((x0, x1), braidSq)
    // Contrast — the symmetric swap DOES return to identity (σ²=id): braidR is exactly what the swap is NOT.
    let swapSq = applyBraid (Meno.compose swapVV swapVV) (x0, x1)
    Assert.Equal<(MenoBraided.V * MenoBraided.V) list>([ (x0, x1) ], swapSq)

[<Fact>]
let ``MENO-BRAID P5c: braidR realizes the braid generator σ₀ (faithfulness ⟺ Braid.equal)`` () =
    // R(x0,x1) = (x0·x1·x0⁻¹, x0) = (Braid.act [1] x0, Braid.act [1] x1) — the R-matrix IS Braid's crossing,
    // so ρ factors through Braid's faithful action and ρ-equal ⟺ Braid.equal.
    let out = applyBraid MenoBraided.braidR (x0, x1)
    let expected = (Braid.act [ 1 ] x0, Braid.act [ 1 ] x1)
    Assert.Equal<(MenoBraided.V * MenoBraided.V) list>([ expected ], out)

[<Fact>]
let ``MENO-BRAID: braidRinv inverts braidR (both orders)`` () =
    Assert.Equal<(MenoBraided.V * MenoBraided.V) list>(
        [ (x0, x1) ], applyBraid (Meno.compose MenoBraided.braidR MenoBraided.braidRinv) (x0, x1))
    Assert.Equal<(MenoBraided.V * MenoBraided.V) list>(
        [ (x0, x1) ], applyBraid (Meno.compose MenoBraided.braidRinv MenoBraided.braidR) (x0, x1))

// --- MenoBraided.rep: the n-strand braiding realizes Bₙ (Yang–Baxter, far-commute, faithful) ---

let private applyRep (braid: int list) (strands: MenoBraided.V list) =
    let (Meno.MenoArrow f) = MenoBraided.rep braid
    [ for e in f (ZSet.singleton strands 1L) -> e.Key ]

[<Fact>]
let ``MENO-BRAID P5a: the R-matrix rep satisfies Yang–Baxter (Artin σ₁σ₂σ₁ = σ₂σ₁σ₂)`` () =
    let strands = [ Braid.gen 0; Braid.gen 1; Braid.gen 2 ]
    Assert.Equal<MenoBraided.V list list>(applyRep [ 1; 2; 1 ] strands, applyRep [ 2; 1; 2 ] strands)

[<Fact>]
let ``MENO-BRAID P5b: far strands commute in the rep (σ₁σ₃ = σ₃σ₁)`` () =
    let strands = [ Braid.gen 0; Braid.gen 1; Braid.gen 2; Braid.gen 3 ]
    Assert.Equal<MenoBraided.V list list>(applyRep [ 1; 3 ] strands, applyRep [ 3; 1 ] strands)

[<Fact>]
let ``MENO-BRAID P5c: ρ realizes Bₙ faithfully — σ₁²≠id in the rep, matching Braid.equal`` () =
    let strands = [ Braid.gen 0; Braid.gen 1; Braid.gen 2 ]
    Assert.False(Braid.equal 3 [ 1; 1 ] [])                                  // σ₁² ≠ id in B₃
    Assert.NotEqual<MenoBraided.V list list>(applyRep [] strands, applyRep [ 1; 1 ] strands) // rep agrees (swap would not)
