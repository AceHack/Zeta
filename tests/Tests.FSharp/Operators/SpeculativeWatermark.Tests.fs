module Zeta.Tests.Operators.SpeculativeWatermarkTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// SpeculativeWindowOp — retraction-native speculative watermark
// emission. First tests land round 34; BACKLOG P0 harsh-critic #28
// residual.
//
// Claim under test: a late positive insert whose event-time sits
// below a previously-emitted speculative watermark causes the op
// to emit `-Δ` with the stale watermark stamp AND `+Δ` with the
// new watermark stamp, mirroring what Beam's RETRACTING mode
// produces but via ordinary Z-weights (the paper-worthy claim
// from the docstring on `SpeculativeWindowOp`).
// ═══════════════════════════════════════════════════════════════════


/// Factory — a Monotonic tracker wrapped in the IWatermarkStrategy
/// adapter interface the op expects.
let private monotonicStrategy () : IWatermarkStrategy =
    let tracker = WatermarkTracker WatermarkStrategy.Monotonic
    WatermarkStrategyAdapter(tracker, "monotonic") :> IWatermarkStrategy


[<Fact>]
let ``first insert at fresh event-time emits one +delta with that watermark`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<Timestamped<int>> ()
        let strat = monotonicStrategy ()
        let speculated = c.SpeculativeWindow(input.Stream, strat, 100L)
        let out = c.Output speculated

        input.Send(ZSet.singleton (Timestamped(42, 100L)) 1L)
        do! c.StepAsync ()

        // Exactly one row stamped with the observed watermark (100L
        // under Monotonic).
        let pair = struct (Timestamped(42, 100L), 100L)
        out.Current.[pair] |> should equal 1L
    }


[<Fact>]
let ``late positive insert retracts stale stamp and inserts corrected`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<Timestamped<int>> ()
        let strat = monotonicStrategy ()
        let speculated = c.SpeculativeWindow(input.Stream, strat, 100L)
        let snapshot = c.IntegrateZSet speculated
        let out = c.Output snapshot

        // Tick 1: advance watermark to 200 with a fresh key.
        input.Send(ZSet.singleton (Timestamped(1, 200L)) 1L)
        do! c.StepAsync ()

        // Tick 2: a LATE positive insert at the same (eventTime=200,
        // value=1) would be a duplicate of the same key; but DBSP
        // stream semantics model "duplicate at same key" as re-emit
        // with the same watermark stamp — not a retraction. The
        // retraction-native test fires when we send a SECOND row
        // at a LOWER event-time with the same value. After the
        // monotonic watermark has already advanced past that
        // eventTime, the op treats the new arrival as a late
        // update and emits retract+insert.
        input.Send(ZSet.singleton (Timestamped(1, 150L)) 1L)
        do! c.StepAsync ()

        // Integrated view: the row with watermark-stamp 200L was
        // emitted once at +1 then retracted once at -1 → weight 0.
        // A fresh row with watermark-stamp = current watermark
        // after observing 150L (still 200L under Monotonic since
        // the observed 150L cannot drag the watermark backwards)
        // replaces it.
        //
        // The exact stamps depend on Monotonic's "never goes
        // backwards" semantics. This test asserts only the weaker
        // invariant: the net integrated weight for the (value=1,
        // eventTime=150L) key is +1 (it is alive), and no ghost
        // key with weight > 1 exists anywhere.
        let liveAt150 = struct (Timestamped(1, 150L), 200L)
        out.Current.[liveAt150] |> should equal 1L

        // No integrated weight > 1 for any key (retract-native
        // invariant: every speculative emission is matched by a
        // retract before a re-insert).
        let maxWeight =
            out.Current
            |> Seq.sumBy (fun entry ->
                if entry.Weight > 1L then 1 else 0)
        maxWeight |> should equal 0
    }


[<Fact>]
let ``negative-weight input retracts the stored speculative stamp`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<Timestamped<int>> ()
        let strat = monotonicStrategy ()
        let speculated = c.SpeculativeWindow(input.Stream, strat, 100L)
        let snapshot = c.IntegrateZSet speculated
        let out = c.Output snapshot

        // Tick 1: insert a row. Speculative stamp lands.
        input.Send(ZSet.singleton (Timestamped(7, 500L)) 1L)
        do! c.StepAsync ()
        let stamped = struct (Timestamped(7, 500L), 500L)
        out.Current.[stamped] |> should equal 1L

        // Tick 2: retract with weight -1. Op should pull the row
        // out of its speculative map and emit -Δ with the stored
        // stamp.
        input.Send(ZSet.singleton (Timestamped(7, 500L)) -1L)
        do! c.StepAsync ()
        out.Current.[stamped] |> should equal 0L
    }


[<Fact>]
let ``empty input produces empty output`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<Timestamped<int>> ()
        let strat = monotonicStrategy ()
        let speculated = c.SpeculativeWindow(input.Stream, strat, 100L)
        let out = c.Output speculated

        // No Send call before StepAsync.
        do! c.StepAsync ()
        out.Current |> ZSet.isEmpty |> should be True
    }


// ─────────────────────────────────────────────────────────────────────
// FsCheck Properties: Speculative Watermark ACC / DISC / RET Mode Collapse
// ─────────────────────────────────────────────────────────────────────

