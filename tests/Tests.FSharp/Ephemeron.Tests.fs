module Zeta.Tests.EphemeronTests

// THE WEAK-VALUE TABLE on the Shiva GC — collect on strong-ref-drop (shadow*, Aaron 2026-07-03:
// "ephemeron integration — weak-value table, collect on strong-ref-drop"). The strong collector
// (ShivaGc) reclaims what the strong heap stops referencing; this weak layer holds interned
// reifications only as long as something strong points at them. Proofs:
//   1. COLLECT ON STRONG-REF-DROP (the headline): an entry keyed by a strongly-reachable id survives;
//      the moment the strong ref drops, re-pruning reclaims the entry.
//   2. WEAK EDGES DON'T KEEP ALIVE: an entry whose key is not strongly reachable is dropped even
//      though the table "holds" it — the whole point of weak.
//   3. EPHEMERON CHAIN (Hayes): A→B, B→C; rooting A keeps the whole chain (value drives next key).
//   4. EPHEMERON CYCLE COLLAPSES: key↔value cycle with no external strong root collects ENTIRELY —
//      ephemerons cannot keep each other alive (strong refs would leak it). The distinguishing property.
//   5. IDEMPOTENT (#6) + DETERMINISTIC (DST); the weak table is byte-lockable.
//   6. INTERNED mixDef DROPS WHEN UNREFERENCED: a shared MixIr reification is reclaimed on ref-drop.
//
// Anchors: Hayes 1997 (Ephemerons); Java WeakHashMap / .NET ConditionalWeakTable; McCarthy (GC).

open global.Xunit
open Zeta.Core

let private strongRef (root: string) (targets: string list) =
    ShivaGc.heap [ ShivaGc.object' root (DynamicValue.String "r") targets ]

[<Fact>]
let ``COLLECT ON STRONG-REF-DROP: entry survives while the key is rooted, reclaimed when it drops`` () =
    let tbl = Ephemeron.table [ Ephemeron.entry "K" "V" ]
    // strong ref present: root → K, so K is strongly reachable → the entry survives.
    let heapWith = strongRef "root" [ "K" ]
    let survivors1, dropped1 = Ephemeron.prune [ "root" ] heapWith tbl
    Assert.Equal<string list>([], dropped1)
    Assert.Equal<DynamicValue>(tbl, survivors1)
    // strong ref dropped: root → (nothing). K is no longer strongly reachable → the entry is collected.
    let heapWithout = strongRef "root" []
    let survivors2, dropped2 = Ephemeron.prune [ "root" ] heapWithout tbl
    Assert.Equal<string list>([ "K" ], dropped2)
    Assert.Equal<DynamicValue>(Ephemeron.table [], survivors2)

[<Fact>]
let ``WEAK EDGES DON'T KEEP ALIVE: an entry whose key is not strongly reachable is dropped`` () =
    // The table references K→V, but the strong heap does NOT reach K. Weak edges keep nothing alive.
    let tbl = Ephemeron.table [ Ephemeron.entry "K" "V" ]
    let heap = strongRef "root" [ "other" ] // root reaches "other", never K
    let _, dropped = Ephemeron.prune [ "root" ] heap tbl
    Assert.Equal<string list>([ "K" ], dropped)

[<Fact>]
let ``EPHEMERON CHAIN: rooting A keeps A->B->C alive (the value drives the next key)`` () =
    // entry1 (A,B), entry2 (B,C). Strong heap roots only A. B is reachable via entry1, which makes
    // entry2's key reachable, so both entries survive — the ephemeron fixpoint, not a plain weak table.
    let tbl = Ephemeron.table [ Ephemeron.entry "A" "B"; Ephemeron.entry "B" "C" ]
    let heap = strongRef "root" [ "A" ]
    let survivors, dropped = Ephemeron.prune [ "root" ] heap tbl
    Assert.Equal<string list>([], dropped) // nothing collected — the whole chain lives
    Assert.Equal<DynamicValue>(tbl, survivors)

[<Fact>]
let ``EPHEMERON CYCLE COLLAPSES: a key<->value cycle with no external strong root collects entirely`` () =
    // entry (X,Y) and entry (Y,X): each key is only "reachable" through the other ephemeron — no
    // external strong root. Ephemerons cannot keep each other alive → BOTH collected (strong refs leak).
    let tbl = Ephemeron.table [ Ephemeron.entry "X" "Y"; Ephemeron.entry "Y" "X" ]
    let heap = strongRef "root" [] // nothing strong reaches X or Y
    let survivors, dropped = Ephemeron.prune [ "root" ] heap tbl
    Assert.Equal<string list>([ "X"; "Y" ], dropped)
    Assert.Equal<DynamicValue>(Ephemeron.table [], survivors)

[<Fact>]
let ``IDEMPOTENT + DETERMINISTIC: prune of a prune reproduces it; same inputs same result`` () =
    let tbl = Ephemeron.table [ Ephemeron.entry "K" "V"; Ephemeron.entry "dead" "x" ]
    let heap = strongRef "root" [ "K" ]
    let once = Ephemeron.pruned [ "root" ] heap tbl
    let twice = Ephemeron.pruned [ "root" ] heap once
    Assert.Equal<DynamicValue>(once, twice) // idempotent (#6)
    Assert.Equal<DynamicValue * string list>(Ephemeron.prune [ "root" ] heap tbl, Ephemeron.prune [ "root" ] heap tbl) // DST

[<Fact>]
let ``INTERNED mixDef DROPS WHEN UNREFERENCED: a shared MixIr reification is reclaimed on ref-drop`` () =
    // The weak table interns the shared mixDef under key "mixDef". While the compiler root points at
    // it, it survives; once the compiler is gone (root reaches nothing), the interned entry drops.
    let tbl = Ephemeron.table [ Ephemeron.entry "mixDef" "mixDef-content"; Ephemeron.entry "evalDef" "evalDef-content" ]
    let live = strongRef "compiler" [ "mixDef"; "evalDef" ]
    let _, dropped0 = Ephemeron.prune [ "compiler" ] live tbl
    Assert.Equal<string list>([], dropped0) // both interned reifications alive while the compiler holds them
    let gone = strongRef "compiler" [ "evalDef" ] // compiler no longer references mixDef
    let _, dropped1 = Ephemeron.prune [ "compiler" ] gone tbl
    Assert.Equal<string list>([ "mixDef" ], dropped1) // the now-unreferenced reification is reclaimed

[<Fact>]
let ``THE WEAK TABLE IS BYTE-LOCKABLE DATA`` () =
    let tbl = Ephemeron.table [ Ephemeron.entry "K" "V"; Ephemeron.entry "A" "B" ]
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] tbl)
