module Zeta.Tests.MembraneLogTreatyTests

// The MEMBRANE-LOG TREATY — the F# oracle byte-locks the RecordedSource wire lines (the channel-
// reliability surface: "for real treaties we need to know our channels are good and reliable").
// C#/TS/Rust parse + re-serialize the SAME lines byte-identically.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private goldenPath =
    Path.Combine(repoRoot (), "src", "Core.TypeScript", "recorded-source", "golden-vectors.lines")

let private goldenLines () =
    File.ReadAllLines goldenPath
    |> Array.filter (fun l -> not (l.StartsWith "#") && l.Length > 0)
    |> Array.toList

/// The recording the golden was generated from — reconstructed here; toLines must equal the golden bytes.
let private recording: RecordedSource.Recording =
    { Crossings =
        Map.ofList
            [ 7, [ RateLimitExhausted "graphql"; DotGitSaturation 3; RoundsElapsedSinceFreeTime 9; PeerPRMerged 7605 ]
              0, [ TimerElapsed 17; OperatorMessageArrived "line1\nline2\twith\ttabs\\and\\slashes" ]
              3, [ SentinelMissing; CIFailureDetected "job-42" ]
              12, [ OperatorMessageArrived "héllo-⊕-反馈"; TimerElapsed 0 ] ] }

[<Fact>]
let ``BYTE-LOCK: toLines emits exactly the golden lines (canonical order, all 8 kinds, escapes)`` () =
    Assert.Equal<string list>(goldenLines (), RecordedSource.toLines recording)

[<Fact>]
let ``round-trip: the golden lines parse back to the recording (ofLines ∘ toLines = id)`` () =
    let parsed = RecordedSource.ofLines (goldenLines ())
    Assert.Equal<Map<int, InterruptKind list>>(recording.Crossings, parsed.Crossings)
