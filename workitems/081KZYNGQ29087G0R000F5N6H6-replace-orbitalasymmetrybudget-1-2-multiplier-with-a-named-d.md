---
id: 081KZYNGQ29087G0R000F5N6H6
type: task
state: backlog
priority: P2
slug: replace-orbitalasymmetrybudget-1-2-multiplier-with-a-named-d
title: "Replace OrbitalAsymmetryBudget 1.2 multiplier with a named delta_model; adopt the proved ephemeris-free constant envelope"
created: 2026-08-13T22:57:34.281Z
depends_on: []
composes_with:
  - 081KZY5W6AJ087G0R003EE7PY6
  - 081KZYK0Q8Z087G0R0010Z2Z2Q
---

# Replace OrbitalAsymmetryBudget 1.2 multiplier with a named delta_model; adopt the proved ephemeris-free constant envelope

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYNGQ29087G0R000F5N6H6-*.md` glob. -->

Successor to the **open questions** of `081KZYK0Q8Z087G0R0010Z2Z2Q`. Its two
explicitly-open items are now closed in opposite directions:

| Open question there | Outcome | Register |
|---|---|---|
| "The 1.2 multiplier is unjustified. It should be derived or dropped." | **DROP IT.** It cannot be derived, because the thing it multiplies is already sharp. | **PROVED** |
| "'Never exceeded across a coarse scan' is an observation, not a proof. A proof (or a counterexample) is wanted." | **PROOF DELIVERED**, for a rectilinear model, in two independent tools. No counterexample exists in that model. | **PROVED** |

Full routing decision, verdicts, and four refutation attempts:
`docs/research/2026-08-13-soraya-light-time-asymmetry-envelope-routing-and-proof.md`.

## Artifacts already on `main` (this is not a proposal, it is a landed proof)

- `tools/Z3Verify/light-time-endpoint-speed-envelope.smt2` — z3 4.16.0, QF_NRA.
  8 lemmas `unsat`; sharpness `sat` with an exact rational witness; 2 blocks that
  **drop a hypothesis** and confirm the envelope then breaks. 0.03 s.
- `src/Core.Lean4/Lean4/LightTimeAsymmetry.lean` — Lean 4.30.0-rc1 + Mathlib.
  Same theorem, kernel-checked, plus the 3D-to-scalar reduction the SMT encoding
  assumes. Zero `sorry`; axioms `[propext, Classical.choice, Quot.sound]` only.

## The work

### 1. Delete the `* 1.2` literal (`OrbitalAsymmetryBudget.fs:140`)

It is a fudge factor. The envelope is the **least** upper bound over the model
family — equality is attained when both endpoints move along the separation
direction at their declared speed bounds — so no multiplicative margin above 1 is
justified by anything the light-time solve can produce, and any margin below 1 is
unsafe. A multiplicative margin is also the wrong **shape**: it vanishes exactly
where the real residuals do not.

### 2. Replace it with a named, additive, injected `delta_model`

```
delta_max   = delta_speed + delta_model
delta_model = delta_curv + delta_Vsup + delta_ephem + delta_rel
```

| Term | Earth-Mars value | Register |
|---|---:|---|
| `delta_curv` — orbital curvature over the light-time arc | at most **0.0277 ms** (analytic); **0.0078 ms** measured | CHECKED |
| `delta_Vsup` — speed growth across the interval, if `V` is sampled at `t` | at most **0.0011 ms**; **0** with perihelion-speed constants | CHECKED |
| `delta_ephem` — `2 sigma_R / c` | source-dependent; **dominant**. Mean-element model: about 61 ms | needs the source's certified sigma |
| `delta_rel` — Shapiro/relativistic asymmetry | about 0.0004 ms per `081KZY5W6AJ087G0R003EE7PY6` | **not independently verified** |

Injected with declared provenance, not an ambient literal — section 13
noninterference applied to the budget.

### 3. Prefer the ephemeris-free constant for the `BusRegime` consumer

```
delta_speed(constant) = 253.5731 ms   from perihelion speeds + max range only
delta_curv            =   0.0276 ms
provable delta_max    = 253.6008 ms   Earth-Mars, all time, no ephemeris
```

Costs at most **0.0095% of RTT** in extra cone width, against a maximum true
asymmetry of 121.76 ms anywhere in the scanned window. It also:

- discharges the `delta_Vsup` hypothesis **exactly** (a perihelion speed bounds
  the speed at every epoch by construction);
- **removes the finite-difference velocity**, and with it the byte-lock blocker:
  `helioVel` differences two ~2.3e8 km positions 1 s apart, amplifying libm
  divergence by ~8 orders of magnitude, and `sin`/`cos`/`atan2` are not
  bit-identical across the four oracles. `sqrt` is correctly rounded and is.
- sidesteps **every** defect in `081KZY5W6AJ087G0R003EE7PY6` — the missing
  `Omega`/`omega`, the phase error, the velocity projection all live in machinery
  the constant does not use.

**This does NOT close `081KZY5W6AJ087G0R003EE7PY6`.** D3 (solar occlusion / SEP)
is a separate availability predicate and is untouched. A future consumer needing
a *tight* estimate rather than a bound still needs the ephemeris fixed and still
needs the JPL Horizons vectors that `081KZYK0Q8Z087G0R0010Z2Z2Q` correctly names
as blocking. The narrow claim: **for cone-widening, the constant strictly
dominates, and shipping it removes a false-conviction risk from `main` without
waiting on Horizons.**

### 4. Correct the "22,297x" in both work-items

The shipped budget is proportional to a projection that passes through **zero**
while the true asymmetry does not, so the under-budget ratio **diverges**.
Bisecting onto the crossing reaches 1.1e11x before double precision floors out.
`54x` (D2), `22,297x` (the proposal) and `535x` (this round, 2-hour grid) are the
same singularity sampled at three grid resolutions. (My `535x` and the `1.1e11x`
are computed against the **one-way** form; `deltaMaxMs` uses `rttS = 2R/c`, so its
own factor is about half each. Unaffected - half of unbounded is unbounded - but
stated with its convention, which is the point.) The correct statement is
**unbounded**; quoting a multiple makes an unbounded failure look bounded, and
makes `54 -> 22,297` read as a strengthened finding when it is a finer grid.

### 5. Declare the frame

The light-time equations reference a common epoch, so the asymmetry they define
is frame-relative. The theorem holds in any inertial frame the equations are
stated in, but tightness varies hugely: the module feeds **heliocentric**
velocities to every pair, so Earth-Moon carries two ~30 km/s speeds that nearly
cancel in truth and is loose by roughly 30x. Harmless, but the frame should be
declared rather than inherited from whatever `helioPos` returned. Frame choice is
a sound tightening lever; `1.2` was not.

## Coverage gaps to close alongside (engineering, cheap)

- **`tools/Z3Verify/*.smt2` runs in NO CI gate** — 10 files, now 11, zero gated.
  Add a step asserting the expected `sat`/`unsat` sequence.
- **`src/Core.TypeScript/planning/orbital-independent-check.test.ts` (PR #10387)
  runs in NO CI gate** — `gate.yml` runs `bun test` against named paths only. The
  independent check that falsified the first remedy does not re-run on any later
  commit.
- `src/Core.Lean4/` **is** gated, and `lean-orphan-modules.ts` fails the build on
  a silent orphan, which is why the Lean module was wired into `Lean4.lean` in the
  same commit.

## Related

- `081KZY5W6AJ087G0R003EE7PY6` — defect record. D1, D2's *finding*, D3 stand.
- `081KZYK0Q8Z087G0R0010Z2Z2Q` — the proposal (PR #10398). Its envelope is now
  **PROVED**; its `1.2` is **refuted as a margin**; its Horizons dependency is
  unchanged and still correct for the tight path.
- `docs/research/2026-08-13-independent-orbital-asymmetry-review.md` — PR #10387.
