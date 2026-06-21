namespace Zeta.Core

open System.Collections.Generic


/// **Pluggable serialization seam for the durable delta log.** Encodes a
/// `ZSet<'K>` delta to bytes and back. Lets `DeltaLog`/`RecoverableSpine` stay
/// format-agnostic — land on `Checkpoint` today, swap to the byte-verified
/// canonical CBOR / YAML codecs later, without touching log/recovery logic (the
/// "stable contract, swap format" path; companion doc §9). MUST be a lossless
/// round-trip: `Decode (Encode z) = z`.
type IDeltaCodec<'K when 'K : comparison> = IDeltaCodec<'K, ZSet<'K>>


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
            ZSetDynamic.toDynamicValue keyEnc z |> DynamicValue.toCanonicalCborOk
        member _.Decode bytes =
            match DynamicValue.fromCanonicalCbor bytes with
            | Ok dv -> ZSetDynamic.ofDynamicValue keyDec dv
            | Error e -> invalidArg (nameof bytes) $"CborDeltaCodec.Decode: non-decodable CBOR: {e}"


/// `DeltaLogEntry` ↔ `DynamicValue` mapping — the canonical **Log-entry envelope**, the
/// `Log` noun's path to the 4-language proven bar (workitem 081KTGD5JMD). A whole entry
/// `{ Seq; Delta; Captured }` becomes a `DynamicValue.Object` with the keys
/// `captured` / `delta` / `seq` (ordinal order), so the entry rides DynamicValue's
/// golden-vector-locked canonical CBOR — the Log entry INHERITS the existing 4-lang
/// byte-lock rather than inventing a new canonical encoding (it adds no new noun: an
/// entry is just a `DynamicValue`). `Captured` keys are **ordinal-sorted**
/// (culture-invariant; 081KT07NV0008QG0R001YDB73K) for cross-language + DST determinism — the prior
/// `System.Text.Json` `Dictionary` encoding in `GitDeltaLog`/`DiskDeltaLog` is NOT
/// canonical and is the gap this closes. Lossless round-trip: `ofDynamicValue (toDynamicValue e) = e`.
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module DeltaLogEntryDynamic =

    let toDynamicValue (keyEnc: 'K -> DynamicValue) (entry: DeltaLogEntry<'K>) : DynamicValue =
        let captured =
            entry.Captured
            |> Seq.map (fun kv -> kv.Key, kv.Value)
            |> Seq.toList
            |> List.sortWith (fun (a, _) (b, _) -> System.String.CompareOrdinal(a, b))
            |> List.map (fun (k, v) -> k, DynamicValue.String v)
        DynamicValue.Object
            [ "captured", DynamicValue.Object captured
              "delta", ZSetDynamic.toDynamicValue keyEnc entry.Delta
              "seq", DynamicValue.Int entry.Seq ]

    let ofDynamicValue (keyDec: DynamicValue -> 'K) (dv: DynamicValue) : DeltaLogEntry<'K> =
        match dv with
        | DynamicValue.Object fields ->
            let find name =
                match List.tryFind (fun (k, _) -> k = name) fields with
                | Some(_, v) -> v
                | None -> invalidArg (nameof dv) $"DeltaLogEntryDynamic: missing field '{name}'"
            let seq =
                match find "seq" with
                | DynamicValue.Int s -> s
                | o -> invalidArg (nameof dv) $"DeltaLogEntryDynamic: 'seq' not Int: {o}"
            let delta = ZSetDynamic.ofDynamicValue keyDec (find "delta")
            let captured =
                match find "captured" with
                | DynamicValue.Object kvs ->
                    kvs
                    |> List.map (fun (k, v) ->
                        match v with
                        | DynamicValue.String s -> k, s
                        | o -> invalidArg (nameof dv) $"DeltaLogEntryDynamic: captured['{k}'] not String: {o}")
                    |> Map.ofList
                | o -> invalidArg (nameof dv) $"DeltaLogEntryDynamic: 'captured' not Object: {o}"
            DeltaLogEntry<'K>(seq, delta, captured)
        | other -> invalidArg (nameof dv) $"DeltaLogEntryDynamic: expected Object, got {other}"


/// Format-parameterized canonical codec for a whole `DeltaLogEntry` (Seq + Delta + Captured), the
/// 4-language treaty target for the `Log` noun. The format-INDEPENDENT core is the
/// `DeltaLogEntryDynamic` mapping; each concrete format rides DynamicValue's already-byte-locked
/// per-format serializer, so the bytes/text are reproducible across F#/C#/Rust/TS.
///
/// Per-stream/table format choice (Aaron 2026-06-07): **git check-ins default to YAML** (diffable,
/// human-readable history) and **filesystem defaults to CBOR** (speed); all formats are optionally
/// selectable per stream/table at the backend layer. CBOR/JSON/XML round-trip exists today; **YAML is
/// a prerequisite gap** (DynamicValue has no `toYaml`/`fromYaml` yet — tracked for the git-default path).
/// These functions are the canonical replacement for the per-backend `System.Text.Json` framing in
/// `GitDeltaLog`/`DiskDeltaLog`.
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module DeltaLogEntryCodec =

    /// Canonical CBOR (the filesystem default — speed; complete 8/8 shapes, full round-trip).
    let encodeCbor (keyEnc: 'K -> DynamicValue) (entry: DeltaLogEntry<'K>) : byte[] =
        DeltaLogEntryDynamic.toDynamicValue keyEnc entry |> DynamicValue.toCanonicalCborOk

    let decodeCbor (keyDec: DynamicValue -> 'K) (bytes: byte[]) : DeltaLogEntry<'K> =
        match DynamicValue.fromCanonicalCbor bytes with
        | Ok dv -> DeltaLogEntryDynamic.ofDynamicValue keyDec dv
        | Error e -> invalidArg (nameof bytes) $"DeltaLogEntryCodec.decodeCbor: non-decodable CBOR: {e}"

    /// Canonical JSON (text — a diff-friendly option until the YAML git-default serializer lands).
    let encodeJson (keyEnc: 'K -> DynamicValue) (entry: DeltaLogEntry<'K>) : Result<string, EncodeError> =
        DeltaLogEntryDynamic.toDynamicValue keyEnc entry |> DynamicValue.toCanonicalJson

    let decodeJson (keyDec: DynamicValue -> 'K) (json: string) : DeltaLogEntry<'K> =
        match DynamicValue.fromCanonicalJson json with
        | Ok dv -> DeltaLogEntryDynamic.ofDynamicValue keyDec dv
        | Error e -> invalidArg (nameof json) $"DeltaLogEntryCodec.decodeJson: non-decodable JSON: {e}"


/// **Whole-entry serialization seam** — encodes a full `DeltaLogEntry` (Seq + Delta + Captured) to
/// canonical bytes and back. The migration target for the durable backends (`GitDeltaLog` /
/// `DiskDeltaLog`): serialize the WHOLE entry through this — the proven, 4-language byte-locked
/// `DeltaLogEntryCodec` format (golden seed `src/Core.TypeScript/delta-log-entry/golden-vectors.json`) —
/// replacing the per-backend `System.Text.Json` framing of the `Captured` map. Distinct from
/// `IDeltaCodec` (which encodes only the ZSet delta): an entry is `(Seq, Delta, Captured)`, and the whole
/// entry is the cross-language treaty unit. MUST be a lossless round-trip: `Decode (Encode e) = e`.
type IEntryCodec<'K when 'K : comparison> = IEntryCodec<'K, ZSet<'K>>


/// Canonical **CBOR** whole-entry codec — rides `DeltaLogEntryCodec` (the DynamicValue-locked canonical
/// CBOR). The backend migration target: byte-identical across F#/C#/Rust/TS, so the on-disk / in-git
/// bytes ARE the cross-language treaty. The `Seq` rides inside the entry, so `Decode` needs no external
/// sequence argument.
[<Sealed>]
type CborEntryCodec<'K when 'K : comparison>
    (keyEnc: 'K -> DynamicValue, keyDec: DynamicValue -> 'K) =
    interface IEntryCodec<'K> with
        member _.Encode entry = DeltaLogEntryCodec.encodeCbor keyEnc entry
        member _.Decode bytes = DeltaLogEntryCodec.decodeCbor keyDec bytes
