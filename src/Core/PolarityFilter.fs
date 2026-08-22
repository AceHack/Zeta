namespace Zeta.Core

/// **`PolarityFilter` — a ray-trace polarity filter = a fast orientation/lens finder (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"we need ray-trace polarity filters to quickly find our orientation, like the birds do with sun
/// rays — do we need the qubit or something more sophisticated?"* Answer: the **qubit suffices, because it IS
/// the polarity filter.** Photon **polarization is a qubit** (the Poincaré sphere ≅ the Bloch sphere of
/// `QubitIso`), and a **polarizing filter is a qubit measurement: Malus's law `I = I₀·cos²θ` IS the Born
/// projection** (`PhasorEndurance.overlap` / `QubitIso.measureOne`). So a ray-trace polarity filter at
/// orientation θ projects the ray (phasor/qubit) and reads `cos²(Δθ)`; **sweep the filter orientation, take
/// the max throughput ⇒ the signal's orientation = the lens** (#7092 "find the lens" — for orientation/phase
/// structure, complementing `resonantPeriod` for periodic structure).
///
/// **Birds (the anchor):** the **polarized-light compass** (bees/birds reading the Rayleigh sky-polarization
/// pattern; von Frisch) is exactly this — polarity filters → e-vector → orientation. The **magnetic compass**
/// (radical-pair / cryptochrome; Ritz–Schulten) is a **2-spin entangled pair = 2 qubits** — that is the
/// "something more sophisticated": a qubit *pair* (and our two-stream/two-clock join is already a 2-component
/// system). So: **1 qubit for polarization-orientation; a pair for the magnetic compass.**
///
/// **Honest scope (peel):** Malus uses `cos²(θ)` (photon = spin-1); the qubit overlap is `cos²(Δφ/2)` (spinor
/// = spin-½) — related by the half-angle / double-cover, so the qubit IS the filter up to that angle
/// convention. Polarization-as-qubit, Malus-as-Born, and the bird polarization/radical-pair compasses are all
/// standard/anchored; the shared content is the `cos²` projection (= polarity filter = qubit measurement =
/// orientation/lens-finder). Deterministic (DST §7).
[<RequireQualifiedAccess>]
module PolarityFilter =

    let private pi = System.Math.PI

    /// **Malus's law** — transmitted fraction through a filter at `filterAngle` for a signal polarized at
    /// `signalAngle` (radians): `cos²(filterAngle − signalAngle)`. This is the Born projection (a qubit
    /// measurement). Polarization is headless (mod π): a filter at θ and θ+π are identical.
    let transmit (filterAngle: float) (signalAngle: float) : float =
        let c = cos (filterAngle - signalAngle)
        c * c

    /// **The detector — the ONE door (§13 noninterference).** A `Detector` answers *"what does the
    /// instrument read with the filter at this orientation?"*; a sweep sees the world only through it.
    ///
    /// This type exists because `transmit`'s signature had **no channel through which anything other than
    /// the ideal `cos²` could enter** — so a measurement noise floor was not merely unmeasured, it was
    /// unstatable. Adding the channel changes the signature, which is exactly what §13 requires: entropy
    /// arrives through a declared, injected door, never from an ambient `Random()`. `idealDetector` is the
    /// noiseless instrument (what the module did before, unchanged); `noisyDetector` is the same instrument
    /// reading through an injected `TwoTimescaleFold.IEntropySource`.
    type Detector = float -> float

    /// The ideal (noiseless) instrument: total throughput of a ray bundle through a filter at `a`.
    /// A single ray is the one-element bundle.
    let idealDetector (rays: float list) : Detector =
        fun a -> rays |> List.sumBy (transmit a)

    /// **Sweep `n` filter orientations over `[0, π)` through an injected detector** and return the
    /// argmax and its reading — `(bestFilterAngle, observedThroughput)`. This is the sweep every
    /// orientation-finder in this module performs; they differ only in the detector handed to it.
    ///
    /// Ties go to the *first* (lowest) orientation, as `List.maxBy` does — a real property, since at a
    /// zero resultant (see `resultant`) the objective is constant and *every* grid point ties.
    let searchVia (detector: Detector) (n: int) : float * float =
        [ 0 .. max 1 n - 1 ]
        |> List.map (fun i ->
            let a = pi * float i / float (max 1 n)
            a, detector a)
        |> List.maxBy snd

    /// **Find the orientation (the lens):** sweep `n` filter orientations over `[0, π)` and return the one that
    /// maximises throughput for a signal at `signalAngle` — `(bestFilterAngle, throughput)`. Throughput → 1 as
    /// the filter aligns with the signal. Fast (one `cos²` per orientation).
    let findOrientation (n: int) (signalAngle: float) : float * float =
        searchVia (fun a -> transmit a signalAngle) n

    /// **Ray-trace a bundle:** given many rays' polarization angles, the filter orientation that maximises
    /// *total* throughput = the bundle's dominant orientation (the lens for the whole field — what a bird reads
    /// off the sky). Sweep `n` orientations.
    let dominantOrientation (n: int) (rays: float list) : float =
        searchVia (idealDetector rays) n |> fst

    /// **The doubled-angle resultant `R = Σⱼ e^{−2i rⱼ}`, as `(|R|, argmax angle)`.**
    ///
    /// Power-reduction collapses the whole bundle into this one complex number: summing Malus over rays
    /// gives `Σⱼ cos²(a − rⱼ) = N/2 + ½·Re[e^{2ia}·R]`, a pure sinusoid in `2a`. So the bundle enters the
    /// sweep **only** through `R` — the maximiser is `−arg(R)/2 (mod π)` and the peak-to-trough amplitude
    /// is exactly `|R|`.
    ///
    /// `|R|` is therefore the bundle's **conditioning number**, and it is what a resolution claim must be
    /// conditioned on: the peak's curvature is proportional to `|R|`, so orientation resolution degrades as
    /// `|R|` falls and **at `|R| = 0` the objective is exactly constant — there is no maximiser at all**, at
    /// any sweep density. (Doubling is the standard treatment of *axial* data, where θ and θ+π are the same
    /// orientation — Mardia & Jupp, *Directional Statistics*; `|R|/N` is their mean resultant length.)
    let resultant (rays: float list) : float * float =
        let re = rays |> List.sumBy (fun r -> cos (2.0 * r))
        let im = rays |> List.sumBy (fun r -> -(sin (2.0 * r)))
        let magnitude = sqrt (re * re + im * im)
        // argmax of Re[e^{2ia}R] is a* = −arg(R)/2, folded into [0, π).
        let a = -(atan2 im re) / 2.0
        let folded = a - pi * floor (a / pi)
        magnitude, folded

    /// **A noisy detector — the injected-entropy instrument (§13).** Reads `idealDetector rays a` and adds
    /// `sigma · N(0,1)`, drawn **independently per reading** through the injected `entropy` source. That
    /// independence is the physical claim: each filter orientation is a separate measurement, so its noise
    /// is its own. (A single offset shared by the whole sweep would cancel in the argmax and could never
    /// limit resolution — the thing this channel exists to expose.)
    ///
    /// Entropy enters **only** here, and only from the injected source: no ambient clock, no `Random()`, no
    /// thread-pool read. Hand it a seeded source and the run replays exactly (DST, §7); hand it a metered
    /// one and every crossing is counted.
    ///
    /// Normal deviates by Box–Muller (Box & Muller 1958) from two uniforms; the uniforms come from
    /// `IEntropySource.Next`, whose contract is integral, so each is a 30-bit fixed-point draw
    /// (`resolution ≈ 9.3e−10`) — stated because it is a real bound on how small a `sigma` this channel can
    /// honestly carry.
    let noisyDetector (entropy: TwoTimescaleFold.IEntropySource) (sigma: float) (rays: float list) : Detector =
        let bound = 1 <<< 30
        let unit () = (float (entropy.Next bound) + 0.5) / float bound
        let ideal = idealDetector rays

        fun a ->
            let u1 = unit ()
            let u2 = unit ()
            let z = sqrt (-2.0 * log u1) * cos (2.0 * pi * u2)
            ideal a + sigma * z
