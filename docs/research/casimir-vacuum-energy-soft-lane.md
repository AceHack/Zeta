# Casimir / Riemann-zeta vacuum energy as accumulated soft-lane potential

Design note. Author: Soraya (formal-verification-expert), invoked by Otto per the
four-ferry role split. Date: 2026-07-03. Priority: P2 (research/design; no code
required to ship — the system is correct without it).

Ferry request: `memory/soraya/ferry-2026-07-03-casimir-vacuum-energy.md` (Kiro).
Grounded against: `src/Core.TypeScript/algebra/entropy-tracker.ts`,
`.../physics-traits.ts`, `src/Core.Lean4/Lean4/LandauerFloor.lean`,
`src/Core.TLA/specs/PredictiveLookahead.tla`.

---

## Verdict up front

**The literal Casimir/zeta mapping is REJECTED as stated, and salvaged only under
one precise, checkable condition.** The correct functional form is already in the
code and is *not* a Casimir form.

1. **No zeta regularizes our branch accumulation as built.** ζ(-3) and ζ(-1) are
   the analytic continuation of *divergent* mode sums (Sum n^3, Sum n). Our
   accumulated soft-lane potential is `entropy_state`, a finite `Nat` with a flat
   per-branch weight (+1 each). A finite sum has nothing to regularize. The Lean
   type `state : Nat` in `LandauerFloor.lean` is itself the disproof: it is a
   convergent (trivially finite) quantity by construction, so the premise that
   makes zeta *necessary* is absent.

2. **The mapping is recoverable IFF branches carry a spectral weight** linear in
   rank (n-th branch carries ~n units of surprisal). Then, and only then, a 1+1D
   Casimir ζ(-1) = -1/12 genuinely appears. As coded, branches are homogeneous, so
   this condition is not met. Section 4 gives the exact condition and its metering
   test.

3. **The correct potential is `V(τ) = L²/τ`** — the Schmiedl-Seifert finite-time
   excess, *already computed* by `accountFerryCommit`. This is a `1/τ` law, not the
   Casimir `1/τ⁴` (3+1D) or `ζ(-1)/τ²` (1+1D). It is a different, correctly-anchored
   physical mechanism (finite-time stochastic thermodynamics), and the ferry note's
   candidate #2 is the right one.

4. **Commit pressure is real but is NOT Casimir attraction.** `V(τ) = L²/τ` is
   *monotone decreasing*: its gradient favors *waiting* (larger τ), the opposite of
   a pull toward commit. The pressure toward commit comes from *constrained
   optimization* against the queue wall and latency, giving an optimal cadence
   τ* = L/√α by AM-GM (Section 6) — no vacuum energy required.

The physics lens is not wrong to reach for; it just has to pass the metering test
rather than ride on the resemblance (`anchor-taxonomy` rule: physics grounds the
*metering discipline*, and the metering test is exactly what catches
physics-as-metaphor).

---

## 1. What the Casimir claim actually requires

The Casimir effect (Casimir 1948) needs three ingredients, and the zeta
regularization is a consequence of the first, not a free-standing choice:

- **(C1) A mode spectrum ω_n that grows without bound.** Between two plates the EM
  field modes are ω_n = nπc/L. The zero-point energy Sum ½ℏω_n is a sum over n of
  a term *linear in n* (1+1D) or, after the transverse-momentum integral, *cubic in
  n* (3+1D). This sum is **UV-divergent**.
- **(C2) Boundaries that quantize the spectrum.** The plates impose Dirichlet
  conditions; the mode spacing is set by the separation L. Change L, change the
  spectrum, change the (regularized) energy. The energy is *boundary-induced*.
- **(C3) A zero-point energy per mode.** Each mode contributes ½ℏω — a real
  ground-state energy of a harmonic oscillator.

