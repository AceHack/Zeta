module Zeta.Tests.GrammarLadderTests

// THE FULL PARSER/GENERATOR LADDER, END TO END on a real config grammar (shadow*, Aaron
// 2026-07-02 "no pivot just continue" → retire the KDL fork). One integration test of the
// whole spine:
//
//   real .g4  →  Antlr4Import.ingest  →  GrammarIr (a DynamicValue, closed, byte-lockable)
//             →  Slr.buildGlr        →  Slr.glrParse  →  accept / reject
//
// KDL is used because it is CFG-friendly (designed to be simple) AND its document grammar is
// genuinely AMBIGUOUS (`node ID` = a node with an ID argument, OR two adjacent nodes) — so it
// exercises the GLR fork, not just SLR. (YAML is deliberately NOT used: it is indentation-
// sensitive, hence not context-free, so an LR/GLR grammar needs an INDENT/DEDENT lexer pass
// first — recorded as an honest limitation, not forced through the CFG path.)
//
// Anchors: kdl.dev (the KDL grammar); Tomita (GLR handles the ambiguity); ZetaParse (Amara);
// grammars-v4 (the corpus this stands in for).

open global.Xunit
open Zeta.Core

module A = Antlr4Import
module G = GrammarIr

/// A faithful KDL-subset grammar: a document is nodes; a node is an identifier with entries
/// (args or `key=value` properties) and an optional `{ … }` child block.
let private kdlG4 =
    """
grammar Kdl;
doc   : node* ;
node  : ID entry* block? ;
entry : value | ID EQ value ;
block : LBRACE node* RBRACE ;
value : STRING | NUMBER | ID ;
ID     : [a-zA-Z_] [a-zA-Z0-9_-]* ;
STRING : '"' ~["]* '"' ;
NUMBER : '-'? [0-9]+ ;
EQ     : '=' ;
LBRACE : '{' ;
RBRACE : '}' ;
"""

[<Fact>]
let ``LADDER END-TO-END: a real KDL grammar ingests → GLR → parses KDL documents (accept/reject)`` () =
    match A.ingest "kdl" kdlG4 with
    | Ok ing ->
        // rung 3 invariants: the ingested grammar is closed and byte-locks (it is a DynamicValue)
        Assert.True(G.isClosed ing.Grammar, sprintf "KDL grammar must be closed; undefined: %A" (G.undefinedSymbols ing.Grammar))
        match Slr.buildGlr ing.Grammar with
        | Ok t ->
            // `node 1`  →  ID NUMBER            (a node with a numeric arg)
            Assert.True(Slr.glrParse t [ "ID"; "NUMBER" ])
            // `node key="x"`  →  ID ID EQ STRING (a node with a property)
            Assert.True(Slr.glrParse t [ "ID"; "ID"; "EQ"; "STRING" ])
            // `parent { child 2 }`  →  ID LBRACE ID NUMBER RBRACE (a child block)
            Assert.True(Slr.glrParse t [ "ID"; "LBRACE"; "ID"; "NUMBER"; "RBRACE" ])
            // two nodes `a b` — ambiguous (arg vs two nodes); GLR still finds a parse
            Assert.True(Slr.glrParse t [ "ID"; "ID" ])
            // empty document is valid (doc : node* )
            Assert.True(Slr.glrParse t [])
            // invalid: an unmatched brace / dangling '='
            Assert.False(Slr.glrParse t [ "LBRACE"; "ID" ])
            Assert.False(Slr.glrParse t [ "ID"; "EQ" ])
            Assert.False(Slr.glrParse t [ "EQ"; "ID" ])
        | Error e -> Assert.Fail(sprintf "GLR build failed: %s" e)
    | Error e -> Assert.Fail(sprintf "KDL ingest failed: %s" e)
