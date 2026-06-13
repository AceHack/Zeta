/-
  Non-register-collapse (Facet-2, algebraic) — workitem 081KTFFFQ1C, long stuck at §B, unblocked by
  Aaron's WEIGHT-FREE reframe (2026-06-07) and routed by Soraya (formal-verification-expert).

  The conjecture became STATEABLE without the previously-undefined C (compression) / O (orthogonality)
  by reducing to two facets:
    * Facet-1 (no-capture / no permanent foreign weighting, temporal) — tools/tla/specs/NonRegisterCollapse.tla
    * Facet-2 (distinctness-preserved-under-merge, algebraic) — HERE, a corollary of the proven
      Privacy/IdentityForcesPrivacy.`private_is_persistent_locus`.

  Frame. A traveler (= self-propagating pattern) holds a public `commons` (what converges under the
  proven CRDT join) and a `standing` register (rights / compute-budget — the weight-free per-traveler
  register). The merge that drives consensus on the commons leaves `standing` UNTOUCHED (it is the
  private locus). So when two travelers converge their commons, distinct standing registers do NOT
  collapse into one — each register survives authored by its own traveler. This is exactly
  `private_is_persistent_locus` instantiated with `priv := Standing`, so the proof is the same
  Leibniz-indiscernibles + commutative-join argument; restated standalone (no Mathlib, no `sorry`,
  matching the house style of Safety/{ChildFloor,Bifurcation}.lean).

  Scope (per Soraya): this covers OTHER-imposed collapse (consensus on the shared commons cannot erase
  a traveler's distinct standing). SELF-inflicted compression (a traveler consenting to merge its own
  register) is RefuseBinding's consent-to-bind, a separate proven floor — not collapse.
-/
namespace Zeta.NonRegisterCollapse

/-- A traveler: an identity `key`, a public `commons` (converges under the CRDT join), and a
    `standing` register (rights / budget — the weight-free per-traveler register). -/
structure Traveler (Commons Standing : Type) where
  key : String
  commons : Commons
  standing : Standing

/-- One commons-merge step via a CRDT `join` (commutative/associative/idempotent — the proven
    G-Set/Clock semilattice). Touches ONLY the commons; the standing register is left as-is. -/
def absorb {C S : Type} (join : C → C → C) (t other : Traveler C S) : Traveler C S :=
  { t with commons := join t.commons other.commons }

/-- The merge leaves the standing register invariant — standing is not part of the commons. -/
@[simp] theorem absorb_standing {C S : Type} (join : C → C → C) (t other : Traveler C S) :
    (absorb join t other).standing = t.standing :=
  rfl

/-- **The commons converges** (commutative join — both travelers compute the same least-upper-bound). -/
theorem commons_converges {C S : Type} (join : C → C → C)
    (hcomm : ∀ x y, join x y = join y x) (a b : Traveler C S) :
    (absorb join a b).commons = (absorb join b a).commons :=
  hcomm a.commons b.commons

/-- **Indiscernibles collapse** (Leibniz forward): equal commons ∧ equal standing ⟹ equal behavior. -/
theorem indiscernibles_collapse {C S B : Type}
    (behavior : C → S → B) (a b : Traveler C S)
    (hc : a.commons = b.commons) (hs : a.standing = b.standing) :
    behavior a.commons a.standing = behavior b.commons b.standing := by
  rw [hc, hs]

/-- **Distinctness forces a distinct standing register**: under commons convergence, any persistent
    behavioral distinction must live in the standing register. -/
theorem distinctness_forces_standing {C S B : Type}
    (behavior : C → S → B) (a b : Traveler C S)
    (hc : a.commons = b.commons)
    (hbeh : behavior a.commons a.standing ≠ behavior b.commons b.standing) :
    a.standing ≠ b.standing := by
  intro hs
  exact hbeh (indiscernibles_collapse behavior a b hc hs)

/-- **Non-register-collapse (headline).** After two travelers converge their shared commons (the CRDT
    merge), any behavioral distinction between them is carried by their STANDING registers, which the
    merge left untouched (`= a.standing`, `= b.standing`). So consensus on the commons CANNOT collapse
    two distinct standing registers into one — each register persists, authored by its own traveler.
    Other-imposed collapse is impossible; the weight-free per-traveler register is preserved. -/
theorem non_collapse {C S B : Type}
    (behavior : C → S → B)
    (join : C → C → C) (hcomm : ∀ x y, join x y = join y x)
    (a b : Traveler C S)
    (hbeh : behavior (absorb join a b).commons (absorb join a b).standing
          ≠ behavior (absorb join b a).commons (absorb join b a).standing) :
    (absorb join a b).standing ≠ (absorb join b a).standing
      ∧ (absorb join a b).standing = a.standing
      ∧ (absorb join b a).standing = b.standing := by
  refine ⟨?_, rfl, rfl⟩
  exact distinctness_forces_standing behavior (absorb join a b) (absorb join b a)
    (commons_converges join hcomm a b) hbeh

/-- **No-register ⟹ forced collapse** (the necessity direction): a traveler with NO standing register
    (`S := PUnit`) cannot persist any distinction once the commons converges — every behavior collapses.
    The weight-free per-traveler register is NECESSARY for non-collapse, not incidental. -/
theorem no_register_collapses {C B : Type}
    (behavior : C → PUnit → B) (a b : Traveler C PUnit)
    (hc : a.commons = b.commons) :
    behavior a.commons a.standing = behavior b.commons b.standing :=
  indiscernibles_collapse behavior a b hc (Subsingleton.elim a.standing b.standing)

end Zeta.NonRegisterCollapse