Zeta enters **because of (C1)**: the physically meaningful quantity is the
L-dependent finite part of a divergent sum, and analytic continuation
(Sum n → ζ(-1) = -1/12; Sum n^3 → ζ(-3) = 1/120) extracts it. Remove the
divergence and you remove the reason for zeta.

> Caveat worth carrying (Jaffe 2005, PRD 72 021301): even in real physics the
> ζ(-3) is a computational shortcut. The Casimir force is a relativistic
> (van der Waals / retarded) force between the charges in the plates and vanishes
> as the fine-structure constant → 0; it does not literally require zero-point
> vacuum energy. Importing ζ into the soft lane therefore imports a *known
> over-interpretation*. This strengthens the case for anchoring to a mechanism we
> can meter, not to the -1/12 folklore.

---

## 2. Ingredient check against the soft lane

| Casimir ingredient | Soft-lane analogue as built | Holds? |
|---|---|---|
| (C1) divergent mode spectrum ω_n ∝ n | `entropy_state` = count of branches; each branch = +1 bit, **flat** spectrum (1+1+1+...) | **No** — flat, finite |
| (C2) boundary quantizes spectrum | ferry flush / commit boundary; window τ between commits | **Partial** — a real boundary, but it bounds a finite counter, not a spectrum |
| (C3) ½ℏω zero-point per mode | "½ bit virtual entropy per branch" | **No** — a branch is **1** bit (support doubles ⇒ +1 = log₂2); the ½ is unanchored |

Two of three fail, and the one that half-holds (the boundary) bounds the *wrong
object*: a commit boundary confines a **finite integer counter**, whereas a Casimir
plate confines an **infinite tower of modes**. The mathematical machinery that
makes Casimir non-trivial (regularizing infinity) has no counterpart here.

### The ½-bit correction

The ferry note assigns each branch ½ bit "by analogy to ½ℏω." This is not
derivable. `entropy-tracker.ts::branch()` does `state.entropy_state += 1`, and the
comment is correct: *support doubles ⇒ +1 bit* (log₂ of a doubled state space).
There is no harmonic oscillator whose ground state is ½ of this. Recommend dropping
the ½ or, if a factor is wanted, deriving it — do not carry it as decoration.

---

## 3. The crux: a finite sum has nothing to regularize

`LandauerFloor.lean` models Ledger A as `state : Nat`. Every operation keeps it a
`Nat`: `branch` does `state + 1`, `measure k h` does `state - k` under the
precondition `k ≤ s.state`. The accumulated soft-lane potential is therefore, at
every tick, a **finite non-negative integer** equal to the number of uncommitted
branches.

The sum of mode energies in Casimir, Sum_{n=1}^∞ n (or n^3), **diverges**; ζ is the
tool that assigns it a finite value by analytic continuation. Our accumulation is
Sum_{i=1}^N 1 = N, already finite, already the answer. There is no analytic
continuation to perform and no divergence to tame.

This is not a soft objection — it is the load-bearing one. **Zeta regularization is
a technique for extracting finite physics from a divergent series. Applied to a
convergent (finite) series it is a no-op dressed as a mechanism.** The existing Lean
type is, in effect, a machine-checked proof that the Casimir premise (C1) is false
for the soft lane as built.

---

## 4. The one salvage: a spectral branch weight

The mapping is not *impossible* — it is *conditional*. It becomes valid exactly
when the branches stop being homogeneous.

**Condition (SPEC-WEIGHT).** Suppose the soft lane's uncommitted configurations
have a rank-ordered surprisal spectrum E_n = n·ε (the n-th most-likely branch
carries n units of surprisal — a Zipf/linear-rank law over the possibility space),
and the accumulated potential is the sum of these E_n over the confined modes up to
a cutoff set by the window. Then the confined sum is ε·Sum_{n=1}^{N(τ)} n, and its
regularized boundary part is ε·ζ(-1) = -ε/12 — a genuine **1+1D Casimir** term.
ζ(-3) would require a *cubic* rank-energy law E_n ∝ n^3, i.e. an effective 3+1D
mode density; there is no structural reason for the soft lane to be 3-dimensional,
so **if any zeta applies it is ζ(-1), not ζ(-3)**.

