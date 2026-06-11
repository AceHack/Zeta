module Zeta.Tests.SpectralPivotTests

// The spectral pivot: hard = the exact, INVERTIBLE basis change (round-trip is the test); soft = the
// probe fingerprint (right pitch >> wrong pitch). The same Cayley complex hears pitch now.

open global.Xunit
open Zeta.Core

// a pure tone at bin 4 of 32 samples (from our own chip waveform family — the saw's fundamental sibling)
let private tone =
    [| for t in 0..31 -> cos (2.0 * System.Math.PI * 4.0 * float t / 32.0) |]

[<Fact>]
let ``HARD fingerprint: the DFT finds the pitch — bin 4 dominates everything else`` () =
    let spec = SpectralPivot.dft tone
    let e4 = SpectralPivot.energy spec.[4]
    for k in [ 1; 2; 3; 5; 7; 11 ] do
        Assert.True(e4 > 100.0 * SpectralPivot.energy spec.[k])

[<Fact>]
let ``THE PIVOT IS LOSSLESS: idft (dft signal) recovers the signal (two bases, one signal)`` () =
    let back = SpectralPivot.idft (SpectralPivot.dft tone)
    for t in 0..31 do
        Assert.Equal(tone.[t], back.[t], 9)

[<Fact>]
let ``SOFT probe: the right pitch answers loud, the wrong pitch answers quiet — the spectral soft-prism`` () =
    Assert.True(SpectralPivot.probe tone 4 > 100.0 * SpectralPivot.probe tone 7)
    let fp = SpectralPivot.fingerprint [ 2; 4; 8 ] tone
    Assert.Equal(3, List.length fp) // it looked at exactly what it said it would
    Assert.True(snd fp.[1] > snd fp.[0] && snd fp.[1] > snd fp.[2])

[<Fact>]
let ``our own square wave fingerprints as physics says: odd harmonics only (bin 4 and 12 live, bin 8 dark)`` () =
    let square = [| for t in 0..31 -> if (t / 4) % 2 = 0 then 1.0 else -1.0 |] // period 8 = 4 cycles in 32
    let f = SpectralPivot.probe square
    Assert.True(f 4 > 50.0 * f 8) // the even harmonic is silent — the square's signature
    Assert.True(f 12 > f 8) // the third harmonic rings

[<Fact>]
let ``deterministic + registered + cost-declared (hard O(n²) honest; the n·log n upgrade is named)`` () =
    Assert.Equal<(int * float) list>(SpectralPivot.fingerprint [ 4 ] tone, SpectralPivot.fingerprint [ 4 ] tone)
    Assert.True(GeneratorRegistry.byName "spectral.hard-dft" |> Option.isSome)
    Assert.True(GeneratorRegistry.byName "spectral.soft-probe" |> Option.isSome)
    Assert.Equal<string list>([], ComplexityRegistry.unstated ())
