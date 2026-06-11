namespace Zeta.Core

/// WaveSim — **honest interference patterns from generators** (Aaron 2026-06-11: "we should be able
/// to generate honest interference patterns — simulated bit-perfect quantum and regular waves, all
/// sorts of physical simulators from generators — with the Cayley-Dickson and Clifford algebra we
/// already have").
///
/// The machinery is exactly the algebra on the shelf: each source contributes a PHASOR (a Cayley
/// complex — `ImaginaryStack.complex`), superposition is literally `complex.Add`, and the visible
/// pattern is the squared magnitude of the sum. Two sources make the classic double-slit fringes:
/// bright where path difference = nλ (constructive), dark at half-wavelength offsets (destructive) —
/// and the TEST is that physics, not a screenshot.
///
/// **The honest labels (the register matters here):** this is a deterministic SIMULATION of wave
/// interference — the amplitude mathematics that classical waves and quantum amplitudes share. We do
/// NOT claim quantum hardware or physical nonlocality (the same discipline as TimeGen's staged
/// regime: the math is exact, the interpretation is labeled). "Bit-perfect" = same inputs, same
/// pattern, every run — deterministic in-process; the cross-oracle exact-phase slice (integer-only
/// distances) is named, not claimed.
[<RequireQualifiedAccess>]
module WaveSim =

    /// A wave source: position + wavelength (in cell units) + amplitude.
    type Source =
        { X: float
          Y: float
          Wavelength: float
          Amplitude: float }

    let source x y wl amp =
        { X = x; Y = y; Wavelength = max 1e-9 wl; Amplitude = amp }

    /// The phasor one source contributes at a cell at tick t (ω advances phase per tick):
    /// amplitude × e^{i(2π·d/λ − ωt)} — built as a Cayley complex.
    let phasorAt (omega: float) (t: int) (s: Source) (cx: float) (cy: float) : Complex =
        let dx, dy = cx - s.X, cy - s.Y
        let d = sqrt (dx * dx + dy * dy)
        let phase = 2.0 * System.Math.PI * d / s.Wavelength - omega * float t
        Doubled.make (s.Amplitude * cos phase) (s.Amplitude * sin phase)

    /// SUPERPOSITION — literally the Cayley complex Add over all sources (the algebra we have).
    let fieldAt (omega: float) (t: int) (sources: Source list) (cx: float) (cy: float) : Complex =
        sources
        |> List.fold (fun acc s -> ImaginaryStack.complex.Add(acc, phasorAt omega t s cx cy)) (Doubled.make 0.0 0.0)

    /// The visible intensity: |Σ phasors|² (what a screen/plane shows).
    let intensityAt (omega: float) (t: int) (sources: Source list) (cx: float) (cy: float) : float =
        let f = fieldAt omega t sources cx cy
        f.Real * f.Real + f.Imag * f.Imag

    /// Render the pattern onto a w×h grid as intensities (the generator form — samples, like every
    /// other generator; quantization to planes/cells happens at the binding, as always).
    let pattern (omega: float) (t: int) (sources: Source list) (w: int) (h: int) : float[,] =
        Array2D.init h w (fun y x -> intensityAt omega t sources (float x) (float y))
