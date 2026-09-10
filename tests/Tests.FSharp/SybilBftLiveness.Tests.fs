module Zeta.Tests.SybilBftLivenessTests

open global.Xunit
open Zeta.Core
open Zeta.Core.SybilBftLiveness

let private bits (seed: int) (n: int) : int list =
    let mutable s = uint64 seed * 2862933555777941757UL + 3037000493UL
    [ for _ in 1 .. n ->
          s <- s * 6364136223846793005UL + 1442695040888963407UL
          int ((s >>> 33) &&& 1UL) ]

[<Fact>]
let ``leader rotates with the view number (round-robin)`` () =
    let lv = init 4 0.5 10
    Assert.Equal(0, leader lv)
    Assert.Equal(1, leader { lv with ViewNum = 1 })
    Assert.Equal(0, leader { lv with ViewNum = 4 })

[<Fact>]
let ``heartbeat from the leader resets the suspicion timer; silence past timeout triggers a view-change vote`` () =
    let lv = init 4 0.5 10
    // Leader (id 0) beats at tick 5.
    let lv = onHeartbeat lv 0 (bits 0 200) 5
    // At tick 12, only 7 ticks of silence (<=10): no suspicion.
    let lv', out1 = onTick lv 12 1 (bits 1 200)
    Assert.True(List.isEmpty out1)
    // At tick 20, 15 ticks since the last leader beat (>10): suspect → vote for view 1.
    let _, out2 = onTick lv' 20 1 (bits 1 200)
    Assert.Equal<LiveMessage<string> list>([ ViewChangeVote(1, 1, bits 1 200) ], out2)

[<Fact>]
let ``five exact record copies cannot reach the configured view-change quorum`` () =
    let lv = init 4 0.5 10
    let evil = bits 9 200
    // Attacker spams 5 forged ids all voting to move to view 1.
    let lv =
        [ 0..4 ]
        |> List.fold (fun acc i -> onViewChangeVote acc 1 i evil) lv
    Assert.Equal(0, lv.ViewNum) // 5 forged votes collapse to 1 distinct source < quorum 3 — NOT installed

[<Fact>]
let ``view-change installs on a 2f+1 distinct-source quorum`` () =
    let lv = init 4 0.5 10
    let lv = onViewChangeVote lv 1 0 (bits 0 200)
    let lv = onViewChangeVote lv 1 1 (bits 1 200)
    Assert.Equal(0, lv.ViewNum) // only 2 distinct < quorum 3
    let lv = onViewChangeVote lv 1 2 (bits 2 200)
    Assert.Equal(1, lv.ViewNum) // 3 distinct sources ≥ quorum 3 → installed
    Assert.Equal(1, leader lv) // new leader

[<Fact>]
let ``persistence increases the identity claim; jitter weakens it`` () =
    // Regular beats every 4 ticks, 8 of them.
    let regular =
        [ 0..7 ] |> List.fold (fun acc i -> onHeartbeat acc 0 (bits 0 200) (i * 4)) (init 4 0.5 10)
    // Sparse: only 2 beats.
    let sparse = onHeartbeat (onHeartbeat (init 4 0.5 10) 0 (bits 0 200) 0) 0 (bits 0 200) 4
    let sReg = claimStrength regular.Claims.[0]
    let sSparse = claimStrength sparse.Claims.[0]
    Assert.True(sReg > sSparse) // sustained > sparse
    // Regular train (low jitter) beats an erratic one with the same beat count.
    let erratic =
        [ 0; 1; 2; 30; 31; 60; 90; 91 ]
        |> List.fold (fun acc t -> onHeartbeat acc 0 (bits 0 200) t) (init 4 0.5 10)
    Assert.True(claimStrength regular.Claims.[0] > claimStrength erratic.Claims.[0])

[<Fact>]
let ``resonantPeriod finds the generator period of a regular beat train`` () =
    // Beats at 0,5,10,15,20 → fundamental period 5.
    Assert.Equal(Some 5, resonantPeriod [ 0; 5; 10; 15; 20 ])
    // Period 3.
    Assert.Equal(Some 3, resonantPeriod [ 0; 3; 6; 9; 12 ])
    // Fewer than two beats → no period.
    Assert.Equal(None, resonantPeriod [ 7 ])

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    let run () =
        let lv = init 4 0.5 10
        let lv = onHeartbeat lv 0 (bits 0 200) 5
        let lv, _ = onTick lv 20 1 (bits 1 200)
        let lv = onViewChangeVote lv 1 0 (bits 0 200)
        let lv = onViewChangeVote lv 1 1 (bits 1 200)
        let lv = onViewChangeVote lv 1 2 (bits 2 200)
        lv.ViewNum
    Assert.Equal(run (), run ())

[<Fact>]
let ``one shared state recoded with three masks reaches the configured view-change quorum`` () =
    let shared = [ 1; 0; 1; 1 ]
    let masks = [ [ 0; 0; 0; 0 ]; [ 0; 1; 0; 1 ]; [ 0; 0; 1; 1 ] ]
    let observed =
        masks
        |> List.mapi (fun i mask -> i, List.map2 (^^^) shared mask)
        |> List.fold (fun state (i, stream) -> onViewChangeVote state 1 i stream) (init 4 0.5 10 : LiveView<string>)
    Assert.Equal(1, observed.ViewNum)
