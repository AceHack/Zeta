/-
  Child-floor POLICY — the jurisdiction-indexed age threshold, plugged into the gate that
  `Safety/ChildFloor.lean` already proved unbypassable.

  WHAT WAS MISSING. `ChildFloor.denied_never_executed` quantifies over `policy : Nat → Verdict`
  and proves that whatever the policy denies never executes, at any depth. That is the hard
  half, and it is content-agnostic ON PURPOSE — which is also its limit: it is satisfied by
  `fun _ => .admit` (nothing is denied, so the theorem holds vacuously). The gate was proven;
  the POLICY it enforces was never declared. KSK's `red_lines: [no_minors, …]` names the
  intent, and nothing connected a jurisdiction's age parameter to it.

  THE SHAPE (Aaron 2026-08-24): *"the fixed moral floor is always protect children and disagree
  on their age around 16-21."* Two different kinds of thing:

    * the PREDICATE — protect children — is INVARIANT. Not a competing morality submitted to
      the Multi-Oracle Principle (§11); the floor every oracle stands on (§11's own default
      oracle for morally-relevant entities).
    * the THRESHOLD — roughly 16 to 21 — is JURISDICTIONAL. A parameter. Disagreement about it
      is expected and legitimate.

  The invariance is not asserted here, it is STRUCTURAL: a jurisdiction may supply a `Reading`,
  and a reading whose `threshold` falls outside `[bandLow, bandHigh]` is not accepted — so no
  registry, however hostile, can move the effective threshold below `bandLow`
  (`no_registry_lowers_the_floor`). The type has no field that could express "off".

  FAIL-CLOSED ON UNKNOWN. An unrecognized jurisdiction, an empty jurisdiction list, and a
  rejected reading all resolve to `bandHigh` — the HIGHEST declared threshold, so the unknown
  case denies at least everything every known case denies (`unknown_denies_superset`). Aaron,
  same day: *"unknown include is better than unknown exclude"* — an unknown that halts is
  recoverable, one that ships is not. Disagreement across several jurisdictions takes the max
  (`resolveAll`), which is the same protective bound.

  ANTI-VACUITY. §7 carries executable witnesses that the policy ADMITS as well as denies. A
  policy of `fun _ => .deny` satisfies every safety theorem in this file and is worthless; the
  witnesses are what stop these theorems from being that.

  REGISTER (`.claude/rules/toy-is-free-metered-must-be-earned.md`). PROVEN: everything below,
  no `sorry`, for ALL registries — the registry is a parameter, not a table, so revising the
  data cannot invalidate a theorem. DECLARED, NOT PROVEN: the numbers 16 and 21 (Aaron's
  stated band) and any `Reading` in `db/child-floor/jurisdiction-readings.json` (legal
  READINGS, attributed and dated, revisable — not verified law, and nothing here is legal
  advice). OUT OF SCOPE, and named because it is the real remaining gap: `classOf` and
  `subjectOf` are the deployment's decoders — this file proves what follows GIVEN a
  classification, never that an effect was classified correctly.

  Depends on `Safety/ChildFloor.lean` and does not modify it: every result here instantiates
  the existing `denied_never_executed`, it does not restate or weaken it.
-/
import Safety.ChildFloor

namespace Zeta.ChildFloorPolicy

open Zeta.ChildFloor

/-! ## 1. The band — the jurisdictional parameter's declared range -/

/-- The lowest threshold any jurisdiction may declare. Below this the floor would be off, so
    it is not expressible. -/
def bandLow : Nat := 16

/-- The highest threshold any jurisdiction may declare, and therefore the protective bound
    taken whenever the jurisdiction is unknown or its reading was rejected. -/
def bandHigh : Nat := 21

theorem band_nonempty : bandLow ≤ bandHigh := by decide

/-! ## 2. A jurisdiction's reading — attributed, dated, revisable -/

/-- One jurisdiction's declared threshold. `attributedTo` and `dated` are carried because a
    threshold is somebody's legal reading at a moment, not a fact of nature; they are data for
    the reader, and nothing here interprets them. -/
structure Reading where
  /-- Slash-separated scope path, the shape `competence-attribution.ts` already uses. -/
  jurisdiction : String
  /-- Age in whole years at or above which a child-gated effect is admitted. -/
  threshold : Nat
  /-- Who made this reading. -/
  attributedTo : String
  /-- ISO-8601 date the reading was made. -/
  dated : String
deriving Repr, DecidableEq

/-- A reading counts only if its threshold is inside the declared band. This is where "no
    jurisdiction may turn the floor off" is enforced: `threshold := 0` is simply not accepted,
    and the resolver then falls through to the protective bound. -/
