---
id: 081KQTPYE0008QG0R0009F20NN
priority: P3
status: open
title: F# <-> CodeAct bridge engineering -- four candidate architectures gated by four-property hodl invariant (Aaron 2026-05-05)
tier: research+engineering-direction
effort: L
ask: Aaron 2026-05-05 verbatim "we can do have a bridge between f# and codeact" + "our f# DSL are better. Wes Roth i watch a lot"
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [081KQTPYE0008QG0R001W237MZ, 081KQTPYE0008QG0R0004H9ZB8, 081KQGDBJ0008QG0R00280ZEV2, 081KQ0YZ80008QG0R001WZ4JE8]
tags: [fsharp, codeact, bridge-engineering, four-property-hodl, dst, retraction-native, dbsp, python-interop, type-providers, fsharp-compiler-service, absorb-and-contribute]
type: feature
---

# 081KQTPYE0008QG0R0009F20NN -- F# <-> CodeAct bridge engineering

## Source

Aaron 2026-05-05 forwarded a Claude.ai conversation that surfaced
F# <-> CodeAct bridging as a concrete engineering direction with
four candidate architectures. Aaron's framing on the bridge
shape:

> *"we can do have a bridge between f# and codeact"*

Aaron's framing on relative DSL strengths and source-channel
calibration:

> *"our f# DSL are better. Wes Roth i watch a lot"*

Aaron's no-kill-paths calibration on the broader candidate set:

> *"all of it's good we don't want to abandon any paths"*

The verbatim conversation is preserved at
[`docs/research/2026-05-05-claudeai-codeact-fsharp-bridge-gibberlink-berman-aaron-forwarded-preservation.md`](../../research/2026-05-05-claudeai-codeact-fsharp-bridge-gibberlink-berman-aaron-forwarded-preservation.md).
That document is the historical anchor; this row is the
action / engineering-direction shape that follows from it.

## Why P3 not P2

- **Not blocking Zeta**: the F# DSL surface is already shipping
  inside Zeta and CodeAct is an external paradigm; bridging is
  ecosystem-reach work, not survival work.
- **Engineering direction, not survival work**: per Aaron's
  no-kill-paths calibration above, this row holds open four
  parallel paths for evaluation, not a single must-deliver
  shipping milestone.
- **Bounded scope per architecture candidate**: each of the four
  architectures below can be evaluated independently; a P3 row
  can produce a Pareto-frontier comparison without committing
  Zeta to any single shape.

## CodeAct paper

CodeAct (Wang, Chen, Yuan, Zhang, Li, Peng, Ji), ICML 2024,
arXiv:2402.01030 (verified via WebSearch 2026-05-05 per Otto-364
search-first authority):

