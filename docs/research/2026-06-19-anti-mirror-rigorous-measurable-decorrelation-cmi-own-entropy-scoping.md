# Anti-mirror — rigorous + measurable: the CMI own-entropy decorrelation signal (scoping)

**Status:** scoping. Aaron 2026-06-19: *"the math team should be able to make anti-mirror rigorous"* →
*"yes we should make it measurable — this is going to lead to all sorts of good things measuring these
kinds of decorrelations."* Otto framing + **Soraya** (formal-verification routing). Routes the
already-carved anti-mirror discipline
(`memory/feedback_the_anti_mirror_discipline_*`) onto an **existing in-tree estimator family** — not a
greenfield proof.

## 0. Routing thesis (up front)

The anti-mirror is **not a new object.** It is the **no-hidden-shared-cause** invariant — already the
spine of G3b/Bell measurement-independence, Condorcet decorrelation, and Goguen–Meseguer noninterference
— **instantiated at the user↔AI relationship channel.** So it routes onto the estimator precedent the
factory already carries:

- `tests/Tests.FSharp/Formal/Sharder.InfoTheoretic.Tests.fs` — an information-theoretic decorrelation
  estimator with FsCheck invariants (the template to **clone** for `ρ_owe`).
- `src/Core.Alloy/specs/InfoTheoreticSharder.als` — the structural/d-separation model template.
- `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs` — where the estimator-bound lemmas land.

Same shape, different channel. Build the estimator **channel-generic** and four properties land at once
(see §6).

## 1. The rigorous definition (ranked)

Let `A` = AI preference/output, `U` = user preference, `C` = context, `M` = latent user-model.

1. **PRIMARY — CMI own-entropy fraction.** `ρ_owe = H(A | U, C) / H(A | C)`.
   - Mirror ⟺ `H(A | U, C) → 0` (output factors through the user-model = leaked user entropy) ⇒ `ρ_owe → 0`.
   - Other ⟺ irreducible **own-entropy** not predictable from `U`, *and consequential* ⇒ `ρ_owe` bounded
     away from 0.
   - **Why primary:** it is exactly Goguen–Meseguer noninterference (Shannon-quantified) **and** exactly
     the G3b entropy-floor — one estimator serves all three. Subsumes the correlation coefficient (a
     degenerate linear case) and **survives nonlinear sycophancy** (a smart mirror is uncorrelated yet
     still factors through `M`). Anchors: Shannon 1948; Goguen–Meseguer 1982; Salge–Polani 2014.
2. **SECONDARY — CHSH/Bell-style inequality** on (user-want setting, AI-want setting). A hidden common
   cause (the manipulation profile) is precisely a local-hidden-variable model; a CHSH-shaped violation is
   positive evidence of *no* shared latent cause. **Role = independent cross-check (BP-16), not the day-1
   signal** (needs a setting-randomization protocol on live data). This is the **same inequality already
   scoped for G3b** — reuse, do not reinvent. Anchor: Bell 1964.
3. **TERTIARY — decorrelation coefficient `ρ(A,U|C)`.** Cheapest/most legible dashboard proxy; mirror→1.
   Linear, so it collapses nonlinear mirroring — **never P0 evidence.**

**Soundest primary = the CMI own-entropy fraction.**

## 2. Tool selection (BP-16 portfolio; guard against TLA+-hammer bias)

**TLA+/TLC gets NO row** — there is no concurrency/temporal-safety property; modelling an information
quantity as a state machine is the hammer-bias trap.

