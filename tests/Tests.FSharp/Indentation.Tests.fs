module Zeta.Tests.IndentationTests

// THE OFF-SIDE-RULE LAYOUT PASS (INDENT/DEDENT/NEWLINE) — shadow*, Aaron 2026-07-02
// "no pivot just continue" (the honest YAML follow-up). Indentation-sensitive source is not
// context-free; this lexer pass turns leading whitespace into explicit tokens, after which the
// GLR backend parses it. Proofs:
//   1. LAYOUT — nested indent/dedent, EOF unwind, blank lines skipped, produce the right markers.
//   2. ERRORS — inconsistent dedent and leading TAB are clean `Error`s (total, never throws).
//   3. BRIDGE (end-to-end) — indented SOURCE → layout → GLR-parse with a block grammar whose
//      terminals include INDENT/DEDENT/NEWLINE. The indentation→CFG bridge, whole.
//
// Anchors: Landin (off-side rule, 1966); the Python tokenizer; Tomita (GLR); ZetaParse (Amara).

open global.Xunit
open Zeta.Core

module I = Indentation

[<Fact>]
let ``LAYOUT: nested indent/dedent and EOF unwind produce the right marker stream`` () =
    match I.layout "a\n  b\n    c\nd\n" with
    | Ok toks ->
        Assert.Equal<string list>(
            [ "a"; "NEWLINE"; "INDENT"; "b"; "NEWLINE"; "INDENT"; "c"; "NEWLINE"; "DEDENT"; "DEDENT"; "d"; "NEWLINE" ],
            toks
        )
    | Error e -> Assert.Fail(sprintf "layout failed: %s" e)

[<Fact>]
let ``LAYOUT: blank lines are skipped; trailing indents close at EOF`` () =
    match I.layout "a\n\n  b\n\n" with
    | Ok toks -> Assert.Equal<string list>([ "a"; "NEWLINE"; "INDENT"; "b"; "NEWLINE"; "DEDENT" ], toks)
    | Error e -> Assert.Fail(sprintf "layout failed: %s" e)

[<Fact>]
let ``ERRORS: inconsistent dedent and leading TAB are clean Errors, never exceptions`` () =
    Assert.True(
        (match I.layout "a\n    b\n  c\n" with
         | Error _ -> true
         | Ok _ -> false)
    ) // dedent to column 2 which is not on the stack
    Assert.True(
        (match I.layout "\tfoo\n" with
         | Error _ -> true
         | Ok _ -> false)
    ) // leading tab
    // a well-formed doc still succeeds
    Assert.True(
        (match I.layout "x\n  y\n" with
         | Ok _ -> true
         | Error _ -> false)
    )

[<Fact>]
let ``BRIDGE end-to-end: indented source → layout → GLR parse with an INDENT/DEDENT grammar`` () =
    // A block grammar over NAME/NEWLINE/INDENT/DEDENT — the layout's own token vocabulary.
    let g4 =
        """
grammar Ind;
block : line+ ;
line  : NAME NEWLINE INDENT block DEDENT | NAME NEWLINE ;
NAME    : [a-z]+ ;
NEWLINE : 'nl' ;
INDENT  : 'i' ;
DEDENT  : 'd' ;
"""
    match Antlr4Import.ingest "ind" g4 with
    | Ok ing ->
        match Slr.buildGlr ing.Grammar with
        | Ok t ->
            // source words are literally "NAME" so the layout tokens match the grammar terminal.
            let parse src =
                match I.layout src with
                | Ok toks -> Slr.glrParse t toks
                | Error _ -> false
            // flat: two sibling lines
            Assert.True(parse "NAME\nNAME\n")
            // nested: a line with an indented child block
            Assert.True(parse "NAME\n  NAME\n")
            // deeper nesting
            Assert.True(parse "NAME\n  NAME\n    NAME\n")
            // empty source ⇒ no lines ⇒ block (line+) needs ≥1 line ⇒ reject
            Assert.False(parse "")
        | Error e -> Assert.Fail(sprintf "GLR build failed: %s" e)
    | Error e -> Assert.Fail(sprintf "ingest failed: %s" e)