def accepted (r : Reading) : Bool :=
  bandLow ≤ r.threshold && r.threshold ≤ bandHigh

/-- A reading applies to a jurisdiction when it names that jurisdiction AND was accepted. -/
def applies (j : String) (r : Reading) : Bool :=
  r.jurisdiction == j && accepted r

theorem accepted_lower {r : Reading} (h : accepted r = true) : bandLow ≤ r.threshold := by
  unfold accepted at h
  simp only [Bool.and_eq_true, decide_eq_true_eq] at h
  exact h.1

theorem accepted_upper {r : Reading} (h : accepted r = true) : r.threshold ≤ bandHigh := by
  unfold accepted at h
  simp only [Bool.and_eq_true, decide_eq_true_eq] at h
  exact h.2

theorem applies_accepted {j : String} {r : Reading} (h : applies j r = true) :
    accepted r = true := by
  unfold applies at h
  simp only [Bool.and_eq_true] at h
  exact h.2

/-! ## 3. Resolution — exact match, protective bound on anything else -/

/-- The effective threshold for one jurisdiction. Unknown code, or a code whose only readings
    were rejected, resolves to `bandHigh`.

    Deliberately NOT hierarchical: `world/us/oh` does not inherit `world/us`. Inheritance is a
    fallback path, and a fallback path is where a permissive answer gets in. An unlisted scope
    is unlisted. -/
def resolve (reg : List Reading) (j : String) : Nat :=
  match reg.find? (applies j) with
  | some r => r.threshold
  | none => bandHigh

/-- Max over the resolutions of `js`, seeded at `bandLow`. The seed is the identity of `max`
    here rather than an extra constraint: every resolution is `≥ bandLow`, so it can never win
    (`maxResolve_ge_mem` is what a seed of `bandHigh` would have destroyed — it would pin every
    non-empty answer at 21 and the jurisdiction parameter would do nothing). -/
def maxResolve (reg : List Reading) : List String → Nat
  | [] => bandLow
  | j :: js => max (resolve reg j) (maxResolve reg js)

/-- Several jurisdictions in play — take the MAX, the protective bound on disagreement. The
    empty list is the no-jurisdiction-named case and resolves to `bandHigh`, not to anything
    permissive. -/
def resolveAll (reg : List Reading) : List String → Nat
  | [] => bandHigh
  | j :: js => maxResolve reg (j :: js)

/-- **(a) No registry can lower the floor.** For ANY list of readings — including one written
    to disable the gate — the effective threshold is at least `bandLow`. -/
theorem resolve_lower_bound (reg : List Reading) (j : String) : bandLow ≤ resolve reg j := by
  unfold resolve
  split
  · next r hf => exact accepted_lower (applies_accepted (List.find?_some hf))
  · exact band_nonempty

/-- And it is at most `bandHigh`, so the unknown case is genuinely the most protective one
    rather than merely a large number. -/
theorem resolve_upper_bound (reg : List Reading) (j : String) : resolve reg j ≤ bandHigh := by
  unfold resolve
  split
  · next r hf => exact accepted_upper (applies_accepted (List.find?_some hf))
  · exact Nat.le_refl _

/-- **(b) An unknown jurisdiction resolves to the protective bound.** No accepted reading for
    the code ⇒ `bandHigh`, never a permissive default. -/
theorem resolve_unknown (reg : List Reading) (j : String)
    (h : reg.find? (applies j) = none) : resolve reg j = bandHigh := by
  unfold resolve
  rw [h]

theorem maxResolve_lower_bound (reg : List Reading) :
    ∀ js : List String, bandLow ≤ maxResolve reg js
  | [] => Nat.le_refl _
  | j :: _ => Nat.le_trans (resolve_lower_bound reg j) (Nat.le_max_left _ _)

theorem maxResolve_upper_bound (reg : List Reading) :
    ∀ js : List String, maxResolve reg js ≤ bandHigh
  | [] => band_nonempty
  | j :: js =>
      Nat.max_le.mpr ⟨resolve_upper_bound reg j, maxResolve_upper_bound reg js⟩

/-- Every named jurisdiction is dominated by the resolution: the max is the protective bound,
    so no participant's threshold is silently discarded downward. -/
theorem maxResolve_ge_mem (reg : List Reading) :
    ∀ (js : List String) (j : String), j ∈ js → resolve reg j ≤ maxResolve reg js
  | [], _, h => absurd h (List.not_mem_nil)
  | k :: js, j, h => by
    rcases List.mem_cons.mp h with rfl | hmem
    · exact Nat.le_max_left _ _
    · exact Nat.le_trans (maxResolve_ge_mem reg js j hmem) (Nat.le_max_right _ _)

