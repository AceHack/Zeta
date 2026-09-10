#r "../Core/bin/Release/net10.0/Zeta.Core.dll"

open System
open System.IO
open System.Security.Cryptography
open System.Text.Json
open Zeta.Core

// Historical defect witness. Run from the pre-fix archive, never as a desired-behavior test.
let root = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "..", ".."))
let sourceCommit = "cfc3f53f011b21ce54d9d9380d9de244b6b4015f"
let expectedSourceHash = "20CC8F598BB12BF0FD2584D6C0B6710EE0775D22CCCFADF8D9B72C1AAA1C81FF"
let hash path = File.ReadAllBytes path |> SHA256.HashData |> Convert.ToHexString
let output = match fsi.CommandLineArgs |> Array.skip 1 with [|path|] -> path | _ -> failwith "usage: chsh-coverage-witness.fsx NEW_OUTPUT"
let sourceHash = hash (Path.Combine(root, "src/Core/AntiSybil.fs"))
if sourceHash <> expectedSourceHash then failwith "historical witness requires its reviewed pre-fix source"

let streams settings response =
    settings |> List.mapi (fun index (x,y) ->
        let a,b = response index x y
        ({Setting=x;Outcome=a}:AntiSybil.ChshRound),({Setting=y;Outcome=b}:AntiSybil.ChshRound)) |> List.unzip

let measure name tolerance settings response =
    let a,b = streams settings response
    let series = AntiSybil.outcomeProductSeries a b
    let buckets = Array.zeroCreate<int> 4
    settings |> List.iter (fun (x,y) -> buckets.[2*x+y] <- buckets.[2*x+y]+1)
    {| Name=name; BucketCounts=buckets; Rounds=a.Length; Delta=0.01; StationarityTolerance=tolerance
       Score=AntiSybil.chshS a b; HacMargin=AntiSybil.chshMarginAutocorr 0.01 a b
       Stationary=AntiSybil.isApproxStationaryMultiBlock tolerance 4 series
       CalibratedComponents=(AntiSybil.chshSybilCalibrated 0.01 [a;b]).DistinctCount
       StationarityComponents=(AntiSybil.chshSybilAutocorrCalibrated 0.01 tolerance [a;b]).DistinctCount
       MeterAboveBound=(DecorrelationMeter.classifyPair 0.01 a b = DecorrelationMeter.AboveClassicalBound) |}

let repeated count pairs = [for _ in 1..count do yield! pairs]
let constant _ _ _ = 1,1
let missing = measure "missing-01-constant-local" 0.0 (repeated 100 [0,0;1,0;1,1]) constant
let complete = measure "complete-constant-local" 0.0 (repeated 100 [0,0;0,1;1,0;1,1]) constant
let sparseSettings = (0,1)::repeated 1000 [0,0;1,0;1,1]
let sparse = measure "single-01-alternating-local" 0.01 sparseSettings (fun index x _ ->
    let innovation = if index%2=0 then -1 else 1
    (if x=0 then innovation else 1),1)

if missing.Score <> 3.0 || missing.CalibratedComponents <> 1 || missing.StationarityComponents <> 1 || not missing.MeterAboveBound then
    failwith "missing-setting pre-fix witness did not reproduce"
if complete.Score <> 2.0 || complete.CalibratedComponents <> 2 || complete.StationarityComponents <> 2 || complete.MeterAboveBound then
    failwith "complete-coverage local control changed"
if sparse.Score <> 3.0 || sparse.CalibratedComponents <> 1 || sparse.StationarityComponents <> 1 || not sparse.MeterAboveBound then
    failwith "sparse-setting pre-fix witness did not reproduce"

let assembly = typeof<AntiSybil.ChshRound>.Assembly
let result =
    {| Protocol="chsh-coverage-defect-witness-v1"; ReviewedMainCommit=sourceCommit; AntiSybilSourceSha256=sourceHash
       LoadedCoreSha256=hash assembly.Location; LoadedCoreMvid=assembly.ManifestModule.ModuleVersionId.ToString()
       Runtime=System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription
       Cases=[|missing;complete;sparse|]
       Scope="Deterministic local-response witnesses and control; no false-positive frequency or full calibration theorem." |}
let json = JsonSerializer.Serialize(result,JsonSerializerOptions(WriteIndented=true)) + Environment.NewLine
let write () =
    use destination = new FileStream(output,FileMode.CreateNew,FileAccess.Write,FileShare.None)
    use writer = new StreamWriter(destination)
    writer.Write json
write ()
