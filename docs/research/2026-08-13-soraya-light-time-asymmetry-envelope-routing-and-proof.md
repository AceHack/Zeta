# Routing + verdict: the Earth-Mars light-time asymmetry envelope and its two magic numbers

**Author:** Soraya (formal-verification routing) - 2026-08-13
**Subjects:** `src/Bayesian/OrbitalAsymmetryBudget.fs`; work-items
`081KZY5W6AJ087G0R003EE7PY6` (defect record, Lumen) and
`081KZYK0Q8Z087G0R0010Z2Z2Q` (proposed replacement, filed off PR #10387).
**Prior rounds:** PR #10387 (independent external check, merged `6e9151bd44`),
PR #10398 (the filing of the proposal).

Aaron's framing of the job: *"yes magic numbers without proof."* Two of them.

---

## 0. Verdict, up front

| Constant | Register | Verdict |
|---|---|---|
| The endpoint-speed envelope `max(R/(c-V_B) - R/(c+V_A), R/(c-V_A) - R/(c+V_B))` | **PROVED** (z3 + Lean, two independent tools) | **It really is an upper bound** - but on a *rectilinear* model, not on Kepler. It is also **SHARP**, which is the load-bearing surprise. |
| The `* 1.2` multiplier | **REFUTED as a margin** | It is a fudge factor. It covers nothing the proved model can produce, and it is the wrong *shape* for the residuals that are genuinely uncovered - those are **additive**, not multiplicative. Replace with a named, three-term `delta_model`. |

And one finding neither prior document contains: **the whole ephemeris is
unnecessary for this use.** A closed-form constant of **253.60 ms**, computed
from perihelion speeds and maximum range with no ephemeris, no epoch, no
`Omega`, no `omega`, and no fixed-point solve, is provably conservative for
Earth-Mars forever - and costs at most 0.0095% of RTT in extra cone width.
Every defect in `081KZY5W6AJ087G0R003EE7PY6` lives in machinery this constant
does not need. See section 5.

---

## 1. Routing FIRST - the tool decision and its reasoning

This is a real-analysis bound over a transcendental fixed point. That framing is
correct about Kepler and **wrong about the theorem**, and noticing the difference
is the entire routing decision.

### The reframe that does the work

The claim to be proved is not about orbits. It is about **states**. The light-time
equations take `(r_A, v_A, r_B, v_B)` and return two numbers; Kepler's transcendental
equation only decides *which* states occur, never *what the bound does to a state*.
So quantify universally over states, drop Kepler entirely, and then:

- with `R = ||r_B - r_A||` and `u` the A-to-B unit vector,
  `||R*u + t*v||^2 = R^2 + 2*R*t*(u.v) + t^2*||v||^2` **exactly**;
- so the geometry enters only through the scalars `s = u.v` and `w = ||v||`, with
  `|s| <= w` by Cauchy-Schwarz;
- squaring the light-time equation is an **equivalence** (both sides positive),
  not a relaxation.

The result is a purely polynomial `forall`-sentence over the reals. No trig, no
`sqrt`, no fixed point, no ephemeris. That is the **decidable theory of real
closed fields** (Tarski 1951; Collins' CAD 1975) - precisely z3's `nlsat`
fragment. A problem that looked like it needed validated numerics is an 87-
millisecond SMT query once encoded over the right variables.

### The routing table, with the wrong-tool cost named

| Tool | Verdict | Cost of picking it wrongly |
|---|---|---|
| **TLA+ / TLC / TLAPS** | **Reject, categorically.** | No reals, no analysis. TLC would need a finite discretisation of a continuous space, and would then go green on a statement about the discretisation, not about the bound. This is the hammer bias in its purest form: **human-weeks spent producing false-green CI on a property the tool cannot express.** |
| **z3 / SMT (QF_NRA)** | **ROUTED - the algebraic core.** | Correct because of the reframe above. Cost of *not* picking it: months of Lean work on something a decision procedure settles instantly. Soundness caveat below. |
| **Lean 4 + Mathlib** | **ROUTED - the BP-16 cross-check, and it earns its place.** | Not redundant: it discharges the 3D-to-scalar reduction that the SMT encoding *assumes*, and it is kernel-checked with no solver trust. Cost of it being the *only* tool: elementary inequalities take hours in Lean that take milliseconds in z3. |
| **Interval arithmetic / validated numerics** | **Routed for the residual only** - the curvature term, where Kepler genuinely does appear. Deferred; a Taylor-remainder bound (section 4) is sufficient and cheaper. | Cost of over-reaching for it: CPU-days of branch-and-bound on the part that turned out to be algebraic. |
| **FsCheck / property test** | **Reject as evidence for a bound.** Fine as cheap regression. | Random sampling cannot certify a supremum. Adopting it *as the proof* reproduces exactly the defect being fixed - "never observed" standing in for "cannot happen". |
| **Bounded exhaustive scan** | **Keep, but only for what a scan can say** - the Kepler-vs-rectilinear residual, labelled as a scan over a stated window and step. | Cost of mislabelling: this is what both prior documents did. |

### Soundness caveat on z3, stated plainly

`unsat` from `nlsat` is a decision-procedure verdict, **not a replayable proof
object** - z3 emits no independently checkable certificate for non-linear real
arithmetic. That is exactly why BP-16 applies and why the Lean proof is not
ceremonial. Two tools, two trust bases, same theorem.

---

## 2. Magic number 1 - the endpoint-speed envelope: PROVED, with hypotheses named

**Theorem.** Fix an inertial frame. Let both endpoints move **rectilinearly** at
constant velocity over the light-time interval, with speeds bounded by
`V_A, V_B < c`, and let `R` be the range at the common transmit epoch. Then the
light-time equations each have a **unique** positive root, and

```
    R/(c + V_B)  <=  tau_AB  <=  R/(c - V_B)
    R/(c + V_A)  <=  tau_BA  <=  R/(c - V_A)
    |tau_AB - tau_BA|  <=  max( R/(c-V_B) - R/(c+V_A),  R/(c-V_A) - R/(c+V_B) )
```

Both branches are needed; which one binds depends on the sign of the asymmetry.

**Note which endpoint governs which light time.** `tau_AB` is bounded by
`V_B` - the *receiver's* speed - not the transmitter's. The asymmetry lives
entirely in which endpoint moved during the flight. That is the same structural
fact that makes the leading term carry the **sum** rather than the difference,
and it is worth stating in the receiver-vs-transmitter form because it is far
harder to get backwards than a sign.

**Proof (both tools).**
- `tools/Z3Verify/light-time-endpoint-speed-envelope.smt2` - 8 lemmas `unsat`
  (well-posedness L0a/L0b, one-sided bounds L1-L4, envelope M1/M2). **CHECKED**,
  z3 4.16.0, total runtime **0.03 s user**.
- `src/Core.Lean4/Lean4/LightTimeAsymmetry.lean` - the same statements,
  kernel-checked, plus `lightTime_le_of_vec`, which proves the 3D-to-scalar
  reduction the SMT file assumes.

The mathematical content is two lines. Upper bound: `(ct)^2 = R^2 + 2Rts + t^2 w^2
<= (R + tV)^2` since `s <= w <= V`; both sides positive, so `ct <= R + tV`.
Lower bound: `(ct)^2 >= (R - tw)^2`, so `ct >= R - tw >= R - tV`. That is all.

> A bound this elementary went two review rounds without anyone writing it down.
> The reason is worth naming: both prior documents reached for **numerical
> agreement** as their standard of evidence, and numerical agreement never
> prompts the question "what would make this false?" - which is the only question
> that finds a two-line proof.

### The hypotheses are load-bearing, and z3 says so

Two `push`/`pop` blocks in the SMT file **drop** a hypothesis and ask z3 to break
the envelope. Both return `sat`. **CHECKED.**

- **R1** - drop `|u.v| <= ||v||`: the envelope becomes falsifiable. Cauchy-Schwarz
  is not decoration.
- **R2** - let the actual speed exceed its declared bound `V`: falsifiable. So
  **`V_A`, `V_B` must bound the speed across the whole interval `[t, t + tau]`,
  not merely at the transmit epoch.** A velocity sampled at `t` does not discharge
  this hypothesis. A perihelion-speed constant does, exactly and for free
  (section 5). Measured size of the gap if you sample at `t` only: **0.0011 ms**
  for Earth-Mars - small, but it is a *hypothesis violation*, not a small error,
  and it belongs in `delta_model` rather than in an unstated assumption.

### What the theorem does NOT cover

Kepler orbits are not rectilinear. The theorem is about the rectilinear family;
the curvature residual is section 4, and it is bounded, and it is tiny, and it is
**additive**.

---

## 3. Magic number 2 - the `* 1.2`: it is a fudge factor. Say so.

### It is not a margin, because the thing it multiplies has no slack

The envelope is **sharp**. Equality is attained when both endpoints move along
the separation direction at exactly their declared bounds - A chasing B. Exact
rational witness, produced independently by z3 and re-checked in Lean with no
floating point anywhere:

```
c = 10,  R = 1,  V_A = 2,  V_B = 3   gives   tau_AB = 1/7,  tau_BA = 1/12
(tau_AB - tau_BA) * (c - V_B) * (c + V_A)  =  5  =  R * (V_A + V_B)
```

**CHECKED** - `envelope_sharp` in the Lean file, block `S1` in the SMT file.

So the un-multiplied envelope is the **least** upper bound over the model family.
`1.2` therefore cannot be "20% of headroom for what the model missed": within the
model, there is nothing left to miss. Any `k > 1` is pure looseness and any
`k < 1` is unsafe. **The 1.2 is doing no work that can be stated.**

### It is also the wrong SHAPE for the residuals that are real

The uncovered residuals do not scale with `delta_speed`. `delta_speed` scales as
`R (V_A + V_B) / c^2`; the residuals scale as follows, and a multiplicative
margin tracks none of them:

| Residual | Scaling | Earth-Mars magnitude | Register |
|---|---|---:|---|
| Orbital **curvature** over the light-time arc | `a tau^2 / c` | at most **0.0277 ms** (analytic); **0.0078 ms** measured | CHECKED, section 4 |
| **V-sup-over-interval** (if `V` is sampled at `t`) | `R a tau / c^2` | at most **0.0011 ms**; **exactly 0** with perihelion-speed constants | CHECKED |
| **Ephemeris position error** | `2 sigma_R / c` | mean-element model: the review's own 18,382 km miss is about **61 ms**. DE440: sub-microsecond. | PROPOSED (arithmetic mine; the 18,382 km is PR #10387's) |
| **Shapiro / relativistic** asymmetry near conjunction | independent of `V` | about 0.0004 ms per `081KZY5W6AJ087G0R003EE7PY6` | **NOT independently verified by me** |

The decisive line in that table is the third. **The dominant uncertainty is the
ephemeris, it is additive, and it is independent of `V_A + V_B` - so a
multiplicative margin on `delta_speed` cannot track it in either direction.**
Worse, a multiplicative margin **vanishes exactly where the additive residuals do
not**: in any frame where the endpoint speeds approach zero, `1.2 delta_speed`
goes to zero while curvature, ephemeris error and Shapiro do not. That is the
structural refutation of the multiplicative form, and it is the same
cancellation-hole argument PR #10387 correctly made against projections - applied
one level up, to the margin itself.

### What replaces it

Delete the literal. Emit the decomposition:

```
delta_max   = delta_speed + delta_model
delta_model = delta_curv + delta_Vsup + delta_ephem + delta_rel
```

with each term computed, provenanced, and reported - which is section 13
noninterference applied to the budget: the model allowance becomes a declared,
metered channel instead of an ambient literal. For Earth-Mars with perihelion-
speed constants, `delta_curv + delta_Vsup` is at most **0.0277 ms** and
`delta_Vsup` is **0**; `delta_ephem` is whatever the chosen source certifies;
`delta_rel` needs one independent check that this document did not do.

**Plainly: `1.2` is a fudge factor with no derivation in the original code, none
in `081KZY5W6AJ087G0R003EE7PY6`, and none in `081KZYK0Q8Z087G0R0010Z2Z2Q`. It
should not be carried forward a third time.**

---

## 4. What I tried to refute, and failed to

Four attempts. All independent of PR #10387's checker - a third implementation
(Python, analytic Kepler state including **analytic velocity**, no finite
difference, full `Rz(Omega) Rx(i) Rz(omega)` transform). All **CHECKED**.

**Attempt 1 - can Kepler curvature break the un-multiplied envelope?** Compared
the exact Kepler fixed-point solve against the exact *rectilinear* closed-form
solve at 21,000 epochs (1-hour step, 2026-01-01 to 2028-06-01), and expressed the
remaining slack in units of the local curvature allowance.

- max difference between Kepler and rectilinear over the window: **0.0078 ms**
- minimum slack under the envelope, in curvature-allowances: **2644x**

The envelope is never within 2,600 curvature-allowances of failing. Refutation
failed.

**Attempt 2 - is the V-sup-over-interval hole real?** Yes, but it is **0.0011 ms**
(max speed growth across one light-time interval: 0.00025 km/s). Real enough to
name as a hypothesis; far too small to be what `1.2` is for.

**Attempt 3 - does exact/envelope approach 1?** Golden-section refined:
**0.857119779**, against a theorem ceiling of 1. Dividing by 1.2 gives
**0.714266**, which reproduces PR #10387's reported `0.71428` **independently**.
That is a genuine confirmation of their number - and it also shows the `1.2` is
*not what makes the bound hold*: the un-multiplied envelope already has 14.3%
slack at the worst epoch found.

**Attempt 4 - is the "sum" leading term itself a bound?** **No, and this matters.**
Over the same window, measured in absolute terms because the relative metric
divides by a near-zero and blows up to a meaningless 122%:

| Leading term | max absolute error | max **under**-statement |
|---|---:|---:|
| sum, `u.(v_A + v_B)` scaled by `R/c^2` (correct) | 0.0061 ms | **0.0059 ms** |
| difference, `u.(v_B - v_A)` scaled by `R/c^2` (falsified) | 93.68 ms | **93.68 ms** |

The **sum** is confirmed as the correct leading term - PR #10387's positive
result reproduced independently, and Lumen's `(v_B - v_A)` remedy independently
re-falsified. But note the right-hand column: **even the correct sum term
under-states the truth somewhere.** A projection is an *estimator*, never a
*bound*. PR #10387's structural argument is confirmed, and it applies to their
own leading term too - which their document does not quite say.

Sanity check that passed as predicted: the sum term never exceeds the
un-multiplied envelope (0 violations in 10,614 samples), as Cauchy-Schwarz
requires.

### Correction to both documents: the "22,297x" is not a number

`081KZY5W6AJ087G0R003EE7PY6` reports the shipped budget under-stating by **54x**.
`081KZYK0Q8Z087G0R0010Z2Z2Q` quotes **22,297x** and calls it a strengthening. On
a 2-hour grid I get **535x**. All three are the same artifact.

> Precision note on my own figure, since this section is about imprecise ones:
> my `535x` and the divergence table below are computed against the **one-way**
> form of the shipped expression. `deltaMaxMs` actually uses `rttS = 2R/c`, so
> the shipped code's own factor is about **half** each number quoted here. The
> conclusion is unaffected - halving an unbounded quantity leaves it unbounded -
> but the ratio should be stated with its convention, which is the whole point
> of this subsection.

The shipped budget is proportional to the projection of Mars's velocity, which
passes through **zero** while the true asymmetry does not. So the ratio
**diverges**. Bisecting onto the zero crossing (CHECKED):

| projected v_B (km/s) | true / shipped |
|---:|---:|
| 7.27e-03 | 221x |
| 1.45e-09 | 1,115,093,759x |
| 1.47e-11 | 109,935,449,339x |

The last row floors out on double precision, not on physics. The honest
statement is *"the under-budget factor is unbounded"*. Any specific multiple is
a report of how close the sampling grid happened to land, and quoting one makes
an unbounded failure look like a bounded one. That `54` to `22,297` reads as
"the second review strengthened the finding" is particularly misleading: it is
the same singularity, sampled twice.

---

## 5. The finding neither prior document contains: drop the ephemeris

The envelope depends on `R`, `V_A`, `V_B` and is **monotone increasing in all
three**. So replace each with a closed-form worst case over all time:

- perihelion speed from vis-viva, `V_max = sqrt(GM (1+e) / (a (1-e)))` (Kepler
  1609; Newton 1687). Earth **30.28663 km/s**, Mars **26.49939 km/s**.
- `R_max = a_E (1+e_E) + a_M (1+e_M)` = **401.326 Gm** (aphelion-to-aphelion,
  opposed).

```
delta_speed(constant) = 253.5731 ms      no ephemeris, no epoch, no solve
delta_curv            =   0.0276 ms
provable delta_max    = 253.6008 ms      Earth-Mars, all time
```

**CHECKED** (arithmetic mine, elements as already present in the module).

Why this is the right answer for *this* consumer, not a lazy one:

- `BusRegime.regimeOf` computes `best <= deadlineMs + max 0 deltaMaxMs`. The
  error is one-directional: too large is a **missed detection**, too small is a
  **false conviction**. `081KZYK0Q8Z087G0R0010Z2Z2Q` states this correctly and
  then does not follow it to its conclusion.
- The constant costs at most **0.0095% of RTT** in extra cone width (253.6 ms
  against a 2677 s round trip at maximum range). The maximum true asymmetry
  anywhere in the scanned window is **121.76 ms**, so the constant is about 2.1x
  the true worst case. For a zero-input bound that is remarkably tight.
- `deltaMaxMs` is an **`int` of milliseconds** at the call site. Sub-millisecond
  model precision is discarded by the consumer's own type.
- It discharges the V-sup-over-interval hypothesis **exactly**: a perihelion
  speed bounds the speed everywhere on the orbit, at every epoch, by construction.
- **It deletes the byte-lock problem.** The envelope needs only speed *norms*,
  which have a closed form, so no velocity vector, so **no finite difference**.
  This matters concretely: the shipped `helioVel` differences two positions of
  magnitude about 2.3e8 km taken one second apart, which amplifies libm
  divergence by roughly eight orders of magnitude (positions carry about 1e-16
  relative error; the resulting 24 km difference inherits about 1e-9). Since
  `sin`, `cos` and `atan2` are **not** bit-identical across .NET, Rust,
  TypeScript and Lean, `deltaMaxMs` as written **cannot be byte-locked across the
  four oracles at double precision.** A constant, or a vis-viva speed, has no
  such problem. *This is the precision that actually matters here, and it is a
  property of the finite difference, not of the bound.*

Every defect in `081KZY5W6AJ087G0R003EE7PY6` - the missing `Omega` and `omega`,
the phase error, the velocity projection - lives in machinery the constant does
not use. This is Rodney's Razor at the foundation: the ephemeris is not
irreducible for this consumer.

**This is not a reason to close the defect record.** D3 (solar occlusion / SEP)
is a genuinely separate *availability* predicate, untouched by any of this; and
if a future consumer needs a *tight* asymmetry estimate rather than a bound, the
ephemeris must be fixed. The claim should stay narrow: **for `BusRegime`'s
cone-widening, the constant strictly dominates**, and the tight version can be
built later against Horizons vectors without a false-conviction risk sitting in
`main` in the meantime.

### Suggested shape

```
delta_max(A, B) = delta_speed(R_bound, V_A_bound, V_B_bound) + delta_model
```

`R_bound` and the two `V` bounds are per-pair constants with declared
provenance; `delta_model` is injected, not literal. If a caller supplies a live
`R`, the bound tightens and stays valid - the theorem holds for **any** valid
bounds, which is why this shape does not foreclose the ephemeris path.

---

## 6. Is the endpoint-speed envelope the right shape at all?

Asked to say so if not. My answer: **yes, with one caveat the proposal does not
raise, and one structural improvement it misses.**

- **Right, because it is speed-norm-only.** PR #10387's argument that any
  projection has a cancellation hole is correct, and section 4 shows it holds
  even for their own (correct) sum term. Speed norms cannot cancel. That is the
  right structural choice and it is now a theorem rather than a scan.
- **Caveat the proposal does not raise: the envelope is frame-dependent, and so
  is the quantity it bounds.** The light-time equations reference a common epoch
  `t`, so "simultaneous transmission" is a coordinate-simultaneity statement in
  one frame. The theorem holds in **any** inertial frame in which the equations
  are stated, but the *tightness* varies enormously with frame choice - the
  shipped module uses heliocentric velocities for **every** pair, so the
  Earth-Moon budget carries two ~30 km/s heliocentric speeds that very nearly
  cancel in truth, and is loose by roughly 30x as a result. Harmless for
  Earth-Mars; the frame choice should nevertheless be **declared**, not
  inherited from whatever `helioPos` happened to return. Choosing the frame is a
  far better tightening lever than any multiplier, and unlike `1.2` it is sound.
- **Improvement it misses:** the review derives the envelope with *instantaneous*
  speeds and then adds `1.2`. The bounds-over-the-orbit variant is both **more**
  conservative and **cheaper** (section 5), and it discharges a hypothesis the
  instantaneous form leaves open. That inversion - the provable version is the
  cheap one - is the routing lesson of this round.

## 7. Coverage gaps found while routing

Portfolio state, so it is visible rather than assumed:

- **`tools/Z3Verify/*.smt2` is in NO CI gate.** Ten `.smt2` files, zero of them
  run on any workflow (`grep Z3Verify .github/workflows/` returns nothing).
  Including the one added here. They are proofs that nobody re-checks.
- **PR #10387's `orbital-independent-check.test.ts` is in NO CI gate either.**
  `gate.yml` runs `bun test` against explicitly named paths;
  `src/Core.TypeScript/planning/` is not among them. The independent check that
  falsified the remedy does not run on any subsequent commit.
- **`src/Core.Lean4/` IS gated**, and `lean-orphan-modules.ts` now fails the
  build on a silent orphan - which is why `LightTimeAsymmetry.lean` was wired
  into `Lean4.lean` in the same commit. Of the three artifacts in this round,
  only the Lean one is actually watched.

Recommended (engineering work, not mine to do): add a `z3 tools/Z3Verify/*.smt2`
step asserting the expected `sat`/`unsat` sequence, and add
`src/Core.TypeScript/planning/` to the gated `bun test` paths. Both are cheap;
neither is a proof; both stop a green CI from hiding an unchecked claim.

## 8. Anchors - checked-anchor register

Per `.claude/rules/anchor-to-human-prior-art.md` and the checked-anchor doctrine
(cite only what you opened, or say you did not):

| Anchor | Grounds | Register |
|---|---|---|
| **Alfred Tarski (1951)**, *A Decision Method for Elementary Algebra and Geometry* | Decidability of the theory of real closed fields - why the scalar encoding is settleable at all | **NOT re-opened.** Attribution from standing knowledge. |
| **George E. Collins (1975)**, "Quantifier Elimination for Real Closed Fields by Cylindrical Algebraic Decomposition" | The algorithm behind z3's `nlsat`; why "polynomial" was the routing goal | **NOT re-opened.** |
| **Augustin-Louis Cauchy / Viktor Bunyakovsky / Hermann Schwarz** | `\|u.v\| <= \|u\| \|v\|`, the load-bearing hypothesis (z3 block R1 shows dropping it breaks the envelope) | Used as mathematics, not cited from a text. |
| **Johannes Kepler (1609)** / **Isaac Newton (1687)** | Vis-viva, hence the closed-form perihelion speed that makes section 5 ephemeris-free | **NOT re-opened.** |
| **Murray and Dermott (1999)**, *Solar System Dynamics* ch. 2 | The two-body element-to-state transformation my third implementation uses | **NOT re-opened.** Already on `docs/PRIOR-ART-LIST.md` from PR #10398. |
| **Seidelmann (ed.) (1992)**, *Explanatory Supplement* | The `Rz(Omega) Rx(i) Rz(omega)` reduction (defect D1) | **NOT re-opened.** |
| **Park, Folkner, Williams and Boggs (2021)**, DE440/441, AJ 161:105 | What "ephemeris truth" means for `delta_ephem` | **NOT re-opened.** |
| **Reasenberg, Shapiro et al. (1979)**, Viking, ApJL 234:L219 | The Shapiro magnitude behind `delta_rel` | **NOT re-opened**, and I did **not** independently verify the 0.4 microsecond asymmetry figure. |

So: the **mathematical** anchors (Tarski, Collins, Cauchy-Schwarz, vis-viva) are
load-bearing here and are used as mathematics - the proofs stand on the z3 and
Lean artifacts, not on the citations. The **astronomical** anchors are cited from
standing knowledge and inherit PR #10398's declared checked-anchor debt. Stated
so the debt stays visible.

## 9. Artifacts

| Path | Tool | Status |
|---|---|---|
| `tools/Z3Verify/light-time-endpoint-speed-envelope.smt2` | z3 4.16.0, QF_NRA | 8 lemmas `unsat`, 1 sharpness `sat`, 2 hypothesis-necessity `sat`. 0.03 s. |
| `src/Core.Lean4/Lean4/LightTimeAsymmetry.lean` | Lean 4.30.0-rc1 + Mathlib | Kernel-checked; wired into `Lean4.lean` so `lake build` reaches it. |
| This document | - | Routing decision, verdicts, refutation attempts. |

## 10. Related

- `081KZY5W6AJ087G0R003EE7PY6` - defect record (Lumen). D1/D2-finding/D3 stand.
- `081KZYK0Q8Z087G0R0010Z2Z2Q` - the proposal. Its envelope is now **PROVED**;
  its `1.2` is now **refuted as a margin**; its "22,297x" needs correcting to
  "unbounded"; its blocking dependency on Horizons vectors is **unchanged and
  still correct** for the tight path, but **not** required for the constant.
- `docs/research/2026-08-13-independent-orbital-asymmetry-review.md` - PR #10387.
- `.claude/rules/numerology-vs-number-theory.md` - the sibling discipline: an
  expression that matches the observations is not thereby verified. Both prior
  rounds used numerical agreement where a two-line proof was available.

---

## 11. Verification transcript (CHECKED)

Every result below was produced by running the tool, not by reasoning about what
it would say.

**z3 4.16.0**, `z3 tools/Z3Verify/light-time-endpoint-speed-envelope.smt2`:

```
unsat unsat unsat unsat unsat unsat unsat unsat   L0a L0b L1 L2 L3 L4 M1 M2   (proved)
sat                                               S1  sharpness witness
sat sat                                           R1  R2  hypothesis necessity
0.03s user
```

The `S1` model returned by z3, in exact rationals:
`tAB = 1/7`, `tBA = 1/12`, `c = 10`, `R = 1`, `VA = 2`, `VB = 3`,
`sA = wA = 2`, `sB = wB = 3`. No floating point in the certificate.

**Lean 4.30.0-rc1 + Mathlib v4.30.0-rc1**,
`lake build Lean4.LightTimeAsymmetry`:

```
[2319/2319] Built Lean4.LightTimeAsymmetry (35s)
Build completed successfully (2319 jobs).
```

Zero `sorry`, zero `admit`. Axiom footprint of every theorem in the file:

```
propext, Classical.choice, Quot.sound
```

- the three standard Lean axioms and nothing else. No `sorryAx`.

`bun src/Core.TypeScript/hygiene/lean-orphan-modules.ts`:

```
43 modules, 40 reachable from [Lean4, ImaginaryStack, Gen, Privacy, Safety]
every module is reachable or deliberately declared.
```

**Numerics** - third independent Python implementation, analytic Kepler state
(analytic velocity, no finite difference), full `Rz(Omega) Rx(i) Rz(omega)`:
21,000 epochs at 1-hour step over 2026-01-01 to 2028-06-01, plus golden-section
refinement and bisection onto the projection zero crossing. Figures as quoted in
sections 3-5.

**Precision note for the byte-lock.** Everything load-bearing in this document is
either exact (the z3 and Lean certificates are rational; the sharpness witness is
`1/7` and `1/12`) or a scan result quoted to a precision the model cannot
support. The constant of section 5 depends only on `GM`, `a`, `e` and `c`
through `sqrt` and field operations - `sqrt` is IEEE-754 correctly rounded and
therefore **is** bit-identical across the four oracles, unlike `sin`, `cos` and
`atan2`. That is the concrete reason to prefer it: it is the only variant of this
budget that can actually be byte-locked.
