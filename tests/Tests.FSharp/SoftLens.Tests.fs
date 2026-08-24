module Zeta.Tests.SoftLensTests

// The soft-lensing sweep: similarity peaks find fingerprints; confidence peaks find solid ground.
// First real field: a CHIP-9 self-trace — the sweep finds the loop's attractor pattern in the
// machine's own worldline (the archaeologist's instrument, working).

open global.Xunit
open Zeta.Core

// a field with a planted pattern: an 8x8 block of 0xAB bytes at (10,4) in a 32x16 zero field
let private read x y = if x >= 10 && x < 18 && y >= 4 && y < 12 then 0xABuy else 0x00uy
// confidence: high inside a "measured" region (x<20), low beyond it
let private conf x _ = if x < 20 then 0.95 else 0.2

[<Fact>]
let ``the sweep finds the planted fingerprint at its true location (the top peak)`` () =
    let needle = Array.create 64 0xABuy // the 8x8 pattern we're looking for
    let foci = SoftLens.sweep read conf needle 32 16 8 8
    let top = SoftLens.fingerprints 0.9 foci |> List.head
    Assert.Equal((10, 4), (top.X, top.Y))
    Assert.Equal(1.0, top.Similarity, 9) // exact match at the true site

[<Fact>]
let ``solid ground is the OTHER channel: certainty peaks are where the field was measured`` () =
    let foci = SoftLens.sweep read conf (Array.create 64 0uy) 32 16 8 8
    let ground = SoftLens.solidGround 0.9 foci
    Assert.True(ground |> List.forall (fun f -> f.X + 8 <= 20)) // standing room only where measured
    Assert.True(List.length ground > 0)

[<Fact>]
let ``the sweep repeats within a run and is total (every focus visited)`` () =
    // CLAIM LOWERED 2026-08-23 (Soraya), workitem 081M0RAX8AC087G0R003NQM7P9. The name used to read
    // "deterministic and total (zero clocks — every focus independent)". "Zero clocks" is a 2-safety
    // claim: it quantifies over pairs of executions under DIFFERENT ambient clocks. Two calls
    // microseconds apart share theirs, so this pair cannot witness a clock leak, and `sweep` takes
    // no clock to vary. The repeatability and totality below are real and are what the name now says.
    let needle = Array.create 64 0xABuy
    let a = SoftLens.sweep read conf needle 32 16 8 8
    Assert.Equal<SoftLens.Focus list>(a, SoftLens.sweep read conf needle 32 16 8 8)
    Assert.Equal((32 - 8 + 1) * (16 - 8 + 1), List.length a) // every focus visited

[<Fact>]
let ``ON A REAL FIELD: the sweep finds the self-trace's attractor in the machine's own worldline`` () =
    // run the BREATHE-style loop self-tracing; sweep for a horizontal run of trace-green cells
    let loopRom = [| 0xA2uy; 0x08uy; 0xD0uy; 0x01uy; 0x12uy; 0x00uy; 0x00uy; 0x00uy; 0xFFuy |]
    let traced = Chip9SelfTrace.run 0 12 (Chip8Cow.create 7UL |> Chip8Cow.loadRom loopRom)
    let readTrace x y = if Chip8Cow.colorAt x y traced &&& 2uy <> 0uy then 1uy else 0uy
    // needle: a 4x1 run of executed cells (the loop's worldline shape: slots 0..2 + part of the jump cycle)
    let needle = [| 1uy; 1uy; 1uy; 0uy |]
    let foci = SoftLens.sweep readTrace (fun _ _ -> 1.0) needle 64 32 4 1
    let top = SoftLens.fingerprints 0.99 foci |> List.head
    Assert.Equal((0, 0), (top.X, top.Y)) // the attractor found at the program's own first cells
