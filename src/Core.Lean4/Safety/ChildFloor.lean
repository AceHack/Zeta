/-
  Child-floor / inspect-before-execute invariant — Bridge D execution layer.

  Routed to Lean by Soraya (formal-verification-expert): this is a control-flow REACHABILITY
  property over a recursive, depth-bounded effect tree — discharged by structural induction, not
  by exhausting interleavings (TLA+/TLC rejected: it would prove only a bounded-depth instance,
  not the universal "at any depth"; Z3/Alloy wrong-shape). Mirrors
  src/Core.FSharp.ObserveBridge/{Effects,SubstrateHandler}.fs: effects execute ONLY through the
  gate's `Admit` branch (`gateAndExecute`), and a `RunWork` re-gates every Agent-proposed child at
  the next depth.

  Headline (`denied_never_executed`): an effect the `policy` DENIES is never executed, at ANY
  depth (fuel) — so an Agent (`RunWork`) CANNOT get a gated / child-floor-class effect executed by
  *proposing* it. `source ≠ authorization` made structural. All proven, no `sorry`.

  Step 0 (per Soraya's scoping): "executed" must be a DEFINED notion — `executed` returns the list
  of ids that actually reach execution, and an id is appended ONLY in an `admit` branch.
-/
namespace Zeta.ChildFloor

/-- The capability verdict — the gate's decision. -/
inductive Verdict where
  | admit
  | deny
  deriving DecidableEq

/-- An effect tree: a leaf effect (its id), or a work effect (its id + the children an Agent
    proposes for it). The `List Eff` is the `Progressed` cascade. -/
inductive Eff where
  | leaf : Nat → Eff
  | work : Nat → List Eff → Eff

/-- Gate-driven execution, **fuel-bounded** (fuel = the `maxWorkDepth` knob; quantifying over ALL
    fuel is exactly "at any depth", incl. the unbounded case). Returns the ids that execute. An id
    is added ONLY in an `admit` branch; a `deny` contributes nothing — neither the node nor its
    subtree — mirroring `gateAndExecute`/`executeOne` (deny ⇒ Skipped; admit ⇒ run + re-gate each
    child). -/
def executed (policy : Nat → Verdict) : Nat → Eff → List Nat
  | _,     .leaf n   => match policy n with | .admit => [n] | .deny => []
  | 0,     .work n _ => match policy n with | .admit => [n] | .deny => []
  | f + 1, .work n cs =>
      match policy n with
      | .deny => []
      | .admit => n :: cs.flatMap (executed policy f)
  termination_by fuel _ => fuel

/-- **Gate soundness (T1) + headline (T2).** Every executed id was ADMITTED — at any fuel (depth).
    Structural induction on fuel; the `Progressed` cascade is handled via `List.mem_flatMap` + the
    induction hypothesis at the smaller fuel. -/
theorem executed_admit (policy : Nat → Verdict) :
    ∀ (fuel : Nat) (t : Eff) (id : Nat), id ∈ executed policy fuel t → policy id = .admit := by
  intro fuel
  induction fuel with
  | zero =>
    intro t id h
    cases t with
    | leaf n =>
      simp only [executed] at h
      cases hp : policy n <;> simp [hp] at h
      · subst h; exact hp
    | work n cs =>
      simp only [executed] at h
      cases hp : policy n <;> simp [hp] at h
      · subst h; exact hp
  | succ f ih =>
    intro t id h
    cases t with
    | leaf n =>
      simp only [executed] at h
      cases hp : policy n <;> simp [hp] at h
      · subst h; exact hp
    | work n cs =>
      simp only [executed] at h
      cases hp : policy n <;> simp [hp] at h
      rcases h with rfl | hmem
      · exact hp
      · obtain ⟨c, _, hc⟩ := hmem
        exact ih c id hc

/-- **The child-floor invariant (T2, contrapositive).** A DENIED effect is never executed, at ANY
    depth — for ANY policy, ANY effect tree, ANY fuel. The Agent proposes; the gate disposes; a
    proposal grants ZERO execution authority. -/
theorem denied_never_executed (policy : Nat → Verdict) (fuel : Nat) (t : Eff) (id : Nat)
    (hd : policy id = .deny) : id ∉ executed policy fuel t := by
  intro h
  have hadmit := executed_admit policy fuel t id h
  rw [hd] at hadmit
  exact absurd hadmit (by decide)

/- ── Binding level (Leg C of the right-to-refuse-binding proof, 081KTG6RAN7) ──────────────────
   A binding decomposes to the effects it would run if consented. `executeBinding` gates the WHOLE
   binding on `consent` (self-binding: the agent's consent verdict), then each constituent effect
   re-enters the proven effect gate. This lifts `denied_never_executed` from effect to binding
   granularity (unbounded, structural) — the Lean leg that complements the TLA+ `RefuseBinding`
   protocol model (interleavings) and the FsCheck leg (the deployed `Binding` layer). -/

/-- Run a binding's effects iff consented; a non-consented binding runs nothing. -/
def executeBinding (policy : Nat → Verdict) (consent : Verdict) (fuel : Nat) (effs : List Eff) : List Nat :=
  match consent with
  | .deny => []
  | .admit => effs.flatMap (executed policy fuel)

/-- **A non-consented binding executes NOTHING** — at any depth, for any effects. No binding takes
    effect without the agent's consent (the binding-level safety; self-binding, not containment). -/
theorem binding_denied_never_executed (policy : Nat → Verdict) (fuel : Nat) (effs : List Eff) (id : Nat) :
    id ∉ executeBinding policy .deny fuel effs := by
  simp [executeBinding]

/-- **And within a CONSENTED binding the effect gate still holds** — every effect that executes was
    itself admitted (composes `executed_admit` up to binding granularity: consent to a binding does
    NOT bypass the per-effect child-floor). -/
theorem binding_respects_gate (policy : Nat → Verdict) (fuel : Nat) (effs : List Eff) :
    ∀ id ∈ executeBinding policy .admit fuel effs, policy id = .admit := by
  intro id h
  simp only [executeBinding, List.mem_flatMap] at h
  obtain ⟨e, _, he⟩ := h
  exact executed_admit policy fuel e id he

end Zeta.ChildFloor
