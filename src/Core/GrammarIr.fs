namespace Zeta.Core

/// **GrammarIr — the Zeta Grammar IR as a `DynamicValue` schema (rung 3, bounded first step).**
/// (Aaron 2026-07-02, shadow*: "we can do the first steps … compile to/from our IR and most
/// other ANTLR grammars using our parser generators and the open free ANTLR grammars.")
///
/// The parser/generator ladder's rung 3 (docs/research/2026-07-02-parser-generator-foundation-
/// ladder-…): a grammar is INGESTED into a neutral **Grammar IR**, then a parser is generated
/// from it. This module lands the IR's structural core AS A VALUE TREE — a `Grammar ⇄
/// DynamicValue` bijection — so a grammar is **just data**: it rides the rung-2 codecs
/// (JSON/CBOR/DER/…), is byte-lockable and DST-replayable, and schema-evolves like any other
/// value tree. Rung 2 serves rung 3.
///
/// The types mirror the ZetaParse design (docs/research/zetaparse-lr-glr-fsharp-compiler-fork-
/// design-2026-05-21.md, Amara) — `Terminal` / `NonTerminal` / `Production` / `Grammar`. This
/// first step models the STRUCTURAL core (terminals, nonterminals, productions, start); the
/// advanced fields ZetaParse also lists — semantic actions, precedence/associativity,
/// attributes, recovery rules, incremental/retraction hooks — are DEFERRED to a v2 schema pass
/// (a design decision to make with Aaron), added later as optional fields (the versioned,
/// zero-downtime-rollable discipline the value-tree envelope already established).
///
/// Anchors: ZetaParse (Amara); Knuth (LR), Tomita (GLR), Parr (ANTLR); `antlr/grammars-v4`
/// (MIT/BSD corpus — ingest, don't reinvent).
[<RequireQualifiedAccess>]
module GrammarIr =

    /// A symbol in a production's right-hand side: a reference (by name) to a terminal or a
    /// nonterminal. (Names, not inline defs — the definitions live in the grammar's tables.)
    type Symbol =
        | Term of string
        | NonTerm of string

    /// A terminal (token): a name and its pattern (a literal or regex string in v1 — a
    /// structured `TokenPattern` is a v2 extension).
    type Terminal = { Name: string; Pattern: string }

    /// A nonterminal: a name (parameters/attributes are v2 extensions).
    type NonTerminal = { Name: string }

    /// A production `lhs -> rhs...` (precedence/semantic-action are v2 extensions).
    type Production = { Lhs: string; Rhs: Symbol list }

    /// A neutral grammar: the convergence point every importer (`.g4` / `.y` / `.zg`) targets.
    type Grammar =
        { Id: string
          Terminals: Terminal list
          NonTerminals: NonTerminal list
          Productions: Production list
          Start: string }

    // ── Grammar → DynamicValue ──

    let private symbolToDv (s: Symbol) : DynamicValue =
        match s with
        | Term n -> DynamicValue.Object [ "k", DynamicValue.String "t"; "n", DynamicValue.String n ]
        | NonTerm n -> DynamicValue.Object [ "k", DynamicValue.String "n"; "n", DynamicValue.String n ]

    let private terminalToDv (t: Terminal) : DynamicValue =
        DynamicValue.Object [ "name", DynamicValue.String t.Name; "pattern", DynamicValue.String t.Pattern ]

    let private productionToDv (p: Production) : DynamicValue =
        DynamicValue.Object
            [ "lhs", DynamicValue.String p.Lhs
              "rhs", DynamicValue.Array(p.Rhs |> List.map symbolToDv) ]

    /// The grammar as a `DynamicValue` value tree — the substrate form (byte-lockable,
    /// DST-replayable, riding every rung-2 codec).
    let toDynamicValue (g: Grammar) : DynamicValue =
        DynamicValue.Object
            [ "id", DynamicValue.String g.Id
              "terminals", DynamicValue.Array(g.Terminals |> List.map terminalToDv)
              "nonterminals", DynamicValue.Array(g.NonTerminals |> List.map (fun nt -> DynamicValue.String nt.Name))
              "productions", DynamicValue.Array(g.Productions |> List.map productionToDv)
              "start", DynamicValue.String g.Start ]

    // ── Closure ("the dictionary defines all its own words") ──

    /// The **closure** check (Aaron 2026-07-02: the homoiconic meta-grammar is "english itself
    /// as its own grammar … a properly written dictionary that has every word it uses defined
    /// by other words"). Every symbol referenced in a production RHS must be DEFINED within the
    /// grammar: a nonterminal by having at least one production; a terminal by being in the
    /// terminals table. Returns the referenced-but-undefined symbols (`start` included as a
    /// reference). Empty ⇒ the grammar is CLOSED / self-contained — the first machine-checkable
    /// step toward the math team's provably-homoiconic meta-grammar (no ungrounded word).
    let undefinedSymbols (g: Grammar) : Symbol list =
        let definedTerms = g.Terminals |> List.map (fun t -> t.Name) |> Set.ofList
        let definedNonTerms = g.Productions |> List.map (fun p -> p.Lhs) |> Set.ofList
        let referenced =
            (if System.String.IsNullOrEmpty g.Start then [] else [ NonTerm g.Start ])
            @ (g.Productions |> List.collect (fun p -> p.Rhs))
        referenced
        |> List.filter (fun s ->
            match s with
            | Term n -> not (definedTerms.Contains n)
            | NonTerm n -> not (definedNonTerms.Contains n))
        |> List.distinct

    /// A grammar is CLOSED when every referenced symbol is defined (no ungrounded word).
    let isClosed (g: Grammar) : bool = List.isEmpty (undefinedSymbols g)

    // ── DynamicValue → Grammar (total; malformed input ⇒ Error, never an exception) ──

    let private reqStr (key: string) (dv: DynamicValue) : Result<string, string> =
        match DynamicValue.tryField key dv with
        | Some(DynamicValue.String s) -> Ok s
        | _ -> Error(sprintf "grammar-ir: missing/invalid string field '%s'" key)

    let private reqArr (key: string) (dv: DynamicValue) : Result<DynamicValue list, string> =
        match DynamicValue.tryField key dv with
        | Some(DynamicValue.Array xs) -> Ok xs
        | _ -> Error(sprintf "grammar-ir: missing/invalid array field '%s'" key)

    let private mapR (f: 'a -> Result<'b, string>) (xs: 'a list) : Result<'b list, string> =
        (Ok [], xs)
        ||> List.fold (fun acc x -> acc |> Result.bind (fun ys -> f x |> Result.map (fun y -> ys @ [ y ])))

    let private symbolOfDv (dv: DynamicValue) : Result<Symbol, string> =
        match reqStr "k" dv, reqStr "n" dv with
        | Ok "t", Ok n -> Ok(Term n)
        | Ok "n", Ok n -> Ok(NonTerm n)
        | Ok other, _ -> Error(sprintf "grammar-ir: unknown symbol kind '%s'" other)
        | Error e, _ -> Error e

    let private terminalOfDv (dv: DynamicValue) : Result<Terminal, string> =
        match reqStr "name" dv, reqStr "pattern" dv with
        | Ok name, Ok pattern -> Ok { Name = name; Pattern = pattern }
        | Error e, _
        | _, Error e -> Error e

    let private productionOfDv (dv: DynamicValue) : Result<Production, string> =
        reqStr "lhs" dv
        |> Result.bind (fun lhs -> reqArr "rhs" dv |> Result.bind (mapR symbolOfDv) |> Result.map (fun rhs -> { Lhs = lhs; Rhs = rhs }))

    let private nonTerminalOfDv (dv: DynamicValue) : Result<NonTerminal, string> =
        match dv with
        | DynamicValue.String n -> Ok { Name = n }
        | _ -> Error "grammar-ir: nonterminal must be a String name"

    /// Parse a `DynamicValue` back into a `Grammar`. Total — malformed input yields `Error`.
    let ofDynamicValue (dv: DynamicValue) : Result<Grammar, string> =
        reqStr "id" dv
        |> Result.bind (fun id ->
            reqArr "terminals" dv
            |> Result.bind (mapR terminalOfDv)
            |> Result.bind (fun terminals ->
                reqArr "nonterminals" dv
                |> Result.bind (mapR nonTerminalOfDv)
                |> Result.bind (fun nonterminals ->
                    reqArr "productions" dv
                    |> Result.bind (mapR productionOfDv)
                    |> Result.bind (fun productions ->
                        reqStr "start" dv
                        |> Result.map (fun start ->
                            { Id = id
                              Terminals = terminals
                              NonTerminals = nonterminals
                              Productions = productions
                              Start = start })))))
