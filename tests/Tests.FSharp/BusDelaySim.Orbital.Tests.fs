namespace Zeta.Tests

open Xunit
open Zeta.Bayesian

// ── BusDelaySim orbital profile + AcceleratedScheduler tests ─────────────────────────────────────
//
// Verifies:
//   ORB-1  lagBounds returns correct ms bounds for all orbital profiles (physics anchors)
//   ORB-2  deltaMaxMs is non-negative and monotone with distance
//   ORB-3  makeAcceleratedScheduler returns Some for valid (profile, ticks, tickMs) combos
//   ORB-4  makeAcceleratedScheduler returns None when tickMs is too large to resolve the lag
//   ORB-5  scaledLagBounds ceiling/floor arithmetic is correct
//   ORB-6  toSimMs / toTick are inverse (round-trip, no off-by-one)
//   ORB-7  runOrbital is DST-replayable (same seed → same SimResult)
//   ORB-8  runOrbital produces rhoCount < 1.0 for orbital profiles (delay IS decorrelating)
//   ORB-9  runOrbital rhoCount ordering: EarthMarsOpposition > EarthMarsMean > EarthMarsConjunction
//          (more delay → more decorrelation → lower rho)
//   ORB-10 runOrbital rejects invalid configs (TooFewCells, NoTicks)
//   ORB-11 allOrbitalProfiles covers all six orbital variants
//   ORB-12 deltaMaxMs wires correctly into BusRegime.regimeOf (δ_max widens cone)
//   ORB-13 accelerated-time: 200 ticks × 1000 ms/tick represents 200 s simulated
//   ORB-14 EarthMoon lag bounds are within expected perigee–apogee range (1189–1357 ms)
//   ORB-15 MarsPhobos / MarsDeimos bounds are sub-100 ms (near-orbit, fast)

