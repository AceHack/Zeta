module Zeta.Tests.Sketches.HyperMinHashTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// HyperMinHash (moved from Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``HyperMinHash estimates distinct count`` () =
    let h = HyperMinHash 12
    for i in 1 .. 1000 do h.Add i
    let est = h.Count()
    est |> should be (greaterThan 700L)
    est |> should be (lessThan 1300L)


[<Fact>]
let ``HyperMinHash Jaccard identity is 1`` () =
    let a = HyperMinHash 12
    let b = HyperMinHash 12
    for i in 1 .. 500 do
        a.Add i
        b.Add i
    HyperMinHash.Jaccard(a, b) |> should be (greaterThan 0.5)


[<Fact>]
let ``HyperMinHash rejects out-of-range logBuckets`` () =
    (fun () -> HyperMinHash 3 |> ignore) |> should throw typeof<ArgumentException>
    (fun () -> HyperMinHash 17 |> ignore) |> should throw typeof<ArgumentException>


[<Fact>]
let ``HyperMinHash Union merges sketches correctly`` () =
    let a = HyperMinHash 14
    let b = HyperMinHash 14
    for i in 1 .. 1000 do a.Add i
    for i in 800 .. 1800 do b.Add i
    let jaccardBefore = HyperMinHash.Jaccard(a, b)
    jaccardBefore |> should be (greaterThan 0.70)
    jaccardBefore |> should be (lessThan 0.90)
    a.Union b
    let est = a.Count()
    est |> should be (greaterThan 1500L)
    est |> should be (lessThan 2100L)


[<Fact>]
let ``HyperMinHash AddBytes produces deterministic estimates`` () =
    let h = HyperMinHash 12
    for i in 1 .. 500 do
        let bytes = System.Text.Encoding.UTF8.GetBytes (sprintf "key-%d" i)
        h.AddBytes (ReadOnlySpan bytes)
    let est = h.Count()
    est |> should be (greaterThan 400L)
    est |> should be (lessThan 600L)
