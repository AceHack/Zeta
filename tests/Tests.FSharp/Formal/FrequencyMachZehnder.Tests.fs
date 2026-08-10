// FrequencyMachZehnder.Tests.fs
// Tests for the frequency-domain lift of the CHSH monitor.
// Verifies: PLV computation, CHSH S ceiling, product-state bound, ideal-offset ceiling,
// partial-coherence downweighting, local-time caveat (windowing artifact detection).

namespace Zeta.Tests.FSharp

open Xunit
open System
open Zeta.Core

module FrequencyMachZehnderTests =

    // ── FMZ-1: Perfect coherence (PLV=1) gives CHSH S = 2√2 ─────────────────
    [<Fact>]
    let ``FMZ-1: perfect coherence at ideal CHSH angles gives S = 2√2`` () =
        // Ideal CHSH angles: Alice a₀=0, a₁=π/2; Bob b₀=π/4, b₁=−π/4
        // E(a,b) = cos(a−b), so:
        //   E(0, π/4)    = cos(−π/4) = 1/√2
        //   E(0, −π/4)   = cos(π/4)  = 1/√2
        //   E(π/2, π/4)  = cos(π/4)  = 1/√2
        //   E(π/2, −π/4) = cos(3π/4) = −1/√2
        // S = 1/√2 − 1/√2 + 1/√2 + (−(−1/√2)) = wait, let's compute directly:
        // S = E00 − E01 + E10 + E11
        //   = cos(0−π/4) − cos(0−(−π/4)) + cos(π/2−π/4) + cos(π/2−(−π/4))
        //   = cos(−π/4) − cos(π/4) + cos(π/4) + cos(3π/4)
        //   = 1/√2 − 1/√2 + 1/√2 + (−1/√2) = 0  ... that's wrong
        // The standard CHSH with PLV correlator:
        //   offset00 = 0 − π/4 = −π/4, PLV=1 → E = cos(−π/4) = 1/√2
        //   offset01 = 0 − (−π/4) = π/4, PLV=1 → E = cos(π/4) = 1/√2
        //   offset10 = π/2 − π/4 = π/4, PLV=1 → E = cos(π/4) = 1/√2
        //   offset11 = π/2 − (−π/4) = 3π/4, PLV=1 → E = cos(3π/4) = −1/√2
        // S = E00 − E01 + E10 + E11 = 1/√2 − 1/√2 + 1/√2 − 1/√2 = 0
        // The standard CHSH uses: S = E(a0,b0) − E(a0,b1) + E(a1,b0) + E(a1,b1)
        // For the |Φ+⟩ state: E(a,b) = cos(a−b)
        // Optimal angles: a0=0, a1=π/2, b0=π/4, b1=3π/4
        //   E(0,π/4) = cos(π/4) = 1/√2
        //   E(0,3π/4) = cos(3π/4) = −1/√2
        //   E(π/2,π/4) = cos(π/4) = 1/√2
        //   E(π/2,3π/4) = cos(−π/4) = 1/√2
        // S = 1/√2 − (−1/√2) + 1/√2 + 1/√2 = 4/√2 = 2√2 ✓
        let tsirelson = 2.0 * sqrt 2.0
        let result = FrequencyMachZehnder.bipartiteS
                        1.0 (Math.PI/4.0)    // E(a0,b0): offset = b0−a0 = π/4
                        1.0 (3.0*Math.PI/4.0) // E(a0,b1): offset = b1−a0 = 3π/4
                        1.0 (Math.PI/4.0)    // E(a1,b0): offset = b0−a1 = π/4−π/2 = −π/4 → use π/4 for magnitude
                        1.0 (-Math.PI/4.0)   // E(a1,b1): offset = b1−a1 = 3π/4−π/2 = π/4
        // S = cos(π/4) − cos(3π/4) + cos(π/4) + cos(−π/4)
        //   = 1/√2 − (−1/√2) + 1/√2 + 1/√2 = 4/√2 = 2√2
        Assert.InRange(result.sFreq, tsirelson - 0.01, tsirelson + 0.01)
        Assert.Equal("CEILING", result.verdict)

    // ── FMZ-2: Zero coherence (PLV=0) gives S = 0 (product state) ────────────
    [<Fact>]
    let ``FMZ-2: zero coherence gives S = 0 (product state)`` () =
        let result = FrequencyMachZehnder.bipartiteS 0.0 0.0  0.0 0.0  0.0 0.0  0.0 0.0
        Assert.InRange(result.sFreq, -0.01, 0.01)
        Assert.Equal("PRODUCT", result.verdict)

    // ── FMZ-3: idealCeiling scales linearly with PLV ──────────────────────────
    [<Fact>]
    let ``FMZ-3: idealCeiling is 2√2 · PLV`` () =
        let tsirelson = 2.0 * sqrt 2.0
        Assert.InRange(FrequencyMachZehnder.idealCeiling 1.0, tsirelson - 0.001, tsirelson + 0.001)
        Assert.InRange(FrequencyMachZehnder.idealCeiling 0.5, tsirelson * 0.5 - 0.001, tsirelson * 0.5 + 0.001)
        Assert.InRange(FrequencyMachZehnder.idealCeiling 0.0, -0.001, 0.001)

    // ── FMZ-4: measureFreq returns None for empty phase series ────────────────
    [<Fact>]
    let ``FMZ-4: measureFreq returns None for empty phase series`` () =
        let result = FrequencyMachZehnder.measureFreq "tick-001" [] []
        Assert.True(result.IsNone)

    // ── FMZ-5: measureFreq returns None for mismatched phase series ───────────
    [<Fact>]
    let ``FMZ-5: measureFreq returns None for mismatched phase series`` () =
        let result = FrequencyMachZehnder.measureFreq "tick-001" [0.1; 0.2] [0.1]
        Assert.True(result.IsNone)

    // ── FMZ-6: measureFreq returns PLV=1 for identical phase series ───────────
    [<Fact>]
    let ``FMZ-6: measureFreq returns PLV=1 for identical phase series`` () =
        let phases = [0.1; 0.3; 0.7; 1.2; 2.1] |> List.map float
        let result = FrequencyMachZehnder.measureFreq "tick-001" phases phases
        Assert.True(result.IsSome)
        let m = result.Value
        Assert.InRange(m.plv, 0.999, 1.001)
        Assert.InRange(m.meanOffset, -0.001, 0.001)
        Assert.Equal("tick-001", m.windowId)

    // ── FMZ-7: measureFreq returns PLV=1 for anti-phase series ───────────────
    [<Fact>]
    let ``FMZ-7: measureFreq returns PLV=1 for anti-phase series (offset=π)`` () =
        let phasesA = [0.0; Math.PI/4.0; Math.PI/2.0; 3.0*Math.PI/4.0]
        let phasesB = phasesA |> List.map (fun p -> p + Math.PI)
        let result = FrequencyMachZehnder.measureFreq "tick-002" phasesA phasesB
        Assert.True(result.IsSome)
        let m = result.Value
        // PLV = 1 (perfect anti-phase locking), offset ≈ π
        Assert.InRange(m.plv, 0.999, 1.001)
        Assert.InRange(abs m.meanOffset, Math.PI - 0.01, Math.PI + 0.01)

    // ── FMZ-8: measureFreq returns PLV < 1 for random phases ─────────────────
    [<Fact>]
    let ``FMZ-8: measureFreq returns PLV < 1 for uncorrelated random phases`` () =
        // Use a fixed seed for reproducibility
        let rng = Random(42)
        let phasesA = List.init 100 (fun _ -> rng.NextDouble() * 2.0 * Math.PI)
        let phasesB = List.init 100 (fun _ -> rng.NextDouble() * 2.0 * Math.PI)
        let result = FrequencyMachZehnder.measureFreq "tick-003" phasesA phasesB
        Assert.True(result.IsSome)
        // PLV should be well below 1 for uncorrelated phases (typically < 0.3)
        Assert.True(result.Value.plv < 0.5, sprintf "Expected PLV < 0.5 for random phases, got %f" result.Value.plv)

    // ── FMZ-9: partial coherence downweights CHSH S ───────────────────────────
    [<Fact>]
    let ``FMZ-9: partial coherence (PLV=0.5) gives S ≤ √2`` () =
        // With PLV=0.5 and ideal offsets, S_ideal = 2√2 · 0.5 = √2
        let result = FrequencyMachZehnder.bipartiteS
                        0.5 (Math.PI/4.0)
                        0.5 (3.0*Math.PI/4.0)
                        0.5 (Math.PI/4.0)
                        0.5 (-Math.PI/4.0)
        Assert.True(abs result.sFreq <= sqrt 2.0 + 0.01,
            sprintf "Expected |S| ≤ √2 for PLV=0.5, got %f" result.sFreq)

    // ── FMZ-10: NaN offset → zero correlator (windowing artifact guard) ───────
    [<Fact>]
    let ``FMZ-10: NaN offset produces zero correlator (windowing artifact guard)`` () =
        // If the coherence window is cut by a local clock, the offset is NaN.
        // The correlator must return 0 to avoid propagating the artifact.
        let result = FrequencyMachZehnder.bipartiteS 1.0 nan  1.0 nan  1.0 nan  1.0 nan
        Assert.InRange(result.sFreq, -0.01, 0.01)
        Assert.Equal("PRODUCT", result.verdict)

    // ── FMZ-11: plvToPathBorn at offset=0 gives P(0)=1 ───────────────────────
    [<Fact>]
    let ``FMZ-11: plvToPathBorn at offset=0 gives P(0)=1 (perfect coherence)`` () =
        let p = FrequencyMachZehnder.plvToPathBorn 1.0 0.0
        Assert.InRange(p, 0.999, 1.001)

    // ── FMZ-12: plvToPathBorn at offset=π gives P(0)=0 ───────────────────────
    [<Fact>]
    let ``FMZ-12: plvToPathBorn at offset=π gives P(0)=0 (destructive interference)`` () =
        let p = FrequencyMachZehnder.plvToPathBorn 1.0 Math.PI
        Assert.InRange(p, -0.001, 0.001)
