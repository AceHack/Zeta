module Zeta.Tests.Sketches.HyperLogLogTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// HyperLogLog (moved from AdvancedTests / CoverageTests /
// CoverageBoostTests / CoverageTests2)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``HyperLogLog estimates cardinality within error bounds`` () =
    let hll = HyperLogLog 14   // ~0.8% error target
    for i in 1 .. 10_000 do hll.Add i
    let est = hll.Estimate()
    let relError = abs (float est - 10_000.0) / 10_000.0
    relError |> should be (lessThan 0.03)   // allow 3% margin


[<Fact>]
let ``HyperLogLog union approximates union of two sets`` () =
    let a = HyperLogLog 14   // lower error bound for reliable test
    let b = HyperLogLog 14
    for i in 1 .. 5_000 do a.Add i
    for i in 3_000 .. 8_000 do b.Add i
    a.Union b
    let est = a.Estimate()
    // True cardinality of union = 8000; allow 10% error at 1% theoretical.
    let relError = abs (float est - 8_000.0) / 8_000.0
    relError |> should be (lessThan 0.10)


[<Fact>]
let ``ApproxDistinct returns a cardinality estimate`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int> ()
        let estStream = c.ApproxDistinct(input.Stream, 14)
        let out = c.Output estStream
        input.Send(ZSet.ofKeys [ for i in 1 .. 1000 -> i ])
        do! c.StepAsync ()
        let err = abs (float out.Current - 1000.0) / 1000.0
        err |> should be (lessThan 0.05)
    }


// ─── HyperLogLog helpers (moved from CoverageTests) ───────────

[<Fact>]
let ``HyperLogLog LogBuckets and BucketCount`` () =
    let h = HyperLogLog 10
    h.LogBuckets |> should equal 10
    h.BucketCount |> should equal 1024


[<Fact>]
let ``HyperLogLog AddHash accepts arbitrary 64-bit hashes`` () =
    let h = HyperLogLog 10
    h.AddHash 12345UL
    h.AddHash 67890UL
    h.Estimate() |> should be (greaterThan 0L)


[<Fact>]
let ``HyperLogLog rejects out-of-range logBuckets`` () =
    let tooSmall = fun () -> HyperLogLog 2 |> ignore
    tooSmall |> should throw typeof<ArgumentException>
    let tooLarge = fun () -> HyperLogLog 20 |> ignore
    tooLarge |> should throw typeof<ArgumentException>


[<Fact>]
let ``HyperLogLog union rejects mismatched bucket counts`` () =
    let a = HyperLogLog 10
    let b = HyperLogLog 12
    (fun () -> a.Union b) |> should throw typeof<ArgumentException>


// ─── HLL under XxHash3 (moved from CoverageBoostTests) ───────

[<Fact>]
let ``HyperLogLog estimates are close for distinct keys`` () =
    let hll = HyperLogLog(12)
    for i in 1 .. 1000 do hll.Add i
    let est = hll.Estimate()
    est |> should be (greaterThan 900L)
    est |> should be (lessThan 1100L)


[<Fact>]
let ``HyperLogLog union merges sketches`` () =
    let a = HyperLogLog(14)   // 16 KB sketch → tighter error bound
    let b = HyperLogLog(14)
    for i in 1 .. 500 do a.Add i
    for i in 250 .. 750 do b.Add i
    a.Union b
    let est = a.Estimate()
    est |> should be (greaterThan 600L)
    est |> should be (lessThan 900L)


[<Fact>]
let ``HyperLogLog rejects mismatched bucket counts on union`` () =
    let a = HyperLogLog(12)
    let b = HyperLogLog(10)
    (fun () -> a.Union b) |> should throw typeof<ArgumentException>


[<Fact>]
let ``HyperLogLog rejects logBuckets out of range`` () =
    (fun () -> HyperLogLog(3) |> ignore) |> should throw typeof<ArgumentException>
    (fun () -> HyperLogLog(17) |> ignore) |> should throw typeof<ArgumentException>


// ─── ApproxDistinct on small input (moved from CoverageTests2) ─

[<Fact>]
let ``ApproxDistinct small input near-exact`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let ad = c.ApproxDistinct(input.Stream, 14)
        let out = c.Output ad
        input.Send(ZSet.ofKeys [ for i in 1 .. 50 -> i ])
        do! c.StepAsync()
        abs (out.Current - 50L) |> should be (lessThanOrEqualTo 5L)
    }
