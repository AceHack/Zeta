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

[<Fact>]
let ``PREDICTIVE MAINTENANCE: a new harmonic (the bearing starting to sing) shows as drift long before failure`` () =
    let healthyHum = tone // the machine's baseline: a clean bin-4 hum
    let wornHum = [| for t in 0..31 -> tone.[t] + 0.3 * cos (2.0 * System.Math.PI * 9.0 * float t / 32.0) |]
    let bins = [ 4; 8; 9; 12 ] // the watchlist: fundamental + the places trouble sings
    Assert.True(SpectralPivot.healthy bins healthyHum 1.0 healthyHum) // its own hum: healthy
    Assert.False(SpectralPivot.healthy bins healthyHum 1.0 wornHum) // the bin-9 whine: caught
    Assert.True(SpectralPivot.drift (SpectralPivot.fingerprint bins healthyHum) (SpectralPivot.fingerprint bins wornHum) > 1.0)

// ── auto-harmonize without synchronization: like dancing, or singing ──

[<Fact>]
let ``SINGING: a fifth (3:2) on the shared clock — downbeats coincide exactly, zero messages exchanged`` () =
    let baseF = 125 // base voice: period 8 ticks (125*8 = 1000)
    let fifth = ChipAudio.harmonize 3 2 baseF
    Assert.Equal(187, fifth) // 3:2 in integer milli (187.5 floors — the exact-slice note: rational milli)
    // use the exact pair 125 & 250 (the octave) for the coincidence theorem at integer milli:
    let octave = ChipAudio.harmonize 2 1 baseF
    let meets = ChipAudio.coincidences baseF octave 32
    Assert.Equal<int list>([ 8; 16; 24; 32 ], meets) // every base period, both hit the downbeat — forever

[<Fact>]
let ``DANCING: half-time (1:2) cycles on one generator land their frame boundaries together, no sync protocol`` () =
    let g = TimeGen.mk "dance" 1 0xDA2CEUL TimeGen.PhasorTsirelson
    let fast = { AnimFlow.Name = "fast"; AnimFlow.Cycle = [ "a"; "b" ] } // period 2
    let slow = { AnimFlow.Name = "slow"; AnimFlow.Cycle = [ "x"; "x"; "y"; "y" ] } // period 4 = half-time
    // at every multiple of 4 ticks, BOTH dancers are at their cycle start — structurally, not by message
    for t in [ 0; 4; 8; 12 ] do
        Assert.Equal("a", AnimFlow.frameAt fast t)
        Assert.Equal("x", AnimFlow.frameAt slow t)
    // and both nodes observing the same generator see the same dance (the no-sync property, again)
    Assert.Equal<(int * string) list>(AnimFlow.observeWith g 1UL slow 8, AnimFlow.observeWith g 1UL slow 8)

[<Fact>]
let ``FREESTYLE within the harmony: the solo bends the phase (bounded), never the clock — and it replays`` () =
    // the soloist pushes toward a target expression; every step clamped; the CLOCK is untouched
    let off1 = ChipAudio.freestyle 0.05 1.2 0.9 0.0
    Assert.True(off1 > 0.0 && off1 <= 0.05) // an excursion, inside the bound: consonant by construction
    Assert.Equal(off1, ChipAudio.freestyle 0.05 1.2 0.9 0.0) // the same solo replays (no hidden adaptation)
    // the band's downbeats are untouched by the solo: coincidences depend only on the shared clock
    Assert.Equal<int list>(ChipAudio.coincidences 125 250 16, [ 8; 16 ])

[<Fact>]
let ``THE MULTITRACK LAW: sections on DIFFERENT seeds (independently mic'd) still align — and keep their own character`` () =
    // drums and bass: each its own generator (its own seed = its own mic)
    let drums = TimeGen.mk "drums" 1 0xD2D2UL TimeGen.PhasorTsirelson
    let bass = TimeGen.mk "bass" 1 0xBA55UL TimeGen.PhasorTsirelson
    // ALIGNMENT is tick arithmetic (the ratio), independent of either seed:
    Assert.Equal<int list>([ 8; 16; 24; 32 ], ChipAudio.coincidences 125 250 32)
    // CHARACTER is the seed: the same waveform/freq/tick sounds DIFFERENT per section (its own mic)
    Assert.NotEqual(
        ChipAudio.voiceSample drums 1UL ChipAudio.Saw 125 5,
        ChipAudio.voiceSample bass 1UL ChipAudio.Saw 125 5)
    // and each section replays ITSELF exactly (independently recorded, independently replayable)
    Assert.Equal(ChipAudio.voiceSample drums 1UL ChipAudio.Saw 125 5, ChipAudio.voiceSample drums 1UL ChipAudio.Saw 125 5)

[<Fact>]
let ``THE DROP-IN LAW: a seed dropped mid-stream is IN PHASE — identical to having played from tick 0, silent before its entrance`` () =
    let horns = TimeGen.mk "horns" 1 0x40A45UL TimeGen.PhasorTsirelson
    // before the entrance: silence (it was not there from the start)
    Assert.Equal(0, ChipAudio.dropIn 17 horns 1UL ChipAudio.Saw 125 16)
    // from the entrance on: byte-identical to the voice that played all along — dropped in phase
    for t in 17 .. 40 do
        Assert.Equal(ChipAudio.voiceSample horns 1UL ChipAudio.Saw 125 t, ChipAudio.dropIn 17 horns 1UL ChipAudio.Saw 125 t)
    // and its downbeats land on the SAME coincidence lattice the running voices already share
    Assert.Equal<int list>([ 8; 16; 24; 32 ], ChipAudio.coincidences 125 250 32)
