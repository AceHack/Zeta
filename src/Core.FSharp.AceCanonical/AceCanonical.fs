/// F# oracle for the Ace canonical-JSON byte-lock (slice 8.8.1).
///
/// This is the third language (after the TS reference in
/// `src/Core.TypeScript/dynamic-value/json.ts` + `src/Core.TypeScript/ace/canonical.ts`, and the Rust
/// crate) in `tests/cross-verification/canonical-json/`. Its output must byte-match the
/// committed contract EXACTLY.
///
/// Canonical rules reproduced from the TS seam (`toTagged` + `canonicalJson` + `encodeString`):
///   - object keys SORTED (UTF-16 code-unit order — JS `Object.keys().sort()`; in .NET
///     `String.CompareOrdinal` IS UTF-16 code-unit order, so F# matches natively, including
///     astral keys, with no special case);
///   - arrays keep INSERTION order;
///   - numbers are integers ONLY, with |v| <= 9007199254740991 (JS `Number.isSafeInteger`);
///     float / NaN / Infinity / out-of-range are rejected;
///   - strings + object keys must be well-formed UTF-16 — a lone (unpaired) surrogate is
///     rejected (it would collapse to U+FFFD under UTF-8, a trust-core byte collision);
///   - minified; raw unicode (astral preserved); escape ONLY `"`, `\`, the `\b \f \n \r \t`
///     short-forms, and other control chars `< 0x20` as lowercase `\u00XX`.
module Zeta.Core.FSharp.AceCanonical

open System
open System.Text
open System.Text.Json

/// The JS `Number.MAX_SAFE_INTEGER` bound. Ace canonical content is integers-only; any number
/// with magnitude above this (or any float / NaN / Infinity) is rejected.
[<Literal>]
let private MaxSafeInteger = 9007199254740991L

/// Append the canonical escape of one .NET char (UTF-16 code unit) to a builder.
/// Mirrors the TS `encodeString` per-code-point switch: short-form escapes for
/// `" \ \b \f \n \r \t`, lowercase `\u00XX` for other control chars `< 0x20`, raw otherwise.
/// Astral characters arrive here as their two surrogate code units, each `>= 0x20`, so each is
/// appended raw — `System.Text.Json` later transcodes the well-formed pair to UTF-8 (matching
/// the TS `TextEncoder` / Rust `String::as_bytes`).
let private appendEscapedChar (sb: StringBuilder) (ch: char) : unit =
    match ch with
    | '"' -> sb.Append "\\\"" |> ignore
    | '\\' -> sb.Append "\\\\" |> ignore
    | '\b' -> sb.Append "\\b" |> ignore
    | '\012' -> sb.Append "\\f" |> ignore // form feed (U+000C)
    | '\n' -> sb.Append "\\n" |> ignore
    | '\r' -> sb.Append "\\r" |> ignore
    | '\t' -> sb.Append "\\t" |> ignore
    | _ ->
        let code = int ch
        if code <= 0x1f then
            // lowercase 4-digit hex (matches JS `code.toString(16).padStart(4, "0")`)
            sb.Append("\\u").Append(code.ToString("x4")) |> ignore
        else
            sb.Append ch |> ignore

/// Reject a string containing a lone (unpaired) UTF-16 surrogate; otherwise emit its canonical
/// `"`-wrapped escaped form. Iterates by code unit: a high surrogate must be immediately
/// followed by a low surrogate (and a low surrogate must be preceded by a high), else the text
/// is not well-formed UTF-16 and we return Error. Well-formed surrogate pairs pass through as
/// their two raw code units (see `appendEscapedChar`).
let private encodeString (s: string) : Result<string, string> =
    let sb = StringBuilder()
    sb.Append '"' |> ignore
    let mutable i = 0
    let mutable err = None
    while i < s.Length && err.IsNone do
        let ch = s.[i]
        if Char.IsHighSurrogate ch then
            if i + 1 < s.Length && Char.IsLowSurrogate s.[i + 1] then
                // well-formed astral pair: append both code units raw, advance by 2
                sb.Append(s.[i]).Append(s.[i + 1]) |> ignore
                i <- i + 2
            else
                err <- Some "lone surrogate (unpaired high surrogate, not well-formed UTF-16)"
        elif Char.IsLowSurrogate ch then
            // a low surrogate not preceded by a high (a preceding high would have consumed it)
            err <- Some "lone surrogate (unpaired low surrogate, not well-formed UTF-16)"
        else
            appendEscapedChar sb ch
            i <- i + 1
    match err with
    | Some e -> Error e
    | None ->
        sb.Append '"' |> ignore
        Ok(sb.ToString())

