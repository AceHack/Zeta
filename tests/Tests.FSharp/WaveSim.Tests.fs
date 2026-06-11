module Zeta.Tests.WaveSimTests

// Honest interference: superposition IS the Cayley complex Add; the TEST is the physics — bright
// where path difference = nλ, dark at λ/2 — not a screenshot. Deterministic; labels honest.

open global.Xunit
open Zeta.Core

// two sources on a horizontal line, the classic double-slit geometry
let private slits = [ WaveSim.source 20.0 16.0 4.0 1.0; WaveSim.source 28.0 16.0 4.0 1.0 ]

[<Fact>]
let ``CONSTRUCTIVE on the center line: equidistant cells see double amplitude (intensity 4x a single source)`` () =
    // the midline x=24: path difference 0 => phasors aligned => |2A|^2 = 4A^2
    let two = WaveSim.intensityAt 0.0 0 slits 24.0 30.0
    let one = WaveSim.intensityAt 0.0 0 [ List.head slits ] 24.0 30.0
    Assert.True(two > 3.5 * one) // constructive: ~4x (slack for distance falloff-free model)

[<Fact>]
let ``DESTRUCTIVE at half-wavelength path difference: a dark fringe (intensity near zero)`` () =
    // find a cell where |d1 - d2| ≈ λ/2 = 2.0: source A at (20,16), B at (28,16); cell on the line
    // between them at x=23: d1=3, d2=5 -> difference 2.0 exactly
    let dark = WaveSim.intensityAt 0.0 0 slits 23.0 16.0
    Assert.True(dark < 0.01) // the phasors cancel — the fringe is REAL math, not painted

[<Fact>]
let ``the pattern FRINGES: along a screen line, intensity alternates (maxima and minima both present)`` () =
    let screen = [ for x in 0..47 -> WaveSim.intensityAt 0.0 0 slits (float x) 31.0 ]
    let mx, mn = List.max screen, List.min screen
    Assert.True(mx > 3.0 && mn < 0.5) // bright and dark bands coexist: interference, visibly

[<Fact>]
let ``superposition is LITERALLY the Cayley Add — and the simulation is bit-stable (same inputs, same pattern)`` () =
    let a = WaveSim.pattern 0.5 7 slits 32 16
    let b = WaveSim.pattern 0.5 7 slits 32 16
    Assert.Equal<float[,]>(a, b) // deterministic every run
    // the algebra check: field of two = Add of the two phasors
    let p1 = WaveSim.phasorAt 0.0 0 slits.[0] 24.0 30.0
    let p2 = WaveSim.phasorAt 0.0 0 slits.[1] 24.0 30.0
    let sum = ImaginaryStack.complex.Add(p1, p2)
    let f = WaveSim.fieldAt 0.0 0 slits 24.0 30.0
    Assert.Equal(sum.Real, f.Real, 12)
    Assert.Equal(sum.Imag, f.Imag, 12)

[<Fact>]
let ``registered + cost-declared; the budget lint holds`` () =
    Assert.True(GeneratorRegistry.byName "sim.wave-interference" |> Option.isSome)
    Assert.Equal<string list>([], ComplexityRegistry.unstated ())

[<Fact>]
let ``UV and IR: out-of-gamut intensity rides the deep cell — invisible to the display, real to the physics`` () =
    // the visible 3-bit gamut shows mask only; the INVISIBLE bands (IR below, UV above) ride the
    // payload, declared as a dimension rebind — the lens overlay is the IR camera
    let irDecl = "dimension\tir\tpayload-field\tinfrared-band-intensity-milli\ndimension\tuv\tpayload-field\tultraviolet-band-intensity-milli"
    match MediaLines.parse irDecl with
    | Ok d -> Assert.Equal<MediaLines.LintFinding list>([], MediaLines.lint d) // declared, lint-clean
    | Error e -> failwith e
    // a hot-but-dark pixel: visibly black, IR-bright — the heat ledger radiating into the cell
    let hotDark = PixelLens.pack 0uy 850 0 // visible: nothing; payload: 850 milli of IR
    Assert.Equal(0uy, PixelLens.color.Get hotDark) // the display sees darkness
    Assert.Equal(850, PixelLens.payload.Get hotDark) // the IR camera (the rebound lens) sees the heat
