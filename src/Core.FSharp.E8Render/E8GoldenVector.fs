namespace Zeta.E8Render

open System
open System.Globalization
open System.Security.Cryptography
open System.Text

/// **`E8GoldenVector` — the byte-lock, as TEXT.**
///
/// Verification artifacts are text, never binary blobs
/// (`.claude/rules/no-binary-in-proof-lineage.md`), so the whole cross-language agreement
/// between this F# oracle and the TypeScript one is a single canonical JSON document that
/// both sides EMIT. The committed file
/// `tests/cross-verification/clifford-e8-rendering/clifford-e8-rendering.golden.json` is
/// the treaty; the falsifier is byte equality between what this module produces and what is
/// on disk.
///
/// **Why emit-and-compare rather than parse-and-assert.** A parser gives each side a chance
/// to be lenient about something the other was strict about, and a lenient comparison is a
/// check that can fail to fail. Emitting the whole document from both oracles and comparing
/// bytes has no such slack: a disagreement anywhere is a diff, and a diff on a text file is
/// reviewable by a human in a `git` diff, which is what makes this a *good* meter — anyone
/// can inspect it and agree to the rules in advance.
///
/// **The canonical serialisation, stated so it can be reproduced:** a record's fields are
/// joined with `,`; records are joined with `;`; the resulting string is encoded UTF-8 and
/// hashed with SHA-256, rendered as lowercase hex. Sixty thousand faces do not belong inline
/// in a golden vector, but their digest does, and the digest is exactly as diffable.
///
/// **What is deliberately NOT locked:** the 3D embedding's coordinates. An eigenvector is
/// defined up to sign, so locking one would lock an arbitrary gauge; the ring COUNT and the
/// points-per-ring are rotation- and precision-invariant and are locked instead. See
/// `E8Embedding`.
[<RequireQualifiedAccess>]
module E8GoldenVector =

    /// The canonical record separator: fields by `,`, records by `;`.
    let canonicalString (records: seq<seq<int>>) : string =
        let sb = StringBuilder()
        let mutable firstRecord = true

        for record in records do
            if not firstRecord then sb.Append(';') |> ignore
            firstRecord <- false
            let mutable firstField = true

            for field in record do
                if not firstField then sb.Append(',') |> ignore
                firstField <- false
                sb.Append(field.ToString(CultureInfo.InvariantCulture)) |> ignore

        sb.ToString()

    /// SHA-256 of the canonical serialisation, lowercase hex.
    let digest (records: seq<seq<int>>) : string =
        let bytes = Encoding.UTF8.GetBytes(canonicalString records)
        SHA256.HashData(bytes) |> Convert.ToHexString |> fun s -> s.ToLowerInvariant()

    /// Every measured quantity this oracle stands behind.
    type Report =
        { RootCount: int
          RootSplit: int[]
          RootsSha256: string
          FirstRoot: int[]
          LastRoot: int[]
          EdgeCount: int
          EdgesSha256: string
          FaceCount: int
          FacesSha256: string
          FirstFace: int[]
          LastFace: int[]
          FVector: int[]
          EulerAlternatingSum: int
          EdgeFaceIncidence: int[]
          FaceNormalsSha256: string
          LambertCensus: (int * int)[]
          TwoSidedCensus: (int * int)[]
          BrightnessLevels: int[]
          PlaneIlluminationCensus: (int * int)[]
          CoxeterRingCount: int
          CoxeterPointsPerRing: int }

    /// Measure everything, from the substrate, under the light `roots.[lightIndex]`.
    let measure (lightIndex: int) : Report =
        let rs = E8Exact.roots ()
        let adj = E8Exact.adjacency rs
        let edges = E8Exact.gossetEdges adj
        let faces = E8Exact.triangleFaces adj
        let light = E8Shading.lightFromRootIndex lightIndex rs
        let shaded = E8Shading.shadeFaces light faces rs
        let struct (edgeCount, incMin, incMax) = E8Exact.edgeFaceIncidence faces
        let layers = E8Embedding.eigenLayers ()
        let rings = E8Embedding.coxeterRingCensus 6 rs layers

        let twoTwoZero =
            rs
            |> Array.filter (fun r -> r |> Array.exists (fun x -> abs x = 2))
            |> Array.length

        { RootCount = rs.Length
          RootSplit = [| twoTwoZero; rs.Length - twoTwoZero |]
          RootsSha256 = digest (rs |> Seq.map (fun r -> Seq.ofArray r))
          FirstRoot = rs.[0]
          LastRoot = rs.[rs.Length - 1]
          EdgeCount = edges.Length
          EdgesSha256 = digest (edges |> Seq.map (fun (struct (i, j)) -> seq { i; j }))
          FaceCount = faces.Length
          FacesSha256 = digest (faces |> Seq.map (fun f -> seq { f.A; f.B; f.C }))
          FirstFace = [| faces.[0].A; faces.[0].B; faces.[0].C |]
          LastFace =
            [| faces.[faces.Length - 1].A
               faces.[faces.Length - 1].B
               faces.[faces.Length - 1].C |]
          FVector = E8Exact.fVector adj rs
          EulerAlternatingSum = E8Exact.eulerAlternatingSum (E8Exact.fVector adj rs)
          EdgeFaceIncidence = [| edgeCount; incMin; incMax |]
          FaceNormalsSha256 = digest (faces |> Seq.map (fun f -> Seq.ofArray (E8Shading.faceNormal8d f rs)))
          LambertCensus = E8Shading.lambertCensus shaded
          TwoSidedCensus = E8Shading.intensityHistogram shaded
          BrightnessLevels = E8Shading.brightnessLevels shaded
          PlaneIlluminationCensus = E8Shading.planeIlluminationCensus light faces rs
          CoxeterRingCount = rings.Length
          CoxeterPointsPerRing =
            let counts = rings |> Array.map snd |> Array.distinct
            if counts.Length = 1 then counts.[0] else -1 }

    let private ints (xs: seq<int>) : string =
        "[" + String.Join(", ", xs |> Seq.map (fun x -> x.ToString(CultureInfo.InvariantCulture))) + "]"

    let private pairs (indent: string) (xs: (int * int)[]) : string =
        let sb = StringBuilder()
        sb.Append("[\n") |> ignore

        xs
        |> Array.iteri (fun i (k, v) ->
            sb
                .Append(indent)
                .Append("  [")
                .Append(k.ToString(CultureInfo.InvariantCulture))
                .Append(", ")
                .Append(v.ToString(CultureInfo.InvariantCulture))
                .Append(if i = xs.Length - 1 then "]\n" else "],\n")
            |> ignore)

        sb.Append(indent).Append("]") |> ignore
        sb.ToString()

    /// Render the report as the canonical golden-vector JSON document.
    ///
    /// The layout is part of the treaty: two-space indent, one key per line, integer arrays
    /// inline with `", "`, census arrays one pair per line, LF line endings, one trailing
    /// newline. Both oracles emit exactly this, and the falsifier is byte equality.
    let render (r: Report) : string =
        let sb = StringBuilder()

        let line (s: string) = sb.Append("  ").Append(s).Append('\n') |> ignore

        sb.Append("{\n") |> ignore
        line "\"schema\": \"clifford-e8-rendering-golden/v1\","
        line "\"frame\": \"doubled integer coordinates; root norm squared 8\","
        line "\"canonicalSerialisation\": \"fields joined by ',', records joined by ';', UTF-8, SHA-256 lowercase hex\","
        line ("\"rootCount\": " + string r.RootCount + ",")
        line ("\"rootSplit\": " + ints r.RootSplit + ",")
        line ("\"rootNormSquared\": " + string E8Exact.RootNormSquared + ",")
        line ("\"rootsSha256\": \"" + r.RootsSha256 + "\",")
        line ("\"firstRoot\": " + ints r.FirstRoot + ",")
        line ("\"lastRoot\": " + ints r.LastRoot + ",")
        line ("\"gossetEdgeInnerProduct\": " + string E8Exact.GossetEdgeInnerProduct + ",")
        line ("\"edgeCount\": " + string r.EdgeCount + ",")
        line ("\"edgesSha256\": \"" + r.EdgesSha256 + "\",")
        line ("\"faceCount\": " + string r.FaceCount + ",")
        line ("\"facesSha256\": \"" + r.FacesSha256 + "\",")
        line ("\"firstFace\": " + ints r.FirstFace + ",")
        line ("\"lastFace\": " + ints r.LastFace + ",")
        line ("\"fVector\": " + ints r.FVector + ",")
        line ("\"eulerAlternatingSum\": " + string r.EulerAlternatingSum + ",")
        line ("\"edgeFaceIncidence\": " + ints r.EdgeFaceIncidence + ",")
        line ("\"faceNormalNormSquared\": " + string E8Exact.FaceNormalNormSquared + ",")
        line ("\"faceBivectorNormSquared\": " + string E8Exact.FaceBivectorNormSquared + ",")
        line ("\"faceNormalsSha256\": \"" + r.FaceNormalsSha256 + "\",")
        line ("\"lambertDenominatorSquared\": " + string E8Shading.LambertDenominatorSquared + ",")
        line ("\"lambertCensus\": " + pairs "  " r.LambertCensus + ",")
        line ("\"twoSidedCensus\": " + pairs "  " r.TwoSidedCensus + ",")
        line ("\"brightnessLevels\": " + ints r.BrightnessLevels + ",")
        line ("\"planeIlluminationCensus\": " + pairs "  " r.PlaneIlluminationCensus + ",")
        line ("\"coxeterRingCount\": " + string r.CoxeterRingCount + ",")
        line ("\"coxeterPointsPerRing\": " + string r.CoxeterPointsPerRing)
        sb.Append("}\n") |> ignore
        sb.ToString()

    /// The whole byte-lock in one call: measure under root 0 and render.
    let emit () : string = render (measure 0)
