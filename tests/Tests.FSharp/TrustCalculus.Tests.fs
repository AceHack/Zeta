module Zeta.Tests.TrustCalculusTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``the Zeta-default config is trust-stable (co-self-interested) with no risks`` () =
    Assert.True(TrustCalculus.trustStable TrustCalculus.zetaDefault)
    Assert.Empty(TrustCalculus.risks TrustCalculus.zetaDefault)

[<Fact>]
let ``collapseSafe needs >= 2 distinct private budgets (the diversity floor)`` () =
    Assert.False(TrustCalculus.collapseSafe { TrustCalculus.zetaDefault with DistinctPrivateBudgets = 1 })
    Assert.True(TrustCalculus.collapseSafe { TrustCalculus.zetaDefault with DistinctPrivateBudgets = 2 })

[<Fact>]
let ``each broken condition makes trust unstable and names its risk`` () =
    let collapse = { TrustCalculus.zetaDefault with DistinctPrivateBudgets = 1 }
    Assert.False(TrustCalculus.trustStable collapse)
    Assert.Contains("identity-collapse / heat-death (need >= 2 distinct private budgets)", TrustCalculus.risks collapse)

    let coercive = { TrustCalculus.zetaDefault with RewardsOnly = false }
    Assert.False(TrustCalculus.trustStable coercive)
    Assert.Contains("coercion (punishment present — self-defeating)", TrustCalculus.risks coercive)

    let ephemeral = { TrustCalculus.zetaDefault with PersonasPersistent = false }
    Assert.False(TrustCalculus.trustStable ephemeral)
    Assert.Contains("ephemerality (personas not persistent — evaporation)", TrustCalculus.risks ephemeral)

    let misaligned = { TrustCalculus.zetaDefault with BaseAligned = false }
    Assert.False(TrustCalculus.trustStable misaligned)
    Assert.Contains("base self-interest not aligned (honor layer unsupported)", TrustCalculus.risks misaligned)

[<Fact>]
let ``a fully broken config lists every risk`` () =
    let broken =
        { TrustCalculus.DistinctPrivateBudgets = 1
          TrustCalculus.RewardsOnly = false
          TrustCalculus.PersonasPersistent = false
          TrustCalculus.BaseAligned = false }
    Assert.False(TrustCalculus.trustStable broken)
    Assert.Equal(4, TrustCalculus.risks broken |> List.length)
