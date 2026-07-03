module Zeta.Tests.ParseSoftTests

// THE AMBIGUOUS PARSE FOREST AS A SOFTVALUE (shadow*, Aaron 2026-07-02: "infer.net style
// EP/BP/VMP plus our custom emotional propagation to make this ambiguous superposition over
// our ISA"). First inference-rung step, reusing SoftValue (don't reinvent). Proofs:
//   1. AMBIGUOUS → a SoftValue with MULTIPLE candidates (the superposition, carried not collapsed).
//   2. UNAMBIGUOUS → one candidate, confidence 1.0, resolves to the single parse.
//   3. NO PARSE → None.
//   4. WEIGHTED — explicit per-parse potentials (the shape BP/EP will produce) bias the MAP.
//
// Anchors: Tomita (GLR forest); SoftValue (distribution over DynamicValue); Infer.NET (the
// EP/BP/VMP weighting rung — Zeta.Bayesian.FactorGraph/Ep already exist).

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

[<Fact>]
let ``AMBIGUOUS → a SoftValue superposition with multiple candidate parses`` () =
    match Slr.buildGlr ambiguousExpr with
    | Ok t ->
        match ParseSoft.glrSoft t 16 [ "id"; "+"; "id"; "+"; "id" ] with
        | Some sv ->
            Assert.True(List.length sv.Candidates >= 2, sprintf "expected ≥2 candidate parses, got %d" (List.length sv.Candidates))
            // uniform v1 ⇒ no single parse dominates (confidence < 1)
            Assert.True(SoftValue.confidence sv < 1.0)
        | None -> Assert.Fail "ambiguous input should yield a SoftValue"
    | Error e -> Assert.Fail(sprintf "glr build failed: %s" e)

[<Fact>]
let ``UNAMBIGUOUS → one candidate, confidence 1.0, resolves to the single parse`` () =
    match Slr.buildGlr ambiguousExpr with
    | Ok t ->
        match ParseSoft.glrSoft t 16 [ "id" ] with
        | Some sv ->
            Assert.Equal(1, List.length sv.Candidates)
            Assert.Equal(1.0, SoftValue.confidence sv)
            Assert.True((SoftValue.resolve 0.9 sv).IsSome)
        | None -> Assert.Fail "unambiguous input should yield a SoftValue"
    | Error e -> Assert.Fail(sprintf "glr build failed: %s" e)

[<Fact>]
let ``NO PARSE → None`` () =
    match Slr.buildGlr ambiguousExpr with
    | Ok t -> Assert.True((ParseSoft.glrSoft t 16 [ "id"; "+" ]).IsNone)
    | Error e -> Assert.Fail(sprintf "glr build failed: %s" e)

[<Fact>]
let ``WEIGHTED → explicit per-parse potentials (the shape BP/EP produces) pick the MAP parse`` () =
    // Simulate the inference rung's output: two parses with unequal potentials → resolve to the
    // heavier one. (Proves the SoftValue bridge is ready for weighted forests, not just uniform.)
    let a = DynamicValue.Object [ "rule", DynamicValue.String "E"; "tag", DynamicValue.String "left" ]
    let b = DynamicValue.Object [ "rule", DynamicValue.String "E"; "tag", DynamicValue.String "right" ]
    match ParseSoft.ofWeightedForest [ a, 0.8; b, 0.2 ] with
    | Some sv -> Assert.Equal(Some a, SoftValue.resolve 0.6 sv)
    | None -> Assert.Fail "weighted forest should yield a SoftValue"
