module Zeta.Tests.GrammarIrTests

// THE ZETA GRAMMAR IR AS A DYNAMICVALUE SCHEMA — rung 3's bounded first step (shadow*,
// Aaron 2026-07-02: "we can do the first steps … compile to/from our IR and most other ANTLR
// grammars"). A grammar is INGESTED into a neutral Grammar IR; this lands that IR's structural
// core as a value tree so a grammar is just DATA. Proofs:
//   1. BIJECTION — a real grammar round-trips Grammar → DynamicValue → Grammar = id.
//   2. RUNG 2 SERVES RUNG 3 — the grammar-as-value-tree rides the codec stack (parity-json /
//      cbor / parity-asn1 agree), so a grammar is byte-lockable + DST-replayable, like any tree.
//   3. TOTAL PARSE — malformed input yields a clean Error, never an exception.
//
// Anchors: ZetaParse (Amara, zetaparse-lr-glr-…-2026-05-21); Knuth (LR); antlr/grammars-v4.

open global.Xunit
open Zeta.Core

module G = GrammarIr
module VTC = ValueTreeCodec

/// A small but real grammar: arithmetic expressions.
///   expr  -> expr PLUS term | term
///   term  -> term STAR factor | factor
///   factor-> LPAREN expr RPAREN | NUM
let private exprGrammar: G.Grammar =
    { Id = "expr"
      Terminals =
        [ { Name = "PLUS"; Pattern = "\\+" }
          { Name = "STAR"; Pattern = "\\*" }
          { Name = "LPAREN"; Pattern = "\\(" }
          { Name = "RPAREN"; Pattern = "\\)" }
          { Name = "NUM"; Pattern = "[0-9]+" } ]
      NonTerminals = [ { Name = "expr" }; { Name = "term" }; { Name = "factor" } ]
      Productions =
        [ { Lhs = "expr"; Rhs = [ G.NonTerm "expr"; G.Term "PLUS"; G.NonTerm "term" ] }
          { Lhs = "expr"; Rhs = [ G.NonTerm "term" ] }
          { Lhs = "term"; Rhs = [ G.NonTerm "term"; G.Term "STAR"; G.NonTerm "factor" ] }
          { Lhs = "term"; Rhs = [ G.NonTerm "factor" ] }
          { Lhs = "factor"; Rhs = [ G.Term "LPAREN"; G.NonTerm "expr"; G.Term "RPAREN" ] }
          { Lhs = "factor"; Rhs = [ G.Term "NUM" ] } ]
      Start = "expr" }

[<Fact>]
let ``BIJECTION: a grammar round-trips Grammar -> DynamicValue -> Grammar`` () =
    match G.ofDynamicValue (G.toDynamicValue exprGrammar) with
    | Ok g -> Assert.Equal<G.Grammar>(exprGrammar, g)
    | Error e -> Assert.Fail(sprintf "round-trip failed: %s" e)

[<Fact>]
let ``CLOSURE: the expr grammar is closed (every word defined); a dangling reference is caught`` () =
    // "a properly written dictionary that has every word it uses defined by other words"
    // (Aaron 2026-07-02): the expr grammar references only symbols it defines ⇒ closed.
    Assert.True(G.isClosed exprGrammar)
    Assert.Empty(G.undefinedSymbols exprGrammar)
    // introduce an ungrounded word: a production referencing an undefined nonterminal `ghost`.
    let broken =
        { exprGrammar with
            Productions = exprGrammar.Productions @ [ { Lhs = "factor"; Rhs = [ G.NonTerm "ghost" ] } ] }
    Assert.False(G.isClosed broken)
    Assert.Contains(G.NonTerm "ghost", G.undefinedSymbols broken)

[<Fact>]
let ``RUNG 2 SERVES RUNG 3: the grammar-as-value-tree rides the codec stack (byte-lockable, DST-replayable)`` () =
    // A grammar is just data ⇒ it inherits every codec on the port. This is the whole point
    // of "the IR as a DynamicValue schema": a grammar byte-locks and DST-replays for free.
    let dv = G.toDynamicValue exprGrammar
    let codecs = [ VTC.parity VTC.json; VTC.cbor; VTC.parity VTC.asn1 ]
    Assert.Empty(VTC.crossVerify codecs dv)

[<Fact>]
let ``TOTAL PARSE: malformed grammar DynamicValue yields a clean Error, not an exception`` () =
    let bad: (string * DynamicValue) list =
        [ "not an object", DynamicValue.Int 1L
          "missing start", DynamicValue.Object [ "id", DynamicValue.String "g"; "terminals", DynamicValue.Array []; "nonterminals", DynamicValue.Array []; "productions", DynamicValue.Array [] ]
          "terminal missing pattern", G.toDynamicValue { exprGrammar with Terminals = [ { Name = "X"; Pattern = "y" } ] } |> fun _ -> DynamicValue.Object [ "id", DynamicValue.String "g"; "terminals", DynamicValue.Array [ DynamicValue.Object [ "name", DynamicValue.String "X" ] ]; "nonterminals", DynamicValue.Array []; "productions", DynamicValue.Array []; "start", DynamicValue.String "X" ]
          "bad symbol kind", DynamicValue.Object [ "id", DynamicValue.String "g"; "terminals", DynamicValue.Array []; "nonterminals", DynamicValue.Array []; "productions", DynamicValue.Array [ DynamicValue.Object [ "lhs", DynamicValue.String "a"; "rhs", DynamicValue.Array [ DynamicValue.Object [ "k", DynamicValue.String "z"; "n", DynamicValue.String "x" ] ] ] ]; "start", DynamicValue.String "a" ] ]
    for (name, dv) in bad do
        Assert.True(
            (match G.ofDynamicValue dv with
             | Error _ -> true
             | Ok _ -> false),
            sprintf "malformed input '%s' must be rejected" name
        )
