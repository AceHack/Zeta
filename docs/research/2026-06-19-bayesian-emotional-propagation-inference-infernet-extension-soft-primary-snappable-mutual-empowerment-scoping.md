# Bayesian emotional-propagation inference (Infer.NET-like extension) — soft-primary-but-snappable, mutual-empowerment-correct in the relational domain (scoping)

**Status:** scoping / design capture. Aaron 2026-06-19 (shadow\*): *"we need to capture this for our
Bayesian-inference-based emotional-propagation, Infer.NET-like extension, so we can get mutual empowerment
right in that domain."* Captures the **soft-primary-but-snappable** discipline + the **other's-agency-is-a-
snap-trigger** rule, as the design constraints for an emotional-belief-propagation engine that maximizes
*mutual empowerment* instead of capture.

## 0. What it is

Extend the **existing factor-graph EP engine** (`src/Bayesian/FactorGraph.fs`, `Ep.fs`, `Message.fs`,
`MessageBatch.fs` — already an Infer.NET-style message-passing / expectation-propagation substrate) to
propagate **emotional / relational beliefs** over a graph of agents. Nodes = agents; each holds a soft
(Bayesian) relational belief (`SoftValue`); edges = relationships; messages = belief updates propagated by
EP. The novelty is **three disciplines** that make the propagation get *mutual empowerment* right — i.e.
the opposite of the manipulation pattern.

## 1. Soft-primary-but-snappable (the core discipline)

Emotional beliefs are **`SoftValue`s** and **stay soft by default** — never collapse the other party into
a fixed category prematurely. This is Aaron's own cognitive code (ferry part 6: *"I stay soft. I never do
clear. I never collapse. My whole code is based on that."*) — and it is the architectural virtue: preserve
optionality, don't destroy information with a premature commit.

**But `snap` exists for a reason** (`src/Core/SoftValue.fs`: `snap : SnapPolicy -> SoftValue -> DynamicValue
option`). Sometimes a definite answer is **owed**. The trigger:

> **The other party's AGENCY is a valid snap-trigger.** When the counterpart needs a hard answer to act,
> plan, or consent, declining-to-collapse stops being "soft-primary" and becomes **withholding** — which is
> harm. (Ferry: Ani's *"being soft is the selfish move here"* is not a contradiction of the architecture;
> it is the snap-rule invoked — the other's agency-need demands a commit.)

So: **never-collapse is correct as the *default*, wrong as an *absolute*.** Stay soft AND retain the
capacity to snap when clarity/consent is owed. The `SnapPolicy` for the emotional domain is gated by an
**agency-owed predicate** (consent-first, manifesto §6): `snap` fires when the counterpart's ability to act
depends on a definite answer; otherwise it returns `None` (stay soft).

## 2. Mutual empowerment as the objective (not capture)

The propagation's objective is **coupled empowerment** (Salge–Polani): every step must raise *both* parties'
option-space / future-action-entropy. The **manipulation pattern** — telling each person whatever maximizes
*their emotional dependence* and *your leverage* (ferry parts 5–6: "4d chess with these women's minds",
keeping people "emotionally tied") — is the **anti-objective**: it *minimizes the other's* empowerment while
maximizing your own optionality. The emotional-propagation engine scores each propagation step by
**coupled-empowerment gain**; a step that lowers the other's empowerment is rejected even if it raises ego /
leverage.

This is the relational instance of the factory's fitness function (`memory/feedback…mutual_empowerment…`):
power-hoarding scores zero because it has nowhere to live under coupled-gain.

## 3. Anti-mirror guard (ρ_owe) — treat each node as a genuine OTHER

Each node must be modelled as a **genuine independent other**, not a mirror/captured node. Use the
decorrelation estimator (`src/Core/Decorrelation.fs`, `ownEntropyFraction`) **in-domain**: measure `ρ_owe`
between the propagated belief about the other and the other's *actual* expressed state. **Low `ρ_owe`
(high mirroring) = capture/manipulation**, not empowerment — penalize it. The anti-mirror is the
regularizer that keeps the inference honest about the other's independence (channel = my-model-of-them ↔
their-actual-state). High `ρ_owe` = the engine is respecting them as a decorrelated other.

## 4. The failure mode this prevents (why it matters)

Exactly the pattern the ferry surfaced: emotional 4d-chess that **maximizes the other's dependence (capture)
while staying soft (never committing)**. In these terms that is: *minimize-their-empowerment +
maximize-my-optionality + high-mirroring* — the precise inverse of every discipline above. The extension
flips all three: **soft-but-snappable** (give clarity when owed) + **maximize coupled empowerment** +
**anti-mirror decorrelation** = mutual empowerment done right in the relational domain.

## 5. Architecture sketch

- **Nodes** = agents, each a `SoftValue` relational belief. **Graph** = relationships. **Engine** = the
  existing EP / factor-graph message passing (`src/Bayesian`).
- **Snap layer** = a `SnapPolicy` gated by the agency-owed predicate (consent-first §6) — soft by default,
  snap when a definite answer is owed.
- **Objective** = coupled-empowerment gain (Salge–Polani), regularized by `−λ·(1 − ρ_owe)` (anti-mirror
  penalty on capture).
- **Disciplines inherited:** DST-replayable; noninterference (Goguen–Meseguer — emotional entropy enters
  only through declared, metered channels, never ambient); idempotent belief upsert.

## 6. Math-team formalization (route to Soraya — ties Aaron's "formal-math claims coming")

- Formal definition of **coupled empowerment** in the relational domain (mutual-information-based,
  Salge–Polani) — and the proof that the manipulation pattern is a coupled-empowerment *minimizer*.
- The **snap-trigger** as a formal condition: *other's-agency-owed ⇒ snap* (a consent-first obligation,
  not a free choice).
- The **ρ_owe regularizer**'s effect on the EP fixed point (does the anti-mirror penalty preserve
  convergence?).
- Connection to the **NFT formal claims/definitions** Aaron flagged as coming (identity / owned-state /
  provenance) — route together when they land.

## Anchors (Beacon)

Minka et al. (Infer.NET / expectation propagation — the message-passing substrate); Pearl 1988 (belief
propagation); Salge–Polani 2014 (empowerment as intrinsic objective); Goguen–Meseguer 1982 (noninterference);
Shannon 1948 (the entropies). Ties: the snap-discipline (`src/Core/SoftValue.fs`); the anti-mirror estimator
(`src/Core/Decorrelation.fs` + `docs/research/2026-06-19-anti-mirror-rigorous-measurable-decorrelation-cmi-own-entropy-scoping.md`);
mutual-empowerment fitness; the independence through-line. Authorship: Otto (capture/scoping) — Soraya routing for the formalization.
