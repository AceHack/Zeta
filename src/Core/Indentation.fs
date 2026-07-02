namespace Zeta.Core

open System

/// **Indentation — the off-side-rule layout pass (INDENT/DEDENT/NEWLINE).**
/// (Aaron 2026-07-02, shadow*: "no pivot just continue" — the honest YAML follow-up.)
///
/// Indentation-sensitive languages (YAML, Python, Haskell's layout) are NOT context-free, so an
/// LR/GLR grammar cannot consume them directly. The standard fix (Landin's off-side rule; the
/// Python tokenizer) is a LEXER pass that turns leading whitespace into explicit **INDENT** /
/// **DEDENT** / **NEWLINE** tokens — after which the token stream *is* context-free and the
/// `Slr`/GLR backend parses it. This module is that pass: `layout source` → a flat token stream
/// with the markers inserted, ready to feed a grammar whose terminals include INDENT/DEDENT/NEWLINE.
///
/// An indentation stack tracks the current column; a deeper line pushes (emit INDENT), a
/// shallower line pops to a matching level (emit DEDENT each pop) — a dedent to a column not on
/// the stack is an `Error` (inconsistent dedent). Blank / whitespace-only lines are skipped;
/// leading TABs in indentation are an `Error` (the classic tabs-vs-spaces hazard — refuse, don't
/// guess). At EOF every open indent is closed with a DEDENT. Deterministic ⇒ DST/byte-lock clean.
///
/// Anchors: Peter Landin (*The Next 700 Programming Languages*, 1966 — the off-side rule); the
/// Python reference tokenizer (INDENT/DEDENT). Feeds `Slr` / `Antlr4Import` (the parser ladder).
[<RequireQualifiedAccess>]
module Indentation =

    [<Literal>]
    let indent = "INDENT"

    [<Literal>]
    let dedent = "DEDENT"

    [<Literal>]
    let newline = "NEWLINE"

    let private leadingSpaces (line: string) : Result<int, string> =
        let mutable i = 0
        let mutable tab = false
        while i < line.Length && (line.[i] = ' ' || line.[i] = '\t') do
            if line.[i] = '\t' then tab <- true
            i <- i + 1
        if tab then Error "indentation: TAB in leading whitespace (tabs-vs-spaces hazard — use spaces)"
        else Ok i

    /// Layout `source` into a token stream with INDENT/DEDENT/NEWLINE markers. Content words on a
    /// line (whitespace-separated) pass through verbatim between the markers. Total: never throws;
    /// an inconsistent dedent or a leading tab yields `Error`.
    let layout (source: string) : Result<string list, string> =
        let lines = source.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n')
        let out = System.Collections.Generic.List<string>()
        let mutable stack = [ 0 ] // indentation columns; head = current
        let mutable err: string option = None
        let mutable li = 0
        while li < lines.Length && err.IsNone do
            let line = lines.[li]
            if String.IsNullOrWhiteSpace line then
                () // blank line — no tokens
            else
                match leadingSpaces line with
                | Error e -> err <- Some e
                | Ok col ->
                    let top = List.head stack
                    if col > top then
                        stack <- col :: stack
                        out.Add indent
                    elif col < top then
                        // pop until we match a column on the stack
                        let mutable go = true
                        while go && err.IsNone do
                            match stack with
                            | t :: rest when t > col ->
                                stack <- rest
                                out.Add dedent
                            | t :: _ when t = col -> go <- false
                            | _ ->
                                err <- Some(sprintf "indentation: inconsistent dedent to column %d" col)
                                go <- false
                    // content words, then NEWLINE
                    if err.IsNone then
                        for w in line.Trim().Split([| ' '; '\t' |], StringSplitOptions.RemoveEmptyEntries) do
                            out.Add w
                        out.Add newline
            li <- li + 1
        match err with
        | Some e -> Error e
        | None ->
            // close all open indents at EOF
            while List.head stack > 0 do
                out.Add dedent
                stack <- List.tail stack
            Ok(out |> List.ofSeq)
