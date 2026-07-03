module Zeta.Tests.ShivaGcTests

// THE SHIVA GC — mark-sweep over the content-addressed heap of reified values (shadow*, Aaron
// 2026-07-03: "this is basically our Shiva Garbage Collector"). The mix-as-data slices made the mix's
// rules DATA; this collects the ones nothing references. Proofs:
//   1. LIVE SURVIVE + GARBAGE COLLECTED: a chain from a root survives; an unreferenced island is
//      retracted, and the collected set is exactly heap − survivors (the Z-set −1).
//   2. CYCLE-SAFE: a reachable cycle survives; an UNREFERENCED cycle is collected (mark-sweep, not
//      reference counting — refcount would leak the dead cycle).
//   3. IDEMPOTENT: collect ∘ collect = collect (discipline #6).
//   4. DETERMINISTIC (DST): same roots + heap → same result.
//   5. COLLECTS A STALE REIFIED mixDef: the GC works on the actual mix-as-data tables (the seed made
//      real) — an active reification survives, a stale one is reclaimed.
//
// Anchors: McCarthy 1960 (GC born with code-as-data); Dijkstra 1978; Hayes 1997 (ephemerons);
// Trimurti (Brahma generator / Shiva collector).

open global.Xunit
open Zeta.Core

let private ids (h: DynamicValue) =
    match h with
    | DynamicValue.Array xs ->
        xs
        |> List.choose (fun o ->
            match DynamicValue.get "id" o with
            | Some(DynamicValue.String s) -> Some s
            | _ -> None)
        |> List.sort
    | _ -> []

let private v (s: string) = DynamicValue.String s

[<Fact>]
let ``LIVE SURVIVE + GARBAGE COLLECTED: a reachable chain survives, an unreferenced island is retracted`` () =
    // root → A → B (live);  C (unreferenced island)
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "r") [ "A" ]
              ShivaGc.object' "A" (v "a") [ "B" ]
              ShivaGc.object' "B" (v "b") []
              ShivaGc.object' "C" (v "c") [] ]
    let survivors, collected = ShivaGc.collect [ "root" ] h
    Assert.Equal<string list>([ "A"; "B"; "root" ], ids survivors)
    Assert.Equal<string list>([ "C" ], collected) // exactly heap − survivors: the −1 retraction

[<Fact>]
let ``CYCLE-SAFE: a reachable cycle survives; an unreferenced cycle is collected`` () =
    // root → A ; A ↔ B (reachable cycle).  D ↔ E (unreferenced cycle) — refcount would leak it.
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "r") [ "A" ]
              ShivaGc.object' "A" (v "a") [ "B" ]
              ShivaGc.object' "B" (v "b") [ "A" ] // cycle back to A
              ShivaGc.object' "D" (v "d") [ "E" ]
              ShivaGc.object' "E" (v "e") [ "D" ] ] // unreferenced cycle
    let survivors, collected = ShivaGc.collect [ "root" ] h
    Assert.Equal<string list>([ "A"; "B"; "root" ], ids survivors)
    Assert.Equal<string list>([ "D"; "E" ], collected)

[<Fact>]
let ``IDEMPOTENT: collect after collect reproduces the survivors (discipline #6)`` () =
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "r") [ "A" ]
              ShivaGc.object' "A" (v "a") []
              ShivaGc.object' "junk" (v "j") [] ]
    let once = ShivaGc.sweep [ "root" ] h
    let twice = ShivaGc.sweep [ "root" ] once
    Assert.Equal<DynamicValue>(once, twice)

[<Fact>]
let ``DETERMINISTIC (DST): same roots + heap yields the same collection`` () =
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "r") [ "A"; "B" ]
              ShivaGc.object' "A" (v "a") []
              ShivaGc.object' "B" (v "b") []
              ShivaGc.object' "x" (v "x") []
              ShivaGc.object' "y" (v "y") [] ]
    Assert.Equal<DynamicValue * string list>(ShivaGc.collect [ "root" ] h, ShivaGc.collect [ "root" ] h)

[<Fact>]
let ``COLLECTS A STALE REIFIED mixDef: the GC works on the actual mix-as-data tables`` () =
    // The heap holds real MixIr reifications. `root` references the ACTIVE mixDef + evalDef; a STALE
    // mixDef (an old algorithm nothing points at) is reclaimed by Shiva.
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "compiler") [ "active-mixDef"; "active-evalDef" ]
              ShivaGc.object' "active-mixDef" MixIr.defaultMixDef []
              ShivaGc.object' "active-evalDef" MixIr.defaultEvalDef []
              ShivaGc.object' "stale-mixDef" MixIr.defaultMixDef [] ] // same content, but unreferenced
    let survivors, collected = ShivaGc.collect [ "root" ] h
    Assert.Equal<string list>([ "active-evalDef"; "active-mixDef"; "root" ], ids survivors)
    Assert.Equal<string list>([ "stale-mixDef" ], collected) // the unreferenced reification is retracted

[<Fact>]
let ``THE HEAP IS BYTE-LOCKABLE DATA: the collector's substrate rides the codec stack`` () =
    let h =
        ShivaGc.heap [ ShivaGc.object' "root" (v "r") [ "A" ]; ShivaGc.object' "A" MixIr.defaultEvalDef [] ]
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] h)
