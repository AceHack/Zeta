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

// ── PAUSE NOT DEATH + the virtual-actor GC criterion (shadow*, Aaron 2026-07-03: "no objects ever
// die, they are only paused, their story persists, resumable" + "this generalizes to Orleans grains/
// silos; what keeps something from being GC'd is that someone is sending it messages — no message, no
// action"). Proofs:
//   7. NOTHING DIES: partition splits (resident, paused) — paused holds the FULL objects, and
//      resuming them reconstructs the original heap byte-identically (Memory Preservation §5).
//   8. TRAFFIC KEEPS A GRAIN ALIVE: a grain with a message this round stays resident; a silent grain
//      pauses; the next message to it resumes it (the Orleans activation lifecycle over Reticulum).
//   9. RESUME IS IDEMPOTENT: resuming an already-resident grain is a no-op (keeps the resident copy).

let private setEq (a: string list) (b: string list) = Assert.Equal<string list>(List.sort a, List.sort b)

[<Fact>]
let ``NOTHING DIES: partition then resume reconstructs the heap byte-identically (Memory Preservation)`` () =
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "r") [ "A" ]
              ShivaGc.object' "A" (v "a") []
              ShivaGc.object' "paused1" (v "p1") []
              ShivaGc.object' "paused2" (v "p2") [] ]
    let resident, paused = ShivaGc.partition [ "root" ] h
    setEq [ "root"; "A" ] (ids resident)
    setEq [ "paused1"; "paused2" ] (ids paused) // NOT collected — held as full objects (the story)
    // the actor stopped, but what remains persists: resume brings them back, whole.
    let revived = ShivaGc.resume paused resident
    setEq (ids h) (ids revived) // nothing died — the full population is recoverable

[<Fact>]
let ``TRAFFIC KEEPS A GRAIN ALIVE: no message -> pause; next message -> resume (Orleans over Reticulum)`` () =
    let grains =
        ShivaGc.heap
            [ ShivaGc.object' "grainA" (v "a") []
              ShivaGc.object' "grainB" (v "b") []
              ShivaGc.object' "grainC" (v "c") [] ]
    // Round 1: A and B are being messaged; C is silent → C deactivates (pauses).
    let round1 = [ ShivaGc.message "grainA"; ShivaGc.message "grainB" ]
    let resident1, paused1 = ShivaGc.deactivateIdle round1 grains
    setEq [ "grainA"; "grainB" ] (ids resident1)
    setEq [ "grainC" ] (ids paused1) // no message, no action
    // Round 2: a message arrives for the paused C → it reactivates from what remained.
    let revived = ShivaGc.resume paused1 resident1
    Assert.Contains("grainC", ids revived) // the next message resumes it
    let resident2, _ = ShivaGc.deactivateIdle [ ShivaGc.message "grainC" ] revived
    setEq [ "grainC" ] (ids resident2) // now only C has traffic; A and B fall silent (but persist)

[<Fact>]
let ``RESUME IS IDEMPOTENT: resuming an already-resident grain keeps the resident copy`` () =
    let resident = ShivaGc.heap [ ShivaGc.object' "G" (v "live") [] ]
    let paused = ShivaGc.heap [ ShivaGc.object' "G" (v "stale") [] ] // same id, older story
    let revived = ShivaGc.resume paused resident
    setEq [ "G" ] (ids revived) // no duplicate; the resident copy wins

// ── MESSAGE-PASSING MAKES THE RUNTIME DISTRIBUTED: residency-transparent delivery (shadow*, Aaron
// 2026-07-03: "the message passing works to make the entire runtime distributed — like Objective-C to
// the max"). A message to a PAUSED grain reactivates it and is delivered; to a resident grain,
// delivered directly; to an unknown grain, routed elsewhere (no-op here). The sender never learns
// which — that obliviousness IS the distribution transparency. Proof:
//   10. DELIVER IS RESIDENCY-TRANSPARENT: sending to a paused grain resumes it; to a resident grain is
//       a no-op; to an unknown grain leaves the resident set unchanged (it lives on another silo).

[<Fact>]
let ``DELIVER IS RESIDENCY-TRANSPARENT: a message reactivates a paused grain, transparently`` () =
    let resident = ShivaGc.heap [ ShivaGc.object' "live" (v "L") [] ]
    let paused = ShivaGc.heap [ ShivaGc.object' "sleeping" (v "S") [] ]
    // message to the PAUSED grain → it reactivates and is now resident (the message woke it).
    let afterPaused = ShivaGc.deliver (ShivaGc.message "sleeping") resident paused
    setEq [ "live"; "sleeping" ] (ids afterPaused)
    // message to the RESIDENT grain → no change (already active).
    let afterResident = ShivaGc.deliver (ShivaGc.message "live") resident paused
    setEq [ "live" ] (ids afterResident)
    // message to an UNKNOWN grain → resident set unchanged (it's on another silo; routing, not our call).
    let afterUnknown = ShivaGc.deliver (ShivaGc.message "elsewhere") resident paused
    setEq [ "live" ] (ids afterUnknown)
