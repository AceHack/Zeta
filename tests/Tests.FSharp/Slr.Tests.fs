module Zeta.Tests.SlrTests

// SLR(1) PARSER BACKEND — Grammar IR → an EXECUTABLE parser (rung 3 payoff). shadow*,
// Aaron 2026-07-02 "no pivot just continue". Proofs:
//   1. PARSE — the classic expression grammar builds conflict-free SLR tables and the driver
//      ACCEPTS valid strings and REJECTS invalid ones (grammar → running parser).
//   2. CONFLICTS SURFACE — an ambiguous grammar reports conflicts (not silently resolved).
//   3. END TO END — a real `.g4` string → ingest → Grammar IR → SLR → parse. The whole ladder.
//   4. DETERMINISM — same grammar builds identical tables (byte-lock/DST).
//
// Anchors: Knuth (LR 1965), DeRemer (SLR), Dragon Book; ZetaParse (Amara).

open global.Xunit
open Zeta.Core

module G = GrammarIr

/// The classic SLR(1) expression grammar:
///   E → E + T | T ;  T → T * F | F ;  F → ( E ) | id
let private exprGrammar: G.Grammar =
    { Id = "expr"
      Terminals =
        [ { Name = "+"; Pattern = "+" }
          { Name = "*"; Pattern = "*" }
          { Name = "("; Pattern = "(" }
          { Name = ")"; Pattern = ")" }
          { Name = "id"; Pattern = "id" } ]
      NonTerminals = [ { Name = "E" }; { Name = "T" }; { Name = "F" } ]
      Productions =
        [ { Lhs = "E"; Rhs = [ G.NonTerm "E"; G.Term "+"; G.NonTerm "T" ] }
          { Lhs = "E"; Rhs = [ G.NonTerm "T" ] }
          { Lhs = "T"; Rhs = [ G.NonTerm "T"; G.Term "*"; G.NonTerm "F" ] }
          { Lhs = "T"; Rhs = [ G.NonTerm "F" ] }
          { Lhs = "F"; Rhs = [ G.Term "("; G.NonTerm "E"; G.Term ")" ] }
          { Lhs = "F"; Rhs = [ G.Term "id" ] } ]
      Start = "E" }

[<Fact>]
let ``PARSE: the expression grammar builds conflict-free SLR tables and accepts/rejects correctly`` () =
    match Slr.build exprGrammar with
    | Ok t ->
        Assert.Empty(t.Conflicts) // the classic grammar is SLR(1)
        // valid strings
        Assert.True(Slr.accepts t [ "id" ])
        Assert.True(Slr.accepts t [ "id"; "+"; "id" ])
        Assert.True(Slr.accepts t [ "id"; "+"; "id"; "*"; "id" ])
        Assert.True(Slr.accepts t [ "("; "id"; "+"; "id"; ")"; "*"; "id" ])
        // invalid strings
        Assert.False(Slr.accepts t [ "id"; "+" ])
        Assert.False(Slr.accepts t [ "+"; "id" ])
        Assert.False(Slr.accepts t [ ")"; "id" ])
        Assert.False(Slr.accepts t [ "id"; "id" ])
        Assert.False(Slr.accepts t [ "("; "id" ]) // unbalanced
        Assert.False(Slr.accepts t []) // empty
    | Error e -> Assert.Fail(sprintf "build failed: %s" e)

[<Fact>]
let ``CONFLICTS SURFACE: an ambiguous grammar reports conflicts, not silent resolution`` () =
    // S → S S | id  is ambiguous ⇒ shift/reduce conflict.
    let ambiguous: G.Grammar =
        { Id = "amb"
          Terminals = [ { Name = "id"; Pattern = "id" } ]
          NonTerminals = [ { Name = "S" } ]
          Productions =
            [ { Lhs = "S"; Rhs = [ G.NonTerm "S"; G.NonTerm "S" ] }
              { Lhs = "S"; Rhs = [ G.Term "id" ] } ]
          Start = "S" }
    match Slr.build ambiguous with
    | Ok t -> Assert.NotEmpty(t.Conflicts)
    | Error e -> Assert.Fail(sprintf "build failed: %s" e)

[<Fact>]
let ``END TO END: a real .g4 string → ingest → Grammar IR → SLR → running parser`` () =
    // aⁿbⁿ-style balanced grammar; uppercase lexer rules give clean token names A / B.
    let g4 =
        """
grammar AB;
s : A s B | A B ;
A : 'a' ;
B : 'b' ;
"""
    match Antlr4Import.ingest "ab" g4 with
    | Ok ing ->
        match Slr.build ing.Grammar with
        | Ok t ->
            Assert.True(Slr.accepts t [ "A"; "B" ])
            Assert.True(Slr.accepts t [ "A"; "A"; "B"; "B" ])
            Assert.False(Slr.accepts t [ "A" ])
            Assert.False(Slr.accepts t [ "A"; "B"; "B" ])
            Assert.False(Slr.accepts t [ "B"; "A" ])
        | Error e -> Assert.Fail(sprintf "SLR build failed: %s" e)
    | Error e -> Assert.Fail(sprintf "ingest failed: %s" e)

