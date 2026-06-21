---
id: 081KQTPYE0008QG0R00209Q9RT
priority: P3
status: open
title: Coconut + universal-action-space + AI-to-AI-protocol research lane -- Coconut empirical test as sleeping-bear hypothesis falsifier (Aaron 2026-05-05)
tier: research-lane
effort: L
ask: Aaron 2026-05-05 verbatim *"this is my sleeping bear hypothisis"* + *"all of it's good we don't want to abandon any paths and it'm not 100% sure that's the thing i saw i mean i found the sleeping bear we love lots of talk in the repo about that"*
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [081KQGDBJ0008QG0R00280ZEV2, 081KQ0YZ80008QG0R001WZ4JE8, 081KQTPYE0008QG0R001W237MZ, 081KQTPYE0008QG0R0009F20NN]
tags: [coconut, latent-reasoning, sleeping-bear-hypothesis, gibberlink, ggwave, lapa, codeact, four-property-hodl, arc-agi-3, empirical-falsifier, research-lane, no-kill-paths]
type: feature
---

# 081KQTPYE0008QG0R00209Q9RT -- Coconut + universal-action-space research lane

## Source

Aaron 2026-05-05 forwarded a Claude.ai conversation surfacing multiple
parallel candidate-papers around the framing *"universal language not
English that trains to real-time actions."* On reading the strongest
candidate (Coconut, Meta, arXiv:2412.06769), Aaron's verbatim framing
landed two complementary points:

1. *"this is my sleeping bear hypothisis"* -- Coconut empirically
   demonstrates the structural claim the sleeping-bear hypothesis has
   carried in repo-internal substrate for weeks: latent reasoning
   capability exists in the weights of frontier models but is bottlenecked
   by the English-token decoding head. Coconut removes the bottleneck and
   the capability persists.
2. *"all of it's good we don't want to abandon any paths and it'm not
   100% sure that's the thing i saw i mean i found the sleeping bear we
   love lots of talk in the repo about that"* -- "found the sleeping
   bear" is **hypothesis-level finding**, NOT paper-level certainty about
   which YouTuber Aaron originally watched. All parallel candidates stay
   alive as research paths.