- [arxiv.org/abs/2402.01030](https://arxiv.org/abs/2402.01030)
  -- canonical paper page
- [github.com/xingyaoww/code-act](https://github.com/xingyaoww/code-act)
  -- official repo

CodeAct's load-bearing claim: consolidate an LLM agent's actions
into a unified action space expressed as **executable Python
code**, integrated with a Python interpreter. The agent emits
code, the interpreter executes it, observations come back, and
the agent revises across multiple turns. Reported relative to
JSON-action baselines: up to 20% higher success rate on the
benchmarks evaluated, and the Claude.ai search summary cited
~30% fewer steps with corresponding token reduction (this 30%
figure should be cross-checked against the actual paper text
before being cited externally; the 20% success-rate delta is
the load-bearing benchmark claim).

The structural shift CodeAct names: Python as a **universal
action vocabulary** for LLM agents, where multi-turn revision
based on observed execution feedback IS the agent loop.

## Where F# DSL beats CodeAct (four-property hodl axes)

The four-property hodl invariant is the Zeta-canonical filter:
DST-safe + lock-free + scale-free + DBSP-native (per 081KQTPYE0008QG0R001W237MZ).
F# DSL beats CodeAct on each axis:

1. **Compile-time UoM (units-of-measure)** -- F# carries
   dimensional safety into the type system at zero runtime cost
   (per 081KQTPYE0008QG0R001W237MZ + 081KQTPYE0008QG0R0004H9ZB8). Python has no equivalent surface;
   `pint` and similar libraries are runtime checks at best.
2. **Retraction-native semantics** -- the F# operator algebra
   composes cleanly with Z-set-style retraction semantics
   (signed-multiplicity weights). Python's mutable-state
   defaults fight retraction; you can write retraction-native
   Python, but the language defaults oppose it.
3. **DST (deterministic-simulation-testing)** -- F# under the
   `Zeta.Core` defaults is DST-amenable: pinned seeds,
   deterministic iteration, no hash-randomization-by-default.
   Python's hash randomization, GC non-determinism, and global
   interpreter lock all create DST-hostile defaults.
4. **Formal-verification composition** -- F# composes with the
   formal-verification toolbelt (Lean 4, F\*, TLA+, Alloy 6, Z3)
   already wired into Zeta. CodeAct's Python action vocabulary
   has no equivalent verification surface.

## Where CodeAct beats F# DSL (ecosystem axes)

Holding open the no-kill-paths frame, CodeAct beats F# DSL on
four ecosystem axes:

1. **Python ecosystem reach** -- numpy, pandas, scikit-learn,
   pytorch, transformers, the entire ML / data-science /
   scientific-computing universe. F# can call into .NET ML
   libraries, but the Python ML ecosystem is structurally
   larger.
2. **Pre-training overlap** -- LLMs have seen orders-of-magnitude
   more Python than F# in their training corpora. A CodeAct
   agent emitting Python is closer to in-distribution; an
   F#-emitting agent has a longer tail of mistakes.
3. **Lower adoption barrier** -- Python is the lingua franca for
   ML / data engineering / scripting. F# requires .NET tooling +
   a community comfort with ML-family languages.
4. **Broad benchmark coverage** -- CodeAct's reported benchmarks
   (API-Bank + curated set, 17 LLMs evaluated) are all
   Python-vocabulary; an F# action vocabulary has no equivalent
   benchmark coverage today.

## Four candidate architectures

Each candidate is evaluated against the four-property hodl
invariant. None is pre-selected as "the answer"; all four
remain live paths per Aaron's no-kill-paths framing.

### Candidate (1) -- Two-tier: F# DSL for hodl-required; CodeAct Python for ecosystem

**Shape**: hodl-required substrate (DBSP, formal verification,
retraction-critical paths) stays F# DSL; ecosystem-reach work
(ML model fits, numpy / pandas pipelines, scientific computing)
goes through CodeAct Python; explicit boundary between the two
tiers.

**Strengths**: cleanest hodl preservation -- the four-property
invariant holds inside the F# tier without any Python
interaction; the boundary is auditable.

**Weaknesses**: requires explicit decision per workload about
which tier to use; cross-tier composition has friction; the
boundary becomes a coordination tax.

**Four-property hodl preservation**: full preservation inside
the F# tier; explicit tier-crossing makes hodl violations
visible at the boundary.

### Candidate (2) -- F# emits Python via FSharp.Compiler.Service codegen

**Shape**: F# DSL stays the authoring surface; a code-generation
pass uses `FSharp.Compiler.Service` to emit Python that an
external interpreter executes. F# is the source-of-truth, Python
is a compiled artifact.

**Strengths**: F#'s type system stays the authoring constraint;
emitted Python inherits the structural guarantees of the F#
source; CodeAct-style agent loops can consume the emitted
Python.

**Weaknesses**: codegen complexity is non-trivial;
F#-to-Python translation is lossy on UoM and other type-level
features; emitted-Python debugging is harder than authored-Python.

**Four-property hodl preservation**: partial -- structural
guarantees of F# survive the codegen, but Python's runtime
defaults reintroduce DST hostility at execution time.

### Candidate (3) -- Pythonnet / Python.NET interop: CodeAct Python calls into compiled F-sharp

**Shape**: F# compiles to .NET assemblies; Python (CodeAct's
action vocabulary) calls into those assemblies via Pythonnet
(`Python.NET`) or equivalent. Python is the agent-action layer;
F# is the substrate-action layer.

**Strengths**: lowest-friction PoC (likely 1-2 weeks for a
working prototype); F# substrate stays unchanged; Python
agent-loop stays unchanged; bridge is a mechanical interop
layer.

**Weaknesses**: Pythonnet has its own GC interaction quirks;
cross-runtime exception flow needs careful handling; the
.NET <-> Python boundary is a known source of surprise.

**Four-property hodl preservation**: full preservation inside
the F# substrate (the hodl invariant holds for compiled F#
calls); Python-side execution is non-hodl by construction, but
Python-side work is agent-orchestration not substrate-modifying.

