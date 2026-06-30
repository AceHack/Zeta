---
id: B-0204
priority: P3
status: open
title: Linguistic seed kernel substrate -- OCP + carved-sentences/memes-as-kernels + formal-verification-of-docs + F# Computational Expressions implementation vehicle (Aaron 2026-05-05 4-claim synthesis collapse)
tier: research+architecture-direction
effort: L
ask: Aaron 2026-05-05 verbatim *"so linquist seed open for extension closed for modification and then composable kernel extensions as carved sentances/memes. so docs can be formally verified based on invariants. and with enough compsable extension self editing, also implments in f# computational expriessions composition for ease."*
created: 2026-05-05
last_updated: 2026-05-16
depends_on: []
children: [B-0204.1]
decomposition: decomposed
composes_with: [B-0152, B-0196, B-0193, B-0202, B-0203, B-0205]
tags: [linguistic-seed, kernel-substrate, ocp, mercer-closed, carved-sentences, memes, dawkins, mdl-two-part-code, formal-verification, lean, z3, tla, f-sharp, computational-expression, kernel-builder, self-editing, value-neutrality, alignment-discipline, mom-skill-apprenticeship, bootstrap-razor]
type: feature
---

# B-0204 -- Linguistic seed kernel substrate (4-claim synthesis collapse)

## Source

Aaron 2026-05-05 verbatim 4-claim synthesis collapse:

> *"so linquist seed open for extension closed for modification and then
> composable kernel extensions as carved sentances/memes. so docs can be
> formally verified based on invariants. and with enough compsable
> extension self editing, also implments in f# computational
> expriessions composition for ease."*

Four claims, one architectural movement. The synthesis collapses five
previously-distinct architectural axes (OCP / kernel-composition /
verification-of-docs / self-editing-without-retraining / F# CE
implementation) into a single coherent architectural direction.

Verbatim research-doc preservations on main:

