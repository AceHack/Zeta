module Zeta.Tests.ZetaFsFuseSessionTests

open System
open global.Xunit
open Zeta.Core

let private initReq (major: uint32) (minor: uint32) (unique: uint64) : byte[] =
    let header: ZetaFsFuseAbi.InHeader =
        { Len = uint32 (ZetaFsFuseAbi.inHeaderSize + ZetaFsFuseAbi.initInSize)
          Opcode = ZetaFsFuseAbi.fuseInit
          Unique = unique
          Nodeid = ZetaFsFuseAbi.rootNodeId
          Uid = 0u
          Gid = 0u
          Pid = 0u }

    let body: ZetaFsFuseAbi.InitIn =
        { Major = major
          Minor = minor
          MaxReadahead = 4096u
          Flags = 0u }

    Array.append (ZetaFsFuseAbi.encodeInHeader header) (ZetaFsFuseAbi.encodeInitIn body)

[<Fact>]
let ``INIT 7.26 replies first-product flags 0 and echoes unique`` () =
    match ZetaFsFuseSession.handle (initReq 7u 26u 9UL) with
    | Error e -> Assert.Fail(sprintf "handle: %A" e)
    | Ok reply ->
        match ZetaFsFuseAbi.decodeOutHeader reply with
        | Error e -> Assert.Fail(sprintf "out: %A" e)
        | Ok header ->
            Assert.Equal(0, header.Error)
            Assert.Equal(9UL, header.Unique)
            Assert.Equal(uint32 (ZetaFsFuseAbi.outHeaderSize + ZetaFsFuseAbi.initOutSize), header.Len)
            let bodyBytes = Array.sub reply ZetaFsFuseAbi.outHeaderSize ZetaFsFuseAbi.initOutSize
            match ZetaFsFuseAbi.decodeInitOut bodyBytes with
            | Error e -> Assert.Fail(sprintf "init out: %A" e)
            | Ok body ->
                Assert.Equal(7u, body.Major)
                Assert.Equal(26u, body.Minor)
                Assert.Equal(0u, body.Flags)
                Assert.Equal(4096u, body.MaxReadahead)
                Assert.Equal(131072u, body.MaxWrite)

[<Fact>]
let ``INIT with a newer kernel major replies only our major`` () =
    match ZetaFsFuseSession.handle (initReq 8u 0u 1UL) with
    | Error e -> Assert.Fail(sprintf "handle: %A" e)
    | Ok reply ->
        Assert.Equal(ZetaFsFuseAbi.outHeaderSize + 4, reply.Length)
        match ZetaFsFuseAbi.decodeOutHeader reply with
        | Error e -> Assert.Fail(sprintf "out: %A" e)
        | Ok header ->
            Assert.Equal(0, header.Error)
            let major =
                System.Buffers.Binary.BinaryPrimitives.ReadUInt32LittleEndian(
                    ReadOnlySpan(reply, ZetaFsFuseAbi.outHeaderSize, 4))
            Assert.Equal(7u, major)

[<Fact>]
let ``unknown opcode is ENOSYS; truncated request is Truncated`` () =
    let header: ZetaFsFuseAbi.InHeader =
        { Len = uint32 ZetaFsFuseAbi.inHeaderSize
          Opcode = 1u
          Unique = 3UL
          Nodeid = ZetaFsFuseAbi.rootNodeId
          Uid = 0u
          Gid = 0u
          Pid = 0u }

    match ZetaFsFuseSession.handle (ZetaFsFuseAbi.encodeInHeader header) with
    | Error e -> Assert.Fail(sprintf "lookup: %A" e)
    | Ok reply ->
        match ZetaFsFuseAbi.decodeOutHeader reply with
        | Error e -> Assert.Fail(sprintf "out: %A" e)
        | Ok out ->
            Assert.Equal(-38, out.Error)
            Assert.Equal(3UL, out.Unique)
    match ZetaFsFuseSession.handle [||] with
    | Error(ZetaFsFuseSession.Truncated(ZetaFsFuseAbi.Truncated(need, have))) ->
        Assert.Equal(40, need)
        Assert.Equal(0, have)
    | other -> Assert.Fail(sprintf "short: %A" other)
