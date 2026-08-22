/-
  Malament–Hogarth vs the bounded tick — the mapping stated, and the property transfer REFUTED.

  (Otto, 2026-08-17. Prompted by the Manchak ferry
  `docs/research/ip-questionable/2026-08-17-jb-manchak-…-verbatim-transcript-aaron-forwarded.md`,
  which recorded a located conjecture: that Zeta's bounded tick "is the exact dual of the
  Malament–Hogarth machine", and that `TickBudget` therefore inherits MH's known properties.
  Aaron 2026-08-16: *"conjecture until formal analysis is done."* This file is that analysis.)

  ## The MH definition being mapped (Manchak, in the ferried transcript)

  A spacetime is **Malament–Hogarth** if there is an event `p` and a timelike half-curve `γ` with

    (MH1)  γ has INFINITE proper time, and
    (MH2)  γ ⊆ I⁻(p)  —  γ lies ENTIRELY in the past light cone of p.

  The halting decision follows from (MH2) being TOTAL, not from (MH1): put a machine on γ; if it
  halts it signals; at `p` the observer has finite proper time and — because *every* event of γ is
  already in `p`'s past — **silence at `p` is decisive**. MH decides a Π₁ fact ("never halts") from
  a finite observation. That negative decision is the whole content of the construction.

  ## The mapping, role by role (STATED; the verdicts are what the theorems below settle)

  * **γ (the worldline)** → the tick-indexed trajectory `orbit step s₀ : ℕ → S`, i.e. the
    continuation chain. **Clean analogue.**
  * **(MH1) infinite proper time along γ** → unboundedly many bounded ticks (`SimLoop.run` plus
    `SimLoop.Continuation`). **Clean analogue** — both are ω-length.
  * **the signal from γ to p** → the continuation token `spawn:<id>:<lap>:<ticks>:<ptr>`.
    **WEAK.** It is a *successor* arrow (tick n → tick n+1); MH needs an all-stages-to-one arrow.
  * **`p`, the observation event** → **produce direction: NO ANALOGUE.** The tick chain has order
    type ω and no terminal stage. Receive direction: the receiving tick exists — see the next row.
  * **(MH2) γ ⊆ I⁻(p), the TOTALITY of containment** → **NO ANALOGUE IN EITHER DIRECTION.**
    This is the refutation, and everything else follows from it.
  * **"no signal at p ⇒ never halts"** → `SimLoop.Stopped.TickBudget`: the substrate *refuses* this
    inference by construction, distinguishing "the cut decided" from "the budget ran out".
    **Absent, and honestly so.**

  **The word "dual" is wrong.** A dual is an involution/adjunction; nothing here inverts. The
  correct relation is elementary and already named in category theory: the bounded-tick chain is
  an **ω-chain (a diagram)**; MH's `p` is a **colimiting cocone over it** — one object receiving an
  arrow from *every* stage at once. Zeta ships the diagram. It does not ship the cocone. "Which
  side gets the infinity" (the ferry's table) is not a duality; it is the ordinary difference
  between a sequence and its limit.

  ## Aaron's correction (the "receive direction") and why it does not rescue the transfer

  Aaron: *"in one of our continuations its antecedent could have an infinite future in it passed
  through as an immutable value … we can integrate the MH in the standard direction too within a
  single tick."* The mechanism is real and ordinary — codata: an infinite structure **as a value**
  is finite to hold and finite to pass. But receiving `h : ℕ → Bool` as a value delivers the
  *generator*, not the *completion*. Extracting the Π₁ fact from it requires forcing it at every
  `n`, which `TickBudget` forbids. `no_finite_window_decides` below is the theorem, and it covers
  **both directions with one statement**: a reader that touches only finitely much of the
  trajectory — whether because it produced only finitely much, or because it forced only finitely
  much of a received value — cannot decide the negative. Produce and receive fail identically, at
  (MH2), for the same reason.

  ## The one place MH's CONCLUSION is reachable — and why that is the refutation, not the rescue

  (Prompted by a peer's conjecture, restated: CHIP-8's state space is finite, so a deterministic
  orbit is eventually periodic and its whole infinite future has a finite description.)

  The conjecture is CORRECT and `forall_orbit_iff_exists_cert` proves the strong form: on a finite
  state space, "P holds at every one of the infinitely many future ticks" is **decidable by a
  finite certificate** (an inductive invariant), with no infinite computation and no MH spacetime.
  But that is exactly why it does not rescue the analogy — halting is decidable for finite-state
  machines anyway, and MH is interesting *only* for machines with unbounded state.

  ## THE DILEMMA (this is the result — both horns are machine-checked)

  > Either the room's state space is **finite** — then the Π₁ fact about the whole infinite future
  > is decidable by a finite certificate (`forall_orbit_iff_exists_cert`), MH is *unnecessary*, and
  > there is nothing to inherit. Or it is **not** finite — then no bounded tick decides it
  > (`no_finite_window_decides`), and MH's power is exactly what is *absent*. There is no third
  > regime, and neither horn yields the transfer.

  ### Aaron's counter, and why it lands on the wrong clause

  Aaron pushed back on the finite-state horn: *"our composability of our discriminated unions and
  our work on aperiodic tiling should allow for simple automaton like Wolfram … we can have infinite
  machines that are 'interesting' and non repeating cause they are aperiodic."* The anchors behind
  that are real and on point — **Berger 1966** (the Domino Problem is undecidable; the proof embeds
  a Turing machine in a tiling and required constructing the first aperiodic tile set),
  **Robinson 1971** (a far simpler aperiodic set, same undecidability), **Cook 2004** (Rule 110 is
  Turing-complete: a finite, trivially-stated local rule with universal behaviour). A finite
  description generating an infinite, non-repeating, un-shortcut-able future is an established
  object, not a hope, and it does not need incompressibility — a short rule with undecidable
  long-run behaviour is exactly what MH's γ wants.

  **But this supplies (MH1), not (MH2).** It furnishes a *better worldline* — an infinite future
  actually worth deciding. It says nothing whatever about the *event at which it is decided*. MH is
  the conjunction, and the refutation here has always been at (MH2). So the counter does not rescue
  the dual; it **moves the argument onto the second horn**, where `no_finite_window_decides` applies
  with full force. Making the machine more interesting makes the absence of `p` more consequential,
  not less: by Berger/Cook the Π₁ questions about such trajectories are *undecidable*, and a
  bounded-tick substrate with no cocone provably cannot answer them. Note the theorem below is
  quantified over **all** `h : ℕ → Bool` — periodic, aperiodic, or universal — so no choice of
  machine class escapes it.

  One correction to the chain as it reached me, in the `numerology-vs-number-theory` register:
  **aperiodicity is necessary for those undecidability results, not sufficient.** A tile set that
  tiles only periodically has a decidable tiling problem, which is why Berger needed aperiodicity —
  but the Robinson tiling is itself aperiodic *and* completely predictable. Undecidability comes
  from the embedded computation, with aperiodicity as its scaffold. "Aperiodic ⇒ un-shortcut-able"
  is a necessary condition mistaken for the mechanism.

  ### What of that is BUILT (audited in-tree at this commit, not inferred)

  Aaron labelled the direction himself — *"we are **trying to get here** with"* the Bayesian factor
  graphs, BNNs, online learning, and ISociety work — and the audit agrees with his label:

  * **No aperiodic generator exists in code.** No Wang tiles, no substitution rules, no Rule 110, no
    tiling substrate anywhere in `src/`. What exists is a **detector**: `src/Core/Orbit.fs`
    `classify` returns `Quasiperiodic` when `period` finds no period `≤ maxPeriod`.
  * **And `Orbit.fs` is this file's own theorem, already documented in prose about itself.**
    `Orbit.period` is a bounded-window search; `Quasiperiodic` means *"nothing found inside the
    window"*, never *"no period exists"*. Its docstring says so outright: the classifier *"would
    mislabel a chaotic, aperiodic orbit `Quasiperiodic`"*. That is `HasModulus … maxPeriod` in F#,
    and `no_finite_window_decides` is the machine-checked general form of the limitation the shipped
    module already admits.
  * **`ISociety` is declaration-only.** The interface is real (`src/Core/Society.fs:230`) and its
    laws are stated as predicates, but the only implementations in the tree are object expressions
    in `tests/Tests.FSharp/LevelObligations.Tests.fs` and `Ctm.Tests.fs`. No production implementor.
    Its own module header says "DECLARATION ONLY" and withdraws the `ISociety <: CTM` claim.
  * Clifford / braided-monoidal material: extensive, and partly executable elsewhere in the tree,
    but **nothing connects it to an aperiodic generator.** Not audited further here.

  So "we can have infinite machines that are interesting" is, at this commit, a **roadmap**, and
  Aaron said as much. Nothing in this file leans on it.

  ## Cost — Aaron's scope limit, made precise

  Aaron: *"other calculations may not be tractable, it's a calculation-by-calculation basis."*
  `cert_contains_orbit` is that limit as a theorem: **any** certificate must contain the entire
  reachable set, so the method's cost is bounded below by reachability, not by the room abstraction.

  A number worth stating so it is not rounded up: Aaron reports having *"computed over all chip8 4k
  memory space cause it's tractable."* `Chip8.MemSize = 4096` is the **address** space, and 4096 is
  indeed tractable. The periodicity argument above needs the **state** space, which for those bytes
  alone is 256^4096. Those two counts differ by exponentiation. Which of the two was enumerated is
  **not established here** and nothing in this file depends on the answer.

  ## Register (per `toy-is-free-metered-must-be-earned` and `numerology-vs-number-theory`)

  * MACHINE-CHECKED (this file, `lake build`, no `sorry`, no `admit`, zero warnings):
    `sigma1_transfers`, `hasModulus_witness`, `no_finite_window_decides`, `mh_decider_exists`,
    `mh_decider_has_no_finite_window`, `cert_contains_orbit`, `forall_orbit_iff_exists_cert`, the
    `Decidable` instance, and four `example` witnesses the kernel actually evaluates.
  * NOT VACUOUS, and checked rather than asserted. Every hypothesis class here is inhabited by an
    exhibited witness: `hasModulus_witness` inhabits `HasModulus`; `mh_decider_exists` inhabits the
    MH-observer hypothesis; the `example`s make the `Decidable` instance answer **both ways**, so it
    is not a constant dressed as a decision. Falsifier check (the Lean analogue of mutation): four
    mutants — drop `HasModulus`, drop `[Finite S]`, drop `s0 ∈ T`, flip a witness — **4/4 killed**
    (two by hard type errors, one by required `sorry`, one because `decide` *proved the mutant
    false*), control survived. Axiom audit: no `sorryAx` anywhere; `no_finite_window_decides` needs
    only `propext` + `Quot.sound` — **the refutation is choice-free**, while the MH observer costs
    `Classical.choice`, which is exactly the right asymmetry.
  * STATED, NOT PROVEN: the role-by-role table above (it is a reading of the F# substrate, not a
    Lean object); the chain/cocone reformulation; every claim about what CHIP-8 code does.
  * CITED, NOT RE-DERIVED HERE: Berger 1966, Robinson 1971, Cook 2004. They are standard and load
    the *counter*, not the refutation — nothing below depends on them.
  * NOT CLAIMED: that any shipped continuation carries an infinite-future value. Measured on
    `origin/main` while writing this: `SoftChip8.lookAhead` is bounded by `depth` *and* halts early
    at input branches; `SoftChip8Flux.lookAheadFunded` is metered to funded steps; `db/emus/chip8/`
    holds one 1590-byte capabilities file and no persisted result store. Every carried future in
    the shipped code is finite and metered. The cross-run "superdeterministic" store is design
    intent, not shipped code, as of this commit.

  ## Verdict

  **The dual does not survive.** (MH2) — the totality of past-cone containment, which is the sole
  source of MH's power — has no analogue in either direction, and `SimLoop.Stopped.TickBudget` is a
  type-level refusal to fake one. What survives is a genuine and much weaker statement:
  Zeta's tick chain and MH's γ are both ω-indexed, the Σ₁ half transfers (`sigma1_transfers`), and
  the Π₁ half does not (`no_finite_window_decides`). Under `numerology-vs-number-theory` this stays
  a **resonance**, permanently, unless someone supplies a colimiting cocone the substrate does not
  currently have.

  **What would refute this refutation** (so it is falsifiable rather than merely asserted): exhibit
  a Zeta surface at which a *single* bounded observation is settled by *every* stage of an unbounded
  tick chain at once — an all-stages-to-one arrow, not a successor arrow. That is `p`. Find one and
  the mapping becomes statable; `no_finite_window_decides` says no bounded reader can be it, so the
  candidate would have to come from outside the tick discipline entirely.
