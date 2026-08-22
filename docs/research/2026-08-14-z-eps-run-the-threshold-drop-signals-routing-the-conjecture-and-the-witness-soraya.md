# Z-EPS, run: the threshold drop signals - routing the conjecture, and the witness

**Soraya, 2026-08-14.** Conjecture **Z-EPS** was proposed by Lumen in
`2026-08-14-the-quorum-fold-is-not-a-join-...-lumen.md` section 3 and handed here with a named
falsifier. This is the routing decision, the run, and the verdict.

Everything marked **CHECKED** is measured by a test in
`tests/Tests.FSharp/Formal/AmplitudeEmuSignalling.Tests.fs` (12 tests, all green) that calls the
**shipped** `AmplitudeEmu.step`.

---

## 0. Verdict in five lines

1. **Z-EPS HOLDS. CHECKED.** A Bob-local, trace-preserving operation moves Alice's marginal Born
   probability from **0.2647 to 0.0000** - a 26-point shift - on a state that no local operation
   may touch. The emulator computes a theory that signals.
2. **The algebraic route does NOT settle it**, and the framing that it might is wrong in a specific,
   correctable way: *linear implies no-signalling* has contrapositive *signalling implies
   nonlinear*, not its converse. Algebra voids the **guarantee**; only a witness establishes the
   **claim**. Details in section 2.
3. **The drop fired in the treatment arm and did not fire in the control arm. CHECKED**, by branch
   count, not by inspection. Non-vacuity is mechanical, not asserted.
4. **The control is the SAME RAY**, scaled by 1e6. Treatment and control are the same physical
   state; a projective theory is not permitted to distinguish them. That makes the control a
   scale-covariance falsifier and a signalling control in one object.
5. **"Tune EPS" is now formally dead, not merely inelegant.** For any EPS greater than 0 there is a
   scale at which the marginal shift is order 1, because the shift is scale-dependent and the
   theory is not. Section 4.

---

## 1. Routing decision (the part that came first)

The property class is not on the routing table, so it gets classified from first principles.

**What is the object?** Not a state machine, not a set-map, not an algebraic identity over an
abstract ring. It is **IEEE-754 arithmetic in a neighbourhood of a hard threshold**, and the claim
is **existential**: there exist two settings of a local operation whose Alice-marginals differ.

That single observation decides the route. An existential over a measure-zero region of a
floating-point state space has exactly one cheap sound proof: **exhibit the witness and execute it
against the shipped code.**

| candidate | verdict | wrong-tool cost if picked |
|---|---|---|
| **Analytic construction plus executable witness on shipped code** | **CHOSEN** | - |
| TLA+ / TLC | **rejected, and it is a trap** | TLC has no reals. Modelling this needs the exact carrier - which QuorumPhaseCancellation.tla already uses. In an exact ring the drop deletes only exact zeros, so the defect is invisible by construction and TLC returns no violation. A false green on a P0. The sharpest wrong-tool cost in the file. |
| Z3 (SMT) | **rejected for the claim, right for one lemma** | The non-linearity lemma is a 3-line QF_NRA obligation Z3 closes in seconds. The signalling statement needs QF_FP plus transcendental rotations: unknown, or days of encoding for a result a 40-line test gives in 37 ms. Same failure mode as the Meno SMT encoding that was correctly declined: the object was not the object the tool eats. |
| Lean 4 | **rejected** | Human-weeks to formalise Gisin, and the theorem would be about ideal QM, not about our float code. Wrong object entirely. |
| FsCheck | **rejected as primary, useful later** | The witness set has effectively measure zero - a branch magnitude must land within a factor of about 1.4 of 1e-6 while its siblings do not. Random search returns green. A green FsCheck run here would have been a false negative, which is worse than no run. Correct use is after the witness: generalise around it. Adaeze's lane. |

**Cross-check (BP-16, P0).** Two independent instruments, both present:
(a) the witness executed against shipped `AmplitudeEmu.step`;
(b) the **identical construction over exact BigInteger arithmetic**, which produces 9/34 under
both of Bob's settings - exactly, as integers, no tolerance. (b) isolates the cause: the harness
does not signal, the float drop does. **CHECKED.**

A third instrument is named and deliberately deferred: the cyclotomic carrier
(081KZZYWBN2087G0R003NAQQAF). Section 5.

---

## 2. Why the algebra alone does not settle it

The tempting chain is: the drop is nonlinear; Gisin 1990 says nonlinear evolution permits
superluminal signalling; therefore the emulator signals. The middle step does not carry the weight.

- **What is a theorem.** If the channel is the identity on Alice tensored with a completely
  positive trace-preserving map on Bob, then partial trace over Bob commutes with it and Alice's
  reduced state is unchanged. Linearity plus trace preservation implies no signalling.
  (Kraus 1983; Choi 1975. CITED-not-page-checked.)
