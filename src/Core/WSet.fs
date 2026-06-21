// PROMOTED BACK TO CORE by operator decision (Aaron, 2026-06-11, PR #7805: "why are we keeping
// in tests? we need in real code"). Rodney's Razor (2026-06-11, PR #7802) had demoted this to a test fixture —
// "essential as mathematics, accidental as code; zero non-test consumers" — and that dissent
// stays on record as ADVISORY: the human maintainer set the product direction instead — the
// ring-generic type IS intended substrate for the quantum lane (081KTWJ1R0008QG0R001ZBWKTR), the inference port, and
// future ring instances; consumers arrive ON the shelf, not before it exists. Both registers are
// kept honestly: the razor's bar is now met by the source-side `QuantumObservableDbsp` bridge, which
// turns `MachZehnderWSet` output into observable rows and a `ZSet<QuantumObservableRow>`.
namespace Zeta.Core

open Zeta.Core.Abstractions

/// WSet — **the ring-generic weighted set: three rings, one circuit calculus** (081KTZ4EF0008QG0R001R3XPYV; Aaron
/// 2026-06-11, PR #7785: "can we connect ZSet circuit to quantum circuit?" / "Infer.NET circuits the same
/// way?" — same answer, one type). A `WSet<'K,'W>` is a Z-set whose weights live in ANY *-ring:
///
///   'W = ℤ  → the DBSP Z-set (signed counts; boundary nonlinearity = Distinct)
///   'W = ℂ  → amplitudes      (interference;  boundary nonlinearity = measurement/Born)
///   'W = ℝ≥0 → probabilities  (sum-product;   boundary nonlinearity = EP projection)
///
/// The unifying theorem is the Generalized Distributive Law (Aji–McEliece 2000): sum-product,
/// max-product, FFT and friends are ONE algorithm over different commutative semirings. The
/// circuit discipline carried over from `RecursiveSignedDelta`: every operator here is
/// 'W-LINEAR; the ring's nonlinear step (Distinct / measurement / projection) is applied at the
/// OUTER BOUNDARY only, never inside the loop.
///
/// Honest scope: this is the CONNECTION layer, kept lean — unconsolidated (key×weight) lists with
/// ring-parameterized consolidation. `ZSet` remains the optimized ℤ workhorse; `WSet` is where
/// the rings MEET (and the cross-oracle demos live). Float-weighted rings consolidate with an
/// epsilon `isZero` the CALLER supplies — exact cancellation is the ring's business, not ours.
[<RequireQualifiedAccess>]
module WSet =

    /// A weighted set: keys with ring weights, possibly unconsolidated (duplicate keys pending merge).
    type WSet<'K, 'W when 'K: comparison> = ('K * 'W) list

    /// Consolidate: sum weights per key under the ring's Add; drop keys whose total isZero.
    /// THIS is where interference/retraction happens — opposite weights annihilate here.
    let consolidate (ring: IStarRing<'W>) (isZero: 'W -> bool) (s: WSet<'K, 'W>) : WSet<'K, 'W> =
        s
        |> List.groupBy fst
        |> List.map (fun (k, ws) -> k, ws |> List.map snd |> List.fold (fun a w -> ring.Add(a, w)) ring.Zero)
        |> List.filter (fun (_, w) -> not (isZero w))
        |> List.sortBy fst

    /// The linear-operator application (a matrix row per key): each key maps to a WSet of
    /// successors; incoming weight multiplies through (ring.Mul). 'W-linear by construction.
    let apply (ring: IStarRing<'W>) (op: 'K -> WSet<'K, 'W>) (s: WSet<'K, 'W>) : WSet<'K, 'W> =
        s |> List.collect (fun (k, w) -> op k |> List.map (fun (k2, w2) -> k2, ring.Mul(w, w2)))

    /// Pointwise sum (concatenate; consolidate at your boundary of choice).
    let plus (a: WSet<'K, 'W>) (b: WSet<'K, 'W>) : WSet<'K, 'W> = a @ b

    /// THE BOUNDARY MEASUREMENT (ℂ ring): Born probabilities |w|²/Σ|w|² per key — the ONE
    /// nonlinear step, outside the linear ops above (the same law as Distinct and EP projection).
    let bornProb (magSq: 'W -> float) (s: WSet<'K, 'W>) : ('K * float) list =
        let total = s |> List.sumBy (fun (_, w) -> magSq w)
        if total <= 1e-18 then []
        else s |> List.map (fun (k, w) -> k, magSq w / total)

/// The Mach-Zehnder interferometer as a TWO-KEY WSet circuit over the ℂ ring — the literal
/// ZSet↔quantum connection, cross-checked against THREE oracles (F# analytic, AmplitudeEmu,
/// Vera's Q# treaty transcript) in the suite. Convention matches the Q# treaty: H · R1(φ) · H on
/// |0⟩ ⇒ P(0) = cos²(φ/2).
[<RequireQualifiedAccess>]
module MachZehnderWSet =

    let private ring = ImaginaryStack.complex
    let private r (x: float) : Complex = Doubled.make x 0.0
    let private isZero (z: Complex) = abs z.Real < 1e-12 && abs z.Imag < 1e-12
    let private invSqrt2 = r (1.0 / sqrt 2.0)

    /// The Hadamard as a linear map on detector keys 0/1 (the real-valued H).
    let private hadamard (k: int) : WSet.WSet<int, Complex> =
        if k = 0 then [ 0, invSqrt2; 1, invSqrt2 ]
        else [ 0, invSqrt2; 1, ring.Negate invSqrt2 ]

    /// The phase plate: e^{iφ} on arm 1, identity on arm 0.
    let private phasePlate (phi: float) (k: int) : WSet.WSet<int, Complex> =
        if k = 1 then [ 1, Doubled.make (cos phi) (sin phi) ] else [ 0, ring.One ]

    /// CLOSED interferometer: H · R1(φ) · H on |0⟩, consolidated (the interference), then the
    /// boundary measurement. Linear ops inside; Born at the edge — the discipline, demonstrated.
    let closed (phi: float) : (int * float) list =
        [ 0, ring.One ]
        |> WSet.apply ring hadamard
        |> WSet.apply ring (phasePlate phi)
        |> WSet.apply ring hadamard
        |> WSet.consolidate ring isZero
        |> WSet.bornProb (fun z -> z.Real * z.Real + z.Imag * z.Imag)

    /// OPEN interferometer: one beamsplitter, no recombination — equal halves, no interference.
    let openArm () : (int * float) list =
        [ 0, ring.One ]
        |> WSet.apply ring hadamard
        |> WSet.consolidate ring isZero
        |> WSet.bornProb (fun z -> z.Real * z.Real + z.Imag * z.Imag)