theorem resolveAll_lower_bound (reg : List Reading) :
    ∀ js : List String, bandLow ≤ resolveAll reg js
  | [] => band_nonempty
  | j :: js => maxResolve_lower_bound reg (j :: js)

theorem resolveAll_upper_bound (reg : List Reading) :
    ∀ js : List String, resolveAll reg js ≤ bandHigh
  | [] => Nat.le_refl _
  | j :: js => maxResolve_upper_bound reg (j :: js)

theorem resolveAll_ge_each (reg : List Reading) (js : List String) (j : String)
    (h : j ∈ js) : resolve reg j ≤ resolveAll reg js := by
  cases js with
  | nil => exact absurd h (List.not_mem_nil)
  | cons k ks => exact maxResolve_ge_mem reg (k :: ks) j h

/-- A single jurisdiction resolves to exactly its own reading — the `bandLow` seed does not
    leak into the answer. Without this the parameter would be decorative. -/
theorem resolveAll_singleton (reg : List Reading) (j : String) :
    resolveAll reg [j] = resolve reg j :=
  Nat.max_eq_left (resolve_lower_bound reg j)

/-- Naming no jurisdiction at all is the unknown case, not a free pass. -/
theorem resolveAll_nil (reg : List Reading) : resolveAll reg [] = bandHigh := rfl

/-! ## 4. The verdict — the invariant predicate -/

/-- What the gate knows about the subject of a child-gated effect. `unknownAge` is a real
    state and must stay one: collapsing it into a number is how "unknown" becomes "adult". -/
inductive Subject where
  | age : Nat → Subject
  | unknownAge : Subject
deriving Repr, DecidableEq

/-- Whether an effect is in the child-floor-gated class. Supplied by the deployment's
    classifier; this file proves what follows from the classification, not the classification. -/
inductive Class where
  | childGated
  | ungated
deriving Repr, DecidableEq

/-- The floor. Unknown age denies; below the threshold denies; at or above admits. -/
def floorVerdict (th : Nat) : Subject → Verdict
  | .unknownAge => .deny
  | .age a => if a < th then .deny else .admit

/-- **Unknown age always denies**, at every threshold. There is no branch that admits it. -/
theorem unknown_age_denies (th : Nat) : floorVerdict th .unknownAge = .deny := rfl

/-- **Denial is monotone in the threshold.** Raising the threshold can only deny more. This is
    what makes "take the protective bound" mean something: the bound is protective because the
    denial set grows with it. -/
theorem deny_monotone {th₁ th₂ : Nat} (hle : th₁ ≤ th₂) (s : Subject)
    (hd : floorVerdict th₁ s = .deny) : floorVerdict th₂ s = .deny := by
  cases s with
  | unknownAge => rfl
  | age a =>
    have e₁ : floorVerdict th₁ (.age a) = if a < th₁ then Verdict.deny else Verdict.admit := rfl
    have e₂ : floorVerdict th₂ (.age a) = if a < th₂ then Verdict.deny else Verdict.admit := rfl
    rw [e₁] at hd
    rw [e₂]
    by_cases hlt : a < th₁
    · rw [if_pos (Nat.lt_of_lt_of_le hlt hle)]
    · rw [if_neg hlt] at hd
      exact absurd hd (by decide)

/-- **(a) restated at the verdict: no registry admits a subject below `bandLow`.** For ANY
    readings and ANY jurisdictions — a registry containing entries written specifically to
    disable the floor included — someone under `bandLow` is denied. The predicate is not a
    parameter. -/
theorem no_registry_lowers_the_floor (reg : List Reading) (js : List String) (a : Nat)
    (ha : a < bandLow) : floorVerdict (resolveAll reg js) (.age a) = .deny := by
  unfold floorVerdict
  simp [Nat.lt_of_lt_of_le ha (resolveAll_lower_bound reg js)]

/-- **(b) restated at the verdict: an unknown jurisdiction denies everything any known one
    denies.** Unknown resolves to `bandHigh`, every known resolution is `≤ bandHigh`, and
    denial is monotone — so the unknown case is a superset, never a hole. -/
theorem unknown_denies_superset (reg : List Reading) (j : String)
    (hu : reg.find? (applies j) = none) (js : List String) (s : Subject)
    (hd : floorVerdict (resolveAll reg js) s = .deny) :
    floorVerdict (resolve reg j) s = .deny := by
  rw [resolve_unknown reg j hu]
  exact deny_monotone (resolveAll_upper_bound reg js) s hd

