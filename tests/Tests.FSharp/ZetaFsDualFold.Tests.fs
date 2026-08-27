module Zeta.Tests.ZetaFsDualFoldTests

open System
open System.Text
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// Dual fold over Z-sets (081M108RYNT087G0R001JSRNZE).
// Forward I = running +1 sum; generator update emits −gen(before,H)+gen(after,H)
// as a NEW delta. History is never rewritten. Merkle root is a function of the
// net Z-set. DagFs presence deltas are editLocal-shaped (default fork).
//
// DST: no clock, no temp dir, no homedir — pure functions of injected history.

module FS = Zeta.Core.DagFs

let private boundW (w: int64) : int64 = w % 1_000_000L

let private zsetOf (pairs: (int * int64) list) : ZSet<int> =
    pairs |> List.map (fun (k, w) -> k, boundW w) |> ZSet.ofSeq

type private Interp = Map<int, int>

let private reread: ZetaFsDualFold.Generator<int list, Interp, int> =
    fun (interp: Interp) (history: int list) ->
        history
        |> List.map (fun x ->
            let label =
                match Map.tryFind x interp with
                | Some y -> y
                | None -> x
            label, 1L)
        |> ZSet.ofSeq

let private encI (i: int) : byte[] =
    let b = Array.zeroCreate<byte> 4
    System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(Span<byte> b, i)
    b

let private hashContent (content: string) : MerkleHash =
    MerkleHash.ofBytes (ReadOnlySpan<byte>(Encoding.UTF8.GetBytes content))

let private tree () : FS.Tree<string> = FS.create hashContent

[<Fact>]
let ``+1 then -1 fold is empty (the ping returns)`` () =
    let d = ZSet.ofSeq [ 1, 1L; 2, 3L ]
    let view = ZetaFsDualFold.foldForward [ d; ZetaFsDualFold.retract d ]
    Assert.True(view.IsEmpty)

[<Fact>]
let ``Merkle snapshot of a retracted emission equals the empty root`` () =
    let d = ZSet.ofSeq [ 7, 1L ]
    let emptyRoot = ZetaFsDualFold.snapshot encI ZSet.empty
    let retractedRoot =
        ZetaFsDualFold.foldForward [ d; ZetaFsDualFold.retract d ]
        |> ZetaFsDualFold.snapshot encI
    Assert.Equal(emptyRoot, retractedRoot)

[<Fact>]
let ``generator update reinterprets retained history without rewriting it`` () =
    let history = [ 1; 2; 1 ]
    let before: Interp = Map.empty
    let after: Interp = Map.add 1 9 Map.empty
    let opening = reread before history
    let delta = ZetaFsDualFold.reinterpret reread history before after
    let view = ZetaFsDualFold.foldForward [ opening; delta ]
    // Oracles hand-counted off the history, NOT routed back through `reinterpret`
    // or through `reread after`. `1` occurs twice and is relabelled to `9`, so the
    // emitted delta retracts exactly those two rows and emits two under the new
    // label; `2` is untouched and must not appear in the delta at all.
    Assert.Equal<ZSet<int>>(ZSet.ofSeq [ 1, -2L; 9, 2L ], delta)
    Assert.Equal<ZSet<int>>(ZSet.ofSeq [ 2, 1L; 9, 2L ], view)

[<Fact>]
let ``generator update reads the retained record twice, once per interpretation`` () =
    // The record is a MUTABLE buffer on purpose. Against an immutable `int list`,
    // "the past is not rewritten" is handed to us by the type and no implementation
    // could violate it, so asserting it there is a check that cannot fail. Here a
    // recording generator pins the read DISCIPLINE instead: how many reads, in which
    // order, and against which record — all three are things a wrong `reinterpret`
    // can get wrong.
    let record = ResizeArray<int>([ 1; 2; 1 ])
    let reads = ResizeArray<Interp * int list>()

    let recording: ZetaFsDualFold.Generator<ResizeArray<int>, Interp, int> =
        fun (interp: Interp) (h: ResizeArray<int>) ->
            reads.Add(interp, List.ofSeq h)
            h
            |> Seq.map (fun x ->
                let label =
                    match Map.tryFind x interp with
                    | Some y -> y
                    | None -> x

                label, 1L)
            |> ZSet.ofSeq

    let before: Interp = Map.empty
    let after: Interp = Map.add 1 9 Map.empty
    let delta = ZetaFsDualFold.reinterpret recording record before after
    Assert.Equal(2, reads.Count)
    Assert.Equal<Interp>(before, fst reads.[0])
    Assert.Equal<Interp>(after, fst reads.[1])
    // both readings saw the SAME retained record — the second is not a successor state
    Assert.Equal<int list>(snd reads.[0], snd reads.[1])
    Assert.Equal<int list>([ 1; 2; 1 ], List.ofSeq record)
    Assert.Equal<ZSet<int>>(ZSet.ofSeq [ 1, -2L; 9, 2L ], delta)

