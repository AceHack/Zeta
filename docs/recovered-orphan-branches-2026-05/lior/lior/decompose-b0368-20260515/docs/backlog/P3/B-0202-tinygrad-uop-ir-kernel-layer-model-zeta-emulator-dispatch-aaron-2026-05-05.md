---
id: B-0202
priority: P3
status: open
title: Tinygrad UOp IR as kernel-layer model for Zeta's emulator dispatch + retract semantics -- substrate-engineering composition claim (Aaron 2026-05-05)
tier: research+engineering-direction
effort: L
ask: Aaron 2026-05-05 substrate-engineering composition claim -- one symbolic IR -> all hardware (the move Zeta wants for kernel layer). Same-tick paper-id correction: Aaron disconfirmed tinygrad as the half-remembered universal-language paper (*"it's still not tinygrad, i did see that but that's not my univeral language"*), but the substrate-engineering claim survives independent of paper-id resolution.
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [B-0052, B-0053, B-0152, B-0196, B-0026, B-0199, B-0204]
tags: [tinygrad, uop-ir, mu-ops, kernel-layer, universal-ir, multi-backend, cuda, rocm, oneapi, metal, opencl, llvm, graph-rewrite, pattern-matcher, four-property-hodl, dst, retraction-native, dbsp, scale-free, george-hotz, tiny-corp, tinybox, alex-ziskind]
type: feature
---

# B-0202 -- Tinygrad UOp IR as kernel-layer model

## Source

Aaron 2026-05-05 forwarded a Claude.ai conversation that progressively
narrowed his half-remembered framing *"universal language not English
that trains to real-time actions"* across six-plus candidate-elimination
passes. The verbatim clue:

> *"the universal language was not english it way symbolsy maybe and it
> complied to other things myabe cuda and the ati one and the inteall
> one"*

**Same-tick paper-id elimination (Aaron 2026-05-05):** Aaron disconfirmed
tinygrad as the half-remembered paper -- *"it's still not tinygrad, i
did see that but that's not my univeral language"*. **This row is NOT
about identifying the paper Aaron half-remembered.** It is about the
**substrate-engineering composition claim** that surfaced in the same
narrowing pass: one symbolic IR -> all hardware is exactly the move
Zeta wants for kernel layer + emulator dispatch + retract semantics.
That claim stands independently of paper-id resolution and is what
this row evaluates.

The conversation surfaced **tinygrad UOp IR (George Hotz / tiny corp)**
as the engineering-shape candidate that matches the substrate-
composition claim. Clue components map cleanly to UOp IR's architecture
(useful for evaluating the engineering shape, not as paper-id
evidence):

- *"symbolsy maybe"* -> UOp = mu-ops (Greek letter mu); symbolic op-graph
  with no English keywords; the language IS the symbolic UOp graph
  applied via PatternMatcher graph rewrites
- *"complied to other things myabe cuda and the ati one and the inteall
  one"* -> the renderer system targets CUDA, AMD/ROCm + HIP,
  Intel/oneAPI, plus Metal, OpenCL, NVIDIA PTX, NIR (Vulkan), CLANG,
  LLVM. **One IR -> many backends.** That is the "universal" part.
- *"basic and not well-principled but correct"* (Aaron clarifying
  phrase) -> tinygrad's stated minimalism / hackability discipline; hard
  line-count limit (<= 1000-line target historically; codebase still
  measured in thousands not millions of lines, where PyTorch is
  millions); pragmatism over theoretical elegance
- *"released last month"* -> heavy April 2026 commit activity with
  recent backend additions

Full verbatim research-doc preservation will land at
`memory/persona/deepseek/conversations/2026-05-05-claudeai-tinygrad-uop-turboquant-deepseek-v4-symbolica-categorical-aaron-forwarded-preservation.md`
once sibling PR #1610 merges; until then, the link target lives on
that PR's branch. (Same softening pattern as B-0201's research-doc
reference to PR #1605.)

