namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.Numerics
open Zeta.Core.FSharp.Blake3

/// Jumprope file body over FastCDC v1 (K4 / PR6).
///
/// Beacon: Scott Vokes, Strange Loop 2012 (leaf / limb / trunk); Pugh skip
/// lists 1990. Level is hash-as-probability (high bits of ContentId), not RNG.
/// Homogeneous chunker per file. ContentId of the file is the trunk digest
/// (BLAKE3-256 of the canonical `rope-trunk/1` encoding), not the raw bytes.
/// Logical Z-set is `(offset, chunk ContentId)`; Jumprope is source of truth.
/// `delta/1` is not a first-product tag.
///
/// FastCDC algorithm is `FastCdc.fs` as executed. This module does not change it.
///
/// Alloc: freeze/build may allocate (CAS objects, leaf index, FastCDC already
/// copied each chunk). Seek/pread is the hot path: binary search on a prefix
/// array built at freeze, then a view over the stored payload. It does not
/// ToArray the chunk, ToHex a ContentId, or re-parse CBOR. The skiplist CBOR
/// is the durable encoding / ContentId; it is not the in-memory seek structure.
module ZetaFsJumprope =

    [<Literal>]
    let Fanout = 32

    [<Literal>]
    let MaxLevel = 16

    type ChunkerId =
        | FastCdcV1
        | FastCdcV1Large

    type Entry =
        { Hash: ContentHash256
          Span: uint64
          Jump: uint8 }

    type JumpropeError =
        | OffsetOutOfRange of offset: uint64 * span: uint64
        | MissingObject of hex: string
        | UnknownTag of string
        | Malformed of string

    type SeekHit =
        { Chunk: ContentHash256
          OffsetInChunk: uint64
          /// View over the stored FastCDC payload. Not a copy.
          Payload: ReadOnlyMemory<byte> }

    /// Objects = canonical CBOR (identity). Payloads = FastCDC chunk bytes as
    /// the chunker emitted them — seek/pread return a view, they do not ToArray.
    /// Keyed by ContentHash256, not hex strings (ToHex is a 64-char alloc).
    type Cas =
        { Objects: ImmutableDictionary<ContentHash256, byte[]>
          Payloads: ImmutableDictionary<ContentHash256, byte[]> }

    type Rope =
        { Content: ContentHash256
          Span: uint64
          Chunker: ChunkerId
          Cas: Cas
          /// Chunk ContentId + length, in file order. Derivables; trunk is source.
          Leaves: (ContentHash256 * uint64)[]
          /// Start offset of Leaves[i]. Built once at freeze. Seek binary-searches this.
          Starts: uint64[] }

    let private idCmp =
        { new IEqualityComparer<ContentHash256> with
            member _.Equals(a, b) =
                MemoryExtensions.SequenceEqual(ReadOnlySpan<byte> a.Raw, ReadOnlySpan<byte> b.Raw)

            member _.GetHashCode(a) = a.GetHashCode() }

    let emptyCas () : Cas =
        { Objects = ImmutableDictionary.Create<ContentHash256, byte[]>(idCmp)
          Payloads = ImmutableDictionary.Create<ContentHash256, byte[]>(idCmp) }

    let tryGet (cas: Cas) (id: ContentHash256) : byte[] option =
        match cas.Objects.TryGetValue(id) with
        | true, bytes -> Some bytes
        | _ -> None

    let tryGetPayload (cas: Cas) (id: ContentHash256) : byte[] option =
        match cas.Payloads.TryGetValue(id) with
        | true, bytes -> Some bytes
        | _ -> None

    let put (cas: Cas) (id: ContentHash256) (bytes: byte[]) : Cas =
        { cas with Objects = cas.Objects.SetItem(id, bytes) }

    let private putPayload (cas: Cas) (id: ContentHash256) (payload: byte[]) : Cas =
        { cas with Payloads = cas.Payloads.SetItem(id, payload) }

    let chunkerName (c: ChunkerId) : string =
        match c with
        | ChunkerId.FastCdcV1 -> "fastcdc-v1"
        | ChunkerId.FastCdcV1Large -> "fastcdc-v1-large"

    let parseChunker (s: string) : ChunkerId option =
        if String.Equals(s, "fastcdc-v1", StringComparison.Ordinal) then
            Some ChunkerId.FastCdcV1
        elif String.Equals(s, "fastcdc-v1-large", StringComparison.Ordinal) then
            Some ChunkerId.FastCdcV1Large
        else
            None

    let sizes (c: ChunkerId) : int * int * int =
        match c with
        | ChunkerId.FastCdcV1 -> 2048, 8192, 65536
        | ChunkerId.FastCdcV1Large -> 8192, 65536, 262144

    let private dvBytes (b: byte[]) : DynamicValue =
        DynamicValue.Bytes(ImmutableArray.CreateRange b)

    let private dvObj (pairs: (string * DynamicValue) list) : DynamicValue =
        DynamicValue.Object(
            pairs
            |> List.sortWith (fun (a, _) (b, _) -> String.Compare(a, b, StringComparison.Ordinal))
        )

    let private hashBytes (bytes: byte[]) : ContentHash256 = ContentHash256.ofBytes bytes

    let private putDv (cas: Cas) (dv: DynamicValue) : ContentHash256 * Cas =
        let bytes = DynamicValue.toCanonicalCborOk dv
        let id = hashBytes bytes
        id, put cas id bytes

    let private tryFind (pairs: (string * DynamicValue) list) (key: string) : DynamicValue option =
        pairs
        |> List.tryPick (fun (k, v) ->
            if String.Equals(k, key, StringComparison.Ordinal) then Some v else None)

    let private asInt (v: DynamicValue) : int64 option =
        match v with
        | DynamicValue.Int n -> Some n
        | _ -> None

    let private hashFromDv (v: DynamicValue) : Result<ContentHash256, JumpropeError> =
        match v with
        | DynamicValue.Bytes b when not b.IsDefault && b.Length = 32 ->
            let raw = Array.zeroCreate 32
            b.AsSpan().CopyTo(Span<byte> raw)
            Ok { Raw = raw }
        | _ -> Error(JumpropeError.Malformed "hash must be 32 bytes")

    let private asString (v: DynamicValue) : string option =
        match v with
        | DynamicValue.String s -> Some s
        | _ -> None

    let private asObject (v: DynamicValue) : (string * DynamicValue) list option =
        match v with
        | DynamicValue.Object pairs -> Some pairs
        | _ -> None

    let private asArray (v: DynamicValue) : DynamicValue list option =
        match v with
        | DynamicValue.Array xs -> Some xs
        | _ -> None

    /// High bits of ContentId as skip-list level. Leading zeros of the raw digest.
    let levelOf (id: ContentHash256) : uint8 =
        let rec go i acc =
            if acc >= MaxLevel || i >= id.Raw.Length then
                min MaxLevel acc
            else
                let b = id.Raw.[i]

                if b = 0uy then
                    go (i + 1) (acc + 8)
                else
                    acc + (BitOperations.LeadingZeroCount(uint32 b) - 24)

        byte (min MaxLevel (go 0 0))

    let private encodeChunk (cas: Cas) (data: byte[]) : ContentHash256 * Cas =
        let dv =
            dvObj
                [ "data", dvBytes data
                  "len", DynamicValue.Int(int64 data.Length)
                  "t", DynamicValue.String "chunk/1" ]

        let id, cas1 = putDv cas dv
        id, putPayload cas1 id data

    let private encodeLeaf (cas: Cas) (chunk: ContentHash256) (len: uint64) : ContentHash256 * Cas =
        let dv =
            dvObj
                [ "content", dvBytes chunk.Raw
                  "len", DynamicValue.Int(int64 len)
                  "t", DynamicValue.String "rope-leaf/1" ]

        putDv cas dv

    let private encodeEntry (e: Entry) : DynamicValue =
        dvObj
            [ "hash", dvBytes e.Hash.Raw
              "jump", DynamicValue.Int(int64 e.Jump)
              "span", DynamicValue.Int(int64 e.Span) ]

    let private encodeLimb (cas: Cas) (entries: Entry[]) : ContentHash256 * Cas =
        let dv =
            dvObj
                [ "entries", DynamicValue.Array [ for e in entries -> encodeEntry e ]
                  "t", DynamicValue.String "rope-limb/1" ]

        putDv cas dv

    let private encodeTrunk (cas: Cas) (chunker: ChunkerId) (entries: Entry[]) (endEntry: Entry) : ContentHash256 * Cas =
        let dv =
            dvObj
                [ "chunker", DynamicValue.String(chunkerName chunker)
                  "end", encodeEntry endEntry
                  "entries", DynamicValue.Array [ for e in entries -> encodeEntry e ]
                  "t", DynamicValue.String "rope-trunk/1" ]

        putDv cas dv

    let private decodeEntry (dv: DynamicValue) : Result<Entry, JumpropeError> =
        match asObject dv with
        | None -> Error(JumpropeError.Malformed "entry is not a map")
        | Some pairs ->
            match tryFind pairs "hash", tryFind pairs "span", tryFind pairs "jump" with
            | Some h, Some s, Some j ->
                match hashFromDv h, asInt s, asInt j with
                | Ok id, Some span, Some jump when span >= 0L && jump >= 0L && jump <= int64 MaxLevel ->
                    Ok
                        { Hash = id
                          Span = uint64 span
                          Jump = byte jump }
                | Error e, _, _ -> Error e
                | _ -> Error(JumpropeError.Malformed "entry fields")
            | _ -> Error(JumpropeError.Malformed "entry missing keys")

    type private Decoded =
        | DecChunk
        | DecLeaf of ContentHash256 * uint64
        | DecLimb of Entry[]
        | DecTrunk of chunker: ChunkerId * entries: Entry[] * endEntry: Entry

    let private decode (bytes: byte[]) : Result<Decoded, JumpropeError> =
        match DynamicValue.fromCanonicalCbor bytes with
        | Error e -> Error(JumpropeError.Malformed(sprintf "%A" e))
        | Ok dv ->
            match asObject dv with
            | None -> Error(JumpropeError.Malformed "object is not a map")
            | Some pairs ->
                match tryFind pairs "t" |> Option.bind asString with
                | None -> Error(JumpropeError.Malformed "missing t")
                | Some "chunk/1" -> Ok DecChunk
                | Some "rope-leaf/1" ->
                    match tryFind pairs "content", tryFind pairs "len" |> Option.bind asInt with
                    | Some contentDv, Some len when len >= 0L ->
                        match hashFromDv contentDv with
                        | Error e -> Error e
                        | Ok id -> Ok(DecLeaf(id, uint64 len))
                    | _ -> Error(JumpropeError.Malformed "rope-leaf fields")
                | Some "rope-limb/1" ->
                    match tryFind pairs "entries" |> Option.bind asArray with
                    | None -> Error(JumpropeError.Malformed "limb entries")
                    | Some xs ->
                        let rec walk acc rest =
                            match rest with
                            | [] -> Ok(DecLimb(List.rev acc |> List.toArray))
                            | h :: t ->
                                match decodeEntry h with
                                | Error e -> Error e
                                | Ok e -> walk (e :: acc) t

                        walk [] xs
                | Some "rope-trunk/1" ->
                    match
                        tryFind pairs "chunker" |> Option.bind asString |> Option.bind parseChunker,
                        tryFind pairs "entries" |> Option.bind asArray,
                        tryFind pairs "end"
                    with
                    | Some chunker, Some xs, Some endDv ->
                        match decodeEntry endDv with
                        | Error e -> Error e
                        | Ok endEntry ->
                            let rec walk acc rest =
                                match rest with
                                | [] -> Ok(List.rev acc |> List.toArray)
                                | h :: t ->
                                    match decodeEntry h with
                                    | Error e -> Error e
                                    | Ok e -> walk (e :: acc) t

                            match walk [] xs with
                            | Error e -> Error e
                            | Ok entries -> Ok(DecTrunk(chunker, entries, endEntry))
                    | _ -> Error(JumpropeError.Malformed "trunk fields")
                | Some other -> Error(JumpropeError.UnknownTag other)

    let private load (cas: Cas) (id: ContentHash256) : Result<Decoded, JumpropeError> =
        match tryGet cas id with
        | None -> Error(JumpropeError.MissingObject(id.ToHex()))
        | Some bytes -> decode bytes

    type private BuildLeaf =
        { LeafId: ContentHash256
          ChunkId: ContentHash256
          Span: uint64
          Level: uint8 }

    let private sumSpan (entries: Entry[]) : uint64 =
        let mutable n = 0UL

        for e in entries do
            n <- n + e.Span

        n

    let rec private group (cas: Cas) (nodes: BuildLeaf[]) (origin: int) (count: int) : Entry[] * Cas =
        if count <= 0 then
            [||], cas
        elif count = 1 then
            let n = nodes.[origin]

            [| { Hash = n.LeafId
                 Span = n.Span
                 Jump = n.Level } |],
            cas
        else
            let mutable maxL = 0uy

            for i in origin .. origin + count - 1 do
                if nodes.[i].Level > maxL then
                    maxL <- nodes.[i].Level

            let cuts = ResizeArray<int>()
            cuts.Add 0

            if maxL > 0uy then
                for i in 1 .. count - 1 do
                    if nodes.[origin + i].Level >= maxL then
                        cuts.Add i

            let useFanout = cuts.Count <= 1

            if useFanout && count <= Fanout then
                let flat = Array.zeroCreate count

                for i in 0 .. count - 1 do
                    let n = nodes.[origin + i]

                    flat.[i] <-
                        { Hash = n.LeafId
                          Span = n.Span
                          Jump = n.Level }

                flat, cas
            else
                let step = if useFanout then Fanout else 0
                let starts = ResizeArray<int>()

                if useFanout then
                    let mutable i = 0

                    while i < count do
                        starts.Add i
                        i <- i + step
                else
                    for c in cuts do
                        starts.Add c

                starts.Add count

                let acc = ResizeArray<Entry>()
                let mutable store = cas
                let jump = if useFanout then 0uy else maxL

                for s in 0 .. starts.Count - 2 do
                    let a = starts.[s]
                    let b = starts.[s + 1]
                    let len = b - a

                    if len = 1 then
                        let n = nodes.[origin + a]

                        acc.Add
                            { Hash = n.LeafId
                              Span = n.Span
                              Jump = n.Level }
                    elif len > 1 then
                        let child, next = group store nodes (origin + a) len
                        let limbId, next2 = encodeLimb next child

                        acc.Add
                            { Hash = limbId
                              Span = sumSpan child
                              Jump = jump }

                        store <- next2

                acc.ToArray(), store

    let private chunkAll (chunker: ChunkerId) (bytes: byte[]) : byte[][] =
        let minC, avgC, maxC = sizes chunker

        if isNull bytes || bytes.Length = 0 then
            [| Array.empty |]
        elif bytes.Length <= minC then
            // FastCdcChunker allocates maxChunk*4 (256 KiB at v1). A 1-byte
            // freeze must not pay that. Copy so Cas does not alias mutbuf.
            [| Array.copy bytes |]
        else
            let c = FastCdcChunker(minC, avgC, maxC)
            c.Push(ReadOnlySpan<byte> bytes)
            c.Flush()
            let chunks = c.DrainChunks()

            if chunks.Length = 0 then
                [| Array.empty |]
            else
                chunks

    /// FastCDC + Jumprope. Small files (below min-chunk) are a single-leaf rope.
    let build (chunker: ChunkerId) (bytes: byte[]) : Rope =
        let chunks = chunkAll chunker bytes
        let mutable cas = emptyCas ()
        let leaves = ResizeArray<BuildLeaf>()

        for ch in chunks do
            let chunkId, cas1 = encodeChunk cas ch
            let leafId, cas2 = encodeLeaf cas1 chunkId (uint64 ch.Length)
            cas <- cas2

            leaves.Add
                { LeafId = leafId
                  ChunkId = chunkId
                  Span = uint64 ch.Length
                  Level = levelOf leafId }

        let nodes = leaves.ToArray()
        let last = nodes.[nodes.Length - 1]

        let endEntry =
            { Hash = last.LeafId
              Span = last.Span
              Jump = last.Level }

        let prefixCount = nodes.Length - 1
        let entries, cas2 = group cas nodes 0 prefixCount
        let trunkId, cas3 = encodeTrunk cas2 chunker entries endEntry
        let span = sumSpan entries + endEntry.Span
        let starts = Array.zeroCreate nodes.Length
        let mutable off = 0UL

        for i in 0 .. nodes.Length - 1 do
            starts.[i] <- off
            off <- off + nodes.[i].Span

        { Content = trunkId
          Span = span
          Chunker = chunker
          Cas = cas3
          Leaves = [| for n in nodes -> n.ChunkId, n.Span |]
          Starts = starts }

    let buildV1 (bytes: byte[]) : Rope = build ChunkerId.FastCdcV1 bytes

    let private payloadMemory (cas: Cas) (chunk: ContentHash256) : Result<ReadOnlyMemory<byte>, JumpropeError> =
        match tryGetPayload cas chunk with
        | Some data -> Ok(ReadOnlyMemory data)
        | None -> Error(JumpropeError.MissingObject(chunk.ToHex()))

    /// Concatenate leaves into one dest buffer. That alloc is the result, not a per-chunk ToArray.
    let materialize (rope: Rope) : Result<byte[], JumpropeError> =
        let buf = Array.zeroCreate (int rope.Span)
        let mutable off = 0

        let rec copy i =
            if i >= rope.Leaves.Length then
                Ok buf
            else
                let chunk, len = rope.Leaves.[i]

                match tryGetPayload rope.Cas chunk with
                | None -> Error(JumpropeError.MissingObject(chunk.ToHex()))
                | Some data ->
                    if uint64 data.Length <> len then
                        Error(JumpropeError.Malformed "chunk length mismatch")
                    else
                        if data.Length > 0 then
                            Buffer.BlockCopy(data, 0, buf, off, data.Length)

                        off <- off + data.Length
                        copy (i + 1)

        copy 0

    let rec private seekNode (cas: Cas) (id: ContentHash256) (offset: uint64) : Result<SeekHit, JumpropeError> =
        match load cas id with
        | Error e -> Error e
        | Ok(DecLeaf(chunk, len)) ->
            if offset >= len then
                Error(JumpropeError.OffsetOutOfRange(offset, len))
            else
                match payloadMemory cas chunk with
                | Error e -> Error e
                | Ok mem ->
                    Ok
                        { Chunk = chunk
                          OffsetInChunk = offset
                          Payload = mem }
        | Ok(DecLimb entries) ->
            let mutable off = offset
            let mutable i = 0
            let mutable hit: Result<SeekHit, JumpropeError> option = None

            while i < entries.Length && hit.IsNone do
                let e = entries.[i]

                if off < e.Span then
                    hit <- Some(seekNode cas e.Hash off)
                else
                    off <- off - e.Span
                    i <- i + 1

            match hit with
            | Some r -> r
            | None -> Error(JumpropeError.OffsetOutOfRange(offset, sumSpan entries))
        | Ok(DecTrunk(_, entries, endEntry)) ->
            let mutable off = offset
            let mutable i = 0
            let mutable hit: Result<SeekHit, JumpropeError> option = None

            while i < entries.Length && hit.IsNone do
                let e = entries.[i]

                if off < e.Span then
                    hit <- Some(seekNode cas e.Hash off)
                else
                    off <- off - e.Span
                    i <- i + 1

            match hit with
            | Some r -> r
            | None -> seekNode cas endEntry.Hash off
        | Ok DecChunk -> Error(JumpropeError.Malformed "seek hit a raw chunk")

    let private hitAt (rope: Rope) (leaf: int) (offset: uint64) : Result<SeekHit, JumpropeError> =
        let chunk, _ = rope.Leaves.[leaf]
        let local = offset - rope.Starts.[leaf]

        match payloadMemory rope.Cas chunk with
        | Error e -> Error e
        | Ok mem ->
            Ok
                { Chunk = chunk
                  OffsetInChunk = local
                  Payload = mem }

    /// Last leaf whose start offset is ≤ `offset`. Freeze-built prefix, no CBOR.
    let private leafAt (starts: uint64[]) (offset: uint64) : int =
        let mutable lo = 0
        let mutable hi = starts.Length - 1

        while lo < hi do
            let mid = lo + ((hi - lo + 1) / 2)

            if starts.[mid] <= offset then
                lo <- mid
            else
                hi <- mid - 1

        lo

    /// Walk the durable trunk encoding. Not the hot path — used to cross-check `seek`.
    let seekEncoded (rope: Rope) (offset: uint64) : Result<SeekHit, JumpropeError> =
        if rope.Span = 0UL then
            if offset = 0UL then
                match rope.Leaves with
                | [| chunk, _ |] ->
                    match payloadMemory rope.Cas chunk with
                    | Error e -> Error e
                    | Ok mem ->
                        Ok
                            { Chunk = chunk
                              OffsetInChunk = 0UL
                              Payload = mem }
                | _ -> Error(JumpropeError.OffsetOutOfRange(offset, 0UL))
            else
                Error(JumpropeError.OffsetOutOfRange(offset, 0UL))
        elif offset >= rope.Span then
            Error(JumpropeError.OffsetOutOfRange(offset, rope.Span))
        else
            seekNode rope.Cas rope.Content offset

    /// In-memory seek: binary search the freeze-time prefix array, then a payload view.
    /// Does not parse CBOR and does not ToHex.
    let seek (rope: Rope) (offset: uint64) : Result<SeekHit, JumpropeError> =
        if rope.Span = 0UL then
            if offset = 0UL && rope.Leaves.Length = 1 then
                hitAt rope 0 0UL
            else
                Error(JumpropeError.OffsetOutOfRange(offset, 0UL))
        elif offset >= rope.Span then
            Error(JumpropeError.OffsetOutOfRange(offset, rope.Span))
        else
            hitAt rope (leafAt rope.Starts offset) offset

    /// Copy into a caller buffer. Returns bytes written. No intermediate payload array.
    let pread (rope: Rope) (offset: uint64) (dst: Memory<byte>) : Result<int, JumpropeError> =
        if dst.Length = 0 then
            Ok 0
        elif offset >= rope.Span && rope.Span > 0UL then
            Ok 0
        else
            let mutable written = 0
            let mutable off = offset
            let mutable err: JumpropeError option = None

            while written < dst.Length && off < rope.Span && err.IsNone do
                match seek rope off with
                | Error e -> err <- Some e
                | Ok hit ->
                    let start = int hit.OffsetInChunk
                    let available = hit.Payload.Length - start
                    let take = min (dst.Length - written) available

                    if take > 0 then
                        hit.Payload.Slice(start, take).Span.CopyTo(dst.Span.Slice(written, take))
                        written <- written + take
                        off <- off + uint64 take
                    else
                        err <- Some(JumpropeError.Malformed "empty seek hit")

            match err with
            | Some e -> Error e
            | None -> Ok written

    /// Decode a stored object. Unknown major tag (including `delta/1`) refuses.
    let decodeObject (bytes: byte[]) : Result<unit, JumpropeError> =
        match decode bytes with
        | Ok _ -> Ok()
        | Error e -> Error e

    /// Logical Z-set coverage: `(offset, chunk ContentId)` in order. Derivables.
    let asCoverage (rope: Rope) : (uint64 * ContentHash256)[] =
        let acc = Array.zeroCreate rope.Leaves.Length
        let mutable off = 0UL

        for i in 0 .. rope.Leaves.Length - 1 do
            let chunk, len = rope.Leaves.[i]
            acc.[i] <- off, chunk
            off <- off + len

        acc

    let errorName (e: JumpropeError) : string =
        match e with
        | JumpropeError.OffsetOutOfRange _ -> "OffsetOutOfRange"
        | JumpropeError.MissingObject _ -> "MissingObject"
        | JumpropeError.UnknownTag _ -> "UnknownTag"
        | JumpropeError.Malformed _ -> "Malformed"
