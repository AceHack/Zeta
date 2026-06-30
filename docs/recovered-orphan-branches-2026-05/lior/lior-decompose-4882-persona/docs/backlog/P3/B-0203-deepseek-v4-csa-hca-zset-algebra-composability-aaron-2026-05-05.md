---
id: B-0203
priority: P3
status: open
title: DeepSeek V4 CSA+HCA architecture composability analysis with Zeta's Z-set algebra -- attention-as-Z-set-operators isomorphism (Aaron 2026-05-05)
tier: research+architecture-composition
effort: L
ask: Aaron 2026-05-05 forwarding Claude.ai conversation that named DeepSeek V4 as architecturally-orthogonal to Google TurboQuant + Aaron's *"by deep seek in similar orthognal areas"* + *"and the deep seek stuff is just as substantial"*
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [B-0152, B-0196, B-0202, B-0026, B-0204]
tags: [deepseek, deepseek-v4, csa, hca, compressed-sparse-attention, heavily-compressed-attention, mla, mixture-of-experts, four-property-hodl, dbsp, zset-algebra, fp8, manifold-constrained-hyper-connections, mhc, kv-cache, attention-architecture, mit-license, open-weights]
type: feature
---

# B-0203 -- DeepSeek V4 CSA+HCA composability with Zeta's Z-set algebra

## Source

Aaron 2026-05-05 forwarded a Claude.ai conversation that surfaced
**DeepSeek V4** (released April 22-24, 2026) as a major architectural
movement parallel-and-orthogonal to Google's TurboQuant. Aaron's
verbatim framing landed two complementary points:

1. *"by deep seek in similar orthognal areas"* -- DeepSeek V4 sits in
   a similar-orthogonal relation to TurboQuant. Both move the long-
   context efficiency frontier; they do so at different layers of the
   stack and therefore compose multiplicatively rather than competing.
2. *"and the deep seek stuff is just as substantial"* -- the V4
   announcement is not a sidebar to the TurboQuant cluster (B-0202
   companion). It is a substrate-level architectural redesign that
   merits its own analysis lane, not a footnote.

