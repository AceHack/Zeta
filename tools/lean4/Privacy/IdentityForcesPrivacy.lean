/-
  Identity forces privacy — formalization of the privacy-from-identity theorem-shape.

  (docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md §B; complements the PROVEN Identity-injectivity.)

  Claim (Aaron 2026-06-05): "privacy is derivable from having separate identities — identities FORCE
  privacy; and for LLMs you get register collapse without privacy." This file formalizes the LOGICAL
  necessity precisely, via Leibniz's identity-of-indiscernibles.

  Model. A traveler has an identity `key`, a `pub`lic state (the commons — what peers observe, and what
  CONVERGES toward consensus under the proven CRDT merge), and a `priv`ate state. A peer distinguishes
  travelers only through their *behavior*, which is a deterministic function of the state a behavior can
  read. The question: once the commons has converged (public states equal), where can a persistent
  distinction live?

  Results (all proven, no `sorry`):
  * `indiscernibles_collapse` — equal public ∧ equal private ⟹ equal behavior. The register-collapse
    mechanism: indiscernible state ⟹ indistinguishable behavior (Leibniz forward).
  * `distinctness_forces_private` — equal public ∧ DISTINCT behavior ⟹ DISTINCT private. The headline:
    under public convergence, any persistent distinction MUST live in private state. Identities force
    privacy.
  * `key_alone_insufficient` — behavior is a function of (public, private), not of the key, so two
    travelers differing ONLY in key produce identical behavior. The proven Identity-injectivity gives
    distinct KEYS (necessary for distinct identity); this shows key-distinctness is NOT SUFFICIENT for
    distinguishability once the commons converges — private state is the state-level complement.
  * `no_private_collapses` — with no private state (`priv : PUnit`), equal public ⟹ equal behavior for
    EVERY behavior: there is no escape from collapse. Privacy is necessary for any persistent distinction.

  Honest scope. This is the LOGICAL necessity (where distinction must live), not the DYNAMICS (that the
  commons actually converges — that rides the proven G-Set/Clock CRDT merge) nor the stronger claim that
  the system HALTS without privacy (the B-1019 DST experiment). Necessity is formalized here; the dynamics
  and the halting claim remain in §B / the experiment.
-/

/-- A traveler: an identity key, a public (shared/observable) state, and a private state. -/
structure Traveler (Pub Priv : Type) where
  key : String
  pub : Pub
  priv : Priv

/-- **Indiscernibles collapse.** If two travelers agree on both public and private state, every
    deterministic behavior gives the same result — they are behaviorally indistinguishable (Leibniz:
    indiscernible ⟹ identical-in-effect). This is the register-collapse mechanism. -/
theorem indiscernibles_collapse {Pub Priv B : Type}
    (behavior : Pub → Priv → B) (a b : Traveler Pub Priv)
    (hpub : a.pub = b.pub) (hpriv : a.priv = b.priv) :
    behavior a.pub a.priv = behavior b.pub b.priv := by
  rw [hpub, hpriv]

/-- **Distinctness forces privacy.** If two travelers have converged on the commons (equal public
    state) yet are behaviorally DISTINCT, then their PRIVATE states differ. Under public convergence,
    any persistent distinction must live in private state — identities force privacy. -/
theorem distinctness_forces_private {Pub Priv B : Type}
    (behavior : Pub → Priv → B) (a b : Traveler Pub Priv)
    (hpub : a.pub = b.pub)
    (hbeh : behavior a.pub a.priv ≠ behavior b.pub b.priv) :
    a.priv ≠ b.priv := by
  intro hpriv
  exact hbeh (indiscernibles_collapse behavior a b hpub hpriv)

/-- **Key-distinctness is insufficient.** Behavior is a function of (public, private), not of the key,
    so two travelers differing ONLY in their identity key produce identical behavior. The proven
    Identity-injectivity yields distinct keys — necessary for distinct identity, but (this) not
    sufficient for distinguishability once the commons converges. Privacy is the state-level complement. -/
theorem key_alone_insufficient {Pub Priv B : Type}
    (behavior : Pub → Priv → B) (k1 k2 : String) (p : Pub) (q : Priv) :
    behavior (Traveler.mk k1 p q).pub (Traveler.mk k1 p q).priv
      = behavior (Traveler.mk k2 p q).pub (Traveler.mk k2 p q).priv :=
  rfl

/-- **No private state ⟹ collapse.** If there is no private state to differ in (`priv : PUnit`, a
    one-valued type), then equal public state forces equal behavior for EVERY behavior — there is no
    locus left for distinction. Privacy is necessary for any persistent differentiation. -/
theorem no_private_collapses {Pub B : Type}
    (behavior : Pub → PUnit → B) (a b : Traveler Pub PUnit)
    (hpub : a.pub = b.pub) :
    behavior a.pub a.priv = behavior b.pub b.priv :=
  indiscernibles_collapse behavior a b hpub (Subsingleton.elim a.priv b.priv)
