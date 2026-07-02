namespace Zeta.Core

open System
open System.Text

/// **Antlr4Import — ingest an ANTLR `.g4` grammar into the Zeta Grammar IR (rung 3, step 2).**
/// (Aaron 2026-07-02, shadow*: "compile to/from our IR and most other ANTLR grammars … small
/// changes to existing ANTLR grammars is fine"; "we can do the first steps.")
///
/// The parser/generator ladder rung 3: don't RUN ANTLR — INGEST it. This module reads the
/// **compatible (BNF) subset** of `.g4` into `GrammarIr.Grammar`, exactly ZetaParse's
/// "normalise the compatible subset" stance. What is NOT in the subset — EBNF operators
/// (`* + ? ( )`), `{…}` action blocks, semantic predicates, modes, options — is **skipped and
/// LOGGED** (`Ingest.Skipped`), never silently dropped (no-silent-truncation). Full EBNF
/// support is the next design fork (how the neutral IR represents EBNF — carry it, or desugar
/// to BNF — a decision for Aaron).
///
/// Total on all input: a malformed `.g4` yields an `Error`, never an exception (the same
/// hostile-input discipline as `Asn1Der.decode`).
///
/// Lexer rules (UPPERCASE-initial name) → `Terminal { Name; Pattern = raw body }` (the pattern
/// is kept verbatim — we do not parse the regex here). Parser rules (lowercase-initial) → one
/// `Production` per top-level `|` alternative; `'literal'` tokens synthesise an implicit
/// terminal. Corpus: `antlr/grammars-v4` (MIT/BSD — ingest, don't reinvent).
///
/// Docs: docs/research/2026-07-02-parser-generator-foundation-ladder-…; ZetaParse (Amara).
[<RequireQualifiedAccess>]
module Antlr4Import =

    /// The result of ingesting a `.g4`: the compatible-subset grammar + a log of every rule or
    /// construct skipped (with the reason) — surfaced, never silent.
    type Ingest =
        { Grammar: GrammarIr.Grammar
          Skipped: string list }

    let private ord = StringComparison.Ordinal

    /// Strip `//` line and `/* */` block comments, respecting `'…'` strings and `[…]` char
    /// classes so a `//` inside a literal is not mistaken for a comment.
    let private stripComments (s: string) : string =
        let sb = StringBuilder(s.Length)
        let mutable i = 0
        let n = s.Length
        let mutable inStr = false
        let mutable inCls = false
        while i < n do
            let c = s.[i]
            let nxt = if i + 1 < n then s.[i + 1] else '\000'
            if inStr then
                sb.Append c |> ignore
                if c = '\\' && i + 1 < n then
                    sb.Append nxt |> ignore
                    i <- i + 2
                else
                    if c = '\'' then inStr <- false
                    i <- i + 1
            elif inCls then
                sb.Append c |> ignore
                if c = '\\' && i + 1 < n then
                    sb.Append nxt |> ignore
                    i <- i + 2
                else
                    if c = ']' then inCls <- false
                    i <- i + 1
            elif c = '\'' then
                inStr <- true
                sb.Append c |> ignore
                i <- i + 1
            elif c = '[' then
                inCls <- true
                sb.Append c |> ignore
                i <- i + 1
            elif c = '/' && nxt = '/' then
                while i < n && s.[i] <> '\n' do
                    i <- i + 1
            elif c = '/' && nxt = '*' then
                i <- i + 2
                while i + 1 < n && not (s.[i] = '*' && s.[i + 1] = '/') do
                    i <- i + 1
                i <- i + 2
            else
                sb.Append c |> ignore
                i <- i + 1
        sb.ToString()

    /// Split the grammar body into rule strings on top-level `;` (respecting `'…'`, `[…]`,
    /// `{…}` actions, and `(…)` groups so an inner `;` does not split a rule).
    let private splitRules (s: string) : string list =
        let rules = ResizeArray<string>()
        let sb = StringBuilder()
        let mutable inStr = false
        let mutable inCls = false
        let mutable brace = 0
        let mutable paren = 0
        let mutable i = 0
        let n = s.Length
        while i < n do
            let c = s.[i]
            if inStr then
                sb.Append c |> ignore
                if c = '\\' && i + 1 < n then
                    sb.Append s.[i + 1] |> ignore
                    i <- i + 1
                elif c = '\'' then
                    inStr <- false
                sb |> ignore
                i <- i + 1
            elif inCls then
                sb.Append c |> ignore
                if c = ']' then inCls <- false
                i <- i + 1
            else
                match c with
                | '\'' ->
                    inStr <- true
                    sb.Append c |> ignore
                | '[' ->
                    inCls <- true
                    sb.Append c |> ignore
                | '{' ->
                    brace <- brace + 1
                    sb.Append c |> ignore
                | '}' ->
                    brace <- max 0 (brace - 1)
                    sb.Append c |> ignore
                | '(' ->
                    paren <- paren + 1
                    sb.Append c |> ignore
                | ')' ->
                    paren <- max 0 (paren - 1)
                    sb.Append c |> ignore
                | ';' when brace = 0 && paren = 0 ->
                    rules.Add(sb.ToString())
                    sb.Clear() |> ignore
                | _ -> sb.Append c |> ignore
                i <- i + 1
        // trailing text with no terminating ';' is incomplete — surface as its own chunk
        let tail = sb.ToString()
        if not (String.IsNullOrWhiteSpace tail) then
            rules.Add tail
        rules |> List.ofSeq

    let private isIdentStart (c: char) = Char.IsLetter c || c = '_'
    let private ebnfOrAction (s: string) : bool =
        s.IndexOfAny([| '*'; '+'; '?'; '('; ')'; '{'; '<'; '~'; '.' |]) >= 0

    /// A parser-rule alternative → a symbol list. Tokens are identifiers (refs) or `'literals'`
    /// (implicit terminals, accumulated in `lits`).
    let private parseAlt (alt: string) (lits: ResizeArray<string * string>) : GrammarIr.Symbol list =
        let syms = ResizeArray<GrammarIr.Symbol>()
        let mutable i = 0
        let n = alt.Length
        while i < n do
            let c = alt.[i]
            if Char.IsWhiteSpace c then
                i <- i + 1
            elif c = '\'' then
                let sb = StringBuilder()
                i <- i + 1
                while i < n && alt.[i] <> '\'' do
                    if alt.[i] = '\\' && i + 1 < n then
                        sb.Append(alt.[i]).Append(alt.[i + 1]) |> ignore
                        i <- i + 2
                    else
                        sb.Append alt.[i] |> ignore
                        i <- i + 1
                i <- i + 1 // closing quote
                let lit = sb.ToString()
                // deterministic name (NOT GetHashCode — string hashes are per-process randomised,
                // which would break DST determinism + byte-lock): hex of the literal's UTF-8 bytes.
                let name = "LIT_" + Convert.ToHexString(Encoding.UTF8.GetBytes lit)
                lits.Add(name, lit)
                syms.Add(GrammarIr.Term name)
            elif isIdentStart c then
                let start = i
                while i < n && (Char.IsLetterOrDigit alt.[i] || alt.[i] = '_') do
                    i <- i + 1
                let name = alt.Substring(start, i - start)
                if Char.IsUpper name.[0] then syms.Add(GrammarIr.Term name) else syms.Add(GrammarIr.NonTerm name)
            else
                i <- i + 1 // skip stray punctuation defensively
        syms |> List.ofSeq

    /// Split a parser-rule body on top-level `|` (respecting `'…'` and `[…]`).
    let private splitAlts (body: string) : string list =
        let alts = ResizeArray<string>()
        let sb = StringBuilder()
        let mutable inStr = false
        let mutable inCls = false
        let mutable i = 0
        let n = body.Length
        while i < n do
            let c = body.[i]
            if inStr then
                sb.Append c |> ignore
                if c = '\\' && i + 1 < n then
                    sb.Append body.[i + 1] |> ignore
                    i <- i + 1
                elif c = '\'' then
                    inStr <- false
                i <- i + 1
            elif inCls then
                sb.Append c |> ignore
                if c = ']' then inCls <- false
                i <- i + 1
            elif c = '\'' then
                inStr <- true
                sb.Append c |> ignore
                i <- i + 1
            elif c = '[' then
                inCls <- true
                sb.Append c |> ignore
                i <- i + 1
            elif c = '|' then
                alts.Add(sb.ToString())
                sb.Clear() |> ignore
                i <- i + 1
            else
                sb.Append c |> ignore
                i <- i + 1
        alts.Add(sb.ToString())
        alts |> List.ofSeq

    /// Ingest a `.g4` grammar string into the compatible-subset Grammar IR. `grammarId` names
    /// the resulting grammar. Total: malformed input yields `Error`, never an exception.
    let ingest (grammarId: string) (g4: string) : Result<Ingest, string> =
        try
            let body = stripComments g4
            let rules = splitRules body
            let terminals = ResizeArray<GrammarIr.Terminal>()
            let nonterminals = ResizeArray<string>()
            let productions = ResizeArray<GrammarIr.Production>()
            let lits = ResizeArray<string * string>()
            let skipped = ResizeArray<string>()
            let mutable start = ""
            for rule in rules do
                let colon = rule.IndexOf(':')
                let trimmed = rule.Trim()
                // ignore ANTLR preamble: grammar/lexer/parser header, options, import, @members, etc.
                if trimmed.StartsWith("grammar", ord) || trimmed.StartsWith("lexer", ord)
                   || trimmed.StartsWith("parser", ord) || trimmed.StartsWith("options", ord)
                   || trimmed.StartsWith("import", ord) || trimmed.StartsWith("@", ord)
                   || trimmed.StartsWith("tokens", ord) || String.IsNullOrWhiteSpace trimmed then
                    ()
                elif colon < 0 then
                    skipped.Add(sprintf "no ':' in rule chunk: %s" (trimmed.Substring(0, min 40 trimmed.Length)))
                else
                    let rawName = rule.Substring(0, colon).Trim()
                    // strip a leading 'fragment' modifier and any trailing 'options {...}'
                    let name =
                        let nm = if rawName.StartsWith("fragment ", ord) then rawName.Substring(9).Trim() else rawName
                        (nm.Split([| ' '; '\t'; '\n'; '\r' |], StringSplitOptions.RemoveEmptyEntries)
                         |> Array.tryHead
                         |> Option.defaultValue nm)
                    let ruleBody = rule.Substring(colon + 1).Trim()
                    if String.IsNullOrEmpty name || not (isIdentStart name.[0]) then
                        skipped.Add(sprintf "unparseable rule name: %s" rawName)
                    elif Char.IsUpper name.[0] then
                        // lexer rule → terminal; pattern kept raw (regex not parsed here)
                        terminals.Add({ Name = name; Pattern = ruleBody })
                    else
                        // parser rule → productions; only the BNF-compatible subset
                        if ebnfOrAction ruleBody then
                            skipped.Add(sprintf "parser rule '%s' uses EBNF/action/predicate (not in compatible subset)" name)
                        else
                            if not (nonterminals.Contains name) then
                                nonterminals.Add name
                            if start = "" then start <- name // first parser rule = start symbol
                            for alt in splitAlts ruleBody do
                                productions.Add({ Lhs = name; Rhs = parseAlt alt lits })
            // fold synthesised literal terminals (dedup by name)
            for (name, pat) in lits do
                if not (terminals |> Seq.exists (fun t -> String.Equals(t.Name, name, ord))) then
                    terminals.Add({ Name = name; Pattern = "'" + pat + "'" })
            if productions.Count = 0 && terminals.Count = 0 then
                Error "antlr4: no rules ingested (empty or entirely-unsupported grammar)"
            else
                Ok
                    { Grammar =
                        { Id = grammarId
                          Terminals = terminals |> List.ofSeq
                          NonTerminals = nonterminals |> List.ofSeq |> List.map (fun n -> { GrammarIr.NonTerminal.Name = n })
                          Productions = productions |> List.ofSeq
                          Start = start }
                      Skipped = skipped |> List.ofSeq }
        with ex ->
            Error(sprintf "antlr4: ingest failed: %s" ex.Message)