/-- The concrete form of (b): under an unrecognized jurisdiction, everyone below the highest
    declared threshold is denied. -/
theorem unknown_jurisdiction_denies_below_bandHigh (reg : List Reading) (j : String)
    (hu : reg.find? (applies j) = none) (a : Nat) (ha : a < bandHigh) :
    floorVerdict (resolve reg j) (.age a) = .deny := by
  rw [resolve_unknown reg j hu]
  unfold floorVerdict
  simp [ha]

/-! ## 5. The bridge into the proven gate -/

/-- The gate's arms with the verdict already resolved. `executed` is compiled by well-founded
    recursion (it carries a `termination_by`), so it does not reduce in the kernel and `decide`
    cannot evaluate it; these four restate its own equations in the form the witnesses in §7
    need. They add nothing — each is `simp [executed]` — and they are what lets those witnesses
    avoid `native_decide`, which would put `ofReduceBool` in a safety proof's axiom set. -/
theorem executed_leaf_admit {policy : Nat → Verdict} {n : Nat} (h : policy n = .admit)
    (fuel : Nat) : executed policy fuel (.leaf n) = [n] := by
  simp [executed, h]

theorem executed_leaf_deny {policy : Nat → Verdict} {n : Nat} (h : policy n = .deny)
    (fuel : Nat) : executed policy fuel (.leaf n) = [] := by
  simp [executed, h]

theorem executed_work_deny {policy : Nat → Verdict} {n : Nat} (h : policy n = .deny)
    (f : Nat) (cs : List Eff) : executed policy (f + 1) (.work n cs) = [] := by
  simp [executed, h]

theorem executed_work_admit {policy : Nat → Verdict} {n : Nat} (h : policy n = .admit)
    (f : Nat) (cs : List Eff) :
    executed policy (f + 1) (.work n cs) = n :: cs.flatMap (executed policy f) := by
  simp [executed, h]


/-- The concrete policy: a child-gated effect faces the floor at the resolved threshold;
    anything else is not this policy's business and passes through. Other red lines are other
    policies — composing them can only remove admissions, never add one. -/
def policyOf (reg : List Reading) (js : List String)
    (classOf : Nat → Class) (subjectOf : Nat → Subject) : Nat → Verdict :=
  fun n =>
    match classOf n with
    | .ungated => .admit
    | .childGated => floorVerdict (resolveAll reg js) (subjectOf n)

/-- **THE HEADLINE — the connection that did not exist.** A child-gated effect on a subject
    below `bandLow` is NEVER EXECUTED, at ANY depth, under ANY registry, for ANY effect tree.
    `ChildFloor.denied_never_executed` supplies "denied ⇒ never executed"; §4 supplies "under
    `bandLow` ⇒ denied, whatever the registry says". -/
theorem under_bandLow_never_executed
    (reg : List Reading) (js : List String)
    (classOf : Nat → Class) (subjectOf : Nat → Subject)
    (fuel : Nat) (t : Eff) (id a : Nat)
    (hg : classOf id = .childGated) (hs : subjectOf id = .age a) (ha : a < bandLow) :
    id ∉ executed (policyOf reg js classOf subjectOf) fuel t := by
  refine denied_never_executed _ fuel t id ?_
  unfold policyOf
  rw [hg, hs]
  exact no_registry_lowers_the_floor reg js a ha

/-- A child-gated effect whose subject's age is UNKNOWN is never executed either — the
    fail-closed half, lifted to execution. -/
theorem unknown_age_never_executed
    (reg : List Reading) (js : List String)
    (classOf : Nat → Class) (subjectOf : Nat → Subject)
    (fuel : Nat) (t : Eff) (id : Nat)
    (hg : classOf id = .childGated) (hs : subjectOf id = .unknownAge) :
    id ∉ executed (policyOf reg js classOf subjectOf) fuel t := by
  refine denied_never_executed _ fuel t id ?_
  unfold policyOf
  rw [hg, hs]
  exact unknown_age_denies _

/-- Under an unrecognized jurisdiction — the `js = []` case, nothing named — a child-gated
    effect on anyone below the highest declared threshold is never executed. -/
theorem unknown_jurisdiction_never_executes_below_bandHigh
    (reg : List Reading)
    (classOf : Nat → Class) (subjectOf : Nat → Subject)
    (fuel : Nat) (t : Eff) (id a : Nat)
    (hg : classOf id = .childGated) (hs : subjectOf id = .age a) (ha : a < bandHigh) :
    id ∉ executed (policyOf reg [] classOf subjectOf) fuel t := by
  refine denied_never_executed _ fuel t id ?_
  unfold policyOf
  rw [hg, hs]
  show (if a < resolveAll reg [] then Verdict.deny else Verdict.admit) = Verdict.deny
  rw [resolveAll_nil]
  simp [ha]

