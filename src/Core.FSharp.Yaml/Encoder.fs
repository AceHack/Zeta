// Canonical YAML ENCODER (081KT5CF90008QG0R001P4CQ09) — the renderer half the parser lacked. Takes a
// `YamlValue` DOM and emits CANONICAL, deterministic, block-style YAML such that
// `Dom.parse (encode v) = Ok v` (round-trip). Canonical = one fixed rendering per
// value, so the same value → the same bytes every time (the basis for cross-language
// byte-lock; YAML is the standard git serialization per Aaron 2026-06-04).
//
// Canonical choices (locked):
//   - block style only (the parser rejects flow `[`/`{`); 2-space indent.
//   - map keys preserve INSERTION ORDER (order-significant, matching DynamicValue).
//   - strings + keys are ALWAYS double-quoted (deterministic; a plain scalar would
//     auto-resolve its kind, so quoting is the only way to guarantee a String
//     round-trips as a String). Escapes mirror the parser exactly: \\ \" \n \t \r \0.
//   - null/bool/int rendered plain; float via invariant "R" with a forced "." so it
//     resolves back to Float (e.g. 1.0 not 1). Culture-INVARIANT throughout.
//
// Scope: scalars, maps, sequences, arbitrary nesting. Empty map/seq have no pure
// block-YAML form, so they render INLINE as flow `{}`/`[]` (081KT7YW00008QG0R002T1XNWT) — the one
// necessary flow exception, round-tripping distinct from null and from each other.
module Zeta.Core.FSharp.Yaml.Encoder

open System.Globalization
open System.Text
open Zeta.Core.FSharp.Yaml.Dom

let private quote (s: string) : string =
    let sb = StringBuilder()
    sb.Append('"') |> ignore
    for ch in s do
        match ch with
        | '\\' -> sb.Append("\\\\") |> ignore
        | '"' -> sb.Append("\\\"") |> ignore
        | '\n' -> sb.Append("\\n") |> ignore
        | '\t' -> sb.Append("\\t") |> ignore
        | '\r' -> sb.Append("\\r") |> ignore
        | '\000' -> sb.Append("\\0") |> ignore
        | c -> sb.Append(c) |> ignore
    sb.Append('"') |> ignore
    sb.ToString()

/// The inline rendering of a SCALAR value, or None for a container.
let private scalar (v: YamlValue) : string option =
    match v with
    | VNull -> Some "null"
    | VBool b -> Some(if b then "true" else "false")
    | VInt i -> Some(i.ToString(CultureInfo.InvariantCulture))
    | VFloat f ->
        let r = f.ToString("R", CultureInfo.InvariantCulture)
        // force a float-looking token so resolvePlainKind sees Float, not Int
        let looksFloat = r |> Seq.exists (fun c -> c = '.' || c = 'e' || c = 'E')
        Some(if looksFloat then r else r + ".0")
    | VStr s -> Some(quote s)
    // Empty collections render INLINE as flow `{}` / `[]` (081KT7YW00008QG0R002T1XNWT): block style
    // cannot represent an empty map/seq, so without this `{}`, `[]`, and null all
    // collapse to a bare `key:` -> null. The one necessary flow exception; non-empty
    // containers still return None -> recurse as block.
    | VMap [] -> Some "{}"
    | VSeq [] -> Some "[]"
    | VSeq _
    | VMap _ -> None

let private pad (indent: int) : string = String.replicate indent " "

let rec private emit (indent: int) (v: YamlValue) (lines: ResizeArray<string>) : unit =
    match v with
    | VMap pairs ->
        for (k, child) in pairs do
            let key = quote k
            match scalar child with
            | Some s -> lines.Add(pad indent + key + ": " + s)
            | None ->
                lines.Add(pad indent + key + ":")
                emit (indent + 2) child lines
    | VSeq items ->
        for child in items do
            match scalar child with
            | Some s -> lines.Add(pad indent + "- " + s)
            | None ->
                lines.Add(pad indent + "-")
                emit (indent + 2) child lines
    | other ->
        // a top-level scalar
        lines.Add(pad indent + (scalar other).Value)

/// Canonical YAML rendering of a value. Round-trips: `Dom.parse (encode v) = Ok v`.
let encode (v: YamlValue) : string =
    let lines = ResizeArray<string>()
    emit 0 v lines
    String.concat "\n" lines + "\n"
