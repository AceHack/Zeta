module Zeta.Tests.Chip8ArcadeTests

// The arcade: the CHIP-8 chooses which game it plays. Self-reflection = simulating each candidate's
// future (SpeculationReport); choice = its own confidence-ranked pick via the CHOICE CELL treaty;
// the load is the ONE injected effect (ROM bytes cross the membrane); societal reflection = peers'
// reports as crossings, division of labor WITHOUT veto (a peer report is an observation, not a directive).

open global.Xunit
open Zeta.Core

// "loopy": pure deterministic line — speculation runs until the tank starves (confidence < 1 at depth-goal).
let private loopRom = [| 0x6Auy; 0x0Cuy; 0x12uy; 0x02uy |]
// "waity": branches on input immediately — the knowable future is fully seen (confidence 1.0).
let private inputRom = [| 0xEAuy; 0x9Euy; 0x12uy; 0x00uy |]

let private lib: Chip8Arcade.Library = [ "loopy", loopRom; "waity", inputRom ]

[<Fact>]
let ``the choice-cell treaty round-trips: the VM writes an index, the host reads the game`` () =
    let f = Chip8Cow.create 1UL |> Chip8Arcade.commitChoice 1
    match Chip8Arcade.readChoice lib f with
    | Some (name, _) -> Assert.Equal("waity", name)
    | None -> failwith "choice not read"

[<Fact>]
let ``an unchosen frame / out-of-library index reads as None (honest refusal)`` () =
    Assert.True(Chip8Cow.create 1UL |> Chip8Arcade.readChoice lib |> Option.isNone)
    Assert.True(Chip8Cow.create 1UL |> Chip8Arcade.commitChoice 9 |> Chip8Arcade.readChoice lib |> Option.isNone)

[<Fact>]
let ``self-reflection: each candidate's future is simulated and the report is honest about WHY it stopped`` () =
    let rs = Chip8Arcade.reflect 10 1.0 (SoftThrottle.tank 5.0 1.0) 1UL lib
    let loopy = rs |> List.find (fun r -> r.Game = "loopy")
    let waity = rs |> List.find (fun r -> r.Game = "waity")
    Assert.True(loopy.Report.Starved) // power-limited: a self-known shortfall
    Assert.True(loopy.Report.Confidence < 1.0)
    Assert.True(waity.Report.HitBranch) // fork-limited: saw all that was knowable
    Assert.Equal(1.0, waity.Report.Confidence, 12)

[<Fact>]
let ``autonomous choice: it picks the game whose knowable future it sees best`` () =
    let rs = Chip8Arcade.reflect 10 1.0 (SoftThrottle.tank 5.0 1.0) 1UL lib
    Assert.Equal(Some 1, Chip8Arcade.choose rs) // "waity": confidence 1.0 beats starved "loopy"

[<Fact>]
let ``reflections cross the membrane as text and round-trip (the societal wire)`` () =
    let rs = Chip8Arcade.reflect 10 1.0 (SoftThrottle.tank 5.0 1.0) 1UL lib
    for r in rs do
        match Chip8Arcade.parseReflection (Chip8Arcade.encodeReflection r) with
        | Some (g, a, c) ->
            Assert.Equal(r.Game, g)
            Assert.Equal(r.Report.Achieved, a)
            Assert.Equal(r.Report.Confidence, c, 3)
        | None -> failwith "reflection did not round-trip"
    Assert.True(Chip8Arcade.parseReflection "load:waity" |> Option.isNone) // non-reflection traffic refused

[<Fact>]
let ``societal reflection: division of labor — it yields a peer-covered game for an equally-knowable one`` () =
    // Make both games fully knowable (a big tank): alone it picks "loopy"... no — equal confidence 1.0?
    // loopy never branches, so with a huge tank it achieves the full goal (confidence 1.0, achieved 10);
    // waity is fork-limited (confidence 1.0, achieved 0). Alone, depth breaks the tie -> "loopy" (index 0).
    let rs = Chip8Arcade.reflect 10 1.0 (SoftThrottle.tank 100.0 1.0) 1UL lib
    Assert.Equal(Some 0, Chip8Arcade.choose rs)
    // A peer already covers "loopy" -> society-adjusted choice moves to the uncovered "waity"...
    Assert.Equal(Some 1, Chip8Arcade.chooseInSociety 0.05 (Set.ofList [ "loopy" ]) rs)

[<Fact>]
let ``society informs but never vetoes: if peers cover everything, it keeps its own best`` () =
    let rs = Chip8Arcade.reflect 10 1.0 (SoftThrottle.tank 100.0 1.0) 1UL lib
    Assert.Equal(Some 0, Chip8Arcade.chooseInSociety 0.05 (Set.ofList [ "loopy"; "waity" ]) rs)
