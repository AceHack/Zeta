module Zeta.Tests.CogenTests

// COGEN — the 3rd Futamura projection realized in-domain (shadow*, Aaron 2026-07-02: "Futamura i
// want to get to next level"). `compile = mix ∘ read` : grammar-notation text → serialized
// specialized parser. Proofs:
//   1. COMPILE IS GENERAL — compile any grammar's notation into a working parser-IR (run via
//      Slr.parseFromIr; accepts/rejects the TARGET language correctly).
//   2. COGEN FIXPOINT — compile the kernel's OWN notation ⇒ the meta-parser regenerates itself:
//      regenerateMetaParser () = directMetaParser ()  (exact DynamicValue equality). gen(gen)==gen.
//   3. SELF-APPLICATION CLOSURE — the regenerated meta-parser parses grammar-notation, including the
//      kernel's own defining text (full circle).
//
// Anchors: Futamura (1971, 3rd projection = cogen); Jones/Gomard/Sestoft (1993).

open global.Xunit
open Zeta.Core

[<Fact>]
let ``COMPILE IS GENERAL: compile a grammar's notation into a working parser-IR (target language parses correctly)`` () =
    // grammar  s : s a | b ;  ⇒ language is  b a*  (a 'b' then zero or more 'a').
    let src = "s : s a | b ;"
    match Cogen.compile src with
    | Ok ir ->
        let accepts toks =
            match Slr.parseFromIr ir toks with
            | Ok _ -> true
            | Error _ -> false
        Assert.True(accepts [ "b" ])
        Assert.True(accepts [ "b"; "a" ])
        Assert.True(accepts [ "b"; "a"; "a" ])
        Assert.False(accepts [ "a" ]) // must start with b
        Assert.False(accepts [ "b"; "b" ]) // only one b
        Assert.False(accepts []) // empty
    | Error e -> Assert.Fail(sprintf "compile failed: %s" e)

[<Fact>]
let ``COGEN FIXPOINT: compiling the kernel's own notation regenerates the meta-parser exactly (gen(gen)==gen)`` () =
    match Cogen.regenerateMetaParser (), Cogen.directMetaParser () with
    | Ok regenerated, Ok direct ->
        // the compiler, fed the definition of its own input language, reproduces itself —
        // to the byte (exact DynamicValue equality on the serialized parser-IR).
        Assert.Equal<DynamicValue>(direct, regenerated)
    | Error e, _
    | _, Error e -> Assert.Fail(sprintf "fixpoint build failed: %s" e)

[<Fact>]
let ``SELF-APPLICATION CLOSURE: the regenerated meta-parser parses grammar-notation, incl. the kernel's own text`` () =
    match Cogen.regenerateMetaParser () with
    | Ok metaIr ->
        // the regenerated parser runs on grammar-NOTATION token classes (NAME/COLON/PIPE/SEMI).
        let classesOf g =
            MetaGrammar.tokenize (MetaGrammar.emit g) |> fst
        let accepts g =
            match Slr.parseFromIr metaIr (classesOf g) with
            | Ok _ -> true
            | Error _ -> false
        // full circle: the self-generated meta-parser accepts the kernel's OWN defining notation
        Assert.True(accepts MetaGrammar.kernel, "regenerated meta-parser should parse the kernel's own text")
        // …and any other grammar's notation, too
        let ab: GrammarIr.Grammar =
            { Id = "ab"
              Terminals = [ { Name = "a"; Pattern = "a" }; { Name = "b"; Pattern = "b" } ]
              NonTerminals = [ { Name = "s" } ]
              Productions =
                [ { Lhs = "s"; Rhs = [ GrammarIr.NonTerm "s"; GrammarIr.Term "a" ] }
                  { Lhs = "s"; Rhs = [ GrammarIr.Term "b" ] } ]
              Start = "s" }
        Assert.True(accepts ab, "regenerated meta-parser should parse another grammar's notation")
    | Error e -> Assert.Fail(sprintf "regenerate failed: %s" e)
