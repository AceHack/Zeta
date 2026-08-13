# Independent Orbital-Asymmetry Source Notes

These source notes preserve the external references used for the independent check requested in Otto’s 2026-08-13 brief. They are not a discharge certificate; the numerical outputs below come from `src/Core.TypeScript/planning/orbital-independent-check.ts`, which is intentionally independent of the shipped F# implementation.

| Source | Relevant fact | Use in review |
|---|---|---|
| JPL Horizons API documentation [1] | Horizons exposes vector ephemerides, geometric versus light-time corrections, and range/range-rate output; it supports ecliptic frames and KM-S units. | Reference oracle for eventual golden vectors, rather than treating the simplified Kepler model as ephemeris truth. |
| NASA Mars opposition page [2] | It lists Mars opposition at **2027-02-19 16:02:32 UTC** and Earth–Mars distance **101,417,205 km**. | Independent anchor for the phase test. |
| NASA Mars solar-conjunction page [3] | A 2025–2026 command moratorium applied when Mars was within **3°** of the Sun. | Operational SEP threshold example; this is radio-propagation policy, not physical occultation geometry. |
| NASA conjunction explainer [4] | Solar-corona plasma can corrupt Mars radio commands during conjunction and NASA uses a command moratorium. | Supports distinguishing finite geometric distance from usable communications path. |

## Independent numerical snapshot

At the stated 2027 opposition timestamp, the independent Kepler implementation with perihelion rotations restored produced **101.4355867 Gm**. The delivered simplified geometry produced **358.7162226 Gm**. The NASA opposition table’s 101.417205 Gm is a close external check on the corrected simple model.

For the two implicit retarded-position equations stated in the brief, the leading asymmetry term is governed by the **sum** of projected endpoint velocities under the stated emission-time convention, not the relative range rate: `|u·(v_A + v_B)| R/c²`. At the opposition snapshot, direct fixed-point light-time solving gave **1.6713744 ms**; the sum-velocity leading term gave **1.6737238 ms**; the brief’s relative-velocity candidate gave **0.6009017 ms**; and the delivered B-only-with-20%-margin expression gave **1.2873865 ms**. Therefore the B-only budget is not conservative at this snapshot, but the requested relative-rate replacement also does not match these stated equations.

A coarse independent scan over 2026-01-01 through 2028-06-01 found a maximum exact asymmetry of **121.7644 ms** near 2026-09-06 and a worst B-only under-budget factor of **22,297×** near a B-projection cancellation. These are model-internal scan results, not JPL Horizons golden values; they must be rechecked at finer resolution and against Horizons before becoming locked regression vectors.

The same scan found a minimum geocentric solar elongation of approximately **0.786°** near 2028-03-23. This supports the unrepresented-occlusion finding: a finite vacuum light-time is not itself a usable-link predicate near solar conjunction.

## References

[1]: https://ssd-api.jpl.nasa.gov/doc/horizons.html "JPL Horizons API documentation"
[2]: https://staging.mars.jpllab.net/all-about-mars/night-sky/opposition/ "NASA Mars opposition table"
[3]: https://staging.mars.jpllab.net/all-about-mars/night-sky/solar-conjunction/ "NASA Mars solar conjunction guidance"
[4]: https://www.nasa.gov/solar-system/whats-mars-solar-conjunction-and-why-does-it-matter/ "NASA: What’s Mars Solar Conjunction, and Why Does It Matter?"
