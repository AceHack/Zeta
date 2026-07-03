module Zeta.Tests.MetaGrammarTests

// THE HOMOICONIC META-GRAMMAR KERNEL — the lvl-3 Futamura seed (shadow*, Aaron 2026-07-02:
// "build the homoiconic meta-grammar kernel"; "english as its own grammar … a dictionary that has
// every word defined by other words"). Proofs:
//   1. KERNEL IS SLR(1) — the grammar-of-grammars builds conflict-free tables.
//   2. HOMOICONIC FIXPOINT — the parser BUILT FROM the kernel parses the kernel's OWN emitted text,
//      and reifying recovers the kernel: emit (read (emit kernel)) = emit kernel.
//   3. UNIVERSAL — read ∘ emit = id on an arbitrary grammar (not just the kernel): the meta-parser
//      reads any grammar's notation back into that grammar. The self-application is the cogen seed.
//   4. DICTIONARY DISCIPLINE — terminal-vs-nonterminal is DERIVED from notation (a word is a
//      nonterminal iff it is defined as a rule), not declared: {NAME COLON SEMI PIPE} fall out as
//      the irreducible primitives, {grammar rulelist rule alts seq} as the defined words.
//
// Anchors: Futamura (1971, 3rd projection = cogen); McCarthy (LISP 1960, code=data); BNF as its own
// object language; only-the-irreducible-is-primitive.

open global.Xunit
open Zeta.Core

module G = GrammarIr

[<Fact>]
let ``KERNEL IS SLR(1): the grammar-of-grammars builds conflict-free tables`` () =
    match Slr.build MetaGrammar.kernel with
    | Ok t -> Assert.Empty(t.Conflicts)
    | Error e -> Assert.Fail(sprintf "meta kernel build failed: %s" e)

[<Fact>]
let ``HOMOICONIC FIXPOINT: the meta-parser parses the kernel's own text and reifying recovers the kernel`` () =
    let text = MetaGrammar.emit MetaGrammar.kernel
    match MetaGrammar.read text with
    | Ok recovered ->
        // round-trip is idempotent at the text level ⇒ reify ∘ parse ∘ emit fixes the kernel
        Assert.Equal(text, MetaGrammar.emit recovered)
        // and the recovered grammar is itself a valid, conflict-free grammar (self-hosting closure)
        match Slr.build recovered with
        | Ok t -> Assert.Empty(t.Conflicts)
        | Error e -> Assert.Fail(sprintf "recovered kernel build failed: %s" e)
    | Error e -> Assert.Fail(sprintf "read failed on kernel's own text: %s" e)

[<Fact>]
let ``UNIVERSAL: read ∘ emit = id on an arbitrary grammar (the meta-parser reads any grammar back)`` () =
    // a small left-recursive grammar; `a` and `b` are undefined ⇒ primitives (terminals).
    let ab: G.Grammar =
        { Id = "ab"
          Terminals = [ { Name = "a"; Pattern = "a" }; { Name = "b"; Pattern = "b" } ]
          NonTerminals = [ { Name = "s" } ]
          Productions =
            [ { Lhs = "s"; Rhs = [ G.NonTerm "s"; G.Term "a" ] }
              { Lhs = "s"; Rhs = [ G.Term "b" ] } ]
          Start = "s" }
    let text = MetaGrammar.emit ab
    match MetaGrammar.read text with
    | Ok recovered ->
        Assert.Equal(text, MetaGrammar.emit recovered)
        Assert.Equal("s", recovered.Start)
    | Error e -> Assert.Fail(sprintf "read failed: %s" e)

[<Fact>]
let ``DICTIONARY DISCIPLINE: terminal vs nonterminal is derived from notation, not declared`` () =
    match MetaGrammar.read (MetaGrammar.emit MetaGrammar.kernel) with
    | Ok g ->
        let terms = g.Terminals |> List.map (fun t -> t.Name) |> Set.ofList
        let nonterms = g.NonTerminals |> List.map (fun n -> n.Name) |> Set.ofList
        // the four irreducible primitives — never a LHS, so terminals
        Assert.Equal<Set<string>>(Set.ofList [ "NAME"; "COLON"; "SEMI"; "PIPE" ], terms)
        // the five defined words — each has a rule
        Assert.Equal<Set<string>>(Set.ofList [ "grammar"; "rulelist"; "rule"; "alts"; "seq" ], nonterms)
    | Error e -> Assert.Fail(sprintf "read failed: %s" e)

[<Fact>]
let ``SELF-HOSTING: the reified kernel, rebuilt, parses ITS OWN text too (closure holds one level deeper)`` () =
    // build a parser from the kernel; read the kernel back; build a parser from THAT; it must parse
    // the kernel's text identically — the meta-parser is a fixpoint of the whole pipeline.
    match MetaGrammar.read (MetaGrammar.emit MetaGrammar.kernel) with
    | Ok recovered ->
        match Slr.build recovered with
        | Ok t ->
            let classes, _ = MetaGrammar.tokenize (MetaGrammar.emit MetaGrammar.kernel)
            Assert.True(Slr.accepts t classes, "reified kernel's parser should accept the kernel's own notation")
        | Error e -> Assert.Fail(sprintf "reified build failed: %s" e)
    | Error e -> Assert.Fail(sprintf "read failed: %s" e)
