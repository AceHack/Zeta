module Zeta.Tests.Crdt.LwwTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// LwwRegister (moved from Round7Tests / Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``LwwRegister merge picks later timestamp`` () =
    let a = LwwRegister<string>.Create("old", 100L, "r1")
    let b = LwwRegister<string>.Create("new", 200L, "r2")
    let merged = LwwRegister.Merge a b
    merged.Value |> should equal "new"


[<Fact>]
let ``LwwRegister merge breaks timestamp ties with replica id`` () =
    let a = LwwRegister<string>.Create("a-val", 100L, "r1")
    let b = LwwRegister<string>.Create("b-val", 100L, "r2")
    let merged = LwwRegister.Merge a b
    // "r2" > "r1" lexicographically, so b wins.
    merged.Value |> should equal "b-val"


// ─── LwwRegister tie-break (moved from Round8Tests) ─

[<Fact>]
let ``LwwRegister wins by replica on timestamp tie`` () =
    let a = LwwRegister<string>.Create("a", 5L, "replica-a")
    let b = LwwRegister<string>.Create("b", 5L, "replica-b")
    (LwwRegister.Merge a b).Value |> should equal "b"
