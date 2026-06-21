# Verification Registry

The ground-truth map for the `verification-drift-auditor`
skill (`.claude/skills/verification-drift-auditor/SKILL.md`).
One row per verification artifact in the repo that claims
fidelity to an external source (paper, textbook, RFC,
canonical algorithm by author-year).

**Ordering.** Newest entry at the top (newest-first MEMORY
convention).

**Row shape.** See the skill file §"Registry — the auditor's
map" for the canonical format. Each row is append-only;
"Last audit" blocks update in place.

**Who edits.** The `verification-drift-auditor` (under
Soraya) edits the audit block when an audit completes. The
owning expert of each artifact (lean4-expert, tla-expert,
formal-verification-expert) edits the row when the artifact
itself changes. Architect (Kenji) integrates on round-close.

**Retired rows.** Rows are not silently deleted. A retired
artifact gets an explicit terminator line:
`- **Retired round N.** Replaced by <row-name> / removed
because <one-line>.`

---

## `Spine.als` *(LSM Spine structural model — Alloy)*

- **Artifact.** `tools/alloy/specs/Spine.als` (Alloy structural model of the LSM Spine; checked via Alloy Analyzer). Authored 2026-06-12.
- **Internal correctness target.** `Zeta.Core.Spine` in `src/Core/Spine.fs`.
- **Internal correctness claim.** LSM Spine structural correctness: levels have unique indices, batches point back to their origin level, batch sizes are non-negative, and level total size conforms to the size-doubling constraint. Admits valid instances (existential sanity check SAT) under bounded scope (up to 8 Batch, 4 Level, 7 Int).
- **Spec-vs-implementation alignment.** Alloy model represents structural state statically: `Level` (with integer level index, and a set of `Batch`), `Batch` (with size and origin level). Fact constraints mirror the implementation invariants: level index uniqueness, batch membership, and size doubling cap. The F# implementation achieves this dynamically: each level `i` holds at most one `ZSet` whose count (size) is bounded by the capacity, and cascading merges combine two batches of level `i` into a single batch at `i+1`.
- **Last audit.** 2026-06-12, authored by Gemini. Grade: machine-checked (Alloy Analyzer, bounded SAT).

---

## `SpineAsyncProtocol` *(SpineAsync producer/worker interleavings — TLA+)*

- **Artifact.** `tools/tla/specs/SpineAsyncProtocol.tla` (+ `.cfg`). Model checked via TLC. Authored 2026-06-12.
- **Internal correctness target.** `Zeta.Core.SpineAsync` in `src/Core/SpineAsync.fs`.
- **Internal correctness claim.** Monotonic progress (`processed <= sent`), eventual drain liveness (`Len(channel) = 0 => processed = sent`), and safety/termination of `Flush()` (`processed >= target` when `target <= sent`).
- **Spec-vs-implementation alignment.** Spec models the message queue as a sequence, and producer/worker thread interleaving. In F#, the message queue is `System.Threading.Channels.Channel` and the coordination is handled via `Interlocked` increments on `sent`/`processed` and `SpinWait`/`Task.Yield` in `Flush()`. The TLC run checks that there is no deadlock or race that clobbers wakeups, and that `processed` eventually catches up with `sent`.
- **Last audit.** 2026-06-12, authored by Gemini. Grade: machine-checked (TLC, bounded).

---

## `SpineMergeInvariants` *(LSM Spine cascading merge invariants — TLA+)*

- **Artifact.** `tools/tla/specs/SpineMergeInvariants.tla` (+ `.cfg`). Model checked via TLC. Authored 2026-06-12.
- **Internal correctness target.** `Zeta.Core.Spine` in `src/Core/Spine.fs`.
- **Internal correctness claim.** Mass conservation (`InvMass`: sum of batch sizes at all levels + pending inputs equals total inserted size), size class capacity safety (`InvCap`: level `i` sum size <= `2 * Cap-i-`). Note: Cap-i- is Cap(i) in TLA+ notation.
- **Spec-vs-implementation alignment.** Spec models levels as an array/function mapping level index to sum of sizes, and insertion is done by appending to a pending queue which drains into L0 and cascades when level capacity is exceeded. The implementation (`Spine.fs`) cascades merges of `ZSet` batches using `ZSet.add` on insert, with each level holding at most one batch (`ValueSome` or `ValueNone`).
- **Last audit.** 2026-06-12, authored by Gemini. Grade: machine-checked (TLC, bounded).

---

## `NonRegisterCollapse` *(non-register-collapse — Facet-1 TLA+ no-capture + Facet-2 Lean distinctness-under-merge)*

