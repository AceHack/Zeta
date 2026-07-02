module Zeta.Tests.Antlr4ImportTests

// INGEST ANTLR .g4 → ZETA GRAMMAR IR, with EBNF DESUGARED to BNF (rung 3) — shadow*,
// Aaron 2026-07-02: "compile to/from our IR and most other ANTLR grammars"; recommended
// default "desugar to BNF". EBNF operators (* + ? and groups) are desugared to helper
// nonterminals; only semantic actions / predicates / wildcards are skipped + logged. Proofs:
//   1. INGEST + DESUGAR — a grammar full of EBNF ingests; the EBNF is NOT skipped.
//   2. CLOSURE IS PRESERVED — the desugared grammar is `isClosed` (every helper nonterminal a
//      * / ? / (…) generates is itself defined). This is the strongest desugar-correctness signal.
//   3. ACTIONS still skipped + logged (pure-grammar-first), while EBNF is not.
//   4. RIDES THE LADDER — the grammar rides the codec stack and round-trips the IR.
//   5. DETERMINISM — same .g4 → identical grammar (helper names are `rule_gN`, not GetHashCode).
//   6. TOTAL — malformed / hostile .g4 never throws.
//
// Anchors: ZetaParse (Amara); Knuth/Tomita (LR/GLR want BNF); antlr/grammars-v4 (MIT/BSD).

open global.Xunit
open Zeta.Core

module A = Antlr4Import
module G = GrammarIr
module VTC = ValueTreeCodec

/// A grammar exercising every EBNF form: `*`, `?`, `(… | …)` groups, plus an action to skip.
let private g4 =
    """
grammar Expr;
prog : stat* ;
stat : expr ';' ;
expr : term (('+' | '-') term)* ;
term : atom ('*' atom)? ;
atom : NUM | '(' expr ')' ;
act  : NUM { doStuff(); } ;   // action must be skipped + logged
NUM  : [0-9]+ ;
"""

[<Fact>]
let ``INGEST + DESUGAR: a grammar full of EBNF ingests; the EBNF is desugared, not skipped`` () =
    match A.ingest "expr" g4 with
    | Ok ing ->
        Assert.Equal("prog", ing.Grammar.Start)
        // desugaring emits helper nonterminals (rule_gN) for * / ? / groups
        let ntNames = ing.Grammar.NonTerminals |> List.map (fun nt -> nt.Name)
        Assert.Contains("prog", ntNames)
        Assert.True(ntNames |> List.exists (fun n -> n.Contains "_g"), "desugaring must emit helper nonterminals")
        // no EBNF-skip diagnostics (EBNF is desugared); NUM terminal present
        Assert.False(ing.Skipped |> List.exists (fun s -> s.Contains "EBNF"))
        Assert.Contains("NUM", ing.Grammar.Terminals |> List.map (fun t -> t.Name))
    | Error e -> Assert.Fail(sprintf "ingest failed: %s" e)

[<Fact>]
let ``CLOSURE PRESERVED: the desugared grammar is closed — every generated helper is defined`` () =
    // The strongest desugar-correctness signal: if any * / ? / (…) left a dangling helper
    // nonterminal, closure would fail. (NUM is defined; synthesised literal terminals too.)
    match A.ingest "expr" g4 with
    | Ok ing ->
        let undef = G.undefinedSymbols ing.Grammar
        Assert.True(G.isClosed ing.Grammar, sprintf "grammar must be closed; undefined: %A" undef)
    | Error e -> Assert.Fail(sprintf "ingest failed: %s" e)

[<Fact>]
let ``ACTIONS still skipped + logged (EBNF is not): pure-grammar-first`` () =
    match A.ingest "expr" g4 with
    | Ok ing ->
        Assert.True(ing.Skipped |> List.exists (fun s -> s.Contains "action"), "the { } action must be logged as skipped")
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
    match A.ingest "expr" g4, A.ingest "expr" g4 with
    | Ok a, Ok b -> Assert.Equal(G.toDynamicValue a.Grammar, G.toDynamicValue b.Grammar)
    | _ -> Assert.Fail "ingest should succeed twice"

/// The canonical JSON grammar (grammars-v4 shape) — a REAL grammar, EBNF-heavy.
let private jsonG4 =
    """
grammar JSON;
json  : value ;
value : STRING | NUMBER | obj | arr | 'true' | 'false' | 'null' ;
obj   : '{' pair (',' pair)* '}' | '{' '}' ;
pair  : STRING ':' value ;
arr   : '[' value (',' value)* ']' | '[' ']' ;
STRING : '"' (ESC | SAFECODEPOINT)* '"' ;
NUMBER : '-'? INT ;
INT    : '0' | [1-9] [0-9]* ;
"""

[<Fact>]
let ``MILESTONE: a real JSON grammar fully ingests and stays CLOSED (EBNF desugared end-to-end)`` () =
    match A.ingest "json" jsonG4 with
    | Ok ing ->
        Assert.Equal("json", ing.Grammar.Start)
        Assert.True(
            G.isClosed ing.Grammar,
            sprintf "JSON grammar must be closed; undefined: %A" (G.undefinedSymbols ing.Grammar)
        )
        let terms = ing.Grammar.Terminals |> List.map (fun t -> t.Name)
        Assert.Contains("STRING", terms)
        Assert.Contains("NUMBER", terms)
        Assert.Empty(VTC.crossVerify [ VTC.parity VTC.json; VTC.cbor ] (G.toDynamicValue ing.Grammar))
    | Error e -> Assert.Fail(sprintf "JSON ingest failed: %s" e)

[<Fact>]
let ``TOTAL: malformed / hostile .g4 never throws — clean Error or logged skips`` () =
    let hostile =
        [ ""
          "grammar X;"
          ":::;;;"
          "A : 'unterminated"
          "rule : /* unterminated comment"
          "x : ( ( ( nested unclosed groups"
          "y : a b )))) unbalanced"
          "z : x* * * ? ? ("
          System.String('(', 500)
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