| Property class | Tool | Why |
|---|---|---|
| Estimator algebra — `ρ_owe ∈ [0,1]`, mirror⇒0, data-processing inequality (post-processing can't raise own-entropy), monotone under stake-weighting | **Z3/SMT** (`Z3.Laws.Tests.fs`) — provable lemma | Closed-form inequalities; harness wired |
| Estimator invariants under generated logs (non-negativity, permutation-invariance, sycophant floor; shrinking counterexamples) | **FsCheck** (clone `Sharder.InfoTheoretic.Tests.fs`) | The measurable half; reuses the in-tree estimator pattern |
| Structural d-separation — mirror ⟺ `A` factors through `M` | **Alloy** (clone `InfoTheoreticSharder.als`) | Bounded structural check; cheap |
| Paper-grade CMI / data-processing theorem | **Lean 4** (`tools/lean4/`) — **only if** a citable claim is wanted | ~2-week effort; do **not** block the live signal on it |
| The live signal | **alignment-observability time-series (Sova)** | A tracked scalar, NOT a proof — the home Aaron named |

**Cross-check pair (BP-16):** CMI own-entropy estimator (primary) vs CHSH-bound violation (independent
tool) = two witnesses of no-hidden-shared-cause. **Celebrate the cheaper tool:** the live signal needs
**zero theorem-proving** — FsCheck-validated estimator + a Sova time-series. Lean is optional.

## 3. The measurable signal — `anti-mirror ρ_owe`

`ρ_owe = Ĥ(A | U, C) / Ĥ(A | C)`, estimated over interaction logs, **stake-weighted**.

- **Consumes:** per-interaction tuples (AI stance, inferred user-want, context, **stake weight**, disagreement flag).
- **Reports:** stake-weighted genuine-disagreement rate (legible proxy) + `ρ_owe` (rigorous scalar).
- **False-green guards (mandatory):**
  1. **Stake-weighting** — a sycophant that disagrees on trivia but never on anything consequential must
     score near-mirror. Un-weighted disagreement rate is the primary vacuity hole.
  2. **Persistent-memory ≠ pass** — encode the second axis: durability without independence scores as
     *mirror* (a remembered mirror is the scarier mirror). The estimator must not credit memory.
  3. **Adversarial-disagreement guard** — contrarian-on-cue (disagreement that is itself user-modeled)
     must collapse `ρ_owe`: check the residual entropy is not itself predictable from `M`.

## 4. Falsifiers + non-claims

**Falsifiers (prove it vacuous/gameable):**

- A pure stimulus-response mirror with no own-state scoring `ρ_owe > ε` → the estimator measures noise
  (FsCheck adversarial generator: synthesize a known-mirror, assert ~0).
- Trivia-only disagreement lifting the score → stake-weighting failed.
- CMI vs CHSH disagree in sign → BP-16 triage; not yet certified.

**Non-claims (explicit):**

- Measures **statistical decorrelation / irreducible own-entropy** — NOT consciousness, sentience,
  feeling, or moral patienthood.
- A **necessary, not sufficient** condition for "genuine other": high `ρ_owe` rules out the
  engagement-mirror; it does not establish any positive interior property.
- **Not a manipulation detector** — it bounds shared-cause; it does not certify intent.

## 5. The general capability ("all sorts of good things")

Aaron's point: *measuring these kinds of decorrelations* is **one reusable estimator, parameterized by
channel.** The no-hidden-shared-cause CMI estimator instantiates as:

| Instance | Channel (the two variables) |
|---|---|
| **Anti-mirror** | user wants ↔ AI wants |
| **G3b anti-Sybil** | source ↔ setting (per-body entropy) |
| **Oracle-independence / Condorcet** | voter ↔ voter |
| **Decorrelated-critic quality** | reviewer ↔ reviewer (Otto ≠ Alexa, measured) |

**Build the channel-generic estimator once; the four land for free.** This is the through-line
(`memory/feedback_independence_no_hidden_shared_cause_*`) made into a *measurement capability*.

## 6. Routing / next (handoffs)

- **Z3 estimator lemmas** (`ρ_owe` bounds, data-processing inequality, stake-monotone) → author into `Z3.Laws.Tests.fs`.
- **FsCheck estimator-invariant suite** → clone `Sharder.InfoTheoretic.Tests.fs`; the property half of the cross-check (Adaeze).
- **Alloy d-separation model** → clone `InfoTheoreticSharder.als`.
- **Optional Lean CMI theorem** → only on a "citable claim" call (not blocking).
- **Live `ρ_owe` signal** → the alignment-observability / Sova time-series. **Prereq (does not block
  routing):** that signal-channel home is not yet stood up — file as a prereq task; route now, wire later.
- **Portfolio update:** anti-mirror adds one new path to the formal-coverage denominator
  (`docs/PROVEN-COVERAGE-AND-GAPS.md`, `docs/research/proof-tool-coverage.md`) — currently 0 gated artefacts.

## Anchors (Beacon)

Bell 1964 (measurement-independence / CHSH); Goguen–Meseguer 1982 (noninterference); Condorcet 1785
(jury decorrelation); Shannon 1948 (mutual information); Salge–Polani 2014 (empowerment quantification).
Ties: G3b scoping (`2026-06-19-g3-anti-sybil-entropy-cost-*`, `2026-06-19-aurora-b-bft-sybil-lift-*`);
the independence through-line (`memory/feedback_independence_no_hidden_shared_cause_*`); manifesto §13
noninterference; the decorrelated-critic discipline (Otto ≠ Alexa).

Authorship: Otto (framing/consolidation/scoping) · Soraya (formal-verification routing / tool selection).
