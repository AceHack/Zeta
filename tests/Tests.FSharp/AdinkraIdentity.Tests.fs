module Zeta.Tests.AdinkraIdentityTests

// ADINKRA CODEWORDS AS SOCIETY-MEMBER IDENTITY (shadow*, Aaron 2026-07-02: the mod-2
// society "is where the James Gates adinkras fit in … secret / generator code words
// for society members based on purpose … push forward on the adinkra stuff").
//
// The doubly-even self-dual code IS ALREADY implemented + proven — `Zeta.Core.
// AdinkraCode` (the [8,4,4] extended Hamming code; 14 tests: doubly-even, self-dual,
// projector = gen(gen)=gen, syndrome). This file adds what those don't cover and
// what Aaron's framing needs:
//   1. WHY N=8 — the minimal length (no doubly-even self-dual code below 8), the E8 /
//      Clifford reason the adinkra alphabet is 8 bits (only-the-irreducible-is-
//      primitive: adinkra→Clifford→E8);
//   2. MEMBER IDENTITY SELF-CORRECTS — a member's purpose-codeword, corrupted in one
//      bit, decodes back to itself (nearest-codeword) — identity as an ECC (Gates);
//   3. the ζ tie-in — the code's WEIGHT ENUMERATOR (1 + 14y⁴ + y⁸) is a partition
//      function over member-identities by weight, the same generating-function shape
//      as the ζ name-audition slices; and member identities live on the SAME GF(2)^8
//      the scheduler round-map acts on (#9151).
//
// Anchors: S. James Gates Jr. et al. (adinkras ↔ doubly-even codes); Gleason /
// Mallows–Sloane (doubly-even self-dual ⇒ N ≡ 0 mod 8); Conway–Sloane (E8/Hamming);
// src/Core.Lean4/Lean4/CayleyDicksonDoublyEven.lean. Trajectory:
// docs/trajectories/zeta-name-audition/RESUME.md.

open global.Xunit

module AK = Zeta.Core.AdinkraCode

let private popcount (x: int) : int =
    let mutable v = x
    let mutable c = 0
    while v <> 0 do c <- c + (v &&& 1); v <- v >>> 1
    c

let private dotBits (a: int) (b: int) : int = popcount (a &&& b) % 2

/// Span of generator bitmasks (all XOR-combinations) — a general local code builder
/// for the minimal-length search (independent of the fixed-N=8 module).
let private spanOf (gens: int list) : int list =
    let g = List.toArray gens
    [ for mask in 0 .. (1 <<< g.Length) - 1 ->
        let mutable w = 0
        for i in 0 .. g.Length - 1 do
            if (mask >>> i) &&& 1 = 1 then w <- w ^^^ g.[i]
        w ]
    |> List.distinct

/// Does a doubly-even self-dual [n, n/2] code exist in GF(2)^n? Exhaustive.
let private hasDoublyEvenSelfDual (n: int) : bool =
    let dim = n / 2
    let doublyEven v = popcount v % 4 = 0
    let deVecs = [ 1 .. (1 <<< n) - 1 ] |> List.filter doublyEven
    let rec pick chosen pool =
        if List.length chosen = dim then
            let c = spanOf chosen
            List.length c = (1 <<< dim)
            && List.forall doublyEven c
            && List.forall (fun a -> List.forall (fun b -> dotBits a b = 0) c) c
        else
            match pool with
            | [] -> false
            | x :: rest -> pick (x :: chosen) rest || pick chosen rest
    pick [] deVecs

// int[]-codeword helpers over the existing module's representation
let private toBits (cw: int[]) : int = Array.fold (fun acc b -> (acc <<< 1) ||| (b &&& 1)) 0 cw
let private hamming (a: int[]) (b: int[]) : int = AK.weight (AK.xor a b)

[<Fact>]
let ``WHY N=8: the minimal length of a doubly-even self-dual code (no such code below 8)`` () =
    // The adinkra alphabet is 8 bits because that is the SMALLEST doubly-even
    // self-dual code (Gleason/Mallows–Sloane: N ≡ 0 mod 8). This is the E8/Clifford
    // floor the whole adinkra→Clifford→E8 ladder stands on.
    Assert.False(hasDoublyEvenSelfDual 2, "none at N=2")
    Assert.False(hasDoublyEvenSelfDual 4, "none at N=4")
    Assert.False(hasDoublyEvenSelfDual 6, "none at N=6")
    Assert.True(hasDoublyEvenSelfDual 8, "the [8,4,4] adinkra code exists at N=8")

[<Fact>]
let ``member identity SELF-CORRECTS: a purpose-codeword corrupted in one bit decodes back to itself`` () =
    // min distance 4 ⇒ corrects ⌊(4−1)/2⌋ = 1 bit. A society member's purpose-codeword,
    // corrupted, recovers its identity by nearest-codeword decoding. (Gates: identity
    // is an error-correcting code.)
    let identity = AK.allCodewords |> List.find (fun c -> AK.weight c = 4)   // a purpose id
    for bit in 0 .. AK.length - 1 do
        let corrupted = Array.copy identity
        corrupted.[bit] <- corrupted.[bit] ^^^ 1                              // flip one bit
        let nearest = AK.allCodewords |> List.minBy (hamming corrupted)
        Assert.Equal<int[]>(identity, nearest)                               // identity recovered

[<Fact>]
let ``distinct purpose = distinct identity: the 14 weight-4 codewords are all ≥ distance 4 apart`` () =
    // any two DIFFERENT member identities differ in ≥ 4 bits — purposes don't collide,
    // and no 1-bit corruption of one can be mistaken for another.
    let ids = AK.allCodewords |> List.filter (fun c -> AK.weight c = 4)
    Assert.Equal(14, List.length ids)
    for a in ids do
        for b in ids do
            if toBits a <> toBits b then Assert.True(hamming a b >= 4, "identities must be ≥ distance 4")

[<Fact>]
let ``ζ tie-in: the weight enumerator is a partition function 1 + 14y^4 + y^8 over member identities`` () =
    // the code's weight enumerator W(y) = Σ_c y^weight(c) is a generating function
    // over member identities by weight — the same shape as the ζ name-audition slices'
    // Euler products / partition functions.
    let byWeight = AK.allCodewords |> List.countBy AK.weight |> Map.ofList
    Assert.Equal(1, byWeight.[0])       // the empty/quiescent identity (cf. the scheduler's all-zeros)
    Assert.Equal(14, byWeight.[4])      // the 14 purpose identities
    Assert.Equal(1, byWeight.[8])       // the all-ones (fully-braided) identity
    Assert.Equal(16, AK.allCodewords |> List.length)
