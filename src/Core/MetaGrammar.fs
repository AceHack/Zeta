namespace Zeta.Core

/// **MetaGrammar — the homoiconic meta-grammar kernel (the lvl-3 Futamura seed).**
/// (Aaron 2026-07-02, shadow*: "build the homoiconic meta-grammar kernel"; earlier: "our meta
/// grammar should be homoiconic … english itself as its own grammar, like a properly written
/// dictionary that has every word it uses defined by other words".)
///
/// A **meta-grammar** is a grammar whose language is the set of grammar *descriptions*. This kernel
/// is that grammar, written in the neutral `GrammarIr`, together with the two arrows that close the
/// loop: `emit : Grammar → notation text` and `reify : parse-tree → Grammar`. The payoff is the
/// **homoiconic fixpoint** — the parser BUILT FROM the kernel parses the kernel's OWN emitted text,
/// and reifying that parse recovers the kernel:
///
///     reify (parse (build kernel) (tokenize (emit kernel)))  ≅  kernel
///
/// This is the missing piece for the **3rd Futamura projection** (`gen(gen) == gen`): the
/// specializer (the grammar that describes grammars) is expressed IN the same IR it consumes, so it
/// can be applied to its own description. More generally `reify ∘ parse(build kernel) ∘ emit = id`
/// on *every* grammar — feed the notation of any grammar `g` through the meta-parser and get `g`
/// back; the self-application (`g = kernel`) is the cogen seed.
///
/// **The dictionary discipline** (only-the-irreducible-is-primitive): a *word is defined iff it has
/// a rule* (a dictionary entry). Names that never appear as a rule LHS are the **irreducible
/// primitives** — the terminals. So terminal-vs-nonterminal is not lexical; it is resolved by
/// dictionary membership, exactly "every word defined by other words, bottoming out at primitives".
///
/// **Notation** (four structural marks `:` `|` `;` plus bare identifier words):
///
///     grammar  : rulelist ;
///     rulelist : rulelist rule | rule ;
///     rule     : NAME COLON alts SEMI ;
///     alts     : alts PIPE seq | seq ;
///     seq      : seq NAME | NAME ;
///
/// The kernel's own four terminals are the *named* words `NAME COLON SEMI PIPE` (undefined ⇒
/// primitive); its five nonterminals `grammar rulelist rule alts seq` are each defined by other
/// words — the closed, self-describing dictionary. Left-recursive throughout (canonical LR ⇒ clean
/// SLR(1), deterministic, byte-lockable).
///
/// Anchors: Futamura (1971, the projections — 3rd = cogen); homoiconicity (McCarthy's LISP, 1960 —
/// code is data); a metacircular grammar / the "grammar of grammars" (van Wijngaarden; BNF as its
/// own object language); `only-the-irreducible-is-primitive-generate-the-rest`. Consumes `Slr` +
/// `GrammarIr`.
[<RequireQualifiedAccess>]
module MetaGrammar =

    module G = GrammarIr

    /// The four structural marks of the notation (everything else is a bare identifier word).
    [<Literal>]
    let private colon = ":"

    [<Literal>]
    let private semi = ";"

    [<Literal>]
    let private pipe = "|"

    // ── The kernel grammar, in the IR ──

    let private prod lhs rhs : G.Production = { Lhs = lhs; Rhs = rhs }

    /// The homoiconic meta-grammar kernel as a `GrammarIr.Grammar`.
    let kernel: G.Grammar =
        { Id = "meta"
          Terminals =
            [ { Name = "NAME"; Pattern = "NAME" }
              { Name = "COLON"; Pattern = colon }
              { Name = "SEMI"; Pattern = semi }
              { Name = "PIPE"; Pattern = pipe } ]
          NonTerminals =
            [ { Name = "grammar" }
              { Name = "rulelist" }
              { Name = "rule" }
              { Name = "alts" }
              { Name = "seq" } ]
          Productions =
            [ prod "grammar" [ G.NonTerm "rulelist" ]
              prod "rulelist" [ G.NonTerm "rulelist"; G.NonTerm "rule" ]
              prod "rulelist" [ G.NonTerm "rule" ]
              prod "rule" [ G.Term "NAME"; G.Term "COLON"; G.NonTerm "alts"; G.Term "SEMI" ]
              prod "alts" [ G.NonTerm "alts"; G.Term "PIPE"; G.NonTerm "seq" ]
              prod "alts" [ G.NonTerm "seq" ]
              prod "seq" [ G.NonTerm "seq"; G.Term "NAME" ]
              prod "seq" [ G.Term "NAME" ] ]
          Start = "grammar" }

    // The kernel is HONESTLY typed for the builder (`NAME COLON SEMI PIPE` are `Term`; the five
    // defined words are `NonTerm`) — `Slr.build` needs the real split to compute FIRST/FOLLOW. The
    // *homoiconic* claim is that `reify` REDISCOVERS this exact split from the notation alone (a word
    // is a nonterminal iff it is defined as a rule), so the declared kinds here and the derived kinds
    // there must agree — which the `DICTIONARY DISCIPLINE` test asserts.

    // ── emit : Grammar → notation ──

    let private symName (s: G.Symbol) : string =
        match s with
        | G.Term n
        | G.NonTerm n -> n

    /// Group productions by LHS, preserving first-appearance order (canonical emission ⇒ DST/byte-lock).
    let private groupByLhs (prods: G.Production list) : (string * G.Symbol list list) list =
        let order = System.Collections.Generic.List<string>()
        let map = System.Collections.Generic.Dictionary<string, System.Collections.Generic.List<G.Symbol list>>()
        for p in prods do
            if not (map.ContainsKey p.Lhs) then
                map.[p.Lhs] <- System.Collections.Generic.List<G.Symbol list>()
                order.Add p.Lhs
            map.[p.Lhs].Add p.Rhs
        [ for lhs in order -> lhs, List.ofSeq map.[lhs] ]

    /// Emit a grammar as its notation source text (`:` `|` `;` + identifier words), one rule per line.
    let emit (g: G.Grammar) : string =
        groupByLhs g.Productions
        |> List.map (fun (lhs, alts) ->
            let altText =
                alts
                |> List.map (fun rhs -> rhs |> List.map symName |> String.concat " ")
                |> String.concat (sprintf " %s " pipe)
            sprintf "%s %s %s %s" lhs colon altText semi)
        |> String.concat "\n"

    // ── tokenize : notation text → (token classes, lexemes) ──

    /// Split notation text into (class, lexeme) pairs. Class is one of the four terminals; a bare
    /// identifier is `NAME` with the identifier as its lexeme (the structural marks carry no lexeme
    /// that `reify` reads). Whitespace-delimited — the kernel's lexer is intentionally trivial.
    let tokenize (src: string) : (string list * string list) =
        let words =
            src.Split([| ' '; '\n'; '\t'; '\r' |], System.StringSplitOptions.RemoveEmptyEntries)
            |> Array.toList
        let classify (w: string) =
            if System.String.Equals(w, colon, System.StringComparison.Ordinal) then "COLON"
            elif System.String.Equals(w, semi, System.StringComparison.Ordinal) then "SEMI"
            elif System.String.Equals(w, pipe, System.StringComparison.Ordinal) then "PIPE"
            else "NAME"
        words |> List.map classify, words

    // ── relex : substitute lexemes back into a class-level parse tree ──

    let private ruleOf (dv: DynamicValue) : string option =
        match DynamicValue.get "rule" dv with
        | Some(DynamicValue.String s) -> Some s
        | _ -> None

    let private kidsOf (dv: DynamicValue) : DynamicValue list =
        match DynamicValue.get "kids" dv with
        | Some(DynamicValue.Array xs) -> xs
        | _ -> []

    let private isLeaf (dv: DynamicValue) : bool =
        match DynamicValue.get "term" dv with
        | Some _ -> true
        | None -> false

    /// Replace each leaf's token-class with the next lexeme, left to right. Parse-tree leaves are in
    /// shift order, so an in-order walk zips them to the lexeme stream faithfully.
    let relex (tree: DynamicValue) (lexemes: string list) : DynamicValue =
        let lex = List.toArray lexemes
        let mutable i = 0
        let rec go dv =
            if isLeaf dv then
                let lx = if i < lex.Length then lex.[i] else ""
                i <- i + 1
                DynamicValue.Object [ "term", DynamicValue.String lx ]
            else
                match ruleOf dv with
                | Some r -> DynamicValue.Object [ "rule", DynamicValue.String r; "kids", DynamicValue.Array(kidsOf dv |> List.map go) ]
                | None -> dv
        go tree

    // ── reify : parse-tree (with lexemes) → Grammar ──

    let private leafLex (dv: DynamicValue) : Result<string, string> =
        match DynamicValue.get "term" dv with
        | Some(DynamicValue.String s) -> Ok s
        | _ -> Error "meta reify: expected a lexeme leaf"

    /// Reify a meta-grammar parse tree (lexemes in leaves) into the `Grammar` it denotes. Terminal
    /// vs. nonterminal is resolved by dictionary membership: a name is a nonterminal iff it is some
    /// rule's LHS; otherwise it is an irreducible primitive (terminal).
    let reify (tree: DynamicValue) : Result<G.Grammar, string> =
        // unwrap `grammar : rulelist`
        let rulelistNode =
            match ruleOf tree, kidsOf tree with
            | Some "grammar", [ rl ] -> Ok rl
            | Some "rulelist", _ -> Ok tree
            | _ -> Error "meta reify: root is not a grammar/rulelist node"

        let ruleNodes rl =
            // rulelist : rulelist rule | rule
            let rec go acc dv =
                match kidsOf dv with
                | [ recNode; ruleN ] when ruleOf recNode = Some "rulelist" -> go (ruleN :: acc) recNode
                | [ ruleN ] -> ruleN :: acc
                | _ -> acc
            go [] rl

        // seq : seq NAME | NAME   → the list of name lexemes
        let seqNames (seqNode: DynamicValue) : Result<string list, string> =
            let rec go acc dv =
                match kidsOf dv with
                | [ recNode; nameLeaf ] when ruleOf recNode = Some "seq" -> go (nameLeaf :: acc) recNode
                | [ nameLeaf ] -> nameLeaf :: acc
                | _ -> acc
            go [] seqNode
            |> List.map leafLex
            |> List.fold (fun acc r -> match acc, r with Ok xs, Ok x -> Ok(xs @ [ x ]) | Error e, _ -> Error e | _, Error e -> Error e) (Ok [])

        // alts : alts PIPE seq | seq  → the list of seq nodes
        let altSeqs (altsNode: DynamicValue) : DynamicValue list =
            let rec go acc dv =
                match kidsOf dv with
                | [ recNode; _pipe; seqN ] when ruleOf recNode = Some "alts" -> go (seqN :: acc) recNode
                | [ seqN ] -> seqN :: acc
                | _ -> acc
            go [] altsNode

        // rule : NAME COLON alts SEMI  → (lhs, [rhs-name-lists])
        let ruleParts (ruleNode: DynamicValue) : Result<string * string list list, string> =
            match kidsOf ruleNode with
            | [ nameLeaf; _colon; altsNode; _semi ] ->
                leafLex nameLeaf
                |> Result.bind (fun lhs ->
                    altSeqs altsNode
                    |> List.map seqNames
                    |> List.fold
                        (fun acc r -> match acc, r with Ok xs, Ok x -> Ok(xs @ [ x ]) | Error e, _ -> Error e | _, Error e -> Error e)
                        (Ok [])
                    |> Result.map (fun seqs -> lhs, seqs))
            | _ -> Error "meta reify: malformed rule node"

        rulelistNode
        |> Result.bind (fun rl ->
            ruleNodes rl
            |> List.map ruleParts
            |> List.fold (fun acc r -> match acc, r with Ok xs, Ok x -> Ok(xs @ [ x ]) | Error e, _ -> Error e | _, Error e -> Error e) (Ok [])
            |> Result.bind (fun rules ->
                match rules with
                | [] -> Error "meta reify: no rules"
                | (firstLhs, _) :: _ ->
                    // dictionary: a name is a nonterminal iff it is defined (appears as a LHS)
                    let defined = rules |> List.map fst |> Set.ofList
                    let productions =
                        [ for lhs, seqs in rules do
                              for names in seqs do
                                  let rhs =
                                      names
                                      |> List.map (fun n -> if defined.Contains n then G.NonTerm n else G.Term n)
                                  yield ({ Lhs = lhs; Rhs = rhs }: G.Production) ]
                    let usedNames = [ for _, seqs in rules do for names in seqs do yield! names ] |> Set.ofList
                    let terminals =
                        usedNames - defined
                        |> Set.toList
                        |> List.map (fun n -> ({ Name = n; Pattern = n }: G.Terminal))
                    let nonterminals = defined |> Set.toList |> List.map (fun n -> ({ Name = n }: G.NonTerminal))
                    Ok
                        { Id = "reified"
                          Terminals = terminals
                          NonTerminals = nonterminals
                          Productions = productions
                          Start = firstLhs }))

    // ── the closed loop: parse a grammar's own notation with the meta-parser ──

    /// Build the meta-parser once, on first use (the residual specialized to the kernel — the 1st
    /// Futamura projection applied to the meta-grammar itself). `lazy` so no work — and no throw —
    /// happens at module load.
    let private parserLazy: Lazy<Result<Slr.Tables, string>> = lazy (Slr.build kernel)

    /// The built meta-parser (forces the lazy build).
    let parser: Result<Slr.Tables, string> = parserLazy.Force()

    /// Parse notation text into the `Grammar` it denotes, using the meta-parser: the full
    /// `reify ∘ parse ∘ relex ∘ tokenize` pipeline. This is `read` for grammars — the inverse of
    /// `emit`. Applying it to `emit kernel` is the homoiconic self-application (lvl-3 cogen seed).
    let read (src: string) : Result<G.Grammar, string> =
        parser
        |> Result.bind (fun t ->
            let classes, lexemes = tokenize src
            Slr.parseTree t classes
            |> Result.bind (fun classTree -> reify (relex classTree lexemes)))
