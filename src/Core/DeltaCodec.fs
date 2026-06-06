namespace Zeta.Core


/// **Pluggable serialization seam for the durable delta log.** Encodes a
/// `ZSet<'K>` delta to bytes and back. Lets `DeltaLog`/`RecoverableSpine` stay
/// format-agnostic — land on `Checkpoint` today, swap to the byte-verified
/// canonical CBOR / YAML codecs later, without touching log/recovery logic (the
/// "stable contract, swap format" path; companion doc §9). MUST be a lossless
/// round-trip: `Decode (Encode z) = z`.
type IDeltaCodec<'K when 'K : comparison> =
    abstract Encode: ZSet<'K> -> byte[]
    abstract Decode: byte[] -> ZSet<'K>


/// `ZSet` ↔ `DynamicValue` mapping — the bridge that lets a Z-set ride ALL our
/// byte-verified serializers (CBOR / YAML / JSON / Arrow). A `ZSet<'K>` becomes a
/// `DynamicValue.Array` of `[keyDv; Int weight]` pairs, given a per-key codec
/// (keys are `'K`, so the caller supplies key ↔ `DynamicValue`).
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ZSetDynamic =

    let toDynamicValue (keyEnc: 'K -> DynamicValue) (z: ZSet<'K>) : DynamicValue =
        DynamicValue.Array
            [ for e in z -> DynamicValue.Array [ keyEnc e.Key; DynamicValue.Int e.Weight ] ]

    let ofDynamicValue (keyDec: DynamicValue -> 'K) (dv: DynamicValue) : ZSet<'K> =
        match dv with
        | DynamicValue.Array pairs ->
            pairs
            |> List.map (fun p ->
                match p with
                | DynamicValue.Array [ k; DynamicValue.Int w ] -> keyDec k, w
                | other ->
                    invalidArg (nameof dv) $"ZSetDynamic: expected [key, Int weight] pair, got {other}")
            |> ZSet.ofSeq
        | other -> invalidArg (nameof dv) $"ZSetDynamic: expected Array, got {other}"


/// Default codec: wraps the existing `Checkpoint` serializer (works for any `'K`
/// `Checkpoint` supports). The land-it-today baseline behind the seam — the disk
/// log and benchmark start here, then swap in CBOR/YAML once measured.
[<Sealed>]
type CheckpointDeltaCodec<'K when 'K : comparison>() =
    interface IDeltaCodec<'K> with
        member _.Encode z = Checkpoint.toBytes z
        member _.Decode bytes = Checkpoint.ofBytes<'K> bytes


/// Byte-verified canonical **CBOR** codec (the binary hot/perf tier). Maps
/// `ZSet` ↔ `DynamicValue` via the supplied key codec, then rides DynamicValue's
/// golden-vector-locked CBOR (RFC 8949, complete 8/8 shapes). For a self-produced
/// log the canonicality re-encode in `fromCanonicalCbor` is redundant work — a
/// `trustCanonical` fast path is a documented follow-up (Naledi, companion §9).
[<Sealed>]
type CborDeltaCodec<'K when 'K : comparison>
    (keyEnc: 'K -> DynamicValue, keyDec: DynamicValue -> 'K) =
    interface IDeltaCodec<'K> with
        member _.Encode z =
            ZSetDynamic.toDynamicValue keyEnc z |> DynamicValue.toCanonicalCbor
        member _.Decode bytes =
            match DynamicValue.fromCanonicalCbor bytes with
            | Ok dv -> ZSetDynamic.ofDynamicValue keyDec dv
            | Error e -> invalidArg (nameof bytes) $"CborDeltaCodec.Decode: non-decodable CBOR: {e}"
