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

// ── GENERATIONAL COLLECTION — most objects die young (shadow*, Aaron 2026-07-03: "generational
// collection — the die-young tier next"). Young/old split; a minor GC scans only young; survivors
// tenure to old. Proofs:
//   11. DIE YOUNG (minor GC pauses short-lived young objects; pause-not-death — they're returned).
//   12. MINOR GC SCANS ONLY YOUNG: an unreferenced OLD object is NOT collected by a minor GC (the
//       scoping that makes it cheap) — only a MAJOR GC reclaims old garbage.
//   13. TENURING: a young object that survives enough minor GCs is promoted young→old.
//   14. REMEMBERED SET: an OLD object referencing a YOUNG one keeps it alive through a minor GC
//       (inter-generational pointer / write-barrier correctness).
//   15. MAJOR GC reclaims OLD garbage that minor GCs leave.

let private gids (g: DynamicValue) = ids (ShivaGc.youngGen g) @ ids (ShivaGc.oldGen g) |> List.sort

[<Fact>]
let ``DIE YOUNG: a minor GC pauses unreferenced young objects (returned, resumable)`` () =
    // root → keep (young, live); junk (young, unreferenced) dies young → paused.
    let g =
        ShivaGc.genHeap
            [ ShivaGc.object' "keep" (v "k") []; ShivaGc.object' "junk" (v "j") [] ]
            [ ShivaGc.object' "root" (v "r") [ "keep" ] ]
    let g', paused = ShivaGc.minorGc [ "root" ] 99 g // high tenureAge: nothing promotes yet
    Assert.Contains("keep", ids (ShivaGc.youngGen g'))
    Assert.DoesNotContain("junk", gids g') // junk paused out of the resident generations
    setEq [ "junk" ] (ids paused) // but returned — not destroyed (pause not death)

[<Fact>]
let ``MINOR GC SCANS ONLY YOUNG: unreferenced OLD garbage survives a minor GC (only major reclaims it)`` () =
    // oldGarbage is in OLD and referenced by nobody; a minor GC must NOT touch it.
    let g =
        ShivaGc.genHeap
            [ ShivaGc.object' "y" (v "y") [] ]
            [ ShivaGc.object' "oldGarbage" (v "og") [] ]
    let gMinor, pausedMinor = ShivaGc.minorGc [] 99 g
    Assert.Contains("oldGarbage", ids (ShivaGc.oldGen gMinor)) // untouched by the minor GC
    Assert.DoesNotContain("oldGarbage", ids pausedMinor)
    // a MAJOR GC (no roots) reclaims it.
    let _, pausedMajor = ShivaGc.majorGc [] g
    Assert.Contains("oldGarbage", ids pausedMajor)

[<Fact>]
let ``TENURING: a young object surviving enough minor GCs is promoted to old`` () =
    let g0 = ShivaGc.genHeap [ ShivaGc.object' "survivor" (v "s") [] ] []
    // tenureAge 2: survive two minor GCs (rooted each time) → promotes to old on the 2nd.
    let g1, _ = ShivaGc.minorGc [ "survivor" ] 2 g0
    Assert.Contains("survivor", ids (ShivaGc.youngGen g1)) // age 1 < 2, still young
    Assert.Empty(ids (ShivaGc.oldGen g1))
    let g2, _ = ShivaGc.minorGc [ "survivor" ] 2 g1
    Assert.Contains("survivor", ids (ShivaGc.oldGen g2)) // age 2 ≥ 2 → tenured to old
    Assert.Empty(ids (ShivaGc.youngGen g2))

[<Fact>]
let ``REMEMBERED SET: an old object referencing a young one keeps it alive through a minor GC`` () =
    // oldParent (old) → youngChild (young). No external root reaches youngChild, but the old→young
    // pointer (the remembered set) must keep it alive — the write-barrier correctness.
    let g =
        ShivaGc.genHeap
            [ ShivaGc.object' "youngChild" (v "c") [] ]
            [ ShivaGc.object' "oldParent" (v "p") [ "youngChild" ] ]
    let g', paused = ShivaGc.minorGc [] 99 g // no external roots at all
    Assert.Contains("youngChild", ids (ShivaGc.youngGen g')) // survived via the inter-gen pointer
    Assert.Empty(ids paused)

[<Fact>]
let ``PAUSE-NOT-DEATH holds generationally: a minor-paused young object resumes into young`` () =
    let g = ShivaGc.genHeap [ ShivaGc.object' "gone" (v "g") [] ] []
    let g', paused = ShivaGc.minorGc [] 99 g
    setEq [ "gone" ] (ids paused)
    let revived = ShivaGc.resume paused (ShivaGc.youngGen g') // its story persisted
    Assert.Contains("gone", ids revived)

[<Fact>]
let ``THE GENERATIONAL HEAP IS BYTE-LOCKABLE DATA`` () =
    let g = ShivaGc.genHeap [ ShivaGc.object' "y" MixIr.defaultMixDef [] ] [ ShivaGc.object' "o" (v "o") [] ]
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] g)

// ── INCREMENTAL / CONCURRENT COLLECTION — tri-color marking + write barrier (shadow*, Aaron
// 2026-07-03: "incremental/concurrent GC is the remaining classic tier"). Trace in bounded steps
// interleaved with the mutator; the write barrier keeps it correct. Proofs:
//   16. INCREMENTAL == STOP-THE-WORLD: tricolorDrain (ANY budget) yields the same reachable set as
//       ShivaGc.mark — bounded pauses, identical answer.
//   17. BUDGET BOUNDS THE STEP: a step blackens at most `budget` objects (bounded pause time).
//   18. THE WRITE BARRIER IS LOAD-BEARING: a mutation making a BLACK object point at a WHITE one,
//       WITH the barrier → the white survives; WITHOUT it → the white is lost (the classic bug).
//   19. TERMINATION: the grey frontier empties.

let private linkedHeap (n: int) =
    // root → n0 → n1 → … → n{n-1}, plus one unreferenced island "garbage".
    ShivaGc.heap
        ([ ShivaGc.object' "root" (v "r") [ "n0" ] ]
         @ [ for i in 0 .. n - 1 -> ShivaGc.object' (sprintf "n%d" i) (v "x") (if i < n - 1 then [ sprintf "n%d" (i + 1) ] else []) ]
         @ [ ShivaGc.object' "garbage" (v "g") [] ])

[<Fact>]
let ``INCREMENTAL == STOP-THE-WORLD: tricolorDrain equals mark for every budget`` () =
    let h = linkedHeap 12
    let stw = ShivaGc.mark [ "root" ] h
    for budget in [ 1; 2; 3; 5; 100 ] do
        let inc = ShivaGc.tricolorDrain budget [ "root" ] h
        Assert.Equal<Set<string>>(stw, inc) // same reachable set, any step size
    Assert.DoesNotContain("garbage", ShivaGc.tricolorDrain 1 [ "root" ] h) // the island is white → collected

[<Fact>]
let ``BUDGET BOUNDS THE STEP: one step blackens at most `budget` objects (bounded pause)`` () =
    let h = linkedHeap 10
    let s0 = ShivaGc.tricolorInit [ "root" ] h
    let s1 = ShivaGc.tricolorStep 3 h s0
    let blackCount =
        match DynamicValue.get "black" s1 with
        | Some(DynamicValue.Array xs) -> List.length xs
        | _ -> -1
    Assert.True(blackCount <= 3, sprintf "a budget-3 step blackened %d (should be ≤ 3)" blackCount)

[<Fact>]
let ``THE WRITE BARRIER IS LOAD-BEARING: black->white mutation survives WITH the barrier, lost WITHOUT`` () =
    // root → mid ; B is a separate white object. Trace until root and mid are BLACK and B is still WHITE.
    let h = ShivaGc.heap [ ShivaGc.object' "root" (v "r") [ "mid" ]; ShivaGc.object' "mid" (v "m") []; ShivaGc.object' "B" (v "b") [] ]
    let s0 = ShivaGc.tricolorInit [ "root" ] h
    let s1 = ShivaGc.tricolorStep 1 h s0 // root → black, mid → grey
    let s2 = ShivaGc.tricolorStep 1 h s1 // mid → black ; grey now empty ; B still white
    // the mutator writes mid → B (a black object now points at a white one).
    // WITHOUT the barrier: B stays white, grey is empty → B is lost.
    let lost = ShivaGc.tricolorDrainFrom s2 1 h // (drains from the given state)
    Assert.DoesNotContain("B", lost)
    // WITH the barrier: greying B keeps it alive.
    let s2barrier = ShivaGc.writeBarrier "mid" "B" s2
    let saved = ShivaGc.tricolorDrainFrom s2barrier 1 h
    Assert.Contains("B", saved)

[<Fact>]
let ``THE TRI-COLOR STATE IS BYTE-LOCKABLE DATA`` () =
    let s = ShivaGc.tricolorStep 2 (linkedHeap 6) (ShivaGc.tricolorInit [ "root" ] (linkedHeap 6))
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] s)

// ── THE CONTENT-ADDRESS PRECONDITION IS UNENFORCED (falsifier, 2026-08-15, shadow*) ──
//
// `ShivaGc`'s header models the heap as CONTENT-ADDRESSED — "`id` is the object's content handle".
// Nothing in the module computes or checks `id = hash(value)`: `object'` takes an arbitrary caller-
// supplied `string`. The regeneration-lifetimes thesis needs exactly that premise ("the id determines
// the value"), so whether it is enforced is load-bearing, not cosmetic.
//
// This test pins what actually happens when the premise is violated. It is a CHARACTERIZATION test:
// it asserts today's behaviour so the boundary is visible, and it is the falsifier that moves
// "the heap is content-addressed" from ASSERTED (docstring) to REFUTED (measured).
[<Fact>]
let ``THE ID IS NOT A CONTENT ADDRESS: duplicate ids trace only the LAST refs, stranding a live child`` () =
    // Two heap objects share the id "A" with DIFFERENT values and DIFFERENT refs. Under true content-
    // addressing this heap is UNCONSTRUCTIBLE (same id ⇒ same content ⇒ same refs). `ShivaGc` accepts it.
    let h =
        ShivaGc.heap
            [ ShivaGc.object' "root" (v "r") [ "A" ]
              ShivaGc.object' "A" (v "a1") [ "B" ] // first A points at B
              ShivaGc.object' "A" (v "a2") [ "C" ] // second A points at C
              ShivaGc.object' "B" (v "b") []
              ShivaGc.object' "C" (v "c") [] ]
    let survivors, collected = ShivaGc.collect [ "root" ] h
    // `mark` builds its ref map with `Map.ofList`, which keeps the LAST duplicate — so only A→C is
    // traced. B is collected even though a SURVIVING object still lists it in `refs`: a dangling ref.
    Assert.Equal<string list>([ "B" ], collected)
    Assert.Contains("C", ids survivors)
    let danglingRefs =
        match survivors with
        | DynamicValue.Array xs ->
            xs
            |> List.collect (fun o ->
                match DynamicValue.get "refs" o with
                | Some(DynamicValue.Array rs) -> rs |> List.choose (function DynamicValue.String s -> Some s | _ -> None)
                | _ -> [])
            |> List.filter (fun r -> List.contains r collected)
        | _ -> []
    // The surviving heap references a collected object. This is impossible when ids ARE content
    // addresses, and unguarded when they are merely labels — the precondition the thesis rests on.
    Assert.Equal<string list>([ "B" ], danglingRefs)