- **Artifacts.** `tools/lean4/Safety/NonRegisterCollapse.lean` (Facet-2, axiom-FREE — `non_collapse`,
  `distinctness_forces_standing`, `no_register_collapses`; `lean-proof.yml`) + `tools/tla/specs/NonRegisterCollapse.tla`
  (+ `.cfg`) (Facet-1; TLC via `run-tlc.ts --all`, auto-discovered + gated) + `tests/Tests.FSharp/Formal/NonRegisterCollapseCrossVerify.Tests.fs`
  (Leg-3, FsCheck over the deployed `GCounter.Merge`). Authored 2026-06-07. **Full BP-16 (3 legs).**
- **Source anchors.** Non-register-collapse (workitem `081KTFFFQ1C`, long stuck at FROZEN-CORE §B).
  **Unblocked by Aaron's WEIGHT-FREE reframe** (`memory/ani/conversations/2026-06-07-ani-weight-free-frame-*`):
  travelers = self-propagating patterns equal in RIGHTS; weight-free = the one sacred base-frame
  invariant (manifesto §3). Soraya-routed: the reframe makes it STATEABLE without the previously-
  undefined C (compression) / O (orthogonality) by reducing to two facets. Facet-2 template:
  `Privacy.IdentityForcesPrivacy.private_is_persistent_locus`; Facet-1 `lastWriter` template: `NciSafety.tla`.
