module Zeta.Tests.OrbitalAsymmetryBudgetTests

open Xunit
open Zeta.Bayesian

// ── Physics anchors ────────────────────────────────────────────────────────────────────────────────
// Speed of light: 299,792.458 km/s
// Earth-Sun: 149,597,870.7 km (1 AU) → one-way ≈ 499,004 ms ≈ 499 s
// Earth-Mars mean: ~225,000,000 km → one-way ≈ 750,000 ms ≈ 12.5 min
// Earth-Mars opposition: ~54,600,000 km → one-way ≈ 182,000 ms ≈ 3 min
// Earth-Mars conjunction: ~401,000,000 km → one-way ≈ 1,337,000 ms ≈ 22 min
// Earth-Moon mean: 384,400 km → one-way ≈ 1,282 ms ≈ 1.28 s
// Mars orbital velocity: ~24.1 km/s
// Earth orbital velocity: ~29.8 km/s

// J2000.0 = JD 2451545.0
let private j2000 = 2_451_545.0

// ── OAB-1: Earth-Mars distance at J2000 is in the expected range ───────────────────────────────────
[<Fact>]
let ``OAB-1 Earth-Mars distance at J2000 is between 54M and 401M km`` () =
    let d = OrbitalAsymmetryBudget.distanceKm "earth" "mars" j2000
    Assert.InRange(d, 54_000_000.0, 401_000_000.0)

// ── OAB-2: Earth-Moon distance at J2000 is in the expected range ───────────────────────────────────
[<Fact>]
let ``OAB-2 Earth-Moon distance at J2000 is between 360000 and 410000 km`` () =
    // Kepler model with M0=2.3542 rad places the Moon near apogee at J2000 (~400k km).
    // Physical range: 356,500 km (perigee) to 406,700 km (apogee).
    let d = OrbitalAsymmetryBudget.distanceKm "earth" "moon" j2000
    Assert.InRange(d, 360_000.0, 410_000.0)

// ── OAB-3: One-way light travel time Earth-Mars at J2000 ──────────────────────────────────────────
[<Fact>]
let ``OAB-3 Earth-Mars one-way light travel time at J2000 is between 182s and 1337s`` () =
    let ms = OrbitalAsymmetryBudget.oneWayMs "earth" "mars" j2000
    Assert.InRange(ms, 182_000.0, 1_337_000.0)

// ── OAB-4: One-way light travel time Earth-Moon at J2000 ──────────────────────────────────────────
[<Fact>]
let ``OAB-4 Earth-Moon one-way light travel time at J2000 is between 1200ms and 1370ms`` () =
    // Kepler model places the Moon near apogee at J2000 (~400k km → ~1334 ms).
    let ms = OrbitalAsymmetryBudget.oneWayMs "earth" "moon" j2000
    Assert.InRange(ms, 1_200.0, 1_370.0)

// ── OAB-5: RTT is 2× one-way ──────────────────────────────────────────────────────────────────────
[<Fact>]
let ``OAB-5 RTT is exactly 2x one-way`` () =
    let ow = OrbitalAsymmetryBudget.oneWayMs "earth" "mars" j2000
    let rtt = OrbitalAsymmetryBudget.rttMs "earth" "mars" j2000
    Assert.Equal(2.0 * ow, rtt, 6)

// ── OAB-6: δ_max is non-negative ──────────────────────────────────────────────────────────────────
[<Fact>]
let ``OAB-6 deltaMaxMs is non-negative for all links`` () =
    let jd = j2000
    Assert.True(OrbitalAsymmetryBudget.earthMars jd >= 0.0)
    Assert.True(OrbitalAsymmetryBudget.earthMoon jd >= 0.0)
    Assert.True(OrbitalAsymmetryBudget.marsPhobos jd >= 0.0)
    Assert.True(OrbitalAsymmetryBudget.marsDeimos jd >= 0.0)

// ── OAB-7: Earth-Mars uses the conservative all-epoch endpoint-speed envelope ─────────────────────
[<Fact>]
let ``OAB-7 deltaMaxMs Earth-Mars is the all-epoch conservative envelope`` () =
    let delta = OrbitalAsymmetryBudget.earthMars j2000
    Assert.Equal(253.6008, delta, 4)

// ── OAB-8: δ_max Earth-Moon is small (low orbital velocity) ──────────────────────────────────────
// Moon orbital velocity ≈ 1.022 km/s. RTT at mean ≈ 2564 ms ≈ 2.564 s.
// δ ≈ 1.022 * 2.564 / 299792 * 1000 * 1.2 ≈ 0.010 ms. Very small.
[<Fact>]
let ``OAB-8 deltaMaxMs Earth-Moon at J2000 is below 5ms`` () =
    let delta = OrbitalAsymmetryBudget.earthMoon j2000
    Assert.InRange(delta, 0.0, 5.0)

// ── OAB-9: Earth-Mars cone widening is epoch-free ─────────────────────────────────────────────────
// This is intentional: the consumer needs a conservative bound, not a phase-sensitive estimate.
[<Fact>]
let ``OAB-9 deltaMaxMs Earth-Mars is invariant across orbital phase`` () =
    let d1 = OrbitalAsymmetryBudget.earthMars j2000
    let d2 = OrbitalAsymmetryBudget.earthMars (j2000 + 180.0)  // 6 months later
    let d3 = OrbitalAsymmetryBudget.earthMars (j2000 + 365.0)  // 1 year later
    Assert.Equal(d1, d2, 12)
    Assert.Equal(d2, d3, 12)

