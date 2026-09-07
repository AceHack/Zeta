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