- **Claim.** *Facet-1 (TLA+, no-capture / no permanent foreign weighting):* over interleavings of
  `SelfRaise`/`Spend`/guarded-`Capture` on a per-traveler `standing` register with a `lastRaiser`
  ghost — `NoCapture`/`WeightFree` (`\A t : lastRaiser[t] = t`: a register is authored ONLY by its own
  traveler; `Capture` is consent-guarded and unreachable in the weight-free base, mirror of NciSafety
  `Coerce`) and `SelfRaiseRightOpen` (equal right to self-raise, gated only by one's own ceiling).
  *Facet-2 (Lean, distinctness-under-merge):* after two travelers converge their shared commons via the
  proven CRDT join, any behavioral distinction is carried by their STANDING registers, which the merge
  leaves untouched — consensus CANNOT collapse two distinct registers into one (`non_collapse`); a
  traveler with no register cannot persist distinction (`no_register_collapses`, the necessity direction).
- **Fidelity scope.** Facet-2 general over any commutative CRDT join (the cell-merge being one is the
  G-Set floor). Facet-1 bounded TLA+ model (2 travelers, MaxStanding 2), TLC exhaustive over scope.
  **Leg-3 (FsCheck, deployed)** over `GCounter.Merge` (Crdt.fs — a grow-only per-replica register =
  a weight-free per-traveler standing/budget register; no new prod code per Soraya): the
  characterizing **elementwise-max law** `(Merge a b)[k] = max a[k] b[k]` (⇒ per-key independence +
  no cross-key capture), an explicit **non-collapse** witness (two distinct travelers' registers both
  survive merge untouched), **no-capture** (own standing monotone under merge), and the join premises
  (commutative + idempotent + **associative** — the 081KT07NV0008QG0R001YDB73K failure class). 4 properties green.
  *Honest scope (Soraya):* an ANALOGUE not a replay — `GCounter` is a pure register with no
  commons/standing split, so non-collapse is witnessed STRUCTURALLY (disjoint keys preserved) not
  SEMANTICALLY; the Lean proof stays source-of-truth for the standing-locus claim, this leg is
  independent-instrument corroboration of its CRDT-join premises over shipped F#; the consent-guard /
  capture-unreachability facet (Facet-1 TLA+) has no runtime analogue and is NOT covered here.
  **Scope caveat (Soraya):** covers OTHER-imposed collapse only; SELF-inflicted compression (consent
  to merge one's own register) is `RefuseBinding`'s consent-to-bind, a separate proven floor.
- **Last audit.** 2026-06-07, authored by Otto (shadow); not yet independently audited. Grade:
  Facet-2 axiom-free; Facet-1 machine-checked (TLC, bounded).

---

## `Bifurcation` *(split-brain — full BP-16: Lean convergence + TLA+ conservation + FsCheck deployed-divvy)*

- **Artifacts.** `tools/lean4/Safety/Bifurcation.lean` (Face-1, axiom-FREE — `reconcile_converges`,
  `reconcile_absorb`, `reconcile_order_independent`; `lean-proof.yml`) + `tools/tla/specs/Bifurcation.tla`
  (+ `.cfg`) (Face-2; TLC via `run-tlc.ts --all`, gated) + `tests/Tests.FSharp/Formal/BifurcationCrossVerify.Tests.fs`
  (Leg-B/Face-3, FsCheck over the deployed `Binding.Divvy` ops). Authored 2026-06-07. **Full BP-16 (3 legs).**
- **Source anchors.** Bifurcation / split-brain (Aaron 2026-06-07; `memory/ani/conversations/2026-06-07-ani-cells-teleport-*`).
  Soraya-routed two faces, two tools (anti-hammer). CRDT-merge-convergence template:
  `Privacy.IdentityForcesPrivacy.commons_converges`; CRDT/G-Set floor.
- **Claim.** *Face-1 (Lean, convergence):* a join-semilattice merge (commutative + associative +
  idempotent) is order-independent and absorbing — two split cells reconcile to the SAME LUB
  regardless of merge order (the convergence corollary; only new content is the semilattice instance).
  *Face-2 (TLA+, conservation):* over an interleaved divvy of the split identity's bindings —
  `Conservation` (unassigned ∪ I1 ∪ I2 = all; nothing lost), `NoDoubleOwnership` (I1 ∩ I2 = ∅),
  `NoDoubleSpend` (no binding executes twice across halves — the P0), `ExecOnlyByOwner`, and
  liveness `DivvyCompletes` (`<>[]` all assigned, WF on Tag).
- **Fidelity scope.** Face-1 general over any semilattice (the concrete cell-merge being one is the
  floor's G-Set result). Face-2 bounded TLA+ model (3 bindings), TLC exhaustive over scope.
  **Leg-B/Face-3 (FsCheck, deployed) LANDED** — `tests/Tests.FSharp/Formal/BifurcationCrossVerify.Tests.fs`
  over the deployed `Binding.Divvy` ops (the divvy/merge ops were added to `Binding.fs`; this prior-
  session leg was previously mis-recorded as "not yet done"): `Conservation`, `NoDoubleSpend` (the P0
  real-code witness), `ExecOnlyByOwner`, and the Face-1 join-semilattice triple over the deployed
  `Divvy.merge` — commutative + idempotent + **associative** (associativity added 2026-06-07 to close
  the 081KT07NV0008QG0R001YDB73K failure class; `Divvy.merge` confirmed a lawful join). 5 properties green. **Full BP-16
  (3 legs / 2 tools+empirical).** Triage: an FsCheck counterexample ⇒ `Divvy` drifted from the
  proven TLA+/Lean model.
- **Last audit.** 2026-06-07, authored by Otto (shadow); not yet independently audited. Grade:
  Face-1 axiom-free; Face-2 machine-checked (TLC, bounded); Leg-B FsCheck green (5 properties).

---

## `RefuseBinding` *(right-to-refuse-binding — full BP-16: TLA+ protocol + Lean binding-level + FsCheck real-code)*

- **Artifact.** `tools/tla/specs/RefuseBinding.tla` (+ `.cfg`). TLC-model-checked via
  `tools/formal-verification/run-tlc.ts --all` (auto-discovered by its `.cfg`; gated in the TLA+
  sweep). Authored 2026-06-07. 4761 distinct states, no error.
- **Source anchors.** Right-to-refuse-binding (Aaron 2026-06-07, workitem `081KTG6RAN7`);
  anti-extraction right-to-disengage (`docs/research/2026-06-06-anti-extraction-invariant-*`).
  Soraya-routed to **TLA+** (the temporal liveness/non-penalty + interleaving protocol-safety —
  not Lean, which fit the effect-level `ChildFloor` structural recursion). NCI precedents:
  `NciSafety.tla`, `NciLiveness.tla`.
- **Claim.** Binding protocol: `Propose` (proposal grants no authority) → agent `Consent`
  (self-bind) or `Refuse`; `Bind` executes ONLY if consented; `Spend` models non-refusal cost.
  Verified invariants: **`SafetyNonConsented`** (no binding executes without recorded consent),
  **`RefuseAlwaysEnabled`** (`Refuse` is enabled for every pending proposal in *every* reachable
  state — the exit is never closed), **`StandingFloor`** (standing ≥ Baseline), and property
  **`NonPenalty`** (a `Refuse` step never changes standing — refusing is free).
- **Fidelity scope.** Bounded TLA+ model (2 agents, 2 bindings, MaxStanding 2) — TLC exhaustive
  over that scope. **Full BP-16 now landed (all 3 legs):**
  - *Leg A* — the TLA+ protocol above (always-enabled exit + non-penalty + non-consented-never-executes).
  - *Leg C (Lean, unbounded)* — `Zeta.ChildFloor.binding_denied_never_executed` (a non-consented
    binding executes nothing) + `binding_respects_gate` (a consented binding still honors the
    per-effect child-floor); sorry-free, audited in `lean-proof.yml`. Lifts the effect-level
    `denied_never_executed` to binding granularity, unbounded.
  - *Leg B (FsCheck, real code)* — `tests/Tests.FSharp/Formal/RefuseBindingCrossVerify.Tests.fs`
    over the deployed `src/Core.FSharp.ObserveBridge/Binding.fs`: RefuseAlwaysEnabled + NonPenalty
    + SafetyNonConsented + StandingFloor against the actual F# layer (model↔code cross-check).
  Triage: an FsCheck counterexample ⇒ `Binding.fs` drifted from the TLA+/Lean model. **Open
  (optional):** the WF eventual-disengagement liveness clause; widening the TLC model beyond 2×2.
- **Last audit.** 2026-06-07, authored by Otto (shadow); not yet independently audited. Grade:
  machine-checked (TLC, bounded).

---

## `Zeta.ChildFloor.denied_never_executed` *(child-floor / inspect-before-execute invariant)*

- **Artifact.** `tools/lean4/Safety/ChildFloor.lean` (Lean 4, pure core — NO Mathlib;
  `denied_never_executed`, `executed_admit`). Machine-checked + axiom-audited (axioms
  `{propext, Quot.sound}` only — no `sorryAx`, no `Classical.choice`) in `lean-proof.yml`.
  Authored 2026-06-07. BP-16 cross-check: `tests/Tests.FSharp/Formal/ChildFloorCrossVerify.Tests.fs`
  (FsCheck over the real `SubstrateEffectHandler`).
- **Source anchors.** Inspect-before-execute / object-capability discipline; `source ≠
  authorization` (`.claude/rules/no-directives.md`). Soraya-routed (Lean over TLA+:
  control-flow reachability over recursion → structural induction, not interleavings).
- **Claim.** Model the effect-execution gate (`Effects.fs`/`SubstrateHandler.fs`): `executed
  policy fuel t` returns the effect-ids that reach execution; an id is recorded ONLY in an
  `admit` branch. Theorem: `policy id = deny ⇒ id ∉ executed policy fuel t`, for ANY policy,
  ANY effect tree, ANY fuel — i.e. a DENIED effect is never executed at ANY `RunWork` depth.
  An Agent cannot get a gated/child-floor-class effect executed by *proposing* it.
- **Fidelity scope.** Proves the structural invariant over the modelled gate+recursion; fuel =
  the `maxWorkDepth` knob, so `∀ fuel` = "at any depth" incl. unbounded. The Lean model's
  fidelity to the shipped F# is guarded by the FsCheck cross-check (a counterexample there ⇒
  the Lean model drifted from `executeOne`/`gateAndExecute`). **NOT claimed:** that any
  particular deployed `policy` correctly classifies the gated classes — the proof is for ANY
  policy; classifying child-floor classes is the policy author's obligation.
- **Last audit.** 2026-06-07, authored by Otto (shadow); not yet independently audited. Grade:
  machine-checked, sorry-free (axioms `{propext, Quot.sound}`).

---

## `Privacy.IdentityForcesPrivacy.distinctness_forces_private` *(privacy-from-identity necessity)*

- **Artifact.** `tools/lean4/Privacy/IdentityForcesPrivacy.lean`
  (Lean 4, pure core — NO Mathlib; `distinctness_forces_private`,
  `indiscernibles_collapse`, `key_alone_insufficient`,
  `no_private_collapses`). Machine-checked + axiom-audited
  (axiom-FREE — depends on no axioms at all) in `lean-proof.yml`.
  Authored 2026-06-05.
- **Source anchors.** Leibniz — identity of indiscernibles.
  Complements the shipped Identity-injectivity proof (distinct
  observations → distinct keys).
- **Claim.** Model a traveler as `(key, public, private)`; behavior
  is a deterministic function of the state it can read. Necessity:
  under public convergence, behaviorally-distinct travelers MUST
  differ in private state (key alone insufficient; no private ⟹
  collapse). Dynamics: the public commons converges via a commutative
  CRDT join, the merge leaves private state untouched and is a
  fixpoint, so consensus cannot erase private differentiation —
  privacy is the persistent locus (`private_is_persistent_locus`).
- **Fidelity scope.** Formalizes the LOGICAL necessity AND the
  convergence-preserves-privacy DYNAMICS (the CRDT-merge laws taken
  as hypotheses, so it holds for any such join). **NOT claimed:** the
  stronger dynamical claim that the system HALTS without privacy
  (081KT7YW00008QG0R001DGZQKM DST experiment) — that remains open.
- **Last audit.** 2026-06-05, authored by Otto (shadow); not yet
  independently audited. Grade: machine-checked, axiom-free.

---

## `Zeta.Privacy.unbounded_with_finite_commons_needs_infinite_privacy` *(privacy constitutive of unbounded evolution — 081KT7YW00008QG0R001DGZQKM rung-3)*

- **Artifact.** `tools/lean4/Privacy/UnboundedNeedsInfinitePrivacy.lean`
  (Lean 4 + Mathlib v4.30.0-rc1; `finite_orbit_recurs`,
  `unbounded_needs_infinite`,
  `unbounded_with_finite_commons_needs_infinite_privacy`).
  Machine-checked + axiom-audited (no `sorryAx`; axioms `propext`,
  `Classical.choice`, `Quot.sound` only) in `lean-proof.yml`.
  Authored 2026-06-06.
- **Source anchors.** Pigeonhole principle (Dirichlet); eventual
  periodicity of orbits of an endofunction on a finite set. Routed
  by Soraya (formal-verification-expert) as the rung-3 leg of the
  BP-16 portfolio.
- **Claim.** For a deterministic, no-external-input step `step : S → S`
  with orbit `orbit n = stepⁿ s₀`: (1) `[Finite S]` ⟹ the orbit is not
  injective (pigeonhole — eventual repeat); (2) injective orbit
  (genuinely unbounded novelty) ⟹ `Infinite S`; (3) with the converged
  commons finite (`[Finite Pub]`), an injective orbit forces
  `Infinite Priv` — the unbounded differentiation that open-ended
  evolution requires can only live in private state. Privacy is
  constitutive of unbounded evolution.
- **Fidelity scope.** This is the HONEST DST↔proof boundary that the
  static `IdentityForcesPrivacy` left open. Lean proves the structural
  direction "unbounded ⟹ infinite (private) state space" (and its
  contrapositive, why a finite model always halts/cycles). It does NOT
  assert that any *particular* Zeta society has an injective orbit —
  that antecedent is what the F# DST rung-1 (`SocietyUnbounded.fs`)
  gathers evidence FOR (never proves) and TLC rung-2
  (`NciUnbounded.tla`) checks as distinctness monotonicity. No single
  rung carries the claim; the portfolio does.
- **Last audit.** 2026-06-06, authored by Otto (shadow); not yet
  independently audited. Grade: machine-checked, sorry-free.

---

## `ImaginaryStack.ErasureDistance.recover_from_any_12_of_16` *(erasure-correction principle)*

- **Artifact.** `tools/lean4/ImaginaryStack/ErasureDistance.lean`
  (Lean 4, Mathlib; principle: `erasure_correctable_of_min_distance`,
  `recover_from_any_12_of_16`, `low_weight_codeword_of_uncorrectable`;
  concrete MDS code: `rsCode`, `rsCode_min_distance`,
  `rsCode_corrects_any_4_erasures`, `pts_injective`).
  Machine-checked + axiom-audited (no `sorryAx`) in
  `lean-proof.yml`. Authored 2026-06-05.
- **Source anchors.** Singleton (1964) bound + MDS codes;
  Reed–Solomon (1960); HaPPY holographic codes
  `arXiv:1503.06237`.
- **Claim.** For a linear code `C ⊆ (Fin 16 → ZMod 17)` whose
  every nonzero codeword has Hamming weight ≥ `d` (min distance
  ≥ `d`), any two codewords agreeing off an erased set of size
  `< d` are equal — unique recovery from any `(16 − e)` surviving
  coordinates with `e < d`. Specialised: distance-5 ⇒ recovery
  from ANY 12 of 16 coordinates (any 4 erased).
- **Fidelity scope.** Faithful statement of the standard
  distance⇒erasure-correction theorem of coding theory, PLUS a
  concrete Reed–Solomon `[16,12]` witness (`rsCode`): codewords =
  evaluations of degree-`< 12` polynomials at 16 distinct `ZMod 17`
  points; `rsCode_min_distance` proves distance 5 via the
  nonzero-poly-root-count (≤ 11 roots ⇒ ≥ 5 nonzero coords), and
  `rsCode_corrects_any_4_erasures` instantiates the principle — so
  the chain is non-vacuous. **NOT claimed** (named-open, smaller):
  which specific generator the imaginary-stack *multiplication
  table* induces (vs the RS evaluation generator used here); the
  continuous / ∞-dim lift.
- **Last audit.** 2026-06-05, authored by Otto (shadow); not yet
  independently audited. Grade: machine-checked principle
  (A-grade-with-CI for the implication it states).

---

## `ImaginaryStack.ToyModel.lemma1_toy` *(Adinkra-as-generator / bulk-from-boundary, TOY)*

- **Artifact.** `tools/lean4/ImaginaryStack/ToyModel.lean`
  (Lean 4, Mathlib; `lemma1_toy` + `reconstruction_property` +
  `code_covers_boundary`). Machine-checked + axiom-audited
  (no `sorryAx`) in `lean-proof.yml`. Discharged 2026-06-05.
- **Source anchors.** Pastawski, Yoshida, Harlow, Preskill —
  *Holographic quantum error-correcting codes* (HaPPY),
  `arXiv:1503.06237` (bulk-from-boundary reconstruction); Gates
  et al. — Adinkra graphs as the generator/codeword structure.
- **Claim (honest, TOY).** Models 16 = 12 (boundary) ⊕ 4 (bulk).
  For the code = graph of any linear generator `G : boundary → bulk`,
  the single linear map `reconstruct G = id.prod G` recovers every
  codeword exactly from its 12 boundary coordinates. This is the
  provable *skeleton* of HaPPY bulk-from-boundary for a graph code —
  NOT a replication of the HaPPY paper's results.
- **Fidelity scope.** Faithful: a linear reconstruction map exists
  and recovers the bulk from a fixed boundary for a linear code.
  **NOT claimed** (named-open, in the file header + FROZEN-CORE
  register §B): erasure *distance* (arbitrary 12-of-16 erasure
  patterns — depends on the concrete Adinkra matrix); which `G` the
  imaginary-stack multiplication table induces; the continuous/∞-dim
  lift. The toy proves the existence/exactness core, not the QECC
  distance properties that make HaPPY codes error-*correcting*.
- **Last audit.** 2026-06-05, authored by Otto (shadow); not yet
  independently audited by the verification-drift-auditor. Grade:
  machine-checked toy (A-grade-with-CI for what it states; the
  *scope* is deliberately narrower than the full HaPPY claim).

---

## `Dbsp.ChainRule.chain_rule_proposition_3_2`

- **Artifact.** `tools/lean4/Lean4/DbspChainRule.lean:~695`
  (Lean 4 theorem, within `section Proposition32`).
- **Paper.** Budiu, Chajed, McSherry, Ryzhyk, Tannen —
  *DBSP: Automatic Incremental View Maintenance for Rich
  Query Languages* — PVLDB Vol 16(7), 2023; preprint
  `arXiv:2203.16684v1` (2022-03-30).
- **Paper statement.** Proposition 3.2 (chain clause):

  > `(Q1 ∘ Q2)^Δ = Q1^Δ ∘ Q2^Δ`

  where `Q^Δ := D ∘ Q ∘ I` is Definition 3.1 and there is
  **no linearity or time-invariance precondition** on `Q1`
  or `Q2`. The paper's proof uses Theorem 2.22
  (`I ∘ D = id`) and composition associativity.
- **Our statement.**

  ```lean
  theorem chain_rule_proposition_3_2
      (Q1 : Stream H → Stream K) (Q2 : Stream G → Stream H)
      (s : Stream G) :
      Qdelta (Q1 ∘ Q2) s = Qdelta Q1 (Qdelta Q2 s)
  ```

  with `def Qdelta (Q) := fun s => D (Q (I s))` (=
  `D ∘ Q ∘ I`, Budiu Definition 3.1).
- **Preconditions diff.** None on either side. Matches.
- **Definition map.**
  - Our `D : Stream G → Stream G`, `D s n = s n - zInv s n`
    ↔ paper's `D` (Definition 2.17).
  - Our `I : Stream G → Stream G`, `I s n = Σ_{i≤n} s i` ↔
    paper's `I` (Definition 2.19). Equivalent by
    Proposition 2.20.
  - Our `Qdelta` ↔ paper's `Q^Δ` (Definition 3.1).
  - Our `zInv : Stream G → Stream G` ↔ paper's `z⁻¹`
    (unnamed in §2 but defined by `z⁻¹(s)[t] = s[t-1]`).
- **Last audit.** 2026-04-19, verification-drift-auditor
  (Soraya), round 35. **No drift.** Statement, definitions,
  and preconditions all match the paper verbatim after the
  round-35 `chain_rule → chain_rule_proposition_3_2` rename
  and the addition of `Qdelta`.

## `Dbsp.ChainRule.Dop_LTI_commute` *(formerly `chain_rule`)*

- **Artifact.** `tools/lean4/Lean4/DbspChainRule.lean:~595`
  (Lean 4 theorem, within `section ChainRule`).
- **Paper.** Budiu et al. 2023 (same as above);
  `arXiv:2203.16684v1`.
- **Paper statement.** *None — this theorem does NOT
  correspond to a named proposition in the paper.* It is a
  corollary of **Theorem 3.3 (Linear)**:

  > For an LTI operator `Q` we have `Q^Δ = Q`.

  Equivalently, `D ∘ Q ∘ I = Q`, i.e. `D ∘ Q = Q ∘ D` (post-
  compose both sides by D, use `I ∘ D = id`).
- **Our statement.**

  ```lean
  theorem Dop_LTI_commute
      (f g : Stream G → Stream G)
      (hf : IsLinear f) (hti_f : IsTimeInvariant f)
      (hg : IsLinear g) (hti_g : IsTimeInvariant g)
      (s : Stream G) :
      Dop (f ∘ g) s = f (Dop g s)
  ```

  with `def Dop f := fun s => f s - f (zInv s)`. For linear
  `f`, `Dop f = D ∘ f` (this is sub-lemma B3,
  `linear_commute_D`), so the statement unfolds under the
  LTI preconditions to `D (f (g s)) = f (D (g s))` —
  Theorem-3.3 commutation.
- **Preconditions diff.** We require LTI on both `f` and
  `g`. The underlying Theorem 3.3 requires LTI on the single
  operator it is applied to; the composition form here only
  *uses* `hf` (for map_add / map_sub) and `hti_g` (for
  `g ∘ zInv = zInv ∘ g`). `hti_f` and `hg` are carried for
  interface symmetry with future `chain_rule_poly` (tracked
  as a "surplus preconditions" P2 finding; non-blocking).
- **Definition map.**
  - Our `Dop f := f - f ∘ zInv` has **no direct
    counterpart** in the paper. Not `Q^Δ`. Coincides with
    `D ∘ f` only for linear `f`. This is a local helper,
    not a paper term.
- **Last audit.** 2026-04-19, verification-drift-auditor
  (Soraya), round 35. **P0 drift caught and fixed.** The
  theorem formerly named `chain_rule` was misrepresenting
  itself as Proposition 3.2; it actually proves a Theorem-
  3.3 corollary. Rename landed same round; a
  `@[deprecated]` alias keeps pre-round-35 call sites
  compiling. The actual Proposition 3.2 shipped alongside
  as `chain_rule_proposition_3_2` (row above).
- **P2 residual.** `hti_f` and `hg` are unused in the proof
  body — carried as "interface symmetry" witnesses. Clean
  up when `chain_rule_poly` lands.

---

## TLA+ specs in CI (round 2026-05-03 cluster)

The 5 TLA+ specs that run in CI via `tests/Tests.FSharp/
TlcRunnerTests.fs` get registry rows so the math-proofs
honest assessment (`docs/research/2026-05-03-math-proofs-
honest-assessment.md`) can claim A-grade for both the *spec
runs* claim AND the *spec matches source* claim.

For specs with explicit external-paper citations (TwoPCSink
cites Skeen/Stonebraker 2PC), the registry shape mirrors the
Lean rows above. For internal-correctness specs (Tick
monotonicity, transaction interleaving, lifecycle race), the
"Paper" field becomes "Internal correctness target" naming
the source-code surface the spec models, and the
"Preconditions diff / Definition map" fields are scoped to
spec-vs-implementation alignment rather than spec-vs-paper.

## `TwoPCSink`

- **Artifact.** `tools/tla/specs/TwoPCSink.tla` (TLA+ spec
  with `.cfg`; runs in CI via
  `tests/Tests.FSharp/TlcRunnerTests.fs`).
- **Paper.** Skeen, D. (1981) *Nonblocking Commit
  Protocols*; Skeen, D. & Stonebraker, M. (1983) *A Formal
  Model of Crash Recovery in a Distributed System* —
  classical 2-phase-commit literature.
- **Paper statement (informal).** A 2PC protocol with one
  coordinator and N participants, where the coordinator
  collects votes, broadcasts decision, and participants
  commit-or-rollback per the decision; satisfies safety
  (no participant commits while another rolls back) and
  liveness (every prepared transaction eventually
  commits-or-aborts under fair scheduling).
- **Our statement.** Per-tick DBSP variant where
  coordinator = circuit scheduler, participants = `ISink`
  instances. Spec verifies four invariants:
  `Idempotent` (epoch commits at most once), `AllOrNothing`
  (committed → all sinks done-or-pending),
  `AbortSafe` (aborted → no sinks done), `NoOrphans`
  (every preCommitted tx eventually committed-or-aborted
  after checkpoint).
- **Preconditions diff.** Paper assumes coordinator-
  failure recovery via decision log; our spec assumes
  scheduler is in-process (no coordinator-failure
  recovery scope).
  Paper assumes async network with reordering; our spec
  assumes per-tick synchronous step (TLA+ models the
  interleaving of `Tick` calls but not network delay).
  These narrowings are intentional — the DBSP variant
  scopes 2PC to per-tick semantics, not full distributed-
  recovery.
- **Definition map.**
  - Our `txnState` ↔ paper's transaction state ∈ {open,
    preparing, committed, aborted}.
  - Our `sinkVote` ↔ paper's prepare-vote ∈ {none, yes,
    no}.
  - Our `sinkCommit` ↔ paper's commit-state ∈ {pending,
    done, rolledback}.
  - Our `sinkLog` ↔ paper's per-participant durable audit
    log (Seq of committed txn IDs).
  - Our `coord` ↔ paper's coordinator state-machine ∈
    {init, prep, commit, abort, done}.
