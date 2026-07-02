namespace Zeta.Core

open System
open System.Globalization
open System.Collections.Immutable

/// **ValueTreeEnvelope — the versioned, category-tagged parity wrapper.**
/// (Aaron 2026-07-02, shadow*: "We must have parity even if we have to use ugly strings
/// or some wrapper object or anything … all of this is not scary cause all of our
/// serialization can be rolled with version numbers and category types … any decisions
/// here are also rollable and 0 down time upgradable … 0 down time parser
/// updates/replacement proofs.")
///
/// A 1-ary codec (JSON/YAML) is NATIVE only on Null/Bool/Int/String/Array/Object. This
/// module closes the parity debt: `encode` rewrites a value tree into that portable
/// subset, wrapping every non-native shape (`Float`, `Bytes`, and later `Decimal` /
/// `SoftValue` / Kleene tri-boolean) in a WRAPPER OBJECT that carries a schema VERSION
/// and a CATEGORY tag. So `ValueTreeCodec.parity json` becomes TOTAL — full-fidelity
/// round-trip of the whole shape space — over a format with no native bytes or float.
///
/// **Rollable by construction (zero-downtime).** The version + category tags are exactly
/// the seam `SchemaEvolution` (081KSRGFP0008QG0R001Y6RTY9) makes safe: a reader that knows
/// versions {1..N} decodes any wire tagged ≤ N; an UNKNOWN newer version or category is a
/// clean `Error`, never silent corruption — so a writer can roll to v2 while old readers
/// keep serving v1 data (no stop-the-world migration). Replacing the parser/codec impl
/// behind `ValueTreeCodec` is the format-level analogue of a schema migration: same wire
/// contract ⇒ transparent swap; new wire ⇒ a versioned, forward/backward-compatible roll.
///
/// **Collision-safe.** `$zeta` is the single reserved key that marks an envelope. Any
/// SOURCE object that itself uses `$zeta` is escaped (category `map`), so on the wire a
/// `$zeta`-keyed object is unambiguously an envelope — no source tree can forge one.
///
/// Doctrine: docs/research/2026-07-02-hexagonal-value-tree-codec-ports-nation-state-
/// supply-chain-resistance-own-the-interface-zero-dep-endgame.md §5–§6.
[<RequireQualifiedAccess>]
module ValueTreeEnvelope =

    /// Current envelope schema version. A writer emits this; a reader accepts `≤`.
    [<Literal>]
    let version = 1

    /// The single reserved key marking an envelope on the wire (collision-safe: any
    /// source object using it is escaped, category `map`).
    [<Literal>]
    let reservedKey = "$zeta"

    let private verKey = "v"
    let private catKey = "c"
    let private dataKey = "d"

    let private ord = StringComparison.Ordinal

    let private wrap (cat: string) (payload: DynamicValue) : DynamicValue =
        DynamicValue.Object
            [ reservedKey,
              DynamicValue.Object
                  [ verKey, DynamicValue.Int(int64 version)
                    catKey, DynamicValue.String cat
                    dataKey, payload ] ]

    // Round-trip "R" + InvariantCulture is the lossless float text form (CA1305).
    let private floatToString (f: float) : string = f.ToString("R", CultureInfo.InvariantCulture)
    let private base64 (b: ImmutableArray<byte>) : string = Convert.ToBase64String(b.AsSpan())

    /// Rewrite a value tree into the codec-portable subset, wrapping every non-native
    /// shape and escaping any source object that uses the reserved key. Total.
    let rec encode (dv: DynamicValue) : DynamicValue =
        match dv with
        | DynamicValue.Null
        | DynamicValue.Bool _
        | DynamicValue.Int _
        | DynamicValue.String _ -> dv
        | DynamicValue.Float f -> wrap "f64" (DynamicValue.String(floatToString f))
        | DynamicValue.Bytes b -> wrap "b64" (DynamicValue.String(base64 b))
        | DynamicValue.Array xs -> DynamicValue.Array(xs |> List.map encode)
        | DynamicValue.Object kvs ->
            let encoded = kvs |> List.map (fun (k, v) -> k, encode v)
            if kvs |> List.exists (fun (k, _) -> String.Equals(k, reservedKey, ord)) then
                wrap "map" (DynamicValue.Object encoded) // escape a source object using our key
            else
                DynamicValue.Object encoded

    let private (|Envelope|_|) (dv: DynamicValue) : (int * string * DynamicValue) option =
        match dv with
        | DynamicValue.Object [ (k, DynamicValue.Object fields) ] when String.Equals(k, reservedKey, ord) ->
            let find key =
                fields |> List.tryPick (fun (fk, fv) -> if String.Equals(fk, key, ord) then Some fv else None)
            match find verKey, find catKey, find dataKey with
            | Some(DynamicValue.Int v), Some(DynamicValue.String c), Some d -> Some(int v, c, d)
            | _ -> None
        | _ -> None

    // Result-threading fold over a list (no exceptions on the codec path).
    let private mapResult (f: 'a -> Result<'b, string>) (xs: 'a list) : Result<'b list, string> =
        (Ok [], xs)
        ||> List.fold (fun acc x -> acc |> Result.bind (fun ys -> f x |> Result.map (fun y -> ys @ [ y ])))

    /// Inverse of `encode`: unwrap envelopes back to their native shapes. An unknown
    /// newer version or category is a clean `Error` (the zero-downtime roll guarantee:
    /// detect, never silently corrupt).
    let rec decode (dv: DynamicValue) : Result<DynamicValue, string> =
        match dv with
        | Envelope(v, cat, d) ->
            if v > version then
                Error(sprintf "envelope version %d newer than reader %d — roll the reader forward" v version)
            else
                match cat with
                | "f64" ->
                    match d with
                    | DynamicValue.String s ->
                        match Double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture) with
                        | true, f -> Ok(DynamicValue.Float f)
                        | _ -> Error(sprintf "bad f64 envelope payload: %s" s)
                    | _ -> Error "f64 envelope payload must be a String"
                | "b64" ->
                    match d with
                    | DynamicValue.String s ->
                        try
                            Ok(DynamicValue.Bytes(ImmutableArray.CreateRange<byte>(Convert.FromBase64String s)))
                        with _ ->
                            Error "bad b64 envelope payload"
                    | _ -> Error "b64 envelope payload must be a String"
                | "map" ->
                    match d with
                    | DynamicValue.Object kvs -> decodeChildren kvs |> Result.map DynamicValue.Object
                    | _ -> Error "map envelope payload must be an Object"
                | other -> Error(sprintf "unknown envelope category '%s' (v%d) — add a case to roll forward" other v)
        | DynamicValue.Array xs -> xs |> mapResult decode |> Result.map DynamicValue.Array
        | DynamicValue.Object kvs -> decodeChildren kvs |> Result.map DynamicValue.Object
        | leaf -> Ok leaf

    and private decodeChildren (kvs: (string * DynamicValue) list) : Result<(string * DynamicValue) list, string> =
        kvs |> mapResult (fun (k, v) -> decode v |> Result.map (fun y -> k, y))
