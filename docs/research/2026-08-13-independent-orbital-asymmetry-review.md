# Independent Review: Earth–Mars Orbital Asymmetry Budget

**Status:** Independent derivation complete; the delivered `OrbitalAsymmetryBudget.fs` is **not yet cleared for use as a conservative `δ_max` source**. The review validates the coordinate-rotation defect and the missing solar-occlusion predicate, but it **falsifies** the brief’s proposed replacement `|v_B-v_A|·R/c²` under the two implicit light-time equations stated below. The conservative replacement is a non-cancelling endpoint-speed envelope, pending a Horizons-backed golden-vector test suite.

## Scope and method

This review deliberately does not import or invoke the F# budget calculation. The independent checker in `src/Core.TypeScript/planning/orbital-independent-check.ts` evaluates the published mean elements using the full ecliptic transform

\[
r_{\mathrm{ecl}} = R_z(\Omega)R_x(i)R_z(\omega)(r\cos\nu,r\sin\nu,0),
\]

then solves the stated retarded-position light-time equations by fixed point iteration. JPL Horizons is the external reference oracle: it can return geometric vectors, light time, range, and range rate in a specified frame and unit system.[1]

> **Boundary:** The numerical scan is an independent two-body calculation, not a navigation ephemeris. It is adequate to falsify a claimed conservative property and to produce candidate vectors. JPL Horizons must supply the locked production vectors.

## 1. Coordinate transform: confirmed defect

The delivered routine uses `x=r·cosν`, `y=r·sinν·cos i`, and `z=r·sinν·sin i`. It stores Mars’ longitude of ascending node but does not apply it, and it omits argument of perihelion altogether. This makes true anomaly act as ecliptic longitude.

At NASA’s published 2027 Mars opposition time, **2027-02-19 16:02:32 UTC**, the external reference range is **101,417,205 km**.[2] The independent full-rotation mean-element calculation gives **101,435,587 km**, a 0.018% difference; the delivered simplified geometry gives **358,716,223 km**, a 254% overstatement. The corrected coarse scan finds its local minimum near **2027-02-20 24:00 UTC**; the delivered geometry’s local minimum appears near **2027-04-30 24:00 UTC**.

| Vector | External / corrected result | Delivered simplified geometry | Falsifier |
|---|---:|---:|---|
| 2027 opposition range | 101,417,205 km (NASA) | 358,716,223 km | Difference exceeds any model-error allowance |
| Corrected coarse minimum | 2027-02-20.999 UTC | 2027-04-30.999 UTC | Date error exceeds 3 days by more than two months |
| Horizons geometric light time at the opposition epoch | 338.2914 s | Derived from 101.4M km | Confirms the reference range scale [1] |

The correction is therefore not cosmetic. The implementation needs explicit `Ω` and `ω` fields for every body and must rotate perifocal coordinates through `R_z(Ω)R_x(i)R_z(ω)` before taking body differences.

## 2. One-way light-time asymmetry: the relative-rate replacement is falsified

For the equations supplied in the brief,

\[
\tau_{AB}=\frac{\|r_B(t+\tau_{AB})-r_A(t)\|}{c},\qquad
\tau_{BA}=\frac{\|r_A(t+\tau_{BA})-r_B(t)\|}{c},
\]

a first-order expansion about the common epoch gives

\[
\tau_{AB}\approx\frac{R}{c}+\frac{\hat u\cdot v_B}{c}\frac{R}{c},\qquad
\tau_{BA}\approx\frac{R}{c}-\frac{\hat u\cdot v_A}{c}\frac{R}{c}.
\]

Thus their difference has leading magnitude

\[
\left|\tau_{AB}-\tau_{BA}\right|\approx
\frac{R}{c^2}\left|\hat u\cdot(v_A+v_B)\right|,
\]

not the relative range-rate `|û·(v_B-v_A)|R/c²`. The latter corresponds to a different timing/convention and cannot be substituted into these two equations without changing the model.

At the 2027 opposition snapshot, the independently solved value is **1.671374 ms**. The sum-velocity leading term is **1.673724 ms**. The proposed relative-rate expression is **0.600902 ms**, under by approximately 64%. The currently delivered B-only expression—even with its 20% multiplier—is **1.287386 ms**, also under the direct solve.

| Candidate at 2027 opposition | Value | Verdict |
|---|---:|---|
| Direct fixed-point solve | 1.671374 ms | Independent reference within this two-body model |
| `|û·(v_A+v_B)|R/c²` | 1.673724 ms | Matches the stated-equation leading term |
| Proposed `|û·(v_B-v_A)|R/c²` | 0.600902 ms | **Falsified** for the stated equations |
| Delivered B-only, 20% margin | 1.287386 ms | **Not conservative** at this vector |