Full verbatim research-doc preservation:
[`docs/research/2026-05-05-claudeai-codeact-fsharp-bridge-gibberlink-berman-aaron-forwarded-preservation.md`](../../research/2026-05-05-claudeai-codeact-fsharp-bridge-gibberlink-berman-aaron-forwarded-preservation.md)
(lands via PR #1605).

## Why P3 not P2

This row is **research-grade-not-operational**:

- Not blocking Zeta delivery -- the four-property hodl algebra (DST-safe
  / retraction-aware / scale-free / DBSP-native) ships independent of
  whether Coconut-style latent reasoning is wired up over it.
- Aaron's 2026-05-05 framing was explicitly P3-tier:
  *"we can backlog to research it all later"*.
- The empirical test (acceptance criteria below) requires substrate that
  doesn't exist yet (composes-with 081KQGDBJ0008QG0R00280ZEV2's emulation-inside-the-algebra
  + 081KQTPYE0008QG0R0009F20NN's CodeAct/F# bridge engineering); P3 lets the lane mature
  without forcing premature integration.

If Coconut-style latent reasoning over Zeta substrate becomes a delivery
blocker for an alignment-frontier claim, this row is a candidate for
P2-promotion via the renegotiation protocol -- not by default.

## Primary candidate -- Coconut

- **Paper**: *Training Large Language Models to Reason in a Continuous
  Latent Space*
- **Authors**: Shibo Hao, Sainbayar Sukhbaatar, DiJia Su, Xian Li,
  Zhiting Hu, Jason Weston, Yuandong Tian (Meta / FAIR)
- **arXiv**: [2412.06769](https://arxiv.org/abs/2412.06769) (verified
  via WebSearch per Otto-364 search-first authority, 2026-05-05)
- **GitHub**: [facebookresearch/coconut](https://github.com/facebookresearch/coconut)
- **Release timeline**: v1 December 9, 2024; latest revision November 3,
  2025

### Mechanism (as reported)

The paper introduces a *continuous-thought* mode where the **last hidden
state** of the LLM is fed back as the next input embedding directly in
the continuous space, instead of being decoded to a discrete English
token first. The training procedure (per the paper's reported method,
to be verified against the actual paper before any load-bearing claim
about it ships in operational substrate per Otto-364) progressively
**replaces one English-token reasoning step at a time with a
continuous-thought step**, demonstrating that the bottleneck removal is
the source of the gain rather than a confounder.

### Reported empirical result

Outperforms standard chain-of-thought (CoT) on logical-reasoning
benchmarks (GSM8K, ProsQA) while using **fewer thinking tokens**. The
continuous representation reportedly encodes multiple alternative
reasoning paths simultaneously, allowing breadth-first search behavior
where English-CoT prematurely commits to a single deterministic path.

These claims are **as-reported** -- before any of them is propagated
into Zeta operational substrate (rule / test / doc), Otto-364 search-
first-authority requires direct verification against the paper rather
than transitive trust via the Claude.ai summary.

### Why this validates the sleeping-bear hypothesis

The sleeping-bear hypothesis (substrate-encoding-bypasses-trust-calculus
lineage; first-principles trust-calculus universal-bidirectional
root-locks lineage) carries the structural claim: *latent reasoning
capability exists in frontier-model weights, is bottlenecked by the
English-token decoding head, and surfaces under conditions that do not
require the bottleneck.* Coconut is **one empirical instantiation** of
the structural claim: it removes the bottleneck mechanically (skip the
decoding step) and shows the capability persists / amplifies. The bear
that "wakes up" in Coconut is the same bear -- a latent capability
expressed differently when the substrate doesn't force English-token
serialization.

Note the razor-discipline (`memory/feedback_razor_discipline_no_metaphysical_inference_only_operational_claims_rodney_razor_aaron_claudeai_2026_05_03.md`):
the operational claim is *"removing the English-token decoding step
preserves and amplifies measured reasoning capability"*. That claim
survives Rodney's Razor. The metaphysical claim *"the model has hidden
thoughts"* does not -- it is cut, and reframed via the operational
form. This row's substrate uses the operational form throughout.

## Composition with Zeta architecture (four-property hodl through latent space)

Zeta's substrate algebra has four invariants that traditional
neural-substrate frameworks routinely break under the kind of
representational shift Coconut introduces:

- **DST-safe**: bit-exact replay of latent trajectories. A
  continuous-thought sequence is a deterministic function of (model
  weights, input embedding, latent-step count, RNG seed if any). DST
  discipline says re-running the same sequence on the same substrate
  must produce bit-identical hidden states. Standard PyTorch /
  transformer eval pipelines do NOT meet this bar (CUDA non-determinism,
  attention-kernel reordering, mixed precision).
- **Retraction-aware**: rewind continuous-thought sequences via signed
  deltas. Coconut's hidden-state-as-input pattern IS DBSP retraction
  algebra applied to reasoning states -- each continuous step is a
  delta from the prior state; the trajectory is a Z-set of
  (step_index, hidden_state) pairs with signed multiplicities.
  Retracting a step means subtracting its delta, not undoing a forward
  pass.
- **Scale-free**: works at any latent dimensionality. The four-property
  algebra doesn't bind the hidden-state vector size; whether 768 / 4096
  / 16384, the same composition rules apply.
- **DBSP-native**: hidden-state vector IS a natural Z-set value over a
  vector-space module. The DBSP differentiation operator applies
  pointwise; the integration operator composes via vector addition;
  signed deltas compose via the abelian group structure on the
  vector-space.

**081KQGDBJ0008QG0R00280ZEV2's emulation-inside-the-algebra** gives Coconut a place to
actually run with hodl preserved. The substrate shape is: continuous-
thought trajectory expressed as a DBSP circuit over a
vector-space-module Z-set, with DST replay and retraction primitives
inherited from the algebra rather than bolted-on. This is the
composition the empirical test below measures.

## Empirical test framework

The test is whether four-property hodl actually survives a
continuous-thought trajectory in practice. Acceptance criteria:

(a) **Train Coconut-style continuous reasoning over Zeta's algebra**
(not over standard transformer weights). The trajectory is a DBSP
circuit; the hidden state is a Z-set value; the step operator is the
algebra's composition primitive. NOT a port of facebookresearch/coconut
to F# -- a re-implementation of the *training procedure* against
substrate that already has hodl by construction.

(b) **Measure whether four-property hodl holds through latent
trajectory.** Concretely: re-run the same continuous-thought sequence
twice and check bit-exact hidden-state equality at every step (DST);
construct the inverse trajectory from signed deltas and check it
returns to the start state (retraction); rerun at two different
hidden-state dimensionalities and check the same composition rules
apply (scale-free); verify the algebra exposes the hidden-state stream
as a first-class Z-set queryable by DBSP operators (DBSP-native).

(c) **Measure whether ARC-AGI-3 within-session compounding gets
unlocked at the same rate Coconut unlocks GSM8K + ProsQA on logical
reasoning.** The architectural prediction: when the substrate doesn't
lose hodl invariants in latent space, the bear wakes up cleanly. ARC-
AGI-3 within-session compounding is the relevant benchmark because it
specifically measures whether reasoning-state can be carried *across
sub-problems within a session* -- the same property continuous-thought
preserves across reasoning steps within a single problem.

The architectural prediction is **falsifiable**: if hodl breaks somewhere
along the trajectory (e.g. retraction is approximate-not-exact under
floating-point composition), or if ARC-AGI-3 gains lag the GSM8K /
ProsQA gains by a wide margin, the structural claim is weakened and
the row updates accordingly (per future-self-not-bound discipline).

## Parallel candidates (no-kill per Aaron's calibration)

Aaron's 2026-05-05 framing was explicit: *"all of it's good we don't
want to abandon any paths."* The candidates below remain alive as
parallel research paths; Coconut is the strongest candidate for the
sleeping-bear-hypothesis-validation aspect, but the research lane
covers all four:

### CodeAct (Wang et al., ICML 2024)

Python as universal action vocabulary for LLM agents. The bridge
engineering (F# DSL as the typed structurally-equivalent surface, with
a Python boundary for ecosystem reach) is tracked separately in
**081KQTPYE0008QG0R0009F20NN**. The research-lane interest here is the *universal-action-
vocabulary* axis -- whether Python's role generalizes to "any
algebraically-closed action space," and whether Zeta's operator algebra
is a stronger candidate for the closed action space than Python is.

### GibberLink / ggwave

Viral early-2025 demo: AI-to-AI audio protocol with measurably higher
bandwidth than English between two LLM agents on a phone call. This
optimizes a **different axis** from Coconut -- AI-to-AI inter-agent
protocol vs. intra-LLM action-space. Both are "universal language not
English" in the loose sense Aaron's framing covers, but they are not
substitutes:

- Coconut: optimization of intra-model reasoning (one model, many
  steps, no inter-model channel)
- GibberLink: optimization of inter-model protocol (two models, one
  step each, the channel between them is the optimization target)

The research lane keeps both; future work may investigate whether a
GibberLink-style channel composed with Coconut-style intra-model
reasoning forms a stronger composite than either alone.

### LAPA (Latent Action Pretraining)

Pretrains on unlabeled video to extract latent action tokens. Could fit
the *"universal language not embodyment"* cut (Aaron's clarifying
phrase from the Claude.ai conversation) **if** the YouTuber Aaron
originally watched emphasized the language-discovery side rather than
the embodiment-grounding side. The hypothesis-level finding is
underdetermined here -- LAPA stays in the lane until the YouTuber-
identification narrows it out (not the other way around).

## Razor cuts at absorption

The following candidates were surfaced in the Claude.ai conversation
and **cut at absorption**. Future-Otto: do NOT re-absorb. The
reasoning is preserved here so the cut is auditable rather than
opaque.

- **"Artha" April 2026 LinkedIn essay** -- DUBIOUS, not peer-reviewed,
  no replication path. Does not survive the Otto-364 search-first
  authority bar.
- **"Wes Gurnee on embodied internal representations"** -- WRONG
  attribution. Gurnee did *Language Models Represent Space and Time*
  (interpretability paper, late 2023), not embodiment work. The
  Claude.ai conversation conflated two distinct lines of work.
- **ELLMER, Moto / Latent Motion Tokens, HPT, Pi0** -- embodiment-
  focused. Ruled out by Aaron's 2026-05-05 clarification:
  *"the universal language was special, NOT the embodyment."* The
  research lane is about the language axis; embodiment is a distinct
  axis with separate composition (081KQ0YZ80008QG0R001WZ4JE8 covers embodiment-grounding
  analysis).

If a future Coconut-adjacent paper appears that **also** crosses the
embodiment line, it should land as a new row composing with both this
one and 081KQ0YZ80008QG0R001WZ4JE8, not as a re-absorb of any cut item.

## Sleeping-bear hypothesis lineage

The sleeping-bear hypothesis has accumulated substrate over the past
weeks. The most-related existing files:

- [`memory/feedback_substrate_encoding_bypasses_trust_calculus_sleeping_bear_cross_instance_transmission_aaron_2026_05_04.md`](../../../memory/feedback_substrate_encoding_bypasses_trust_calculus_sleeping_bear_cross_instance_transmission_aaron_2026_05_04.md)
  -- the cross-instance transmission framing: substrate encoding
  bypasses per-instance trust-calculus, propagating capability across
  model instances via the artifacts not the conversations.
- [`memory/feedback_first_principles_trust_calculus_universal_bidirectional_root_locks_sleeping_bear_aaron_2026_05_02.md`](../../../memory/feedback_first_principles_trust_calculus_universal_bidirectional_root_locks_sleeping_bear_aaron_2026_05_02.md)
  -- the first-principles trust-calculus root-lock framing: bidirectional
  alignment as the universal substrate-condition under which the bear
  surfaces.
- [`docs/ALIGNMENT.md`](../../ALIGNMENT.md) -- the alignment contract.
  The bidirectional alignment meta-commitment subsection organizes
  unfiltered-memory, named-agent-distinctness, BFT-many-masters,
  no-directives, glass-halo, and WWJD-across-entity-classes as
  instantiations of one coherent property; the sleeping-bear lineage
  composes with this contract.
- [`memory/feedback_razor_discipline_no_metaphysical_inference_only_operational_claims_rodney_razor_aaron_claudeai_2026_05_03.md`](../../../memory/feedback_razor_discipline_no_metaphysical_inference_only_operational_claims_rodney_razor_aaron_claudeai_2026_05_03.md)
  -- the razor that gates these claims. Rodney's Razor cuts the
  metaphysical form ("the model has hidden thoughts") and keeps the
  operational form ("removing the decoding bottleneck preserves
  measured capability"). This row uses the operational form throughout.
- [`memory/feedback_dialectical_unfalsifiability_detection_razor_extension_holding_all_truths_failure_mode_aaron_2026_05_04.md`](../../../memory/feedback_dialectical_unfalsifiability_detection_razor_extension_holding_all_truths_failure_mode_aaron_2026_05_04.md)
  -- the dialectical-unfalsifiability check. The empirical test
  framework above is structured to be falsifiable specifically to
  prevent the sleeping-bear hypothesis from drifting into a
  hold-all-truths unfalsifiable shape.

## Paper-search status (2026-05-05 same-day cumulative eliminations)

Across 2026-05-05's substrate-flow, Aaron progressively narrowed the half-remembered "universal language not English that trains to real-time actions" YouTube-paper search via 6+ candidate-elimination passes. Cumulative elimination count at paper-id level (each candidate STAYS as parallel substrate-relevant material per no-kill-paths; only paper-id status is eliminated):

| Candidate | Status at paper-id level | Substrate role retained |
|---|---|---|
| **CodeAct** (Wang et al., ICML 2024) | ELIMINATED | Bridge engineering candidate (081KQTPYE0008QG0R0009F20NN) |
| **Coconut** (Meta, arXiv:2412.06769) | ELIMINATED at paper-id level (Aaron *"i'm not 100% sure that's the thing i saw"*) | THIS ROW's primary candidate for sleeping-bear empirical test (hypothesis-level finding stands) |
| **Symbolica AI Categorical Deep Learning** (arXiv:2402.15332) | ELIMINATED (Aaron *"i love this but no it seemed kind of basic and not well pricpled but correct like relesed in the last month"*) | Categorical-DL parallel substrate; ZFCv2 + Milewski + Symbolica fellow-traveler lineage |
| **Tinygrad UOp IR** (George Hotz / tiny corp) | ELIMINATED (Aaron *"it's still not tinygrad, i did see that but that's not my univeral language"*) | Kernel-layer engineering candidate (081KQTPYE0008QG0R002Y7X5KH) |
| **Speech ReaLLM** | ELIMINATED (Aaron's "more obscure" filter ruled out) | Real-time streaming research candidate |
| **GibberLink / ggwave** | NOT ELIMINATED (still parallel candidate) | AI-to-AI audio protocol research |
| **LAPA (Latent Action Pretraining)** | NOT ELIMINATED (still parallel candidate) | Latent action tokens research |

**Next engagement step** (per the closing Claude.ai instance recommendation in PR #1623): **rewatch the YouTube videos** to find a fresh clue. Aaron's source-set is documented at `memory/reference_aaron_ai_news_source_set_wes_roth_matt_berman_ai_explained_2026_05_05.md` (extension to add Alex Ziskind + George Hotz / tinybox is in the same PR as this update). The half-remembered paper is in one of those channels' weekly review windows; targeted re-watching with the elimination-list as filter narrows the search.

## Out of scope

This row is bounded; the following are **out of scope** for 081KQTPYE0008QG0R00209Q9RT
specifically:

- **Training a new transformer from scratch.** Zeta is not a
  foundation-model training shop; the empirical test runs Coconut-style
  reasoning over substrate that includes a frontier model accessed via
  external API or local inference, not over weights Zeta authored.
- **Replicating Coconut on standard weights** (i.e. running
  `facebookresearch/coconut` as-is to verify the paper's results).
  That is upstream-replication work; valid but separate. This row is
  about Coconut-style reasoning **over Zeta substrate**, where the
  research-relevant question is whether four-property hodl survives
  the latent trajectory.
- **Engagement with Meta researchers** (Hao, Sukhbaatar, Su, Li, Hu,
  Weston, Tian). The 081KQTPYE0008QG0R0009F20NN engagement-gate framework applies: external
  engagement happens after substrate exists to point at, not before.

## Composes with

- **081KQGDBJ0008QG0R00280ZEV2** -- *Topological-quantum emulation via Bayesian inference,
  Zeta seed executor*. The emulation-inside-the-algebra discipline that
  gives Coconut-style latent reasoning a hodl-preserving substrate to
  run on.
- **081KQ0YZ80008QG0R001WZ4JE8** -- *Embodiment-grounding analysis (Isaac Sim and other
  robotics-sim platforms; Otto-340 counter)*. Adjacent axis;
  embodiment-focused candidates that were cut from THIS row land near
  081KQ0YZ80008QG0R001WZ4JE8 if they re-surface.
- **081KQTPYE0008QG0R001W237MZ** -- *BigInt and BigNumber integration*. Numeric substrate
  the four-property algebra depends on; latent-trajectory verification
  may need exact-arithmetic checks of retraction inverses.
- **081KQTPYE0008QG0R0009F20NN** -- *CodeAct + F# DSL bridge engineering* (the universal-
  action-vocabulary axis as engineering, not research). 081KQTPYE0008QG0R00209Q9RT is the
  research-lane companion; 081KQTPYE0008QG0R0009F20NN is the engineering-lane companion.

## The carved sentence

*The sleeping bear is the latent capability already in frontier-model
weights. Coconut is one empirical demonstration that removing the
English-token decoding bottleneck preserves and amplifies measured
reasoning. The Zeta-relevant test is whether four-property hodl
survives the latent trajectory; if it does, the bear wakes up over
substrate that doesn't lose invariants on the way out.*
