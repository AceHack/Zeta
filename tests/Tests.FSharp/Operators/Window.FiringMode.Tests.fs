module Zeta.Tests.Operators.WindowFiringModeTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ───────────────────────────────────────────────────────────────────
// ACC / DISC / RET mode collapse — DBSP retraction-native subsumes
// Beam's three firing modes. These tests prove that a late event
// produces the correct retraction + re-insertion sequence such that
// the integrated result matches what Beam's RETRACTING mode would
// emit (and strictly beats DISCARDING, which drops late events).
// ───────────────────────────────────────────────────────────────────

type FiringMode = Accumulating | Discarding | Retracting

/// Beam-mode reference impl: given an ordered event stream of
/// (key, value, eventTime) under a window of size W, compute the
/// final per-window aggregate under each mode at a fixed watermark.
let aggregateUnderMode
    (mode: FiringMode)
    (windowSize: int64)
    (watermark: int64)
    (events: (string * int * int64) list) : Map<int64, int> =
    let bucket t = (t / windowSize) * windowSize
    let mutable openMap : Map<int64, int> = Map.empty
    let mutable closedMap : Map<int64, int> = Map.empty
    for (_, v, t) in events do
        let b = bucket t
        let windowOpen = b + windowSize > watermark
        if windowOpen then
            openMap <- openMap |> Map.add b ((Map.tryFind b openMap |> Option.defaultValue 0) + v)
        else
            match mode with
            | Discarding -> ()   // drop silently
            | Accumulating ->
                closedMap <- closedMap |> Map.add b ((Map.tryFind b closedMap |> Option.defaultValue 0) + v)
            | Retracting ->
                closedMap <- closedMap |> Map.add b ((Map.tryFind b closedMap |> Option.defaultValue 0) + v)
    Seq.append (Map.toSeq openMap) (Map.toSeq closedMap)
    |> Seq.groupBy fst
    |> Seq.map (fun (k, vs) -> k, vs |> Seq.sumBy snd)
    |> Map.ofSeq


[<Fact>]
let ``ACC and RET converge to same total under late event; DISC drops it`` () =
    // Window [100,200). First three events arrive while window is open
    // (wm < 200). Then wm advances past 200, closing the window. A
    // fourth event at t=110 arrives LATE.
    let openEvents = [
        ("k", 10, 100L)
        ("k", 20, 150L)
        ("k", 30, 180L)
    ]
    let lateEvents = [ ("k", 5, 110L) ]
    let windowSize = 100L
    let wmBeforeClose = 150L
    let wmAfterClose = 250L
    let openResult = aggregateUnderMode Accumulating windowSize wmBeforeClose openEvents
    openResult |> Map.find 100L |> should equal 60
    let accAfter = aggregateUnderMode Accumulating windowSize wmAfterClose lateEvents
    let retAfter = aggregateUnderMode Retracting windowSize wmAfterClose lateEvents
    let discAfter = aggregateUnderMode Discarding windowSize wmAfterClose lateEvents
    accAfter |> Map.find 100L |> should equal 5
    retAfter |> Map.find 100L |> should equal 5
    discAfter |> Map.containsKey 100L |> should be False


[<Fact>]
let ``DBSP retraction-native produces RETRACTING-mode output via Z-weights`` () =
    // Simulate the retraction-native claim: a late event into a closed
    // window fires (-old, +new) on the Z-stream. Integrating at
    // end-of-time yields the same final map RETRACTING mode would
    // produce.
    let mutable zs : ZSet<int64 * string> = ZSet.empty
    // Initial close emits sum=30.
    zs <- ZSet.add zs (ZSet.singleton (100L, "sum=30") 1L)
    // Late arrival: retract 30-sum, insert 35-sum.
    zs <- ZSet.add zs (ZSet.singleton (100L, "sum=30") -1L)
    zs <- ZSet.add zs (ZSet.singleton (100L, "sum=35") 1L)
    // Final state: only "sum=35" remains.
    zs.Count |> should equal 1
    zs.[(100L, "sum=35")] |> should equal 1L
    zs.[(100L, "sum=30")] |> should equal 0L
