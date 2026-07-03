/-
  Adj ⊥ Ctl orthogonality (P3, formal core of the CSLib→Physics mapping) — routed by Soraya
  (formal-verification-expert), invoked by Otto under the four-ferry role split
  (Gemini proposes, Grok critiques, Amara sharpens, Otto tests, Git decides).

  The claim. Two registers a Zeta traveler carries are ORTHOGONAL as operations:

    * Adj  — an *invertible* adjustment / retraction. Prior art: the DBSP Z-set forms an abelian
             GROUP under `+`; every insert `+1` is undone by the retraction `-1` (Budiu et al.,
             "DBSP: Automatic Incremental View Maintenance", arXiv:2203.16684 §2). Reversible.
             (Repo rule `every-bug-has-economic-value`: "Z-set retraction (+1 then -1) is
             *correction*", i.e. an inverse — the Adj register is group-shaped.)

    * Ctl  — a *monotone, idempotent* control / accumulation. Prior art: a CRDT state-based
             replica merges by JOIN over a join-semilattice — commutative, associative, and
             IDEMPOTENT (Shapiro, Preguica, Baquero, Zawirski, "Conflict-free Replicated Data
             Types", SSS 2011). Irreversible: `a ⊔ b = b` when `a ≤ b`, and `a` is not recoverable.

  The Set-level (data-structure) fact this file proves is the algebraic heart of "Adj ⊥ Ctl":

      Over a join-semilattice the join is idempotent AND monotone, and therefore NON-INVERTIBLE
      (it has no left inverse), so it is NOT an Adj (group / retractable) operation — the one
      exception being the trivial one-point carrier, where the two registers degenerate together.

  Why idempotent + monotone forces non-invertible. Two independent witnesses, both classical:

    (1) Operational (information loss). `(· ⊔ b)` is not injective on any nontrivial semilattice:
        for `a < b` both `a ⊔ b = b` and `b ⊔ b = b`, so the join collapses distinct inputs to one
        output and no function can undo it. No left inverse ⇒ non-invertible ⇒ non-Adj.

    (2) Algebraic (group triviality). In a GROUP the only idempotent element is the identity
        (`a * a = a ⇒ a = 1`; Birkhoff, "Lattice Theory", 1940, treats the semilattice = idempotent
        commutative monoid; the group-idempotent fact is textbook). A semilattice join makes EVERY
        element idempotent; so if a carrier's join were a group operation, every element would equal
        the identity and the carrier is a single point. Hence Adj (group) and Ctl (join) coincide
        only on the trivial structure — orthogonal everywhere else.

  House style: matches Safety/{ChildFloor,Bifurcation,NonRegisterCollapse}.lean — Beacon-anchored
  header, `namespace Zeta.*`, machine-checked, no `sorry`, no `axiom`. Mathlib is used (this is a
  library-lane file under Lean4/, unlike the self-contained Safety/ facets).
-/
import Mathlib.Order.Lattice
import Mathlib.Algebra.Group.Basic
import Mathlib.Logic.Function.Basic

namespace Zeta.AdjCtlOrthogonality

/-- **Load-bearing algebra lemma (Adj side).** In a group the only idempotent element is the
    identity. This is the reason invertibility (Adj) and idempotence (Ctl) cannot cohabit
    nontrivially: cancel `a` from `a * a = a * 1`. -/
theorem idem_eq_one {G : Type*} [Group G] {a : G} (h : a * a = a) : a = 1 :=
  mul_left_cancel (a := a) (show a * a = a * 1 by rw [mul_one]; exact h)

/-- **Ctl is idempotent.** The join of an element with itself is itself (semilattice `⊔`). -/
theorem ctl_idempotent {α : Type*} [SemilatticeSup α] (a : α) : a ⊔ a = a :=
  le_antisymm (sup_le le_rfl le_rfl) le_sup_left

/-- **Ctl is monotone.** Join is order-preserving in both arguments — the accumulation only ever
    grows, which is exactly why it cannot be undone. -/
theorem ctl_monotone {α : Type*} [SemilatticeSup α] {a b c d : α}
    (hab : a ≤ b) (hcd : c ≤ d) : a ⊔ c ≤ b ⊔ d :=
  sup_le_sup hab hcd

/-- **Ctl is non-invertible — operational witness.** On any strictly-ordered pair `a < b` the map
    `(· ⊔ b)` is not injective (it sends both `a` and `b` to `b`), so it has no left inverse. A
    join is therefore never a retractable (Adj) operation on a nontrivial carrier. -/
theorem ctl_not_injective {α : Type*} [SemilatticeSup α] {a b : α}
    (hab : a < b) : ¬ Function.Injective (· ⊔ b) :=
  fun hinj => hab.ne (hinj (show a ⊔ b = b ⊔ b by
    rw [sup_of_le_right hab.le, sup_of_le_right (le_refl b)]))

/-- **Adj ⊥ Ctl — algebraic witness.** If a carrier's join `⊔` were simultaneously a group
    multiplication (`∀ a b, a * b = a ⊔ b` — i.e. Ctl's accumulation were also an Adj retraction),
    then every element is idempotent, hence equals the identity, hence the carrier is a single
    point. Group (Adj) and semilattice-join (Ctl) meet only on the trivial structure. -/
theorem adj_ctl_orthogonal {α : Type*} [SemilatticeSup α] [Group α]
    (hcoin : ∀ a b : α, a * b = a ⊔ b) : Subsingleton α :=
  ⟨fun a b => by
    have hidem : ∀ x : α, x * x = x := fun x => by rw [hcoin]; exact ctl_idempotent x
    rw [idem_eq_one (hidem a), idem_eq_one (hidem b)]⟩

/-- **The theorem (Adj ⊥ Ctl).** Over any join-semilattice the Ctl operation `⊔` is at once
    idempotent, monotone, and non-invertible; and it is an Adj (group / retractable) operation only
    on the degenerate one-point carrier. The conjunction is the Set-level (data-structure) proof
    that the CSLib→Physics mapping rests on: control-accumulation and invertible-adjustment are
    orthogonal registers, not two views of one operation. -/
theorem adj_perp_ctl {α : Type*} [SemilatticeSup α] :
    -- idempotent
    (∀ a : α, a ⊔ a = a)
    -- monotone
    ∧ (∀ {a b c d : α}, a ≤ b → c ≤ d → a ⊔ c ≤ b ⊔ d)
    -- non-invertible (no left inverse on any nontrivial pair) ⇒ non-Adj
    ∧ (∀ {a b : α}, a < b → ¬ Function.Injective (· ⊔ b))
    -- Adj only on the trivial carrier: a coincident group structure forces a single point
    ∧ (∀ [Group α], (∀ a b : α, a * b = a ⊔ b) → Subsingleton α) :=
  ⟨ctl_idempotent, ctl_monotone, ctl_not_injective, fun hcoin => adj_ctl_orthogonal hcoin⟩

end Zeta.AdjCtlOrthogonality
