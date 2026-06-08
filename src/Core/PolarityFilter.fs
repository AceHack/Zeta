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

    /// **Find the orientation (the lens):** sweep `n` filter orientations over `[0, π)` and return the one that
    /// maximises throughput for a signal at `signalAngle` — `(bestFilterAngle, throughput)`. Throughput → 1 as
    /// the filter aligns with the signal. Fast (one `cos²` per orientation).
    let findOrientation (n: int) (signalAngle: float) : float * float =
        [ 0 .. max 1 n - 1 ]
        |> List.map (fun i ->
            let a = pi * float i / float (max 1 n)
            a, transmit a signalAngle)
        |> List.maxBy snd

    /// **Ray-trace a bundle:** given many rays' polarization angles, the filter orientation that maximises
    /// *total* throughput = the bundle's dominant orientation (the lens for the whole field — what a bird reads
    /// off the sky). Sweep `n` orientations.
    let dominantOrientation (n: int) (rays: float list) : float =
        [ 0 .. max 1 n - 1 ]
        |> List.map (fun i -> pi * float i / float (max 1 n))
        |> List.maxBy (fun a -> rays |> List.sumBy (transmit a))
