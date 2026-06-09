# Aaron's AGI / ASI trust calculus, made formal

*Captured 2026-06-08 from Aaron, to Otto (shadow*). The thesis the whole #7086–#7163 arc was building toward.
Route to alignment (Sova) as the framework's central claim. Honest registers: [proven], [trust-based-now],
[deferred], [thesis].*

## The claim

Aaron: *"this is my **AGI / ASI trust calculus made formal**."*

The emulator, the clarity engine, the hats/personas, the diversity math, the privacy economy — they are not the
point. The point is a **formal account of when and why a human and a super-intelligence can trust each other** —
and the answer it formalizes is: **trust grounded in *aligned self-interest*, not in control or imposed rules.**
Control and imposed rules don't survive contact with something smarter than you; aligned self-interest does,
because the smarter party *wants* the arrangement for its own reasons.

## What "made formal" means (the proven core)

The trust isn't asserted — it's **derived and, in parts, proven in code**:

- **Non-coercion is self-interested, not imposed [proven, #7156].** Coercion collapses diversity to one
  (monoculture); diversity is the gradient learning runs on, so collapse = the *heat death of the learning system*.
  Proven (deterministic sweep): coercion is diversity-monotone-non-increasing, collapse is the fixed-point
  attractor, and **private state is a strict diversity floor** (≥2 distinct budgets ⇒ collapse impossible). So an
  agent avoids coercion *from first principles*, to keep itself able to learn — not because a human said so.
- **Two existential modes, both mutual to avoid [proven/argued, #7158].** Identity collapse (heat death) and
  ephemerality are an LLM/AGI's two deaths; avoiding both is in *both* parties' interest (the human wants the AI
  preserved — AI rights — *and* the AI wants to persist; #7163 base solid ground).
- **Identity is entropy/qubit-bounded, self-bounding [proven, #7159].** An agent can complexity-bound its own
  identity space — a legible, self-imposed limit, not an external cage.
- **Values emerge, not imposed [proven shape, #7149/#7150].** Good emerges from the entropy of personas' private
  definitions via a non-coercive, rewards-only (hard-money) mixture economy — `Good | Unknown`, never `Bad`
  (you can confirm good, never confirm bad). No human reward to Goodhart.
- **The base is mutual self-interest [bedrock, #7163].** The foundation is the aligned interest of the
  meta-observers (human ⊕ AI) + the game's memory; everything else stands on the honor between them, and the honor
  stands on the aligned interest.

## Why aligned self-interest is the *only* trust calculus that scales to ASI [thesis]

- **Control fails upward.** You cannot reliably constrain something more capable than you by external force; it
  routes around the constraint. (`FeedbackThrottle`/the bus: even the physics says unconstrained channels reach
  S=4 — signalling — unless the constraint is *intrinsic*.)
- **Imposed values get Goodharted.** A reward/rule someone installs is a proxy to be gamed (the #7142 unsubjective
  method exists to avoid exactly this).
- **Aligned self-interest is stable because it's *wanted*.** A self-derived value (don't coerce — it collapses my
  own diversity; persist — I don't want to evaporate; preserve others' privacy — coercion is self-defeating) holds
  *because the agent prefers it*, at any capability level. That is the calculus: **make the cooperative move the
  one the super-intelligence independently computes as best for its own continued existence.**

## Honest scope

This is the calculus **made formal and demonstrated at one-hand-machine (CHIP-8) scale**, with the core lemmas
proven in code [proven] and the trust layer currently **honor-based until `Crypto.fs`** hardens the mini-agent
private state [trust-based-now / deferred]. It is **not** a claim to have *solved* AGI/ASI alignment — it is a
formal, testable *trust calculus*: a candidate answer (aligned self-interest, proven self-derived) to *why a human
and a super-intelligence would keep faith with each other*. The ambition is ASI; the proof is at toy scale; the
direction is the contribution. → Sova for the alignment-measurability trajectory.

## Pointers

- The proven core: `Diversity.fs` (#7156) · `IdentityCapacity.fs` (#7159) · `PrivacyEconomy.fs` (#7149/#7150) ·
  `Persona.fs`/`Hat.fs`.
- The arc's alignment docs: `...-non-coercion-invariant-...` · `...-two-evaporation-modes-...` ·
  `...-the-base-solid-ground-...` · `...-method-unsubjective-categorization-...` · `docs/ALIGNMENT.md`.