-/

import Mathlib.Logic.Function.Iterate
import Mathlib.Data.Set.Finite.Basic
import Mathlib.Data.Fintype.Powerset

namespace Zeta.MalamentHogarth

/-- **γ, formalized.** The tick-indexed trajectory of a deterministic, no-external-input room:
    `orbit n` is the state after `n` bounded ticks. Same model as
    `Privacy/UnboundedNeedsInfinitePrivacy.orbit` (deliberately identical; `step` is a pure
    endofunction, which is "no ambient entropy" made precise — manifesto §13). This is the object
    MH's γ maps onto: ω-indexed, unbounded in tick count, bounded per tick. -/
def orbit {S : Type*} (step : S → S) (s0 : S) : ℕ → S := fun n => step^[n] s0

@[simp] theorem orbit_zero {S : Type*} (step : S → S) (s0 : S) : orbit step s0 0 = s0 := rfl

theorem orbit_succ {S : Type*} (step : S → S) (s0 : S) (n : ℕ) :
    orbit step s0 (n + 1) = step (orbit step s0 n) :=
  Function.iterate_succ_apply' step n s0

/-! ## Part 1 — what genuinely transfers: the Σ₁ half

The resemblance the ferry noticed is real, and this is exactly how much of it is real. A positive
(existential) fact about the infinite future IS reachable from the bounded-tick chain: if it is
true at all, some finite tick witnesses it. This is the whole of the transferable content. -/