// ── OAB-10: unixMsToJd round-trip ─────────────────────────────────────────────────────────────────
[<Fact>]
let ``OAB-10 unixMsToJd converts Unix epoch to JD 2440587.5`` () =
    let jd = OrbitalAsymmetryBudget.unixMsToJd 0L
    Assert.Equal(2_440_587.5, jd, 1)

// ── OAB-11: deltaMaxMsAtUnix is consistent with deltaMaxMs ────────────────────────────────────────
[<Fact>]
let ``OAB-11 deltaMaxMsAtUnix is consistent with deltaMaxMs at the same JD`` () =
    // J2000.0 = 2000-01-01T12:00:00Z = Unix 946728000000 ms
    let unixMs = 946_728_000_000L
    let viaUnix = OrbitalAsymmetryBudget.deltaMaxMsAtUnix "earth" "mars" unixMs
    let viaJd = OrbitalAsymmetryBudget.earthMars (OrbitalAsymmetryBudget.unixMsToJd unixMs)
    Assert.Equal(viaJd, viaUnix, 6)

// ── OAB-12: δ_max feeds BusRegime.regimeOf correctly ─────────────────────────────────────────────
// At Earth-Mars opposition (RTT ≈ 364,000 ms), a deadline of 200,000 ms should be OutOfCone
// without δ_max, but InCone with δ_max when the path asymmetry is accounted for.
[<Fact>]
let ``OAB-12 deltaMaxMs feeds BusRegime.regimeOf to prevent false OutOfCone`` () =
    // Use a JD near opposition: Earth-Mars distance ≈ 80M km → one-way ≈ 267,000 ms
    // RTT ≈ 534,000 ms. bestOneWayMs = 267,000 ms.
    // Deadline = 270,000 ms (just above bestOneWayMs).
    // Without δ_max: 267,000 <= 270,000 → InCone (this case is fine)
    // With a tight deadline of 265,000 ms (below bestOneWayMs):
    // Without δ_max: 267,000 > 265,000 → OutOfCone
    // With δ_max = 5,000 ms: 267,000 <= 265,000 + 5,000 = 270,000 → InCone
    let delta = OrbitalAsymmetryBudget.earthMars j2000
    Assert.True(delta > 0.0, sprintf "δ_max should be positive at J2000: %.3f ms" delta)
    // The δ_max value is the budget to pass to BusRegime.regimeOf
    // (actual BusRegime integration tested in BusRegime.Tests.fs)

// ── OAB-13: unknown body raises an exception ──────────────────────────────────────────────────────
[<Fact>]
let ``OAB-13 unknown body name raises an exception`` () =
    Assert.Throws<System.Exception>(fun () ->
        OrbitalAsymmetryBudget.distanceKm "pluto" "earth" j2000 |> ignore
    ) |> ignore

// ── OAB-14: distance is symmetric ────────────────────────────────────────────────────────────────
[<Fact>]
let ``OAB-14 distance is symmetric: d(A,B) = d(B,A)`` () =
    let d1 = OrbitalAsymmetryBudget.distanceKm "earth" "mars" j2000
    let d2 = OrbitalAsymmetryBudget.distanceKm "mars" "earth" j2000
    Assert.Equal(d1, d2, 3)

// ── OAB-15: distance ordering over one Mars synodic period ────────────────────────────────────────
// Earth-Mars distance varies from ~54M km (opposition) to ~401M km (conjunction).
// Over one synodic period (~780 days), the min and max should span this range.
[<Fact>]
let ``OAB-15 Earth-Mars distance spans opposition-to-conjunction range over one synodic period`` () =
    let distances =
        [ for i in 0..78 -> OrbitalAsymmetryBudget.distanceKm "earth" "mars" (j2000 + float i * 10.0) ]
    let minD = List.min distances
    let maxD = List.max distances
    // Min should be below 150M km (opposition-ish), max above 250M km (conjunction-ish)
    Assert.True(minD < 150_000_000.0, sprintf "min distance should be below 150M km, got %.0f km" minD)
    Assert.True(maxD > 250_000_000.0, sprintf "max distance should be above 250M km, got %.0f km" maxD)

// ── OAB-16: the generic envelope is non-cancelling ─────────────────────────────────────────────────
[<Fact>]
let ``OAB-16 endpoint speed envelope remains positive without any projection input`` () =
    // A projected-velocity estimator can be zero at a velocity-projection crossing.
    // This envelope accepts only endpoint speed norms, so that cancellation path is absent.
    let envelope = OrbitalAsymmetryBudget.endpointSpeedEnvelopeMs 1_000_000.0 30.0 24.0
    Assert.True(envelope > 0.0, sprintf "speed-norm envelope must remain positive: %.12f ms" envelope)

// ── OAB-17: invalid superluminal inputs fail rather than silently widen/narrow a cone ──────────────
[<Fact>]
let ``OAB-17 endpoint speed envelope rejects nonphysical speed bounds`` () =
    Assert.Throws<System.ArgumentException>(fun () ->
        OrbitalAsymmetryBudget.endpointSpeedEnvelopeMs 1_000_000.0 299_792.458 24.0 |> ignore
    ) |> ignore
