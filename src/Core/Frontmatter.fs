namespace Zeta.Core

open System

/// **Frontmatter ⇄ value-tree split — the purest metadata ⊕ payload shape.**
/// (Aaron 2026-07-02, shadow*: "cloud events / debezium envelopes … very similar to
/// frontmatter, same kind of graph … one graph, many surfaces.")
///
/// A frontmatter document is a metadata **head** between `---` fences followed by a **body** —
/// the metadata ⊕ payload frame the event envelopes share, in its most repo-native form. It
/// maps to a value tree `Object [ "head", String <raw head>; "body", String <body> ]`, so it
/// rides the whole `ValueTreeCodec` stack like any other tree.
///
/// The head is kept as a **verbatim string**, so the split is a LOSSLESS bijection on ANY
/// frontmatter (human- or machine-written): `parse (render vt) = vt`. Structured access to the
/// head (parsing it into a value tree) is `tryMeta`, which is BEST-EFFORT: our `fromYaml` is a
/// strict *canonical* codec, so it parses canonical YAML but returns `Error` on arbitrary
/// human YAML. Full structured frontmatter awaits the lenient YAML parser (the backlogged
/// parser-combinator layer — the same tokenizer seam noted in `RomDat`); until then the
/// lossless head/body split stands on its own.
///
/// Doctrine: docs/research/2026-07-02-hexagonal-value-tree-codec-ports-…-zero-dep-endgame.md §8.
[<RequireQualifiedAccess>]
module Frontmatter =

    [<Literal>]
    let fence = "---"

    [<Literal>]
    let headKey = "head"

    [<Literal>]
    let bodyKey = "body"

    let private ord = StringComparison.Ordinal

    /// Build the value-tree form from a raw head string + body string.
    let make (head: string) (body: string) : DynamicValue =
        DynamicValue.Object [ headKey, DynamicValue.String head; bodyKey, DynamicValue.String body ]

    /// Parse a frontmatter document into `Object [ head; body ]` (head verbatim). No leading
    /// fence ⇒ empty `head` and the whole string as `body`. Line endings normalised to `\n`.
    let parse (doc0: string) : Result<DynamicValue, string> =
        let doc = doc0.Replace("\r\n", "\n").Replace("\r", "\n")
        if not (doc.StartsWith("---\n", ord) || String.Equals(doc, "---", ord)) then
            Ok(make "" doc)
        else
            let lines = doc.Split('\n')
            let closeIdx =
                seq { 1 .. lines.Length - 1 }
                |> Seq.tryFind (fun i -> String.Equals(lines.[i], fence, ord))
            match closeIdx with
            | None -> Error "frontmatter: opening fence has no matching closing '---'"
            | Some j ->
                let head = String.Join("\n", lines.[1 .. j - 1])
                let body = String.Join("\n", lines.[j + 1 ..])
                Ok(make head body)

    /// Render `Object [ head; body ]` back to a frontmatter document. An empty `head` yields a
    /// fence-less document (just the body) — the inverse of the no-fence parse.
    let render (dv: DynamicValue) : Result<string, string> =
        let field k =
            match DynamicValue.tryField k dv with
            | Some(DynamicValue.String s) -> Some s
            | _ -> None
        match dv with
        | DynamicValue.Object _ ->
            let head = field headKey |> Option.defaultValue ""
            let body = field bodyKey |> Option.defaultValue ""
            if String.IsNullOrEmpty head then
                Ok body
            else
                let head = if head.EndsWith("\n", ord) then head else head + "\n"
                Ok(String.concat "" [ "---\n"; head; "---\n"; body ])
        | _ -> Error "frontmatter: value must be an Object { head, body }"

    /// Best-effort structured access to the head: parse the verbatim head string into a value
    /// tree via the (strict canonical) YAML codec. Returns `Error` on non-canonical (e.g.
    /// human-written) YAML — full lenient parsing awaits the parser-combinator layer.
    let tryMeta (dv: DynamicValue) : Result<DynamicValue, string> =
        match DynamicValue.tryField headKey dv with
        | Some(DynamicValue.String head) when not (String.IsNullOrWhiteSpace head) ->
            DynamicValue.fromYaml head |> Result.mapError (fun e -> sprintf "frontmatter: head not canonical YAML: %A" e)
        | Some(DynamicValue.String _) -> Ok(DynamicValue.Object []) // empty head ⇒ empty meta
        | _ -> Error "frontmatter: no head field"