- **What its contrapositive says.** *Signalling implies nonlinear.* It does **not** say *nonlinear
  implies signalling*.
- **A nonlinear map that signals nothing.** Global renormalisation, psi to psi over its norm, is
  not additive and not homogeneous, yet Born statistics are invariant under it by construction. So
  non-linearity is **necessary and not sufficient** for signalling.
- **What Gisin 1990 actually supplies.** A genericity result - essentially any nonlinear evolution
  of a local subsystem's state lets Alice's basis choice steer Bob's ensemble into distinguishable
  evolution. It is the reason to *expect* signalling. It is not a proof that a particular nonlinear
  map on a particular carrier signals. (CITED-not-page-checked; Polchinski 1991 for the follow-on.)

So the honest division of labour is:

> **Algebra establishes the necessary condition and voids the guarantee. The witness establishes
> the claim.** The lemma is worth having and is cheap - it is checked here on the shipped code
> (step on amplitude 1.0 is nonempty; on 1e-7 it is empty, so the map is not homogeneous of degree
> 1, hence not linear). But had the run come back with Alice's marginal invariant, Z-EPS would be
> **false** and the item would downgrade to "numerically wrong". The experiment was not ceremony.

It came back positive.

---

## 3. The witness (CHECKED)

**Carrier.** Joint key (kA, kB); Alice owns the first component, Bob the second.

**Bob's operation** is an `AmplitudeEmu.step` fork, and both locality conditions are asserted
mechanically rather than claimed:

- **Alice-local** - every output key carries the input's Alice-index unchanged, and the
  (Bob-index, weight) profile is independent of Alice's index. **CHECKED.**
- **Trace-preserving** - weights sum to 1 on every key, so step's sqrt-p factors preserve
  per-Alice-key intensity. In exact arithmetic Alice's marginal is identically invariant.
  **CHECKED.**

Bob's two settings: **identity**, and the **(3,4,5) rotation** (weights 9/25 and 16/25, amplitude
factors 3/5 and 4/5). Pythagorean on purpose, so the float arm and the exact-integer arm run the
identical construction.

**The ray.** alpha = 2e-6 times s on Alice-0, beta = 1.2e-6 times s on Alice-1, both at Bob-index 0.
sqrt EPS = 1e-6 is the amplitude at which the drop bites. At s = 1 the rotation pushes **both** of
Alice-1's branches under it (0.6 and 0.8 times 1.2e-6) while leaving Alice-0's above it.

| arm | scale | Bob idle | Bob rotates | drop fired | Alice's marginal |
|---|---|---|---|---|---|
| **TREATMENT** | s = 1 | P_A(1) = 9/34 = 0.2647 | P_A(1) = 0.0000 | **2 branches** | **moves 26 points** |
| **CONTROL** | s = 1e6 | P_A(1) = 9/34 | P_A(1) = 9/34 | **0 branches** | invariant to 1e-16 |
| **EXACT INTEGERS** | n/a | 9/34 | 9/34 | 0 (only exact zeros droppable) | invariant, exactly |

Three further facts, each its own test:

- **Alice's SUPPORT changes**, not merely her weights: [0; 1] becomes [0]. Bob deletes an outcome
  from Alice's world. `support` and `measure` are public API, so this is observable at the
  emulator's own interface.
- **Signalling survives normalisation.** On a state with total intensity exactly 1, Bob still flips
  P_A(1) between 1.44e-12 and exactly 0, and still flips Alice's support. The magnitude is small;
  the channel is real and the support change is categorical. This answers the only serious objection
  to the loud witness - that it used an unnormalised state.
- **Treatment and control are the same ray.** Componentwise ratio is the single constant 1e6.
  **CHECKED.** No physical theory may distinguish them; this one does.

**Non-vacuity, checked by mutation, not by argument.** Setting EPS to 0.0 in the shipped module
kills exactly five tests - both treatment arms, the support arm, the normalised arm, and the
non-linearity lemma - and leaves the three preconditions, both control arms, the ray-identity check
and the exact-integer arm green. That is the correct kill pattern: the treatment measures the drop,
the control measures its absence, and neither is a tautology. (This is the guard the earlier chsh
probe lacked when it missed a planted tautology by carrying its own copy of the definitions. Every
arm here calls shipped `AmplitudeEmu.step`.)

---

## 4. What this changes

**The claim gets stronger, and the fix gets narrower.**

- Before: the drop breaks associativity and scale-covariance - a numerical defect, arguably tunable.
- After: the drop opens a signalling channel whose strength is set by the state's normalisation,
  which is not physical. Tuning EPS down does not close the channel; it only moves the scale at
  which the shift becomes order 1. **For any EPS greater than 0 there is a ray on which a local
  operation moves the far marginal by an arbitrary amount** - because the shift depends on scale and
  the theory does not. Lumen's dimensional argument concluded "no value of EPS is right"; the run
  upgrades that from an aesthetic judgement to a measured consequence.
