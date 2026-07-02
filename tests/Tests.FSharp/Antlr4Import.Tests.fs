module Zeta.Tests.Antlr4ImportTests

// INGEST ANTLR .g4 → ZETA GRAMMAR IR (rung 3, step 2) — shadow*, Aaron 2026-07-02:
// "compile to/from our IR and most other ANTLR grammars … small changes to existing ANTLR
// grammars is fine." Don't RUN ANTLR — ingest the compatible (BNF) subset; skip + LOG the
// rest (no silent truncation). Proofs:
//   1. INGEST — a small BNF .g4 yields the expected terminals / productions / start.
//   2. NO SILENT TRUNCATION — an EBNF rule is SKIPPED and LOGGED (surfaced in Ingest.Skipped).
//   3. RIDES THE LADDER — the ingested grammar → DynamicValue rides the codec stack and
//      round-trips through GrammarIr (ingest feeds rung-2 byte-lock/DST-replay).
//   4. TOTAL — malformed / hostile .g4 yields a clean Error or logged skips, never an exception.
//
// Anchors: ZetaParse (Amara, "normalise the compatible subset"); antlr/grammars-v4 (MIT/BSD).

open global.Xunit
open Zeta.Core

module A = Antlr4Import
module G = GrammarIr
module VTC = ValueTreeCodec

/// A small BNF-subset grammar (arithmetic), plus one EBNF rule that must be skipped+logged.
let private g4 =
    """
grammar Expr;
// a comment — must be stripped
expr : expr PLUS term | term ;
term : term STAR factor | factor ;
factor : NUM ;
list : expr (',' expr)* ;   /* EBNF — must be skipped + logged */
PLUS : '+' ;
STAR : '*' ;
NUM  : [0-9]+ ;
"""

[<Fact>]
let ``INGEST: a BNF .g4 yields the expected terminals, productions, and start symbol`` () =
    match A.ingest "expr" g4 with
    | Ok ing ->
        let g = ing.Grammar
        Assert.Equal("expr", g.Start) // first parser rule
        let termNames = g.Terminals |> List.map (fun t -> t.Name)
        Assert.Contains("PLUS", termNames)
        Assert.Contains("STAR", termNames)
        Assert.Contains("NUM", termNames)
        let ntNames = g.NonTerminals |> List.map (fun nt -> nt.Name)
        Assert.Contains("expr", ntNames)
        Assert.Contains("factor", ntNames)
        // expr(2) + term(2) + factor(1) = 5 productions (list is skipped)
        Assert.Equal(5, List.length g.Productions)
    | Error e -> Assert.Fail(sprintf "ingest failed: %s" e)

[<Fact>]
let ``NO SILENT TRUNCATION: the EBNF rule is skipped AND logged`` () =
    match A.ingest "expr" g4 with
    | Ok ing ->
        Assert.NotEmpty(ing.Skipped)
        Assert.True(ing.Skipped |> List.exists (fun s -> s.Contains "list"), "the EBNF rule 'list' must be logged as skipped")
        // and it must NOT have leaked into the grammar
        Assert.False(ing.Grammar.NonTerminals |> List.exists (fun nt -> nt.Name = "list"))
    | Error e -> Assert.Fail(sprintf "ingest failed: %s" e)

[<Fact>]
let ``RIDES THE LADDER: the ingested grammar rides the codec stack and round-trips through GrammarIr`` () =
    match A.ingest "expr" g4 with
    | Ok ing ->
        let dv = G.toDynamicValue ing.Grammar
        Assert.Empty(VTC.crossVerify [ VTC.parity VTC.json; VTC.cbor; VTC.parity VTC.asn1 ] dv)
        match G.ofDynamicValue dv with
        | Ok g -> Assert.Equal<G.Grammar>(ing.Grammar, g)
        | Error e -> Assert.Fail(sprintf "grammar round-trip failed: %s" e)
    | Error e -> Assert.Fail(sprintf "ingest failed: %s" e)

[<Fact>]
let ``DETERMINISM: ingesting the same .g4 twice yields identical grammars (byte-lockable)`` () =
    // synthesised literal-terminal names must be deterministic (hex of bytes, not GetHashCode).
    let withLit = "grammar L; stmt : 'begin' expr 'end' ; expr : NUM ; NUM : [0-9]+ ;"
    match A.ingest "L" withLit, A.ingest "L" withLit with
    | Ok a, Ok b -> Assert.Equal(G.toDynamicValue a.Grammar, G.toDynamicValue b.Grammar)
    | _ -> Assert.Fail "ingest should succeed on a literal-bearing grammar"

[<Fact>]
let ``TOTAL: malformed / hostile .g4 never throws — clean Error or logged skips`` () =
    let hostile =
        [ ""
          "grammar X;"
          ":::;;;"
          "A : 'unterminated"
          "rule : /* unterminated comment"
          "x : [unterminated class"
          "grammar X; a : ( ( ( nested"
          System.String('{', 500) ]
    for g in hostile do
        let ok =
            try
                match A.ingest "h" g with
                | Ok _
                | Error _ -> true
            with ex ->
                Assert.Fail(sprintf "ingest THREW on %A: %s" (g.Substring(0, min 20 g.Length)) ex.Message)
                false
        Assert.True ok