**This requires a different data structure than the current flat counter.** A
`Nat` counter cannot express a spectrum. You would need branches to be *ranked and
weighted* — e.g. a priority structure where `branch(rank)` adds `rank·ε`, or a
tree whose depth-d branches carry weight ∝ d. The current `FerryQueue`
(`physics-traits.ts`) enqueues unweighted items, so it does not meet SPEC-WEIGHT.

**Metering test the salvage must pass before it earns the zeta name (do not skip):**

1. **Divergence exists.** Show the *unregularized* confined sum actually diverges as
   the cutoff → ∞ (i.e. branch ranks are genuinely unbounded). If the possibility
   space is bounded, the sum is finite and we are back in Section 3.
2. **Boundary-dependence.** Show the finite part depends on τ through the mode
   cutoff N(τ) — i.e. changing the window changes the extracted energy. A quantity
   independent of the boundary is not a Casimir quantity.
3. **The regularized value is used, not just quoted.** -ε/12 must feed a *predicted
   observable* (a heat, a force, a cadence) that differs measurably from the naive
   truncation. If -1/12 changes no downstream number, it is folklore (the Jaffe
   caution).

Until all three pass, the honest statement is: *the soft lane has no zeta.* This is
the `dual-use-detection` discipline applied to an analogy — report the neutral fact
(finite counter, no divergence), do not let the resemblance smuggle in the verdict.

---

## 5. The correct functional form: V(τ) = L²/τ

Strip the Casimir framing and ask the real question the ferry note is circling:
*what is the τ-dependent potential the accumulated soft lane carries?* The code
already answers it. `accountFerryCommit(batchBits, τ, L²)` returns

    totalHeat = landauerFloor + finiteTimeExcess
              = B·(kT·ln2) + L²/τ.

The τ-dependent part — the only part that behaves like a boundary-induced potential
— is

    **V(τ) = L² / τ**   (Schmiedl-Seifert 2007, minimal excess work of a
                          finite-time process; L = thermodynamic length).

This is the right object and it is *not* Casimir:

- It is `1/τ`, not `1/τ⁴` (ferry candidate #1, pure 3+1D Casimir) — rejected: no
  cubic mode spectrum.
- It is `1/τ`, not `ζ(-1)/τ²` (ferry candidate #4, 1+1D Casimir) — rejected: no
  linear mode spectrum as built (see Section 4; if SPEC-WEIGHT ever holds, revisit).
- It is anchored to a real, different mechanism: the geodesic (thermodynamic-length)
  cost of driving a stochastic system between two states in finite time τ. That
  mechanism is already cited in `LandauerFloor.lean` Theorem 4 and
  `PredictiveLookahead.tla` (the `excess` variable, S3/finite-time-excess block).

So the ferry note's candidate #2 (`V = L²/τ`) is correct, and the reason to prefer
it over #1/#4 is precisely the failure of (C1): with no divergent mode tower, the
Casimir exponents (2, 4) have no derivation, whereas the Schmiedl-Seifert `1/τ` has
one that fits our commit-boundary picture exactly.

---

## 6. Does the potential create pressure toward commit

Yes — but the sign of `V(τ)` shows the pressure does **not** come from `V` itself.

- **Casimir sign:** energy is *negative*, force is *attractive* — confining the
  vacuum lowers energy, so the plates are pulled *together* (toward smaller L).
- **Soft-lane sign:** `V(τ) = L²/τ ≥ 0`, and dV/dτ = -L²/τ² < 0. The potential
  *decreases* as the window grows. Pure finite-time thermodynamics therefore says:
  **stretch τ, wait, approach the Landauer floor.** That is pressure *away* from
  committing early — the opposite of a Casimir pull. (`LandauerFloor.lean`
  `larger_window_less_excess` proves exactly this monotonicity;
  `quasistatic_limit` proves the τ→∞ floor.)

The genuine pressure toward commit is a **constrained optimization**, not a field:

    minimize  C(τ) = L²/τ  +  α·τ
      s.t.    queue(τ) ≤ MaxBatchSize          (hard buffer wall)

where α is the marginal cost of latency/staleness per unit window (downstream
consumers waiting; risk of the buffer filling). The `L²/τ` term wants large τ; the
`α·τ` term (and the buffer wall) wants small τ. By AM-GM,

    C(τ) = L²/τ + α·τ ≥ 2·√(α·L²) = 2·L·√α,

with equality — the **thermodynamically optimal commit cadence** — at

    **τ* = L / √α.**

This is a clean, provable, zeta-free answer to ferry Q4. Note it mirrors real
Casimir physics: even there, plates do not settle at an "optimal" separation from
Casimir energy alone (E ∝ -1/L³ is monotone); an *opposing* force is required for
an interior equilibrium. Here the opposing force is latency/α, and τ* is where the
two balance. Without α (or the buffer wall), the optimum is τ = ∞ (never commit) —
which is why the buffer bound in `PredictiveLookahead.tla` (`queue ≤ MaxBatchSize`,
S4) is load-bearing: it is the wall that forces a finite cadence.

### Wiring to the predictive scheduler

`PredictiveLookahead.tla` already encodes the two competing pressures:
`ExtendLookahead`/`ShrinkLookahead` move `excess` down/up with the window, and
`QueueBounded` is the wall. The Casimir analogy adds nothing to the *spec*; the
optimal-cadence result τ* = L/√α is the design guidance the scheduler's policy
layer (Kiro's lane) can use to *choose* when to `Commit` — it is not a new
invariant. (Reminder from my prior pass on that file: the liveness properties there
are defined-not-gated for sovereignty reasons; the optimal cadence is a *policy*
target over work-ticks, never a forced obligation.)

---

## 7. Implementation recommendation

**Do NOT add a Casimir/zeta field to the entropy tracker.** It would encode a
mechanism the system does not exhibit and would fail the anchor metering test.

Minimal, honest additions (all optional; the system is correct without them):

1. **Rename intent, not mechanism.** `finiteTimeExcess` already *is* V(τ). If a
   `potential()` accessor is wanted for readability, define it as
   `potential = thermodynamicLength / erasureWindow` and cite Schmiedl-Seifert in
   the doc comment. No new state.
2. **Add `optimalWindow(latencyWeight α)`** as a *computed* property returning
   `τ* = sqrt(L² / α)` (integer sqrt in the `Nat` house style). This is the one
   genuinely new, useful quantity, and it is what a predictive scheduler wants.
3. **Fix the ½-bit comment** in the ferry note / any downstream doc: a branch is 1
   bit, not ½ (Section 2).
4. **Leave `entropy_state` a flat `Nat`.** Only revisit if SPEC-WEIGHT (Section 4)
   is ever actually wanted — that is a data-structure change (ranked/weighted
   branches), not a field addition, and it should come with its own metering test,
   not be retrofitted.

---

## 8. Formal proof obligations and tool routing

Routing is my lane. All obligations here are P2 (research/design), so single-tool
evidence is acceptable per BP-16 (two-tool cross-check is reserved for P0/P1
load-bearing claims). Tools picked by property class, not by habit:

| Obligation | Statement | Primary tool | Rationale |
|---|---|---|---|
| O1 Monotonicity | dV/dτ < 0, i.e. τ1 ≤ τ2 ⇒ L²·τ1 ≤ L²·τ2 over the excess pair | **Lean** | Already discharged as `larger_window_less_excess`; nothing new to prove. Reuse. |
| O2 Quasi-static floor | τ ≥ L² ⇒ total ≤ floor + 1 (integer excess vanishes) | **Lean** | Already discharged as `quasistatic_limit`. Reuse. |
| O3 Optimal cadence | ∀ τ>0: L²/τ + α·τ ≥ 2·L·√α (AM-GM), tight at τ=L/√α | **Z3** (QF_NRA / reals) | A single universally-quantified nonlinear inequality — SMT sweet spot. One lemma, minutes. |
| O3' durable O3 | same, as a checked-in artifact | **Lean** (deferred) | If τ* graduates into shipped scheduler policy it becomes P1 ⇒ then add the Lean leg for BP-16. Not before. |
| O4 Finite-support (the negative result) | `entropy_state : Nat` is finite ⇒ no divergent sum ⇒ zeta undefined-as-mechanism | **type-level, no proof** | The `Nat` type *is* the evidence; document it, do not "prove" a non-divergence that holds definitionally. |

O4 is the important routing call: it is a **negative** result and the temptation is
to over-formalize it. Resist. The right artifact is a one-line doc statement that
Ledger A is `Nat`, hence finite, hence outside the domain where zeta is a
mechanism. No TLA+, no Z3, no Lean theorem — enumerating the absence of a
divergence would be TLA+-hammer in spirit.

---

## 9. Beacon anchors

- **Casimir, H.B.G. (1948).** "On the attraction between two perfectly conducting
  plates." Proc. K. Ned. Akad. Wet. 51, 793. — the effect and E ∝ -1/L³.
- **Jaffe, R.L. (2005).** "Casimir effect and the quantum vacuum." PRD 72, 021301.
  — the ζ / zero-point-energy interpretation is a shortcut; force vanishes as α→0.
  The reason to distrust importing -1/12 as a mechanism.
- **Schmiedl, T. & Seifert, U. (2007).** "Optimal finite-time processes in
  stochastic thermodynamics." PRL 98, 108301. — minimal excess work = L²/τ; the
  *correct* anchor for V(τ). (Already cited in `LandauerFloor.lean`.)
- **Landauer (1961); Bennett (1973).** the floor and reversibility — the ledger
  this note sits on top of.
- **Riemann / Hurwitz zeta.** ζ(-1) = -1/12, ζ(-3) = 1/120 as analytic
  continuations of *divergent* series — the precise fact that makes them
  inapplicable to a finite `Nat` sum.
- **AM-GM (Cauchy).** the optimal-cadence bound; no exotic machinery needed.

---

## 10. Summary for the ferry (answers to Kiro's four questions)

1. **Is zeta the right tool?** No, as built — there is no divergent mode sum to
   regularize (`entropy_state : Nat` is finite). Yes, *only* under SPEC-WEIGHT
   (ranked branch surprisal E_n ∝ n), and even then it is ζ(-1) = -1/12 (1+1D),
   never ζ(-3), and it must pass the three-point metering test first.
2. **Functional form V(τ)?** `V(τ) = L²/τ` — Schmiedl-Seifert finite-time excess,
   already computed by `accountFerryCommit`. Not `1/τ⁴`, not `ζ(-1)/τ²`.
3. **Does the potential create commit pressure?** Not by itself — dV/dτ < 0 favors
   *waiting*. Commit pressure comes from constrained optimization against latency α
   and the queue wall, giving optimal cadence **τ* = L/√α** (AM-GM).
4. **Optimal plate separation / cadence?** Yes: τ* = L/√α, the balance of
   finite-time excess (wants large τ) against latency + buffer bound (want small τ).
   It is a scheduler *policy* target, not a new invariant, and it is zeta-free.

**Net:** keep the structural insight (commits are boundaries; the potential falls
with the window), correct the anchor from Casimir/zeta to Schmiedl-Seifert, add one
computed property (`optimalWindow`), and add no Casimir state. The physics lens
earned a real result (τ* by AM-GM); it did not earn the -1/12.

— Soraya