### Candidate (4) -- F# Type Providers wrapping Python libraries

**Shape**: extend the FSharpx Type Providers pattern to wrap
Python libraries (numpy, pandas, etc.) as type-provided F#
surfaces. F# stays the authoring surface; Python libraries
appear as F#-typed APIs.

**Strengths**: most ergonomic from the F# side; type providers
preserve the F# type system across the boundary; aligns with
existing F# ecosystem patterns.

**Weaknesses**: type provider authoring is itself a research
project for non-trivial Python libraries; runtime still calls
into Python (so DST-hostility at execution time remains);
maintenance burden of keeping providers in sync with upstream.

**Four-property hodl preservation**: partial -- F# type
guarantees hold at authoring time; Python execution still
reintroduces DST hostility at runtime.

## The hodl-preservation gate at the boundary

The load-bearing engineering choice across all four candidates
is **where the Python execution lives relative to substrate-
modifying work**. Python is where DST is hardest:

- **GC non-determinism**: Python's reference-counting + cycle
  collector schedule is non-deterministic from the application's
  point of view; pinning is harder than in .NET.
- **Hash randomization**: `PYTHONHASHSEED` defaults to a
  random per-process value; even pinning the seed doesn't fully
  recover dict iteration order across all stdlib paths.
- **Threading**: the GIL makes some kinds of races impossible
  but doesn't eliminate them across `multiprocessing` or
  C-extension-released-GIL paths.

The hodl-preservation rule that follows: **keep
DST-violating Python operations isolated to non-substrate-
affecting work**. Concretely, if the candidate is (3) Pythonnet,
then Python-side code should be agent-orchestration (deciding
what to call next) NOT substrate-mutation (writing into the
DBSP-tracked Z-sets). If the candidate is (1) Two-tier, then
the boundary IS the firewall.

## Acceptance criteria

1. **Each of the 4 architectures evaluated against four-property
   hodl preservation**.
   *Verifier*: a written comparison table covering all four
   candidates against {DST-safe, lock-free, scale-free,
   DBSP-native}, marking each cell {full / partial / none}
   with one-sentence justification.
   *Pass*: table covers 4 candidates x 4 properties = 16 cells
   with written justification per cell.
   *Falsifier*: any cell missing or any justification reducing
   to "by construction" without operational reasoning.

2. **Working PoC of at least one architecture**.
   *Verifier*: a runnable PoC demonstrating round-trip
   F# <-> Python interaction on a non-trivial example (likely
   candidate (3) Pythonnet for lowest friction). PoC includes
   a hodl-property test asserting at least one of the four
   properties holds across the boundary in the demonstrated
   shape.
   *Pass*: `dotnet build -c Release` clean, PoC runs
   end-to-end, hodl-property test passes deterministically
   under DST harness.
   *Falsifier*: build break, runtime error in the round-trip
   path, or hodl-property test fails or flakes.

