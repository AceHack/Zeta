namespace Zeta.Core

/// BoundaryLight — **the reusable primitive that compresses Amara's card to minimal text: light as the
/// physics of 2D boundary space** (Aaron 2026-06-11: "look at amara's image and see what kind of
/// reusable primitive would let her compress her image down to text in minimal form — homoiconic-ish,
/// human-understandable, expressive, based on generator functions and the physics of 2D boundary
/// space; tessellation so we can be progressive; layout and such").
///
/// The decomposition her card teaches (each a `gen` line in MediaLines):
/// - **curve** — a polyline (control points): THE IRREDUCIBLE. Her silhouette, hair strands, the halo
///   arc — stored as a handful of integer points a human can read.
/// - **glow** — the GENERATED light: intensity = exp(−d²/σ²) of the DISTANCE FIELD to the curve.
///   This is the unification: the glow kernel IS our PSD/RBF kernel (Schoenberg; LinguisticSeed;
///   ConformalGA) applied to boundary distance. **Her image is literally her motto: the lighted
///   boundary** — store the boundary, generate the light.
/// - **mirror** — bilateral symmetry: store HALF the portrait, generate the rest (the first
///   compression any face offers).
/// - **scatter** — the starfield: a seeded deterministic scatter (DST common-cause seed attached, per
///   the storage law) — zero irreducible bytes beyond (count, seed).
/// - **grid** — TESSELLATION: the continuous generators sampled at a resolution. Progressive = the
///   same generators re-sampled finer (8×8 → 16×16 → 64×32 → …). CHIP-9 is the coarsest HONEST level;
///   the slider rises without changing the stored text. Scale-free rendering, by construction.
/// - **stack/row layout** — the card = a vertical stack (halo / portrait / title / motto / glyph row);
///   layout is sections-with-alignment, not pixel positions.
///
/// Everything integer/exact except the glow's float intensity, which QUANTIZES to a plane mask at the
/// sampling step (the float never leaves the generator — the stored and rendered forms are exact).
[<RequireQualifiedAccess>]
module BoundaryLight =

    /// A point in the unit-free 2D space (integer sub-pixels — callers pick the scale).
    type P = { X: int; Y: int }

    let p x y = { X = x; Y = y }

    /// The irreducible: a polyline boundary (control points, joined by segments).
    type Curve = P list

    /// Squared distance from a point to a segment (integer arithmetic, exact).
    let private distSqToSeg (a: P) (b: P) (q: P) : float =
        let abx, aby = float (b.X - a.X), float (b.Y - a.Y)
        let aqx, aqy = float (q.X - a.X), float (q.Y - a.Y)
        let len2 = abx * abx + aby * aby
        let t = if len2 = 0.0 then 0.0 else max 0.0 (min 1.0 ((aqx * abx + aqy * aby) / len2))
        let dx, dy = aqx - t * abx, aqy - t * aby
        dx * dx + dy * dy

    /// The distance field: squared distance from q to the nearest point of the curve.
    let distSq (c: Curve) (q: P) : float =
        match c with
        | [] -> infinity
        | [ a ] ->
            let dx, dy = float (q.X - a.X), float (q.Y - a.Y)
            dx * dx + dy * dy
        | _ -> c |> List.pairwise |> List.map (fun (a, b) -> distSqToSeg a b q) |> List.min

    /// THE GLOW: intensity at q = exp(−d²/σ²) — the RBF kernel of the boundary's distance field
    /// (Schoenberg-PSD; the same kernel family as LinguisticSeed/ConformalGA — light and similarity
    /// are one mathematics here).
    let glow (sigma: float) (c: Curve) (q: P) : float =
        exp (-(distSq c q) / (max 1e-9 (sigma * sigma)))

    /// MIRROR: reflect a curve about the vertical axis x = axis (store half a face, generate the rest).
    let mirror (axis: int) (c: Curve) : Curve =
        c |> List.map (fun pt -> { pt with X = 2 * axis - pt.X })

    /// SCATTER: n seeded points in (w×h) — deterministic from the DST common-cause seed (the starfield
    /// costs zero irreducible bytes beyond count + seed).
    let scatter (seed: uint64) (n: int) (w: int) (h: int) : P list =
        let mix (z0: uint64) =
            let z = z0 + 0x9E3779B97F4A7C15UL
            let z = (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
            let z = (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
            z ^^^ (z >>> 31)

        [ for i in 0 .. n - 1 ->
            let a = mix (seed ^^^ uint64 i)
            let b = mix a
            p (int (a % uint64 (max 1 w))) (int (b % uint64 (max 1 h))) ]

    /// TESSELLATION: sample the glow on a (w×h) grid and quantize to a CHIP-9 plane mask — lit where
    /// intensity ≥ threshold. Progressive rendering = the SAME curve re-sampled at finer (w,h); the
    /// stored text never changes, only the grid. Returns the lit cells (sparse, canonical).
    let sampleGrid (sigma: float) (threshold: float) (w: int) (h: int) (scale: int) (c: Curve) : Set<int * int> =
        let s = max 1 scale // curve coordinates per grid cell (the zoom)

        Set.ofList
            [ for gy in 0 .. h - 1 do
                  for gx in 0 .. w - 1 do
                      // sample at the cell center in curve space
                      let q = p (gx * s + s / 2) (gy * s + s / 2)
                      if glow sigma c q >= threshold then yield gx, gy ]
