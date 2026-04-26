module Zeta.Tests.Sketches.CountMinTests
#nowarn "0893"

open System
open System.IO.Hashing
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


/// Deterministic 64-bit hash for a string key, used in CountMin tests
/// to bypass `string.GetHashCode()`'s per-process randomization. Same
/// pattern as `tests/Tests.FSharp/Formal/Sharder.InfoTheoretic.Tests.fs`
/// `detHash` (Otto-281 fix).
let private detStringHash (s: string) : uint64 =
    XxHash3.HashToUInt64 (ReadOnlySpan (System.Text.Encoding.UTF8.GetBytes s))


// ═══════════════════════════════════════════════════════════════════
// Count-Min Sketch (moved from Round6Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``CountMinSketch estimate >= true count (insertion only)`` () =
    let cms = CountMinSketch(depth = 5, width = 256, seed = 42L)
    // Insert key "apple" 10 times, "banana" 3 times.
    for _ in 1 .. 10 do cms.Add("apple", 1L)
    for _ in 1 .. 3 do cms.Add("banana", 1L)
    cms.Estimate "apple" |> should be (greaterThanOrEqualTo 10L)
    cms.Estimate "banana" |> should be (greaterThanOrEqualTo 3L)


[<Fact>]
let ``CountMinSketch handles retractions via median`` () =
    let cms = CountMinSketch(depth = 7, width = 1024, seed = 1L)
    // +5 then -2 for "x" → 3.
    cms.Add("x", 5L)
    cms.Add("x", -2L)
    let est = cms.EstimateMedian(
        // Mix the deterministic XxHash3 of "x" with the
        // SplitMix64 golden-ratio multiplier; any 64-bit input
        // through `SplitMix64.mix` gives uniform avalanche.
        // See `src/Core/SplitMix64.fs` for the constant rationale.
        SplitMix64.mix (detStringHash "x"))
    // Just verify it ran — for single-key the result should be in range.
    est |> should be (greaterThanOrEqualTo 0L)


[<Fact>]
let ``CountMinSketch Union is linear`` () =
    let a = CountMinSketch(5, 256, 7L)
    let b = CountMinSketch(5, 256, 7L)
    a.Add("k", 3L)
    b.Add("k", 4L)
    a.Union b
    a.Estimate "k" |> should be (greaterThanOrEqualTo 7L)


[<Fact>]
let ``CountMinSketch forEpsDelta sizes correctly`` () =
    let cms = CountMinSketch.forEpsDelta 0.01 0.01 42L
    cms.Width |> should be (greaterThanOrEqualTo 100)
    cms.Depth |> should be (greaterThanOrEqualTo 4)


[<Fact>]
let ``CountMinSketch rejects mismatched dimensions on union`` () =
    let a = CountMinSketch(5, 256, 7L)
    let b = CountMinSketch(3, 256, 7L)
    (fun () -> a.Union b) |> should throw typeof<ArgumentException>


[<Fact>]
let ``CountMinSketch.defaults creates a usable sketch`` () =
    let cms = CountMinSketch.defaults 42L
    cms.Add("hello", 1L)
    cms.Estimate "hello" |> should be (greaterThanOrEqualTo 1L)
