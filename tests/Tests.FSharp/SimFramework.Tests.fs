module Zeta.Tests.SimFrameworkTests

// THE xUNIT ADAPTER, demonstrated: these [<Fact>]s are thin shims — the real test is the ROOM, run on
// OUR harness; xUnit merely asserts the sign-off (rooms-as-sign-off; the framework is hexagonal and
// xUnit is one adapter at the edge).

open System.Threading.Tasks
open global.Xunit
open Zeta.Core

let private isTimer =
    function
    | TimerElapsed _ -> true
    | _ -> false

/// A counting room: ticks toward 60 and signs off when it gets there (the minimal plateau).
let private countingRoom =
    SimFramework.room
        "counting-room"
        (fun _ -> 0)
        [ SoftScheduler.handler "count" isTimer (fun _ n -> Task.FromResult(Ok(n + 1))) ]
        60
        (fun n -> n >= 60)

[<Fact>]
let ``a room runs to resolution on OUR harness; xUnit only asserts the sign-off (the adapter)`` () =
    task {
        let! report = SimFramework.run countingRoom 7L
        Assert.True(report.SignedOff) // ← the entire xUnit surface: did the room sign off?
        Assert.Equal("counting-room", report.Room)
    }

[<Fact>]
let ``a room that cannot reach its plateau does NOT sign off (failing = unresolved, not exploded)`` () =
    task {
        let starved = { countingRoom with Budget = 10 } // 10 ticks can't reach 60
        let! report = SimFramework.run starved 7L
        Assert.False(report.SignedOff)
        match report.Final with
        | Ok n -> Assert.Equal(10, n) // it ran honestly; it just didn't resolve
        | Error e -> Assert.Fail(sprintf "starvation is not an error: %A" e)
    }

[<Fact>]
let ``DST: the same room at the same seed produces the same report (replay-equal)`` () =
    task {
        let! a = SimFramework.run countingRoom 42L
        let! b = SimFramework.run countingRoom 42L
        Assert.Equal(a.SignedOff, b.SignedOff)
        Assert.Equal<Result<int, InterruptFeedback>>(a.Final, b.Final)
    }

[<Fact>]
let ``the membrane is a PARAMETER: the same room runs against a recorded real-IO replay (withSource)`` () =
    task {
        // record a "live" membrane, then run the SAME room against the replay — §13 + hexagonal together
        let live: SoftScheduler.Source = fun n -> [ TimerElapsed 17; (if n = 3 then OperatorMessageArrived "io" else TimerElapsed 0) ]
        let recording = RecordedSource.record live 60
        let replayRoom = countingRoom |> SimFramework.withSource (fun _ -> RecordedSource.replay recording)
        let! report = SimFramework.run replayRoom 7L
        Assert.True(report.SignedOff) // the room resolves on the recorded membrane too
    }

[<Fact>]
let ``an interrupted room reports the interrupt and does not sign off (errors stay sum-channel)`` () =
    task {
        let boom =
            SimFramework.room
                "boom-room"
                (fun _ -> 0)
                [ SoftScheduler.handler "boom" isTimer (fun _ _ -> Task.FromResult(Error(Interrupted SentinelMissing))) ]
                5
                (fun _ -> true)
        let! report = SimFramework.run boom 1L
        Assert.False(report.SignedOff)
        match report.Final with
        | Error (Interrupted SentinelMissing) -> ()
        | other -> Assert.Fail(sprintf "expected the interrupt, got %A" other)
    }