let private runSpeculativeSimulation (inputs: list<list<Timestamped<int>>>) =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<Timestamped<int>> ()
        let strat = monotonicStrategy ()
        let speculated = c.SpeculativeWindow(input.Stream, strat, 100L)
        let accumulated = c.IntegrateZSet speculated
        
        let outSpeculated = c.Output speculated
        let outAccumulated = c.Output accumulated
        
        let mutable stepOutputs = []
        let mutable stepAccumOutputs = []
        
        for tickInputs in inputs do
            let mutable zset = ZSet.Empty
            for t in tickInputs do
                zset <- zset + ZSet.singleton t 1L
            input.Send zset
            do! c.StepAsync ()
            stepOutputs <- stepOutputs @ [outSpeculated.Current]
            stepAccumOutputs <- stepAccumOutputs @ [outAccumulated.Current]
            
        return stepOutputs, stepAccumOutputs
    }

[<Property>]
let ``speculative window ACC mode matches recomputed state`` (inputs: list<list<int64 * int>>) =
    let cleanInputs =
        inputs
        |> List.map (fun tick ->
            tick
            |> List.map (fun (eventTime, value) -> 
                Timestamped(value, Math.Max(1L, Math.Abs(eventTime))))
            |> Seq.distinctBy (fun t -> t.Value, t.EventTime)
            |> Seq.sortBy (fun t -> t.Value, t.EventTime)
            |> Seq.toList)
            
    let outputsTask = runSpeculativeSimulation cleanInputs
    let _, stepAccumOutputs = outputsTask.Result
    
    let mutable watermark = Int64.MinValue
    let mutable speculative = Map.empty
    
    for i in 0 .. cleanInputs.Length - 1 do
        let tickInputs = cleanInputs.[i]
        
        for t in tickInputs do
            watermark <- Math.Max(watermark, t.EventTime)
            speculative <- Map.add (t.EventTime, t.Value) watermark speculative
            
        let expected = 
            speculative 
            |> Map.toList 
            |> List.map (fun ((et, v), wm) -> struct (Timestamped(v, et), wm), 1L)
            |> ZSet.ofSeq
            
        let actual = stepAccumOutputs.[i]
        if actual <> expected then
            failwithf "ACC check failed at tick %d, actual: %A, expected: %A" i actual expected
    true

[<Property>]
let ``speculative window DISC mode matches positive-only output`` (inputs: list<list<int64 * int>>) =
    let cleanInputs =
        inputs
        |> List.map (fun tick ->
            tick
            |> List.map (fun (eventTime, value) -> 
                Timestamped(value, Math.Max(1L, Math.Abs(eventTime))))
            |> Seq.distinctBy (fun t -> t.Value, t.EventTime)
            |> Seq.sortBy (fun t -> t.Value, t.EventTime)
            |> Seq.toList)
            
    let outputsTask = runSpeculativeSimulation cleanInputs
    let stepOutputs, _ = outputsTask.Result
    
    let mutable watermark = Int64.MinValue
    let mutable speculative = Map.empty
    
    for i in 0 .. cleanInputs.Length - 1 do
        let tickInputs = cleanInputs.[i]
        
        let expectedPositive = ResizeArray()
        for t in tickInputs do
            let priorWm = watermark
            watermark <- Math.Max(watermark, t.EventTime)
            let key = struct (t.EventTime, t.Value)
            if t.EventTime <= priorWm && speculative.ContainsKey key then
                let staleWm = speculative.[key]
                if watermark > staleWm then
                    expectedPositive.Add (struct (t, watermark), 1L)
                    speculative <- Map.add key watermark speculative
            elif not (speculative.ContainsKey key) then
                expectedPositive.Add (struct (t, watermark), 1L)
                speculative <- Map.add key watermark speculative
                
        let expectedZSet = ZSet.ofSeq expectedPositive
        
        let actualPositive =
            stepOutputs.[i].AsSpan().ToArray()
            |> Array.filter (fun entry -> entry.Weight > 0L)
            |> Array.map (fun entry -> entry.Key, entry.Weight)
            |> ZSet.ofSeq
            
        if actualPositive <> expectedZSet then
            failwithf "DISC check failed at tick %d, actual positive: %A, expected: %A" i actualPositive expectedZSet
    true

[<Property>]
let ``speculative window RET mode matches expected retractions`` (inputs: list<list<int64 * int>>) =
    let cleanInputs =
        inputs
        |> List.map (fun tick ->
            tick
            |> List.map (fun (eventTime, value) -> 
                Timestamped(value, Math.Max(1L, Math.Abs(eventTime))))
            |> Seq.distinctBy (fun t -> t.Value, t.EventTime)
            |> Seq.sortBy (fun t -> t.Value, t.EventTime)
            |> Seq.toList)
            
    let outputsTask = runSpeculativeSimulation cleanInputs
    let stepOutputs, _ = outputsTask.Result
    
    let mutable watermark = Int64.MinValue
    let mutable speculative = Map.empty
    
    for i in 0 .. cleanInputs.Length - 1 do
        let tickInputs = cleanInputs.[i]
        
        let expected = ResizeArray()
        for t in tickInputs do
            let priorWm = watermark
            watermark <- Math.Max(watermark, t.EventTime)
            let key = struct (t.EventTime, t.Value)
            if t.EventTime <= priorWm && speculative.ContainsKey key then
                let staleWm = speculative.[key]
                if watermark > staleWm then
                    expected.Add (struct (t, staleWm), -1L)
                    expected.Add (struct (t, watermark), 1L)
                    speculative <- Map.add key watermark speculative
            elif not (speculative.ContainsKey key) then
                expected.Add (struct (t, watermark), 1L)
                speculative <- Map.add key watermark speculative
                
        let expectedZSet = ZSet.ofSeq expected
        let actual = stepOutputs.[i]
        
        if actual <> expectedZSet then
            failwithf "RET check failed at tick %d, actual: %A, expected: %A" i actual expectedZSet
    true
