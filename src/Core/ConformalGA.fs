namespace Zeta.Core

/// ConformalGA — **the conformal-GA slice `Cl3.fs` flagged as its own next step**: *"conformal GA — a
/// point is a null vector and distance is a single inner product across embedded points — that is the
/// next slice for 'Sequoia soft memory distance'."* Now built.
///
/// The conformal model Cl(4,1) over our Cl(3,0): embed a Euclidean point `x` as the **null vector**
/// `P = x + ½|x|²·e∞ + e₀` (null basis: `e∞² = e₀² = 0`, `e∞·e₀ = −1`). Then for two embedded points:
///
///     P · Q = −½ |x − y|²        — **distance IS one inner product.**
///
/// Why this matters for the substrate (the Sequoia/SoftValue placement doc): memory locations become
/// points in this space; "how far is this memory" is ONE geometric measurement; tiers are distance
/// shells. And the **soft** half: the Gaussian RBF over this distance, `exp(P·Q/σ²) = exp(−½d²/σ²)`, is
/// a **PSD kernel** — so *memory distance composes into the seed language* (`LinguisticSeed`) under
/// Mercer closure, exactly like the salon's Jaccard kernel. Placement similarity is now a kernel the
/// packs can carry.
///
/// Pure module; floats only in the geometry (the placement *decision* stays a SoftValue upstairs).
[<RequireQualifiedAccess>]
module ConformalGA =

    /// A conformal point in the null basis: the Euclidean part (X,Y,Z) + the e∞ weight + the e₀ weight.
    /// An EMBEDDED point (via `embed`) is null: `inner p p = 0`.
    type CPoint =
        { X: float
          Y: float
          Z: float
          WInf: float
          W0: float }

    /// Embed a Euclidean point as a null conformal vector: `P = x + ½|x|² e∞ + e₀`.
    let embed (x: float) (y: float) (z: float) : CPoint =
        { X = x
          Y = y
          Z = z
          WInf = 0.5 * (x * x + y * y + z * z)
          W0 = 1.0 }

    /// Embed a Cl(3,0) grade-1 vector (the existing geospatial carrier) as a conformal point.
    let embedMv (v: Cl3.Mv) : CPoint = embed v.E1 v.E2 v.E3

    /// The conformal inner product in the null basis: Euclidean dot MINUS the cross terms
    /// (`e∞·e₀ = e₀·e∞ = −1`; `e∞² = e₀² = 0`).
    let inner (p: CPoint) (q: CPoint) : float =
        p.X * q.X + p.Y * q.Y + p.Z * q.Z - (p.WInf * q.W0 + p.W0 * q.WInf)

    /// Squared Euclidean distance, recovered from ONE inner product: `d² = −2 (P·Q)`.
    let distSq (p: CPoint) (q: CPoint) : float = -2.0 * inner p q

    /// Is this point on the null cone (an honestly embedded point)? `P·P = 0` within `eps`.
    let isNull (eps: float) (p: CPoint) : bool = abs (inner p p) <= eps

    /// True squared-Euclidean distance from the Euclidean parts directly — ALWAYS a real `d²` (no null
    /// precondition). For honestly-embedded points this equals `−2·inner`; for arbitrary CPoints it is
    /// still the genuine Euclidean squared distance of the spatial coords.
    let euclidSq (p: CPoint) (q: CPoint) : float =
        let dx, dy, dz = p.X - q.X, p.Y - q.Y, p.Z - q.Z
        dx * dx + dy * dy + dz * dz

    /// **The Sequoia soft-memory-distance kernel**: Gaussian RBF `exp(−d²/σ²)` over the *true* squared
    /// Euclidean distance — PSD for ANY inputs (Schoenberg 1938: `exp(−γd²)` is PSD iff `d²` is
    /// conditionally-negative-definite; Euclidean `d²` always is). σ is the locality scale (tier width).
    /// (Math Razor 2026-06-11 P0: the old form `exp(inner/σ²)` was only Euclidean for NULL points — a
    /// non-embedded CPoint broke PSD. Computing `d²` from the Euclidean parts removes the precondition.)
    let rbfKernel (sigma: float) : LinguisticSeed.Kernel<CPoint> =
        let s2 = max 1e-12 (sigma * sigma)
        fun p q -> exp (-(euclidSq p q) / s2)

    /// The memory-distance extension pack — placement similarity, composable into any seed (OCP).
    let memoryPack (sigma: float) : LinguisticSeed.Pack<CPoint> =
        LinguisticSeed.pack "conformal" [ "memory-rbf", rbfKernel sigma ]
