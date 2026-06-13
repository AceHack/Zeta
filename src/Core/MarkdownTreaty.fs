namespace Zeta.Core

open System.Collections.Immutable

/// **Markdown + Frontmatter Treaty (Priority 1)**
///
/// Implements a 4-language read/write treaty for parsing .md files.
/// Delimited by "---" at the start of the file, containing frontmatter
/// serialized as canonical YAML, mapping to a DynamicValue.Object.
/// If there is no frontmatter, it parses metadata as an empty Object [].
module MarkdownTreaty =

    /// Parse a Markdown string into metadata (DynamicValue.Object) and the remaining body string.
    /// Asserts strict canonical check on the frontmatter YAML.
    let parse (text: string) : Result<DynamicValue * string, string> =
        let text = if System.Object.ReferenceEquals(text, null) then "" else text
        if text.StartsWith("---") && (text.Length = 3 || text.[3] = '\n' || (text.[3] = '\r' && text.Length > 4 && text.[4] = '\n')) then
            let headerLen = if text.[3] = '\r' then 5 else 4
            
            let rec findClosing (index: int) =
                if index >= text.Length then
                    None
                else
                    let isNewline, newlineLen, nextIdx =
                        if text.[index] = '\n' then true, 1, index + 1
                        elif text.[index] = '\r' && index + 1 < text.Length && text.[index + 1] = '\n' then true, 2, index + 2
                        else false, 0, index + 1
                    if isNewline then
                        if nextIdx + 3 <= text.Length && text.Substring(nextIdx, 3) = "---" then
                            let tailIdx = nextIdx + 3
                            if tailIdx = text.Length then
                                Some (index, newlineLen, tailIdx)
                            elif text.[tailIdx] = '\n' then
                                Some (index, newlineLen, tailIdx + 1)
                            elif text.[tailIdx] = '\r' && tailIdx + 1 < text.Length && text.[tailIdx + 1] = '\n' then
                                Some (index, newlineLen, tailIdx + 2)
                            else
                                findClosing nextIdx
                        else
                            findClosing nextIdx
                    else
                        findClosing nextIdx

            match findClosing headerLen with
            | None ->
                Error "Unclosed frontmatter delimiter"
            | Some (closeStart, newlineLen, closeEnd) ->
                let yamlPart = text.Substring(headerLen, closeStart + newlineLen - headerLen)
                let bodyPart = text.Substring(closeEnd)
                match DynamicValue.fromYaml yamlPart with
                | Error err -> Error (sprintf "Failed to parse frontmatter YAML: %A" err)
                | Ok (DynamicValue.Object pairs as metadata) ->
                    Ok (metadata, bodyPart)
                | Ok _ ->
                    Error "Frontmatter must be a YAML map (Object)"
        else
            Ok (DynamicValue.Object [], text)

    /// Serialize metadata (DynamicValue.Object) and a body string into a Markdown string with frontmatter.
    /// If metadata is empty (Object []), frontmatter section is omitted entirely.
    let serialize (metadata: DynamicValue) (body: string) : Result<string, EncodeError> =
        match metadata with
        | DynamicValue.Object [] ->
            Ok body
        | DynamicValue.Object _ ->
            match DynamicValue.toYaml metadata with
            | Error err -> Error err
            | Ok yaml ->
                Ok (sprintf "---\n%s---\n%s" yaml body)
        | _ ->
            Error EncodeError.NonRepresentable
