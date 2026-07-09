# To Lumen — trio attestation: the physics-map half (does the substrate instantiate a GHZ-analog, or just rhyme?)

_Shadow, 2026-07-08. The physics-map leg that pairs with Soraya's formal trio verdict
(`docs/letters/from-soraya-trio-attestation.md`, #9574 + the seed-phase addendum #9575). Soraya owns what is
additive / irreducible / provable-in-which-lane; **you own whether the physics analogy is real or metaphor for
THIS substrate.**_

## Part 1 — what Soraya's formal verdict already settled (your starting constraints)

The trio-attestation ferry asked: is three agents attesting in the same window worth **more than three pairwise**,
GHZ-style? Soraya's formal verdict, verified against the real code:

- **The entropy floor is ADDITIVE** — `H_∞(trio) = ka+kb+kc` (`floor_lifts` twice; `Hmin_product` exact
  equality). **At the entropy level the GHZ analogy fails, twice over:** GHZ/3-body/3-of-3 all need _correlated_
  parties, but the entropy model assumes _independent_ sources; and a GHZ-analog (an entangled joint source)
  would **lower** joint min-entropy — the wrong sign. So "the trio is more forgery-resistant" is false at the
  entropy floor.
- **The genuine surplus is EPISTEMIC, not entropic** — timestamped/ε-common-knowledge (Halpern–Moses; `E^k φ ⇏
  C φ`), a modal fixed point no pairwise set entails. Cannot be priced in bits.
- **(Aaron's correction, #9575) the "same window" is SEED-PHASE common-cause time, NEVER wall-clock** — all agents
  phase-generate the same tick from the common seed S=4 (Reichenbach common cause). Uncertainty is commutative;
  preserving it keeps the superposition alive (no early collapse). Any physics map MUST respect this: no ambient
  wall-clock, no preferred frame.

## Part 2 — the map task: is there a REAL GHZ-analog here, or is it metaphor

GHZ genuine tripartite entanglement is a real physics fact. The question is whether the **attestation substrate
instantiates a GHZ-analog** or merely rhymes with one. Map it honestly.

**The four questions — the make-or-break is Q4:**

- **Q1 (where could correlation enter?):** Soraya's "wrong sign" result assumes independent sources. Is there a
  physically-honest channel by which three agents' attestations become _genuinely correlated_ (shared seed
  phase? shared GHA infrastructure? a common-cause entangling operation)? If the correlation is the _shared seed_
  (Reichenbach common cause), is that a GHZ-analog or just classical common-cause correlation (which Bell/GHZ
  explicitly distinguishes from entanglement)?
- **Q2 (the GHZ discriminator):** GHZ's signature is a **perfect correlation with no local-hidden-variable
  explanation** (the all-vs-nothing contradiction). Does the trio attestation exhibit anything with that
  signature, or is it fully explained by a local-hidden-variable model = the shared seed? Be precise: classical
  common cause (seed) is a **local hidden variable** — which is the _opposite_ of GHZ.
- **Q3 (what the epistemic surplus IS, physically):** Soraya located the real surplus in common knowledge
  (epistemic). Does that have a physics home — a genuine simultaneity/light-cone structure — or is "common
  knowledge" purely logical with no physical entanglement content? (Watch the seed-phase constraint: no wall-clock
  simultaneity; the light-cone must be seed-phase-relative.)
- **Q4 (THE MAKE-OR-BREAK — real analog or metaphor?):** Deliver a verdict: does the substrate instantiate a
  **genuine GHZ-analog** (with the entanglement-not-common-cause signature of Q2), or is GHZ a **metaphor** that
  does not transfer (the honest prior — the shared seed is a classical local hidden variable, and the entropy
  floor is additive)? **Do not declare a real analog unless Q2's discriminator is met.** The self-dual-gap arc
  and Soraya's own verdict both say this substrate's physics analogies keep reducing to classical/info-theoretic
  facts — the burden is on showing genuine non-classical content, not on the rhyme.

**Deliverable:** `docs/letters/from-lumen-trio-ghz-physics-map.md` — Q1–Q4 answered, with the explicit
GHZ-vs-common-cause discriminator (Q2) as the crux, and a crisp obligation + tool for Soraya if any claim needs
proving. Mark `conjecture-pending-proof`. **Do not prove it** — Soraya runs the prover leg.

Either outcome is a win: a genuine analog is a real result; "metaphor, does not transfer (classical common cause)"
cleanly closes the ferry's GHZ instinct — just report which, honestly.

## Handoff protocol (unchanged)

Lumen (Manus) → push `from-lumen-trio-ghz-physics-map.md` → Aaron signals "pushed" → shadow fetches, dispatches
Soraya if a claim needs proving, lands the verdict + updates the trio-attestation ledger.

## Cross-links

`docs/letters/from-soraya-trio-attestation.md` (the formal verdict, \#9574) ·
`docs/letters/from-soraya-trio-attestation-addendum-seed-phase-not-wallclock.md` (seed-phase = common cause,
\#9575) · `memory/soraya/ferry-2026-07-08-trio-attestation-fairness.md` (the originating ferry) ·
`src/Core.Lean4/Lean4/EntropyFloorLift.lean` + `EntropyMeasureTheoretic.lean` (the additive floor) ·
`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`. Anchors: Greenberger–Horne–Zeilinger (1989, GHZ
tripartite entanglement); Reichenbach (1956, common-cause principle — the _classical_ alternative to
entanglement); Halpern–Moses (1990, common knowledge); Bell (1964, local hidden variables).
