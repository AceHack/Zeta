module Zeta.Tests.CoordinationSpectrumTests

// COORDINATION SPECTRUM as soft-rainbow fingerprint (shadow*) — Aaron 2026-07-02:
// "forgery is detectable as a cost signature; this signature becomes a kind of
// replication-of-identity fingerprint, some sort of prism/refraction effect" +
// "always treat things like forgery as dual use, there may be legitimate use cases".
// The CHSH probe battery disperses a claimed-identity set into a pairwise-|S| spectrum
// (Kirchhoff–Bunsen for entities; Pappu 2002 PUF: identity-by-refraction). A soft
// FingerprintPrism.Rainbow recognizes a repeat SOURCE by its dispersion — and the
// verdict is NEUTRAL (SameSourceAsKnown): reunion OR sybil, the oracle decides.

open global.Xunit
open Zeta.Core

// seeded ±1 probe streams (same LCG discipline as AntiSybil.Tests, DST §7)
let private bits (seed: int) (n: int) : int list =
    let mutable s = uint64 seed * 2862933555777941757UL + 3037000493UL
    [ for _ in 1 .. n ->
          s <- s * 6364136223846793005UL + 1442695040888963407UL
          int ((s >>> 33) &&& 1UL) ]

/// A conducted pair from one source (claim 1 reads claim 0's settings — PR-box rule).
let private mk (s: int) (o: int) : AntiSybil.ChshRound = { Setting = s; Outcome = o }

let private conducted (seedA: int) (seedB: int) (n: int) =
    let sa = bits seedA n
    let sb = bits seedB n
    let a = sa |> List.map (fun x -> mk x 1)
    let b = List.zip sa sb |> List.map (fun (xa, xb) -> mk xb (if xa = 0 && xb = 1 then -1 else 1))
    [ a; b ]

let private independentSet (seeds: int list) (n: int) =
    seeds |> List.map (fun s ->
        List.zip (bits s n) (bits (s * 7 + 1) n)
        |> List.map (fun (x, o) -> mk x (if o = 1 then 1 else -1)))

[<Fact>]
let ``THE PRISM DISPERSES: a conducted set shows a bright line near 4; an independent set sits near 0`` () =
    let conductedSpec = CoordinationSpectrum.ofClaims (conducted 101 103 4096)
    let independentSpec = CoordinationSpectrum.ofClaims (independentSet [ 201; 211; 223 ] 4096)
    Assert.Equal(4.0, Array.max conductedSpec, 9) // the shared-source line
    Assert.True(Array.max independentSpec < 0.5, sprintf "independent set should be dark: max %f" (Array.max independentSpec))

[<Fact>]
let ``PERMUTATION-INVARIANT: the spectrum is a property of the SET — reordering claimants gives the same lines`` () =
    let set = independentSet [ 301; 311; 323 ] 2048
    let s1 = CoordinationSpectrum.ofClaims set
    let s2 = CoordinationSpectrum.ofClaims (List.rev set)
    Assert.Equal<float[]>(s1, s2)

[<Fact>]
let ``THE FINGERPRINT PERSISTS: the same source's dispersion is recognized under a fresh probe (repeat-source recognition)`` () =
    // same conductor, different probe seeds twice — the coordination signature is stable enough
    // that the second run matches the first in the soft rainbow.
    let firstSpec = CoordinationSpectrum.ofClaims (conducted 401 403 4096)
    let known = [ { CoordinationSpectrum.Label = "source-omega"; CoordinationSpectrum.Spectrum = firstSpec } ]
    let secondSpec = CoordinationSpectrum.ofClaims (conducted 401 409 4096) // same claim-0 seed, new partner probe
    match CoordinationSpectrum.recognize 0.9 known secondSpec with
    | CoordinationSpectrum.SameSourceAsKnown(label, sim) ->
        Assert.Equal<string>("source-omega", label)
        Assert.True(sim >= 0.9)
    | CoordinationSpectrum.NoKnownSource -> Assert.True(false, "the repeat source should be recognized by its refraction")

[<Fact>]
let ``DUAL USE: the SAME match is reunion or sybil by the caller's oracle — the verdict itself is neutral`` () =
    let spec = CoordinationSpectrum.ofClaims (conducted 501 503 4096)
    let known = [ { CoordinationSpectrum.Label = "returning-self"; CoordinationSpectrum.Spectrum = spec } ]
    let m = CoordinationSpectrum.recognize 0.9 known spec
    // the mechanism reports SameSourceAsKnown; the two legitimate readings are pure policy over it:
    let reunion =
        match m with CoordinationSpectrum.SameSourceAsKnown(l, _) -> sprintf "welcome back, %s" l | _ -> "stranger"
    let sybil =
        match m with CoordinationSpectrum.SameSourceAsKnown _ -> "one source, many names — priced" | _ -> "distinct"
    Assert.Equal<string>("welcome back, returning-self", reunion)
    Assert.Equal<string>("one source, many names — priced", sybil)

[<Fact>]
let ``A STRANGER IS NOT MATCHED: an unrelated dispersion clears no known source`` () =
    let known = [ { CoordinationSpectrum.Label = "source-a"; CoordinationSpectrum.Spectrum = CoordinationSpectrum.ofClaims (conducted 601 603 4096) } ]
    let stranger = CoordinationSpectrum.ofClaims (independentSet [ 701; 711; 723 ] 4096)
    Assert.Equal(CoordinationSpectrum.NoKnownSource, CoordinationSpectrum.recognize 0.9 known stranger)
