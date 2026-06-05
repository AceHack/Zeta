module Zeta.Tests.CayleyDicksonAdinkraTests

open System.Collections.Generic
open global.Xunit
open Zeta.Core

module AK = Zeta.Core.AdinkraCode

// ═══════════════════════════════════════════════════════════════════
// Cayley-Dickson → Adinkra generator derivation.
//
// The honest chain (published mathematics): the octonion (Cayley-Dickson) MULTIPLICATION TABLE encodes
// the FANO PLANE — the 7 imaginary units e₁..e₇, with eₐ·e_b = ±e_c giving 7 triples that form a Steiner
// triple system S(2,3,7). The Fano plane GENERATES the [7,4] Hamming code (dimension 4); its [8,4]
// doubly-even EXTENSION is the Adinkra code (AdinkraCode.fs, the extended Hamming code).
//
// Proven HERE from the ACTUAL octonion product in CayleyDickson.fs (convention-independent core):
//   1. the 7 multiplication triples exist and each lies in 1..7, distinct;
//   2. they form a Fano plane (every pair in exactly one triple; each unit in exactly 3);
//   3. their GF(2) span has dimension 4 — the [7,4] Hamming dimension;
//   4. the parity-extended code (16 words) is doubly-even (weight ≡ 0 mod 4) — the SAME invariant
//      AdinkraCode proves, so both are [8,4] doubly-even codes.
// Honest scope: the final identification "= AdinkraCode" rests on the uniqueness of the [8,4] extended
// Hamming code up to coordinate equivalence (a cited fact); the octonion→Fano→Hamming→doubly-even chain
// is derived here, not assumed.
// ═══════════════════════════════════════════════════════════════════

// Flatten an octonion to its 8 real coordinates (index 0 = real, 1..7 = imaginary units).
let private flatten (o: Octonion) : float[] =
    let c (x: Complex) = [| x.Real; x.Imag |]
    let q (x: Quaternion) = Array.append (c x.Real) (c x.Imag)
    Array.append (q o.Real) (q o.Imag)

// The k-th basis octonion (1.0 at coordinate k, else 0).
let private basis (k: int) : Octonion =
    let a = Array.zeroCreate 8
    a.[k] <- 1.0
    let mkC i : Complex = { Real = a.[i]; Imag = a.[i + 1] }
    let mkQ i : Quaternion = { Real = mkC i; Imag = mkC (i + 2) }
    { Real = mkQ 0; Imag = mkQ 4 }

let private oalg = Zeta.Core.ImaginaryStack.octonion

// For each pair of imaginary units a<b, eₐ·e_b = ±e_c — extract (a,b,c) and collapse to sorted triples.
let private rawProducts : (int * int * int) list =
    [ for a in 1..7 do
        for b in (a + 1) .. 7 do
            let p = flatten (oalg.Mul(basis a, basis b))
            let c = [ 0..7 ] |> List.find (fun i -> abs p.[i] > 0.5)
            yield (a, b, c) ]

let private triples : (int * int * int) list =
    rawProducts
    |> List.map (fun (a, b, c) ->
        match List.sort [ a; b; c ] with
        | [ x; y; z ] -> (x, y, z)
        | _ -> failwith "unreachable")
    |> List.distinct

// ── GF(2) helpers (7-bit vectors as int bitmasks) ──
let private popcount (x: int) : int =
    let mutable c = 0
    let mutable y = x
    while y <> 0 do
        c <- c + (y &&& 1)
        y <- y >>> 1
    c

let private gf2rank (vecs: int list) : int =
    let pivot = Dictionary<int, int>()
    let highbit x =
        let mutable b = -1
        let mutable y = x
        while y <> 0 do
            b <- b + 1
            y <- y >>> 1
        b
    let mutable rank = 0
    for v0 in vecs do
        let mutable v = v0
        let mutable go = true
        while go && v <> 0 do
            let h = highbit v
            match pivot.TryGetValue h with
            | true, pv -> v <- v ^^^ pv
            | _ ->
                pivot.[h] <- v
                rank <- rank + 1
                go <- false
    rank

let private span (vecs: int list) : int list =
    let mutable s = Set.singleton 0
    for v in vecs do
        s <- Set.union s (Set.map (fun x -> x ^^^ v) s)
    Set.toList s

let private mask (a, b, c) = (1 <<< (a - 1)) ||| (1 <<< (b - 1)) ||| (1 <<< (c - 1))

// ── the derivation ──

[<Fact>]
let ``octonion multiplication yields 7 imaginary triples, each distinct in 1..7`` () =
    Assert.Equal(7, List.length triples)
    for (a, b, c) in triples do
        Assert.True(a >= 1 && c <= 7 && a < b && b < c) // sorted, all in 1..7
    // every product index c is a genuine third unit (≠ the two factors)
    for (a, b, c) in rawProducts do
        Assert.True(c >= 1 && c <= 7 && c <> a && c <> b)

[<Fact>]
let ``the triples form a Fano plane — every pair in exactly one triple`` () =
    let pairCount = Dictionary<int * int, int>()
    for (a, b, c) in triples do
        for (x, y) in [ (a, b); (a, c); (b, c) ] do
            let key = (min x y, max x y)
            pairCount.[key] <- (match pairCount.TryGetValue key with true, n -> n | _ -> 0) + 1
    // all 21 pairs over {1..7} appear exactly once
    Assert.Equal(21, pairCount.Count)
    for kv in pairCount do
        Assert.Equal(1, kv.Value)

[<Fact>]
let ``each imaginary unit lies in exactly 3 triples (Fano incidence)`` () =
    let unitCount = Array.zeroCreate 8
    for (a, b, c) in triples do
        for u in [ a; b; c ] do
            unitCount.[u] <- unitCount.[u] + 1
    for u in 1..7 do
        Assert.Equal(3, unitCount.[u])

[<Fact>]
let ``the Fano triples span the [7,4] Hamming code — GF(2) dimension 4`` () =
    Assert.Equal(4, gf2rank (triples |> List.map mask))

[<Fact>]
let ``the parity-extended code is doubly-even — the Adinkra invariant, derived from the octonions`` () =
    let code7 = span (triples |> List.map mask) // the [7,4] code (16 words)
    Assert.Equal(16, List.length code7)
    for w in code7 do
        let parity = popcount w % 2
        let extended = w ||| (parity <<< 7) // append the overall-parity bit → [8,4]
        Assert.Equal(0, popcount extended % 4) // doubly-even — same property AdinkraCode proves

[<Fact>]
let ``both the octonion-derived extension and AdinkraCode are [8,4] doubly-even codes`` () =
    // octonion-derived: length 8, dimension 4, all doubly-even (above). AdinkraCode: same invariants
    // (proven in AdinkraCode.Tests). The [8,4] extended Hamming code is unique up to coordinate
    // equivalence, so they are the same code — the Adinkra generator, derived from Cayley-Dickson.
    Assert.Equal(8, AK.length)
    Assert.Equal(4, AK.dimension)
    for cw in AK.allCodewords do
        Assert.Equal(0, AK.weight cw % 4)
    Assert.Equal(4, gf2rank (triples |> List.map mask)) // octonion side: also dimension 4
