module Zeta.Tests.SppfTests

// THE SHARED PACKED PARSE FOREST (rung 3 — the factor-graph prerequisite). shadow*, Aaron
// 2026-07-02 "yes to both", framed by his SSAS decision-forest model (ambiguity nodes = the
// NodeDistribution points). Proofs:
//   1. AMBIGUITY NODES — an ambiguous grammar's SPPF has nodes with >1 family (the factor-graph
//      variables); an unambiguous grammar's has none.
//   2. SHARED == ENUMERATED — the SPPF's parseCount (over the SHARED structure, no enumeration)
//      equals Slr.glrForest's tree count. Same parses, packed form.
//   3. HOMOICONIC — the forest projects to a DynamicValue that rides the codec stack.
//   4. TOTAL — no parse ⇒ accepts false, parseCount 0.
//
// Anchors: Tomita (GLR); Billot–Lang / Scott (SPPF); SSAS NodeDistribution; ZetaParse (Amara).

open global.Xunit
open Zeta.Core

module G = GrammarIr

/// Ambiguous: E → E + E | id.
let private ambiguousExpr: G.Grammar =
    { Id = "amb"
      Terminals = [ { Name = "+"; Pattern = "+" }; { Name = "id"; Pattern = "id" } ]
      NonTerminals = [ { Name = "E" } ]
      Productions =
        [ { Lhs = "E"; Rhs = [ G.NonTerm "E"; G.Term "+"; G.NonTerm "E" ] }
          { Lhs = "E"; Rhs = [ G.Term "id" ] } ]
      Start = "E" }

/// Unambiguous: E → E + T | T ; T → id.
let private unambiguousExpr: G.Grammar =
    { Id = "un"
      Terminals = [ { Name = "+"; Pattern = "+" }; { Name = "id"; Pattern = "id" } ]
      NonTerminals = [ { Name = "E" }; { Name = "T" } ]
      Productions =
        [ { Lhs = "E"; Rhs = [ G.NonTerm "E"; G.Term "+"; G.NonTerm "T" ] }
          { Lhs = "E"; Rhs = [ G.NonTerm "T" ] }
          { Lhs = "T"; Rhs = [ G.Term "id" ] } ]
      Start = "E" }

[<Fact>]
let ``AMBIGUITY NODES: an ambiguous SPPF has packing nodes with >1 family; an unambiguous one has none`` () =
    let amb = Sppf.build ambiguousExpr [ "id"; "+"; "id"; "+"; "id" ]
    Assert.NotEmpty(Sppf.ambiguities amb) // the NodeDistribution / factor-graph variables
    let un = Sppf.build unambiguousExpr [ "id"; "+"; "id"; "+"; "id" ]
    Assert.Empty(Sppf.ambiguities un)

[<Fact>]
let ``SHARED == ENUMERATED: SPPF parseCount equals Slr.glrForest tree count (same parses, packed)`` () =
    let toks = [ "id"; "+"; "id"; "+"; "id" ]
    let sppf = Sppf.build ambiguousExpr toks
    // id+id+id under E→E+E|id has exactly 2 bracketings
    Assert.Equal(2, Sppf.parseCount sppf)
    match Slr.buildGlr ambiguousExpr with
    | Ok t -> Assert.Equal(List.length (Slr.glrForest t 100 toks), Sppf.parseCount sppf)
    | Error e -> Assert.Fail(sprintf "glr build failed: %s" e)

[<Fact>]
let ``SHARING: a longer ambiguous string keeps the forest polynomial (parseCount grows, node set stays small)`` () =
    // id (+ id)*4 — Catalan(4) = 14 parse trees, but the SPPF shares sub-parses.
    let toks = [ "id"; "+"; "id"; "+"; "id"; "+"; "id"; "+"; "id" ]
    let sppf = Sppf.build ambiguousExpr toks
    Assert.Equal(14, Sppf.parseCount sppf) // 14 trees…
    // …yet the number of (E, i, j) ambiguity nodes is O(n²), far below 14-trees' enumeration.
    Assert.True(List.length (Sppf.ambiguities sppf) <= 25)

[<Fact>]
let ``HOMOICONIC: the forest projects to a DynamicValue that rides the codec stack`` () =
    let sppf = Sppf.build ambiguousExpr [ "id"; "+"; "id" ]
    let dv = Sppf.toDynamicValue sppf
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] dv)

[<Fact>]
let ``TOTAL: no parse ⇒ accepts false, parseCount 0`` () =
    let sppf = Sppf.build ambiguousExpr [ "id"; "+" ]
    Assert.False(Sppf.accepts sppf)
    Assert.Equal(0, Sppf.parseCount sppf)
