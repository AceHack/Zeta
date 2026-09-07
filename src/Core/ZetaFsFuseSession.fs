namespace Zeta.Core

open System
open System.Buffers.Binary

/// Byte-level FUSE session over the ABI encoder (PR13). Reads one
/// request buffer and writes one reply buffer. No `/dev/fuse`, no
/// kernel, no FUSE-T binary.
module ZetaFsFuseSession =

    type Error = Truncated of ZetaFsFuseAbi.DecodeError

    let private replyOk (unique: uint64) (payload: byte[]) : byte[] =
        let header: ZetaFsFuseAbi.OutHeader =
            { Len = uint32 (ZetaFsFuseAbi.outHeaderSize + payload.Length)
              Error = 0
              Unique = unique }

        Array.append (ZetaFsFuseAbi.encodeOutHeader header) payload

    let private replyErrno (unique: uint64) (errno: int) : byte[] =
        let header: ZetaFsFuseAbi.OutHeader =
            { Len = uint32 ZetaFsFuseAbi.outHeaderSize
              Error = -errno
              Unique = unique }

        ZetaFsFuseAbi.encodeOutHeader header

    let private payload (req: byte[]) : byte[] =
        if req.Length <= ZetaFsFuseAbi.inHeaderSize then
            [||]
        else
            let n = req.Length - ZetaFsFuseAbi.inHeaderSize
            let dst = Array.zeroCreate n
            Buffer.BlockCopy(req, ZetaFsFuseAbi.inHeaderSize, dst, 0, n)
            dst

    /// Answer one kernel request. INIT negotiates 7.26 with flags 0.
    /// A newer kernel major gets only our major (fuse(4) downgrade).
    /// Unknown opcodes are ENOSYS. Truncated buffers are Error.
    let handle (req: byte[]) : Result<byte[], Error> =
        match ZetaFsFuseAbi.decodeInHeader req with
        | Result.Error e -> Result.Error(Truncated e)
        | Result.Ok header ->
            if header.Opcode <> ZetaFsFuseAbi.fuseInit then
                Result.Ok(replyErrno header.Unique 38)
            else
                match ZetaFsFuseAbi.decodeInitIn (payload req) with
                | Result.Error e -> Result.Error(Truncated e)
                | Result.Ok init ->
                    if init.Major <> ZetaFsFuseAbi.protoMajor then
                        let major = Array.zeroCreate 4
                        BinaryPrimitives.WriteUInt32LittleEndian(Span major, ZetaFsFuseAbi.protoMajor)
                        Result.Ok(replyOk header.Unique major)
                    else
                        let body =
                            { ZetaFsFuseAbi.firstProductInitOut with
                                Minor = min init.Minor ZetaFsFuseAbi.protoMinor
                                MaxReadahead = init.MaxReadahead }

                        Result.Ok(replyOk header.Unique (ZetaFsFuseAbi.encodeInitOut body))

    let private nameOf (bytes: byte[]) : byte[] =
        let mutable n = bytes.Length

        while n > 0 && bytes.[n - 1] = 0uy do
            n <- n - 1

        if n = bytes.Length then
            bytes
        else
            let dst = Array.zeroCreate n
            if n > 0 then
                Buffer.BlockCopy(bytes, 0, dst, 0, n)
            dst

    let private unixParts (ns: int64) : uint64 * uint32 =
        if ns < 0L then
            0UL, 0u
        else
            uint64 (ns / 1_000_000_000L), uint32 (ns % 1_000_000_000L)

    let private attrOf (stat: ZetaFsPosixMeta.PosixStat) (ino: uint64) : ZetaFsFuseAbi.Attr =
        let mSec, mNsec = unixParts stat.Meta.MtimeNs
        let cSec, cNsec = unixParts stat.Meta.CtimeNs
        let nlink = if stat.Nlink < 1L then 1u else uint32 stat.Nlink

        { Ino = ino
          Size = stat.Size
          Blocks = (stat.Size + 511UL) / 512UL
          Atime = 0UL
          Mtime = mSec
          Ctime = cSec
          Atimensec = 0u
          Mtimensec = mNsec
          Ctimensec = cNsec
          Mode = stat.Meta.Mode
          Nlink = nlink
          Uid = stat.Meta.Uid
          Gid = stat.Meta.Gid
          Rdev = 0u
          Blksize = 4096u }

    /// LOOKUP/GETATTR over a live Fake VFS session. INIT still works.
    /// Unknown opcodes are ENOSYS. No `/dev/fuse`.
    let handleMounted
        (session: ZetaFsFuse.Session)
        (req: byte[])
        : Result<byte[] * ZetaFsFuse.Session, Error> =
        match ZetaFsFuseAbi.decodeInHeader req with
        | Result.Error e -> Result.Error(Truncated e)
        | Result.Ok header ->
            if header.Opcode = ZetaFsFuseAbi.fuseInit then
                match handle req with
                | Result.Error e -> Result.Error e
                | Result.Ok reply -> Result.Ok(reply, session)
            elif header.Opcode = ZetaFsFuseAbi.fuseLookup then
                match
                    ZetaFsFuse.dispatch session (ZetaFsFuse.Lookup(header.Nodeid, nameOf (payload req)))
                with
                | ZetaFsFuse.Fail e ->
                    Result.Ok(replyErrno header.Unique (ZetaFsFuse.code e), session)
                | ZetaFsFuse.Node node ->
                    match ZetaFsFuse.dispatch session (ZetaFsFuse.Getattr node.Id) with
                    | ZetaFsFuse.Stat(stat, ino) ->
                        let entry: ZetaFsFuseAbi.EntryOut =
                            { Nodeid = node.Id
                              Generation = 1UL
                              EntryValid = 0UL
                              AttrValid = 0UL
                              EntryValidNsec = 0u
                              AttrValidNsec = 0u
                              Attr = attrOf stat ino }

                        Result.Ok(replyOk header.Unique (ZetaFsFuseAbi.encodeEntryOut entry), session)
                    | ZetaFsFuse.Fail e ->
                        Result.Ok(replyErrno header.Unique (ZetaFsFuse.code e), session)
                    | _ -> Result.Ok(replyErrno header.Unique 22, session)
                | _ -> Result.Ok(replyErrno header.Unique 22, session)
            else
                Result.Ok(replyErrno header.Unique 38, session)
