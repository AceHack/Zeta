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

#load "../../../Core/CliffordPeriodicity.fs"
open Zeta.Core

let sb = System.Text.StringBuilder()

for p in 0..12 do
    for q in 0..12 do
        match CliffordPeriodicity.classify p q with
        | Ok t ->
            let ground =
                match t.Ground with
                | CliffordPeriodicity.Real -> "R"
                | CliffordPeriodicity.Complex -> "C"
                | CliffordPeriodicity.Quaternionic -> "H"

            sb.AppendLine(
                System.String.Format(
                    System.Globalization.CultureInfo.InvariantCulture,
                    "{0} {1} {2} {3} {4} {5}",
                    p,
                    q,
                    CliffordPeriodicity.signatureClass p q,
                    ground,
                    t.MatrixDim,
                    t.IsSplit
                )
            )
            |> ignore
        | Error e -> failwithf "classify %d %d returned Error %A" p q e

let out =
    System.IO.Path.Combine(__SOURCE_DIRECTORY__, "clifford-periodicity-grid.raw.txt")

System.IO.File.WriteAllText(out, sb.ToString())
printfn "wrote %s" out
