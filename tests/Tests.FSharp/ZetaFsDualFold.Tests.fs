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
    Assert.Equal<ZSet<int>>(reread after history, view)
    // history itself is a value — the generator never held a mutable log
    Assert.Equal<int list>([ 1; 2; 1 ], history)

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

[<Property>]
let ``reinterpret then fold equals the generator under the new interpretation``
    (history: int list)
    (raw: int)
    (label: int)
    =
    let history = history |> List.truncate 8
    let before: Interp = Map.empty
    let after = Map.add raw label Map.empty
    let opening = reread before history
    let delta = ZetaFsDualFold.reinterpret reread history before after
    ZetaFsDualFold.foldForward [ opening; delta ] = reread after history
