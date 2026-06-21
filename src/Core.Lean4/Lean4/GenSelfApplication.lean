/-
  GenSelfApplication.lean — the impossibility companion to GenGenFixpoint's quine.

  Soraya (formal-verification role, 2026-06-20; Otto-invoked under the four-ferry
  role split). Companion to `Lean4.GenGenFixpoint`, which closes the homoiconic
  quine `gen_self_application` CONSTRUCTIVELY on the canonical fragment.

  ## Why a bounded fragment? Because the unbounded form is impossible.

  GenGenFixpoint's original `gen_self_application` quantified over an arbitrary
  TOTAL codec `encode : IrTerm → UInt64`, `decode : UInt64 → IrTerm` with
  `decode ∘ encode = id`. This file proves that hypothesis is UNSATISFIABLE:

    * `no_total_uint64_codec` — there is no total section/retraction
      `IrTerm ↪ UInt64`. `decode ∘ encode = id` forces `encode` injective, but
      `IrTerm` is infinite (its `version : Nat` field alone injects `Nat`) and
      `UInt64` is finite (`2^64` values). An injection from an infinite type into
      a finite type cannot exist (pigeonhole / `Finite.exists_ne_map_eq_of_infinite`).

  Consequence (verification-drift finding, Statement/Precondition class): the
  original unbounded `sorry` target was VACUOUSLY true — its premise can never be
  met, so it asserted nothing about an actual quine. The honest resolution, carried
  in GenGenFixpoint, is to state the quine on the canonical fragment (the fixpoints
  of `gen`), where a genuine total codec (`payloadOf` / `canonOf`) DOES exist and
  the diagonal is exact. This file records the impossibility that forces the bound,
  and derives the original signature as the vacuous statement it always was.

  This is the formal-verification discipline made concrete: a weak model (mul /
  xorshr folds over UInt64) cannot host `gen` for arbitrarily many descriptions;
  the model's finite width is the obstruction, and naming it precisely is the catch.

  ## Anchors (Beacon)

  * Pigeonhole / cardinality: Dirichlet (1834). `Finite.exists_ne_map_eq_of_infinite`
    is its Lean/Mathlib form.
  * The quine itself: Kleene's second recursion theorem (1938); Lawvere (1969) for
    the categorical fixpoint (proved abstractly as `lawvere_fixpoint`).
-/

import Lean4.GenGenFixpoint
import Mathlib.Data.Fintype.Pigeonhole -- Finite.exists_ne_map_eq_of_infinite
import Mathlib.Data.Fintype.EquivFin   -- Infinite.of_injective
import Mathlib.Data.Finite.Defs        -- Finite.of_injective
import Mathlib.Data.UInt               -- UInt64 / BitVec bridge lemmas
import Mathlib.Logic.Function.Basic

namespace Zeta.GenSelfApplication

open Zeta.GenGenFixpoint

-- ═══ `UInt64` is finite ════════════════════════════════════════════════════════
-- It injects into `Fin (2^64)` via its underlying bit-vector. (No `Finite UInt64`
-- instance ships in Mathlib v4.30; we derive it.)

instance : Finite UInt64 :=
  Finite.of_injective (fun u : UInt64 => u.toBitVec.toFin)
    (fun _ _ h => UInt64.eq_of_toBitVec_eq (BitVec.toFin_injective h))

-- ═══ `IrTerm` is infinite ══════════════════════════════════════════════════════
-- The `version : Nat` field alone embeds `Nat`, so there are infinitely many terms.

/-- An `IrTerm` distinguished only by its `version` field. Injective in `n`. -/
def natTerm (n : Nat) : IrTerm :=
  { schema := "", generator := "", version := n, width := 0, ops := [] }

theorem natTerm_injective : Function.Injective natTerm := by
  intro a b h
  simpa [natTerm] using congrArg IrTerm.version h

instance : Infinite IrTerm := Infinite.of_injective natTerm natTerm_injective

-- ═══ The impossibility: no total codec `IrTerm ↪ UInt64` ═══════════════════════

/-- **No total UInt64 codec for IR terms.** There is no pair `encode : IrTerm →
    UInt64`, `decode : UInt64 → IrTerm` with `decode (encode t) = t` for every `t`.

    `decode ∘ encode = id` forces `encode` injective; but `IrTerm` is infinite and
    `UInt64` is finite, and no injection from an infinite type into a finite one
    exists. This is exactly why GenGenFixpoint's quine is stated on a bounded
    (canonical) fragment rather than for arbitrary terms. -/
theorem no_total_uint64_codec :
    ¬ ∃ (encode : IrTerm → UInt64) (decode : UInt64 → IrTerm),
        ∀ t, decode (encode t) = t := by
  rintro ⟨encode, decode, hcodec⟩
  have hinj : Function.Injective encode := by
    intro a b h
    have h2 : decode (encode a) = decode (encode b) := congrArg decode h
    rwa [hcodec a, hcodec b] at h2
  obtain ⟨a, b, hne, heq⟩ := Finite.exists_ne_map_eq_of_infinite encode
  exact hne (hinj heq)

/-- The original unbounded `gen_self_application` signature, proved to be VACUOUSLY
    true: its codec premise is unsatisfiable (`no_total_uint64_codec`), so the
    existential holds for the empty reason. Kept to record the drift precisely —
    the *real* (non-vacuous) quine is `GenGenFixpoint.gen_self_application`. -/
theorem gen_self_application_unbounded_vacuous
    (encode : IrTerm → UInt64) (decode : UInt64 → IrTerm)
    (hcodec : ∀ t, decode (encode t) = t) :
    ∃ selfCode : IrTerm, ∀ t, decode (eval selfCode (encode t)) = gen t :=
  absurd ⟨encode, decode, hcodec⟩ no_total_uint64_codec

-- ═══ The self-code is itself a gen-fixpoint (the quine is its own canon) ════════

/-- The constructive `selfCode` is a fixpoint of `gen`: the self-reproducing term is
    already in canonical form, so `gen selfCode = selfCode`. The quine lives exactly
    where `gen_fixpoint_iff_image` says fixpoints live — in the image of `gen`. -/
theorem selfCode_gen_fixpoint : gen selfCode = selfCode := rfl

-- ═══ Verification ═════════════════════════════════════════════════════════════
-- SORRY-FREE. `no_total_uint64_codec` (the bound-forcing impossibility),
-- `gen_self_application_unbounded_vacuous` (the original signature shown vacuous),
-- and `selfCode_gen_fixpoint` are all closed. The genuine, non-vacuous quine is
-- `GenGenFixpoint.gen_self_application`.
-- Run: lake build Lean4.GenSelfApplication
-- Expected: NO warnings, NO errors = oracle passes.

end Zeta.GenSelfApplication
