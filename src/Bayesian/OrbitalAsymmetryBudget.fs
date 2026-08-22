namespace Zeta.Bayesian

/// OrbitalAsymmetryBudget — dynamic δ_max (ms) from Kepler two-body mechanics.
///
/// Computes the conservative one-way light-travel-time asymmetry budget for a pair of
/// Solar System bodies at a given Julian Date (JD). The budget feeds directly into
/// `BusRegime.regimeOf` as `deltaMaxMs` to prevent false `OutOfCone` convictions on
/// asymmetric paths (caveat (b), 2026-08-02).
///
/// **Model:**
///   Two-body Kepler orbit: r(θ) = a(1-e²) / (1 + e·cos θ)
///   Distance between bodies: d(t) = |r_A(t) - r_B(t)| (vector, 3D ecliptic)
///   One-way light travel: τ = d / c
///   Asymmetry budget: δ = |τ(A→B) - τ(B→A)| ≈ v_B · RTT / c
///     where v_B is the component of B's velocity along the A→B direction.
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
    /// **Register: `Assumption`, and that is the finding, not an oversight.** The shipped
    /// expression below is `|v_B·û| · RTT / c · 1.2`, and neither factor is derived:
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
    /// **The value is unchanged by this typing.** Replacing it is
    /// `081KZYK0Q8Z087G0R0010Z2Z2Q`, not this change; moving a number while retyping it would
    /// hide the retyping. What changed is that the register is now in the code instead of in a
    /// review document, and that a future margin cannot be added as a silent multiplier —
    /// `BoundJustification.Bound` has no multiply, so widening costs a named term and a reason.
    let internal deltaMaxBound (bodyA: string) (bodyB: string) (jd: float) : BoundJustification.Bound =
        let ax, ay, az = helioPos bodyA jd
        let bx, by, bz = helioPos bodyB jd
        let dx, dy, dz = bx - ax, by - ay, bz - az
        let dist = sqrt (dx*dx + dy*dy + dz*dz)

        let shippedMs =
            if dist < 1.0 then 0.0 // same body
            else
                // Unit vector A→B
                let ux, uy, uz = dx / dist, dy / dist, dz / dist
                // Velocity of B (km/s)
                let vx, vy, vz = helioVel bodyB jd
                // Component of B's velocity along A→B
                let vProj = vx * ux + vy * uy + vz * uz
                // RTT in seconds
                let rttS = 2.0 * dist / C_KM_S
                // Asymmetry in ms, with 20% conservative margin
                abs vProj * rttS / C_KM_S * 1000.0 * 1.2

        BoundJustification.Bound.ofTerms
            [ { Name = "delta_speed_projection_x1.2 (shipped)"
                Value = shippedMs
                Why =
                  BoundJustification.Assumption
                      ("Velocity-projection estimator times an underived 1.2. The projection is not a bound "
                       + "(it vanishes at the zero crossing while the true asymmetry does not), and the 1.2 "
                       + "covers nothing the sharp envelope can produce. Replacement is filed as "
                       + "081KZYK0Q8Z087G0R0010Z2Z2Q; see docs/research/"
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
