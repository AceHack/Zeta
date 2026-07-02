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