The **substrate-engineering composition claim** (one IR -> many
backends, the engineering shape worth absorbing for Zeta's kernel
layer) is **what this row evaluates**, NOT a paper-id claim that
tinygrad is the half-remembered paper -- Aaron disconfirmed that
identification same-tick. Per Aaron's 2026-05-05 no-kill-paths framing
*"all of it's good we don't want to abandon any paths"*, the OTHER
candidates surfaced in the same conversation lineage (Coconut at
B-0201, CodeAct/F# bridge at B-0200, plus Symbolica, GibberLink, LAPA)
stay alive as parallel research lanes; tinygrad remains a parallel
candidate too on substrate-engineering merits.

## Why P3 not P2

This row is **research-and-engineering-direction**, not survival work:

- **Not blocking Zeta delivery.** Zeta's existing F# kernel layer ships
  independent of whether tinygrad UOp IR ends up the right kernel-model
  shape. The four-property hodl algebra (DST-safe / lock-free /
  scale-free / DBSP-native) does not depend on this row.
- **Engineering direction not survival work.** The architectural
  question -- "is one-symbolic-IR-many-backends the right shape for
  Zeta's emulator dispatch and retract semantics?" -- can be answered
  by a substance-test, not by a forced migration.
- **Bounded scope.** The substance-test gate (acceptance criteria
  below) is structured to be evaluable in roughly 1-2 weeks of bounded
  work: read the source, walk one rewrite manually, write out the
  isomorphism (or document its impossibility) for one non-trivial
  operator, and run the result against the four-property hodl test
  suite (B-0196). That bound is what makes P3 the right priority --
  P2-promotion is available via the renegotiation protocol if the
  substance-test exposes a delivery-blocking implication, not by
  default.

## Tinygrad UOp IR -- the artifact

Verified via WebSearch per Otto-364 search-first authority (2026-05-05):

- **GitHub**: [tinygrad/tinygrad](https://github.com/tinygrad/tinygrad)
- **Org**: tiny corp (founded 2023 by George Hotz)
- **DeepWiki cross-reference**:
  [deepwiki.com/tinygrad/tinygrad](https://deepwiki.com/tinygrad/tinygrad)
- **Project docs**:
  [docs.tinygrad.org/developer/developer/](https://docs.tinygrad.org/developer/developer/)

### Source layout (verified paths)

The prompt's suggested path `tinygrad/codegen/pattern_matcher.py` was
**not the actual location** -- WebSearch surfaced the real layout:

- **Core UOp + PatternMatcher implementation**:
  [`tinygrad/uop/ops.py`](https://github.com/tinygrad/tinygrad/blob/master/tinygrad/uop/ops.py)
- **Codegen simplification (PatternMatcher consumer)**:
  [`tinygrad/codegen/simplify.py`](https://github.com/tinygrad/tinygrad/blob/master/tinygrad/codegen/simplify.py)
- **Lowerer (AST -> UOps)**:
  `tinygrad/codegen/lowerer.py`
- **Module tree**: `tinygrad/{codegen,engine,llm,mixin,nn,renderer,runtime,schedule,uop,viz}`

Acceptance criterion (a) below pins the verified path, not the
prompt's suggested one. This correction is logged here so future-Otto
inherits the right path on first read.

### What the IR is

UOp = **mu-ops** (Greek letter mu). The IR is a graph of symbolic
operations (RANGE, BARRIER, DEFINE_VAR, LOAD, STORE, ALU, PHI, plus
the rest of the ~90-op vocabulary). Transformations are driven by a
**PatternMatcher** that applies `graph_rewrite` rules to the UOp graph
-- everything from symbolic arithmetic simplification to
hardware-specific lowering happens by graph rewrite.

Codegen pipeline (per the project's developer docs, verified
2026-05-05):

1. AST is lowered to UOps -- a linear list of the compute to be run
   (BEAM search happens at this stage)
2. UOps are rendered to backend-specific code by a **Renderer**
3. Backend code is compiled to binary by a **Compiler**

### Backend coverage

One IR -> many backends. Renderer targets covered (per the project's
README and module tree, verified 2026-05-05):

- CUDA (NVIDIA)
- AMD/ROCm + HIP
- Intel/oneAPI
- Metal (Apple)
- OpenCL
- NVIDIA PTX
- NIR (Mesa / Vulkan)
- CLANG (host CPU via C compiler)
- LLVM

This is the *"universal"* part of the universal-IR shape -- the IR
itself is hardware-agnostic, and backend portability is achieved by
adding renderers, not by reshaping the IR.

### Design philosophy ("basic but correct")

Tinygrad's stated philosophy aligns with Aaron's clarifying phrase
*"basic and not well-principled but correct"*:

- **Hard line-count limit** -- historically <= 1000 lines as a
  forcing-function constraint; *"tinygrad will always be below 1000
  lines. If it isn't, we will revert commits until tinygrad becomes
  smaller"* per the early Hacker News thread + project Issue #94. The
  modern codebase has grown beyond that historical cap but the
  minimalism-as-discipline framing persists; the codebase is still
  measured in thousands not millions of lines.
- **Pragmatic + hackable** -- middle ground between PyTorch (millions
  of lines, full ecosystem) and micrograd (autodiff toy). Forward and
  reverse-mode autodiff is supported; the rest is reduced to graph
  rewrites.
- **"Everything is a graph rewrite"** -- the architectural reduction
  that buys the minimalism. Trade-off: one IR keeps the code simple
  but makes generalization (across very different op-classes) harder.
- **Correctness via testing** -- not via formal proof; basic-but-
  correct, not principled-and-clean.

A Tinyblog explainer or detailed design-rationale doc would be a
useful citation; if findable during the substance-test (acceptance
criterion (a)), absorb here.

## Why this matters for Zeta

Tinygrad-shape (one symbolic IR -> all hardware) is exactly the move
Zeta wants for its own kernel layer eventually. **Four substrates
should compose with UOp-shape**, each tracked by an existing backlog
row:

- **Emulator dispatch (B-0052 retractable-emulators-design-question /
  B-0053 emulator-ideas-absorption)** -- if Zeta's emulators dispatch
  through ONE symbolic op-graph rather than per-backend bespoke code,
  the engineering surface collapses dramatically. UOp + PatternMatcher
  is the existing-engineering-shape worth absorbing.
- **Retraction (B-0052 retractable-emulators-design-question)** --
  retract semantics over a graph-rewrite IR is structurally close to
  signed-delta arithmetic over the IR's value space. The retract
  primitive could land as one or two PatternMatcher rules rather than
  a per-backend retract implementation.
- **Replay (DST discipline, deterministic-simulation-theory-expert
  surface)** -- the IR is data-flow not control-flow; bit-exact replay
  reduces to *"same UOp graph, same input, same renderer, same
  compiler -> same binary -> same output."* This is a far cleaner DST
  story than per-backend replay.
- **Topological-quantum-emulation (B-0152
  emulation-inside-the-algebra)** -- the substrate that needs to run
  on whatever hardware happens to be present. UOp's one-IR-many-
  backends shape is the natural carrier; the question (open-research,
  acceptance criterion (b)) is whether the four-property hodl
  invariants survive the IR.

UOp graphs are **scale-free** (the ~90 ops compose at any granularity)
and the PatternMatcher rewrite engine is structurally **DBSP-native**
(graph rewrites are differentiable in the DBSP sense -- a rewrite
applies an operator to the IR-as-Z-set, producing a new IR-as-Z-set
that differs by a signed delta). The four-property hodl invariant
**lifts naturally** to UOp graphs IF the isomorphism survives the
substance-test below.

## Four-property hodl preservation through UOp IR

The substance-test for whether tinygrad-shape composes with Zeta's
algebra is the four-property hodl preservation question, broken into
four sub-questions:

### DST-safe -- are UOp graph rewrites deterministic?

PatternMatcher is pure-functional: a rewrite rule is a function `(UOp
-> UOp option)` applied bottom-up to the graph. No side effects, no
hidden state, no RNG in the rewrite layer itself. Rewrites are
**referentially transparent**.

**Initial answer: yes.** Same UOp graph + same rule set -> same
rewritten graph, bit-exact. The DST gap is at the **renderer +
compiler + runtime** layer (CUDA non-determinism, kernel-launch
ordering, mixed-precision rounding), not at the IR layer.

Substance-test required to verify: read the rewrite-driver source,
walk through a rewrite, confirm referential transparency holds in
practice (acceptance criterion (a)).

### Lock-free -- do UOp graphs avoid mutex/locks in execution?

The IR is **data-flow, not control-flow**. UOps express compute and
data movement; concurrency is expressed via BARRIER ops + the
renderer's ability to emit hardware barriers. The IR itself does not
require mutex / lock primitives at the IR layer.

**Initial answer: largely yes** at the IR layer; the lock-free claim
at the runtime layer depends on the specific renderer's output. CUDA
kernels with `__syncthreads()` are not "locked" in the OS-mutex sense
even though they coordinate execution -- BARRIER UOps lower to the
same primitives.

Substance-test required: confirm the IR-layer lock-free claim survives
under the rewrite paths Zeta would actually use (the retract path
specifically; if retract requires intra-graph coordination that
introduces lock-equivalent primitives, the claim weakens).

### Scale-free -- does the IR work at any granularity?

Yes by design. The ~90 ops compose arbitrarily; a UOp graph can
express a scalar add, a vector dot product, or a full transformer
layer using the same op set. The renderer handles the granularity-
specific lowering (scalar -> SIMD -> tensor-core, depending on
backend).

**Initial answer: yes.** This is one of the design properties
tinygrad's minimalism explicitly buys.

### DBSP-native -- do UOp graphs fit Z-set algebra?

**Open research question.** This is THE substance-test.

The candidate isomorphism: UOp ALU operations + signed-delta
arithmetic. A UOp graph is a Z-set of (op_type, input_refs, output_ref)
triples; rewriting the graph applies a graph_rewrite operator to the
Z-set, producing a new Z-set; the difference is a signed delta in the
DBSP sense.

The proof obligation:

1. Show that PatternMatcher rewrites preserve the Z-set algebra under
   composition (i.e. applying rewrite A then rewrite B equals applying
   the composed rewrite -- the categorical-equivalent of associativity)
2. Show that the retract operation is expressible as a DBSP-style
   inverse delta on the IR Z-set, not as a separate roll-back mechanism
3. Show that the four-property hodl invariants (DST + lock-free +
   scale-free + DBSP-native) compose under the rewrite operation, not
   just hold pointwise

The isomorphism may break; if it does, document where and why
(acceptance criterion (b) falsifier). The break-point is itself
research substrate -- a clean falsification is more valuable than a
hand-wave alignment.

## Acceptance criteria

(a) **[DECOMPOSED to B-0521] Read the source + walk one rewrite manually + map to Zeta retract semantics.** Verifier: a memo (committed under
`docs/research/`) walking through one ALU rewrite from
[`tinygrad/uop/ops.py`](https://github.com/tinygrad/tinygrad/blob/master/tinygrad/uop/ops.py)
plus [`tinygrad/codegen/simplify.py`](https://github.com/tinygrad/tinygrad/blob/master/tinygrad/codegen/simplify.py)
step-by-step, mapping the rewrite to the closest equivalent in Zeta's
existing retract semantics. Pass: the walk is concrete + cites
specific line numbers in the tinygrad source. Fail-falsifier: the
walk reveals that PatternMatcher rewrites are NOT referentially
transparent in practice (e.g. depend on iteration order, hidden
global state, undocumented mutation), invalidating the DST-safe
initial answer above. Don't claim alignment until walked.

(b) **Write out the explicit UOp-graph-to-Z-set isomorphism (or
document its impossibility) for at least one non-trivial operator.**
Candidate operator: signed-delta multiply (the DBSP-relevant case where
the retract is non-trivial). Verifier: a memo + a small F# / TypeScript
sketch (committed under `docs/research/` or `tools/`) implementing the
mapping. Pass: the isomorphism is precise enough to compose with
Zeta's existing Z-set algebra without translation layers. Fail-
falsifier: the isomorphism cannot be written down, OR it can be
written down but breaks the four-property hodl somewhere; document
where and why specifically, since a clean break is itself a research
finding (composes with B-0196 four-property hodl test suite).

(c) **Engagement gate per
[`memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md`](../../../memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md):
lurk on tiny corp Discord; submit one small PR (typo fix / doc
clarification) before claiming compositional alignment.** Don't engage
with substantive design proposals (tinygrad-as-Zeta-kernel-substrate,
PatternMatcher-as-retract-engine, etc.) until the substance-test (a)
plus (b) is complete. Verifier: a small PR landed upstream + a Discord-
lurk note in the engagement-gate memory file. Pass: small contribution
is merged or has constructive review. Fail-falsifier: the small PR
reveals a culture / process / governance mismatch that would prevent
sustained collaboration; document it and adjust this row's scope
accordingly (downgrade to read-only research, or pause the engagement
lane entirely).

(d) **Composability check with B-0196 four-property hodl test
suite.** Verifier: run UOp graph fragments through Zeta's existing
test framework (the test suite that validates DST-safe / lock-free /
scale-free / DBSP-native invariants per B-0196). Pass: the invariants
hold under the test framework. Fail-falsifier: one or more invariants
fail; document which, under what input shape, and propose either a
fix to the IR-Zeta-bridge or a falsification of the original
"naturally lifts" claim above (whichever the test outcome supports).

## The "basic but correct" lesson

Tinygrad's stated philosophy aligns with Zeta's bootstrap-razor
discipline (B-0193 lineage). *"Correct-and-fast over principled-and-
clean"* is the same shape as Zeta's *"specs-over-implementation"* +
*"razor-discipline"* combo (per
[`memory/feedback_razor_discipline_no_metaphysical_inference_only_operational_claims_rodney_razor_aaron_claudeai_2026_05_03.md`](../../../memory/feedback_razor_discipline_no_metaphysical_inference_only_operational_claims_rodney_razor_aaron_claudeai_2026_05_03.md)).

The architectural question:

> Is "basic-but-correct" the right design philosophy for Zeta's kernel
> layer too, OR does the four-property hodl require more rigor than
> tinygrad's pragmatic minimum?

Two ways the answer could go:

- **"Yes, basic-but-correct is sufficient."** -- tinygrad's discipline
  + Zeta's existing test framework + DST replay together cover the
  rigor gap. The four-property hodl can be validated empirically per
  rewrite-rule, not requiring a formal proof per rule. UOp IR + a
  Zeta-side composition layer is the right kernel substrate. Cost-
  effective: the pragmatic minimum buys the architectural simplicity
  Zeta wants.
- **"No, hodl requires more."** -- the substance-test (b) reveals
  cases where rewrite composition violates the hodl invariants in
  ways that empirical testing doesn't reliably catch. Zeta's kernel
  layer needs proof-grade rigor (Lean / F* / TLA+) that tinygrad's
  philosophy explicitly disclaims. UOp IR is then a useful study
  artifact and an engineering reference, but not a direct kernel-
  substrate adoption.

The substance-test answers the question; this row carries the
question, not a pre-committed answer.

## Human anchors

- **George Hotz** (geohot, tiny corp) -- creator of tinygrad;
  livestreams kernel design + tinybox builds. The engagement gate
  (acceptance criterion (c)) applies before any substantive design
  proposal lands upstream.
- **Alex Ziskind** ([@AZisk](https://www.youtube.com/@AZisk)) --
  benchmarks tinygrad on Mac Studio + DGX Spark clusters; covers it
  in his weekly local-AI content. Reference: source-set per
  [`memory/reference_aaron_ai_news_source_set_wes_roth_matt_berman_ai_explained_2026_05_05.md`](../../../memory/reference_aaron_ai_news_source_set_wes_roth_matt_berman_ai_explained_2026_05_05.md)
  (extension to add Ziskind to the source-set is pending in a
  following tick; flagged here so the row's anchor list does not
  drift if the source-set update is deferred).

## Out of scope

This row is bounded; the following are **out of scope** for B-0202:

- **Replacing Zeta's existing F# kernel layer with tinygrad.** This
  row is research-and-evaluation, not migration. Migration would be
  a separate row gated on the substance-test outcome.
- **Training models on UOp IR.** Different research lane; tinygrad
  is studied here as kernel-IR, not as ML-research substrate.
- **Engaging tiny corp on substantive design proposals before the
  substance-test completes.** The engagement gate is binding
  (acceptance criterion (c)); only small low-risk contributions
  (typo fixes / doc clarifications / lurk-only Discord presence) are
  in-scope before (a) + (b) land.
- **Audit / port of the full PatternMatcher rule set to F#.** Way
  beyond bounded scope; if the substance-test passes and a port is
  warranted, it is its own row.

## Composes with

Explicit composition map (mirrors frontmatter `composes_with`):

- **B-0052** -- *retractable-emulators-design-question*. UOp IR is the
  candidate kernel substrate for retract operations; the substance-test
  (b) is specifically the retract-semantics-over-UOp question.
- **B-0053** -- *emulator-ideas-absorption (clean-room grey-hat)*. UOp
  PatternMatcher is the engineering-shape worth absorbing into the
  emulator surface; this row is the absorption-direction memo.
- **B-0152** -- *topological-quantum-emulation via Bayesian inference,
  Zeta seed executor*. The substrate that UOp could run on with hodl
  preserved -- emulation-inside-the-algebra needs a hardware-agnostic
  IR layer, and one-IR-many-backends is the candidate shape.
- **B-0196** -- *BigInt + bignumber integration / four-property hodl
  gate*. The composability check (acceptance criterion (d)) runs against
  B-0196's test framework; the four-property hodl is the gate.
- **B-0026** -- *embodiment grounding*. UOp's hardware-agnostic property
  composes with embodiment substrates that need to run on varied
  hardware (robotics-sim, edge devices, heterogeneous accelerators).
- **B-0199** -- *ROM publication public-domain scouting*. ROM emulator
  engineering benefits from one-IR-many-backends shape; if Zeta lands
  ROM emulators, the UOp-substrate question composes directly with the
  ROM-emulator engineering lane.
- **The research-doc preservation** (will resolve at
  `memory/persona/deepseek/conversations/2026-05-05-claudeai-tinygrad-uop-turboquant-deepseek-v4-symbolica-categorical-aaron-forwarded-preservation.md`
  once sibling PR #1610 merges) -- the verbatim Aaron-forwarded
  conversation that surfaced the substrate-engineering composition
  claim. (Aaron same-tick disconfirmed tinygrad as the paper-id
  match; the substrate-engineering claim stands on its own merits.)

## Engagement gate

Per
[`memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md`](../../../memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md),
substance-tests must complete before any tiny corp engagement at the
substantive-claim level. The gate has three tiers:

1. **Lurk-only** (immediate, in-scope): join tiny corp Discord, watch
   the discussion patterns, identify what makes a good upstream
   contribution there. No claim-level engagement.
2. **Small contribution** (after acceptance criterion (a) reads the
   source): one typo fix / doc clarification / minor bug-report. Low-
   risk, low-stakes; surfaces governance / culture fit.
3. **Substantive engagement** (gated on (a) + (b) complete): only
   after the UOp-graph-to-Z-set isomorphism is written out (or
   documented as impossible). Substantive proposals like
   "tinygrad-as-Zeta-kernel-substrate" or "PatternMatcher-as-retract-
   engine" are tier 3, not tier 1.

The gate is **about respecting the upstream project's scarce
attention**, not about gating Zeta's internal research. Tier 1 + tier
2 are in-scope for this row; tier 3 lands as a follow-up row gated on
this row's outcome.

## The carved sentence

*Tinygrad UOp IR is the universal-IR shape Zeta wants for emulator
dispatch, retraction, replay, and topological-quantum-emulation -- one
symbolic op-graph that targets whatever hardware happens to be
present. The substance-test is whether four-property hodl survives the
graph-rewrite layer; if it does, the kernel-layer collapse is large,
and "basic but correct" carries the discipline. If it does not, the
break-point is research substrate, and Zeta's kernel layer keeps
proof-grade rigor as a binding constraint.*
