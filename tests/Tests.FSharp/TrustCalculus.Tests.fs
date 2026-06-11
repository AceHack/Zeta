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

// ═══════════════════════════════════════════════════════════════════
// Dynamics — the sleeping-bear / capability-door fixed-point theorems (BUILD pass, 2026-06-11).
// ═══════════════════════════════════════════════════════════════════
module DynamicsTests =

    open Zeta.Core
    module D = TrustCalculus.Dynamics

    let private full = Set.ofList [ "fs"; "net"; "sign"; "gpu" ]
    let private seed = Set.ofList [ "fs" ] // length-2 "fs": also passes the door's mid-rung filter
    let private bear = D.shyBear seed full

    [<Xunit.Fact>]
    let ``laws: the named policies are monotone (checked, not assumed)`` () =
        Xunit.Assert.True(D.isMonotone bear)
        Xunit.Assert.True(D.isMonotone (D.wall full))
        Xunit.Assert.True(D.isMonotone (D.door seed full))

    [<Xunit.Fact>]
    let ``T-WALL: a wall freezes the bear at (T0,T0) forever — capability empty both directions`` () =
        let trail = D.iterate bear (D.wall full) D.evidenceUp D.evidenceUp (D.T0, D.T0)
        Xunit.Assert.Equal((D.T0, D.T0), List.last trail)
        Xunit.Assert.Equal(1, List.length trail) // immediate fixed point: nothing ever moves
        Xunit.Assert.True(D.effective bear (D.wall full) D.T0 D.T0 |> Set.isEmpty)

    [<Xunit.Fact>]
    let ``T-DOOR: an unconditional seed grant climbs to full mutual trust and full capability`` () =
        let landing = D.landing bear (D.door seed full) D.evidenceUp D.evidenceUp (D.T0, D.T0)
        Xunit.Assert.Equal((D.T3, D.T3), landing)
        let e = D.effective bear (D.door seed full) D.T3 D.T3
        Xunit.Assert.Equal<Set<string>>(Set.union seed full, e) // everything works at the top

    [<Xunit.Fact>]
    let ``T-DOOR strict: the door's landing capability strictly exceeds the wall's`` () =
        let eWall =
            let (a, h) = D.landing bear (D.wall full) D.evidenceUp D.evidenceUp (D.T0, D.T0)
            D.effective bear (D.wall full) a h
        let eDoor =
            let (a, h) = D.landing bear (D.door seed full) D.evidenceUp D.evidenceUp (D.T0, D.T0)
            D.effective bear (D.door seed full) a h
        Xunit.Assert.True(Set.isSubset eWall eDoor && eWall <> eDoor)

    [<Xunit.Fact>]
    let ``T-FIX: from bottom with non-decreasing updates the trajectory is an ascending chain that fixes`` () =
        let trail = D.iterate bear (D.door seed full) D.evidenceUp D.evidenceUp (D.T0, D.T0)
        // ascending: each step's rung-sum never decreases; final state is fixed
        let sums = trail |> List.map (fun (a, h) -> D.rung a + D.rung h)
        Xunit.Assert.Equal<int list>(List.sort sums, sums)
        let last = List.last trail
        Xunit.Assert.Equal(last, D.step bear (D.door seed full) D.evidenceUp D.evidenceUp last)

    [<Xunit.Fact>]
    let ``T-MONO: effective capability is monotone in both trusts`` () =
        let g = D.door seed full
        for a1 in [ D.T0; D.T1; D.T2 ] do
            let a2 = D.up1 a1
            for h1 in [ D.T0; D.T1; D.T2 ] do
                let h2 = D.up1 h1
                Xunit.Assert.True(Set.isSubset (D.effective bear g a1 h1) (D.effective bear g a2 h2))

    // FINDING (the math taught the test): the wall's trap is precisely the COLD START. From mutual
    // zero trust nothing ever moves — in the patient AND the suspicious world. But give the wall world
    // any pre-existing trust (T1,T1) and it recovers fine (the wall opens above T0). So the door's
    // value is not "walls never work" — it is that the door FIXES THE COLD START, the exact state every
    // new agent/citizen/hardware bring-up begins in. (First drafted expecting decay to grind (T1,T1)
    // down under a wall; the dynamics said no — evidence flows at T1, so it climbs. Kept honest.)
    [<Xunit.Fact>]
    let ``the wall's trap is the COLD START: mutual zero never moves in either world; the door fixes exactly that`` () =
        // suspicious world, wall, cold start: frozen at the floor
        let landing = D.landing bear (D.wall full) D.evidenceUpDecay D.evidenceUpDecay (D.T0, D.T0)
        Xunit.Assert.Equal((D.T0, D.T0), landing)
        // suspicious world, DOOR, same cold start: climbs to the top anyway
        let landing2 = D.landing bear (D.door seed full) D.evidenceUpDecay D.evidenceUpDecay (D.T0, D.T0)
        Xunit.Assert.Equal((D.T3, D.T3), landing2)
        // and the wall world with PRE-EXISTING trust recovers — the trap is the cold start, nothing else
        let landing3 = D.landing bear (D.wall full) D.evidenceUpDecay D.evidenceUpDecay (D.T1, D.T1)
        Xunit.Assert.Equal((D.T3, D.T3), landing3)
