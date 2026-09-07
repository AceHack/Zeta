[<global.Xunit.Collection("ZetaFsAmbientFileSystem")>]
module Zeta.Tests.ZetaFsFuseSessionLookupTests

open System
open System.Text
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3

let private utf8 (s: string) = Encoding.UTF8.GetBytes s

let private ensureHasher () =
    System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof<OwnBlake3Hasher>.TypeHandle)

let private withSession (store: string) (f: ZetaFsFuse.Session -> unit) =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let clock = Environment.createVirtual 24L :> ISimulationEnvironment
    let volume = ZetaFsFreeze.createManualStreamWith store mutbuf None clock

    try
        match ZetaFsPosixVfs.linux volume with
        | None -> failwith "volume ROOT missing"
        | Some mount -> f (ZetaFsFuse.create mount)
    finally
        ZetaFsFreeze.dispose volume
        FileSystem.Reset()

let private lookupReq (parent: uint64) (name: byte[]) (unique: uint64) : byte[] =
    let payload = Array.zeroCreate (name.Length + 1)
    if name.Length > 0 then
        Buffer.BlockCopy(name, 0, payload, 0, name.Length)

    let header: ZetaFsFuseAbi.InHeader =
        { Len = uint32 (ZetaFsFuseAbi.inHeaderSize + payload.Length)
          Opcode = ZetaFsFuseAbi.fuseLookup
          Unique = unique
          Nodeid = parent
          Uid = 0u
          Gid = 0u
          Pid = 0u }

    Array.append (ZetaFsFuseAbi.encodeInHeader header) payload

[<Fact>]
let ``byte LOOKUP of a created file encodes fuse_entry_out; missing is ENOENT`` () =
    withSession "/fuse-lookup-bytes" (fun session ->
        let root = session.Mount.Cache.Root.Id
        match ZetaFsFuseSession.handleMounted session (lookupReq root (utf8 "missing") 2UL) with
        | Error e -> Assert.Fail(sprintf "missing handle: %A" e)
        | Ok(reply, _) ->
            match ZetaFsFuseAbi.decodeOutHeader reply with
            | Error e -> Assert.Fail(sprintf "missing out: %A" e)
            | Ok header ->
                Assert.Equal(-2, header.Error)
                Assert.Equal(2UL, header.Unique)
        match ZetaFsFuse.dispatch session (ZetaFsFuse.Create(root, utf8 "a")) with
        | ZetaFsFuse.Node created ->
            match ZetaFsFuseSession.handleMounted session (lookupReq root (utf8 "a") 4UL) with
            | Error e -> Assert.Fail(sprintf "lookup: %A" e)
            | Ok(reply, _) ->
                match ZetaFsFuseAbi.decodeOutHeader reply with
                | Error e -> Assert.Fail(sprintf "out: %A" e)
                | Ok header ->
                    Assert.Equal(0, header.Error)
                    Assert.Equal(4UL, header.Unique)
                    let body =
                        Array.sub
                            reply
                            ZetaFsFuseAbi.outHeaderSize
                            ZetaFsFuseAbi.entryOutSize
                    match ZetaFsFuseAbi.decodeEntryOut body with
                    | Error e -> Assert.Fail(sprintf "entry: %A" e)
                    | Ok entry ->
                        Assert.Equal(created.Ino, entry.Attr.Ino)
                        Assert.NotEqual(created.Id, entry.Nodeid)
                        Assert.Equal(ZetaFsPosixMeta.fileMode, entry.Attr.Mode)
                        Assert.Equal(1UL, entry.Generation)
                        Assert.Equal(0UL, entry.EntryValid)
                        Assert.Equal(4096u, entry.Attr.Blksize)
        | other -> Assert.Fail(sprintf "create: %A" other))

let private getattrReq (id: uint64) (unique: uint64) : byte[] =
    let header: ZetaFsFuseAbi.InHeader =
        { Len = uint32 ZetaFsFuseAbi.inHeaderSize
          Opcode = ZetaFsFuseAbi.fuseGetattr
          Unique = unique
          Nodeid = id
          Uid = 0u
          Gid = 0u
          Pid = 0u }

    ZetaFsFuseAbi.encodeInHeader header

[<Fact>]
let ``byte GETATTR of a created file encodes fuse_attr_out; missing is ENOENT`` () =
    withSession "/fuse-getattr-bytes" (fun session ->
        match ZetaFsFuseSession.handleMounted session (getattrReq 99UL 5UL) with
        | Error e -> Assert.Fail(sprintf "missing handle: %A" e)
        | Ok(reply, _) ->
            match ZetaFsFuseAbi.decodeOutHeader reply with
            | Error e -> Assert.Fail(sprintf "missing out: %A" e)
            | Ok header ->
                Assert.Equal(-2, header.Error)
                Assert.Equal(5UL, header.Unique)
        let root = session.Mount.Cache.Root.Id
        match ZetaFsFuse.dispatch session (ZetaFsFuse.Create(root, utf8 "a")) with
        | ZetaFsFuse.Node created ->
            match ZetaFsFuseSession.handleMounted session (getattrReq created.Id 6UL) with
            | Error e -> Assert.Fail(sprintf "getattr: %A" e)
            | Ok(reply, _) ->
                match ZetaFsFuseAbi.decodeOutHeader reply with
                | Error e -> Assert.Fail(sprintf "out: %A" e)
                | Ok header ->
                    Assert.Equal(0, header.Error)
                    Assert.Equal(6UL, header.Unique)
                    let body =
                        Array.sub reply ZetaFsFuseAbi.outHeaderSize ZetaFsFuseAbi.attrOutSize
                    match ZetaFsFuseAbi.decodeAttrOut body with
                    | Error e -> Assert.Fail(sprintf "attr: %A" e)
                    | Ok attrOut ->
                        Assert.Equal(created.Ino, attrOut.Attr.Ino)
                        Assert.Equal(ZetaFsPosixMeta.fileMode, attrOut.Attr.Mode)
                        Assert.Equal(0UL, attrOut.AttrValid)
                        Assert.Equal(4096u, attrOut.Attr.Blksize)
        | other -> Assert.Fail(sprintf "create: %A" other))
