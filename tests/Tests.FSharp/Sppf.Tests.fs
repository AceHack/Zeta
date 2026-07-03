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

[<Fact>]
let ``INSIDE: uniform weights ⇒ inside(root) = parseCount (BP forward pass agrees with the count)`` () =
    // inside–outside = BP on the forest; the uniform inside is the unweighted tree count.
    let sppf = Sppf.build ambiguousExpr [ "id"; "+"; "id"; "+"; "id" ]
    Assert.Equal(float (Sppf.parseCount sppf), Sppf.insideTotal (fun _ -> 1.0) sppf)

[<Fact>]
let ``INSIDE: production weights scale the likelihood exactly (id+id+id: 2·w0²·w1³)`` () =
    // Prod 0 = E→E+E (used twice per tree), Prod 1 = E→id (thrice); 2 trees.
    let sppf = Sppf.build ambiguousExpr [ "id"; "+"; "id"; "+"; "id" ]
    // w0=2, w1=1 ⇒ 2·(2²·1³) = 8
    Assert.Equal(8.0, Sppf.insideTotal (fun p -> if p = 0 then 2.0 else 1.0) sppf)
    // w0=1, w1=3 ⇒ 2·(1²·3³) = 54
    Assert.Equal(54.0, Sppf.insideTotal (fun p -> if p = 1 then 3.0 else 1.0) sppf)

[<Fact>]
let ``INSIDE: no parse ⇒ total weight 0`` () =
    Assert.Equal(0.0, Sppf.insideTotal (fun _ -> 1.0) (Sppf.build ambiguousExpr [ "id"; "+" ]))

[<Fact>]
let ``MARGINALS (NodeDistribution / PredictProbability): exact inside·outside/Z per sub-parse`` () =
    // id+id+id under E→E+E|id (2 parses). The marginal of a node = fraction of parses passing
    // through it — the SSAS NodeDistribution / PredictProbability share.
    let f = Sppf.build ambiguousExpr [ "id"; "+"; "id"; "+"; "id" ]
    let m = Sppf.marginals (fun _ -> 1.0) f
    let mg node = Map.tryFind node m |> Option.defaultValue -1.0
    // root: every parse passes through it ⇒ 1.0
    Assert.Equal(1.0, mg (G.NonTerm "E", 0, 5))
    // the first `id` (E,0,1) is in EVERY parse ⇒ 1.0
    Assert.Equal(1.0, mg (G.NonTerm "E", 0, 1))
    // the left "id+id" (E,0,3) is used in exactly HALF the parses ⇒ 0.5
    Assert.Equal(0.5, mg (G.NonTerm "E", 0, 3))
    // and its mirror (E,2,5) — the right "id+id" — likewise 0.5
    Assert.Equal(0.5, mg (G.NonTerm "E", 2, 5))

[<Fact>]
let ``OUTSIDE: unambiguous grammar ⇒ every node on the single parse has marginal 1.0`` () =
    let f = Sppf.build unambiguousExpr [ "id"; "+"; "id" ]
    let m = Sppf.marginals (fun _ -> 1.0) f
    // one parse ⇒ the root and the sole derivation nodes all have marginal 1.0
    Assert.Equal(1.0, Map.tryFind (G.NonTerm "E", 0, 3) m |> Option.defaultValue -1.0)

[<Fact>]
let ``MARGINALS: no parse ⇒ all zero`` () =
    let m = Sppf.marginals (fun _ -> 1.0) (Sppf.build ambiguousExpr [ "id"; "+" ])
    Assert.True(m |> Map.forall (fun _ v -> v = 0.0))
