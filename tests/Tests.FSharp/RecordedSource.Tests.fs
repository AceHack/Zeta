module Zeta.Tests.RecordedSourceTests

open System.Threading.Tasks
open global.Xunit
open Zeta.Core

let private ctx () : IntrCtx =
    { Memetic = "rec"; Prompt = ""; Trust = ""; Log = ""; Otel = System.Diagnostics.ActivityContext() }

let private isTimer =
    function
    | TimerElapsed _ -> true
    | _ -> false

/// A "live" source simulating real IO: stateful underneath (a mutable consumption log), exactly the
/// impure thing the recorder is for.
let private liveSource () =
    let consumed = System.Collections.Generic.HashSet<int>()
    let src: SoftScheduler.Source =
        fun n ->
            consumed.Add n |> ignore
            [ yield TimerElapsed 17
              if n % 3 = 0 then yield OperatorMessageArrived(sprintf "io-%d" n)
              if n = 5 then yield PeerPRMerged 7591 ]
    src, consumed

[<Fact>]
let ``record captures the membrane crossings; replay reproduces them exactly (incl. quiet ticks)`` () =
    let live, _ = liveSource ()
    let rec' = RecordedSource.record live 10
    let replayed = RecordedSource.replay rec'
    for n in 0..9 do
        Assert.Equal<InterruptKind list>(live n, replayed n)
    Assert.Empty(replayed 99) // beyond the recording the membrane is quiet

[<Fact>]
let ``the FDB move: a scheduler run on the LIVE source == the run on the REPLAYED recording (DST survives real IO)`` () =
    task {
        let count: SoftScheduler.Handler<int> =
            SoftScheduler.handler "count" (fun _ -> true) (fun _ n -> Task.FromResult(Ok(n + 1)))
        let live, _ = liveSource ()
        let rec' = RecordedSource.record live 20
        let! a = (SoftScheduler.drive [ count ] live).Run (ctx ()) 1L 0 20
        let! b = (SoftScheduler.drive [ count ] (RecordedSource.replay rec')).Run (ctx ()) 1L 0 20
        Assert.Equal<Result<int, InterruptFeedback>>(a, b)
    }

[<Fact>]
let ``the text codec round-trips byte-identically (the treaty surface) — incl. escaping`` () =
    let nasty = "line1\nline2\twith\ttabs\\and\\slashes"
    let r: RecordedSource.Recording =
        { Crossings =
            Map.ofList
                [ 0, [ TimerElapsed 17; OperatorMessageArrived nasty ]
                  3, [ SentinelMissing; CIFailureDetected "job-42" ]
                  7, [ RateLimitExhausted "graphql"; DotGitSaturation 3; RoundsElapsedSinceFreeTime 9; PeerPRMerged 1 ] ] }
    let lines = RecordedSource.toLines r
    let r2 = RecordedSource.ofLines lines
    Assert.Equal<Map<int, InterruptKind list>>(r.Crossings, r2.Crossings)
    // deterministic serialization: same recording => byte-identical lines (diffable, golden-vector-able)
    Assert.Equal<string list>(lines, RecordedSource.toLines r2)

[<Fact>]
let ``replaying a recording is itself replayable (record of a replay == the recording)`` () =
    let live, _ = liveSource ()
    let rec1 = RecordedSource.record live 12
    let rec2 = RecordedSource.record (RecordedSource.replay rec1) 12
    Assert.Equal<Map<int, InterruptKind list>>(rec1.Crossings, rec2.Crossings)