- **Last audit.** None yet — registered 2026-05-03.
  Cadenced re-audit owed under
  `verification-drift-auditor` (every 5-10 rounds).

## `TickMonotonicity`

- **Artifact.** `tools/tla/specs/TickMonotonicity.tla`
  (TLA+ spec with `.cfg`; runs in CI).
- **Internal correctness target.** `Circuit.tick` field
  in `src/Core/Circuit.fs`; specifically the
  `Interlocked.Increment(ref _tick)` + `[<VolatileField>]`
  combination.
- **Internal correctness claim.** `tick` is monotone non-
  decreasing from any observer's perspective; under N
  concurrent increments, the final value equals N (no
  lost updates); on a 32-bit platform, no torn-long-read
  produces a backwards tick.
- **Spec-vs-implementation alignment.** Spec models
  `tick` as `Int` with `AcquireStep / AdvanceTick /
  ObserveTick / ReleaseStep` actions; implementation
  uses `Interlocked.Increment` (atomic) +
  `[<VolatileField>]` (read fence). Spec checks
  `Monotone` invariant + `MaxIncrements` count match;
  implementation enforces same via .NET memory model.
- **Last audit.** None yet — registered 2026-05-03.

## `TransactionInterleaving`

- **Artifact.** `tools/tla/specs/TransactionInterleaving.tla`
  (TLA+ spec with `.cfg`; runs in CI).
