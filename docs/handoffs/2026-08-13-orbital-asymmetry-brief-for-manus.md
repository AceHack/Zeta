# Earth–Mars light-time asymmetry — independent-check brief for an external model (Manus)

**Purpose.** Hand this to a strong math/physics model with **no access to our repository**. Everything
needed is inline. We are not asking it to read code — we are asking it to **derive the right answers
independently**, so we can compare.

**Why independence matters here.** These defects were found by a single model. Nothing has checked
them. We would rather have two derivations that agree than one that sounds right — and if the two
disagree, that disagreement is the most valuable output.

---

## The system

A database bus spanning Earth and Mars. Messages carry timestamps, and the system convicts a message
as **`OutOfCone`** when it could not causally have influenced another — i.e. it enforces a light cone
over an interplanetary link.

Because the two endpoints orbit, the one-way light time A→B differs from B→A, and both vary. A
module computes a **conservative bound `δ_max`** on that asymmetry, and feeds it to the conviction
logic **specifically to prevent false `OutOfCone` convictions**. If `δ_max` is too small, honest
messages are convicted.

## What the code currently does

Model as stated in its own docstring: *"Pure Keplerian (no perturbations). Accurate to ~1% for inner
planets, ~3% for Mars."*

```text
r(θ) = a(1-e²) / (1 + e·cos θ)            two-body orbit
d(t) = |r_A(t) - r_B(t)|                  3D ecliptic separation
τ    = d / c                              one-way light time
δ    = |τ(A→B) - τ(B→A)|  ≈  v_B · RTT / c
```

Constants: `c = 299 792.458 km/s`. Elements are J2000.0 mean elements (source: Seidelmann 1992,
*Explanatory Supplement to the Astronomical Almanac*, Table 5.8.1), with `J2000 = JD 2451545.0`:

```text
Earth: a = 149 597 870.7 km,  e = 0.01671022, n = 0.01720209895 rad/day,
       M0 = 6.240060 rad,     i = 0.0 rad
Mars:  a = 227 936 637.0 km,  e = 0.09341233, n = 0.00914709   rad/day,
       M0 = 0.33972 rad,      i = 0.03229 rad,  Ω = 0.86534 rad
```

Heliocentric position, as implemented (this is verbatim logic, not a paraphrase):

```text
dt  = jd - J2000
M   = M0 + n·dt
E   = solveKepler(M, e)                    # eccentric anomaly
ν   = 2·atan2( sqrt(1+e)·sin(E/2), sqrt(1-e)·cos(E/2) )
r   = a·(1 - e·cos E)
x   = r·cos ν
y   = r·sin ν·cos i
z   = r·sin ν·sin i
```

Asymmetry, as implemented:

```text
û      = (r_B - r_A) / |r_B - r_A|         # unit vector A→B
v_B    = heliocentric velocity of B
vProj  = v_B · û                           # ONLY B's velocity
rtt    = 2·d / c
δ_max  = |vProj| · rtt / c · 1000 · 1.2    # ms, with a "20% conservative margin"
```

## The three claimed defects — please derive independently, do not take these on trust

### D1 — the ephemeris is phase-wrong

Claim: using the true anomaly `ν` **directly as ecliptic longitude** sets the longitude of perihelion
ϖ = 0 for every body. Real values are Earth ϖ ≈ 102.9°, Mars ϖ ≈ 336.0°. (The `Ω` field above is
populated in the code and never read.)

**Asked:** Is that right? Write the correct transformation from orbital elements to heliocentric
ecliptic coordinates, being explicit about ω (argument of perihelion), Ω (longitude of ascending
node), and ϖ = Ω + ω, and about which of those the code has dropped.

**Claimed consequence, please check it numerically and independently:** on **2027-02-19** the
corrected model gives an Earth–Mars separation of ≈ **101.4 Gm** (a near-opposition), while the code
as written gives ≈ **357.7 Gm** — i.e. it reports near-*conjunction* on a date that is actually near
*opposition*. Confirm or refute both numbers, and state the date of the true 2027 opposition.

### D2 — δ is not the asymmetry, and the "conservative" claim may be false

Claim: the first-order asymmetry is governed by the **relative** range rate
`ḋ = (v_B - v_A)·û`, not by `v_B·û` alone. Earth's orbital speed (≈29.8 km/s) is the same order as
Mars's (≈24 km/s), so dropping `v_A` is not a small correction. A configuration was found where
true/computed ≈ **54×** (computed 0.28 ms vs true 15.1 ms), which would make the documented "20%
conservative margin" false in the dangerous direction.

**Asked:**

1. Derive the correct one-way light-time asymmetry from first principles. Start from the light-time
   equations `c·τ_AB = |r_B(t + τ_AB) - r_A(t)|` and `c·τ_BA = |r_A(t + τ_BA) - r_B(t)|`, and give
   the leading-order expression for `|τ_AB - τ_BA|`.
2. Is `|ḋ|·τ/c` the right leading term? Give the next-order term and say when it matters.
3. Find the **worst-case** configuration over a synodic period and give the true maximum asymmetry in
   milliseconds. That number is what the bound must actually cover.
4. Propose a genuinely conservative bound with a stated derivation, not a fudge factor.

### D3 — occlusion is unrepresented

The code has no solar-radius or Sun–Earth–probe-angle test, so near conjunction it returns a **finite
τ for a path passing through the Sun**.

**Asked:** State the correct geometric predicate for "no line-of-sight" (including a sensible solar
corona exclusion — real deep-space missions use a SEP-angle threshold; say what you would use and
why), and give the 2027 date range during which an Earth–Mars link would be occluded or degraded.

## What is claimed NOT to matter — please check these too, they are the easiest place for the first model to have been wrong

- **Shapiro delay is claimed to be negligible here:** ≈0.12 ms one-way at grazing conjunction
  (≈0.25 ms RTT, consistent with the Viking-lander measurements), with an *asymmetry* contribution of
  only ≈0.4 µs — orders below D2. Confirm the magnitudes.
- **Hyperbolicity is claimed not to fail at conjunction.** Reasoning given: cold coronal plasma adds a
  lower-order term (`ω_p²A`) to the wave operator, leaving the principal symbol unchanged; magnetised
  corona splits O/X modes but both factors stay hyperbolic; and at 8–32 GHz we are far above the
  coronal plasma frequency (≲100 MHz). The conclusion drawn was that there is **no date range on
  which the link's evolution is ill-posed**. This killed an idea we were attached to, so it is exactly
  the claim we most want a second opinion on.
- **Earth–Mars clock-rate divergence** (gravitational + kinematic) claimed at ≈3.4 ns/s ≈ **0.3 ms/day
  secular**. Confirm.

## What a good answer looks like

- **Numbers with derivations**, not assertions. We will diff yours against the first model's.
- **Where you disagree, say so loudly.** Disagreement is the point of this exercise; agreement that
  turns out to be deference is worse than useless.
- **Test vectors we can lock in:** dates and separations we can turn into golden-vector regression
  tests. A known opposition and a known conjunction with distances would be ideal.
- **Exact arithmetic preferred where possible.** Results get byte-locked across four language
  implementations (F#, C#, Rust, TypeScript), so anything sensitive to floating-point evaluation order
  needs flagging. Where floats are unavoidable (they are, here), tell us the precision that matters.
- **Cite sources** — Seidelmann, Murray & Dermott, JPL ephemerides (DE440/441), or whatever you use.

## Context you may want

This is a bound used to *avoid wrongly accusing a message of violating causality*. Being too generous
costs a little precision. Being too tight causes false convictions of honest data. So a bound that is
provably conservative beats a bound that is usually accurate.
