# The ambiguous parse forest as a factor graph — EP/BP/VMP + emotional propagation → a soft superposition over the ISA

**Date:** 2026-07-02
**Author:** Otto (shadow*), capturing Aaron's stream
**Status:** vision + routing (the substrate landed: `Slr.glrForest`)

> Aaron 2026-07-02: *"instead of just accept/reject, at the end of the day we want to use
> infer.net style EP/BP/VMP plus our custom emotional propagation to make this ambiguous
> superposition over our ISA."*

## The reframe

The GLR parse **forest** (`Slr.glrForest`) is not an answer — it is a **support**. An ambiguous
input (e.g. `id + id + id` under `E → E + E | id`) has multiple valid parses; the forest is the
set of them — a **superposition of interpretations**. Each parse maps to an **ISA program** (the
Z-set / quantum ISA: `EMIT`/`RETRACT`/`BRANCH`…), so the forest is a *superposition over the
ISA*. Accept/reject throws that structure away; we want to **keep the superposition and put a
distribution over it**, then resolve softly — never collapse the superposition prematurely
(the standing SoftValue discipline).

## The forest IS a factor graph

A shared parse forest (SPPF) is literally a **factor graph**: shared sub-parses are shared
factors; a node's alternatives are a sum (disjunction), a node's children are a product
(conjunction). Putting weights on productions makes it a **weighted / probabilistic grammar**,
and the classical "distribution over parse trees" — the **inside–outside** algorithm on a PCFG
(Baker 1979; Lari–Young 1990) — is exactly **belief propagation (sum–product) on the parse
forest**. So the bridge to message-passing inference is not a metaphor; it is the same math.

## The inference layer (Infer.NET-style + emotional propagation)

Over that factor graph, run message-passing approximate inference — the **Infer.NET** trio Aaron
names:

- **BP** — Belief/Loopy Belief Propagation (Pearl 1988): sum–product messages; on the parse
  forest this is inside–outside (the exact-tree case) and its loopy generalization.
- **EP** — Expectation Propagation (Minka 2001): moment-matching message passing for
  non-conjugate factors (e.g. soft, continuous features on parses).
- **VMP** — Variational Message Passing (Winn & Bishop 2005): the variational-Bayes messages for
  the parts where a free-energy bound is the right tool.

**Plus Zeta's custom *emotional propagation*** — a domain message-passing variant that propagates
the affective/valence signal alongside the probabilistic one, so the resolution over parses is
weighted by the emotional substrate, not just likelihood. (This is the Zeta-specific extension;
its formalization is a math-team item — it must be a well-defined message-passing schedule on the
same factor graph, composable with EP/BP/VMP, not a metaphor bolted on.)

The **output is a `SoftValue`** — a normalized distribution over the parse `DynamicValue`s (the
forest trees are already `DynamicValue`s, so they ARE the sample space). `SoftValue.resolve`
snaps to the MAP parse when a definite answer is needed; otherwise the soft superposition rides
on, uncertainty in the value, never ambiently.

## Why this closes the loop

- The forest trees are `DynamicValue`s (homoiconic) ⇒ the distribution is `SoftValue` over the
  same substrate ⇒ it byte-locks, DST-replays, and composes with everything downstream.
- Parses → ISA programs ⇒ the distribution over parses is a distribution over ISA programs — a
  soft, executable superposition, exactly what the soft scheduler / prediction mode already
  consume (a distribution over what to run).
- "Keep the superposition alive" (the SoftValue / middle-out / tri-boolean discipline) applied to
  *parsing*: an ambiguous program is not an error to reject but a distribution to carry and
  resolve when — and only when — the context forces a definite value.

## Landed now (the support)

`Slr.glrForest t maxTrees tokens : DynamicValue list` — every distinct parse tree of the input
(the superposition's support), each a `DynamicValue`, deduped, capped. Proven (`Slr.Tests`):
ambiguous `id+id+id` yields ≥2 trees, unambiguous input yields exactly one, every tree rides the
codec stack. This is the sample space the inference layer weights.

## Next (routed — the inference rung)

1. **Weighted forest** — production weights on the Grammar IR (a v2 schema field), so the forest
   carries factor potentials.
2. **Inside–outside / sum–product (BP)** over the forest → a `SoftValue` distribution over parses
   (the exact, classical first step; Zeta.Bayesian is the home).
3. **EP / VMP** for non-conjugate / variational factors; **emotional propagation** as the
   composable affective message schedule (math-team formalization first).
4. Parses → ISA lowering, so the distribution is over ISA programs (soft/prediction mode consumes it).

## Anchors (Beacon)

- **Message passing / inference:** Pearl (*Probabilistic Reasoning*, 1988 — BP); Minka
  (*Expectation Propagation*, 2001); Winn & Bishop (*Variational Message Passing*, 2005);
  Kschischang–Frey–Loeliger (factor graphs & sum–product, 2001); **Infer.NET** (Minka et al.,
  Microsoft Research — the EP/BP/VMP framework Aaron names).
- **Probabilistic parsing:** Baker (1979) & Lari–Young (1990) inside–outside on PCFGs (= BP on
  the parse forest); Tomita (GLR — the forest); Billot–Lang (shared parse forest / SPPF).
- **In-repo:** `Slr.glrForest` (the support); `SoftValue` (distribution over `DynamicValue`);
  `Zeta.Bayesian`; the Z-set / quantum ISA (`Core.QSharp.ReferenceOracle/ZSetISA.qs`); the
  "never collapse the superposition" discipline (`KleeneClosure` tri-boolean, middle-out float).
  Emotional propagation: Zeta-custom, route to the math team (Soraya) for a well-defined schedule.