The cancellation hazard is real but is not repaired by replacing a B-only projection with the relative projection: the scan finds a B-only under-budget factor of approximately **22,297×** near a projected-Mars-velocity cancellation.

## 3. Conservative replacement requirement

Until an exact bounded retarded-state solver is supplied, use endpoint speed norms rather than any projection that may cancel. If `V_A` and `V_B` bound endpoint speeds at the relevant epoch and `R` is range, then the implicit equations imply the speed-only envelope

\[
\delta_{\mathrm{speed}}=1.2\max\left(
\frac{R}{c-V_B}-\frac{R}{c+V_A},
\frac{R}{c-V_A}-\frac{R}{c+V_B}
\right).
\]

The 1.2 multiplier here is an explicit model allowance, not a proof of perturbation coverage. It is non-cancelling because it depends only on speed norms. Across the independent 2026-01-01 through 2028-06-01 coarse scan, the direct solve never exceeded this envelope; the largest observed exact/envelope ratio was **0.71428**. That observation is a regression target, not a universal theorem.

The correction should additionally accept a deployment-provided `δ_model` and expose the final decomposition:

\[
\delta_{\max}=\delta_{\mathrm{speed}}+\delta_{\mathrm{model}}.
\]

`δ_model` cannot be silently replaced by a global constant: its provenance, ephemeris source, epoch span, and confidence margin must be emitted in the teaching error/readout.

## 4. Solar occlusion is a separate availability predicate

The independent scan finds geocentric solar elongation near **0.786°** around 2028-03-23. NASA operational guidance describes a command moratorium when Mars is within **3°** of the Sun, because solar-corona plasma can corrupt signals.[3] [4] This is not a claim that every link below 3° is geometrically impossible; it is an explicit policy/propagation availability boundary.

The link model must therefore report at least three distinct states:

| State | Required result |
|---|---|
| `Available` | Finite light-time and elongation at or above the configured policy threshold |
| `SolarConjunction` | Finite geometric light-time but elongation below the configured threshold; deadline verdict suppressed or policy-handled |
| `EphemerisUnknown` | Required state/range/elongation input missing or outside validated epoch; emits a teaching error with the recovery generator |

This prevents a finite vacuum `δ_max` from being misread as a usable command channel.

## 5. Lockable regression-vector requirements

The next code change should import fixed JPL Horizons reference values rather than query the network during tests. Every vector must record target/center, frame, correction mode, units, epoch scale, and source retrieval date.

| ID | Check | Candidate assertion |
|---|---|---|
| OAB-R1 | Coordinate rotation | At 2027-02-19 16:02:32 TDB/UTC-qualified vector, range must be within a declared tolerance of 101,417,205 km, not 358.7M km |
| OAB-R2 | Phase | Local 2027 opposition minimum must lie within 3 days of 2027-02-19 16:02:32 UTC |
| OAB-R3 | Asymmetry fault control | Synthetic projected-`v_B=0`, nonzero projected-`v_A` must not yield `δ_max=0` |
| OAB-R4 | Conservatism | Direct fixed-point solve must not exceed `δ_speed + δ_model` for every checked epoch |
| OAB-R5 | Occlusion | A vector with SEP below the configured threshold must return `SolarConjunction`, never `Available` solely because its vacuum range is finite |
| OAB-R6 | Unknown state | Missing ephemeris/body/epoch support returns a teaching error with an actionable generator, not a zero budget |

## 6. Implementation disposition

1. **Do not merge** a `relative range-rate` replacement as a conservative repair under the currently stated equations; it is independently falsified.
2. **Do replace** the missing-coordinate transform and B-only projection with a full-frame state model plus non-cancelling speed envelope.
3. **Do add** a separate SEP/solar-conjunction availability predicate and policy threshold.
4. **Do lock** JPL Horizons values only after a second independent reviewer validates target/center/frame/time-scale settings.

## References

[1]: https://ssd-api.jpl.nasa.gov/doc/horizons.html "JPL Horizons API documentation"
[2]: https://staging.mars.jpllab.net/all-about-mars/night-sky/opposition/ "NASA Mars opposition table"
[3]: https://staging.mars.jpllab.net/all-about-mars/night-sky/solar-conjunction/ "NASA Mars solar conjunction guidance"
[4]: https://www.nasa.gov/solar-system/whats-mars-solar-conjunction-and-why-does-it-matter/ "NASA: What’s Mars Solar Conjunction, and Why Does It Matter?"