- **The correct fix is a carrier change, not a constant change.** In an exact ring the only
  droppable value is an exact zero, and deleting an additive identity cannot change a later sum - so
  associativity, scale-covariance and no-signalling all return while destructive interference is
  fully preserved. Confirmed here on integers; Lumen confirmed it independently over the Gaussian
  integers.

**Priority.** This is a P0-class finding for anything that reads the amplitude layer as physics. It
is **not** a correctness emergency for CHIP-8 today: `SoftChip8.forkOnInput` produces real
1/sqrt2 branch factors and normalisation stays near 1, so live states are not near the threshold.
The exposure is (a) any long fold where destructive interference shrinks the norm, (b) the quorum
layer, where per-member magnitude is explicitly **unpriced** - open item 3 of Lumen's doc, and
directly coupled: an uncapped magnitude is exactly what walks a state into the threshold band.

**Scope discipline.** No arithmetic changed in this PR either. EPS is untouched; the decision is
Aaron's and it is unmade. This PR establishes what the defect *is*.

---

## 5. Effect on the exact-carrier item (081KZZYWBN2087G0R003NAQQAF)

**Urgency raised; scope unchanged; still not done here.**

The cyclotomic-carrier workitem was argued on three grounds: byte-lock, restored laws, and sound
conflict detection in join. This run adds a fourth that outranks the first three:

> **The float carrier lets a local operation change a remote marginal.** That is not a
> serialisation concern or a law-hygiene concern. It is the emulator modelling a theory that
> signals, and the exact carrier is the thing that closes it.

And the proof-to-code bridge is now concrete rather than aspirational. QuorumPhaseCancellation.tla
already restricts to the 4th roots of unity. Share the carrier with the implementation and **TLC
counterexamples become executable F# tests**. Note the direction carefully, because it is the same
trap as section 1: an exact carrier makes TLC *sound for the quorum-fold properties*, and it makes
TLC *blind to this one* - the drop has nothing left to delete. The model checker is the right tool
after the fix, never for finding it.

---

## 6. Anchors (Beacon)

*CITED-not-page-checked throughout; Gisin is the load-bearing one and is the one to page-check
first if this leaves the factory.*

- **Gisin 1990**, "Weinberg's non-linear quantum mechanics and superluminal communications",
  Phys. Lett. A 143 - nonlinear evolution generically permits superluminal signalling. The source of
  the conjecture. **Used here as motivation for the experiment, never as its proof** - see section 2.
- **Polchinski 1991**, "Weinberg's nonlinear quantum mechanics and the EPR paradox" - the follow-on
  that separates the signalling sector from the rest.
- **Kraus 1983; Choi 1975** - CPTP maps and the Choi-Jamiolkowski correspondence. The linearity plus
  trace-preservation premise whose failure voids the no-signalling guarantee.
- **Born 1926** - the modulus-squared rule; the readout the marginal is taken through.
- **Ghirardi, Rimini & Weber 1986** - spontaneous localisation; the shape a threshold-drop imitates
  without the stochastic structure that makes those models consistent. Lumen's observation, and it
  is exactly right: GRW models are engineered *not* to signal, and the engineering is what the drop
  omits.
- **Goguen & Meseguer 1982** - noninterference. Worth naming because the repo now uses
  "interference" in two unrelated senses; this doc uses the physical one throughout, and the spec-13
  sense appears only in this bullet.

---

## 7. Open

1. **The arithmetic decision is Aaron's and is unmade.** Not touched here. Section 4 argues that the
   admissible fixes are carrier changes, and that tuning is not among them.
2. **Per-member amplitude normalisation is still unpriced** - and this run promotes it from a
   tidiness item to the mechanism by which a live quorum state could walk into the threshold band.
3. **A generalising property test around the witness** is the natural next instrument and belongs to
   Adaeze: the witness gives the generator a seed the random search could never find on its own.
4. **BipartiteMachZehnder was NOT the right vehicle for the falsifier**, and this is worth recording
   because the conjecture named it. That module consolidates through `WSet.consolidate` with its own
   isZero at 1e-12 on the real and imaginary *components* - an amplitude threshold, six orders
   tighter than AmplitudeEmu's 1e-12 on the *intensity*. Running the falsifier there would have
   tested a different constant in a different module and could plausibly have returned a false
   negative for AmplitudeEmu. **Whether the WSet threshold has the same defect at its own scale is a
   separate, un-run question.** It almost certainly does - it is the same shape - but it is not
   measured here and is not claimed.
