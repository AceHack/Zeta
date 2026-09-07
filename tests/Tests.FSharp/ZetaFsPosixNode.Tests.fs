module Zeta.Tests.ZetaFsPosixNodeTests

open System
open global.Xunit
open Zeta.Core

let private rng () =
    let e = Environment.createVirtual 19L :> Zeta.Core.ISimulationEnvironment
    ZetaFsNamespace.Entropy(fun () -> e.NextInt64())

let private mint (kind: ZetaFsNamespace.EntityKind) =
    let next = rng ()
    let ns = ZetaFsNamespace.create next
    let id, _ = ZetaFsNamespace.mint ns kind next
    ns.Root, id

[<Fact>]
let ``Handle is EntityId only — no ArrivalParent`` () =
    let names =
        typeof<ZetaFsPosixNode.Handle>.GetProperties()
        |> Array.map (fun p -> p.Name)

    Assert.True((names = [| "Entity" |]), sprintf "Handle properties: %A" names)

[<Fact>]
let ``root lookup of .. is root`` () =
    let root, _ = mint ZetaFsNamespace.EntityKind.File
    let cache = ZetaFsPosixNode.create root
    let again = ZetaFsPosixNode.lookupDotDot cache cache.Root
    Assert.Equal(cache.Root.Id, again.Id)
    Assert.Equal(ZetaFsInode.RootIno, again.Ino)
    Assert.Equal(0, ZetaFsNamespace.EntityId.compare root again.Entity)

[<Fact>]
let ``cd dir then cd .. returns the arrival parent`` () =
    let root, dir = mint ZetaFsNamespace.EntityKind.Directory
    let cache0 = ZetaFsPosixNode.create root
    let node, cache1 = ZetaFsPosixNode.intern cache0 cache0.Root dir
    let back = ZetaFsPosixNode.lookupDotDot cache1 node
    Assert.Equal(cache0.Root.Id, back.Id)
    Assert.Equal(0, ZetaFsNamespace.EntityId.compare root back.Entity)

[<Fact>]
let ``two parents yield two .. values and one st_ino`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let a, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.Directory next
    let b, ns2 = ZetaFsNamespace.mint ns1 ZetaFsNamespace.EntityKind.Directory next
    let file, _ = ZetaFsNamespace.mint ns2 ZetaFsNamespace.EntityKind.File next
    let cache0 = ZetaFsPosixNode.create ns0.Root
    let nodeA, cache1 = ZetaFsPosixNode.intern cache0 cache0.Root a
    let nodeB, cache2 = ZetaFsPosixNode.intern cache1 cache1.Root b
    let viaA, cache3 = ZetaFsPosixNode.intern cache2 nodeA file
    let viaB, cache4 = ZetaFsPosixNode.intern cache3 nodeB file
    Assert.Equal(viaA.Ino, viaB.Ino)
    Assert.NotEqual(viaA.Id, viaB.Id)
    let upA = ZetaFsPosixNode.lookupDotDot cache4 viaA
    let upB = ZetaFsPosixNode.lookupDotDot cache4 viaB
    Assert.Equal(nodeA.Id, upA.Id)
    Assert.Equal(nodeB.Id, upB.Id)
    Assert.Equal(0, ZetaFsNamespace.EntityId.compare a upA.Entity)
    Assert.Equal(0, ZetaFsNamespace.EntityId.compare b upB.Entity)

[<Fact>]
let ``st_ino is stable for an EntityId`` () =
    let root, file = mint ZetaFsNamespace.EntityKind.File
    let table0 = ZetaFsInode.create root
    let ino1, table1 = ZetaFsInode.ofEntity table0 file
    let ino2, _ = ZetaFsInode.ofEntity table1 file
    Assert.Equal(ino1, ino2)
    Assert.NotEqual(ZetaFsInode.RootIno, ino1)
