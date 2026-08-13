---
id: 081KZY5W6AJ087G0R003EE7PY6
type: bug
state: backlog
priority: P2
slug: orbitalasymmetrybudget-ephemeris-phase-wrong-delta-max-not-c
title: "OrbitalAsymmetryBudget: ephemeris phase-wrong, delta-max not conservative (54x), occlusion unrepresented"
created: 2026-08-13T18:24:13.138Z
depends_on: []
composes_with: []
---

# OrbitalAsymmetryBudget: ephemeris phase-wrong, delta-max not conservative (54x), occlusion unrepresented

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZY5W6AJ087G0R003EE7PY6-*.md` glob. -->

Module: `src/Bayesian/OrbitalAsymmetryBudget.fs`. It computes `deltaMaxMs` for
`BusRegime.regimeOf`, whose stated purpose is **to prevent false `OutOfCone`
convictions on asymmetric paths**. Two of the three defects below make it fail at
exactly that job, so the consequence is *wrongly convicting honest messages*.

Found by Lumen (mathematical-physics) 2026-08-13; defects 1 and 2 independently
re-verified against the source before filing.

## Defect 1 — the ephemeris is phase-wrong (up to half a synodic period)

`helioPos` (:75-90) uses the true anomaly `nu` directly as ecliptic longitude:

```fsharp
let x = r * cos nu
let y = r * sin nu * cos el.I_rad
```

The in-line comment concedes it — `// Ecliptic coordinates (simplified: Ω=0, ω=0
for this conservative model)` — which sets the longitude of perihelion ϖ = 0 for
**every** body. Real values: Earth ϖ = 102.9°, Mars ϖ = 336.0°.

`Omega_rad` **is populated for all five bodies** (:42-53; Mars = 0.86534) and is
**never read anywhere in the file** (grep: declaration and initialisers only). A
field carrying real data that nothing consumes reads as modelled when it is not.

Consequence (Lumen, recomputed with correct ϖ): for **2027-02-19** the corrected
model reproduces the true opposition (101.4 Gm) to within 2 days, while the shipped
model reports **357.7 Gm** — i.e. it reports *near conjunction on a date when
reality is opposition*. The docstring's "~3% for Mars" (:18-19) is off by ~3.5×.

## Defect 2 — δ is not the asymmetry, and "conservative" is false

`:130-140` projects **only B's** heliocentric velocity onto the A→B unit vector:

```fsharp
let vx, vy, vz = helioVel bodyB jd
let vProj = vx * ux + vy * uy + vz * uz
abs vProj * rttS / C_KM_S * 1000.0 * 1.2
```

The first-order asymmetry is governed by the **relative** range rate,
`ḋ = (v_B − v_A)·û`, not `v_B·û`. Earth's orbital speed (29.8 km/s) is the same
order as Mars's (24 km/s), so dropping `v_A` is not a small correction.

Lumen found configurations where true/computed = **54×** (code 0.28 ms vs true
15.1 ms). The trailing `* 1.2` is documented as a "20% conservative margin"; a 54×
underestimate means the *conservative upper bound* claim is **false**, and an
under-estimated δ_max is precisely what produces the false `OutOfCone` convictions
this module exists to prevent.

## Defect 3 — occlusion is unrepresented

No solar-radius or Sun-Earth-Probe-angle predicate exists (`rg 'Sun|R_sun|occlu|SEP'`
→ nothing). Near conjunction the function returns a **finite τ for a path that
passes through the Sun**. There is no causal contact on that path at all; returning
a number for it is the session's recurring defect class in physical form — a check
that did not run wearing the name of one that did.

## What is NOT the problem (recorded so it is not re-litigated)

- **Shapiro delay is not the dominant error.** At grazing conjunction it is
  ≈0.12 ms one-way (≈0.25 ms RTT, consistent with Viking), and its *asymmetry*
  contribution is ≈0.4 µs — orders below defect 2.
- **Hyperbolicity does not fail at conjunction.** Coronal plasma adds a lower-order
  term to the wave operator, leaving the principal symbol unchanged; magnetised
  corona splits O/X modes but both stay hyperbolic, and 8-32 GHz is far above the
  coronal plasma frequency (≲100 MHz). There is no "date range where the fold is
  ill-posed" — that hypothesis is dead.

## Fix shape

1. Read `Omega_rad` (and add ω / ϖ) in `helioPos`; assert against a known opposition
   date (2027-02-19, 101.4 Gm) as a golden vector.
2. Use `(v_B − v_A)·û` for the range rate; re-derive the margin, or drop the word
   "conservative" if it cannot be justified.
3. Return `float option` (or an explicit `Occluded` case) so an impossible path is
   representable, and thread that through `BusRegime.regimeOf`.
4. While there: `C_KM_S` (:29) hardcodes the EM cone. `BusRegime.regimeOf`
   (`BusRegime.fs:72`) already takes `deltaMaxMs` as an injected value, so the cone is
   a declared channel *there* but an ambient constant *here*. Injecting a
   `ray : pos -> pos -> jd -> float option` makes the principal polynomial supplied
   rather than assumed — §13 noninterference applied to the causal structure — and
   lets a differently-propagating channel drop in unchanged.

## Related

- `tests/Bayesian.Tests/OrbitalAsymmetryBudget.Tests.fs` — existing coverage did not
  catch any of these; a golden vector on a known opposition would have caught #1.
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — unaffected and still
  correct; the Earth-Mars clock-rate divergence (≈3.4 ns/s ≈ 0.3 ms/day secular) is
  real, and the rule already makes the shared fold immune to it.
