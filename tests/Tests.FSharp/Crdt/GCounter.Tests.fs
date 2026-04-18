module Zeta.Tests.Crdt.GCounterTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// G-Counter (moved from Round7Tests / Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``GCounter.Merge takes elementwise max`` () =
    let a = GCounter.Empty.Increment("r1", 5L).Increment("r2", 3L)
    let b = GCounter.Empty.Increment("r1", 7L).Increment("r3", 2L)
    let merged = GCounter.Merge a b
    merged.Value |> should equal 12L   // max(5,7) + 3 + 2


[<Fact>]
let ``GCounter rejects negative increment`` () =
    (fun () -> GCounter.Empty.Increment("r1", -1L) |> ignore)
    |> should throw typeof<ArgumentException>


// ─── GCounter (moved from Round8Tests) ─────────

[<Fact>]
let ``GCounter merge is associative`` () =
    let a = GCounter.Empty.Increment("r1", 3L)
    let b = GCounter.Empty.Increment("r2", 5L)
    let c = GCounter.Empty.Increment("r1", 1L).Increment("r2", 2L)
    let ab_c = GCounter.Merge (GCounter.Merge a b) c
    let a_bc = GCounter.Merge a (GCounter.Merge b c)
    ab_c.Value |> should equal a_bc.Value