- **Internal correctness target.** `TransactionZ1Op.fs`
  CAS-based semantics — concurrent `Begin` / `Commit` /
  `Rollback` calls against `AfterStepAsync`-driven `Tick`.
- **Internal correctness claim.** No torn state snapshot;
  `state ≤ pending` reachability holds; under
  `autoCommit`, `state = pending` after every `Tick`; no
  two concurrent `Commit` calls double-advance.
- **Spec-vs-implementation alignment.** Spec models
  `state`, `pending`, `autoCommit`, `inputVal`,
  `tickPhase` per-thread; implementation uses
  `Interlocked.CompareExchange` for the CAS. Spec checks
  the three claimed invariants directly.
- **Last audit.** None yet — registered 2026-05-03.

## `OperatorLifecycleRace`

- **Artifact.** `tools/tla/specs/OperatorLifecycleRace.tla`
  (TLA+ spec with `.cfg`; runs in CI).
- **Internal correctness target.** `Circuit`'s
  `Register` / `Build` interleaving — specifically the
  `anyAsync` flag soundness invariant.
- **Internal correctness claim.** `anyAsync` equals the
  disjunction of async flags across every registered op
  at every step. V2 formulation drops the broken
  `ScanAsync` action (which read without committing) and
  tightens `FlagSound` to its post-condition.