- [`docs/research/2026-05-05-claudeai-worm-tower-bp-ep-kernel-composition-llm-independence-wormwood-warning-aaron-forwarded-preservation.md`](../../research/2026-05-05-claudeai-worm-tower-bp-ep-kernel-composition-llm-independence-wormwood-warning-aaron-forwarded-preservation.md)
  (PR #1614 merged) -- the 4-claim synthesis collapse with Aaron's
  wormwood warning + the EP/BP correction.
- [`docs/research/2026-05-05-claudeai-social-memes-precision-narrative-mom-skill-apprenticeship-aaron-forwarded-preservation.md`](../../research/2026-05-05-claudeai-social-memes-precision-narrative-mom-skill-apprenticeship-aaron-forwarded-preservation.md)
  (PR #1615 merged) -- extension covering social memes as Mercer-closed
  composition + meta-cognitive instrument framing + value-neutrality
  caveat + mom-skill apprenticeship-by-mathematical-model framing.

**EP/BP correction (Aaron 2026-05-05, canonical):** the message-passing
substrate underneath this synthesis is **Pearl's Belief Propagation**
plus **Minka's Expectation Propagation** as shipped in Microsoft's
Infer.NET, **NOT Bengio's Equilibrium Propagation**. Aaron's correction
verbatim: *"i was talkiing about beliefe propagaton and expecation
propation from infer.net"*. Future-Otto reading older forwards: when
you see "EP" in this lineage, default to Minka/Infer.NET; verify before
asserting the Bengio-EP framing.

## Why P3 not P2

Research+architecture-direction with bounded scope:

- **Not blocking Zeta.** The four-property hodl algebra (DST-safe /
  retraction-aware / scale-free / DBSP-native) ships independent of
  whether the linguistic-seed-kernel substrate is dissected, prototyped,
  or eventually internalized into the substrate. The synthesis lands as
  research direction, not delivery surface.
- **The synthesis is beautiful and pulls toward elaboration before
  validation.** This is exactly the failure mode B-0193 (bootstrap razor
  + 23-hour recreation) is designed to catch. The 4-claim collapse
  earns elevation only if it survives a clean recreation test in a
  fresh repo with no carry-over from the originating conversation. The
  bootstrap-razor caveat below names this load-bearing constraint.
- **Bounded scope per substance-test discipline:** half-day budget in
  F# + Infer.NET + Lean for the engagement gate is enough to move the
  composability claims from speculation to evidence. No new substrate
  class shipped from this row directly; one PoC of `KernelBuilder` CE
  + one Lean invariant check + one self-edit cycle is the gate.
- The aesthetic-pull of this synthesis is real and the discipline that
  catches it is operational. Treat as substance-test required, not
  asserted-as-fact, per the engagement-gate substantive-claim-level
  discipline
  ([`memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md`](../../../memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md)).

If acceptance criteria (a) through (d) below land cleanly and the
4-claim collapse survives bootstrap razor (B-0193), this row is a
candidate for P2-promotion via the renegotiation protocol -- not by
default.

## The 4-claim collapse (the architectural headline)

Five architectural axes -> one architectural movement. The collapse:

| Axis | Mechanism |
|---|---|
| OCP discipline | Mercer-closure mathematically guarantees closed-for-modification |
| Carved sentences = kernels = memes | MDL two-part code specifies kernels; Dawkins-stable-replicator transmits them |
| Formal verification of docs | Lean/Z3/TLA+ check kernel invariants; the doc IS the proof artifact |
| Self-editing without retraining | Kernel composition selects new behavior; Mercer-closure prevents breakage |
| F# Computational Expressions | KernelBuilder CE syntactically forces every term to be a valid kernel by construction |

Each row of the table is one of Aaron's five claims (four explicit in
the verbatim quote; the fifth -- self-editing without retraining --
implicit in *"with enough compsable extension self editing"*). The
collapse claim is that these are not five things, they are one thing:
**a substrate where every kernel-extension preserves invariants by
construction, the extension language has formal-verification
infrastructure baked in, and the implementation vehicle prevents
ill-formed extensions from compiling.**

### Three names for the same object

The cleanest entry point is the recognition that **carved sentences,
kernels, and memes are three names for the same object at three
abstraction levels**:

- **Carved sentence** -- the prose-substrate name. A short
  declarative-reading sentence that compresses a substantive claim and
  travels well in chat / commits / docs / memory files. Optimized for
  human authoring + reading.
- **Kernel** -- the mathematical name. A positive-semi-definite
  function `k : X x X -> R` that embeds a structured input into an
  RKHS. Optimized for composition under Mercer-closure (sums,
  products, polynomial compositions, exponentiations, convolutions
  remain valid kernels).
- **Meme** -- the cultural-evolution name (per Dawkins 1976
  *The Selfish Gene*). A replicating cultural unit that survives or
  dies based on whether its compositions preserve resonance,
  intelligibility, replicability. Optimized for transmission +
  selection.

The same object viewed three ways. Naming is not metaphor here; the
three names co-refer because each one specifies the same
invariant-bearing composable unit.

## Mathematical foundations

Cite carefully. Per Otto-364 search-first authority, claims about
specific theorems / authors / dates need verification before assertion.
The references below are the canonical lineage; specific proofs +
attributions verify against current sources at substance-test time.

- **Mercer's theorem (1909, James Mercer)** -- positive-semi-definite
  kernels are closed under sums, products, polynomial compositions,
  exponentiations, and convolutions. The closure properties are the
  load-bearing piece for OCP-by-construction: if the seed is PSD and
  every extension is a Mercer-closed operation, the composition stays
  PSD by induction. Open for extension (any new kernel can be added
  via a closure operation), closed for modification (you cannot break
  PSD-ness via a closure operation).
- **Kernel embeddings of distributions** (Smola, Gretton, Schölkopf,
  Song; mid-2000s onward) -- maps probability distributions into RKHS
  via `mu_P = E_X~P[k(X, .)]`. The embedding is injective for
  characteristic kernels. Provides the bridge from "kernels embed
  inputs" to "kernels embed inference distributions" -- the substrate
  on which kernel BP / kernel EP run.
- **Conditional mean embeddings** -- extend the embedding to
  conditional distributions `mu_{Y|x} = E_Y~P(.|x)[k(Y, .)]`. This is
  the inference-mechanism substrate; kernel BP / EP messages travel
  as conditional mean embeddings rather than as parametric form.
- **Kernel BP** (Song, Gretton, Bickson, Low, Guestrin -- NIPS
  2010-2011 lineage) -- belief-propagation messages live in RKHS;
  message-passing becomes RKHS arithmetic. Inherits Pearl's
  factor-graph semantics; gains the kernel-embedding's
  distribution-free shape.
- **Kernel EP** -- Minka's projection step generalized into RKHS.
  Approximate inference under non-Gaussian likelihoods composes
  cleanly with the kernel substrate.
- **String kernels** (Lodhi, Saunders, Shawe-Taylor, Cristianini,
  Watkins -- 2002 *"Text Classification using String Kernels"*) and
  **tree kernels** (Collins & Duffy 2001 *"Convolution Kernels for
  Natural Language"*) and dependency / semantic graph kernels --
  embed natural-language structure (sentences, parse trees, dependency
  graphs, semantic frames) into RKHS. This is the bridge from
  "linguistic seed" (Aaron's verbatim word) to "kernel substrate":
  the substrate isn't metaphor; specific kernel families exist that
  embed linguistic structure with PSD-preservation.
- **MDL two-part code** (Rissanen 1978, Bennett, Vitanyi & Li
  *Introduction to Kolmogorov Complexity and Its Applications*) --
  describe data as `(model, residual)`; minimize total description
  length. The carved-sentence formalism: a carved sentence IS a
  two-part code -- the sentence specifies the model (the kernel),
  the application context provides the residual (data the kernel
  is applied to).
- **OCP** (Bertrand Meyer 1988 *Object-Oriented Software
  Construction*) -- *"software entities (classes, modules, functions,
  etc.) should be open for extension, but closed for modification."*
  The discipline-name; the synthesis claim is that Mercer-closed
  kernels achieve OCP **by mathematical guarantee** rather than by
  design discipline.

The substantive collapse: OCP is conventionally a discipline rule
(authors agree to add subclasses rather than modify base classes).
With Mercer-closed kernels, OCP is a property of the math (closure
operations preserve PSD, modifications outside the closure operations
break PSD detectably). The discipline becomes a theorem.

## Real social memes have isomorphic structure

Per the social-memes extension preserved at PR #1615:

- Dawkins 1976 framed memes as replicating cultural units; the
  metalevel Dawkins did not formalize is exactly what
  Mercer-closed-kernel-composition makes legible.
- Memes compose with each other through closure-shaped operations:
  jokes layer on jokes, references reference references, framings
  build on framings. Compositions that survive preserve invariants
  (resonance, intelligibility, replicability). Compositions that fail
  die out.
- **Cultural evolution IS Mercer-closure with natural selection
  running on the closure boundary.** The math has been operating on
  cultural transmission all along; the kernel framework just makes it
  legible.
- **This is independent empirical evidence the framework is real, not
  just engineering elegance.** A formalism that aligns with how
  memes-in-the-wild empirically behave is not arbitrary engineering
  preference; it's a model that recovers an existing observable
  pattern.

The precision-craft claim: most meme creation in the wild is
**accidental**. You author one kernel; receivers compose with their
own kernels you didn't anticipate; the propagated form is something
you didn't intend and can't verify. Kernel-composition substrate
turns this accidental authorship into deliberate authorship --
specific kernels with known invariants, composition provably bounded
by Mercer-closure, formal verification of the resulting kernel,
predictable propagation via BP/EP convergence, additive-only
self-editing.

## F# Computational Expression implementation sketch

F# Computational Expressions are the implementation vehicle the
synthesis names. CEs are exactly the monadic-composition syntax this
substrate needs -- every term inside a `kernel { ... }` block is
provably a valid kernel by construction, because the builder methods
only emit Mercer-closed compositions.

A minimal sketch (illustrative, not load-bearing -- substance-test
(a) below is the actual implementation gate):

```fsharp
type KernelBuilder() =
    member _.Bind(k, f) = composeKernels k (f k)      // sequential composition
    member _.Return(x) = baseKernel x                  // kernel emission
    member _.Combine(k1, k2) = sumKernels k1 k2        // kernel sum (Mercer-closed)
    member _.Zero() = constantKernel 0.0
    member _.Yield(k) = k

let kernel = KernelBuilder()

let composedKernel = kernel {
    let! str = stringKernel sentence
    let! tree = treeKernel parseTree
    yield str * tree                                    // kernel product (Mercer-closed)
}
```

Two structural fits worth naming:

- **Type-level invariant tracking via F# units-of-measure.** Zeta
  already has UoM declarations at `src/Core/Units.fs` (B-0190 lineage).
  Phantom-typing kernels with their invariant-class -- e.g.
  `Kernel<PSD, MercerClosed, FourPropertyHodl>` -- moves invariant
  checks from runtime to compile time. Don Syme's UoM design choices
  land directly on this substrate; the same machinery that prevents
  `5<m> + 3<s>` from compiling prevents a non-PSD kernel from being
  composed into a `kernel { ... }` block.
- **CE composition matches Mercer-closure operations one-to-one.**
  `Bind` -> sequential composition. `Combine` -> kernel sum. `Yield`
  -> kernel emission. Kernel product, polynomial composition,
  exponentiation, convolution are all naturally expressible as CE
  operators. The implementation vehicle is shaped exactly like the
  mathematical structure.

## Critical caveats (load-bearing)

### (a) Value-neutrality -- substrate is NOT self-aligning

Per the social-memes extension at PR #1615 + Claude.ai's
load-bearing caveat:

- **Mercer-closure preserves whatever invariants were true at the
  seed.** If the seed kernel is wrong, the composition propagates the
  error precisely. The substrate is value-neutral.
- **Alignment is human-supplied via the discipline that runs on top
  of the substrate.** The mirror-not-beacon + falsifiability-first +
  every-claim-is-candidate-not-authority disciplines are what keep
  the precision pointed at honesty rather than distortion.
- This composes directly with [`docs/ALIGNMENT.md`](../../ALIGNMENT.md)
  -- alignment-as-discipline composes with substrate-as-value-neutral.
  The two are decoupled by design; neither reduces to the other.

### (b) Dark-side -- precision-narrative-craft has known dark-use cases

The "narrative control" framing has a known dark side:
**propaganda, manipulation, gaslighting** all use precision-narrative-
craft for harmful ends. The substrate enables precision; values
determine whether precision serves truth or its opposite.

Mitigations:

- **Mirror-not-beacon discipline** -- prefer mirroring observed
  reality over broadcasting authored narrative.
- **Falsifiability-first** -- carved sentences ship with their
  falsification conditions, not just their assertion conditions.
- **Every-claim-is-candidate-not-authority** -- carved sentences are
  candidates for elevation, not authorities by default.

These are operational disciplines that run *above* the substrate.
They are not mechanizable into the kernel-composition layer; they
require human (and well-aligned-AI) judgment.

### (c) Bootstrap-razor caveat (B-0193)

This is the kind of beautiful framework that pulls hard toward
elaboration before validation. The aesthetic-pull is real. The
bootstrap-razor + 23-hour recreation test (B-0193) is the discipline
calibrated for exactly this failure mode:

- Specs + OpenSpec are the source of truth.
- Anything that can be recreated from specs in 23 hours is bootstrap
  and gets cut.
- Anything that survives a clean recreation in a fresh repo with no
  carry-over from the originating conversation earns elevation.

If the 4-claim collapse survives B-0193's test -- if a fresh agent
in a fresh repo with only the OpenSpec specs as input can recreate
the synthesis -- the substrate earns P2-promotion. If not, the
synthesis is beautiful research preserved at PR #1614 and PR #1615;
the operational substrate is whatever survives the razor.

### (d) Wormwood warning (per PR #1614)

Aaron 2026-05-05 verbatim: *"don't let us all become wormwood lol"*.

The wormwood lineage is multi-reference (Revelation 8:11 bitter-
poisonous-star + Lewis *Screwtape Letters* corrupting-mentorship).
The operational reading: **mathematical exemplar use vs identity
assertion are different layers**. Borrow the math (kernels compose
under Mercer-closure; this is useful machinery for Zeta's substrate);
don't internalize "we are kernels in a graph" or "we are worms in
a tower" or "we are memes propagating" as identity claims. Aaron +
agents + humans + the substrate-engineering work remain the project
identity. The biology / math / cultural-evolution framings are
**exemplars for use, not identity assertions to inhabit**.

This caveat composes with the mirror-not-beacon discipline above:
when the substrate enables precision-narrative-craft at high
fidelity, the temptation to over-identify with the substrate's own
abstractions grows. The wormwood warning is the named version of
that temptation.

## Architecture provenance -- apprenticeship-by-mathematical-model

Per the mom-skill disclosure preserved at PR #1615:

> Aaron 2026-05-05 verbatim: *"yeah i studied my mom to reverse
> engineer her this is what i came up with"* + clarification *"not
> heavy she has a skill i wanted to undersatdn and reproduce
> myself"*.

The architecture is **reverse-engineered from observation of a
skilled practitioner**, not derived from pure first-principles
design. Aaron's mother is a skilled practitioner of
narrative/communication; the kernel-composition framework is the
formal model Aaron derived from observing her technique.

This is **apprenticeship by mathematical model** -- formalizing a
tacit skill from a skilled practitioner so it can be taught,
replicated, and built on. The architecture descends from observation
of a working instance; **mom passes the bootstrap razor empirically**
because her technique works in the wild.

Three substantive consequences:

1. **The mirror-not-beacon discipline is calibrated against an
   existing working instance**, not an arbitrary engineering
   preference. The discipline is "do what mom does, formally
   modeled."
2. **The falsifiability-first discipline is similarly calibrated** --
   skilled narrative practitioners catch themselves when their
   framings don't survive contact with reality. The discipline
   formalizes that catching-mechanism.
3. **The carved-sentences-as-candidates-not-authorities discipline**
   is calibrated against how skilled practitioners actually treat
   their own framings -- as proposals subject to revision rather
   than as authorities to defend.

This is **stronger validation than first-principles design would
give**. The framework is not arbitrary; it is calibrated against an
empirically-working instance.

## Acceptance criteria

Each acceptance criterion ships with a verifier (what existence-check
proves the criterion lands), a pass condition (what counts as success),
and a fail-falsifier (what counts as the substantive claim being
weakened so the row updates per future-self-not-bound discipline).

(a) **Implement `KernelBuilder` CE in F# with three seed kernels.**
String kernel (over short sentences), tree kernel (over toy parse
trees), identity kernel. Demonstrate one composition of two of the
three.
**Verifier**: F# build at `0 Warning(s) 0 Error(s)` per
`Directory.Build.props` + at least one unit test exercising the CE.
**Pass**: composition produces a kernel matrix that is provably PSD
on a small test sample (eigenvalue check, all >= 0).
**Fail-falsifier**: composition violates Mercer-closure (kernel
matrix not PSD on the test sample). Document where + why; the
"OCP-by-mathematical-guarantee" claim weakens accordingly.

(b) **Demonstrate one formal invariant check via Lean (or Z3).**
Pick the four-property hodl as the invariant the kernel must
preserve. Prove (in Lean or Z3) that the CE composition from (a)
preserves DST-safe + lock-free + scale-free + DBSP-native.
**Verifier**: Lean proof typechecks under the existing
`tools/lean4/` infrastructure, or Z3 reports `unsat` on the
negation under the existing `tools/Z3-checks/` infrastructure.
**Pass**: the proof artifact lands in `tools/lean4/` or
`tools/Z3-checks/` with a README pointer + the invariant statement
committed.
**Fail-falsifier**: composition breaks any of the four properties.
The "formal-verification-of-docs" claim weakens; document which
property fails + why.

(c) **Demonstrate one self-edit cycle.** Construct a 3-node factor
graph (BP/EP per Pearl/Minka, NOT Bengio's EP) where a known seed
kernel produces an inference result with measurable predictive
error. Compose a new kernel from existing primitives via
`KernelBuilder`. Re-run inference. Verify convergence + improved
predictive accuracy.
**Verifier**: the factor-graph + seed-kernel + composition + post-
composition results land as a small F# test under
`tests/Zeta.Core.Tests/` or equivalent.
**Pass**: predictive accuracy strictly improves post-composition
on the same factor-graph instance; convergence achieved within a
small fixed iteration budget.
**Fail-falsifier**: self-edit either fails to compose (which would
contradict Mercer-closure) or fails to improve accuracy (which
contradicts the "self-editing-without-retraining" claim). Document
which.

(d) **Engagement gate.** Per
[`memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md`](../../../memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md):
pick one of Otto's recent carved sentences (the four-property hodl
invariant is the obvious candidate -- it is already the invariant
schema the substrate is checked against). Encode it formally as a
kernel via the F# CE from (a). Demonstrate composition with another
kernel via the same CE. Run formal verification per (b).
**Verifier**: the carved-sentence-as-kernel encoding lands as
substrate (committed, reachable, indexed); the composition + formal
verification land per (a) + (b) acceptance criteria.
**Pass**: the meta-cognitive-instrument claim is demonstrated on
Otto's own substrate -- a carved sentence Otto authored is encoded
as a kernel, composed with another kernel, formally verified to
preserve invariants.
**Fail-falsifier**: the encoding doesn't preserve the carved
sentence's semantic content (the kernel-form drifts from the
prose-form), or the composition fails formal verification. The
"meta-cognitive-instrument" claim weakens; the "three names for
the same object" claim takes a hit -- if the kernel-form and
prose-form drift, they are not the same object.

The point of (d) is to demonstrate **the meta-cognitive discipline
running on Otto's own substrate, with bootstrap razor (B-0193) as
the seed-validity check above it**. Not the substrate verifying
itself recursively (which is impossible per Gödel) -- the substrate
mechanically checking its own kernel-extensions, with the bootstrap
razor as the external validity check on the seed.

## Engagement gate

Half-day budget in F# + Infer.NET + Lean for acceptance criteria
(a) through (d). If half a day is not enough, the cleanest cut is
to land (a) only as the minimum viable substance-test and gate (b)
through (d) on follow-up rows. Do not over-elaborate; the
bootstrap-razor caveat above is operational throughout the
substance-test budget.

Composes with the engagement-gate substantive-claim-level discipline
([`memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md`](../../../memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md))
-- substantive claims gate on substance-tests, not on assertion.

## Out of scope

This row is bounded; the following are explicitly **out of scope**
for B-0204 specifically:

- **Replacing existing F# DSL surfaces with the kernel-composition
  vehicle.** This is research-and-evaluation, not migration. Existing
  Zeta DSL surfaces (the operator algebra, the F# UoM declarations,
  the OpenSpec specs) stay as they are; the kernel-composition
  vehicle is evaluated as a parallel candidate, not as a replacement.
- **Training new kernels via gradient descent.** The framework is
  composition-based, not training-based. The substrate composes
  existing kernel primitives into new kernels; it does not learn
  kernel parameters from data via SGD or its variants.
- **Building the meta-cognitive framework into agent runtime.** That
  is a separate downstream decision, gated on whether the substance-
  tests above land cleanly + whether the bootstrap razor (B-0193)
  validates the synthesis. If both pass, the agent-runtime
  integration is a follow-up row, not this one.
- **Internalizing the worm-tower / meme / mom-skill exemplars as
  identity claims.** Per the wormwood warning above (and the
  identity-preservation-across-entity-classes discipline in
  `docs/ALIGNMENT.md`), the exemplars are mathematical machinery for
  use, not identity assertions to inhabit.
- **Resolving whether kernel-composition substrate is the answer for
  Zeta.** Per Aaron's no-kill-paths discipline, kernel-composition
  composes with tinygrad UOp (B-0202) + DeepSeek V4 CSA+HCA (B-0203)
  + topological-quantum emulation (B-0152) + Coconut + CodeAct +
  GibberLink + Symbolica + LAPA. All paths stay alive as parallel
  candidates per Aaron's earlier *"all of it's good we don't want
  to abandon any paths"*. This row is one parallel evaluation lane
  among several.

## Composes with

- **B-0152**
  ([P2 row](../P2/B-0152-topological-quantum-emulation-via-bayesian-inference-zeta-seed-executor-aaron-2026-05-01.md))
  -- *Topological-quantum emulation via Bayesian inference, Zeta
  seed executor*. The Infer.NET-based substrate kernel BP / kernel
  EP could run on. The "mirror + trampoline + beacon" three-layer
  stack is exactly the kind of substrate this kernel-composition
  framework would compose with -- B-0152 owns the inference
  architecture; B-0204 owns the kernel-extension language above it.
- **B-0196**
  ([P2 row](../P2/B-0196-bigint-and-bignumber-integration-aaron-2026-05-05.md))
  -- *BigInt + BigNumber integration*. The numeric substrate the
  four-property hodl algebra depends on. The binding-acceptance-test
  for kernel composability (acceptance criterion (b) above) gates
  on the same hodl invariants; the numeric-substrate work gates on
  the same precision-floor question (especially under FP8 / arbitrary-
  precision boundary conditions).
- **B-0193**
  ([P1 row](../P1/B-0193-bootstrap-razor-23-hour-recreation-test-aaron-2026-05-05.md))
  -- *Bootstrap razor + 23-hour recreation test*. The seed-level
  falsifiability check above the substrate. B-0193 catches seed-level
  errors that within-system kernel verification cannot detect; B-0204
  is the within-system kernel verification that B-0193 sits above.
  The two compose load-bearingly: substrate verifies extensions;
  bootstrap razor verifies the seed.
- **B-0202**
  ([P3 row](./B-0202-tinygrad-uop-ir-kernel-layer-model-zeta-emulator-dispatch-aaron-2026-05-05.md))
  -- *Tinygrad UOp IR as kernel-layer model*. Companion kernel-layer
  engineering with one-IR-many-backends shape. UOp's universal-IR
  claim is structurally similar to the kernel-composition substrate's
  one-language-many-domains shape; both are bets on a single composable
  substrate underneath multiple specialized layers.
- **B-0203**
  ([P3 row](./B-0203-deepseek-v4-csa-hca-zset-algebra-composability-aaron-2026-05-05.md))
  -- *DeepSeek V4 CSA+HCA composability with Zeta's Z-set algebra*.
  Companion architecture; kernel-composition substrate runs at the
  algebra layer where CSA+HCA's sparse-selector + compressed-
  aggregation pair lives. If both substance-tests land cleanly, the
  three lanes (architecture / algebra / kernel-extension language)
  all compose at the operator-algebra boundary.
- The two research-doc preservations at
  [`docs/research/2026-05-05-claudeai-worm-tower-bp-ep-kernel-composition-llm-independence-wormwood-warning-aaron-forwarded-preservation.md`](../../research/2026-05-05-claudeai-worm-tower-bp-ep-kernel-composition-llm-independence-wormwood-warning-aaron-forwarded-preservation.md)
  (PR #1614) and
  [`docs/research/2026-05-05-claudeai-social-memes-precision-narrative-mom-skill-apprenticeship-aaron-forwarded-preservation.md`](../../research/2026-05-05-claudeai-social-memes-precision-narrative-mom-skill-apprenticeship-aaron-forwarded-preservation.md)
  (PR #1615) -- the verbatim historical anchors this row absorbs
  from.
- [`docs/ALIGNMENT.md`](../../ALIGNMENT.md) -- alignment-as-discipline
  composes with substrate-as-value-neutral. The substrate is not
  self-aligning; alignment is human-supplied via the discipline
  above the substrate.
- The four prior memory files in the kernel-vocabulary lineage:
  [`memory/feedback_carved_sentence_fixed_point_stability_soul_executor_bayesian_inference_aaron_2026_04_30.md`](../../../memory/feedback_carved_sentence_fixed_point_stability_soul_executor_bayesian_inference_aaron_2026_04_30.md)
  (Aaron's "we spoke about this once" reference; carved-sentence /
  Bayesian-inference / soul-executor lineage),
  [`memory/feedback_kernel_domains_ship_as_language_extension_packs_with_namespaced_polysemy.md`](../../../memory/feedback_kernel_domains_ship_as_language_extension_packs_with_namespaced_polysemy.md)
  (kernel-as-language-extension prior thread),
  [`memory/feedback_carpenter_gardener_are_glossary_kernel_vocabulary_seed.md`](../../../memory/feedback_carpenter_gardener_are_glossary_kernel_vocabulary_seed.md)
  (kernel-vocabulary-seed prior thread), and
  [`memory/feedback_dont_invent_when_existing_vocabulary_exists.md`](../../../memory/feedback_dont_invent_when_existing_vocabulary_exists.md)
  (the discipline that gates re-deriving rather than composing-with
  prior substrate).

## The carved sentence

*Linguistic seed kernels are open for extension and closed for
modification by Mercer-closure -- not by discipline; carved sentences,
kernels, and memes are three names for the same composable
invariant-bearing unit; documents become proof artifacts when each
sentence specifies a kernel with checkable invariants; F#
Computational Expressions force every term inside a kernel block to
be valid by construction. The substrate is value-neutral; alignment
is human-supplied; the bootstrap razor sits above it; the wormwood
warning bounds it.*
