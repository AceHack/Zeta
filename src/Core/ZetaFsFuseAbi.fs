namespace Zeta.Core

open System
open System.Buffers.Binary

/// Linux FUSE kernel ABI encoder (PR13). Layout is man fuse(4) protocol
/// 7.26. Little-endian. No `/dev/fuse`, no kernel, no FUSE-T binary.
module ZetaFsFuseAbi =

    let inHeaderSize = 40
    let outHeaderSize = 16
    let initInSize = 16
    let initOutSize = 64

    /// fuse(4) root nodeid.
    let rootNodeId = 1UL

    /// fuse(4) FUSE_INIT.
    let fuseInit = 26u

    /// fuse(4) highest documented kernel major at the man page pin.
    let protoMajor = 7u

    /// fuse(4) "highest supported kernel protocol version is 7.26".
    let protoMinor = 26u

    /// fuse(4) FOPEN_DIRECT_IO — first open_flags bit; bypass page cache.
    let fopenDirectIo = 1u

    type InHeader =
        { Len: uint32
          Opcode: uint32
          Unique: uint64
          Nodeid: uint64
          Uid: uint32
          Gid: uint32
          Pid: uint32 }

    type OutHeader =
        { Len: uint32
          Error: int32
          Unique: uint64 }

    type InitIn =
        { Major: uint32
          Minor: uint32
          MaxReadahead: uint32
          Flags: uint32 }

    type InitOut =
        { Major: uint32
          Minor: uint32
          MaxReadahead: uint32
          Flags: uint32
          MaxBackground: uint16
          CongestionThreshold: uint16
          MaxWrite: uint32
          TimeGran: uint32 }

    type DecodeError = Truncated of need: int * have: int

    /// First-product INIT reply: protocol 7.26, flags 0 (no writeback
    /// cache). MAP_SHARED stays ENOSYS on the dispatcher.
    let firstProductInitOut =
        { Major = protoMajor
          Minor = protoMinor
          MaxReadahead = 0u
          Flags = 0u
          MaxBackground = 0us
          CongestionThreshold = 0us
          MaxWrite = 131072u
          TimeGran = 1u }

    let encodeInHeader (h: InHeader) : byte[] =
        let buf = Array.zeroCreate inHeaderSize
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 0, 4), h.Len)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 4, 4), h.Opcode)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 8, 8), h.Unique)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 16, 8), h.Nodeid)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 24, 4), h.Uid)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 28, 4), h.Gid)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 32, 4), h.Pid)
        buf

    let decodeInHeader (buf: byte[]) : Result<InHeader, DecodeError> =
        if buf.Length < inHeaderSize then
            Error(Truncated(inHeaderSize, buf.Length))
        else
            Ok
                { Len = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 0, 4))
                  Opcode = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 4, 4))
                  Unique = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 8, 8))
                  Nodeid = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 16, 8))
                  Uid = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 24, 4))
                  Gid = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 28, 4))
                  Pid = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 32, 4)) }

    let encodeOutHeader (h: OutHeader) : byte[] =
        let buf = Array.zeroCreate outHeaderSize
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 0, 4), h.Len)
        BinaryPrimitives.WriteInt32LittleEndian(Span(buf, 4, 4), h.Error)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 8, 8), h.Unique)
        buf

    let decodeOutHeader (buf: byte[]) : Result<OutHeader, DecodeError> =
        if buf.Length < outHeaderSize then
            Error(Truncated(outHeaderSize, buf.Length))
        else
            Ok
                { Len = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 0, 4))
                  Error = BinaryPrimitives.ReadInt32LittleEndian(ReadOnlySpan(buf, 4, 4))
                  Unique = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 8, 8)) }

    let encodeInitIn (body: InitIn) : byte[] =
        let buf = Array.zeroCreate initInSize
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 0, 4), body.Major)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 4, 4), body.Minor)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 8, 4), body.MaxReadahead)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 12, 4), body.Flags)
        buf

    let decodeInitIn (buf: byte[]) : Result<InitIn, DecodeError> =
        if buf.Length < initInSize then
            Error(Truncated(initInSize, buf.Length))
        else
            Ok
                { Major = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 0, 4))
                  Minor = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 4, 4))
                  MaxReadahead = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 8, 4))
                  Flags = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 12, 4)) }

    let encodeInitOut (body: InitOut) : byte[] =
        let buf = Array.zeroCreate initOutSize
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 0, 4), body.Major)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 4, 4), body.Minor)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 8, 4), body.MaxReadahead)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 12, 4), body.Flags)
        BinaryPrimitives.WriteUInt16LittleEndian(Span(buf, 16, 2), body.MaxBackground)
        BinaryPrimitives.WriteUInt16LittleEndian(Span(buf, 18, 2), body.CongestionThreshold)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 20, 4), body.MaxWrite)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 24, 4), body.TimeGran)
        buf

    let decodeInitOut (buf: byte[]) : Result<InitOut, DecodeError> =
        if buf.Length < initOutSize then
            Error(Truncated(initOutSize, buf.Length))
        else
            Ok
                { Major = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 0, 4))
                  Minor = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 4, 4))
                  MaxReadahead = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 8, 4))
                  Flags = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 12, 4))
                  MaxBackground = BinaryPrimitives.ReadUInt16LittleEndian(ReadOnlySpan(buf, 16, 2))
                  CongestionThreshold = BinaryPrimitives.ReadUInt16LittleEndian(ReadOnlySpan(buf, 18, 2))
                  MaxWrite = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 20, 4))
                  TimeGran = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 24, 4)) }

    let hex (buf: byte[]) : string =
        Convert.ToHexString(buf).ToLowerInvariant()
