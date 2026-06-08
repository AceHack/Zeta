module Zeta.Tests.AmplitudeEmuTests

open System
open global.Xunit
open Zeta.Core

let private frame () = Chip8Cow.create 7UL |> Chip8Cow.loadRom [| 0x60uy; 0x01uy |]

// amplitude with magnitude 1 at phase θ
let private phasor (theta: float) : Complex = { Real = cos theta; Imag = sin theta }

[<Fact>]
let ``DESTRUCTIVE interference: two equal frames, opposite phase, cancel to nothing`` () =
    let f = frame ()
    // amplitude +1 and amplitude -1 (phase π apart) on the SAME frame
    let a: AmplitudeEmu.Amp = [ f, phasor 0.0; f, phasor Math.PI ]
    let merged = AmplitudeEmu.merge a
    Assert.Empty(merged) // the path cancelled — wave phase cancellation, in code

[<Fact>]
let ``CONSTRUCTIVE interference: two equal frames, same phase, reinforce (intensity 4×)`` () =
    let f = frame ()
    let a: AmplitudeEmu.Amp = [ f, phasor 0.0; f, phasor 0.0 ] // 1 + 1 = 2 amplitude
    let merged = AmplitudeEmu.merge a
    Assert.Equal(1, AmplitudeEmu.support merged)
    // |1+1|² = 4 (vs |1|²+|1|² = 2 for a classical mixture) — the interference signature
    Assert.Equal(4.0, AmplitudeEmu.intensity merged, 9)

[<Fact>]
let ``partial interference: 90 degrees apart adds in quadrature (intensity 2, not 4 or 0)`` () =
    let f = frame ()
    let a: AmplitudeEmu.Amp = [ f, phasor 0.0; f, phasor (Math.PI / 2.0) ] // 1 + i, |1+i|² = 2
    Assert.Equal(2.0, AmplitudeEmu.intensity (AmplitudeEmu.merge a), 9)

[<Fact>]
let ``bornProb is a normalized probability distribution`` () =
    let f1 = frame ()
    let f2 = Chip8Cow.create 9UL |> Chip8Cow.loadRom [| 0x60uy; 0x02uy |]
    let a: AmplitudeEmu.Amp = [ f1, phasor 0.0; f2, phasor 1.0 ]
    let ps = AmplitudeEmu.bornProb a
    Assert.Equal(1.0, ps |> List.sumBy snd, 9)
    Assert.All(ps, fun (_, p) -> Assert.True(p >= 0.0 && p <= 1.0))

[<Fact>]
let ``ofSoft lifts a classical mixture to phase-0 amplitudes (|amp|² = weight)`` () =
    let soft = SoftEmu.softRun 1 (Chip8Cow.create 7UL |> Chip8Cow.loadRom [| 0x60uy; 0x01uy |] |> SoftEmu.pure1)
    let amp = AmplitudeEmu.ofSoft soft
    // phase-0 lift: Born probabilities equal the original real weights
    let born = AmplitudeEmu.bornProb amp |> List.sortBy (fun (f, _) -> int f.PC) |> List.map snd
    let orig = soft |> List.sortBy (fun (f, _) -> int f.PC) |> List.map snd
    Assert.Equal(orig.Length, born.Length)
    List.zip orig born |> List.iter (fun (o, b) -> Assert.Equal(o, b, 9))

[<Fact>]
let ``normalize makes total intensity 1`` () =
    let f = frame ()
    let a: AmplitudeEmu.Amp = [ f, { Real = 3.0; Imag = 4.0 } ] // |z|=5
    Assert.Equal(1.0, AmplitudeEmu.intensity (AmplitudeEmu.normalize a), 9)
