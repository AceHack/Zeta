namespace Zeta.E8Render

open System
open System.Globalization
open System.Numerics
open System.Security.Cryptography
open System.Text

/// **`H3GoldenVector` — the rank-3 byte-lock, as TEXT.**
///
/// Verification artifacts are text, never binary blobs
/// (`.claude/rules/no-binary-in-proof-lineage.md`), so the whole cross-language agreement
/// between this F# oracle and the TypeScript one in
/// `tests/cross-verification/h3-rank3-geometry/emit-golden.ts` is a single canonical JSON
/// document that both sides EMIT. The committed
/// `tests/cross-verification/h3-rank3-geometry/h3-rank3-geometry.golden.json` is the treaty;
/// the falsifier is byte equality.
///
/// **The document contains no floating point.** Every locked quantity is an integer or a
/// `Z[phi]` pair of integers, so there is no numeric formatting treaty to negotiate between
/// `Number` and `System.Double` and the whole class of divergence
/// `.claude/rules/culture-invariant-by-default.md` exists for cannot arise here. Integers are
/// still rendered with `CultureInfo.InvariantCulture` because a negative sign is a
/// culture-sensitive glyph in some locales, and a golden vector that depends on the machine's
/// locale is not a golden vector.
///
/// **Why emit-and-compare rather than parse-and-assert.** A parser gives each side a chance to
/// be lenient about something the other was strict about, and a lenient comparison is a check
/// that can fail to fail.
[<RequireQualifiedAccess>]
module H3GoldenVector =

    let private inv (x: BigInteger) = x.ToString(CultureInfo.InvariantCulture)
    let private invInt (x: int) = x.ToString(CultureInfo.InvariantCulture)

    /// The canonical record separator: fields by `,`, records by `;`.
    let canonicalString (records: seq<seq<BigInteger>>) : string =
        let sb = StringBuilder()
        let mutable firstRecord = true

        for record in records do
            if not firstRecord then sb.Append(';') |> ignore
            firstRecord <- false
            let mutable firstField = true

            for field in record do
                if not firstField then sb.Append(',') |> ignore
                firstField <- false
                sb.Append(inv field) |> ignore

        sb.ToString()

    /// SHA-256 of the canonical serialisation, lowercase hex.
    let digest (records: seq<seq<BigInteger>>) : string =
        let bytes = Encoding.UTF8.GetBytes(canonicalString records)
        SHA256.HashData(bytes) |> Convert.ToHexString |> fun s -> s.ToLowerInvariant()

    let private zFlat (v: H3Exact.VecZphi) : BigInteger seq =
        v |> Seq.collect (fun c -> [ c.A; c.B ])

    let private ints (xs: BigInteger seq) : string =
        "[" + (xs |> Seq.map inv |> String.concat ", ") + "]"

    let private intsOfInt (xs: int seq) : string =
        "[" + (xs |> Seq.map invInt |> String.concat ", ") + "]"

    let private zText (x: H3Exact.Zphi) : string = ints [ x.A; x.B ]

    let private solidBlock (s: H3Exact.Solid) : string =
        let p = H3Exact.polytope s
        let triangles = H3Exact.triangulate p.Points p.Facets
        let rootLight = H3Exact.rootLight 0

        // One representative facet per SIZE, in ascending size — the same partition the
        // TypeScript oracle emits, so the two documents line up field for field.
        let facetTypes =
            p.Facets
            |> Array.groupBy (fun f -> f.Vertices.Length)
            |> Array.sortBy fst
            |> Array.map (fun (size, group) ->
                let representative = group.[0]
                let radical = H3Exact.normalRadical representative.NormalNormSquared

                let radicandText =
                    match radical with
                    | Some r -> invInt r.Radicand
                    | None -> "null"

                let coefficientText =
                    match radical with
                    | Some r -> zText r.Coefficient
                    | None -> "null"

                let cosText (light: H3Exact.VecZphi) =
                    match H3Exact.cosineRadicand light representative.Normal with
                    | Some d -> invInt d
                    | None -> "null"

                sprintf
                    "      { \"facetSize\": %s, \"facets\": %s, \"normalNormSquared\": %s, \"normalRadicand\": %s, \"normalRadicalCoefficient\": %s, \"rootLightCosineRadicand\": %s, \"integralLightCosineRadicand\": %s }"
                    (invInt size)
                    (invInt group.Length)
                    (zText representative.NormalNormSquared)
                    radicandText
                    coefficientText
                    (cosText rootLight)
                    (cosText H3Exact.integralLight))
            |> String.concat ",\n"

        let rootCensus = H3Exact.shadeFacets rootLight p.Facets
        let integralCensus = H3Exact.shadeFacets H3Exact.integralLight p.Facets

        let censusDigest (c: H3Exact.ShadingCensus) =
            digest (c.Census |> Seq.map (fun (v, n) -> seq { v.A; v.B; BigInteger(n) }))

        [ sprintf "    \"%s\": {" (H3Exact.solidName s)
          sprintf "      \"seed\": %s," (ints (zFlat p.Seed))
          sprintf "      \"fVector\": %s," (intsOfInt p.FVector)
          sprintf "      \"euler\": %s," (invInt p.Euler)
          sprintf "      \"nonIntegralReflections\": %s," (invInt p.NonIntegralReflections)
          sprintf "      \"facetSizeCensus\": %s," (intsOfInt (p.FacetSizeCensus |> Seq.collect (fun (a, b) -> [ a; b ])))
          sprintf "      \"edgeFacetIncidence\": %s," (intsOfInt [ p.Incidence.Edges; p.Incidence.Min; p.Incidence.Max ])
          sprintf "      \"triangles\": %s," (invInt triangles.Length)
          sprintf "      \"verticesSha256\": \"%s\"," (digest (p.Points |> Seq.map zFlat))
          sprintf
              "      \"facetsSha256\": \"%s\","
              (digest (p.Facets |> Seq.map (fun f -> f.Vertices |> Seq.map BigInteger)))
          sprintf "      \"facetNormalsSha256\": \"%s\"," (digest (p.Facets |> Seq.map (fun f -> zFlat f.Normal)))
          sprintf
              "      \"edgesSha256\": \"%s\","
              (digest (p.Edges |> Seq.map (fun e -> seq { BigInteger(e.From); BigInteger(e.To) })))
          sprintf
              "      \"trianglesSha256\": \"%s\","
              (digest (triangles |> Seq.map (fun (a, b, c) -> seq { BigInteger(a); BigInteger(b); BigInteger(c) })))
          "      \"facetTypes\": ["
          facetTypes
          "      ],"
          sprintf "      \"rootLightSignedLevels\": %s," (invInt rootCensus.SignedLevels.Length)
          sprintf "      \"rootLightAbsoluteLevels\": %s," (invInt rootCensus.AbsoluteLevels.Length)
          sprintf "      \"rootLightLitLevels\": %s," (invInt rootCensus.LitLevels.Length)
          sprintf "      \"rootLightTerminatorFacets\": %s," (invInt rootCensus.TerminatorFacets)
          sprintf "      \"rootLightCensusSha256\": \"%s\"," (censusDigest rootCensus)
          sprintf "      \"integralLightSignedLevels\": %s," (invInt integralCensus.SignedLevels.Length)
          sprintf "      \"integralLightAbsoluteLevels\": %s," (invInt integralCensus.AbsoluteLevels.Length)
          sprintf "      \"integralLightTerminatorFacets\": %s," (invInt integralCensus.TerminatorFacets)
          sprintf "      \"integralLightCensusSha256\": \"%s\"" (censusDigest integralCensus)
          "    }" ]
        |> String.concat "\n"

    /// Emit the canonical document. Byte-for-byte identical to the TypeScript oracle's, or the
    /// cross-verification fails and the disagreement is the finding.
    let emit () : string =
        let rs = H3Exact.roots ()
        let a1, a2, a3 = H3Exact.simpleRoots ()
        let w1, w2, w3 = H3Exact.fundamentalWeights ()

        let lines =
            [ "{"
              "  \"schema\": \"h3-rank3-geometry-golden/v1\","
              "  \"frame\": \"Z[phi] coordinates, phi^2 = phi + 1; H3 root norm squared 4; RANK 3, NO PROJECTION\","
              "  \"canonicalSerialisation\": \"fields joined by ',', records joined by ';', UTF-8, SHA-256 lowercase hex\","
              "  \"floatingPoint\": \"none — every locked quantity is an integer or a Z[phi] pair of integers\","
              sprintf "  \"rootCount\": %s," (invInt rs.Length)
              sprintf "  \"rootNormSquared\": %s," (zText (H3Exact.zDot rs.[0] rs.[0]))
              sprintf "  \"rootsSha256\": \"%s\"," (digest (rs |> Seq.map zFlat))
              sprintf "  \"simpleRoots\": %s," (ints (Seq.concat [ zFlat a1; zFlat a2; zFlat a3 ]))
              sprintf
                  "  \"simpleGram\": %s,"
                  (ints (
                      seq {
                          (H3Exact.zDot a1 a2).A
                          (H3Exact.zDot a1 a2).B
                          (H3Exact.zDot a2 a3).A
                          (H3Exact.zDot a2 a3).B
                          (H3Exact.zDot a1 a3).A
                          (H3Exact.zDot a1 a3).B
                      }
                  ))
              sprintf "  \"fundamentalWeights\": %s," (ints (Seq.concat [ zFlat w1; zFlat w2; zFlat w3 ]))
              sprintf
                  "  \"weightNormsSquared\": %s,"
                  (ints (
                      seq {
                          (H3Exact.zDot w1 w1).A
                          (H3Exact.zDot w1 w1).B
                          (H3Exact.zDot w2 w2).A
                          (H3Exact.zDot w2 w2).B
                          (H3Exact.zDot w3 w3).A
                          (H3Exact.zDot w3 w3).B
                      }
                  ))
              sprintf "  \"rootLight\": %s," (ints (zFlat (H3Exact.rootLight 0)))
              sprintf "  \"integralLight\": %s," (ints (zFlat H3Exact.integralLight))
              sprintf
                  "  \"integralLightNormSquared\": %s,"
                  (zText (H3Exact.zDot H3Exact.integralLight H3Exact.integralLight))
              "  \"solids\": {"
              (H3Exact.solids |> List.map solidBlock |> String.concat ",\n")
              "  }"
              "}"
              "" ]

        String.Join("\n", lines)
