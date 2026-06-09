module Zeta.Tests.GamePortfolioTests

open System
open global.Xunit
open Zeta.Core

let private a: GamePortfolio.Game<string> = { Name = "A"; Experiences = [ "a1"; "a2" ]; SufficientLength = 2 }
let private b: GamePortfolio.Game<string> = { Name = "B"; Experiences = [ "b1" ]; SufficientLength = 1 }
let private c: GamePortfolio.Game<string> = { Name = "C"; Experiences = [ "c1"; "c2"; "c3" ]; SufficientLength = 3 }

[<Fact>]
let ``commutative regime: order is irrelevant only when every game is played to sufficient length`` () =
    Assert.True(GamePortfolio.commutativeRegime [ a, 2; b, 1 ]) // both >= their SufficientLength -> order-free
    Assert.False(GamePortfolio.commutativeRegime [ a, 1; b, 1 ]) // A under-played (1 < 2) -> order matters for it
    Assert.True(GamePortfolio.isSufficient 3 c)
    Assert.False(GamePortfolio.isSufficient 2 c)

[<Fact>]
let ``entropy is ORDER-INDEPENDENT (uncertainty-reduction commutes) — same set+durations, any order`` () =
    let s1 = [ a, 2; b, 1 ]
    let s2 = [ b, 1; a, 2 ] // reordered
    Assert.Equal(GamePortfolio.entropy s1, GamePortfolio.entropy s2, 12)

[<Fact>]
let ``length of time in a game matters: more duration shifts the entropy`` () =
    let short = [ a, 1; b, 1 ]
    let long = [ a, 5; b, 1 ] // much more time in A
    Assert.NotEqual(GamePortfolio.entropy short, GamePortfolio.entropy long)

[<Fact>]
let ``the SET of games determines the breadth (distinct experiences, duration-independent)`` () =
    Assert.Equal(3, GamePortfolio.distinctExperiences [ a, 1; b, 1 ]) // a1,a2,b1
    Assert.Equal(3, GamePortfolio.distinctExperiences [ a, 99; b, 1 ]) // duration doesn't change breadth
    Assert.Equal(6, GamePortfolio.distinctExperiences [ a, 1; b, 1; c, 1 ]) // a1a2 b1 c1c2c3

[<Fact>]
let ``marginalEntropy: a novel game adds more entropy than replaying an existing one`` () =
    let current = [ a, 1 ]
    let novel = GamePortfolio.marginalEntropy c 1 current // brand-new experiences
    let redundant = GamePortfolio.marginalEntropy a 1 current // more of the same
    Assert.True(novel > redundant)

[<Fact>]
let ``selectNext picks the entropy-maximizing game to play`` () =
    let current = [ a, 1 ]
    let chosen = GamePortfolio.selectNext 1 [ a; b; c ] current
    Assert.Equal(Some "C", chosen |> Option.map (fun g -> g.Name)) // C adds the most new entropy