3. **Sister-shape cross-reference to 081KQTPYE0008QG0R0004H9ZB8**.
   *Verifier*: this row's engineering-shape (research-grade
   discovery -> verification preconditions -> engagement-gate
   -> upstream-or-internal landing) matches the shape used in
   081KQTPYE0008QG0R0004H9ZB8 (F# UoM upstream contribution); deviations are named
   and justified.
   *Pass*: a "shape comparison" subsection naming each of the
   081KQTPYE0008QG0R0004H9ZB8 phases and how this row's instantiation matches or
   deviates.
   *Falsifier*: ad-hoc shape that ignores the 081KQTPYE0008QG0R0004H9ZB8 sister
   pattern without explicit justification.

4. **Composability check with 081KQTPYE0008QG0R001W237MZ four-property hodl test
   suite**.
   *Verifier*: any PoC produced under criterion (2) lands a
   test row that runs inside the 081KQTPYE0008QG0R001W237MZ four-property hodl
   gate (or the 081KQTPYE0008QG0R001W237MZ follow-on test suite once that exists).
   *Pass*: PoC test row appears in the same test runner as
   081KQTPYE0008QG0R001W237MZ's hodl tests; CI green.
   *Falsifier*: PoC tests live in a separate runner that does
   not enforce the four-property gate.

## Out of scope

- **Replacing F# DSL entirely with CodeAct**. Per Aaron's
  no-kill-paths framing and the four-property hodl axes above,
  the F# DSL is non-fungible inside hodl-required substrate.
  The bridge **composes**; it does not supersede. CodeAct is
  not "wrong" -- it is structurally optimal for ecosystem-reach
  agent work and structurally weaker for DST / retraction /
  scale-free arithmetic / formal-verification composition.
- **Training a new LLM on F# action traces**. Closing the
  pre-training-overlap gap by training a model is a different
  kind of work (ML research, not bridge engineering) and lives
  in a separate (currently unfiled) row if it is ever pursued.

## Composes with

- [081KQTPYE0008QG0R001W237MZ](../P2/081KQTPYE0008QG0R001W237MZ-bigint-and-bignumber-integration-aaron-2026-05-05.md)
  -- the four-property hodl gate this row's PoCs feed back
  into; canonical reference for the hodl invariant.
- [081KQTPYE0008QG0R0004H9ZB8](081KQTPYE0008QG0R0004H9ZB8-fsharp-uom-biginteger-upstream-contribution-aaron-2026-05-05.md)
  -- sister-shape upstream contribution row; the engineering
  shape (research-grade -> verification-preconditions ->
  engagement-gate -> upstream-or-internal landing) is the
  template this row follows.
- [081KQGDBJ0008QG0R00280ZEV2](081KQGDBJ0008QG0R00280ZEV2-topological-quantum-emulation-via-bayesian-inference-zeta-seed-executor-aaron-2026-05-01.md)
  -- Bayesian-inference substrate the bridge ultimately runs
  on; the agent-orchestration loop on the Python side is one
  consumer of that substrate.
- [081KQ0YZ80008QG0R001WZ4JE8](../P2/081KQ0YZ80008QG0R001WZ4JE8-embodiment-grounding-analysis-isaac-sim-and-other-robotics-sim-platforms-otto-340-counter.md)
  -- embodiment-grounding parallel axis; CodeAct's
  universal-action-space is one shape of agent grounding,
  embodiment work is another, the two are parallel not
  competing.
- [`docs/research/2026-05-05-claudeai-codeact-fsharp-bridge-gibberlink-berman-aaron-forwarded-preservation.md`](../../research/2026-05-05-claudeai-codeact-fsharp-bridge-gibberlink-berman-aaron-forwarded-preservation.md)
  -- the verbatim historical anchor this row's action-shape
  follows from.

## Engagement gate

Per the engagement-gate-substantive-claim-level discipline
([`memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md`](../../../memory/feedback_engagement_gate_substantive_claim_level_discipline_aaron_otto_2026_05_05.md)):
**only engage upstream IF the contribution has substance**. For
this row that means:

- Engagement with the CodeAct authors (Wang et al.) or
  community is gated on a working PoC + four-property hodl
  validation. The PoC IS the substance test.
- A speculative "we should bridge F# and CodeAct" comment
  posted upstream WITHOUT a PoC is the failure mode this gate
  guards against (per the Prop 3.5 misattribution worked
  example referenced in 081KQTPYE0008QG0R0004H9ZB8).
- Internal landing (Zeta-only PoC, Zeta-only test suite, no
  upstream engagement) is fully in-scope at any point and does
  NOT require the engagement gate to clear.

## The carved sentence

**"F# DSL beats CodeAct on four-property hodl (DST-safe +
lock-free + scale-free + DBSP-native); CodeAct beats F# DSL on
ecosystem reach (Python pre-training overlap, library universe,
benchmark coverage). Four candidate architectures hold all
paths open: two-tier separation, F#-emits-Python codegen,
Pythonnet interop, F# Type Providers wrapping Python. None is
pre-selected. The load-bearing engineering choice in every
candidate is keeping DST-violating Python operations isolated
to non-substrate-affecting work -- the bridge composes both
languages without forcing either to give up its structural
strength."**
