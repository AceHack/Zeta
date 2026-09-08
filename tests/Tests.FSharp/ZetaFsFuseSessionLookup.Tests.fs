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

let private readdirReq (id: uint64) (unique: uint64) : byte[] =
    let header: ZetaFsFuseAbi.InHeader =
        { Len = uint32 ZetaFsFuseAbi.inHeaderSize
          Opcode = ZetaFsFuseAbi.fuseReaddir
          Unique = unique
          Nodeid = id
          Uid = 0u
          Gid = 0u
          Pid = 0u }

    ZetaFsFuseAbi.encodeInHeader header

let private sameBytes (a: byte[]) (b: byte[]) =
    a.Length = b.Length
    && MemoryExtensions.SequenceEqual(ReadOnlySpan<byte> a, ReadOnlySpan<byte> b)

[<Fact>]
let ``byte READDIR synthesizes dot and dirents; records are 8-byte aligned`` () =
    withSession "/fuse-readdir-bytes" (fun session ->
        let root = session.Mount.Cache.Root.Id
        match ZetaFsFuse.dispatch session (ZetaFsFuse.Create(root, utf8 "a")) with
        | ZetaFsFuse.Node created ->
            match ZetaFsFuseSession.handleMounted session (readdirReq root 7UL) with
            | Error e -> Assert.Fail(sprintf "readdir: %A" e)
            | Ok(reply, _) ->
                match ZetaFsFuseAbi.decodeOutHeader reply with
                | Error e -> Assert.Fail(sprintf "out: %A" e)
                | Ok header ->
                    Assert.Equal(0, header.Error)
                    Assert.Equal(7UL, header.Unique)
                    let body = Array.sub reply ZetaFsFuseAbi.outHeaderSize (reply.Length - ZetaFsFuseAbi.outHeaderSize)
                    match ZetaFsFuseAbi.decodeDirents body with
                    | Error e -> Assert.Fail(sprintf "dirents: %A" e)
                    | Ok entries ->
                        Assert.True(entries.Length >= 3)
                        Assert.True(sameBytes ZetaFsPosixVfs.dot entries.[0].Name)
                        Assert.Equal(ZetaFsFuseAbi.dtDir, entries.[0].Typ)
                        Assert.True(sameBytes ZetaFsPosixVfs.dotDot entries.[1].Name)
                        let found =
                            entries
                            |> Array.exists (fun e ->
                                sameBytes (utf8 "a") e.Name
                                && e.Ino = created.Ino
                                && e.Typ = ZetaFsFuseAbi.dtReg)
                        Assert.True(found)
                        Assert.Equal(0, body.Length % 8)
        | other -> Assert.Fail(sprintf "create: %A" other))

let private req (opcode: uint32) (nodeid: uint64) (unique: uint64) (body: byte[]) : byte[] =
    let header: ZetaFsFuseAbi.InHeader =
        { Len = uint32 (ZetaFsFuseAbi.inHeaderSize + body.Length)
          Opcode = opcode
          Unique = unique
          Nodeid = nodeid
          Uid = 0u
          Gid = 0u
          Pid = 0u }

    Array.append (ZetaFsFuseAbi.encodeInHeader header) body

