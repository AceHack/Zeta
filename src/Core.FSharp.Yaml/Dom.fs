// Layer 2: the DOM fold (YamlValue + parse), built ON TOP of the L1 event stream.
//
// This is the JsonDocument half of the Utf8JsonReader-vs-JsonDocument split: Reader.fs
// scans once and emits events; this module folds that flat event stream into a value tree.
// It does NOT re-scan text -- it consumes readEvents output. Faithful port of the TS
// reference src/Core.TypeScript/yaml/dom.ts and the Rust oracle
// src/Core.Rust.Yaml/src/dom.rs.
//
// Nested module under the Reader's top-level module. A module named
// `Zeta.Core.FSharp.Yaml.Dom` does not clash with the `Zeta.Core.FSharp.Yaml` module
// (Reader.fs); declaring a second `namespace Zeta.Core.FSharp.Yaml` WOULD clash (FS0247),
// so the DOM lives in its own nested module and opens the Reader's types.

module Zeta.Core.FSharp.Yaml.Dom

open System.Globalization
open Zeta.Core.FSharp.Yaml

/// The folded value tree. Map preserves insertion order (a list of pairs, not a hash map),
/// mirroring the cross-language contract.
type YamlValue =
    /// null / ~ / empty.
    | VNull
    /// A boolean.
    | VBool of bool
    /// A 64-bit signed integer (parsed from raw).
    | VInt of int64
    /// A 64-bit float (parsed from raw).
    | VFloat of float
    /// A string (the decoded raw).
    | VStr of string
    /// An ordered sequence.
    | VSeq of YamlValue list
    /// An ordered mapping (insertion order preserved).
    | VMap of (string * YamlValue) list

let private scalarToValue (raw: string) (kind: ScalarKind) : Result<YamlValue, YamlFeedback> =
    match kind with
    | ScalarKind.Null -> Ok VNull
    | ScalarKind.Bool -> Ok(VBool(raw = "true" || raw = "True" || raw = "TRUE"))
    | ScalarKind.Int ->
        match System.Int64.TryParse(raw, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture) with
        | true, v -> Ok(VInt v)
        | false, _ -> Error UnexpectedCharacter
    | ScalarKind.Float ->
        match System.Double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture) with
        | true, v -> Ok(VFloat v)
        | false, _ -> Error UnexpectedCharacter
    | ScalarKind.Str -> Ok(VStr raw)

/// Cursor-based fold over the flat event array.
type private Folder(events: YamlEvent[]) =
    let mutable pos = 0

    member _.Peek() : Result<YamlEvent, YamlFeedback> =
        if pos < events.Length then Ok events.[pos] else Error UnsupportedConstruct

    member this.Next() : Result<YamlEvent, YamlFeedback> =
        match this.Peek() with
        | Ok ev ->
            pos <- pos + 1
            Ok ev
        | Error f -> Error f

    member this.Expect(want: YamlEvent) : Result<unit, YamlFeedback> =
        match this.Next() with
        | Ok ev when ev = want -> Ok()
        | Ok _ -> Error UnsupportedConstruct
        | Error f -> Error f

    // top-level: StreamStart <value> StreamEnd
    member this.Fold() : Result<YamlValue, YamlFeedback> =
        match this.Expect(StreamStart) with
        | Error f -> Error f
        | Ok() ->
            match this.FoldValue() with
            | Error f -> Error f
            | Ok value ->
                match this.Expect(StreamEnd) with
                | Error f -> Error f
                | Ok() -> Ok value

    member this.FoldValue() : Result<YamlValue, YamlFeedback> =
        match this.Peek() with
        | Error f -> Error f
        | Ok(Scalar(raw, kind, _)) ->
            pos <- pos + 1
            scalarToValue raw kind
        | Ok MappingStart -> this.FoldMapping()
        | Ok SequenceStart -> this.FoldSequence()
        | Ok _ -> Error UnsupportedConstruct

    member this.FoldMapping() : Result<YamlValue, YamlFeedback> =
        match this.Expect(MappingStart) with
        | Error f -> Error f
        | Ok() ->
            let entries = System.Collections.Generic.List<string * YamlValue>()
            let mutable result = None
            let mutable looping = true
            while looping && result.IsNone do
                match this.Peek() with
                | Error f -> result <- Some(Error f)
                | Ok MappingEnd -> looping <- false
                | Ok _ ->
                    match this.Next() with
                    | Ok(Scalar(raw, _, _)) ->
                        match this.FoldValue() with
                        | Error f -> result <- Some(Error f)
                        | Ok value -> entries.Add((raw, value))
                    | Ok _ -> result <- Some(Error UnsupportedConstruct)
                    | Error f -> result <- Some(Error f)
            match result with
            | Some r -> r
            | None ->
                match this.Expect(MappingEnd) with
                | Error f -> Error f
                | Ok() -> Ok(VMap(List.ofSeq entries))

    member this.FoldSequence() : Result<YamlValue, YamlFeedback> =
        match this.Expect(SequenceStart) with
        | Error f -> Error f
        | Ok() ->
            let items = System.Collections.Generic.List<YamlValue>()
            let mutable result = None
            let mutable looping = true
            while looping && result.IsNone do
                match this.Peek() with
                | Error f -> result <- Some(Error f)
                | Ok SequenceEnd -> looping <- false
                | Ok _ ->
                    match this.FoldValue() with
                    | Error f -> result <- Some(Error f)
                    | Ok value -> items.Add(value)
            match result with
            | Some r -> r
            | None ->
                match this.Expect(SequenceEnd) with
                | Error f -> Error f
                | Ok() -> Ok(VSeq(List.ofSeq items))

/// Parse `text` into a YamlValue tree, or decline via YamlFeedback.
let parse (text: string) : Result<YamlValue, YamlFeedback> =
    match readEvents text with
    | Error f -> Error f
    | Ok events -> Folder(Array.ofList events).Fold()