/// Recursively render a `JsonElement` to canonical JSON, or `Error` describing the first reason
/// it is not Ace-canonical content. `GetString` on a lone-surrogate value throws
/// `InvalidOperationException` (it transcodes UTF-16 from the stored UTF-8); callers reading the
/// whole `vectors.json` wrap this in try/with so a transcode-throw also resolves to the rejected
/// contract.
let rec aceCanonicalJson (element: JsonElement) : Result<string, string> =
    match element.ValueKind with
    | JsonValueKind.Null -> Ok "null"
    | JsonValueKind.True -> Ok "true"
    | JsonValueKind.False -> Ok "false"
    | JsonValueKind.Number ->
        // Integers ONLY, within the safe-integer magnitude bound. TryGetInt64 fails for any
        // float / NaN / Infinity (and anything outside int64); the magnitude check then enforces
        // the JS `Number.isSafeInteger` bound (rejecting e.g. 2^53 even though it fits int64).
        match element.TryGetInt64() with
        | true, v when abs v <= MaxSafeInteger -> Ok(sprintf "%d" v)  // %d is culture-invariant (locale-safe decimal, matches Rust to_string + JS String(n))
        | _ -> Error "not a safe integer — Ace canonical content has no Float fields and integers must be within the safe-integer range"
    | JsonValueKind.String ->
        // GetString may throw InvalidOperationException for a lone surrogate stored in the JSON;
        // the explicit pairing scan in encodeString also rejects, so either path is a rejection.
        encodeString (element.GetString())
    | JsonValueKind.Array ->
        let mutable err = None
        let parts = ResizeArray<string>()
        let mutable e = element.EnumerateArray()
        while err.IsNone && e.MoveNext() do
            match aceCanonicalJson e.Current with
            | Ok s -> parts.Add s
            | Error msg -> err <- Some msg
        match err with
        | Some msg -> Error msg
        | None -> Ok("[" + String.Join(",", parts) + "]")
    | JsonValueKind.Object ->
        // Collect (key, value) pairs, sort by key with String.CompareOrdinal (UTF-16 code-unit
        // order = JS `Object.keys().sort()`), reject any key with a lone surrogate, then emit.
        let mutable err = None
        let pairs = ResizeArray<string * JsonElement>()
        let mutable e = element.EnumerateObject()
        while err.IsNone && e.MoveNext() do
            // p.Name may throw InvalidOperationException for a lone-surrogate key (transcode);
            // the caller's try/with maps that to the rejected contract.
            pairs.Add(e.Current.Name, e.Current.Value)
        match err with
        | Some msg -> Error msg
        | None ->
            let sorted = pairs |> Seq.sortWith (fun (a, _) (b, _) -> String.CompareOrdinal(a, b)) |> Seq.toList
            let renderedParts = ResizeArray<string>()
            let mutable objErr = None
            for (k, v) in sorted do
                if objErr.IsNone then
                    match encodeString k with
                    | Error msg -> objErr <- Some msg
                    | Ok keyJson ->
                        match aceCanonicalJson v with
                        | Error msg -> objErr <- Some msg
                        | Ok valJson -> renderedParts.Add(keyJson + ":" + valJson)
            match objErr with
            | Some msg -> Error msg
            | None -> Ok("{" + String.Join(",", renderedParts) + "}")
    | other -> Error(sprintf "unsupported JSON value kind %A" other)