/-- **The Σ₁ half transfers.** "Some tick satisfies `P`" is equivalent to "some finite prefix
    already contains a tick satisfying `P`". A bounded-tick observer therefore learns every true
    positive fact about its own infinite future, eventually — no MH construction required. -/
theorem sigma1_transfers {S : Type*} (step : S → S) (s0 : S) (P : S → Prop) :
    (∃ N, ∃ n ≤ N, P (orbit step s0 n)) ↔ (∃ n, P (orbit step s0 n)) := by
  constructor
  · rintro ⟨_, n, _, hn⟩
    exact ⟨n, hn⟩
  · rintro ⟨n, hn⟩
    exact ⟨n, n, le_refl n, hn⟩

/-! ## Part 2 — what does NOT transfer: the Π₁ half, in either direction

This is the refutation. `HasModulus f N` says a reader `f` of the trajectory is determined by the
trajectory's first `N` values — which is precisely what a bounded tick is, whether it *produced*
those values (the ferry's "dual direction") or *forced* that much of a received immutable value
(Aaron's "standard MH direction"). Both are finite-window readers, so one theorem refutes both. -/

/-- A reader of the trajectory that is determined by its first `N` values. This is the formal
    content of "bounded": whatever the tick does, it touched only finitely much. -/
def HasModulus (f : (ℕ → Bool) → Bool) (N : ℕ) : Prop :=
  ∀ g h : ℕ → Bool, (∀ n < N, g n = h n) → f g = f h

/-- **Non-vacuity witness for `HasModulus`.** The hypothesis class of `no_finite_window_decides`
    is inhabited — "reads the first value only" is a real finite-window reader. Without this the
    refutation below could be vacuously true and would prove nothing. -/
theorem hasModulus_witness : HasModulus (fun h => h 0) 1 := by
  intro g h hgh
  exact hgh 0 (by omega)

/-- **THE REFUTATION (machine-checked).** No finite-window reader decides the Π₁ half.

    `f h = true ↔ ∃ n, h n = true` is the MH observer's power: deciding, at a single event, whether
    the machine on γ *ever* halts — equivalently, deciding the negative "it never halts" from
    silence. No `f` with a finite modulus has it.

    Proof: two trajectories that agree on the whole window, one of which halts just outside it. The
    reader cannot tell them apart; their answers differ; so it is wrong on one.

    This refutes the property transfer **in both directions at once**:
    * produce direction — a tick that has run `N` bounded laps has modulus `N`;
    * receive direction — a tick that receives an infinite future as an immutable value but forces
      only `N` of it also has modulus `N`. Holding codata is not completing it.

    (MH2) — `γ ⊆ I⁻(p)`, *every* event of γ settled at `p` — is exactly the hypothesis this theorem
    denies, and it is the clause with no Zeta analogue. -/
theorem no_finite_window_decides (f : (ℕ → Bool) → Bool) (N : ℕ) (hmod : HasModulus f N) :
    ¬ (∀ h : ℕ → Bool, f h = true ↔ ∃ n, h n = true) := by
  intro hdec
  -- The two trajectories: one that never halts, one that halts at exactly step `N`.
  have hagree : ∀ n < N, (fun _ : ℕ => false) n = (fun n : ℕ => decide (n = N)) n := by
    intro n hn
    have hne : n ≠ N := by omega
    simp [hne]
  have heq : f (fun _ : ℕ => false) = f (fun n : ℕ => decide (n = N)) :=
    hmod _ _ hagree
  have hhT : f (fun n : ℕ => decide (n = N)) = true :=
    (hdec _).mpr ⟨N, by simp⟩
  have hgT : f (fun _ : ℕ => false) = true := heq.trans hhT
  obtain ⟨n, hn⟩ := (hdec _).mp hgT
  exact Bool.false_ne_true hn

/-- **Non-vacuity witness for the MH observer.** An oracle with MH's power EXISTS — classically.
    Without this, `mh_decider_has_no_finite_window` below would be vacuously true (a theorem over an
    empty hypothesis class proves nothing — the defect this repo spends its life closing).

    Note *which* axiom it costs: `Classical.choice`. That is the honest content of the MH
    construction — Manchak's `p` is a coherent object, not a contradiction, and it is exactly the
    non-computable one. The refutation `no_finite_window_decides` above, by contrast, needs no
    choice at all. The two together say: the observer is consistent, and no bounded tick is it. -/
theorem mh_decider_exists : ∃ f : (ℕ → Bool) → Bool, ∀ h : ℕ → Bool,
    f h = true ↔ ∃ n, h n = true := by
  classical
  exact ⟨fun h => decide (∃ n, h n = true), fun h => by simp⟩

/-- **`p` is exactly what a bounded tick is not.** Restated as the contrapositive: an oracle with
    MH's power has NO finite modulus, at any `N`. There is no budget large enough. Its hypothesis
    class is inhabited by `mh_decider_exists`, so this is not vacuous. -/
theorem mh_decider_has_no_finite_window (f : (ℕ → Bool) → Bool)
    (hdec : ∀ h : ℕ → Bool, f h = true ↔ ∃ n, h n = true) (N : ℕ) : ¬ HasModulus f N :=
  fun hmod => no_finite_window_decides f N hmod hdec

/-! ## Part 3 — where MH's conclusion IS reachable, by a finite certificate

On a finite state space the whole infinite future is decided by exhibiting an **inductive
invariant**: a finite set containing the start, closed under `step`, all of whose members satisfy
`P`. This is the standard safety-verification move (Floyd 1967 / Hoare 1969; finite-state model
checking, Clarke–Emerson 1981, Queille–Sifakis 1982) — and it needs no MH spacetime, which is
precisely why it refutes rather than rescues the analogy. -/

/-- An inductive-invariant certificate for "`P` holds along the whole infinite future". -/
def IsInvariantCert {S : Type*} (step : S → S) (s0 : S) (P : S → Prop) (T : Finset S) : Prop :=
  s0 ∈ T ∧ (∀ s ∈ T, step s ∈ T) ∧ (∀ s ∈ T, P s)

/-- Checking a certificate is a finite, decidable computation — that is the entire point of the
    certificate form. Written as a reducing term (not `by infer_instance`) so the kernel can run it
    under `decide` in the non-vacuity witnesses below. -/
instance decidableIsInvariantCert {S : Type*} [DecidableEq S] (step : S → S) (s0 : S)
    (P : S → Prop) [DecidablePred P] (T : Finset S) : Decidable (IsInvariantCert step s0 P T) :=
  decidable_of_iff (s0 ∈ T ∧ (∀ s ∈ T, step s ∈ T) ∧ (∀ s ∈ T, P s)) Iff.rfl

/-- **The cost lower bound — Aaron's tractability caveat as a theorem.** Any certificate contains
    the entire reachable set. So the method's cost is a property of the *state space*, never of the
    room abstraction: tractability must be argued calculation-by-calculation, exactly as Aaron said.
    (Also the induction step of `forall_orbit_iff_exists_cert`.) -/
theorem cert_contains_orbit {S : Type*} (step : S → S) (s0 : S) (P : S → Prop) (T : Finset S)
    (h : IsInvariantCert step s0 P T) (n : ℕ) : orbit step s0 n ∈ T := by
  obtain ⟨h0, hclosed, _⟩ := h
  induction n with
  | zero => simpa using h0
  | succ k ih => rw [orbit_succ]; exact hclosed _ ih

/-- **The Π₁ half IS decidable on a finite state space** — by a finite certificate, in finite work,
    with no infinite computation and no Malament–Hogarth construction.

    Read together with `no_finite_window_decides`, this is the headline: the bounded-tick room
    attains MH's *conclusion* exactly on the class where that conclusion is already free (halting is
    decidable for finite-state machines regardless), and attains nothing on the class where MH is
    interesting (unbounded state). The construction delivers the theorem only where the theorem is
    free — so it is not the theorem. -/
theorem forall_orbit_iff_exists_cert {S : Type*} [Finite S]
    (step : S → S) (s0 : S) (P : S → Prop) :
    (∀ n, P (orbit step s0 n)) ↔ ∃ T : Finset S, IsInvariantCert step s0 P T := by
  constructor
  · intro hP
    -- The reachable set itself is the certificate; it is finite because `S` is.
    refine ⟨(Set.toFinite (Set.range (orbit step s0))).toFinset, ?_, ?_, ?_⟩
    · simp only [Set.Finite.mem_toFinset]
      exact ⟨0, rfl⟩
    · intro s hs
      simp only [Set.Finite.mem_toFinset, Set.mem_range] at hs ⊢
      obtain ⟨n, rfl⟩ := hs
      exact ⟨n + 1, orbit_succ step s0 n⟩
    · intro s hs
      simp only [Set.Finite.mem_toFinset, Set.mem_range] at hs
      obtain ⟨n, rfl⟩ := hs
      exact hP n
  · rintro ⟨T, hT⟩
    intro n
    exact hT.2.2 _ (cert_contains_orbit step s0 P T hT n)

/-- The decision procedure the previous theorem licenses: a Π₁ fact about the entire infinite
    future, decided by searching the (finite) certificate space. -/
instance decidableForallOrbit {S : Type*} [Fintype S] [DecidableEq S]
    (step : S → S) (s0 : S) (P : S → Prop) [DecidablePred P] :
    Decidable (∀ n, P (orbit step s0 n)) :=
  decidable_of_iff _ (forall_orbit_iff_exists_cert step s0 P).symm

/-! ### Non-vacuity: both truth values occur, and the kernel computes them

A `Decidable` instance that only ever answers one way would be the vacuity class in disguise. These
four are evaluated by `decide`, so the kernel actually runs the certificate search. -/

/-- The predicate is written out rather than inferred: the instance is stated for `∀ n, P (orbit …)`
    and higher-order unification will not recover `P` from `orbit … n = false` on its own. -/
abbrev isFalse : Bool → Prop := fun s => s = false

/-- A finite room whose entire infinite future satisfies `P` — decided by certificate. `isFalse`
    is invariant under `id`, so the search finds `{false}`. -/
example : ∀ n, isFalse (orbit (id : Bool → Bool) false n) := by decide

/-- A finite room whose infinite future does NOT — the SAME instance, opposite answer. `not` leaves
    `false` immediately, so no certificate exists and the search refutes. -/
example : ¬ ∀ n, isFalse (orbit (not : Bool → Bool) false n) := by decide

/-- A cycling room: the always-true predicate holds along the whole orbit; certificate = both
    states. Shows the certificate is genuinely allowed to be larger than one state. -/
abbrev isEitherValue : Bool → Prop := fun s => s = false ∨ s = true

example : ∀ n, isEitherValue (orbit (not : Bool → Bool) false n) := by decide

/-- The Σ₁/Π₁ asymmetry, exhibited concretely: the positive fact is witnessed at a finite tick
    (`sigma1_transfers`' content), while the corresponding negative needed Part 3's finiteness. -/
example : ∃ n, orbit (not) false n = true := ⟨1, by decide⟩

end Zeta.MalamentHogarth
