// Regenerates `clifford-periodicity-grid.golden.txt` FROM THE F# MODULE.
//
// The golden vector exists so the TypeScript transcription in
// `../conformal-embedding-and-curvature-budget.ts` can be cross-verified against the
// authority (`src/Core/CliffordPeriodicity.fs`) in CI jobs that have no dotnet. Generating
// it from the TypeScript would make the check agree with itself and constrain nothing --
// the vacuity class. It must come from here.
//
//   dotnet fsi src/Core.TypeScript/research/testdata/dump-clifford-grid.fsx
//
// then diff the emitted .raw.txt against the .golden.txt body (the golden file carries a
// comment header the raw dump does not).
//
// TWO SECTIONS. `ND` rows are the non-degenerate `classify p q`; `DG` rows are
// `classifyDegenerate p q r`, added 2026-08-26 so PGA-style signatures are pinned too.

#load "../../../Core/CliffordPeriodicity.fs"
open Zeta.Core

let inv = System.Globalization.CultureInfo.InvariantCulture
let sb = System.Text.StringBuilder()

let groundOf (g: CliffordPeriodicity.Ground) =
    match g with
    | CliffordPeriodicity.Real -> "R"
    | CliffordPeriodicity.Complex -> "C"
    | CliffordPeriodicity.Quaternionic -> "H"

// ── non-degenerate: p q s ground matrixDim isSplit ────────────────────────────────────────────
for p in 0..12 do
    for q in 0..12 do
        match CliffordPeriodicity.classify p q with
        | Ok t ->
            sb.AppendLine(
                System.String.Format(
                    inv, "ND {0} {1} {2} {3} {4} {5}",
                    p, q, CliffordPeriodicity.signatureClass p q, groundOf t.Ground, t.MatrixDim, t.IsSplit))
            |> ignore
        | Error e -> failwithf "classify %d %d returned Error %A" p q e

// ── degenerate: p q r dim radical quotientGround quotientDim quotientSplit ────────────────────
for p in 0..6 do
    for q in 0..6 do
        for r in 0..4 do
            match CliffordPeriodicity.classifyDegenerate p q r with
            | Ok d ->
                sb.AppendLine(
                    System.String.Format(
                        inv, "DG {0} {1} {2} {3} {4} {5} {6} {7}",
                        p, q, r, d.RealDimension, d.RadicalDimension,
                        groundOf d.SemisimpleQuotient.Ground,
                        d.SemisimpleQuotient.MatrixDim,
                        d.SemisimpleQuotient.IsSplit))
                |> ignore
            | Error e -> failwithf "classifyDegenerate %d %d %d returned Error %A" p q r e

let out =
    System.IO.Path.Combine(__SOURCE_DIRECTORY__, "clifford-periodicity-grid.raw.txt")

System.IO.File.WriteAllText(out, sb.ToString())
printfn "wrote %s" out
