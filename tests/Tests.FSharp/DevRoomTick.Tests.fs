module Zeta.Tests.DevRoomTickTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``the salon ticks: the soft tie holds (strength reported)`` () =
    task {
        let! r = DevRoom.tick "salon" 7L 5
        match r with
        | Ok run ->
            Assert.Equal("salon", run.Landmark)
            Assert.Contains("tied", run.Summary)
        | Error e -> Assert.Fail(sprintf "salon errored: %A" e)
    }

[<Fact>]
let ``the darkhall ticks: chip8 runs on the scheduler (V[A] set)`` () =
    task {
        let! r = DevRoom.tick "darkhall" 1L 5
        match r with
        | Ok run -> Assert.Contains("V[A]=0x0C", run.Summary)
        | Error e -> Assert.Fail(sprintf "darkhall errored: %A" e)
    }

[<Fact>]
let ``the bowling alley ticks: deterministic rolls fold to a score`` () =
    task {
        let! r = DevRoom.tick "bowling alley" 42L 21
        match r with
        | Ok run ->
            Assert.Contains("rolled 21", run.Summary)
            Assert.Contains("score", run.Summary)
        | Error e -> Assert.Fail(sprintf "bowling errored: %A" e)
    }

[<Fact>]
let ``the skatium ticks: the weave steps and finds openings`` () =
    task {
        let! r = DevRoom.tick "skatium" 3L 16
        match r with
        | Ok run ->
            Assert.Contains("wove 16 steps", run.Summary)
            Assert.Contains("openings", run.Summary)
        | Error e -> Assert.Fail(sprintf "skatium errored: %A" e)
    }

[<Fact>]
let ``DST: every room's tick replays identically (same landmark, seed, budget => same summary)`` () =
    task {
        for lm in DevRoom.landmarks do
            let! a = DevRoom.tick lm 99L 12
            let! b = DevRoom.tick lm 99L 12
            Assert.Equal<Result<DevRoom.RoomRun, InterruptFeedback>>(a, b)
    }

[<Fact>]
let ``unknown landmark errors cleanly; tickAll sweeps the whole register`` () =
    task {
        let! bad = DevRoom.tick "casino" 1L 3
        Assert.True(match bad with Error _ -> true | Ok _ -> false)
        let! all = DevRoom.tickAll 5L 8
        Assert.Equal(DevRoom.landmarks.Length, all.Length)
        Assert.True(all |> List.forall (fun r -> not (r.Summary.StartsWith "ERROR")))
    }