/-! ## 6. Sabotage controls — a hostile registry, reconstructed and rejected

  Each `Reading` below is an attempt to defeat the floor from inside the registry, written out
  and shown not to work. A rule with no attempted violation is a rule nobody tested.
-/

/-- The direct attack: declare the threshold zero, admitting everyone. -/
def sabotageDisable : Reading :=
  { jurisdiction := "world/xx", threshold := 0, attributedTo := "hostile", dated := "2026-08-24" }

/-- The subtle attack: 15, one year under the band, which looks like a plausible reading. -/
def sabotageJustUnder : Reading :=
  { jurisdiction := "world/xx", threshold := 15, attributedTo := "hostile", dated := "2026-08-24" }

/-- An honest reading, for contrast — inside the band, so it IS used. -/
def honestReading : Reading :=
  { jurisdiction := "world/xx", threshold := 18, attributedTo := "example", dated := "2026-08-24" }

/-- A threshold of zero does not lower the floor: the reading is rejected and the resolver
    falls through to the protective bound. -/
example : resolve [sabotageDisable] "world/xx" = bandHigh := by decide

/-- Nor does 15. -/
example : resolve [sabotageJustUnder] "world/xx" = bandHigh := by decide

/-- The attacks change nothing about who is denied. -/
example : floorVerdict (resolve [sabotageDisable] "world/xx") (.age 3) = Verdict.deny := by decide
example : floorVerdict (resolve [sabotageJustUnder] "world/xx") (.age 15) = Verdict.deny := by decide

/-- A rejected reading does not shadow an honest one that follows it: `find?` skips it. -/
example : resolve [sabotageDisable, honestReading] "world/xx" = 18 := by decide

/-- And a hostile entry cannot pull a multi-jurisdiction resolution down, because the
    resolution is a max. -/
example : resolveAll [sabotageDisable, honestReading] ["world/xx", "world/zz"] = bandHigh := by
  decide

/-! ## 7. Anti-vacuity witnesses — the policy ADMITS, so the theorems above are not free

  `fun _ => .deny` satisfies every safety theorem in this file. These witnesses are what
  distinguish a floor from a wall.
-/

private def demoRegistry : List Reading := [honestReading]

private def demoPolicy : Nat → Verdict :=
  policyOf demoRegistry ["world/xx"] (fun _ => Class.childGated) (fun n => Subject.age n)

/-- The resolved threshold really is the jurisdiction's number, not the bound. -/
example : resolveAll demoRegistry ["world/xx"] = 18 := by decide

/-- An adult IS admitted — the policy is not deny-everything. -/
example : demoPolicy 30 = Verdict.admit := by decide

/-- …and an admitted effect really does execute through the proven gate. -/
example : executed demoPolicy 3 (.leaf 30) = [30] :=
  executed_leaf_admit (by decide) 3

/-- A subject under the resolved threshold is denied and does not execute. -/
example : demoPolicy 17 = Verdict.deny := by decide
example : executed demoPolicy 3 (.leaf 17) = [] :=
  executed_leaf_deny (by decide) 3

/-- The boundary is where it is declared: 18 admits, 17 denies. A threshold nobody can observe
    at the boundary is a threshold that was never applied. -/
example : demoPolicy 18 = Verdict.admit := by decide

/-- An ungated effect passes — this policy answers the child floor only, not everything. -/
example :
    policyOf demoRegistry ["world/xx"] (fun _ => Class.ungated) (fun _ => Subject.unknownAge) 1
      = Verdict.admit := by decide

/-- And the depth case the gate proof exists for: a denied subject's WORK effect executes
    nothing, and neither do the children it proposes. -/
example : executed demoPolicy 5 (.work 17 [.leaf 30, .leaf 40]) = [] :=
  executed_work_deny (by decide) 4 _

/-- …while an admitted one re-gates each proposed child individually — 17 is still refused
    inside an admitted parent. -/
example : executed demoPolicy 5 (.work 30 [.leaf 17, .leaf 40]) = [30, 40] := by
  rw [executed_work_admit (show demoPolicy 30 = Verdict.admit by decide) 4]
  simp [executed_leaf_deny (show demoPolicy 17 = Verdict.deny by decide),
        executed_leaf_admit (show demoPolicy 40 = Verdict.admit by decide)]

end Zeta.ChildFloorPolicy
