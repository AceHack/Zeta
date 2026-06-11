module Zeta.Tests.MeshPongTests

// Pong over the mesh — the integration artifact: rooms + scheduler + recorded membranes + the lockstep
// treaty. Two rooms replay the same crossings and must agree byte-for-byte; a tampered crossing is
// CAUGHT as desync (anti-cheat = noninterference, demonstrated).

open global.Xunit
open Zeta.Core

[<Fact>]
let ``lockstep parity: two rooms replaying the same crossings produce BYTE-EQUAL worlds (the treaty holds)`` () =
    task {
        let! _, a, b = MeshPong.playMatch 42L 400 1
        Assert.Equal<Result<MeshPong.Game, InterruptFeedback>>(a.Final, b.Final)
    }

[<Fact>]
let ``the match resolves: someone scores and both rooms sign off together`` () =
    task {
        let! _, a, b = MeshPong.playMatch 42L 400 1
        Assert.True(a.SignedOff)
        Assert.Equal(a.SignedOff, b.SignedOff)
        match a.Final with
        | Ok g -> Assert.True(g.ScoreA + g.ScoreB >= 1)
        | Error e -> Assert.Fail(sprintf "match errored: %A" e)
    }

[<Fact>]
let ``DST: the same match replays identically (same seed => same recording => same world)`` () =
    task {
        let! rec1, a1, _ = MeshPong.playMatch 7L 200 99
        let! rec2, a2, _ = MeshPong.playMatch 7L 200 99
        Assert.Equal<Map<int, InterruptKind list>>(rec1.Crossings, rec2.Crossings)
        Assert.Equal<Result<MeshPong.Game, InterruptFeedback>>(a1.Final, a2.Final)
    }

[<Fact>]
let ``ANTI-CHEAT: a tampered crossing causes detectable desync (the treaty violation surfaces)`` () =
    task {
        let recording = RecordedSource.record (MeshPong.inputsSource 42L) 300
        // the cheat: from tick 10 on, player A's input is doctored in ONE room's copy of the session
        // (a sustained aimbot-style cheat; a single-tick nudge can wash out under paddle clamping —
        // honest physics — so the test uses a cheat that actually pays, which is the kind worth catching)
        let tampered: RecordedSource.Recording =
            { Crossings =
                recording.Crossings
                |> Map.map (fun tick arrivals ->
                    if tick >= 10 then
                        match arrivals with
                        | [ OperatorMessageArrived payload ] ->
                            match MeshPong.parseInputs payload with
                            | Some (_, b) -> [ OperatorMessageArrived(MeshPong.encodeInputs 1 b) ]
                            | None -> arrivals
                        | _ -> arrivals
                    else
                        arrivals) }
        let honest = MeshPong.room "honest" (fun _ -> RecordedSource.replay recording) 300 99
        let cheated = MeshPong.room "cheated" (fun _ -> RecordedSource.replay tampered) 300 99
        let! ra = SimFramework.runK honest 42L
        let! rb = SimFramework.runK cheated 42L
        // the worlds diverge — desync detected by the lockstep comparison = the cheat is CAUGHT
        Assert.NotEqual<Result<MeshPong.Game, InterruptFeedback>>(ra.Final, rb.Final)
    }

[<Fact>]
let ``physics sanity: the ball stays in bounds and paddles stay clamped over a long rally`` () =
    let mutable g = MeshPong.create ()
    for t in 0..999 do
        let a, b = MeshPong.inputsAt 5L t
        g <- MeshPong.step a b g
        Assert.InRange(g.BallX, 0, MeshPong.Width - 1)
        Assert.InRange(g.BallY, 0, MeshPong.Height - 1)
        Assert.InRange(g.PaddleA, 0, MeshPong.Height - MeshPong.PaddleLen)
        Assert.InRange(g.PaddleB, 0, MeshPong.Height - MeshPong.PaddleLen)

[<Fact>]
let ``the payload codec round-trips and refuses non-pong traffic honestly`` () =
    Assert.Equal(Some(1, -1), MeshPong.parseInputs (MeshPong.encodeInputs 1 -1))
    Assert.Equal(Some(0, 0), MeshPong.parseInputs "pong:0,0")
    Assert.True((MeshPong.parseInputs "chat:hello").IsNone)
    Assert.True((MeshPong.parseInputs "pong:x,y").IsNone)