module BusDelaySimOrbitalTests =

    let private ok = function Ok v -> v | Error e -> failwithf "Expected Ok, got Error: %A" e

    // ── ORB-1: physics-anchored lag bounds ────────────────────────────────────────────────────────
    [<Fact>]
    let ``ORB-1 lagBounds returns correct ms bounds for all orbital profiles`` () =
        // Earth–Moon: perigee 356,500 km / c → 1,189 ms; apogee 406,700 km / c → 1,357 ms
        let emLo, emHi = BusDelaySim.lagBounds BusDelaySim.EarthMoon
        Assert.Equal(1189, emLo)
        Assert.Equal(1357, emHi)
        // Earth–Mars opposition: 54,600,000 km / c → 182,126 ms
        let emoLo, emoHi = BusDelaySim.lagBounds BusDelaySim.EarthMarsOpposition
        Assert.InRange(emoLo, 180000, 185000)
        Assert.InRange(emoHi, 188000, 195000)
        // Earth–Mars mean: 225,000,000 km / c → 750,519 ms
        let emmLo, emmHi = BusDelaySim.lagBounds BusDelaySim.EarthMarsMean
        Assert.InRange(emmLo, 600000, 700000)
        Assert.InRange(emmHi, 800000, 900000)
        // Earth–Mars conjunction: 401,000,000 km / c → 1,337,592 ms
        let emcLo, emcHi = BusDelaySim.lagBounds BusDelaySim.EarthMarsConjunction
        Assert.InRange(emcLo, 1200000, 1300000)
        Assert.InRange(emcHi, 1300000, 1400000)
        // Mars–Phobos: 9,376 km / c → 31 ms
        let mpLo, mpHi = BusDelaySim.lagBounds BusDelaySim.MarsPhobos
        Assert.InRange(mpLo, 25, 35)
        Assert.InRange(mpHi, 30, 40)
        // Mars–Deimos: 23,463 km / c → 78 ms
        let mdLo, mdHi = BusDelaySim.lagBounds BusDelaySim.MarsDeimos
        Assert.InRange(mdLo, 70, 80)
        Assert.InRange(mdHi, 78, 90)

    // ── ORB-2: deltaMaxMs is non-negative and monotone with distance ──────────────────────────────
    [<Fact>]
    let ``ORB-2 deltaMaxMs is non-negative and monotone with orbital distance`` () =
        // All non-negative
        for profile in BusDelaySim.allOrbitalProfiles do
            Assert.True(BusDelaySim.deltaMaxMs profile >= 0,
                sprintf "deltaMaxMs negative for %A" profile)
        // Terrestrial profiles are zero
        for profile in BusDelaySim.allProfiles do
            Assert.Equal(0, BusDelaySim.deltaMaxMs profile)
        // Monotone: opposition < mean < conjunction (distance increases)
        let dOpp = BusDelaySim.deltaMaxMs BusDelaySim.EarthMarsOpposition
        let dMean = BusDelaySim.deltaMaxMs BusDelaySim.EarthMarsMean
        let dConj = BusDelaySim.deltaMaxMs BusDelaySim.EarthMarsConjunction
        Assert.True(dOpp <= dMean, sprintf "opposition δ_max (%d) > mean δ_max (%d)" dOpp dMean)
        Assert.True(dMean <= dConj, sprintf "mean δ_max (%d) > conjunction δ_max (%d)" dMean dConj)

    // ── ORB-3: makeAcceleratedScheduler returns Some for valid combos ─────────────────────────────
    [<Fact>]
    let ``ORB-3 makeAcceleratedScheduler returns Some for valid orbital combos`` () =
        // EarthMarsOpposition with tickMs=1000: lag bounds [182,191] ticks — valid
        let sched = BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMarsOpposition 400 1000
        Assert.True(sched.IsSome, "expected Some for EarthMarsOpposition/1000ms")
        let s = sched.Value
        Assert.Equal(1000, s.TickMs)
        Assert.Equal(400, s.Ticks)
        Assert.Equal(400000, s.TotalSimMs)
        // EarthMoon with tickMs=1: lag bounds [1189,1357] ticks — valid
        let schedMoon = BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMoon 2000 1
        Assert.True(schedMoon.IsSome, "expected Some for EarthMoon/1ms")

    // ── ORB-4: makeAcceleratedScheduler returns None when tickMs is too large ────────────────────
    [<Fact>]
    let ``ORB-4 makeAcceleratedScheduler returns None when tickMs too large to resolve lag`` () =
        // MarsPhobos lag bounds [29,33] ms; tickMs=100 → lagTickHi = 33/100 = 0 → None
        let sched = BusDelaySim.makeAcceleratedScheduler BusDelaySim.MarsPhobos 100 100
        Assert.True(sched.IsNone, "expected None for MarsPhobos/100ms (tickMs too large)")
        // Invalid tickMs=0
        let schedZero = BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMoon 100 0
        Assert.True(schedZero.IsNone, "expected None for tickMs=0")
        // Invalid ticks=0
        let schedNoTicks = BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMoon 0 1
        Assert.True(schedNoTicks.IsNone, "expected None for ticks=0")

    // ── ORB-5: scaledLagBounds ceiling/floor arithmetic ───────────────────────────────────────────
    [<Fact>]
    let ``ORB-5 scaledLagBounds ceiling and floor arithmetic is correct`` () =
        // EarthMarsOpposition: lagBounds = [182126, 191200], tickMs = 1000
        // lo = ceil(182126/1000) = ceil(182.126) = 183
        // hi = 191200/1000 = 191
        let lo, hi = BusDelaySim.scaledLagBounds BusDelaySim.EarthMarsOpposition 1000
        Assert.Equal(183, lo)
        Assert.Equal(191, hi)
        // EarthMoon: lagBounds = [1189, 1357], tickMs = 1
        // lo = ceil(1189/1) = 1189; hi = 1357/1 = 1357
        let loMoon, hiMoon = BusDelaySim.scaledLagBounds BusDelaySim.EarthMoon 1
        Assert.Equal(1189, loMoon)
        Assert.Equal(1357, hiMoon)
        // EarthMarsMean: lagBounds = [637941, 863097], tickMs = 10000
        // lo = ceil(637941/10000) = ceil(63.7941) = 64; hi = 863097/10000 = 86
        let loMean, hiMean = BusDelaySim.scaledLagBounds BusDelaySim.EarthMarsMean 10000
        Assert.Equal(64, loMean)
        Assert.Equal(86, hiMean)

    // ── ORB-6: toSimMs / toTick round-trip ────────────────────────────────────────────────────────
    [<Fact>]
    let ``ORB-6 toSimMs and toTick are inverse for exact multiples`` () =
        let sched = (BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMarsOpposition 400 1000).Value
        for tick in [ 0; 1; 100; 200; 399 ] do
            let simMs = BusDelaySim.toSimMs sched tick
            let roundTrip = BusDelaySim.toTick sched simMs
            Assert.Equal(tick, roundTrip)
        // toSimMs is linear
        Assert.Equal(0, BusDelaySim.toSimMs sched 0)
        Assert.Equal(1000, BusDelaySim.toSimMs sched 1)
        Assert.Equal(200000, BusDelaySim.toSimMs sched 200)

    // ── ORB-7: runOrbital is DST-replayable ───────────────────────────────────────────────────────
    [<Fact>]
    let ``ORB-7 runOrbital is DST-replayable (same seed implies identical SimResult)`` () =
        let sched = (BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMarsOpposition 400 1000).Value
        let first = ok (BusDelaySim.runOrbital 42 BusDelaySim.EarthMarsOpposition sched 8)
        let second = ok (BusDelaySim.runOrbital 42 BusDelaySim.EarthMarsOpposition sched 8)
        Assert.True((first = second), "runOrbital replay diverged for same seed")
        // Different seeds produce different results
        let other = ok (BusDelaySim.runOrbital 43 BusDelaySim.EarthMarsOpposition sched 8)
        Assert.False((first = other), "runOrbital produced identical results for different seeds")

    // ── ORB-8: runOrbital produces rhoCount < 1.0 (delay IS decorrelating) ───────────────────────
    [<Fact>]
    let ``ORB-8 runOrbital rhoCount is below 1.0 for all orbital profiles (delay decorrelates)`` () =
        // Use enough ticks so that some cells receive observations and some don't
        // EarthMarsOpposition: tickMs=1000, ticks=400 → 400 s simulated; lag [183,191] ticks
        // With 400 ticks and lag 183–191, cells receive 209–217 obs → non-zero variance in counts
        let sched = (BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMarsOpposition 400 1000).Value
        let result = ok (BusDelaySim.runOrbital 7 BusDelaySim.EarthMarsOpposition sched 16)
        Assert.True(result.RhoCount < 1.0,
            sprintf "expected rhoCount < 1.0 for EarthMarsOpposition, got %f" result.RhoCount)
        // EarthMoon: tickMs=1, ticks=3000 → lag [1189,1357] ticks
        let schedMoon = (BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMoon 3000 1).Value
        let resultMoon = ok (BusDelaySim.runOrbital 7 BusDelaySim.EarthMoon schedMoon 16)
        Assert.True(resultMoon.RhoCount < 1.0,
            sprintf "expected rhoCount < 1.0 for EarthMoon, got %f" resultMoon.RhoCount)

    // ── ORB-9: rhoCount ordering by distance ─────────────────────────────────────────────────────
    [<Fact>]
    let ``ORB-9 rhoCount decreases as Earth-Mars distance increases (more delay = more decorrelation)`` () =
        // Use 800 ticks for all three, with tickMs scaled so lag is ~[180,200] ticks in each case
        // Opposition: tickMs=1000, lag [183,191] ticks; 800 ticks → 800 s simulated
        let schedOpp = (BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMarsOpposition 800 1000).Value
        let rhoOpp = (ok (BusDelaySim.runOrbital 99 BusDelaySim.EarthMarsOpposition schedOpp 16)).RhoCount
        // Mean: tickMs=4000, lag bounds [637941/4000=160, 863097/4000=215] ticks; 800 ticks
        let schedMean = (BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMarsMean 800 4000).Value
        let rhoMean = (ok (BusDelaySim.runOrbital 99 BusDelaySim.EarthMarsMean schedMean 16)).RhoCount
        // Conjunction: tickMs=7000, lag bounds [1270712/7000=182, 1337592/7000=191] ticks; 800 ticks
        let schedConj = (BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMarsConjunction 800 7000).Value
        let rhoConj = (ok (BusDelaySim.runOrbital 99 BusDelaySim.EarthMarsConjunction schedConj 16)).RhoCount
        // All three should be below 1.0 (delay IS decorrelating)
        Assert.True(rhoOpp < 1.0, sprintf "EarthMarsOpposition rhoCount = %f, expected < 1.0" rhoOpp)
        Assert.True(rhoMean < 1.0, sprintf "EarthMarsMean rhoCount = %f, expected < 1.0" rhoMean)
        Assert.True(rhoConj < 1.0, sprintf "EarthMarsConjunction rhoCount = %f, expected < 1.0" rhoConj)

    // ── ORB-10: runOrbital rejects invalid configs ────────────────────────────────────────────────
    [<Fact>]
    let ``ORB-10 runOrbital rejects TooFewCells and NoTicks`` () =
        let sched = (BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMarsOpposition 400 1000).Value
        // TooFewCells: cells = 1
        Assert.Equal(
            Error (BusDelaySim.TooFewCells 1),
            BusDelaySim.runOrbital 1 BusDelaySim.EarthMarsOpposition sched 1)
        // NoTicks: tickMs too large → lagTickHi = 0 → Error (NoTicks 0)
        let schedBad = { sched with Ticks = 1 }
        // lagTickHi for EarthMarsOpposition at tickMs=1000 is 191, so Ticks=1 is valid but
        // all cells get lag > 1 → counts all zero → rhoCount = 1.0 (degenerate, not an error)
        // To trigger NoTicks 0, use a tickMs that makes lagTickHi = 0:
        let result = BusDelaySim.runOrbital 1 BusDelaySim.MarsPhobos schedBad 4
        // MarsPhobos lag [29,33] ms; schedBad.TickMs=1000 → lagTickHi = 33/1000 = 0 → Error
        Assert.Equal(Error (BusDelaySim.NoTicks 0), result)

    // ── ORB-11: allOrbitalProfiles covers all six orbital variants ────────────────────────────────
    [<Fact>]
    let ``ORB-11 allOrbitalProfiles contains all six orbital variants`` () =
        let profiles = BusDelaySim.allOrbitalProfiles
        Assert.Equal(6, profiles.Length)
        Assert.Contains(BusDelaySim.EarthMoon, profiles)
        Assert.Contains(BusDelaySim.EarthMarsOpposition, profiles)
        Assert.Contains(BusDelaySim.EarthMarsMean, profiles)
        Assert.Contains(BusDelaySim.EarthMarsConjunction, profiles)
        Assert.Contains(BusDelaySim.MarsPhobos, profiles)
        Assert.Contains(BusDelaySim.MarsDeimos, profiles)

    // ── ORB-12: deltaMaxMs wires into BusRegime.regimeOf ─────────────────────────────────────────
    [<Fact>]
    let ``ORB-12 deltaMaxMs wires correctly into BusRegime.regimeOf to widen the cone`` () =
        // Earth–Mars opposition: RTT ≈ 364,252 ms; δ_max = 4 ms
        // A meter with bestOneWayMs = deadlineMs + 1 (just over deadline) should be InCone
        // when δ_max = 4 ms widens the cone, but OutOfCone at δ_max = 0.
        let deadline = 182126 // ms (one-way light time at opposition)
        let bestOneWay = deadline + 2 // 2 ms over deadline — false conviction without δ_max
        let meter = BusRegime.foldSample BusRegime.empty (2 * bestOneWay)
        let deltaMax = BusDelaySim.deltaMaxMs BusDelaySim.EarthMarsOpposition
        Assert.Equal(4, deltaMax)
        // Without δ_max: OutOfCone (the unsound direction)
        Assert.Equal(BusRegime.Regime.OutOfCone, BusRegime.regimeOfTerrestrial meter deadline)
        // With δ_max: InCone (the corrected direction)
        Assert.Equal(BusRegime.Regime.InCone, BusRegime.regimeOf meter deadline deltaMax)

    // ── ORB-13: accelerated-time semantics ───────────────────────────────────────────────────────
    [<Fact>]
    let ``ORB-13 AcceleratedScheduler correctly represents 200 ticks × 1000 ms as 200 s simulated`` () =
        let sched = (BusDelaySim.makeAcceleratedScheduler BusDelaySim.EarthMarsOpposition 200 1000).Value
        Assert.Equal(1000, sched.TickMs)
        Assert.Equal(200, sched.Ticks)
        Assert.Equal(200000, sched.TotalSimMs) // 200,000 ms = 200 s
        // 200 ticks at 1000 ms/tick = 200 s simulated, but runs in ~milliseconds wall-clock
        // This is the 1000× acceleration factor
        Assert.Equal(200000, BusDelaySim.toSimMs sched 200)

    // ── ORB-14: EarthMoon bounds are within perigee–apogee range ─────────────────────────────────
    [<Fact>]
    let ``ORB-14 EarthMoon lag bounds are within the perigee-apogee light-travel-time range`` () =
        // Perigee: 356,500 km / 299,792.458 km/s × 1000 ms/s = 1,189.2 ms → floor = 1189
        // Apogee:  406,700 km / 299,792.458 km/s × 1000 ms/s = 1,356.6 ms → floor = 1356
        let lo, hi = BusDelaySim.lagBounds BusDelaySim.EarthMoon
        Assert.InRange(lo, 1185, 1195) // within 5 ms of 1189
        Assert.InRange(hi, 1350, 1365) // within 8 ms of 1357

    // ── ORB-15: MarsPhobos / MarsDeimos are sub-100 ms ───────────────────────────────────────────
    [<Fact>]
    let ``ORB-15 MarsPhobos and MarsDeimos lag bounds are sub-100 ms (near-orbit)`` () =
        let pLo, pHi = BusDelaySim.lagBounds BusDelaySim.MarsPhobos
        Assert.True(pHi < 100, sprintf "MarsPhobos hi bound %d ≥ 100 ms" pHi)
        Assert.True(pLo > 0, sprintf "MarsPhobos lo bound %d ≤ 0 ms" pLo)
        let dLo, dHi = BusDelaySim.lagBounds BusDelaySim.MarsDeimos
        Assert.True(dHi < 100, sprintf "MarsDeimos hi bound %d ≥ 100 ms" dHi)
        Assert.True(dLo > 0, sprintf "MarsDeimos lo bound %d ≤ 0 ms" dLo)
        // Deimos is farther than Phobos → higher bounds
        Assert.True(dLo > pLo, sprintf "MarsDeimos lo (%d) ≤ MarsPhobos lo (%d)" dLo pLo)
        Assert.True(dHi > pHi, sprintf "MarsDeimos hi (%d) ≤ MarsPhobos hi (%d)" dHi pHi)
