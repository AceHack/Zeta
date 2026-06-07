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

// ═══════════════════════════════════════════════════════════════════
// LwwMap (LWW-keyed map; 081KTH4Q782 — local-first CRDTs on the substrate)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``LwwMap: later write wins per key; reads see the live value`` () =
    let m =
        LwwMap<string, string>.Empty
            .Set("k", "old", 100L, "r1")
            .Set("k", "new", 200L, "r2")
    m.TryGet "k" |> should equal (Some "new")
    m.TryGet "absent" |> should equal (None: string option)

[<Fact>]
let ``LwwMap: Remove is a LWW tombstone; a later set resurrects`` () =
    let m = LwwMap<string, int>.Empty.Set("k", 1, 100L, "r1").Remove("k", 200L, "r1")
    m.TryGet "k" |> should equal (None: int option)
    let m2 = m.Set("k", 9, 300L, "r1")
    m2.TryGet "k" |> should equal (Some 9)

[<Fact>]
let ``LwwMap: merge is commutative and idempotent (CRDT convergence)`` () =
    let a = LwwMap<string, string>.Empty.Set("x", "a", 100L, "r1").Set("y", "y1", 50L, "r1")
    let b = LwwMap<string, string>.Empty.Set("x", "b", 200L, "r2").Set("z", "z1", 70L, "r2")
    let ab = LwwMap.Merge a b
    let ba = LwwMap.Merge b a
    // commutative: same live values both ways
    [ "x"; "y"; "z" ] |> List.iter (fun k -> ab.TryGet k |> should equal (ba.TryGet k))
    ab.TryGet "x" |> should equal (Some "b") // later ts wins
    // idempotent: merging again changes nothing observable
    let abab = LwwMap.Merge ab ab
    [ "x"; "y"; "z" ] |> List.iter (fun k -> abab.TryGet k |> should equal (ab.TryGet k))

[<Fact>]
let ``LwwMap: merge is associative (CRDT convergence)`` () =
    let a = LwwMap<string, int>.Empty.Set("k", 1, 100L, "r1")
    let b = LwwMap<string, int>.Empty.Set("k", 2, 200L, "r2")
    let c = LwwMap<string, int>.Empty.Set("k", 3, 150L, "r3")
    let left = LwwMap.Merge (LwwMap.Merge a b) c
    let right = LwwMap.Merge a (LwwMap.Merge b c)
    left.TryGet "k" |> should equal (right.TryGet "k")
    left.TryGet "k" |> should equal (Some 2) // ts 200 wins