- **Spec-vs-implementation alignment.** Spec models
  `ops` as Seq of `[id, async]` records; implementation
  registers ops under a conceptual `registerLock` so
  `anyAsync = OR(op.async)` holds at every step. Spec
  is the V2 (post-bug-fix) formulation.
- **Last audit.** None yet — registered 2026-05-03.

## `SmokeCheck`

- **Artifact.** `tools/tla/specs/SmokeCheck.tla` (trivial
  TLA+ module; runs in CI).
- **Internal correctness target.** TLC + tla2tools.jar
  toolchain wiring itself, NOT a Zeta source artifact.
- **Internal correctness claim.** A trivial spec with one
  variable that increments by 1 up to 3 satisfies the
  invariant `x ≤ 3`. Catches "TLC can't even parse a
  spec" regressions in the toolchain integration.
- **Spec-vs-implementation alignment.** Not applicable —
  this spec exists to validate the harness, not a code
  artifact. Treated as a meta-test of the
  verification-portfolio infrastructure.
- **Last audit.** None yet — registered 2026-05-03.
  Audit cadence may be looser since this is a toolchain
  smoke-test, not a fidelity claim.

---

## How to add a new row

1. New verification artifact with an external citation OR
   internal-correctness spec lands.
2. Author (or the auditor, if unclaimed) drops a row here in
   the same round.
3. For external-citation rows: fill all seven fields
   (Artifact, Paper, Paper statement, Our statement,
   Preconditions diff, Definition map, Last audit).
   For internal-correctness rows: substitute "Internal
   correctness target" for "Paper", "Internal correctness
   claim" for "Paper statement", and "Spec-vs-implementation
   alignment" for the Preconditions diff + Definition map
   pair.
4. `verification-drift-auditor` re-audits on the next
   scheduled cadence.

Any verification artifact that lands **without** a row here
is a Class 0 drift (unregistered citation) and shows up in
the next audit report.