[<Fact>]
let ``idempotent generator update emits the empty delta`` () =
    let history = [ 4; 5 ]
    let interp = Map.add 4 40 Map.empty
    let d = ZetaFsDualFold.reinterpret reread history interp interp
    Assert.True(d.IsEmpty)

[<Fact>]
let ``foldLog is I over Seq-ordered deltas, not arrival order of the seq value`` () =
    let early = DeltaLogEntry<int>(1L, ZSet.ofSeq [ 1, 1L ], Map.empty)
    let late = DeltaLogEntry<int>(2L, ZSet.ofSeq [ 1, -1L; 2, 1L ], Map.empty)
    let view = ZetaFsDualFold.foldLog [ late; early ]
    Assert.Equal<ZSet<int>>(ZSet.ofSeq [ 2, 1L ], view)

[<Fact>]
let ``DagFs presence delta is editLocal-shaped: rename keeps the shared Merkle node`` () =
    let hello = "hello"
    let t0 =
        tree ()
        |> FS.link "/a" hello
        |> FS.link "/b" hello
    Assert.Equal(1, FS.nodeCount t0)
    let delta = ZSet.ofSeq [ "/a", -1L; "/a2", 1L ]
    let contentOf path =
        if path = "/a2" then Some hello else None
    let t1 = ZetaFsDualFold.applyPresence contentOf delta t0
    Assert.Equal<string option>(None, FS.resolve "/a" t1)
    Assert.Equal<string option>(Some hello, FS.resolve "/a2" t1)
    Assert.Equal<string option>(Some hello, FS.resolve "/b" t1)
    Assert.Equal(1, FS.nodeCount t1)
    let h = (FS.addressAt "/a2" t1).Value
    Assert.Equal<string list>([ "/a2"; "/b" ] |> List.sort, FS.pathsOf h t1 |> List.sort)
    let t2 = FS.editLocal "/a2" "forked" t1
    Assert.Equal<string option>(Some "forked", FS.resolve "/a2" t2)
    Assert.Equal<string option>(Some hello, FS.resolve "/b" t2)

[<Property>]
let ``foldForward of a delta and its retraction is empty`` (pairs: (int * int64) list) =
    let d = zsetOf pairs
    (ZetaFsDualFold.foldForward [ d; ZetaFsDualFold.retract d ]).IsEmpty

/// The delta a reinterpretation emits is pinned against an oracle COUNTED OFF THE
/// HISTORY — not against `reinterpret`'s own definition, and not against a second
/// call to the generator. Relabelling `raw -> label` moves exactly the `n` rows that
/// carried `raw`; every other row cancels and must be absent.
///
/// Two input choices are load-bearing and were wrong in the first draft of this
/// property: `raw` is DRAWN FROM the history (an independently generated one misses
/// on most inputs, leaving the delta empty and the property trivially true), and
/// `label` is drawn from a range disjoint from the history (a colliding label makes
/// the expected delta a different shape).
[<Property>]
let ``reinterpret emits exactly the rows the relabelling moves``
    (seed: int)
    (rest: int list)
    (pick: int)
    =
    let wrap (m: int) (x: int) = ((x % m) + m) % m
    // non-empty by construction: no trivially-passing empty-history branch
    let history = (seed :: rest) |> List.truncate 8 |> List.map (wrap 97)
    let raw = history.[wrap history.Length pick]
    let label = 100 + wrap 50 pick // 100..149, disjoint from 0..96
    let before: Interp = Map.empty
    let after = Map.add raw label Map.empty
    let n = history |> List.sumBy (fun x -> if x.Equals raw then 1L else 0L)
    let delta = ZetaFsDualFold.reinterpret reread history before after
    let movedRows = ZSet.ofSeq [ raw, -n; label, n ]
    let opening = reread before history

    delta = movedRows
    && n > 0L
    && ZetaFsDualFold.foldForward [ opening; delta ] = reread after history
