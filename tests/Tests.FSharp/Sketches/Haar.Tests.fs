module Zeta.Tests.Sketches.HaarTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Haar wavelet window (moved from Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``HaarWindow push + ApproxSum`` () =
    let hw = HaarWindow 3   // 8 samples
    for i in 1 .. 8 do hw.Push (float i)
    // Sum of last 4 (5, 6, 7, 8) = 26.
    hw.ApproxSumAtLevel 2 |> should (equalWithin 0.01) 26.0


[<Fact>]
let ``HaarWindow rejects out-of-range levels`` () =
    (fun () -> HaarWindow 0 |> ignore) |> should throw typeof<ArgumentException>
    (fun () -> HaarWindow 32 |> ignore) |> should throw typeof<ArgumentException>
