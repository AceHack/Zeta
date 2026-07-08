module Zeta.Tests.ZetaIdlTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``IDL GRAMMAR IS SLR(1): the IDL grammar builds conflict-free tables`` () =
    match Slr.build ZetaIdl.grammar with
    | Ok t -> Assert.Empty(t.Conflicts)
    | Error e -> Assert.Fail(sprintf "Zeta IDL grammar build failed: %s" e)

[<Fact>]
let ``Tokenizer handles keywords, comments, and symbols`` () =
    let src = "
        // A simple test interface
        interface ICalculator {
            /* method to add two integers */
            method Add(a: Int, b: Int) -> Int;
        }
    "
    match ZetaIdl.tokenize src with
    | Ok tokens ->
        let classes = tokens |> List.map fst
        let lexemes = tokens |> List.map snd
        Assert.Equal<string list>(
            ["INTERFACE"; "NAME"; "LBRACE"; "METHOD"; "NAME"; "LPAREN"; "NAME"; "COLON"; "NAME"; "COMMA"; "NAME"; "COLON"; "NAME"; "RPAREN"; "RETURNS"; "NAME"; "SEMI"; "RBRACE"],
            classes
        )
        Assert.Equal<string list>(
            ["interface"; "ICalculator"; "{"; "method"; "Add"; "("; "a"; ":"; "Int"; ","; "b"; ":"; "Int"; ")"; "->"; "Int"; ";"; "}"],
            lexemes
        )
    | Error e -> Assert.Fail(e)

[<Fact>]
let ``Parser parses interface definitions to DynamicValue AST`` () =
    let src = "
        interface ISampleable {
            method Sample() -> Float;
            method Introspect(id: String) -> Bool;
        }
    "
    match ZetaIdl.parse src with
    | Ok ast ->
        // Retrieve interfaces from AST
        match DynamicValue.get "interfaces" ast with
        | Some(DynamicValue.Array [ i ]) ->
            Assert.Equal(DynamicValue.String "ISampleable", DynamicValue.get "name" i |> Option.get)
            match DynamicValue.get "methods" i with
            | Some(DynamicValue.Array [ m1; m2 ]) ->
                Assert.Equal(DynamicValue.String "Sample", DynamicValue.get "name" m1 |> Option.get)
                Assert.Equal(DynamicValue.String "Float", DynamicValue.get "returnType" m1 |> Option.get)
                Assert.Empty(match DynamicValue.get "arguments" m1 with Some(DynamicValue.Array xs) -> xs | _ -> [])

                Assert.Equal(DynamicValue.String "Introspect", DynamicValue.get "name" m2 |> Option.get)
                Assert.Equal(DynamicValue.String "Bool", DynamicValue.get "returnType" m2 |> Option.get)
                match DynamicValue.get "arguments" m2 with
                | Some(DynamicValue.Array [ arg ]) ->
                    Assert.Equal(DynamicValue.String "id", DynamicValue.get "name" arg |> Option.get)
                    Assert.Equal(DynamicValue.String "String", DynamicValue.get "type" arg |> Option.get)
                | _ -> Assert.Fail("Expected one argument for Introspect")
            | _ -> Assert.Fail("Expected two methods")
        | _ -> Assert.Fail("Expected one interface in AST")
    | Error e -> Assert.Fail(sprintf "Parse failed: %s" e)

[<Fact>]
let ``Codegen generates clean F# interface code`` () =
    let src = "
        interface IGeospatial {
            method Locality(lat: Float, lon: Float) -> String;
            method Ping() -> Void;
        }
    "
    match ZetaIdl.parse src with
    | Ok ast ->
        let code = ZetaIdl.generateFSharp ast
        let expected = 
            "type IGeospatial =\n" +
            "    abstract member Locality : lat:float * lon:float -> string\n" +
            "    abstract member Ping : unit -> unit"
        Assert.Equal(expected, code)
    | Error e -> Assert.Fail(e)
