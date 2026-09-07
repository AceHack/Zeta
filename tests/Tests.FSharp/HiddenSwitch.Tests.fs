namespace Zeta.Tests

open System
open Xunit
open Zeta.Core
open Zeta.Research

module HiddenSwitchTests =
    let private unwrap value =
        match value with
        | Ok result -> result
        | Error error -> failwithf "unexpected refusal: %A" error
    let private frame cue : GameEnvironment.Frame =
        let cells = Array.zeroCreate<byte> 2048
        cells.[8 * 64 + (if cue = 0 then 16 else 48)] <- 1uy
        { W = 64; H = 32; Palette = 2; Cells = cells }
    let private tape initial : HiddenSwitchCarrier.Tape = { Initial = initial; Drift = Array.zeroCreate 16; Errors = Array.zeroCreate 17 }
    let private counters depth : HiddenSwitchReceipt.PlanningCounters =
        match depth with
        | 1 -> { Nodes = 1; ActionValues = 2; Predictions = 0; Updates = 0 }
        | 2 -> { Nodes = 5; ActionValues = 10; Predictions = 2; Updates = 4 }
        | _ -> { Nodes = 21; ActionValues = 42; Predictions = 10; Updates = 20 }

    [<Fact>]
    let ``Registered noisy model has the hand-derived nonmyopic opportunity`` () =
        let q, actual = HiddenSwitchPolicy.evaluate true 0.25 3 |> unwrap
        Assert.InRange(abs(q.[0] - 131.0 / 128.0), 0.0, 1e-12)
        Assert.InRange(abs(q.[1] - 69.0 / 64.0), 0.0, 1e-12)
        Assert.Equal(1, HiddenSwitchPolicy.select q |> unwrap)
        Assert.True((actual = counters 3))
        let other, _ = HiddenSwitchPolicy.evaluate true 0.75 3 |> unwrap
        Assert.InRange(abs(other.[0] - 133.0 / 64.0), 0.0, 1e-12)
        Assert.Equal(0, HiddenSwitchPolicy.select other |> unwrap)

    [<Fact>]
    let ``Depth two values match the independent affine hand derivation`` () =
        for belief in [0.0;0.2;0.25;0.5;0.75;1.0] do
            let q, actual = HiddenSwitchPolicy.evaluate true belief 2 |> unwrap
            Assert.InRange(abs(q.[0] - (0.125 + 1.75 * belief)), 0.0, 1e-12)
            Assert.InRange(abs(q.[1] - (0.625 - 0.75 * belief)), 0.0, 1e-12)
            Assert.True((actual = counters 2))

    [<Fact>]
    let ``Pre-transition rewards and action effects are separate from drift`` () =
        for effect in [false;true] do
            for initial in 0 .. 1 do
                for drift in 0 .. 1 do
                    let source = tape initial
                    source.Drift.[0] <- drift
                    let environment = HiddenSwitchCarrier.Adapter(source, effect, "dot", "fixed") :> GameEnvironment.IEnvironment<HiddenSwitchCarrier.State>
                    let state = environment.Reset() |> unwrap
                    let harvest = environment.Step(state, ControlScheme.Pad 0) |> unwrap |> HiddenSwitchCarrier.audit
                    let flip = environment.Step(state, ControlScheme.Pad 1) |> unwrap |> HiddenSwitchCarrier.audit
                    Assert.Equal(Some(4 * initial), harvest.Reward4)
                    Assert.Equal(Some -1, flip.Reward4)
                    Assert.Equal(initial ^^^ drift, harvest.Hidden)
                    Assert.Equal(effect, harvest.Hidden <> flip.Hidden)

    [<Fact>]
    let ``Adapter copies the tape and refuses unsupported and terminal calls`` () =
        let source = tape 0
        let environment = HiddenSwitchCarrier.Adapter(source, true, "dot", "fixed") :> GameEnvironment.IEnvironment<HiddenSwitchCarrier.State>
        Array.fill source.Drift 0 16 1
        Array.fill source.Errors 0 17 1
        let mutable state = environment.Reset() |> unwrap
        Assert.Equal(0, (HiddenSwitchCarrier.audit state).Cue)
        Assert.True(environment.Step(state, ControlScheme.Pad 2) |> Result.isError)
        for _ in 0 .. 15 do state <- environment.Step(state, ControlScheme.Pad 0) |> unwrap
        Assert.Equal(0, (HiddenSwitchCarrier.audit state).Hidden)
        Assert.True(environment.Step(state, ControlScheme.Pad 0) |> Result.isError)

    [<Fact>]
    let ``Filter conditions on the committed action while latest-cue resets its prior`` () =
        for arm, expected in ["belief-depth3",11.0/26.0; "latest-cue-depth3",0.25] do
            let initial = HiddenSwitchPolicy.create arm true "dot" |> unwrap
            let _, observed = HiddenSwitchPolicy.observe (frame 0) initial |> unwrap
            let decision, committed = HiddenSwitchPolicy.choose observed |> unwrap
            Assert.Equal(1, decision.Action)
            let _, next = HiddenSwitchPolicy.observe (frame 0) committed |> unwrap
            Assert.InRange(abs(HiddenSwitchPolicy.belief next - expected), 0.0, 1e-12)
            Assert.Equal((if arm = "belief-depth3" then 1 else 0), (HiddenSwitchPolicy.filterCounters next).Predictions)

    [<Fact>]
    let ``Observe choose chronology refuses repeated calls and terminal decisions`` () =
        let initial = HiddenSwitchPolicy.create "belief-myopic" true "dot" |> unwrap
        Assert.True(HiddenSwitchPolicy.choose initial |> Result.isError)
        let _, first = HiddenSwitchPolicy.observe (frame 0) initial |> unwrap
        Assert.True(HiddenSwitchPolicy.observe (frame 0) first |> Result.isError)
        let mutable current = first
        for _ in 0 .. 15 do
            let _, committed = HiddenSwitchPolicy.choose current |> unwrap
            Assert.True(HiddenSwitchPolicy.choose committed |> Result.isError)
            current <- HiddenSwitchPolicy.observe (frame 0) committed |> unwrap |> snd
        Assert.True(HiddenSwitchPolicy.choose current |> Result.isError)
        Assert.True(HiddenSwitchPolicy.observe (frame 0) current |> Result.isError)

    [<Fact>]
    let ``Binary private-band substitution preserves projection including equal tie refusal`` () =
        let original = frame 0
        for pattern in 0 .. 2 do
            let changed = { original with Cells = Array.copy original.Cells }
            for i in 1536 .. 2047 do changed.Cells.[i] <- if pattern = 0 then 0uy elif pattern = 1 then 1uy else byte(i % 2)
            let a, b = HiddenSwitchObservation.project original |> unwrap, HiddenSwitchObservation.project changed |> unwrap
            Assert.True(a.Cells = b.Cells)
        let tied = { original with Cells = Array.init 2048 (fun i -> if i < 768 then 1uy else 0uy) }
        let modified = { tied with Cells = Array.copy tied.Cells }
        Array.fill modified.Cells 1536 512 1uy
        for value in [tied;modified] do
            match HiddenSwitchObservation.project value with
            | Error reason -> Assert.Equal("background-tie", reason.Code)
            | Ok _ -> Assert.Fail("a tied top band was admitted")

    [<Fact>]
    let ``Caller frame and returned Q mutation cannot rewrite retained policy state`` () =
        for arm in (HiddenSwitchReceipt.config()).Arms do
            let input = frame 0
            let initial = HiddenSwitchPolicy.create arm true "dot" |> unwrap
            let _, observed = HiddenSwitchPolicy.observe input initial |> unwrap
            let snapshot = HiddenSwitchPolicy.snapshot observed
            let before, committed = HiddenSwitchPolicy.choose observed |> unwrap
            let expectedAction = before.Action
            Array.fill input.Cells 0 2048 1uy
            before.DecisionQ.[0] <- Double.NaN
            before.TreeRootQ.[0] <- Double.NaN
            let after, _ = HiddenSwitchPolicy.choose observed |> unwrap
            Assert.Equal(expectedAction, after.Action)
            Assert.True((snapshot = HiddenSwitchPolicy.snapshot observed))
            Assert.True(HiddenSwitchPolicy.observe (frame 0) committed |> Result.isOk)

    [<Fact>]
    let ``Malformed frames priors and action-value arrays refuse instead of repair`` () =
        Assert.True(HiddenSwitchObservation.project Unchecked.defaultof<GameEnvironment.Frame> |> Result.isError)
        let extra = frame 0
        extra.Cells.[0] <- 1uy
        Assert.True(HiddenSwitchObservation.decode "dot" extra |> Result.isError)
        Assert.True(HiddenSwitchObservation.decode "bar" (frame 0) |> Result.isError)
        let nonbinary = frame 0
        nonbinary.Cells.[0] <- 2uy
        Assert.True(HiddenSwitchObservation.project nonbinary |> Result.isError)
        for belief in [Double.NaN;Double.NegativeInfinity;Double.PositiveInfinity;-0.1;1.1] do
            Assert.True(HiddenSwitchPolicy.condition belief 0 |> Result.isError)
            Assert.True(HiddenSwitchPolicy.predict true belief 0 |> Result.isError)
            Assert.True(HiddenSwitchPolicy.evaluate true belief 3 |> Result.isError)
        Assert.True(HiddenSwitchPolicy.select [||] |> Result.isError)
        Assert.True(HiddenSwitchPolicy.select [|0.0;Double.NaN|] |> Result.isError)
        Assert.True(HiddenSwitchPolicy.create "unknown" true "dot" |> Result.isError)

    [<Fact>]
    let ``Selection tolerance chooses harvest but recursion retains numerical maxima`` () =
        Assert.Equal(0, HiddenSwitchPolicy.select [|0.0;1e-12|] |> unwrap)
        Assert.Equal(1, HiddenSwitchPolicy.select [|0.0;2e-12|] |> unwrap)
        let q, _ = HiddenSwitchPolicy.evaluate true 0.2 2 |> unwrap
        Assert.Equal(0, HiddenSwitchPolicy.select q |> unwrap)
        // This child prefers switch by less than the root-selection tolerance.
        // Replacing numerical max with the selected action would lower root Q by about6.56e-14.
        let prior = 17.0 / 42.0 - 1e-13
        let predicted = HiddenSwitchPolicy.predict true prior 0 |> unwrap
        let _, posterior = HiddenSwitchPolicy.condition predicted 0 |> unwrap
        let child, _ = HiddenSwitchPolicy.evaluate true posterior 2 |> unwrap
        Assert.True(child.[1] > child.[0])
        Assert.Equal(0, HiddenSwitchPolicy.select child |> unwrap)
        let parent, _ = HiddenSwitchPolicy.evaluate true prior 3 |> unwrap
        let expected = 39.0 / 64.0 + (53.0 / 32.0) * prior
        let suppressed = 11.0 / 32.0 + (37.0 / 16.0) * prior
        Assert.InRange(abs(parent.[0] - expected), 0.0, 1e-15)
        Assert.True(parent.[0] - suppressed > 5e-14)

    [<Fact>]
    let ``All frozen hand episodes retain complete chronology and actual expansion accounting`` () =
        for _, source in HiddenSwitchCarrier.handTapes() do
            for effect in [false;true] do
                for geometry, palette in ["dot","fixed";"bar","fixed";"dot","odd-complement"] do
                    for arm in (HiddenSwitchReceipt.config()).Arms do
                        let episode = HiddenSwitchExperiment.episode 0 source effect geometry palette arm
                        Assert.True(episode.Complete, if isNull episode.Failure then "" else episode.Failure.Detail)
                        Assert.Equal(16, episode.Actions.Length)
                        Assert.Equal(17, episode.Cues.Length)
                        Assert.Equal(17, episode.States.Length)
                        Assert.Equal(17, episode.FrameSha256.Length)
                        Assert.Equal(17, episode.ProjectionSha256.Length)
                        Assert.Equal(17, episode.Beliefs.Length)
                        for step in 0 .. 15 do
                            Assert.True(episode.PlanningCounters.[step] = counters (if arm = "belief-myopic" then 1 else min 3 (16-step)))
                        Assert.Equal(17, episode.FilterCounters.Updates)
                        Assert.Equal((if arm = "latest-cue-depth3" then 0 else 16), episode.FilterCounters.Predictions)
                        if not effect then Assert.Equal(String('0',16), episode.Actions)

    [<Fact>]
    let ``Real runner ignores private-band and scorer changes at the policy boundary`` () =
        for arm in (HiddenSwitchReceipt.config()).Arms do
            let source = HiddenSwitchCarrier.handTapes().[3] |> snd
            let original = HiddenSwitchExperiment.episode 0 source true "dot" "odd-complement" arm
            let hooks =
                { HiddenSwitchExperiment.normal with
                    Frame = fun step frame ->
                        let copy = Array.copy frame.Cells
                        for i in 1536 .. 2047 do copy.[i] <- byte ((i+step) % 2)
                        Ok { frame with Cells = copy }
                    Scorer = fun _ reward -> Ok(reward + 100) }
            let changed = HiddenSwitchExperiment.episodeWith hooks 0 source true "dot" "odd-complement" arm
            Assert.True(original.Complete && changed.Complete)
            Assert.Equal(original.Actions, changed.Actions)
            Assert.True(original.Beliefs = changed.Beliefs && original.DecisionQ = changed.DecisionQ && original.TreeRootQ = changed.TreeRootQ)
            Assert.True(original.ProjectionSha256 = changed.ProjectionSha256)
            Assert.True(original.FrameSha256 <> changed.FrameSha256 && original.Reward4 <> changed.Reward4)

    [<Fact>]
    let ``Changed unrevealed source suffix leaves the actual runner common-prefix decision fixed`` () =
        for arm in (HiddenSwitchReceipt.config()).Arms do
            let source = tape 0
            let changed = { source with Drift = Array.init 16 (fun i -> if i >= 8 then 1 else 0); Errors = Array.init 17 (fun i -> if i >= 9 then 1 else 0) }
            let a = HiddenSwitchExperiment.episode 0 source true "dot" "fixed" arm
            let b = HiddenSwitchExperiment.episode 0 changed true "dot" "fixed" arm
            Assert.True(a.Complete && b.Complete)
            Assert.Equal(a.Actions.[0..8], b.Actions.[0..8])
            Assert.True(a.Beliefs.[0..8] = b.Beliefs.[0..8] && a.DecisionQ.[0..8] = b.DecisionQ.[0..8])
            Assert.NotEqual(a.States.[9], b.States.[9])

    [<Fact>]
    let ``Source and episode admission refuse unsupported numeric bounds without generating tapes`` () =
        for seed, domain, count in [-1,0,1;0,-1,1;0,0,0;0,0,1025] do
            Assert.True(HiddenSwitchCarrier.corpus seed domain count |> Result.isError)
        let rejected = HiddenSwitchExperiment.episode -1 (tape 0) true "dot" "fixed" "belief-depth3"
        Assert.False rejected.Complete
        Assert.Equal("index", rejected.Failure.Code)
        Assert.Empty rejected.Actions

    [<Fact>]
    let ``Padded myopic spends the planner tree budget but acts like natural myopic`` () =
        for _, source in HiddenSwitchCarrier.handTapes() do
            let natural = HiddenSwitchExperiment.episode 0 source true "dot" "fixed" "belief-myopic"
            let padded = HiddenSwitchExperiment.episode 0 source true "dot" "fixed" "belief-myopic-padded"
            Assert.True(natural.Complete && padded.Complete)
            Assert.Equal(natural.Actions, padded.Actions)
            Assert.True(natural.Beliefs = padded.Beliefs && natural.Reward4 = padded.Reward4 && natural.DecisionQ = padded.DecisionQ)
            Assert.True(padded.PlanningCounters |> Array.sumBy _.Nodes = 300)
            Assert.True(natural.PlanningCounters |> Array.sumBy _.Nodes = 16)

    [<Fact>]
    let ``Fixed configuration returns fresh mutable-array boundaries`` () =
        let first = HiddenSwitchReceipt.config()
        first.Arms.[0] <- "changed"
        first.Panels.[0] <- { first.Panels.[0] with Seed = 0 }
        let second = HiddenSwitchReceipt.config()
        Assert.Equal("belief-depth3", second.Arms.[0])
        Assert.Equal(9101, second.Panels.[0].Seed)
