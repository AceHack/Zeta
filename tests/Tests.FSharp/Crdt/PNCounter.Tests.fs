module Zeta.Tests.Crdt.PNCounterTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// PN-Counter (moved from Round7Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``PNCounter allows decrement via negative delta`` () =
    let c = PNCounter.Empty.Increment("r1", 10L).Increment("r1", -3L)
    c.Value |> should equal 7L
