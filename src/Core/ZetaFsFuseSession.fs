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

    /// LOOKUP and GETATTR over a live Fake VFS session. INIT still works.
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
            elif header.Opcode = ZetaFsFuseAbi.fuseGetattr then
                match ZetaFsFuse.dispatch session (ZetaFsFuse.Getattr header.Nodeid) with
                | ZetaFsFuse.Fail e ->
                    Result.Ok(replyErrno header.Unique (ZetaFsFuse.code e), session)
                | ZetaFsFuse.Stat(stat, ino) ->
                    let body: ZetaFsFuseAbi.AttrOut =
                        { AttrValid = 0UL
                          AttrValidNsec = 0u
                          Attr = attrOf stat ino }

                    Result.Ok(replyOk header.Unique (ZetaFsFuseAbi.encodeAttrOut body), session)
                | _ -> Result.Ok(replyErrno header.Unique 22, session)
            elif header.Opcode = ZetaFsFuseAbi.fuseReaddir then
                match ZetaFsFuse.dispatch session (ZetaFsFuse.Readdir header.Nodeid) with
                | ZetaFsFuse.Fail e ->
                    Result.Ok(replyErrno header.Unique (ZetaFsFuse.code e), session)
                | ZetaFsFuse.Dirents entries ->
                    let packed =
                        entries
                        |> Array.map (fun d ->
                            let typ =
                                match ZetaFsFuse.dispatch session (ZetaFsFuse.Getattr d.Node.Id) with
                                | ZetaFsFuse.Stat(stat, _) -> ZetaFsFuseAbi.dtOf stat.Meta.Mode
                                | _ -> ZetaFsFuseAbi.dtReg

                            let row: ZetaFsFuseAbi.PackedDirent =
                                { Ino = d.Node.Ino
                                  Name = d.Name
                                  Typ = typ }

                            row)

                    Result.Ok(replyOk header.Unique (ZetaFsFuseAbi.encodeDirents packed), session)
                | _ -> Result.Ok(replyErrno header.Unique 22, session)
            elif header.Opcode = ZetaFsFuseAbi.fuseOpen then
                match ZetaFsFuse.dispatch session (ZetaFsFuse.Open header.Nodeid) with
                | ZetaFsFuse.Fail e ->
                    Result.Ok(replyErrno header.Unique (ZetaFsFuse.code e), session)
                | ZetaFsFuse.Fh fh ->
                    let body: ZetaFsFuseAbi.OpenOut =
                        { Fh = fh
                          OpenFlags = ZetaFsFuseAbi.fopenDirectIo }

                    Result.Ok(replyOk header.Unique (ZetaFsFuseAbi.encodeOpenOut body), session)
                | _ -> Result.Ok(replyErrno header.Unique 22, session)
            elif header.Opcode = ZetaFsFuseAbi.fuseRead then
                match ZetaFsFuseAbi.decodeReadIn (payload req) with
                | Result.Error e -> Result.Error(Truncated e)
                | Result.Ok r ->
                    let off = int64 r.Offset
                    let size = int r.Size

                    match ZetaFsFuse.dispatch session (ZetaFsFuse.Read(r.Fh, off, size)) with
                    | ZetaFsFuse.Fail e ->
                        Result.Ok(replyErrno header.Unique (ZetaFsFuse.code e), session)
                    | ZetaFsFuse.Bytes b -> Result.Ok(replyOk header.Unique b, session)
                    | _ -> Result.Ok(replyErrno header.Unique 22, session)
            elif header.Opcode = ZetaFsFuseAbi.fuseWrite then
                match ZetaFsFuseAbi.decodeWriteIn (payload req) with
                | Result.Error e -> Result.Error(Truncated e)
                | Result.Ok(w, data) ->
                    let off = int64 w.Offset

                    match ZetaFsFuse.dispatch session (ZetaFsFuse.Write(w.Fh, off, data)) with
                    | ZetaFsFuse.Fail e ->
                        Result.Ok(replyErrno header.Unique (ZetaFsFuse.code e), session)
                    | ZetaFsFuse.Written n ->
                        Result.Ok(replyOk header.Unique (ZetaFsFuseAbi.encodeWriteOut (uint32 n)), session)
                    | _ -> Result.Ok(replyErrno header.Unique 22, session)
            elif header.Opcode = ZetaFsFuseAbi.fuseRelease then
                match ZetaFsFuseAbi.decodeFh (payload req) with
                | Result.Error e -> Result.Error(Truncated e)
                | Result.Ok fh ->
                    match ZetaFsFuse.dispatch session (ZetaFsFuse.Release fh) with
                    | ZetaFsFuse.Fail e ->
                        Result.Ok(replyErrno header.Unique (ZetaFsFuse.code e), session)
                    | ZetaFsFuse.Released -> Result.Ok(replyOk header.Unique [||], session)
                    | _ -> Result.Ok(replyErrno header.Unique 22, session)
            else
                Result.Ok(replyErrno header.Unique 38, session)