[<Fact>]
let ``DETERMINISM: the same grammar builds identical tables (byte-lock/DST)`` () =
    match Slr.build exprGrammar, Slr.build exprGrammar with
    | Ok a, Ok b ->
        Assert.Equal<Map<int * string, Slr.Action>>(a.Action, b.Action)
        Assert.Equal<Map<int * string, int>>(a.Goto, b.Goto)
    | _ -> Assert.Fail "build should succeed twice"

[<Fact>]
let ``PARSE TREE: the parser produces a concrete syntax tree that IS a DynamicValue (homoiconic)`` () =
    match Slr.build exprGrammar with
    | Ok t ->
        match Slr.parseTree t [ "id"; "+"; "id" ] with
        | Ok tree ->
            // root is the start nonterminal E
            Assert.Equal(Some(DynamicValue.String "E"), DynamicValue.get "rule" tree)
            // the tree is a DynamicValue ⇒ it rides the whole codec stack (grammar-as-data →
            // parser → parse-tree-as-data: homoiconic all the way through)
            let codecs = [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ]
            Assert.Empty(ValueTreeCodec.crossVerify codecs tree)
            // a '+' leaf appears somewhere in the tree's serialisation
            match DynamicValue.toYaml tree with
            | Ok y -> Assert.Contains("term", y)
            | Error e -> Assert.Fail(sprintf "toYaml: %A" e)
        | Error e -> Assert.Fail(sprintf "parseTree failed on valid input: %s" e)
        // invalid input → Error, not a bogus tree
        Assert.True(
            (match Slr.parseTree t [ "id"; "+" ] with
             | Error _ -> true
             | Ok _ -> false)
        )
    | Error e -> Assert.Fail(sprintf "build failed: %s" e)

/// An AMBIGUOUS grammar: E → E + E | id (associativity ambiguous ⇒ SLR shift/reduce conflict).
let private ambiguousExpr: G.Grammar =
    { Id = "amb"
      Terminals = [ { Name = "+"; Pattern = "+" }; { Name = "id"; Pattern = "id" } ]
      NonTerminals = [ { Name = "E" } ]
      Productions =
        [ { Lhs = "E"; Rhs = [ G.NonTerm "E"; G.Term "+"; G.NonTerm "E" ] }
          { Lhs = "E"; Rhs = [ G.Term "id" ] } ]
      Start = "E" }

[<Fact>]
let ``GLR parses an ambiguous grammar that SLR cannot: SLR conflicts, GLR accepts/rejects correctly`` () =
    // SLR can't handle it — reports conflicts.
    match Slr.build ambiguousExpr with
    | Ok slr -> Assert.NotEmpty(slr.Conflicts)
    | Error e -> Assert.Fail(sprintf "slr build failed: %s" e)
    // GLR forks on the conflict and still parses.
    match Slr.buildGlr ambiguousExpr with
    | Ok t ->
        Assert.True(Slr.glrParse t [ "id" ])
        Assert.True(Slr.glrParse t [ "id"; "+"; "id" ])
        Assert.True(Slr.glrParse t [ "id"; "+"; "id"; "+"; "id" ])
        Assert.False(Slr.glrParse t [ "id"; "+" ])
        Assert.False(Slr.glrParse t [ "+"; "id" ])
        Assert.False(Slr.glrParse t [ "id"; "id" ])
        Assert.False(Slr.glrParse t [])
    | Error e -> Assert.Fail(sprintf "glr build failed: %s" e)

[<Fact>]
let ``GLR agrees with SLR on the unambiguous expression grammar`` () =
    match Slr.build exprGrammar, Slr.buildGlr exprGrammar with
    | Ok slr, Ok glr ->
        for toks in
            [ [ "id" ]
              [ "id"; "+"; "id"; "*"; "id" ]
              [ "("; "id"; ")" ]
              [ "id"; "+" ]
              [ ")"; "id" ]
              [] ] do
            Assert.Equal(Slr.accepts slr toks, Slr.glrParse glr toks)
    | _ -> Assert.Fail "both builds should succeed"

[<Fact>]
let ``GLR FOREST: an ambiguous parse yields MULTIPLE trees (the superposition's support); each is a DynamicValue`` () =
    match Slr.buildGlr ambiguousExpr with
    | Ok t ->
        // id + id + id is ambiguous under E → E + E | id ⇒ ≥ 2 distinct parse trees
        // (left-assoc and right-assoc) — the support of the superposition over parses.
        let forest = Slr.glrForest t 16 [ "id"; "+"; "id"; "+"; "id" ]
        Assert.True(List.length forest >= 2, sprintf "expected ≥2 parses, got %d" (List.length forest))
        // every tree is rooted at E, and IS a DynamicValue that rides the codec stack (homoiconic)
        for tree in forest do
            Assert.Equal(Some(DynamicValue.String "E"), DynamicValue.get "rule" tree)
            Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] tree)
        // an unambiguous string has exactly ONE parse
        Assert.Equal(1, List.length (Slr.glrForest t 16 [ "id" ]))
        Assert.Equal(1, List.length (Slr.glrForest t 16 [ "id"; "+"; "id" ]))
    | Error e -> Assert.Fail(sprintf "glr build failed: %s" e)

[<Fact>]
let ``GLR FOREST: an unambiguous grammar yields exactly one tree`` () =
    match Slr.buildGlr exprGrammar with
    | Ok t -> Assert.Equal(1, List.length (Slr.glrForest t 16 [ "id"; "+"; "id"; "*"; "id" ]))
    | Error e -> Assert.Fail(sprintf "glr build failed: %s" e)
