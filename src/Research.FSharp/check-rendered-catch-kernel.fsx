#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#load "ResearchRandom.fs"
#load "RenderedSignalCarrier.fs"
#load "RenderedCatchReceipt.fs"
#load "RenderedCatchCarrier.fs"
#load "RenderedCatchPolicy.fs"
#load "RenderedCatchExperiment.fs"
#load "RenderedCatchRuntime.fsx"

open System
open System.IO
open Zeta.Research

// Hand conformance fixture only: no registered corpus, training, timing, or promotion.
open System.Text.Json

let require = function Ok value -> value | Error (reason: RenderedCatchReceipt.Failure) -> eprintfn "%s: %s" reason.Code reason.Detail; exit 1
let input = Path.Combine(__SOURCE_DIRECTORY__, "rendered-signal-results.json") |> File.ReadAllBytes
let counts = RenderedCatchPolicy.readCounts input |> require
let symbols = Array.init 66 (fun index -> [|0;0;1;0;1;1|].[index % 6])
let rows =
    [| for geometry, palette in ["dot","fixed";"bar","fixed";"dot","odd-complement"] do
           let shape = RenderedCatchCarrier.geometry geometry |> require
           let bytes = RenderedCatchCarrier.compile shape symbols |> require
           let rom = RenderedCatchCarrier.admit shape bytes |> require
           let arms =
               [| for name in RenderedCatchReceipt.config.Arms do
                      let fair = if name = "fair-independent" then Some(RenderedCatchPolicy.FairStream(ResearchRandom.domain 19UL 29)) else None
                      yield {| Name = name; Batch = RenderedCatchExperiment.runBatch "hand-fixture" name counts fair 0 [|symbols,rom|] palette |} |]
           yield {| Geometry = geometry; Palette = palette; RomSha256 = RenderedCatchCarrier.sha256 bytes; Arms = arms |} |]
if rows |> Array.exists (fun row -> row.Arms |> Array.exists (fun arm -> not arm.Batch.Complete)) then eprintfn "fixture failed"; exit 1
let receipt =
    {| Kind = "hand-conformance-fixture"; Protocol = RenderedCatchReceipt.protocol; Symbols = RenderedCatchCarrier.binaryString symbols
       FairSeed = 19; FairDomain = 29; InputSha256 = RenderedCatchCarrier.sha256 input; CountsSha256 = RenderedCatchPolicy.hashCounts counts |> require
       Rows = rows |}
printfn "%s" (JsonSerializer.Serialize(receipt))
