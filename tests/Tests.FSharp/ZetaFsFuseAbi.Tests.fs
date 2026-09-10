module Zeta.Tests.ZetaFsFuseAbiTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``in-header is 40 little-endian bytes; short buffer is Truncated`` () =
    let header: ZetaFsFuseAbi.InHeader =
        { Len = 56u
          Opcode = ZetaFsFuseAbi.fuseInit
          Unique = 1UL
          Nodeid = ZetaFsFuseAbi.rootNodeId
          Uid = 0u
          Gid = 0u
          Pid = 0u }

    let bytes = ZetaFsFuseAbi.encodeInHeader header
    Assert.Equal(40, bytes.Length)
    Assert.Equal(56uy, bytes.[0])
    Assert.Equal(0uy, bytes.[1])
    Assert.Equal(26uy, bytes.[4])
    Assert.Equal(1uy, bytes.[8])
    Assert.Equal(1uy, bytes.[16])
    match ZetaFsFuseAbi.decodeInHeader bytes with
    | Error e -> Assert.Fail(sprintf "decode: %A" e)
    | Ok round ->
        Assert.Equal(header.Len, round.Len)
        Assert.Equal(header.Opcode, round.Opcode)
        Assert.Equal(header.Unique, round.Unique)
        Assert.Equal(header.Nodeid, round.Nodeid)
    match ZetaFsFuseAbi.decodeInHeader [||] with
    | Error(ZetaFsFuseAbi.Truncated(need, have)) ->
        Assert.Equal(40, need)
        Assert.Equal(0, have)
    | other -> Assert.Fail(sprintf "short: %A" other)

[<Fact>]
let ``out-header error is signed little-endian; INIT unique is echoed`` () =
    let header: ZetaFsFuseAbi.OutHeader =
        { Len = 16u
          Error = -38
          Unique = 7UL }

    let bytes = ZetaFsFuseAbi.encodeOutHeader header
    Assert.Equal(16, bytes.Length)
    match ZetaFsFuseAbi.decodeOutHeader bytes with
    | Error e -> Assert.Fail(sprintf "decode: %A" e)
    | Ok round ->
        Assert.Equal(-38, round.Error)
        Assert.Equal(7UL, round.Unique)

[<Fact>]
let ``first-product INIT out is protocol 7.26 flags 0 and FOPEN_DIRECT_IO is bit 0`` () =
    Assert.Equal(1u, ZetaFsFuseAbi.fopenDirectIo)
    let body = ZetaFsFuseAbi.firstProductInitOut
    Assert.Equal(7u, body.Major)
    Assert.Equal(26u, body.Minor)
    Assert.Equal(0u, body.Flags)
    Assert.Equal(131072u, body.MaxWrite)
    let bytes = ZetaFsFuseAbi.encodeInitOut body
    Assert.Equal(64, bytes.Length)
    match ZetaFsFuseAbi.decodeInitOut bytes with
    | Error e -> Assert.Fail(sprintf "decode: %A" e)
    | Ok round ->
        Assert.Equal(body.Major, round.Major)
        Assert.Equal(body.Minor, round.Minor)
        Assert.Equal(0u, round.Flags)
        Assert.Equal(body.MaxWrite, round.MaxWrite)
        Assert.Equal(1u, round.TimeGran)

[<Fact>]
let ``INIT in-header plus body golden hex is stable`` () =
    let header: ZetaFsFuseAbi.InHeader =
        { Len = 56u
          Opcode = ZetaFsFuseAbi.fuseInit
          Unique = 1UL
          Nodeid = ZetaFsFuseAbi.rootNodeId
          Uid = 0u
          Gid = 0u
          Pid = 0u }

    let body: ZetaFsFuseAbi.InitIn =
        { Major = 7u
          Minor = 26u
          MaxReadahead = 0u
          Flags = 0u }

    let msg = Array.append (ZetaFsFuseAbi.encodeInHeader header) (ZetaFsFuseAbi.encodeInitIn body)
    Assert.Equal(56, msg.Length)
    Assert.Equal(
        "380000001a0000000100000000000000010000000000000000000000000000000000000000000000070000001a0000000000000000000000",
        ZetaFsFuseAbi.hex msg)
