module Zeta.Tests.Storage.SimdTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ ScalarMerge correctness (was SimdMerge — the name asserted vector
// ═ instructions the file never contained; see ScalarMerge.fs header)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``ScalarMerge blockwise produces the same result as two-pointer merge`` () =
    let rng = Random 42
    for trial in 1 .. 20 do
        let n = rng.Next(100, 500)
        let m = rng.Next(100, 500)
        let aKeys = Array.init n (fun _ -> int64 (rng.Next 10000)) |> Array.sort |> Array.distinct
        let bKeys = Array.init m (fun _ -> int64 (rng.Next 10000)) |> Array.sort |> Array.distinct
        let a = aKeys |> Array.map (fun k -> ZEntry(k, 1L))
        let b = bKeys |> Array.map (fun k -> ZEntry(k, 1L))
        let aS = ReadOnlySpan a
        let bS = ReadOnlySpan b
        let blockBuf = Array.zeroCreate<ZEntry<int64>> (a.Length + b.Length)
        let twoPtrBuf = Array.zeroCreate<ZEntry<int64>> (a.Length + b.Length)
        let blockCount = ScalarMerge.MergeBlockwise(aS, bS, Span blockBuf)
        let twoPtrCount = ScalarMerge.MergeTwoPointer(aS, bS, Span twoPtrBuf)
        blockCount |> should equal twoPtrCount
        for i in 0 .. blockCount - 1 do
            blockBuf.[i].Key |> should equal twoPtrBuf.[i].Key
            blockBuf.[i].Weight |> should equal twoPtrBuf.[i].Weight
        let _ = trial
        ()


// ─── ScalarMerge short-input fallback (moved from CoverageTests) ───

[<Fact>]
let ``ScalarMerge blockwise handles tiny inputs`` () =
    let a = [| ZEntry(1L, 1L) ; ZEntry(3L, 1L) |]
    let b = [| ZEntry(2L, 1L) |]
    let output = Array.zeroCreate<ZEntry<int64>> 5
    let n = ScalarMerge.MergeBlockwise(ReadOnlySpan a, ReadOnlySpan b, Span output)
    n |> should equal 3
    output.[0].Key |> should equal 1L
    output.[1].Key |> should equal 2L
    output.[2].Key |> should equal 3L


[<Fact>]
let ``ScalarMerge cancels equal-and-opposite weights`` () =
    let a = [| ZEntry(1L, 5L) |]
    let b = [| ZEntry(1L, -5L) |]
    let output = Array.zeroCreate<ZEntry<int64>> 2
    let n = ScalarMerge.MergeTwoPointer(ReadOnlySpan a, ReadOnlySpan b, Span output)
    n |> should equal 0   // cancellation