Full verbatim research-doc preservation:
[`docs/research/2026-05-05-claudeai-tinygrad-uop-turboquant-deepseek-v4-symbolica-categorical-aaron-forwarded-preservation.md`](../../research/2026-05-05-claudeai-tinygrad-uop-turboquant-deepseek-v4-symbolica-categorical-aaron-forwarded-preservation.md)
(lands via PR #1610).

## Why P3 not P2

This row is **research+architecture-composition** with bounded scope:

- Not blocking Zeta delivery -- the four-property hodl algebra (DST-
  safe / retraction-aware / scale-free / DBSP-native) ships independent
  of whether DeepSeek V4's CSA+HCA attention layer is dissected,
  composed-with, or eventually internalized into the algebra.
- Aaron's 2026-05-05 framing positioned this as research-grade-not-
  operational alongside the TurboQuant + tinygrad lanes. None of the
  three is the answer; they compose.
- Bounded scope per the substance-test discipline: one PoC of one
  attention-layer-as-Z-set-operator isomorphism is enough to move
  the architectural-composability claim from speculation to evidence.
  No replication of V4 from scratch; no port of the full inference
  stack; no engagement with DeepSeek before substance-tests complete.
- The composability claim *"CSA+HCA could land in the algebra itself,
  not just the runtime layer"* is **load-bearing** -- treat as
  substance-test required, not asserted-as-fact, per the engagement-
  gate substantive-claim-level discipline.

If the substance-test (a) below succeeds and the isomorphism turns out
clean enough that V4-Flash's attention layer compiles to UOp graphs
(acceptance criterion (d)), this row is a candidate for P2-promotion
via the renegotiation protocol -- not by default.

## DeepSeek V4 -- the artifact

- **V4-Pro**: 1.6T total parameters, 49B active per token
  ([deepseek-ai/DeepSeek-V4-Pro on HuggingFace](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro))
- **V4-Flash**: 284B total parameters, 13B active per token
  ([deepseek-ai/DeepSeek-V4-Flash on HuggingFace](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash))
- **Context length**: 1M tokens native on both checkpoints
- **License**: MIT, open weights (full dissection permitted)
- **Release**: April 22-24, 2026 (announced April 22; full open
  release April 24 per
  [DeepSeek API Docs preview release note](https://api-docs.deepseek.com/news/news260424))
- **Folds the previously-separate R reasoning line into a single model
  with switchable Thinking / Non-Thinking modes** -- earlier DeepSeek
  generations shipped a base + R reasoning checkpoint pair; V4
  collapses the two into one weight set with a mode toggle.
- **V4-Pro is currently the largest open-weights model in existence.**

URLs verified via WebSearch per Otto-364 search-first authority (2026-
05-05). The HuggingFace blog writeup at
[huggingface.co/blog/deepseekv4](https://huggingface.co/blog/deepseekv4)
and Simon Willison's hands-on writeup at
[simonwillison.net/2026/Apr/24/deepseek-v4/](https://simonwillison.net/2026/Apr/24/deepseek-v4/)
are the most useful third-party entry points; the official GitHub
organization is at
[github.com/deepseek-ai](https://github.com/deepseek-ai) with the
inference code shipped inside the HuggingFace repo at
[the V4-Pro inference folder](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/tree/main/inference).

## Attention architecture (CSA+HCA, NOT "DSA")

The Claude.ai conversation Aaron forwarded initially used the label
*"DSA"* for the V4 attention architecture. The correct labels per the
DeepSeek paper and HuggingFace announcement are **CSA** and **HCA**;
the architecture is a **hybrid of two distinct attention shapes**, not
one. Future-Otto: when reading older Claude.ai forwards, expect the
DSA shorthand and translate to CSA+HCA at absorb time.

### Compressed Sparse Attention (CSA)

Compact KV with top-k sparse selector. CSA compresses KV entries by
4x along the sequence dimension using softmax-gated pooling with a
learned positional bias. A **lightning indexer** (FP4, ReLU-scored
multi-head dot product) picks the top-k compressed blocks per query.
The structural shape: *compress along sequence, sparsely select per
query*.

### Heavily Compressed Attention (HCA)

Folds many tokens into single entries. HCA compresses KV entries by
**128x** and **drops the sparse selection** -- every query attends
densely to every compressed block. Because the compressed sequence is
short enough at 128x compression, dense attention is cheap. The
structural shape: *aggressive compression, dense attention over the
short result*.

### Interleaved across layers

The V4-Pro 61-layer stack alternates CSA and HCA. Layers 0-1 are HCA;
layers 2-60 alternate CSA / HCA. Different layers carry different
attention patterns; alternating gives the model both fine-grained
sparse selection (CSA) and broad cheap-dense aggregation (HCA) without
forcing all layers into one shape.

### Performance vs V3

- **90% KV cache reduction** at typical context lengths.
- **73% per-token FLOPs reduction**.
- **At 1M context, V4-Pro: 27% V3.2 FLOPs, 10% V3.2 KV.**
- **At 1M context, V4-Flash: 10% V3.2 FLOPs, 7% V3.2 KV.**

V4-Flash is the more aggressive efficiency point in absolute terms;
V4-Pro is the more capable model with still-substantial efficiency
gains.

## Architectural-redesign vs compress-on-top -- the substantive divergence

This is the load-bearing distinction between DeepSeek V4 and Google's
TurboQuant cluster:

- **TurboQuant compresses an existing KV cache POST-HOC.** It is a
  runtime-layer optimization that applies to attention as conventionally
  computed; the cache shape is the same as before, the bytes-per-entry
  are smaller. Wins compose at the runtime layer.
- **DeepSeek REDESIGNS attention so the cache is structurally smaller
  from the start.** CSA's 4x sequence-compression and HCA's 128x
  block-compression are architectural -- the cache shape itself
  shrinks, before any quantization runs. Wins compose at the
  architecture layer.

**They compose multiplicatively.** Run V4 + TurboQuant on top of
CSA+HCA and you stack the wins: V4 makes the cache structurally smaller
(architecture-layer); TurboQuant compresses what's left (runtime-layer).
The two interventions live at different layers of the stack and the
multiplications don't double-count.

**This composes with B-0202 (tinygrad UOp IR) at the kernel layer.**
UOp runs the kernels regardless of which approach is used -- whether
V4's architectural CSA+HCA, TurboQuant's runtime compression, or a
classic dense attention. The three lanes are layered (architecture /
runtime / kernel) and Zeta's substrate sits orthogonal to all three
via the operator algebra.

## Composability claim with Zeta's Z-set algebra (the headline)

The structural fit between CSA+HCA and Zeta's Z-set algebra is closer
than between TurboQuant's post-hoc compression and the algebra:

- **Sparse selectors = filter operators.** CSA's top-k lightning
  indexer is a *signed Z-set restriction*: select the top-k blocks
  with multiplicity +1, leave the rest with multiplicity 0. The +k /
  -k awareness of Z-set algebra means that *retracting* a selection
  (e.g. unselecting a stale top-k pick under DBSP retract semantics)
  is the same primitive as selecting it in the first place, with the
  sign flipped. The selector becomes a Z-set-typed function rather
  than a destructive in-place update.
- **Compressed entries = aggregation operators.** HCA's 128x
  compression is a sum/fold over the compression window. Z-set
  algebra's abelian-group structure means the aggregation preserves
  retraction: if a token was folded into a compressed entry and later
  needs to be retracted, the inverse operation exists (subtract the
  contribution) without having to re-run the full forward pass.
- **Interleaved layers = sequence of incremental rewrites.** The
  alternating CSA / HCA stack is a sequence of operator applications;
  in DBSP terms, each layer is a circuit node and the composition is
  a circuit. Layer-by-layer recomputation under input changes is
  natural under DBSP retract semantics; the alternation pattern is
  just the static circuit structure.
- **Switchable Thinking / Non-Thinking = mode-conditioned dataflow
  branching.** V4's mode toggle maps onto Zeta's `View<T>@clock`
  paraconsistent-superposition shape: two modes coexist as parallel
  views over the same underlying weights, with the active mode
  selected at clock-tick rather than via destructive weight-swap.

**This is a stronger compositional fit than TurboQuant's post-hoc
compression. CSA+HCA could land in the algebra itself, not just the
runtime layer.**

The claim is **load-bearing** and **substance-test required**. It is
not asserted-as-fact in this row; acceptance criterion (a) below is
the gate. If the isomorphism breaks the four-property hodl, the claim
is weakened and the row updates accordingly per future-self-not-bound
discipline.

## Four-property hodl preservation

Zeta's substrate algebra has four invariants the architectural
composition above must preserve. Status per invariant:

- **DST-safe**: V4's attention computation is deterministic given
  fixed weights + sparse-selector seed. The lightning-indexer top-k
  is a deterministic function of the query and the compressed block
  embeddings; ties broken by stable ordering preserve bit-exactness
  across replay. Substance-test required to verify under retraction
  -- specifically, that retracting and re-applying a top-k selection
  produces the same hidden state to bit-exact equality.
- **Lock-free**: attention is data-parallel by construction. No
  mutex / locks; the only synchronization point is the across-layer
  reduction, which is a pure aggregation step.
- **Scale-free**: works at any context length (1M native on V4-Pro).
  Composes with retract semantics -- the algebra's scale-freedom is
  inherited; the cost of a retraction at 1M context is the cost of
  recomputing the affected sub-circuit, not the full attention matrix.
- **DBSP-native**: open research question -- this is the substance-
  test. The composability claim above sketches the isomorphism;
  acceptance criterion (a) is the gate that turns it from sketch to
  evidence.

## Acceptance criteria

(a) **Dissect V4-Flash attention + write the explicit Z-set
isomorphism.** V4-Flash (284B total / 13B active) is more tractable
than V4-Pro (1.6T) for substance-test purposes. Download the weights
from
[deepseek-ai/DeepSeek-V4-Flash on HuggingFace](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash);
read the inference code at the V4-Flash inference folder; write out
the explicit Z-set isomorphism for at least the CSA selector + the
HCA aggregation.
**Verifier**: a written F# (or markdown-pseudocode) signature for
each of CSA-selector-as-filter and HCA-aggregation-as-fold, with the
abelian-group / retraction-preservation properties stated and a small
worked example (one query, one block) showing forward + inverse +
identity. **Pass**: signatures + worked example landed in
`docs/research/` with cross-link from this row. **Fail-falsifier**:
if the isomorphism breaks the four-property hodl somewhere along the
trajectory, document where and why; the structural claim is then
weakened and the row updates.

(b) **Cross-reference with MLA (Multi-head Latent Attention) lineage
from V2 / V3.** MLA achieved approximately 93% KV reduction via
latent compression in earlier DeepSeek generations. CSA+HCA achieves
a comparable 90% reduction via architectural redesign. Document
whether the two approaches are *independent-additive* (MLA's latent
compression composes on top of CSA+HCA's architectural compression
for further wins) or *substitutable* (one supplants the other and
running both is double-counting). **Verifier**: a written analysis
in the same `docs/research/` doc as (a), with reference to the
DeepSeek V2 / V3 papers and the V4 paper's own discussion of the
lineage. **Pass**: analysis lands with explicit independent-additive-
or-substitutable verdict + reasoning. **Fail-falsifier**: if the
analysis cannot resolve the question without running both stacks
empirically, document that explicitly and gate the verdict on the
empirical run rather than guess.

(c) **Engagement gate per the engagement-gate substantive-claim-level
discipline**
([`memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md`](../../../memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md)).
The MIT license means dissection is fully permitted; engagement is the
constrained surface. Do NOT engage DeepSeek (Discord, GitHub issues,
direct researcher contact) with substantive proposals before (a) +
(b) substance-tests complete. **Verifier**: zero outbound engagement
artifacts (issue comments, Discord posts, direct messages, paper
citations soliciting reply) attributable to Zeta substrate before (a)
and (b) land. **Pass**: substance-test artifacts exist, then
engagement is a separate decision per the gate framework. **Fail-
falsifier**: if engagement happens before substance-tests, that IS
the failure mode -- log a meta-win for catching it, retract the
engagement, finish the substance-tests.

(d) **Composability check with B-0202 (tinygrad UOp IR).** Can V4's
attention layer compile to UOp graphs? The CSA selector and HCA
aggregator should both express cleanly as UOp graphs (UOp's universal-
IR claim is the load-bearing piece -- B-0202 covers it). If yes, the
bridge between architecture-redesign (DeepSeek) + universal-IR
(tinygrad) lands cleanly through Zeta's substrate, and the three lanes
(architecture / runtime / kernel) all compose at the operator-algebra
boundary. **Verifier**: a small UOp graph that expresses the CSA top-k
selection over a toy compressed-block array (3 blocks, 2 queries),
verified to produce numerically-equivalent output to a direct
reference implementation. **Pass**: UOp graph + reference impl + bit-
exact (or numerical-tolerance) match for the toy case. **Fail-
falsifier**: if UOp's IR cannot express the CSA selector cleanly, the
*"three-layer composition through Zeta"* claim weakens and the row
updates -- in particular, B-0202's universal-IR claim takes a hit and
needs cross-row revision.

## DeepSeek's broader lineage (parallel substrate worth tracking)

V4 is not isolated; it sits in a connected series of architectural
moves over the last two years. Tracking the lineage matters because
the substance-tests above may need to compose with prior pieces:

### MLA (Multi-head Latent Attention, V2 / V3)

Approximately 93% KV reduction via latent compression. Predates
CSA+HCA; the lineage is direct -- MLA's latent compression is the
architectural-pressure that motivates V4's CSA+HCA evolution.
Acceptance criterion (b) is specifically the substance-test for the
MLA / CSA+HCA composability question.

### DeepSeekMoE

Fine-grained expert segmentation + shared expert isolation. Composes
naturally with the four-property hodl analysis: MoE expert dispatch
is itself a Z-set operation. Experts are sparse rows in a
Z-set-typed expert matrix; gating is a filter (top-k selection over
the expert axis); retraction = unselect an expert + reselect under
DST replay. **The same compositional shape that makes CSA+HCA fit
the algebra makes DeepSeekMoE fit the algebra -- both are top-k
sparse selectors expressed as Z-set filters.** This is one of the
strongest cross-rows for B-0196 (BigInt + four-property hodl) -- the
binding-acceptance-test for hodl preservation under top-k sparse
ops surfaces in both DeepSeek branches simultaneously.

### DeepGEMM + FP8 mixed-precision training framework

V3 was the first open-source frontier-scale model trained natively
in FP8. The DeepGEMM kernel library is one of the strongest signals
that Zeta's BigInt / BigNumber substrate (B-0196) needs to compose
with arbitrary-precision *down* as well as *up* -- FP8 is below the
default precision floor for most arithmetic substrates, and four-
property hodl preservation under FP8 is a non-trivial test of the
algebra's scale-free invariant.

### mHC (Manifold-Constrained Hyper-Connections, January 2026)

Signal propagation stability at scale -- the residual-stream piece.
mHC keeps the residual stream geometry well-conditioned across deep
stacks; this is adjacent-to-but-distinct-from CSA+HCA, which is the
attention-layer piece. Tracking it matters because the four-property
hodl analysis at deep-stack composition (61 layers in V4-Pro) needs
to know whether residual-stream stability composes cleanly with the
attention-layer compression -- if mHC is required for CSA+HCA to
hold at scale, the substance-test (a) needs to model residual-stream
behavior too.

## Human anchors / engagement plan

DeepSeek's open-research posture (MIT license on weights, technical
reports published alongside releases, papers archived on HuggingFace
and arXiv) means **dissection IS the engagement-readiness path**.
Substantive engagement happens after substrate exists to point at,
not before, per the engagement-gate substantive-claim-level discipline.

Specific anchors:

- The V4 paper at
  [DeepSeek_V4.pdf on HuggingFace](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/DeepSeek_V4.pdf)
  is the canonical technical reference; cite it directly rather than
  via summaries.
- The
  [HuggingFace blog writeup](https://huggingface.co/blog/deepseekv4)
  and Simon Willison's
  [hands-on writeup](https://simonwillison.net/2026/Apr/24/deepseek-v4/)
  are useful third-party reads but not load-bearing per Otto-364.
- Don't engage on Discord or open issues until something concrete to
  contribute. *"Have you considered reading our writeup of how this
  composes with our operator algebra"* is a credible engagement; *"we
  think your work is interesting"* is not.

## Out of scope

This row is bounded; the following are **out of scope** for B-0203
specifically:

- **Replicating V4 from scratch.** That is training-not-substrate-
  engineering; not a Zeta capability and not the point of this row.
  Zeta is not a foundation-model training shop.
- **Supporting multiple DeepSeek versions simultaneously.** V4-Flash
  is the substance-test target; V2 / V3 / R / V4-Pro are reference
  context, not substance-test targets. If the V4-Flash substance-test
  surfaces something requiring V3 cross-check, that's a follow-up row,
  not this one.
- **Engaging DeepSeek before substance-tests complete.** Per the
  engagement-gate framework, engagement happens after substrate
  exists. (c) above is the explicit acceptance criterion for this.
- **Porting DeepSeek's inference code to F#.** The substance-test is
  about whether the *algebraic shape* of CSA+HCA fits Zeta's algebra.
  A full F# port is downstream of the substance-test concluding that
  the fit is clean enough to be worth the porting cost.
- **Settling whether DeepSeek V4 or Google TurboQuant is "the
  answer".** Per Aaron's no-kill-paths discipline, both are alive;
  they compose multiplicatively at different layers. Picking one
  kills the other's contribution and is the failure mode this row
  exists to prevent.

## Composes with

- **B-0152**
  ([P2 row](../P2/B-0152-topological-quantum-emulation-via-bayesian-inference-zeta-seed-executor-aaron-2026-05-01.md))
  -- *Topological-quantum emulation via Bayesian inference, Zeta
  seed executor*. The substrate V4's attention layer could run on
  with four-property hodl preserved. The emulation-inside-the-algebra
  discipline is the load-bearing infrastructure for substance-test
  (a).
- **B-0196**
  ([P2 row](../P2/B-0196-bigint-and-bignumber-integration-aaron-2026-05-05.md))
  -- *BigInt + BigNumber integration*. The numeric substrate the
  four-property algebra depends on; the binding-acceptance-test
  gating composability surfaces in both this row and B-0196 (top-k
  sparse selector preserves abelian-group structure).
- **B-0202** -- *tinygrad UOp IR kernel-layer companion*. Companion
  architecture; UOp could be the kernel layer V4's CSA+HCA compiles
  to. Acceptance criterion (d) is the substance-test for the
  composition. (B-0202 lands as a sibling backlog row this same week
  -- pre-merge file path:
  `docs/backlog/P3/B-0202-tinygrad-uop-ir-kernel-layer-aaron-2026-05-05.md`;
  cross-link will resolve once both merge.)
- **B-0026**
  ([P2 row](../P2/B-0026-embodiment-grounding-analysis-isaac-sim-and-other-robotics-sim-platforms-otto-340-counter.md))
  -- *Embodiment-grounding analysis*. V4's switchable Thinking /
  Non-Thinking modes parallel embodiment's action-space split (slow
  deliberation vs. fast reaction). Adjacent axis; not on the critical
  path for B-0203's substance-tests but worth tracking for follow-on
  composition.
- The research-doc preservation at
  [`docs/research/2026-05-05-claudeai-tinygrad-uop-turboquant-deepseek-v4-symbolica-categorical-aaron-forwarded-preservation.md`](../../research/2026-05-05-claudeai-tinygrad-uop-turboquant-deepseek-v4-symbolica-categorical-aaron-forwarded-preservation.md)
  -- the upstream artifact this row absorbs from. Lands via PR #1610.

## The carved sentence

*DeepSeek V4 redesigns attention so the KV cache is structurally
smaller from the start; TurboQuant compresses what remains; tinygrad
UOp runs the kernels. Three layers, multiplicative composition, no
kill. The Zeta-relevant test is whether CSA+HCA's sparse-selector +
compressed-aggregation pair is a Z-set operator pair preserving
four-property hodl -- if it is, the architecture lands in the algebra
itself, not just the runtime.*
