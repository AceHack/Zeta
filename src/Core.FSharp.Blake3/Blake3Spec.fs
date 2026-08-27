namespace Zeta.Core.FSharp.Blake3

open System
open System.Buffers.Binary
open Zeta.Core

/// Own BLAKE3 (hash / keyed / derive_key) from the published spec —
/// Aumasson, O'Connor, Neves, Wilcox-O'Hearn, *BLAKE3* (2020);
/// C2SP `blake3`. No calls into the `Blake3` NuGet.
///
/// The NuGet adapter (`Blake3Hasher`) is a **test oracle**. This module is
/// what DST and formal analysis can see. Composition root: `OwnBlake3Hasher`.
[<RequireQualifiedAccess>]
module Blake3Spec =

    [<Literal>]
    let OutLen = 32

    [<Literal>]
    let BlockLen = 64

    [<Literal>]
    let ChunkLen = 1024

    let ChunkStart = 1u
    let ChunkEnd = 2u
    let Parent = 4u
    let Root = 8u
    let KeyedHash = 16u
    let DeriveKeyContext = 32u
    let DeriveKeyMaterial = 64u

    let IV: uint32[] =
        [| 0x6A09E667u
           0xBB67AE85u
           0x3C6EF372u
           0xA54FF53Au
           0x510E527Fu
           0x9B05688Cu
           0x1F83D9ABu
           0x5BE0CD19u |]

    let private schedule: int[][] =
        [| [| 0; 1; 2; 3; 4; 5; 6; 7; 8; 9; 10; 11; 12; 13; 14; 15 |]
           [| 2; 6; 3; 10; 7; 0; 4; 13; 1; 11; 12; 5; 9; 14; 15; 8 |]
           [| 3; 4; 10; 12; 13; 2; 7; 14; 6; 5; 9; 0; 11; 15; 8; 1 |]
           [| 10; 7; 12; 9; 14; 3; 13; 15; 4; 0; 11; 2; 5; 8; 1; 6 |]
           [| 12; 13; 9; 11; 15; 10; 14; 8; 7; 2; 5; 3; 0; 1; 6; 4 |]
           [| 9; 14; 11; 5; 8; 12; 15; 1; 13; 3; 0; 10; 2; 6; 4; 7 |]
           [| 11; 15; 5; 0; 1; 9; 8; 6; 14; 10; 2; 12; 3; 4; 7; 13 |] |]

    let private rotR (x: uint32) (n: int) : uint32 = (x >>> n) ||| (x <<< (32 - n))

    let private g (s: uint32[]) a b c d (mx: uint32) (my: uint32) =
        s.[a] <- s.[a] + s.[b] + mx
        s.[d] <- rotR (s.[d] ^^^ s.[a]) 16
        s.[c] <- s.[c] + s.[d]
        s.[b] <- rotR (s.[b] ^^^ s.[c]) 12
        s.[a] <- s.[a] + s.[b] + my
        s.[d] <- rotR (s.[d] ^^^ s.[a]) 8
        s.[c] <- s.[c] + s.[d]
        s.[b] <- rotR (s.[b] ^^^ s.[c]) 7

    let private loadBlock (block: byte[]) (offset: int) (len: int) : uint32[] =
        let words = Array.zeroCreate<uint32> 16
        let mutable i = 0

        while i < len do
            let wordIndex = i / 4
            let shift = (i % 4) * 8
            words.[wordIndex] <- words.[wordIndex] ||| (uint32 block.[offset + i] <<< shift)
            i <- i + 1

        words

    let compress (cv: uint32[]) (block: uint32[]) (counter: uint64) (blockLen: uint32) (flags: uint32) : uint32[] =
        let s = Array.zeroCreate<uint32> 16
        Array.Copy(cv, 0, s, 0, 8)
        Array.Copy(IV, 0, s, 8, 4)
        s.[12] <- uint32 counter
        s.[13] <- uint32 (counter >>> 32)
        s.[14] <- blockLen
        s.[15] <- flags

        for r = 0 to 6 do
            let perm = schedule.[r]
            g s 0 4 8 12 block.[perm.[0]] block.[perm.[1]]
            g s 1 5 9 13 block.[perm.[2]] block.[perm.[3]]
            g s 2 6 10 14 block.[perm.[4]] block.[perm.[5]]
            g s 3 7 11 15 block.[perm.[6]] block.[perm.[7]]
            g s 0 5 10 15 block.[perm.[8]] block.[perm.[9]]
            g s 1 6 11 12 block.[perm.[10]] block.[perm.[11]]
            g s 2 7 8 13 block.[perm.[12]] block.[perm.[13]]
            g s 3 4 9 14 block.[perm.[14]] block.[perm.[15]]

        let chaining = Array.zeroCreate<uint32> 8

        for i = 0 to 7 do
            chaining.[i] <- s.[i] ^^^ s.[i + 8]

        chaining

    let compressRoot (cv: uint32[]) (block: uint32[]) (counter: uint64) (blockLen: uint32) (flags: uint32) : byte[] =
        let s = Array.zeroCreate<uint32> 16
        Array.Copy(cv, 0, s, 0, 8)
        Array.Copy(IV, 0, s, 8, 4)
        s.[12] <- uint32 counter
        s.[13] <- uint32 (counter >>> 32)
        s.[14] <- blockLen
        s.[15] <- flags

        for r = 0 to 6 do
            let perm = schedule.[r]
            g s 0 4 8 12 block.[perm.[0]] block.[perm.[1]]
            g s 1 5 9 13 block.[perm.[2]] block.[perm.[3]]
            g s 2 6 10 14 block.[perm.[4]] block.[perm.[5]]
            g s 3 7 11 15 block.[perm.[6]] block.[perm.[7]]
            g s 0 5 10 15 block.[perm.[8]] block.[perm.[9]]
            g s 1 6 11 12 block.[perm.[10]] block.[perm.[11]]
            g s 2 7 8 13 block.[perm.[12]] block.[perm.[13]]
            g s 3 4 9 14 block.[perm.[14]] block.[perm.[15]]

        let out = Array.zeroCreate<byte> OutLen

        for i = 0 to 7 do
            let word = s.[i] ^^^ s.[i + 8]
            BinaryPrimitives.WriteUInt32LittleEndian(out.AsSpan(i * 4, 4), word)

        out

    type private ChunkState(key: uint32[], chunkCounter: uint64, flags: uint32) =
        let cv = Array.copy key
        let buf = Array.zeroCreate<byte> BlockLen
        let mutable bufLen = 0
        let mutable blocksCompressed = 0

        member _.Len = blocksCompressed * BlockLen + bufLen

        member _.Update(data: byte[], offset: int, count: int) =
            let mutable off = offset
            let mutable n = count

            while n > 0 do
                if bufLen = BlockLen then
                    let block = loadBlock buf 0 BlockLen
                    let mutable f = flags

                    if blocksCompressed = 0 then
                        f <- f ||| ChunkStart

                    let chained = compress cv block chunkCounter (uint32 BlockLen) f
                    Array.Copy(chained, 0, cv, 0, 8)
                    blocksCompressed <- blocksCompressed + 1
                    bufLen <- 0

                let take = min n (BlockLen - bufLen)
                Array.Copy(data, off, buf, bufLen, take)
                bufLen <- bufLen + take
                off <- off + take
                n <- n - take

        member _.OutputRoot() : byte[] =
            let block = loadBlock buf 0 bufLen
            let mutable f = flags

            if blocksCompressed = 0 then
                f <- f ||| ChunkStart

            f <- f ||| ChunkEnd ||| Root
            compressRoot cv block chunkCounter (uint32 bufLen) f

        member _.OutputChaining() : uint32[] =
            let block = loadBlock buf 0 bufLen
            let mutable f = flags

            if blocksCompressed = 0 then
                f <- f ||| ChunkStart

            f <- f ||| ChunkEnd
            compress cv block chunkCounter (uint32 bufLen) f

    let private parentBlock (left: uint32[]) (right: uint32[]) : uint32[] =
        let block = Array.zeroCreate<uint32> 16
        Array.Copy(left, 0, block, 0, 8)
        Array.Copy(right, 0, block, 8, 8)
        block

    let private hashKeyed (key: uint32[]) (flags: uint32) (input: byte[]) : byte[] =
        if isNull input then
            invalidArg (nameof input) "input"

        if input.Length <= ChunkLen then
            let chunk = ChunkState(key, 0UL, flags)
            chunk.Update(input, 0, input.Length)
            chunk.OutputRoot()
        else
            let stack = ResizeArray<uint32[]>()
            let mutable offset = 0
            let mutable chunkIndex = 0UL
            let mutable result: byte[] = null

            while offset < input.Length && isNull result do
                let take = min ChunkLen (input.Length - offset)
                let isLast = offset + take = input.Length
                let chunk = ChunkState(key, chunkIndex, flags)
                chunk.Update(input, offset, take)

                if isLast then
                    let mutable right = chunk.OutputChaining()

                    while stack.Count > 1 do
                        let left = stack.[stack.Count - 1]
                        stack.RemoveAt(stack.Count - 1)
                        right <- compress key (parentBlock left right) 0UL (uint32 BlockLen) (flags ||| Parent)

                    let left = stack.[0]
                    result <-
                        compressRoot
                            key
                            (parentBlock left right)
                            0UL
                            (uint32 BlockLen)
                            (flags ||| Parent ||| Root)
                else
                    let mutable n = chunkIndex + 1UL
                    let mutable merged = chunk.OutputChaining()

                    while n &&& 1UL = 0UL do
                        let left = stack.[stack.Count - 1]
                        stack.RemoveAt(stack.Count - 1)
                        merged <- compress key (parentBlock left merged) 0UL (uint32 BlockLen) (flags ||| Parent)
                        n <- n >>> 1

                    stack.Add merged
                    chunkIndex <- chunkIndex + 1UL
                    offset <- offset + take

            result

    let hash (input: byte[]) : byte[] = hashKeyed IV 0u input

    let keyedHash (key: byte[]) (input: byte[]) : byte[] =
        if isNull key || key.Length <> 32 then
            invalidArg (nameof key) "key must be 32 bytes"

        let words = loadBlock key 0 32
        let kv = Array.init 8 (fun i -> words.[i])
        hashKeyed kv KeyedHash input

    let deriveKey (context: string) (material: byte[]) : byte[] =
        let ctxBytes = if isNull context then [||] else Text.Encoding.UTF8.GetBytes context
        let ctxDigest = hashKeyed IV DeriveKeyContext ctxBytes
        let words = loadBlock ctxDigest 0 32
        let kv = Array.init 8 (fun i -> words.[i])
        hashKeyed kv DeriveKeyMaterial material

    let merkleHash (input: byte[]) : MerkleHash =
        let digest = hash input
        let lo = BinaryPrimitives.ReadUInt64LittleEndian(digest.AsSpan(0, 8))
        let hi = BinaryPrimitives.ReadUInt64LittleEndian(digest.AsSpan(8, 8))
        MerkleHash(hi, lo)

/// Production hasher: own spec impl. Name is the algorithm (`blake3`).
[<Sealed>]
type OwnBlake3Hasher() =
    static do
        ContentHash256.setOfBytesHook (fun bytes -> { Raw = Blake3Spec.hash bytes })

    interface IContentHasher with
        member _.Name = "blake3"
        member _.Hash(bytes: byte[]) : MerkleHash = Blake3Spec.merkleHash bytes

[<RequireQualifiedAccess>]
module OwnBlake3Hasher =
    let hasher: IContentHasher = OwnBlake3Hasher() :> IContentHasher
