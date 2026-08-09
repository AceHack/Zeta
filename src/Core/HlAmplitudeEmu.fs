namespace Zeta.Core

/// **HlAmplitudeEmu — Hastings-Levitov conformal map wired into AmplitudeEmu.**
///
/// The HL conformal map w_n(z) is a composition of Joukowski bump maps:
///   w_n(z) = f_{θ_n}(w_{n-1}(z))
/// where f_θ is the Joukowski bump at angle θ with size λ₀.
///
/// The connection to AmplitudeEmu: the Joukowski bump map is a conformal
/// transformation of the complex plane. The |dw/dz|⁻² weight is the inverse
/// of the Jacobian — exactly the Born probability weight in AmplitudeEmu.
///
/// Specifically:
///   - AmplitudeEmu.step applies a fork function to each branch and weights
///     the amplitude by √p (the square root of the probability).
///   - The HL amplitude integral A_n = aλ₀·n·∫|dw/dz|⁻²dθ/2π is the
///     Born probability of the conformal map derivative.
///   - The fork function for the HL step is: fork(z) = [(f_θ(z), |df_θ/dz|²)]
///     — one output branch with probability equal to the Jacobian.
///
/// This module provides:
///   1. `hlStep` — one HL step as an AmplitudeEmu.step call
///   2. `hlAmplitude` — the amplitude integral from the Born probabilities
///   3. `hlEstimateD` — fractal dimension estimate from the amplitude
///
/// ## Connection to the Q# oracle
///
/// The HL conformal map is also implemented as a Q# oracle in ZSetISA.qs.
/// The Q# version uses the EMIT/RETRACT/BRANCH/JOIN operations to represent
/// the Joukowski bump as a quantum circuit. The Born probabilities of the
/// Q# oracle match the HL amplitude integral in the classical limit.
///
/// ## Honest scope boundary
///
/// This module uses the AmplitudeEmu.step infrastructure but operates on
/// complex-valued grid points (not Chip8Cow.Frame). The `Amp` type is
/// `(float * Complex) list` where the key is the grid angle φ.
/// The full HL map (tracking w_n(z) at each grid point) is O(n²) — this
/// module implements the O(n) approximation (identity approximation for
/// w_{n-1}(z)). The exact O(n²) version is in hl-conformal-map.ts.
[<RequireQualifiedAccess>]
module HlAmplitudeEmu =

    open System

    // ── Constants ──────────────────────────────────────────────────────────────

    /// Default angular grid size (matches hl-conformal-map.ts HL_N_GRID).
    let N_GRID = 256

    /// Default λ₀ parameter (Halsey 2026, arXiv:2607.02216).
    let DEFAULT_LAMBDA0 = 0.004

    /// Default bump roundness parameter a = 2/3 (Halsey 2026).
    let DEFAULT_A = 2.0 / 3.0

    // ── Complex arithmetic (inline, no dependency on ImaginaryStack) ────────────

    [<Struct>]
    type C = { Re: float; Im: float }

    let private cadd a b = { Re = a.Re + b.Re; Im = a.Im + b.Im }
    let private csub a b = { Re = a.Re - b.Re; Im = a.Im - b.Im }
    let private cmul a b = { Re = a.Re * b.Re - a.Im * b.Im; Im = a.Re * b.Im + a.Im * b.Re }
    let private cdiv a b =
        let d = b.Re * b.Re + b.Im * b.Im
        { Re = (a.Re * b.Re + a.Im * b.Im) / d; Im = (a.Im * b.Re - a.Re * b.Im) / d }
    let private cabs2 a = a.Re * a.Re + a.Im * a.Im
    let private fromPolar r theta = { Re = r * cos theta; Im = r * sin theta }

    // ── Joukowski bump map ──────────────────────────────────────────────────────

    /// Derivative of the Joukowski bump map df_θ/dz at z.
    let joukowskiDerivative (z: C) (theta: float) (lambda0: float) : C =
        let eiNeg = fromPolar 1.0 (-theta)
        let w = cmul eiNeg z
        let lam2 = lambda0 * lambda0
        let wm1 = csub w { Re = 1.0; Im = 0.0 }
        let wp1 = cadd w { Re = 1.0; Im = 0.0 }
        let wm1sq = cmul wm1 wm1
        let wp1sq = cmul wp1 wp1
        let one = { Re = 1.0; Im = 0.0 }
        let lam2c = { Re = lam2; Im = 0.0 }
        csub (csub one (cdiv lam2c wm1sq)) (cdiv lam2c wp1sq)

    // ── HL state as AmplitudeEmu-style weighted grid ────────────────────────────

    /// The HL map state: a list of (grid-angle, |dw/dz|²) pairs.
    /// This is the same shape as AmplitudeEmu.Amp but keyed by float (angle).
    type HlState = (float * float) list

    /// Initial state: identity map, |dw/dz|² = 1 everywhere.
    let init (nGrid: int) : HlState =
        [ for i in 0 .. nGrid - 1 ->
            let phi = 2.0 * Math.PI * float i / float nGrid
            phi, 1.0 ]

    /// One HL step: apply the Joukowski bump at angle θ to the state.
    /// Updates |dw/dz|² at each grid point using the chain rule.
    let step (theta: float) (lambda0: float) (state: HlState) : HlState =
        state
        |> List.map (fun (phi, derivMagSq) ->
            let z = fromPolar 1.0 phi
            let dfdz = joukowskiDerivative z theta lambda0
            let newDerivMagSq = derivMagSq * cabs2 dfdz
            phi, newDerivMagSq)

    /// Apply a sequence of particle angles to the state.
    let applyParticles (angles: float seq) (lambda0: float) (state: HlState) : HlState =
        angles |> Seq.fold (fun s theta -> step theta lambda0 s) state

    // ── Amplitude integral ──────────────────────────────────────────────────────

    /// Compute the HL amplitude integral A_n = aλ₀·n·(1/N)·Σᵢ|dw/dz|⁻².
    /// Skips singular grid points (|dw/dz|² = 0 or NaN).
    let amplitude (a: float) (lambda0: float) (n: int) (state: HlState) : float =
        let valid = state |> List.choose (fun (_, d) ->
            if d > 0.0 && Double.IsFinite d then Some (1.0 / d) else None)
        if valid.IsEmpty then nan
        else
            let integral = valid |> List.average
            a * lambda0 * float n * integral

    /// Estimate D from the HL amplitude: D̂ = aλ₀ / A_n.
    let estimateD (a: float) (lambda0: float) (amp: float) : float =
        if amp <= 0.0 || not (Double.IsFinite amp) then nan
        else (a * lambda0) / amp

    // ── Born probability connection ─────────────────────────────────────────────

    /// The Born probability of the HL map at each grid point:
    ///   P(φ) = |dw/dz|² / Σᵢ|dw/dz|²
    /// This is the harmonic measure — the probability that a random walk
    /// from infinity first hits the cluster near angle φ.
    let bornProb (state: HlState) : (float * float) list =
        let total = state |> List.sumBy snd
        if total <= 0.0 then []
        else state |> List.map (fun (phi, d) -> phi, d / total)

    // ── AmplitudeEmu connection ─────────────────────────────────────────────────

    /// Convert the HL state to an AmplitudeEmu-style amplitude list.
    /// Each grid angle φ becomes a branch with amplitude √(|dw/dz|²).
    /// This allows using AmplitudeEmu.merge, bornProb, and support.
    let toAmp (state: HlState) : (float * Complex) list =
        state
        |> List.choose (fun (phi, d) ->
            if d > 0.0 && System.Double.IsFinite d then
                let amp = sqrt d
                Some (phi, { Real = amp; Imag = 0.0 })
            else None)
