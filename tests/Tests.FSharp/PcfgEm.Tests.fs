module Zeta.Tests.PcfgEmTests

// UNSUPERVISED PCFG WEIGHT LEARNING BY EM (shadow*, Aaron 2026-07-02 — the "where do the weights
// come from" answer). The inside–outside expected counts are the EM E-step; normalize per LHS =
// the M-step. In the SSAS frame: training the decision forest — the weights become learned
// NodeDistributions. Proofs:
//   1. FREQUENCY RECOVERY — on unambiguous data, EM recovers the empirical production frequencies.
//   2. VALID DISTRIBUTIONS — each LHS's learned weights sum to 1.
//   3. EM IMPROVES LIKELIHOOD — learned weights beat uniform (the EM monotonicity guarantee).
//   4. E-STEP — expectedCounts gives the right expected production usage.
//
// Anchors: Baker (1979) / Lari–Young (1990) inside–outside EM; Dempster–Laird–Rubin (EM); SSAS.

open global.Xunit
open Zeta.Core

module G = GrammarIr

/// S → 'a' (prod 0) | 'b' (prod 1). Unambiguous: each input has exactly one parse.
let private ab: G.Grammar =
    { Id = "ab"
      Terminals = [ { Name = "a"; Pattern = "a" }; { Name = "b"; Pattern = "b" } ]
      NonTerminals = [ { Name = "S" } ]
      Productions = [ { Lhs = "S"; Rhs = [ G.Term "a" ] }; { Lhs = "S"; Rhs = [ G.Term "b" ] } ]
      Start = "S" }

/// corpus: "a" three times, "b" once ⇒ empirical S→a = 3/4, S→b = 1/4.
let private corpus = [ [ "a" ]; [ "a" ]; [ "a" ]; [ "b" ] ]

[<Fact>]
let ``FREQUENCY RECOVERY: EM learns the empirical production frequencies (3a:1b ⇒ 0.75 / 0.25)`` () =
    let w = PcfgEm.learn ab corpus 5
    Assert.True(abs (w.[0] - 0.75) < 1e-6, sprintf "S→a should be 0.75, got %f" w.[0])
    Assert.True(abs (w.[1] - 0.25) < 1e-6, sprintf "S→b should be 0.25, got %f" w.[1])

[<Fact>]
let ``VALID DISTRIBUTIONS: each LHS's learned weights sum to 1`` () =
    let w = PcfgEm.learn ab corpus 5
    Assert.True(abs (w.[0] + w.[1] - 1.0) < 1e-9)

[<Fact>]
let ``EM IMPROVES LIKELIHOOD: learned weights beat uniform (the EM guarantee)`` () =
    let learned = PcfgEm.learn ab corpus 5
    let uniform = [| 0.5; 0.5 |]
    let llLearned = PcfgEm.corpusLogLikelihood ab corpus learned
    let llUniform = PcfgEm.corpusLogLikelihood ab corpus uniform
    Assert.True(llLearned > llUniform, sprintf "EM likelihood %f should exceed uniform %f" llLearned llUniform)

[<Fact>]
let ``E-STEP: expectedCounts gives the expected production usage for one input`` () =
    // "a" parses only as S→a (prod 0) ⇒ expected count {0: 1.0}, prod 1 unused.
    let ec = Sppf.expectedCounts (fun _ -> 1.0) (Sppf.build ab [ "a" ])
    Assert.Equal(1.0, Map.tryFind 0 ec |> Option.defaultValue 0.0)
    Assert.Equal(0.0, Map.tryFind 1 ec |> Option.defaultValue 0.0)