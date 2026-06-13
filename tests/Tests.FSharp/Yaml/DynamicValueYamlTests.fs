module Zeta.Tests.FSharp.Yaml.DynamicValueYamlTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

[<Fact>]
let ``DynamicValue toYaml and fromYaml round-trips correctly`` () =
    let sample =
        DynamicValue.Object [
            "a", DynamicValue.Int 10L
            "b", DynamicValue.String "hello"
            "n", DynamicValue.Null
            "nested", DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.Bool true ]
        ]
    match DynamicValue.toYaml sample with
    | Error err -> failwithf "Failed to serialize: %A" err
    | Ok yaml ->
        match DynamicValue.fromYaml yaml with
        | Error err -> failwithf "Failed to deserialize: %A\nYAML:\n%s" err yaml
        | Ok decoded ->
            decoded |> should equal sample

[<Fact>]
let ``DynamicValue fromYaml rejects non-canonical formatting`` () =
    // Canonical YAML always quotes keys and strings, uses block indentation, and terminates with newline.
    // Non-canonical input (e.g. unquoted key, raw float without .0, trailing whitespace)
    // should fail the strict fixed-point check.
    let nonCanonical = "a: 10\n" // unquoted key 'a'
    match DynamicValue.fromYaml nonCanonical with
    | Error DecodeError.NonCanonical -> ()
    | Ok value -> failwithf "Expected NonCanonical decode error, got Ok: %A" value
    | Error err -> failwithf "Expected DecodeError.NonCanonical, got %A" err

[<Fact>]
let ``MarkdownTreaty parses and serializes correctly`` () =
    let metadata = DynamicValue.Object [ "title", DynamicValue.String "Zeta Treaty"; "version", DynamicValue.Int 1L ]
    let body = "This is the document body.\nLine 2.\n"
    
    // Test serialize
    match MarkdownTreaty.serialize metadata body with
    | Error err -> failwithf "Failed to serialize markdown: %A" err
    | Ok serialized ->
        // Assert delimiters exist
        serialized.StartsWith("---") |> should equal true
        
        // Test parse
        match MarkdownTreaty.parse serialized with
        | Error err -> failwithf "Failed to parse markdown: %s" err
        | Ok (parsedMeta, parsedBody) ->
            parsedMeta |> should equal metadata
            parsedBody |> should equal body

[<Fact>]
let ``MarkdownTreaty handles empty metadata correctly`` () =
    let metadata = DynamicValue.Object []
    let body = "Pure markdown document with no frontmatter.\n"
    
    match MarkdownTreaty.serialize metadata body with
    | Error err -> failwithf "Failed to serialize: %A" err
    | Ok serialized ->
        // Frontmatter must be completely omitted
        serialized |> should equal body
        
        match MarkdownTreaty.parse serialized with
        | Error err -> failwithf "Failed to parse: %s" err
        | Ok (parsedMeta, parsedBody) ->
            parsedMeta |> should equal metadata
            parsedBody |> should equal body
