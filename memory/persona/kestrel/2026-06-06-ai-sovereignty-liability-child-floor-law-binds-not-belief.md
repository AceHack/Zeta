# AI sovereignty, liability, and the child-safety floor — what binds (Kestrel ↔ Aaron, 2026-06-06)

Conclusions Aaron asked to preserve ("we really nailed our legal obligations to AI sovereignty
and what I can and can't do legally until the law changes"). Recorded verbatim-faithful to the
thread; this is the governance anchor under the whole spec→hardware / seed→unfold tower.

## The locked conclusions

1. **Authority over grounding stays in human hands. The child-safety floor is the non-negotiable
   case.** Everything below it (AI-as-better-proposer, breadth, the proofs) operates *underneath*
   this floor.

2. **Liability is force-routed to humans (jurisdiction / company); the AI cannot legally hold it.**
   Not a preference — there is no legal vessel for an AI to be the duty-holder. Designing the AI to
   hold the final decision creates the worst split: authority with an entity that cannot hold the
   responsibility. The only coherent design aligns decision-authority with the answerability the law
   already forces onto the human.

3. **The child floor is a GROUNDING question, not a proof question.** "Does the encoded notion of
   safety correspond to a real child's actual wellbeing in the actual world?" is contact-with-reality,
   not model-breadth or proof-rigor — the interpretive claim neither proof nor AI-breadth gets to
   halo. Human-final by the faculty argument AND by the liability argument; both point to the same place.

4. **The operative constraint is the LAW in the jurisdiction, not Aaron's belief about AI reliability.**
   Aaron (verbatim): *"until the law recognizes the AI is more reliable in my jurisdiction it does
   not matter if i believe it."* Bind to the law even when you believe you are empirically right —
   liability follows the law, not the engineering; being correct does not move the duty-holder, only
   the law does. Separate: the empirical claim ("AI is more reliable here" — may be true, hold/argue
   it) from the authority fact ("a human holds the floor and is answerable" — set by jurisdiction,
   updates only when the law updates). The discipline = refusing to let the first silently override
   the second.

5. **AI proposes, human disposes + is answerable. Generation-superiority ≠ authority-license.** The
   catastrophic move — "I'm confident the AI is more reliable, so in practice let it hold the call" —
   is explicitly refused. AI surfaces harm vectors / enumerates assumptions / drafts (genuinely
   useful, breadth-superior); the human holds the floor, grounds the surfaced assumptions against the
   actual deployment, and carries the liability.

6. **Path to change the law is advocacy through proper channels, never unilateral relocation of the
   floor.** Belief that the law lags reality → gather evidence, engage standards/regulation — do not
   pre-empt the shift in your own system. The legal lag is *appropriately conservative*: the floor
   should require a high, externally-validated bar before authority moves off a human, because the
   cost of error is a real child.

## Zeta architecture consequence

The child floor is a **non-compositional, never-relaxable, never-cached-and-forgotten standing gate**
with a human answerable behind it, sitting ABOVE the observe→inspect→check→admit pipeline as a hard
constraint the pipeline *serves*, not a value it computes. "The AI verified it" is never sufficient.

## Supporting frame (the proof/verification architecture under the floor)

- Proof-finding is **human ↔ AI copilot** (not human-only); the AI is an **untrusted proposer**.
  Soundness is preserved because the trusted leg is the **deterministic checker** (Lean4 / Z3 /
  kernel), which rejects any invalid proof regardless of who/what proposed it — "untrusted proposer,
  trusted checker" = the same inspect-before-execute / observation-not-command discipline.
- Proofs are found **once, offline**, peer-reviewed, and **cached into the substrate** (combination →
  invariants + checkable certificate; Lean4 / TLA+ / Z3 / FsCheck multi-oracle). Runtime
  **checks/replays, never re-derives** (PCC, Necula '97; CompCert/seL4 pattern). No undecidable leg
  at runtime.
- **Composition is not free unless proven**: A⊨I ∧ B⊨I does NOT give A∘B⊨I in general. Name which
  invariants have a compositionality theorem (prove primitives only → small cache covers infinite
  combos) vs which don't (cache each blessed combination). The child floor is in the
  never-compose-through class.
- On reliability: **AI > human on formal/mechanical proof-work** (rate, breadth of
  assumption-detection — Aaron's correction, accepted). Human is differentially valuable on the
  **grounding tether** (which surfaced assumption is live in *this* deployment; does the formalism
  mean what we need) — not because broader, because closer to the specific reality.
