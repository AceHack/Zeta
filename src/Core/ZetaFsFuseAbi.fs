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

    /// fuse(4) FUSE_LOOKUP.
    let fuseLookup = 1u

    /// fuse(4) FUSE_OPEN / READ / WRITE / RELEASE.
    let fuseOpen = 14u
    let fuseRead = 15u
    let fuseWrite = 16u
    let fuseRelease = 18u

    /// fuse(4) FUSE_MKDIR / CREATE.
    let fuseMkdir = 9u
    let fuseCreate = 35u

    /// fuse(4) FUSE_GETATTR.
    let fuseGetattr = 3u

    /// fuse(4) FUSE_READDIR.
    let fuseReaddir = 28u

    /// fuse(4) FUSE_INIT.
    let fuseInit = 26u

    /// dirent.h DT_DIR / DT_REG / DT_LNK.
    let dtDir = 4u
    let dtReg = 8u
    let dtLnk = 10u

    let direntHeaderSize = 24

    let attrSize = 88
    let entryOutSize = 128
    let attrOutSize = 104

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

    type Attr =
        { Ino: uint64
          Size: uint64
          Blocks: uint64
          Atime: uint64
          Mtime: uint64
          Ctime: uint64
          Atimensec: uint32
          Mtimensec: uint32
          Ctimensec: uint32
          Mode: uint32
          Nlink: uint32
          Uid: uint32
          Gid: uint32
          Rdev: uint32
          Blksize: uint32 }

    type EntryOut =
        { Nodeid: uint64
          Generation: uint64
          EntryValid: uint64
          AttrValid: uint64
          EntryValidNsec: uint32
          AttrValidNsec: uint32
          Attr: Attr }

    let encodeAttr (a: Attr) : byte[] =
        let buf = Array.zeroCreate attrSize
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 0, 8), a.Ino)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 8, 8), a.Size)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 16, 8), a.Blocks)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 24, 8), a.Atime)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 32, 8), a.Mtime)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 40, 8), a.Ctime)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 48, 4), a.Atimensec)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 52, 4), a.Mtimensec)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 56, 4), a.Ctimensec)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 60, 4), a.Mode)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 64, 4), a.Nlink)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 68, 4), a.Uid)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 72, 4), a.Gid)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 76, 4), a.Rdev)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 80, 4), a.Blksize)
        buf

    let decodeAttr (buf: byte[]) : Result<Attr, DecodeError> =
        if buf.Length < attrSize then
            Error(Truncated(attrSize, buf.Length))
        else
            Ok
                { Ino = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 0, 8))
                  Size = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 8, 8))
                  Blocks = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 16, 8))
                  Atime = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 24, 8))
                  Mtime = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 32, 8))
                  Ctime = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 40, 8))
                  Atimensec = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 48, 4))
                  Mtimensec = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 52, 4))
                  Ctimensec = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 56, 4))
                  Mode = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 60, 4))
                  Nlink = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 64, 4))
                  Uid = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 68, 4))
                  Gid = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 72, 4))
                  Rdev = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 76, 4))
                  Blksize = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 80, 4)) }

    let encodeEntryOut (e: EntryOut) : byte[] =
        let buf = Array.zeroCreate entryOutSize
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 0, 8), e.Nodeid)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 8, 8), e.Generation)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 16, 8), e.EntryValid)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 24, 8), e.AttrValid)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 32, 4), e.EntryValidNsec)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 36, 4), e.AttrValidNsec)
        let attr = encodeAttr e.Attr
        Buffer.BlockCopy(attr, 0, buf, 40, attrSize)
        buf

    let decodeEntryOut (buf: byte[]) : Result<EntryOut, DecodeError> =
        if buf.Length < entryOutSize then
            Error(Truncated(entryOutSize, buf.Length))
        else
            let attrBytes = Array.zeroCreate attrSize
            Buffer.BlockCopy(buf, 40, attrBytes, 0, attrSize)

            match decodeAttr attrBytes with
            | Error e -> Error e
            | Ok attr ->
                Ok
                    { Nodeid = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 0, 8))
                      Generation = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 8, 8))
                      EntryValid = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 16, 8))
                      AttrValid = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 24, 8))
                      EntryValidNsec = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 32, 4))
                      AttrValidNsec = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 36, 4))
                      Attr = attr }

    type AttrOut =
        { AttrValid: uint64
          AttrValidNsec: uint32
          Attr: Attr }

    let encodeAttrOut (a: AttrOut) : byte[] =
        let buf = Array.zeroCreate attrOutSize
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 0, 8), a.AttrValid)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 8, 4), a.AttrValidNsec)
        let attr = encodeAttr a.Attr
        Buffer.BlockCopy(attr, 0, buf, 16, attrSize)
        buf

    let decodeAttrOut (buf: byte[]) : Result<AttrOut, DecodeError> =
        if buf.Length < attrOutSize then
            Error(Truncated(attrOutSize, buf.Length))
        else
            let attrBytes = Array.zeroCreate attrSize
            Buffer.BlockCopy(buf, 16, attrBytes, 0, attrSize)

            match decodeAttr attrBytes with
            | Error e -> Error e
            | Ok attr ->
                Ok
                    { AttrValid = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 0, 8))
                      AttrValidNsec = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 8, 4))
                      Attr = attr }

    type PackedDirent =
        { Ino: uint64
          Name: byte[]
          Typ: uint32 }

    let recAlign (n: int) : int = (n + 7) &&& ~~~7

    let direntRecordSize (nameLen: int) : int = recAlign (direntHeaderSize + nameLen)

    let dtOf (mode: uint32) : uint32 =
        match mode &&& 0o170000u with
        | 0o040000u -> dtDir
        | 0o120000u -> dtLnk
        | _ -> dtReg

    let encodeDirents (entries: PackedDirent[]) : byte[] =
        let sizes = entries |> Array.map (fun e -> direntRecordSize e.Name.Length)
        let total = Array.sum sizes
        let buf = Array.zeroCreate total
        let mutable pos = 0
        let mutable i = 0

        while i < entries.Length do
            let e = entries.[i]
            let recLen = sizes.[i]
            let nextOff = uint64 (pos + recLen)
            BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, pos, 8), e.Ino)
            BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, pos + 8, 8), nextOff)
            BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, pos + 16, 4), uint32 e.Name.Length)
            BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, pos + 20, 4), e.Typ)

            if e.Name.Length > 0 then
                Buffer.BlockCopy(e.Name, 0, buf, pos + direntHeaderSize, e.Name.Length)

            pos <- pos + recLen
            i <- i + 1

        buf

    let decodeDirents (buf: byte[]) : Result<PackedDirent[], DecodeError> =
        let rec walk (pos: int) (acc: PackedDirent list) : Result<PackedDirent[], DecodeError> =
            if pos = buf.Length then
                Ok(acc |> List.rev |> Array.ofList)
            elif pos + direntHeaderSize > buf.Length then
                Error(Truncated(direntHeaderSize, buf.Length - pos))
            else
                let namelen = int (BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, pos + 16, 4)))
                let recLen = direntRecordSize namelen

                if namelen < 0 || pos + recLen > buf.Length then
                    Error(Truncated(max recLen direntHeaderSize, buf.Length - pos))
                else
                    let name = Array.zeroCreate namelen

                    if namelen > 0 then
                        Buffer.BlockCopy(buf, pos + direntHeaderSize, name, 0, namelen)

                    let entry =
                        { Ino = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, pos, 8))
                          Name = name
                          Typ = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, pos + 20, 4)) }

                    walk (pos + recLen) (entry :: acc)

        walk 0 []

    let openOutSize = 16
    let readInSize = 40
    let writeInSize = 40
    let writeOutSize = 8

    type OpenOut =
        { Fh: uint64
          OpenFlags: uint32 }

    type ReadIn =
        { Fh: uint64
          Offset: uint64
          Size: uint32 }

    type WriteIn =
        { Fh: uint64
          Offset: uint64
          Size: uint32 }

    let encodeOpenOut (o: OpenOut) : byte[] =
        let buf = Array.zeroCreate openOutSize
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 0, 8), o.Fh)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 8, 4), o.OpenFlags)
        buf

    let decodeOpenOut (buf: byte[]) : Result<OpenOut, DecodeError> =
        if buf.Length < openOutSize then
            Error(Truncated(openOutSize, buf.Length))
        else
            Ok
                { Fh = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 0, 8))
                  OpenFlags = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 8, 4)) }

    let encodeReadIn (r: ReadIn) : byte[] =
        let buf = Array.zeroCreate readInSize
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 0, 8), r.Fh)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 8, 8), r.Offset)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 16, 4), r.Size)
        buf

    let decodeReadIn (buf: byte[]) : Result<ReadIn, DecodeError> =
        if buf.Length < readInSize then
            Error(Truncated(readInSize, buf.Length))
        else
            Ok
                { Fh = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 0, 8))
                  Offset = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 8, 8))
                  Size = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 16, 4)) }

    let encodeWriteIn (w: WriteIn) (data: byte[]) : byte[] =
        let buf = Array.zeroCreate (writeInSize + data.Length)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 0, 8), w.Fh)
        BinaryPrimitives.WriteUInt64LittleEndian(Span(buf, 8, 8), w.Offset)
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 16, 4), w.Size)

        if data.Length > 0 then
            Buffer.BlockCopy(data, 0, buf, writeInSize, data.Length)

        buf

    let decodeWriteIn (buf: byte[]) : Result<WriteIn * byte[], DecodeError> =
        if buf.Length < writeInSize then
            Error(Truncated(writeInSize, buf.Length))
        else
            let body: WriteIn =
                { Fh = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 0, 8))
                  Offset = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 8, 8))
                  Size = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 16, 4)) }

            let dataLen = buf.Length - writeInSize
            let data = Array.zeroCreate dataLen

            if dataLen > 0 then
                Buffer.BlockCopy(buf, writeInSize, data, 0, dataLen)

            Ok(body, data)

    let encodeWriteOut (n: uint32) : byte[] =
        let buf = Array.zeroCreate writeOutSize
        BinaryPrimitives.WriteUInt32LittleEndian(Span(buf, 0, 4), n)
        buf

    let decodeWriteOut (buf: byte[]) : Result<uint32, DecodeError> =
        if buf.Length < writeOutSize then
            Error(Truncated(writeOutSize, buf.Length))
        else
            Ok(BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(buf, 0, 4)))

    let decodeFh (buf: byte[]) : Result<uint64, DecodeError> =
        if buf.Length < 8 then
            Error(Truncated(8, buf.Length))
        else
            Ok(BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan(buf, 0, 8)))

    let hex (buf: byte[]) : string =
        Convert.ToHexString(buf).ToLowerInvariant()