[<Fact>]
let ``byte OPEN WRITE READ RELEASE round-trips with FOPEN_DIRECT_IO`` () =
    withSession "/fuse-rw-bytes" (fun session ->
        let root = session.Mount.Cache.Root.Id
        match ZetaFsFuse.dispatch session (ZetaFsFuse.Create(root, utf8 "a")) with
        | ZetaFsFuse.Node created ->
            match ZetaFsFuseSession.handleMounted session (req ZetaFsFuseAbi.fuseOpen created.Id 8UL [||]) with
            | Error e -> Assert.Fail(sprintf "open: %A" e)
            | Ok(openReply, _) ->
                match ZetaFsFuseAbi.decodeOutHeader openReply with
                | Error e -> Assert.Fail(sprintf "open out: %A" e)
                | Ok header ->
                    Assert.Equal(0, header.Error)
                    let openBody =
                        Array.sub openReply ZetaFsFuseAbi.outHeaderSize ZetaFsFuseAbi.openOutSize
                    match ZetaFsFuseAbi.decodeOpenOut openBody with
                    | Error e -> Assert.Fail(sprintf "open_out: %A" e)
                    | Ok o ->
                        Assert.Equal(ZetaFsFuseAbi.fopenDirectIo, o.OpenFlags)
                        let payload = [| 9uy; 8uy; 7uy |]
                        let writeIn: ZetaFsFuseAbi.WriteIn =
                            { Fh = o.Fh
                              Offset = 0UL
                              Size = uint32 payload.Length }
                        match
                            ZetaFsFuseSession.handleMounted
                                session
                                (req ZetaFsFuseAbi.fuseWrite created.Id 9UL (ZetaFsFuseAbi.encodeWriteIn writeIn payload))
                        with
                        | Error e -> Assert.Fail(sprintf "write: %A" e)
                        | Ok(writeReply, _) ->
                            match ZetaFsFuseAbi.decodeOutHeader writeReply with
                            | Error e -> Assert.Fail(sprintf "write out: %A" e)
                            | Ok wh ->
                                Assert.Equal(0, wh.Error)
                                let n =
                                    ZetaFsFuseAbi.decodeWriteOut (
                                        Array.sub writeReply ZetaFsFuseAbi.outHeaderSize ZetaFsFuseAbi.writeOutSize
                                    )
                                match n with
                                | Error e -> Assert.Fail(sprintf "written: %A" e)
                                | Ok count -> Assert.Equal(3u, count)
                        let readIn: ZetaFsFuseAbi.ReadIn =
                            { Fh = o.Fh
                              Offset = 0UL
                              Size = 8u }
                        match
                            ZetaFsFuseSession.handleMounted
                                session
                                (req ZetaFsFuseAbi.fuseRead created.Id 10UL (ZetaFsFuseAbi.encodeReadIn readIn))
                        with
                        | Error e -> Assert.Fail(sprintf "read: %A" e)
                        | Ok(readReply, _) ->
                            match ZetaFsFuseAbi.decodeOutHeader readReply with
                            | Error e -> Assert.Fail(sprintf "read out: %A" e)
                            | Ok rh ->
                                Assert.Equal(0, rh.Error)
                                let data =
                                    Array.sub
                                        readReply
                                        ZetaFsFuseAbi.outHeaderSize
                                        (readReply.Length - ZetaFsFuseAbi.outHeaderSize)
                                Assert.Equal(3, data.Length)
                                Assert.Equal(9uy, data.[0])
                        let fhBytes = Array.zeroCreate 8
                        System.Buffers.Binary.BinaryPrimitives.WriteUInt64LittleEndian(Span fhBytes, o.Fh)
                        match
                            ZetaFsFuseSession.handleMounted
                                session
                                (req ZetaFsFuseAbi.fuseRelease created.Id 11UL fhBytes)
                        with
                        | Error e -> Assert.Fail(sprintf "release: %A" e)
                        | Ok(rel, _) ->
                            match ZetaFsFuseAbi.decodeOutHeader rel with
                            | Error e -> Assert.Fail(sprintf "release out: %A" e)
                            | Ok relh -> Assert.Equal(0, relh.Error)
        | other -> Assert.Fail(sprintf "create: %A" other))

let private namePayload (s: string) : byte[] =
    let n = utf8 s
    let p = Array.zeroCreate (n.Length + 1)
    if n.Length > 0 then
        Buffer.BlockCopy(n, 0, p, 0, n.Length)
    p

[<Fact>]
let ``byte MKDIR and CREATE encode entry_out; CREATE also opens with DirectIo`` () =
    withSession "/fuse-create-bytes" (fun session ->
        let root = session.Mount.Cache.Root.Id
        match
            ZetaFsFuseSession.handleMounted
                session
                (req ZetaFsFuseAbi.fuseMkdir root 12UL (namePayload "d"))
        with
        | Error e -> Assert.Fail(sprintf "mkdir: %A" e)
        | Ok(mkdirReply, _) ->
            match ZetaFsFuseAbi.decodeOutHeader mkdirReply with
            | Error e -> Assert.Fail(sprintf "mkdir out: %A" e)
            | Ok header ->
                Assert.Equal(0, header.Error)
                let entryBytes =
                    Array.sub mkdirReply ZetaFsFuseAbi.outHeaderSize ZetaFsFuseAbi.entryOutSize
                match ZetaFsFuseAbi.decodeEntryOut entryBytes with
                | Error e -> Assert.Fail(sprintf "mkdir entry: %A" e)
                | Ok entry ->
                    Assert.Equal(ZetaFsPosixMeta.directoryMode, entry.Attr.Mode)
                    Assert.Equal(ZetaFsFuseAbi.dtDir, ZetaFsFuseAbi.dtOf entry.Attr.Mode)
        match
            ZetaFsFuseSession.handleMounted
                session
                (req ZetaFsFuseAbi.fuseCreate root 13UL (namePayload "a"))
        with
        | Error e -> Assert.Fail(sprintf "create: %A" e)
        | Ok(createReply, _) ->
            match ZetaFsFuseAbi.decodeOutHeader createReply with
            | Error e -> Assert.Fail(sprintf "create out: %A" e)
            | Ok header ->
                Assert.Equal(0, header.Error)
                let entryBytes =
                    Array.sub createReply ZetaFsFuseAbi.outHeaderSize ZetaFsFuseAbi.entryOutSize
                let openBytes =
                    Array.sub
                        createReply
                        (ZetaFsFuseAbi.outHeaderSize + ZetaFsFuseAbi.entryOutSize)
                        ZetaFsFuseAbi.openOutSize
                match ZetaFsFuseAbi.decodeEntryOut entryBytes, ZetaFsFuseAbi.decodeOpenOut openBytes with
                | Error e, _ -> Assert.Fail(sprintf "create entry: %A" e)
                | _, Error e -> Assert.Fail(sprintf "create open: %A" e)
                | Ok entry, Ok opened ->
                    Assert.Equal(ZetaFsPosixMeta.fileMode, entry.Attr.Mode)
                    Assert.Equal(ZetaFsFuseAbi.fopenDirectIo, opened.OpenFlags))
