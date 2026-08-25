namespace Zeta.Bayesian

/// OrbitalAsymmetryBudget — dynamic δ_max (ms) from Kepler two-body mechanics.
///
/// Computes the conservative one-way light-travel-time asymmetry budget for a pair of
/// Solar System bodies at a given Julian Date (JD). The budget feeds directly into
/// `BusRegime.regimeOf` as `deltaMaxMs` to prevent false `OutOfCone` convictions on
/// asymmetric paths (caveat (b), 2026-08-02).
///
/// **Model:**
///   The Earth–Mars consumer default is an epoch-free endpoint-speed envelope. It
///   bounds rectilinear light-time asymmetry using only a maximum separation and
///   endpoint speed norms, then adds a named Kepler-curvature residual. It does
///   not use a velocity projection, so it cannot cancel at a projection zero.
///   Other pairs retain their explicitly assumption-grade diagnostic estimate
///   until they receive their own pair-specific envelope.
///
/// **Accuracy:**
///   Pure Keplerian (no perturbations). Accurate to ~1% for inner planets, ~3% for
///   Mars. Good enough for the BusRegime conservative δ_max use case.
///
/// **References:**
///   Murray & Dermott (1999). Solar System Dynamics. Cambridge UP.
///   Seidelmann (1992). Explanatory Supplement to the Astronomical Almanac.
[<RequireQualifiedAccess>]
module OrbitalAsymmetryBudget =

    // ── Physical constants ──────────────────────────────────────────────────────────────────────────
    /// Speed of light in km/s.
    let private C_KM_S = 299_792.458

    /// Exact endpoint-speed envelope (ms) for rectilinear one-way light-time
    /// asymmetry. The two branches correspond to the two possible signs of the
    /// directional asymmetry; taking their maximum is required by the theorem in
    /// `LightTimeAsymmetry.lean` and the paired Z3 certificate.
    let endpointSpeedEnvelopeMs (rangeKm: float) (speedAkmS: float) (speedBkmS: float) : float =
        if rangeKm < 0.0 then invalidArg (nameof rangeKm) "range must be non-negative"
        if speedAkmS < 0.0 || speedBkmS < 0.0 || speedAkmS >= C_KM_S || speedBkmS >= C_KM_S then
            invalidArg "speedAkmS/speedBkmS" "endpoint speeds must be non-negative and subluminal"
        if rangeKm = 0.0 then 0.0
        else
            let aToB = rangeKm / (C_KM_S - speedBkmS) - rangeKm / (C_KM_S + speedAkmS)
            let bToA = rangeKm / (C_KM_S - speedAkmS) - rangeKm / (C_KM_S + speedBkmS)
            max aToB bToA * 1000.0

    // Earth–Mars all-epoch values from the endpoint-speed-envelope derivation:
    // R_max = Earth aphelion + Mars aphelion, and endpoint speed bounds are their
    // perihelion speeds. The speed term is rounded upward; curvature is additive,
    // not a multiplicative "safety margin".
    let private earthMarsSpeedEnvelopeMs = 253.5731
    let private earthMarsCurvatureResidualMs = 0.0277

    // ── Orbital elements (J2000.0 epoch) ───────────────────────────────────────────────────────────
    /// Orbital elements: (semi-major axis km, eccentricity, mean motion rad/day, mean anomaly at J2000 rad)
    type private OrbElems = { A_km: float; E: float; N_rad_day: float; M0_rad: float; I_rad: float; Omega_rad: float }

    /// J2000.0 = JD 2451545.0
    let private J2000 = 2_451_545.0

    /// Orbital elements at J2000.0 for supported bodies.
    /// Source: Seidelmann (1992), Table 5.8.1; mean elements, ecliptic J2000.
    let private elements = function
        | "earth" ->
            { A_km = 149_597_870.7; E = 0.01671022; N_rad_day = 0.01720209895; M0_rad = 6.240060; I_rad = 0.0; Omega_rad = 0.0 }
        | "mars" ->
            { A_km = 227_936_637.0; E = 0.09341233; N_rad_day = 0.00914709; M0_rad = 0.33972; I_rad = 0.03229; Omega_rad = 0.86534 }
        | "moon" ->
            // Moon relative to Earth barycentre; semi-major axis = mean Earth-Moon distance.
            { A_km = 384_400.0; E = 0.0549; N_rad_day = 0.2299715; M0_rad = 2.3542; I_rad = 0.08979; Omega_rad = 2.1824 }
        | "phobos" ->
            // Phobos relative to Mars barycentre.
            { A_km = 9_376.0; E = 0.0151; N_rad_day = 19.3564; M0_rad = 0.0; I_rad = 0.01745; Omega_rad = 0.0 }
        | "deimos" ->
            // Deimos relative to Mars barycentre.
            { A_km = 23_463.0; E = 0.0002; N_rad_day = 7.8531; M0_rad = 0.0; I_rad = 0.01745; Omega_rad = 0.0 }
        | name -> failwithf "OrbitalAsymmetryBudget: unknown body '%s'" name

    /// Parent body for satellite bodies (Moon orbits Earth; Phobos/Deimos orbit Mars).
    let private parentOf = function
        | "moon" -> Some "earth"
        | "phobos" | "deimos" -> Some "mars"
        | _ -> None

    // ── Kepler equation solver (Newton-Raphson) ─────────────────────────────────────────────────────
    /// Solve Kepler's equation M = E - e·sin(E) for eccentric anomaly E.
    let private solveKepler (m: float) (e: float) : float =
        let mutable ecc = m
        for _ in 1..10 do
            ecc <- ecc - (ecc - e * sin ecc - m) / (1.0 - e * cos ecc)
        ecc

    // ── 3D ecliptic position (km) ───────────────────────────────────────────────────────────────────
    /// Heliocentric ecliptic position vector (km) for a body at Julian Date jd.
    /// For satellite bodies (Moon, Phobos, Deimos), adds the parent body's heliocentric position.
    let rec private helioPos (body: string) (jd: float) : float * float * float =
        let el = elements body
        let dt = jd - J2000
        let m = el.M0_rad + el.N_rad_day * dt
        let ecc = solveKepler m el.E
        let nu = 2.0 * atan2 (sqrt (1.0 + el.E) * sin (ecc / 2.0)) (sqrt (1.0 - el.E) * cos (ecc / 2.0))
        let r = el.A_km * (1.0 - el.E * cos ecc)
        // Ecliptic coordinates (simplified: Ω=0, ω=0 for this conservative model)
        let x = r * cos nu
        let y = r * sin nu * cos el.I_rad
        let z = r * sin nu * sin el.I_rad
        // For satellite bodies, add the parent body's heliocentric position
        match parentOf body with
        | None -> x, y, z
        | Some parent ->
            let px, py, pz = helioPos parent jd
            x + px, y + py, z + pz

    // ── Velocity (km/s) ────────────────────────────────────────────────────────────────────────────
    /// Heliocentric velocity vector (km/s) for a body at Julian Date jd (finite difference, Δt=1s).
    let private helioVel (body: string) (jd: float) : float * float * float =
        let dt_days = 1.0 / 86400.0 // 1 second in days
        let x0, y0, z0 = helioPos body jd
        let x1, y1, z1 = helioPos body (jd + dt_days)
        x1 - x0, y1 - y0, z1 - z0

    // ── Distance and asymmetry budget ──────────────────────────────────────────────────────────────
    /// Distance in km between two bodies at Julian Date jd.
    let distanceKm (bodyA: string) (bodyB: string) (jd: float) : float =
        let ax, ay, az = helioPos bodyA jd
        let bx, by, bz = helioPos bodyB jd
        let dx, dy, dz = bx - ax, by - ay, bz - az
        sqrt (dx*dx + dy*dy + dz*dz)

    /// One-way light travel time in ms between two bodies at Julian Date jd.
    let oneWayMs (bodyA: string) (bodyB: string) (jd: float) : float =
        distanceKm bodyA bodyB jd / C_KM_S * 1000.0

    /// Round-trip time in ms between two bodies at Julian Date jd.
    let rttMs (bodyA: string) (bodyB: string) (jd: float) : float =
        2.0 * oneWayMs bodyA bodyB jd

    /// The A↔B asymmetry budget as a **justified** bound (ms) at Julian Date jd.
    ///
    /// The asymmetry arises because body B moves during the round-trip. The signal from A
    /// arrives at B's FUTURE position (A→B), but B's reply travels back to A's PAST position
    /// (B→A).
    ///
    /// **Earth–Mars register: `Derivation`.** Its endpoint-speed envelope is
    /// machine-checked under fixed-frame rectilinear motion, and the named curvature
    /// residual is an additive Kepler-model contribution. The result is epoch-free,
    /// so the known phase/finite-difference defects cannot enter `BusRegime`.
    ///
    /// **Other-pair register: `Assumption`, and that is the finding, not an oversight.** The legacy
    /// expression is `|v_B·û| · RTT / c · 1.2`, and neither factor is derived:
    ///
    /// - the projection `v_B·û` passes through **zero** while the true asymmetry does not, so
    ///   the ratio true/shipped is unbounded near the zero crossing — it is an *estimator*,
    ///   never a bound (PR #10387, reproduced independently in PR #10418);
    /// - the `1.2` is a fudge factor. The endpoint-speed envelope that *does* bound this
    ///   quantity is **sharp** — equality attained, exact rational witness
    ///   (`c=10, R=1, V_A=2, V_B=3` gives `τ_AB=1/7, τ_BA=1/12`) — so within the model there
    ///   is nothing left for a margin to cover, and the residuals that *are* uncovered are
    ///   additive rather than multiplicative.
    ///
    let internal deltaMaxBound (bodyA: string) (bodyB: string) (jd: float) : BoundJustification.Bound =
        match bodyA, bodyB with
        | a, b when a = b -> BoundJustification.Bound.ofTerms []
        | ("earth", "mars")
        | ("mars", "earth") ->
            BoundJustification.Bound.ofTerms
                [ { Name = "delta_speed_endpoint_envelope (Earth–Mars, all epochs)"
                    Value = earthMarsSpeedEnvelopeMs
                    Why =
                      BoundJustification.Derivation
                          ("Endpoint-speed norm envelope; maximum of both directional branches under "
                           + "rectilinear subluminal motion, rounded upward.",
                           "src/Core.Lean4/Lean4/LightTimeAsymmetry.lean; tools/Z3Verify/light-time-endpoint-speed-envelope.smt2") }
                  { Name = "delta_model_curvature (Earth–Mars Kepler two-body)"
                    Value = earthMarsCurvatureResidualMs
                    Why =
                      BoundJustification.Derivation
                          ("Additive curvature residual over one light-time interval; deliberately not a multiplier.",
                           "docs/research/2026-08-13-soraya-light-time-asymmetry-envelope-routing-and-proof.md") } ]
        | _ ->
            let ax, ay, az = helioPos bodyA jd
            let bx, by, bz = helioPos bodyB jd
            let dx, dy, dz = bx - ax, by - ay, bz - az
            let dist = sqrt (dx*dx + dy*dy + dz*dz)
            let shippedMs =
                if dist < 1.0 then 0.0
                else
                    let ux, uy, uz = dx / dist, dy / dist, dz / dist
                    let vx, vy, vz = helioVel bodyB jd
                    let vProj = vx * ux + vy * uy + vz * uz
                    let rttS = 2.0 * dist / C_KM_S
                    abs vProj * rttS / C_KM_S * 1000.0 * 1.2
            BoundJustification.Bound.ofTerms
                [ { Name = "delta_speed_projection_x1.2 (legacy diagnostic)"
                    Value = shippedMs
                    Why =
                      BoundJustification.Assumption
                          ("Velocity-projection estimator times an underived 1.2. The projection is not a bound "
                           + "(it vanishes at the zero crossing while the true asymmetry does not); this pair has no "
                           + "endpoint-speed envelope yet. See docs/research/"
                           + "2026-08-13-soraya-light-time-asymmetry-envelope-routing-and-proof.md.") } ]

    /// Conservative asymmetry budget δ_max (ms) for the A↔B link at Julian Date jd.
    ///
    /// The consumer-facing contract, unchanged: `string -> string -> float -> float`. The
    /// justification is an authoring-side concern and deliberately does not appear here —
    /// `BusRegime.regimeOf` takes an `int` of milliseconds and has no use for provenance.
    let deltaMaxMs (bodyA: string) (bodyB: string) (jd: float) : float =
        deltaMaxBound bodyA bodyB jd |> BoundJustification.Bound.value

    // ── Convenience: current JD from Unix epoch ms ──────────────────────────────────────────────────
    /// Convert a Unix timestamp (ms since 1970-01-01T00:00:00Z) to Julian Date.
    let unixMsToJd (unixMs: int64) : float =
        // JD of Unix epoch = 2440587.5
        2_440_587.5 + float unixMs / 86_400_000.0

    /// δ_max (ms) for the A↔B link at a Unix timestamp (ms).
    let deltaMaxMsAtUnix (bodyA: string) (bodyB: string) (unixMs: int64) : float =
        deltaMaxMs bodyA bodyB (unixMsToJd unixMs)

    // ── Named link presets ──────────────────────────────────────────────────────────────────────────
    /// Pre-computed δ_max for the Earth↔Mars link at a given JD.
    let earthMars (jd: float) : float = deltaMaxMs "earth" "mars" jd

    /// Pre-computed δ_max for the Earth↔Moon link at a given JD.
    let earthMoon (jd: float) : float = deltaMaxMs "earth" "moon" jd

    /// Pre-computed δ_max for the Mars↔Phobos link at a given JD.
    let marsPhobos (jd: float) : float = deltaMaxMs "mars" "phobos" jd

    /// Pre-computed δ_max for the Mars↔Deimos link at a given JD.
    let marsDeimos (jd: float) : float = deltaMaxMs "mars" "deimos" jd
