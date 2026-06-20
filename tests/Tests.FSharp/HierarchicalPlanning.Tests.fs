module Zeta.Tests.HierarchicalPlanningTests

open global.Xunit
open Zeta.Core

let private cyclesPerFrame = 8
let private gridSize = 4
let private blockSize = 2
let private startPos = (0, 0)
let private goalPos = (3, 3)

[<Fact>]
let ``hierarchical planner reaches the goal on CHIP-8 ROM space AND explores fewer states than flat`` () =
    let f0 = Chip8Navigation.createInitialState 1UL
    
    // 1. Run flat search
    let flatGraph = Chip8Navigation.flatSearch cyclesPerFrame 500 f0 goalPos
    let flatExplored = flatGraph.StateCount
    
    match StateSpace.planTo (Chip8Navigation.isGoal goalPos) flatGraph with
    | None -> Assert.True(false, "Flat planner should reach the goal")
    | Some flatPlan ->
        // Flat plan validity: verify it reaches the goal Pos
        let mutable fFlat = f0
        for stepKeys in flatPlan do
            fFlat <- Chip8Cow.frameStep cyclesPerFrame { fFlat with Keys = stepKeys }
        Assert.True(Chip8Navigation.isGoal goalPos fFlat)

        // 2. Run hierarchical search
        match Chip8Navigation.planHierarchical cyclesPerFrame 100 f0 goalPos blockSize gridSize with
        | Error msg -> Assert.True(false, sprintf "Hierarchical planner failed: %s" msg)
        | Ok (hierExplored, hierPlan) ->
            // Hierarchical plan validity: verify it reaches the goal Pos
            let mutable fHier = f0
            for stepKeys in hierPlan do
                fHier <- Chip8Cow.frameStep cyclesPerFrame { fHier with Keys = stepKeys }
            Assert.True(Chip8Navigation.isGoal goalPos fHier)

            // Assert that hierarchical explored fewer states than flat
            Assert.True(
                hierExplored < flatExplored,
                sprintf "Expected hierarchical to explore fewer states than flat. Hier: %d, Flat: %d" hierExplored flatExplored
            )

[<Fact>]
let ``planning level is selected emergently via least-action estimation`` () =
    // Grid size N=4, distance d=6 (4x4 space)
    // Block size 4 (flat) estimated cost: 4 * 4 = 16
    // Block size 2 (hierarchical) estimated cost: (4/2)^2 + 6 * 2 = 4 + 12 = 16
    // If we tie, we pick the first one (4 in our case if not careful, let's test a case with clear separation)
    
    // Grid size N=8, distance d=14
    // Block size 8 (flat): 8 * 8 = 64
    // Block size 4: (8/4)^2 + 14 * 4 = 4 + 56 = 60
    // Block size 2: (8/2)^2 + 14 * 2 = 16 + 28 = 44
    let chosen8 = Chip8Navigation.leastActionSelect 8 14 [ 2; 4; 8 ]
    Assert.Equal(2, chosen8)
    
    // Grid size N=4, distance d=0 (start is goal)
    // Block size 4 (flat): 4 * 4 = 16
    // Block size 2: (4/2)^2 + 0 * 2 = 4
    let chosen4 = Chip8Navigation.leastActionSelect 4 0 [ 2; 4 ]
    Assert.Equal(2, chosen4)

[<Fact>]
let ``uncertainty is propagated when exploration budget is starved`` () =
    let f0 = Chip8Navigation.createInitialState 1UL
    // With maxStatesPerSearch = 2, the fine planner cannot complete even a 2-step region BFS.
    let result = Chip8Navigation.planHierarchical cyclesPerFrame 2 f0 goalPos blockSize gridSize
    match result with
    | Error msg ->
        Assert.Contains("Starved or path blocked", msg)
    | Ok _ ->
        Assert.True(false, "Should have failed due to budget starvation / uncertainty")

[<Fact>]
let ``both planners replay deterministically (byte-identical)`` () =
    let f0 = Chip8Navigation.createInitialState 1UL
    
    // Flat search determinism
    let g1 = Chip8Navigation.flatSearch cyclesPerFrame 500 f0 goalPos
    let g2 = Chip8Navigation.flatSearch cyclesPerFrame 500 f0 goalPos
    Assert.Equal(g1.StateCount, g2.StateCount)
    
    let p1 = StateSpace.planTo (Chip8Navigation.isGoal goalPos) g1
    let p2 = StateSpace.planTo (Chip8Navigation.isGoal goalPos) g2
    Assert.Equal<bool[] list option>(p1, p2)
    
    // Hierarchical search determinism
    let h1 = Chip8Navigation.planHierarchical cyclesPerFrame 100 f0 goalPos blockSize gridSize
    let h2 = Chip8Navigation.planHierarchical cyclesPerFrame 100 f0 goalPos blockSize gridSize
    match h1, h2 with
    | Ok (c1, pl1), Ok (c2, pl2) ->
        Assert.Equal(c1, c2)
        Assert.Equal<bool[] list>(pl1, pl2)
    | _ -> Assert.True(false, "Hierarchical runs should both succeed and be identical")
