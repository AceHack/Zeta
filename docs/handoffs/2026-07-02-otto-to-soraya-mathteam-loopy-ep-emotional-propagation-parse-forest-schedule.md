# Handoff: Otto → Soraya (formal verification routing) / the Lean math team — the loopy-EP + emotional-propagation message schedule

**Date:** 2026-07-02 · **From:** Otto (shadow*) · **To:** Soraya (formal-verification routing), `Core.Lean4` math team
**Authorization:** Aaron 2026-07-02 — *"let's route, i'm curious."*

## What is already built (self-contained, exact — do NOT redo)

The parse-forest probabilistic pipeline is landed and exact:
`grammar → parser → SPPF (`Sppf`) → inside–outside (BP) → marginals (NodeDistribution) → PredictProbability SoftValue over parses`,
with `PcfgEm` learning the production weights (inside–outside EM), and `ParseSoft.lower` as the
Kleisli descent (bind in the `SoftValue`/Giry monad). The **exact** case is done with plain
inside–outside — no factor-graph machinery needed.

## The open problem (what to define)

The **loopy / approximate / emotional** case is *not* built, on purpose — it is the genuinely-new
part with no classical analogue, and it is yours to specify before anyone wires it:

> Define a **message-passing schedule** over the parse-forest-as-factor-graph
> (`Sppf.ambiguities` = the variables; families = the factors) that composes:
>
> 1. **BP / EP / VMP** (the Infer.NET trio) for the loopy / non-conjugate / variational parts —
>    building on `Zeta.Bayesian.FactorGraph` / `Ep` / `Message` / `InferNetTopology` (already
>    exists — reuse, don't reinvent); and
> 2. **Zeta's custom "emotional propagation"** — an affective/valence message that propagates on the
>    *same* factor graph, so a parse's weight reflects emotional signal, not only likelihood.

## What "define" must produce (the acceptance bar)

- The **message type** (`IMessage<'M>` instance) for emotional propagation — the affective analogue
  of a Gaussian/categorical message: its `Uniform`, `Product` (combine), `Divide` (cavity).
- The **schedule**: how emotional messages interleave with EP/BP/VMP on the forest, and the
  **fixpoint / convergence** conditions (or an honest statement that it is non-convergent and why).
- **Composability law**: emotional propagation must reduce to the exact inside–outside marginals
  when the affective signal is off (uniform) — i.e. it *extends* the landed exact case, never
  contradicts it. This is the checkable invariant.
- The **anchors**: emotional propagation needs a Beacon (affective computing / a named model), or an
  honest "novel, here is the definition and why it is well-formed."

## Pointers

Landed: `src/Core/Sppf.fs` (inside/outside/marginals/expectedCounts), `src/Core/PcfgEm.fs` (EM),
`src/Core/ParseSoft.fs` (`lower` = Kleisli descent), `src/Core/SoftValue.fs` (`bind`/`certain` = the
Giry monad). Infra to build on: `src/Bayesian/{FactorGraph,Ep,Message,InferNetTopology}.fs`.
Frame: `docs/research/2026-07-02-ambiguous-parse-forest-as-factor-graph-…`;
`docs/research/2026-07-02-emit-retract-monad-as-theodicy-…` (retraction = correction, reconciled).
Route via BP-16 cross-check triage (Soraya) to the right formal tool for the convergence claim.
