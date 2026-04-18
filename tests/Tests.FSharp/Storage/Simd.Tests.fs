module Zeta.Tests.Storage.SimdTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ SimdMerge correctness (moved from NestedAndRuntimeTests / CoverageTests)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``SimdMerge produces the same result as scalar merge`` () =
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
        let simdBuf = Array.zeroCreate<ZEntry<int64>> (a.Length + b.Length)
        let scalarBuf = Array.zeroCreate<ZEntry<int64>> (a.Length + b.Length)
        let simdCount = SimdMerge.Merge(aS, bS, Span simdBuf)
        let scalarCount = SimdMerge.MergeScalar(aS, bS, Span scalarBuf)
        simdCount |> should equal scalarCount
        for i in 0 .. simdCount - 1 do
            simdBuf.[i].Key |> should equal scalarBuf.[i].Key
            simdBuf.[i].Weight |> should equal scalarBuf.[i].Weight
        let _ = trial
        ()


// ─── SimdMerge scalar branch (moved from CoverageTests) ────────

[<Fact>]
let ``SimdMerge tiny inputs`` () =
    let a = [| ZEntry(1L, 1L) ; ZEntry(3L, 1L) |]
    let b = [| ZEntry(2L, 1L) |]
    let output = Array.zeroCreate<ZEntry<int64>> 5
    let n = SimdMerge.Merge(ReadOnlySpan a, ReadOnlySpan b, Span output)
    n |> should equal 3
    output.[0].Key |> should equal 1L
    output.[1].Key |> should equal 2L
    output.[2].Key |> should equal 3L


[<Fact>]
let ``SimdMerge with zero-weight cancellation`` () =
    let a = [| ZEntry(1L, 5L) |]
    let b = [| ZEntry(1L, -5L) |]
    let output = Array.zeroCreate<ZEntry<int64>> 2
    let n = SimdMerge.MergeScalar(ReadOnlySpan a, ReadOnlySpan b, Span output)
    n |> should equal 0   // cancellation
