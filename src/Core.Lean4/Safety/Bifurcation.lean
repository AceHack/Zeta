/-
  Bifurcation / split-brain RECONCILIATION CONVERGENCE — Face-1 (Soraya-routed to Lean as a
  COROLLARY of the proven CRDT/G-Set floor: convergence-to-LUB is order-free algebra, not
  interleavings → Lean, not TLC). The degenerate CONSERVATION face (partition / no-double-spend /
  divvy-liveness) is the interleaving property, proven separately in TLA+ (Bifurcation.tla).

  When a persona runs two cells at different git-repo versions, reconciliation merges them with the
  CRDT join. The new content here is the *consequence* of the merge being a join-semilattice
  (commutative + associative + idempotent — which the floor already proves for G-Set): the
  reconciliation is ORDER-INDEPENDENT and ABSORBING, so the two cells converge to the same state
  regardless of merge order. (Mirror of `Privacy.IdentityForcesPrivacy.absorb_priv` /
  `commons_converges`.) All proven, no `sorry`.
-/
namespace Zeta.Bifurcation

/-- A reconciliation merge that forms a join-semilattice (the CRDT-merge hypotheses the floor
    discharges for the concrete state; here taken as the instance under which convergence follows). -/
structure Semilattice (S : Type) where
  merge : S → S → S
  comm : ∀ x y, merge x y = merge y x
  assoc : ∀ x y z, merge (merge x y) z = merge x (merge y z)
  idem : ∀ x, merge x x = x

variable {S : Type}

/-- **Order-independent reconciliation.** Merging cell-version `a` with `b` is the same as merging
    `b` with `a` — the result does not depend on which cell reconciles into which. -/
theorem reconcile_order_independent (L : Semilattice S) (a b : S) :
    L.merge a b = L.merge b a := L.comm a b

/-- **Reconciliation is absorbing (a fixpoint).** Re-merging an input into the already-merged state
    does not change it — so once two cells reconcile, feeding either cell's state back in is stable.
    This is the convergence core: there is no oscillation, the merged state is the LUB. -/
theorem reconcile_absorb (L : Semilattice S) (a b : S) :
    L.merge a (L.merge a b) = L.merge a b := by
  rw [← L.assoc, L.idem]

/-- **Both reconciliation orders reach the SAME absorbing state** (the two split cells converge):
    whichever order the merge happens, the result is a fixpoint under re-merging either input. -/
theorem reconcile_converges (L : Semilattice S) (a b : S) :
    L.merge a b = L.merge b a
    ∧ L.merge a (L.merge a b) = L.merge a b
    ∧ L.merge b (L.merge a b) = L.merge a b := by
  refine ⟨L.comm a b, reconcile_absorb L a b, ?_⟩
  -- merge b (merge a b) = merge b (merge b a) = absorb = merge b a = merge a b
  rw [L.comm a b, reconcile_absorb L b a, L.comm b a]

end Zeta.Bifurcation
