namespace Zeta.E8Render

open System.Collections.Generic

/// **`E8Shading` — the shading model, derived, with the irrational confined to ONE site.**
///
/// The light is a root, the normal is the sum of the face's three roots, and the reflection
/// law is the geometric-algebra sandwich in `E8Clifford`. Nothing here is authored.
///
/// **Where exactness ends.** `cosineToNumber` is the only function in this project that
/// evaluates a square root on a shading value, and the shading algebra closes over
/// `Q(sqrt 6)`:
///
/// | quantity | exact form | register |
/// |---|---|---|
/// | Lambert cosine `<L,n> / (|L| |n|)` | integer over `sqrt 384 = 8 sqrt 6` | algebraic |
/// | plane illumination `|L ^ B|^2 / (|L|^2 |B|^2)` | integer over 384 | **rational** |
/// | specular cosine `<mirror(L), V> / (|L| |V|)` | integer over 384 | **rational** |
///
/// The specular term pairs two *roots*, whose norms multiply to `sqrt 8 * sqrt 8 = 8`; the
/// Lambert term pairs a root with a *face normal*, and `sqrt 8 * sqrt 48 = 8 sqrt 6` is not
/// rational. So `sqrt 6` is the single irrational admitted, it enters through `|n| = 4
/// sqrt 6` alone, and every comparison a renderer performs before display — sorting,
/// bucketing, histogramming — is exact integer arithmetic on the numerators.
///
/// **The intensity never passes through the projection.** Shading is computed in the
/// 8-dimensional integer coordinates and only then attached to a projected triangle. That
/// is what lets the ray tracer in `E8Raytracer` look an intensity up rather than evaluate
/// one: the projection places pixels and never touches a brightness.
///
/// **Two-sided shading is forced, not chosen.** Every edge of 4_21 carries exactly 27
/// incident 2-faces (`3 * 60480 / 6720`), so the projected shell has no inside and a
/// one-sided front-face model is undefined. `shadeFaces` uses `|<L, n>|`.
///
/// Anchors (Beacon): **Johann Heinrich Lambert**, *Photometria* (1760) — the cosine law the
/// Lambert term is named for, used here as the DEFINITION of a shading value and not as a
/// radiometric measurement (register: `toy`); **Bui Tuong Phong**, *Illumination for
/// Computer Generated Pictures* (CACM 18(6), 1975) — named for the boundary this module
/// declines to cross, since a specular exponent is a material parameter an author supplies;
/// **Dorst, Fontijne & Mann** (2007) for the sandwich; **Coxeter** (1973) for 4_21.
[<RequireQualifiedAccess>]
module E8Shading =

    /// `|L|^2 |n|^2 = 8 * 48`. Every Lambert cosine is an integer over `sqrt` of this.
    [<Literal>]
    let LambertDenominatorSquared = 384

    /// An exact algebraic cosine: the value is `Numerator / sqrt DenominatorSquared`.
    [<Struct>]
    type ExactCosine =
        { Numerator: int
          DenominatorSquared: int }

    /// An exact rational: the value is `Numerator / Denominator`.
    [<Struct>]
    type ExactRational =
        { Numerator: int
          Denominator: int }

    /// The outward normal of a 2-face: the SUM of its three roots.
    ///
    /// Exactly orthogonal to the face plane — `<a+b+c, b-a> = 4 + 8 + 4 - 8 - 4 - 4 = 0`
    /// from `|r|^2 = 8` and the adjacency inner product 4 — and of squared norm
    /// `3*8 + 6*4 = 48`, so it never degenerates. Outward because 4_21 is centred at the
    /// origin with its vertices on a sphere, which puts the foot of the origin on the face
    /// plane exactly at the centroid: no flip test, no tolerance.
    let faceNormal8d (face: E8Exact.Face) (rs: int[][]) : int[] =
        let a = rs.[face.A]
        let b = rs.[face.B]
        let c = rs.[face.C]
        Array.init E8Exact.AmbientDimension (fun k -> a.[k] + b.[k] + c.[k])

    /// Is this normal usable for a signed shading term? False only on the zero vector.
    ///
    /// Measured over 4_21: true on all 60,480 faces, which is `|n|^2 = 48` restated as a
    /// runtime check. The false branch is unreachable from the derived face set — the
    /// sibling test exercises it on a synthetic input so the predicate is not a check that
    /// cannot fail.
    let isOrientationDetermined (normal: int[]) : bool = normal |> Array.exists (fun x -> x <> 0)

    /// The light direction: an E8 root. Which root is a gauge, discharged by measurement —
    /// the Weyl group is transitive on roots, so the intensity histogram over the whole face
    /// set is identical for all 240 choices.
    let lightFromRootIndex (index: int) (rs: int[][]) : int[] = Array.copy rs.[index]

    /// The Lambert cosine of a face under a root light: `<L, n> / (|L| |n|)`.
    let lambertCosine (face: E8Exact.Face) (light: int[]) (rs: int[][]) : ExactCosine =
        { Numerator = E8Exact.dot light (faceNormal8d face rs)
          DenominatorSquared = E8Exact.dot light light * E8Exact.FaceNormalNormSquared }

    /// Exact comparison of two cosines with NO square root taken.
    ///
    /// Compares `p / sqrt P` against `q / sqrt Q` by sign first and then `p^2 Q` against
    /// `q^2 P`, which is integer arithmetic. This is what lets a renderer sort, bucket and
    /// threshold the whole surface without leaving the exact regime.
    let compareCosines (a: ExactCosine) (b: ExactCosine) : int =
        let sa = sign a.Numerator
        let sb = sign b.Numerator

        if sa <> sb then
            (if sa < sb then -1 else 1)
        else
            let left = int64 a.Numerator * int64 a.Numerator * int64 b.DenominatorSquared
            let right = int64 b.Numerator * int64 b.Numerator * int64 a.DenominatorSquared

            if left = right then
                0
            else
                let magnitude = if left < right then -1 else 1
                if sa < 0 then -magnitude else magnitude

    /// The exact rational `cos^2`, for callers that want a rational and not an algebraic
    /// number.
    let cosineSquared (c: ExactCosine) : ExactRational =
        { Numerator = c.Numerator * c.Numerator
          Denominator = c.DenominatorSquared }

    /// **THE IRRATIONAL BOUNDARY.** The only place this project evaluates a square root on a
    /// shading value, and the only place a shading value becomes a float.
    ///
    /// Everything upstream — the normal, the numerator, the comparison, the bucketing — is
    /// exact integer arithmetic. Everything downstream is a pixel. A sibling test asserts by
    /// source scan that `sqrt` appears exactly once in this file and inside this function.
    let cosineToNumber (c: ExactCosine) : float =
        float c.Numerator / sqrt (float c.DenominatorSquared)

    /// Plane illumination `|L ^ B|^2 / (|L|^2 |B|^2)` — the fraction of the light that
    /// leaves the face's plane. An exact RATIONAL, unlike the Lambert cosine.
    ///
    /// A genuinely different quantity and not a rescaling: in 8 dimensions a plane's
    /// orthogonal complement is 6-dimensional, so a light can be entirely out of a face's
    /// plane and still perpendicular to that face's normal. The two are related by the exact
    /// integer inequality `<L,n>^2 <= |L ^ B|^2`, checked on every face.
    let planeIllumination (face: E8Exact.Face) (light: int[]) (rs: int[][]) : ExactRational =
        let bivector = E8Clifford.faceBivector rs.[face.A] rs.[face.B] rs.[face.C]
        let w = E8Clifford.wedgeVectorBivector light bivector

        { Numerator = E8Exact.dot w w
          Denominator = E8Exact.dot light light * E8Exact.FaceBivectorNormSquared }

    /// Specular cosine `<mirror(L), V> / (|L| |V|)` for a view direction that is also a root.
    ///
    /// Exactly rational, denominator `|B|^2 |L| |V| = 48 * 8 = 384`, because reflection
    /// preserves norm and both `L` and `V` are roots. This is the cosine itself, at exponent
    /// 1: **no exponent is shipped**, because a Phong exponent is a material parameter an
    /// author supplies and supplying one would be the hand-written lighting hack this ladder
    /// exists to avoid.
    let specularCosine (face: E8Exact.Face) (light: int[]) (view: int[]) (rs: int[][]) : ExactRational =
        let bivector = E8Clifford.faceBivector rs.[face.A] rs.[face.B] rs.[face.C]
        let mirror = E8Clifford.mirrorInPlane light bivector
        let lightNorm = E8Exact.dot light light
        let viewNorm = E8Exact.dot view view

        if lightNorm <> viewNorm then
            invalidArg "view" "specularCosine expects a light and a view of equal norm"

        { Numerator = E8Exact.dot mirror.Components view
          Denominator = mirror.Denominator * lightNorm }

    /// One shaded face. Every field is exact; nothing here has been through a projection.
    type ShadedFace =
        { Face: E8Exact.Face
          /// `a + b + c`, exact integers, squared norm 48.
          Normal: int[]
          /// `<L, n> / sqrt 384` — signed, so a caller can still tell the two sides apart.
          Lambert: ExactCosine
          /// `|<L, n>| / sqrt 384` — the two-sided value the 27-faces-per-edge count forces.
          TwoSided: ExactCosine
          /// False when the signed term is zero: the light grazes this face's normal.
          Lit: bool }

    /// Shade the whole face set under one root light.
    ///
    /// A pure function of `(face, light)` per face: no face's value depends on any other
    /// face or on the order they arrive in, so any rasterisation order gives the same image.
    /// Checked by permutation in the sibling test.
    ///
    /// The Lambert term DELEGATES to `lambertCosine` rather than recomputing the dot
    /// product. That is deliberate and is the exact defect the TypeScript oracle recorded at
    /// this line: an inlined copy leaves `lambertCosine` itself unpinned by any assertion, so
    /// mutating its numerator to a constant survives the whole suite. Two implementations of
    /// one quantity, only one of them tested, is where a defect hides.
    let shadeFaces (light: int[]) (faces: E8Exact.Face[]) (rs: int[][]) : ShadedFace[] =
        faces
        |> Array.map (fun face ->
            let lambert = lambertCosine face light rs

            { Face = face
              Normal = faceNormal8d face rs
              Lambert = lambert
              TwoSided =
                { Numerator = abs lambert.Numerator
                  DenominatorSquared = lambert.DenominatorSquared }
              Lit = lambert.Numerator <> 0 })

    /// The exact histogram of two-sided Lambert numerators, ascending by key.
    ///
    /// Keyed by integer, so it is an exact object a test compares for equality — which is
    /// how the light gauge is discharged: identical for every choice of light root.
    let intensityHistogram (shaded: ShadedFace[]) : (int * int)[] =
        let counts = Dictionary<int, int>()

        for s in shaded do
            let k = s.TwoSided.Numerator
            let mutable v = 0
            counts.[k] <- (if counts.TryGetValue(k, &v) then v else 0) + 1

        counts
        |> Seq.map (fun kv -> kv.Key, kv.Value)
        |> Seq.sortBy fst
        |> Seq.toArray

    /// The signed Lambert-numerator census, ascending by key.
    let lambertCensus (shaded: ShadedFace[]) : (int * int)[] =
        let counts = Dictionary<int, int>()

        for s in shaded do
            let k = s.Lambert.Numerator
            let mutable v = 0
            counts.[k] <- (if counts.TryGetValue(k, &v) then v else 0) + 1

        counts
        |> Seq.map (fun kv -> kv.Key, kv.Value)
        |> Seq.sortBy fst
        |> Seq.toArray

    /// The census of `|L ^ B|^2` numerators, ascending by key.
    let planeIlluminationCensus (light: int[]) (faces: E8Exact.Face[]) (rs: int[][]) : (int * int)[] =
        let counts = Dictionary<int, int>()

        for face in faces do
            let k = (planeIllumination face light rs).Numerator
            let mutable v = 0
            counts.[k] <- (if counts.TryGetValue(k, &v) then v else 0) + 1

        counts
        |> Seq.map (fun kv -> kv.Key, kv.Value)
        |> Seq.sortBy fst
        |> Seq.toArray

    /// The distinct two-sided brightness levels, ascending. Five, by construction: the
    /// numerator is an integer and both norms are fixed, so nobody chose a quantisation step.
    let brightnessLevels (shaded: ShadedFace[]) : int[] =
        intensityHistogram shaded |> Array.map fst
