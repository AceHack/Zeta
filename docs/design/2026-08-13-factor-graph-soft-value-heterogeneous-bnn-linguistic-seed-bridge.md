# Bridging four layers: factor graph · soft/amplitude values · heterogeneous-depth BNNs · the linguistic seed

**Status:** design, not implementation. No code lands with this document.
**Register:** Beacon (outward-facing, load-bearing) — every claim is marked CHECKED or PROPOSED.

Aaron's ask, ferried verbatim and unedited:

> can we route to someone to come up with a design for having our basyian factor graphs hook into our
> softemu alplitudeemu softvalue dynamicvalue and also the bnn so differnt bnns in society can have
> different depths not all need to be the same, and also to tie into a minimal linquistic seed english,
> we started some of the linguistic seed stuff in f# computational expression but we may need more
> anltr like glr or gtr or whatever it's called we have the start of our own parser combinator
> generator libabyr for some stuff, i'm really hoping the basyain helps us out a lot, also for what are
> traditially stop words, we need like an inverse bnn from the noraml works cause the stop works have
> lots of context, this is when like context free grammer goes to context aware grammer ANTLR has alot
> to say about this for computer language but this is my interpertation in natural language, stop words
> are a hack that looses so much informaiton about context.

---

## 0. The one-paragraph answer

Three of the four connections are wiring; one is a research project. The parse-forest↔Bayesian
connection is **already built** and needs one injected function, not a design. The stop-word/inverse-BNN
connection is **already anchored in-repo** and needs one observable swapped into an existing instrument,
not a new stack. The factor-graph↔soft-value connection is **half a typed conversion and half a
category error** — beliefs and amplitudes must never be silently interconverted. The heterogeneous-depth
connection is **cheap to express and currently unsafe to aggregate**: three defects were reproduced in
this pass, and calibrating a depth-`d` belief so it may be summed with a depth-`1` belief is the one
genuinely unsolved item here.

---

## 1. What already exists (CHECKED — read before proposing anything)

| Surface | File | Real state |
|---|---|---|
| Sum-product BP, family-generic, damped, fixpoint-capped | `src/Bayesian/FactorGraph.fs` | Complete and careful (NaN counts as *moved*, structural change never reads as convergence) |
| Exponential-family message algebra in natural parameters | `src/Bayesian/Message.fs` | `IMessage<'M>`; `Gaussian` product = add `(ν, τ)`; divide = EP cavity, may be improper by design |
| Single Gaussian inference cell | `src/Bayesian/MinimalBnn.fs` | Conjugate online update, IV objective |
| N-layer BNN, `Sequential` \| `SkipConnections` | `src/Bayesian/MultilayerBnn.fs` | Forward pass real; **backward pass is a no-op — see §3** |
| Star-topology society, leave-one-out empowerment | `src/Bayesian/SocietyBootstrap.fs` | Joint = exact precision sum |
| Attention-routed sparse society | `src/Bayesian/SparseSocietyNetwork.fs`, `AttentionRouter.fs` | Rebuilds the graph per round; emits `ActiveEdges/TotalEdges` |
| Grammar as data (`Grammar ⇄ DynamicValue`) | `src/Core/GrammarIr.fs` | Bijection; grammars ride the value-tree codecs |
| SLR(1) tables **and** GLR | `src/Core/Slr.fs` | `build` reports conflicts rather than silently resolving; `buildGlr`/`glrParse`/`glrForest` |
| **Shared packed parse forest + inside/outside/marginals/EM E-step** | `src/Core/Sppf.fs` | `inside`, `outside`, `marginals`, `expectedCounts`, `weightedTrees`; all cycle-guarded and total |
| Forest → `SoftValue`, Kleisli lowering | `src/Core/ParseSoft.fs` | `ofSppf`, `lower` (monadic descent), `lowerStructural` |
| Homoiconic meta-grammar; terminal-vs-nonterminal by *dictionary membership* | `src/Core/MetaGrammar.fs` | Aaron's "english as its own grammar, every word defined by other words" — implemented |
| ANTLR `.g4` ingest | `src/Core/Antlr4Import.fs` | Imports the open grammar corpus into the IR |
| Normalised finite-support distribution over `DynamicValue` | `src/Core/SoftValue.fs` | Giry monad; `combine` is a commutative partial monoid; `snap` is the one sanctioned exit |
| Real-weight branch ensemble | `src/Core/SoftEmu.fs` | Classical mixture, no merge, no interference |
| **Complex**-amplitude ensemble | `src/Core/AmplitudeEmu.fs` | `merge` **sums** amplitudes; `bornProb` is `\|z\|²`; the only place amplitudes become probabilities |
| Action alphabet as Boolean lattice; ⊤ ≠ superposition | `src/Core/ActionGrammar.fs` | The distinction is explicit and load-bearing |
| Controller-in-superposition | `src/Core/SoftController.fs` | `inputSuperposition : Frame -> (bool[] * float) list`, **uniform priors**, with the header noting "a real controller model would weight by likelihood" |
| Excess-correlation instrument over a permutation null | `src/Core/DecorrelationExcess.fs` | **Statistic-agnostic and observable-generic** (`'o`, `stat : 'o -> 'o -> float`); one-way verdict (convicts, never acquits) |
| Verb alphabet (min-unique-prefix, 3 letters) | `clis/Verbs.fs`, `clis/VERB-MAP.md` | Six canonical verbs in code, the rest floated as interface stubs |
| μένω as categorical arrow / Kleisli CE | `src/Core/Meno.fs` | The F# computation-expression bridge; CD category, **not** cartesian (copy/discard exist, neither is natural) |

Two corrections to the premise, both CHECKED:

- **There is no parser combinator library.** The only `CustomOperation` builders in the tree are in
  `src/Core/ZetaSqlBuilder.fs`. `src/Core/RomDat.fs` carries an aspiration comment — *"The real parsing
  grows into our own parser combinators / generators (FParsec-style, GLR/LR*, ANTLR-shaped) —
  routed/work-itemed, not built here."* What exists is a **parser generator** (grammar-as-data → LR/GLR
  tables), which is a different and incompatible front end. See §6.1.
- **`experiments/meno-persist-as-bridge/Meno.fsx` is not linguistic-seed machinery.** It is a
  `Result<T, TFeedback>` persistence primitive with a `MenoBuilder` computation expression and a long
  etymological preamble. The linguistic-seed machinery Aaron is remembering is `src/Core/MetaGrammar.fs`
  (the self-describing dictionary) and `src/Core/Meno.fs` (the arrow/CE bridge). Both are stronger than
  the `.fsx`.

---

## 2. Question 1 — factor graph ↔ SoftEmu / AmplitudeEmu / SoftValue / DynamicValue

**Proposed to me:** "these are the same object seen from two sides; the bridge is a typed conversion."

**Verdict: half right, and the wrong half is the dangerous one.** There are *three* carriers here, not
two, and they live on different algebras.

| Carrier | Type | Combine | Normalised? | Domain |
|---|---|---|---|---|
| `Gaussian` message | `{ PrecisionMean: float; Precision: float }` | **product** = add natural params | no (unnormalised); may be **improper** (`τ ≤ 0`) by design, that is the EP cavity | continuous ℝ |
| `SoftValue` | `(DynamicValue * float) list`, weights > 0 summing to 1 | **product then renormalise** (`combine`) | yes, by invariant | finite discrete |
| `AmplitudeEmu.Amp` | `(Frame * Complex) list` | **sum** of amplitudes for identical frames (`merge`) | only via `normalize` on `Σ\|z\|²` | finite discrete, complex |

### 2.1 The genuine conversion (cheap — build it)

`FactorGraph.marginal` over a **discrete** message family → `SoftValue` is a real typed conversion, and
it is the one that pays immediately: `SoftController.inputSuperposition` returns uniform priors today and
its own header asks for likelihood weights. Replacing uniform with a marginal is the shortest path from
"we have a Bayesian layer" to "the Bayesian layer changes what the emulator does."

Two conditions the interface must enforce rather than assume:

1. **Properness.** An improper message (`τ ≤ 0`) has no normalisation and must not become a `SoftValue`.
   `Gaussian.isProper` exists; the conversion returns `option`.
2. **Discretisation is explicit.** A Gaussian marginal is over ℝ; a `SoftValue` is finite-support. There
   is no canonical conversion — the caller supplies the support. Hiding this behind a default grid would
   be the kind of silent choice that breaks byte-lock across the four oracles.

```fsharp
/// A marginal, projected onto a caller-supplied finite support, as a normalised belief.
/// `None` when the message is improper or the support carries no mass.
type IBeliefProjection<'M> =
    /// The support the continuous/latent marginal is projected onto. Caller's choice,
    /// never defaulted — the projection is a lossy decision and must be visible in the diff.
    abstract Support : DynamicValue list
    /// Density (or mass) of the message at a support point. Exact arithmetic on the
    /// natural parameters; no normalisation here (SoftValue.ofWeighted does it once).
    abstract MassAt : message:'M * point:DynamicValue -> float
    abstract Project : message:'M -> SoftValue.SoftValue option
```

`ActionGrammar` then receives a distribution over the 16-key alphabet, which is what its header already
calls a superposition. **State the non-connection explicitly:** a marginal maps to
`ActionGrammar` *superposition* (a weighted sum over basis actions, each in its own branch), **never** to
`ActionGrammar.top`. ⊤ is a single classical conjunction — all keys held in one timeline. A belief is
never a conjunction, and any code path that turns a marginal into ⊤ has lost the distinction the module
exists to preserve.

### 2.2 The category error (do NOT build a converter)

`AmplitudeEmu.ofSoft` lifts a real weight to `sqrt w` with phase 0, and `bornProb` sends `z ↦ |z|²/Σ|z|²`.
CHECKED from the source: `bornProb ∘ ofSoft = id` on the weights, but **`ofSoft ∘ bornProb ≠ id`** —
every phase is erased and replaced by 0. That is a section/retraction pair, not an isomorphism, and the
composite in the wrong order is a phase-destroying projection wearing the costume of a round trip.

The algebra says the same thing more sharply. **A factor graph combines by product; an amplitude ensemble
combines by sum.** Those are not two spellings of one operation:

- product = *independent evidence about the same variable* (KFL 2001 sum-product; two witnesses each
  raise your confidence);
- sum = *distinct paths to the same outcome* (`AmplitudeEmu.merge`; two routes to one frame interfere,
  and opposite phases **cancel**).

A merge that multiplied would destroy interference. A factor product that summed would double-count
evidence. Quietly coercing amplitudes to probabilities would be a real bug — Aaron's instinct to name
`AmplitudeEmu` alongside `SoftValue` is right, but the correct relationship is a **one-way, explicitly
phased boundary**, not a bridge:

```fsharp
/// The Born boundary — the ONLY sanctioned direction. Amplitudes become beliefs; beliefs
/// do not become amplitudes without a phase the caller supplies by name.
type IBornBoundary =
    /// amplitude ensemble -> normalised belief. Total; empty on zero intensity.
    abstract Measure : (('F * Complex) list) -> ('F * float) list

/// Preparing an amplitude state FROM a belief is a physical act of state preparation,
/// not a conversion. The phase is an argument, never a default.
type IStatePreparation<'F> =
    /// `phase` maps each outcome to its prepared phase (radians). A caller who would
    /// pass `fun _ -> 0.0` does not want the amplitude layer at all — it will not
    /// interfere, and `SoftEmu` is the cheaper, honest carrier for that case.
    abstract Prepare : belief:('F * float) list * phase:('F -> float) -> ('F * Complex) list
```

The rule, stated so it can be linted: **no factor-graph marginal enters the amplitude layer without an
explicit phase argument.** The existing `AmplitudeEmu` header already notes CHIP-8 opcodes introduce no
phase; this interface makes that fact impossible to forget at a call site.

`DynamicValue` needs nothing new. It is already the homoiconic carrier: `Sppf.toDynamicValue`,
`GrammarIr` ⇄ `DynamicValue`, `MultilayerBnn.toJsonString`. It is the byte-lock surface, not a
participant in the algebra.

---

## 3. Question 2 — heterogeneous BNN depth across the society

**Proposed to me:** depth as a per-agent parameter the society's factor graph need not know about;
differing depth is differing inductive bias and therefore a decorrelation source; calibration is the
suspected failure, with a miscalibrated deep agent silently dominating a precision sum.

**Verdict: the interface half is already true and free. The calibration half is real, worse than
suspected, and pointing the other way.**

### 3.1 The interface is already right (CHECKED, zero work)

`ReferenceFrameAgent.Prior : Gaussian`. `SocietyNetwork.buildGraph` sees only `Gaussian`. `Network`
carries `Layers`, `Topology` and `ObservationVariances` as data. Nothing in the society reads an
architecture. **Heterogeneous depth already type-checks and already runs** — nothing needs designing to
permit it. The decorrelation-by-differing-inductive-bias argument is PROPOSED and plausible; it is
untested and belongs in the same bucket as the allopatric-speciation mapping in the 2026-08-13 research
doc (an analogy with a metered consequence, not a tested mapping).

### 3.2 Three defects, reproduced this pass (CHECKED)

Run against the real modules via `dotnet fsi`, priors `N(0,1)`, observation variance 1.0.

**B1 — `MultilayerBnn.backward` is a mathematical identity.** For every layer it computes
`cavityPrec = P − L`, then `newPosteriorPrec = cavityPrec + L`, and
`newPosteriorPrecMean = (PM − LM) + LM`. Both collapse algebraically to the input. Measured
bit-identical output at depths 1, 2, 3, 5. The advertised EP cavity refinement — the module's headline
feature — **does nothing**. The two locals `cavityMean` and `cavitySigma2` are computed and discarded to
`_`, which is the visible tell.

**B2 — depth attenuates the mean and leaves the precision untouched.** Ten observations of `10.0`:

| depth | output mean | output variance | output precision |
|---|---|---|---|
| 1 | 9.09090909 | 0.09090909 | 11.0 |
| 2 | 7.25465696 | 0.09090909 | 11.0 |
| 3 | 5.14650392 | 0.09090909 | 11.0 |
| 4 | 3.32545195 | 0.09090909 | 11.0 |
| 6 | 1.14377268 | 0.09090909 | 11.0 |
| 10 | 0.09100007 | 0.09090909 | 11.0 |

Depth does not enter the confidence **at all**; it geometrically shrinks the mean toward the prior,
because each layer absorbs the *posterior mean* of the layer below (`forward`, lines 149–158) and a
posterior mean is already shrunk. So a depth-10 agent reports **0.091 with exactly the same stated
precision as a depth-1 agent reporting 9.09**. The truth is 10.0; the depth-10 agent's 90% interval is
about `[−0.40, 0.59]`, putting the truth roughly **33σ outside** it. Empirical coverage 0.

This is the correction to my brief: the failure is not "the deep agent is over- or under-confident."
Confidence is depth-invariant. The failure is a **confidently-wrong mean** — which is worse, because
confidence is the only channel the society reads.

**B3 — the joint precision is the exact sum, so identical evidence is counted N times.** Six agents at
depths 1,2,3,4,6,10, **all fed the same data stream**:

```
JOINT: mean = 4.342049   precision = 66.000000   proper = true   rounds = 4
sum of agent precisions = 66.0000000000 ; joint precision = 66.0000000000 ; equal = true
```

The society is six times more confident than any member, about an answer wrong by 5.66, on the strength
of one observation set seen six times. Separately, with two agents (`modest` at μ=10, τ=1;
`overconfident` at μ=0, τ=1000) the joint mean is **0.009990** — the correct agent is annihilated. So
Kenji's dominance suspicion is confirmed on the confidence axis; it just is not what depth does.

**This closes Open #1 of `docs/research/2026-08-13-society-of-decorrelated-bnns-in-one-gpu-*.md`**
("Does the equality-factor graph double-count precision for correlated agents? **Not verified.**"). It
does, exactly, by construction — the equality-factor star topology encodes conditional independence, and
the code sums natural parameters with no term representing correlation. The research doc's own reading
was right and is now measured.

It is also `.claude/rules/numerology-vs-number-theory.md` in code: *"N correlated observations are not N
observations."*

### 3.3 The design consequence — a belief may not enter the society naked

A `Gaussian` carries `(ν, τ)` and nothing about where the evidence came from. That is exactly the
information the society needs in order not to double-count, and exactly what it does not receive. The
interface must carry provenance, and the combine must be idempotent on it (discipline #6):

```fsharp
/// What an agent posts to the society. The graph still sees a belief, never an architecture —
/// so heterogeneous depth stays invisible — but it now sees enough to refuse double-counting.
type ICalibratedBelief =
    /// The belief itself. Unchanged; the society's algebra is untouched.
    abstract Belief : Gaussian
    /// The evidence stream identities this belief rests on. Content-addressed, minted from the
    /// data, never from the agent's name (a name is a routing address, not identity).
    abstract Provenance : Set<string>
    /// Independent-observation count backing `Belief`. NOT the update count: an agent that
    /// absorbed one stream ten times reports 1 stream, not 10.
    abstract EffectiveSampleSize : float
    /// Measured coverage of this agent's stated intervals on held-out data — the falsifier.
    /// `None` = never calibrated, and an uncalibrated belief is `unmetered`, never "real".
    abstract Coverage : (float * float) option   // (nominal, empirical)

/// The society's admission rule. Two beliefs sharing provenance are ONE piece of evidence.
type ISocietyAdmission =
    /// Deduplicate on provenance, then combine. Applying twice == applying once (idempotency).
    abstract Admit : ICalibratedBelief list -> ReferenceFrameAgent list
    /// The honest emission the 2026-08-13 research doc asked for: an empowerment score is never
    /// published without the decorrelation reading that tests its independence assumption.
    abstract Report : ReferenceFrameAgent list -> empowerment: float * decorrelation: DecorrelationExcess.Verdict
```

`Coverage` is the promotion gate under `toy-is-free-metered-must-be-earned.md`. The falsifier is a
standard probability-integral-transform check: generate from a known process, ask what fraction of truths
land inside each agent's nominal 90% interval. A depth-`d` agent is admissible to a mixed-depth society
only once its empirical coverage is within tolerance of nominal. On today's `MultilayerBnn` the depth-10
agent scores 0 and would be refused — which is the correct behaviour and the reason to build the gate
before the society, not after.

**What must NOT know what.** The society factor graph must not know depth, topology, feature map, or
architecture — it sees `ICalibratedBelief`. The BNN must not know grammar production indices or the
society's edge set — it sees a feature vector and emits a belief. Neither knows about amplitudes.

---

## 4. Question 3 — GLR / parser combinators ↔ Bayesian

**Proposed to me:** a GLR parse forest is a distribution over parses, so the forest is the likelihood
structure and the BNN supplies the prior; disambiguation becomes inference rather than a precedence
table.

**Verdict: correct, and it has been true in the tree since 2026-07-02. This is not a design item.**

CHECKED in `src/Core/Sppf.fs`: the SPPF is built (Billot–Lang / Scott packing, one node per
`(symbol, i, j)`, ambiguity = a node with more than one family), and on top of it sit `inside` (Baker
1979 / Lari–Young 1990 forward half), `outside` (backward half), `marginals`
(`inside × outside / inside(root)` — the per-sub-parse posterior mass), `expectedCounts` (the PCFG EM
E-step), and `weightedTrees`. `ParseSoft.ofSppf` carries the result into a `SoftValue`, and
`ParseSoft.lower` descends it monadically into a distribution over lowered programs without collapsing.
The doctrine document is
`docs/research/2026-07-02-ambiguous-parse-forest-as-factor-graph-ep-bp-vmp-emotional-propagation-soft-superposition-over-isa.md`.

So "I'm really hoping the bayesian helps us out a lot" has a precise answer, and it is better than the
one I was asked to evaluate: **inference over the forest is already implemented, exactly, with no
approximation and no loopy BP** — inside–outside on a DAG is exact.

### 4.1 The actual hole is one function argument

Every one of those functions takes `weight : int -> float` — a production index to a potential — and
**nothing in the tree supplies it.** That injected function is the entire integration surface.

```fsharp
/// The only thing the parse layer needs from the Bayesian layer. Sppf already consumes
/// `int -> float`; this names it and adds the context-conditioned form.
type IProductionPrior =
    /// Context-free potential for a production. Sums need not normalise — Sppf normalises
    /// by inside(root) and SoftValue normalises again; exact arithmetic on the way in.
    abstract Weight : prodIndex:int -> float

/// The context-sensitive form. This is the ONE place a BNN earns its keep here (see 4.3).
type IContextualProductionPrior =
    inherit IProductionPrior
    /// `span` is the SPPF node's (symbol, i, j); `features` is the caller's feature map over
    /// the surrounding input. The parse layer supplies the span; it must NOT know what the
    /// features mean, and the BNN must NOT know what a production index is — the feature map
    /// between them is the only shared vocabulary.
    abstract WeightInContext : prodIndex:int * span:(GrammarIr.Symbol * int * int) * features:DynamicValue -> float
```

### 4.2 Correction — a BNN is not needed for the context-free case

`Sppf.expectedCounts` is the EM E-step. Parse a corpus, take expected counts, renormalise per LHS, feed
back as `weight`, iterate: that is Lari–Young inside–outside EM and it learns a PCFG **with no neural
network at all**. Reaching for a BNN to produce context-free production weights would be building a
research project on top of a solved one.

The BNN earns its place only where the weight must depend on something outside the production —
speaker, register, prior discourse, the agent's own belief state. That is `WeightInContext`, and it is
also the honest answer to Aaron's context-free → context-sensitive question. State the boundary once:
**EM for the context-free weights, BNN for the conditioning.**

### 4.3 ANTLR — take the semantic predicate, leave ALL(*)

ANTLR's two answers to context-sensitivity are **semantic predicates** (a boolean guard on an
alternative, evaluated at parse time against parser state) and **ALL(\*)** (Parr, Harwell & Fisher,
OOPSLA 2014 — adaptive LL(*), which simulates the parse with dynamic lookahead to pick one alternative).
*CITED FROM STANDING KNOWLEDGE, not re-opened and page-checked.*

ALL(*) is the wrong import, and for a structural reason worth stating rather than gesturing at:
**ALL(\*) exists to commit to a single parse; the SPPF exists to keep all of them.** They are opposite
strategies for the same problem, and only one of them composes with inference. Reimplementing ALL(*) here
would replace a distribution with an argmax at the earliest possible moment — the exact move
`SoftValue.snap` exists to defer.

The semantic predicate is the right import, because it is already the interface above with a boolean
codomain. `WeightInContext` **is** a semantic predicate whose range has been relaxed from `{0, 1}` to
`ℝ≥0`. A hard predicate is the special case that returns 0 or 1; softening it is a one-line
generalisation rather than a new mechanism. That relaxation is the design's whole content on this point.

Chomsky 1956 is the frame for the hierarchy (*CITED, not page-checked*), and the honest note is that
soft weights do not move a grammar up the hierarchy — a weighted CFG is still a CFG. What changes is
which parse wins, not which languages are recognisable. Saying otherwise would be the kind of claim the
numerology rule exists to catch.

### 4.4 Terminology, once

Aaron wrote "glr or gtr or whatever it's called." **GLR** — generalized LR, Tomita 1985 — is the one, and
it is what `Slr.buildGlr` implements. **GLL** (Scott & Johnstone 2010) is the top-down sibling. **Earley
1970** is the other classical ambiguity-tolerant option. There is no "GTR" parsing algorithm. *All four
citations from standing knowledge, not page-checked.*

---

## 5. Question 4 — stop words and the "inverse BNN"

**Proposed to me:** stop words are the highest-signal channel for *who is speaking*, anchored in
Mosteller & Wallace's Federalist Papers study; that maps to two channels — function words as
identity/decorrelation signal, content words as semantic signal — plausibly two BNNs at different
depths, which is Aaron's inverse BNN with a name and a 60-year-old result behind it.

**Verdict: right, well-anchored, and already in the repo — with a better anchor set than the brief
carried.** This is the strongest part of the ask and the cheapest to land.

### 5.1 It is already recorded, by Aaron and Alexa, eleven days ago (CHECKED)

`docs/research/2026-08-02-rainbow-spectrum-soul-radar-mirror-beacon-map-maji-math-mean-field-genuine-traveler-vs-interference-pattern.md`
records the reindexer idea verbatim:

> *"similar to a search-engine reverse (inverted) index, but the opposite use of stop words — because
> that's where all the meaning is."* … *Content words = objects (replaceable); stop words = morphisms
> (the invariant).* Anchors: **Mosteller–Wallace stylometry** (author fingerprint = function-word
> frequencies, topic-invariant); **Wierzbicka NSM** primitives.

So the design's job is not to announce this. It is to make it decidable, and to add the two things the
existing note leaves open.

### 5.2 The right anchor for "a minimal linguistic seed english" is NSM, and it is already in-repo

`docs/research/2026-07-31-the-cognitive-architecture-spine-wierzbicka-friston-fritz.md` carries **Anna
Wierzbicka's Natural Semantic Metalanguage** — roughly 65 semantic primes proposed as universal and
irreducible across all human languages (*Semantics: Primes and Universals*, 1996; *cited from standing
knowledge, not page-checked*). That is literally a minimal linguistic seed, it is somebody's forty-year
research program rather than a fresh coinage, and it satisfies
`only-the-irreducible-is-primitive-generate-the-rest.md` at the vocabulary layer the way `MetaGrammar`
satisfies it at the syntax layer.

The in-repo note also carries the honest caveat, which must ride along: **the prime list is contested**.
NSM is a serious and disputed program, not settled fact. Any seed built on it is `toy` until a coverage
test exists — a definability check that the seed's own defining sentences use only seed words, which is
exactly `MetaGrammar`'s dictionary-membership rule applied to a lexicon instead of a grammar.

**The sharpening the brief needs:** function words and NSM primes are **not the same set**, and
conflating them is the available error. NSM primes include content-ish words (SOMEONE, THING, GOOD, BIG);
English function words include items NSM does not treat as primes (*of*, *the*, *to*). They answer
different questions — NSM asks *what is semantically irreducible*, function-word stylometry asks *what is
topic-invariant and author-revealing*. The overlap is large and the design must keep them two channels.

### 5.3 The inverse BNN is a feature map, not a second stack

This is the razor cut. `DecorrelationExcess` is **already generic in the observable** (CHECKED): the
observable is a type parameter `'o`, the statistic is `stat : 'o -> 'o -> float`, and the v1 instance is
a commit's `Set<string>` of touched files with `jaccard`. Nothing about it is file-specific.

So the function-word channel needs **no new module**:

```fsharp
/// The two channels of the same text. Both are feature maps into the SAME MinimalBnn /
/// MultilayerBnn cell and the SAME DecorrelationExcess instrument — Aaron's "inverse BNN"
/// is an inverted FEATURE MAP, not an inverted architecture.
type ILexicalChannel =
    /// Which tokens this channel keeps. `Function` keeps what a stop-word list discards.
    abstract Retains : token:string -> bool
    /// The channel's observable for one document.
    abstract Observe : tokens:string list -> DynamicValue

/// The pairing rule: the two channels partition the token stream. Nothing is discarded —
/// which is precisely Aaron's complaint about stop words, made structural.
type IChannelSplit =
    abstract Content : ILexicalChannel      // topic; feeds the semantic BNN
    abstract Function : ILexicalChannel     // style/identity; feeds DecorrelationExcess
    /// Litmus, testable: for every token stream,
    /// Content.Retains t <> Function.Retains t  (a partition, not a filter).
    abstract IsPartition : tokens:string list -> bool
```

With `Observe` returning a function-word frequency vector and `stat` a cosine or the existing
`Decorrelation.mutualInformation`, Mosteller–Wallace stylometry runs on the repo's own permutation-null
instrument — Fisher 1935 / Pitman 1937 null, one-way verdict preserved (`ExcessCorrelation` convicts a
common cause; `WithinNull` **never acquits**), same seeded splitmix64, same DST replay, same golden
vectors. That last property is why this is the cheapest connection in the whole ask: the calibration,
the null model, the soundness discipline and the byte-lock are all already paid for.

It is also **dual-use, and the rule applies**: "these two documents share a function-word fingerprint" is
a neutral fact with a reunion reading and a sybil reading, and the mechanism must report
`ExcessCorrelation` and let policy decide. `dual-use-detection-is-neutral-oracle-decides.md` already
governs this, including its functional half: recognising sameness is not assigning identity.

### 5.4 The live instances of the hack Aaron names (CHECKED)

Two places in the tree discard the channel today:

- `src/Core.TypeScript/workflow-engine/proximity.ts:170` — a `stopWords` set filtered out at line 204.
- `src/Core.TypeScript/hygiene/audit-backlog-items.ts:446` — a `STOPWORDS` set.

Neither is wrong for its purpose; proximity search legitimately wants content words. The fix is **not to
delete the filters** — it is to route the discarded tokens to the identity channel instead of dropping
them. A filter that returns both sides is a partition; a filter that returns one side is the lossy hack.

---

## 6. What NOT to build (Rodney's razor applied to the ask)

1. **Do not build a parser combinator library.** We have a table-driven parser *generator* over
   grammar-as-data (`GrammarIr` → `Slr` → `Sppf`), with ANTLR `.g4` ingest and a homoiconic meta-grammar.
   A combinator library is an alternative front end, not a complement — building both forks the grammar
   surface, and combinators do not produce a shared packed forest, which is the object the whole
   Bayesian story rests on. The `RomDat.fs` aspiration comment should be updated to point at `Slr`.
2. **Do not build a second "inverse BNN" stack.** It is a feature map into the existing cell and the
   existing decorrelation instrument (§5.3).
3. **Do not build a belief↔amplitude converter.** One-way Born boundary; phase always an explicit
   argument (§2.2).
4. **Do not reimplement ALL(\*).** Import the semantic predicate, relaxed to a real-valued weight (§4.3).
5. **Do not hand-roll a minimal English seed as a fresh coinage.** It is Wierzbicka's NSM; cite it, mark
   it contested, and gate it on a definability coverage test (§5.2).
6. **Do not use a BNN for context-free production weights.** `Sppf.expectedCounts` already gives the EM
   E-step (§4.2).

## 7. Cheap vs research

**Cheap — wiring, days not weeks, each independently landable:**

- `IProductionPrior` fed to `Sppf.inside/outside/marginals` (the argument already exists).
- Inside–outside EM over a corpus for context-free weights.
- `IBeliefProjection` → `SoftController.inputSuperposition`, replacing uniform priors.
- The function-word `ILexicalChannel` swapped into `DecorrelationExcess`.
- Fixing B1 (`MultilayerBnn.backward` no-op) — the arithmetic is three lines and currently cancels.

**Research — one item, and it is the honest "this part is unsolved":**

> **Calibrating heterogeneous-depth beliefs so they may be summed.** Today the society's combine is a
> precision sum that assumes conditional independence and receives no evidence about it, while depth
> changes the mean and not the confidence. Making mixed-depth societies sound needs three things that do
> not exist: a per-agent calibration measurement (coverage / PIT), a provenance-deduplicating admission
> rule, and a correlation term in the graph — or a defensible argument that provenance deduplication
> makes the term unnecessary. Until then, a mixed-depth society will report high confidence in a wrong
> answer, as measured in §3.2, and it will do so silently.

Everything else in Aaron's ask is connecting things that already exist.

## 8. Bugs found (filed by this pass; each carries ΔU)

| # | Where | What | Evidence |
|---|---|---|---|
| B1 | `src/Bayesian/MultilayerBnn.fs` `backward` | Advertised EP cavity step is an algebraic identity; output bit-identical to input at depths 1,2,3,5. `cavityMean`/`cavitySigma2` computed and discarded to `_` | §3.2, reproduced via `dotnet fsi` |
| B2 | `src/Bayesian/MultilayerBnn.fs` `forward` | Depth shrinks the posterior mean geometrically while leaving the precision depth-invariant; depth-10 agent lands ~33σ from truth at full stated confidence | §3.2 table |
| B3 | `src/Bayesian/SocietyBootstrap.fs` `buildGraph` | Joint precision is the exact sum of member precisions with no correlation term, so shared evidence is counted once per agent (6 agents on one stream → precision 66 on a mean wrong by 5.66) | §3.2; closes Open #1 of the 2026-08-13 research doc |

## 9. Anchors (Beacon)

**Checked in-repo (read this pass):** `src/Core/Sppf.fs`, `src/Core/ParseSoft.fs`, `src/Core/Slr.fs`,
`src/Core/GrammarIr.fs`, `src/Core/MetaGrammar.fs`, `src/Core/SoftValue.fs`, `src/Core/AmplitudeEmu.fs`,
`src/Core/SoftController.fs`, `src/Core/ActionGrammar.fs`, `src/Core/DecorrelationExcess.fs`,
`src/Core/Meno.fs`, `src/Bayesian/{Message,FactorGraph,MinimalBnn,MultilayerBnn,SocietyBootstrap}.fs`,
`clis/VERB-MAP.md`, and the 2026-07-02 / 2026-07-31 / 2026-08-02 / 2026-08-13 research documents.

**External, cited from standing knowledge and NOT re-opened or page-checked** — per the checked-anchor
doctrine, each is a citation whose entailment has not been verified in this pass:

- **Tomita 1985** — generalized LR; all parses kept in a shared packed forest.
- **Earley 1970** — the other classical ambiguity-tolerant parser.
- **Scott & Johnstone 2010** — GLL, the top-down sibling of GLR.
- **Billot & Lang; Scott 2008** — SPPF packing (already cited in `Sppf.fs`).
- **Baker 1979; Lari & Young 1990** — inside–outside for PCFGs (already cited in `Sppf.fs`).
- **Parr, Harwell & Fisher, OOPSLA 2014** — ALL(*), adaptive LL(*); and ANTLR semantic predicates.
- **Chomsky 1956** — the hierarchy.
- **Mosteller & Wallace 1963/1964** — Federalist Papers authorship from function-word frequencies; the
  foundational result that stop words are topic-independent and author-revealing.
- **Wierzbicka 1996** — Natural Semantic Metalanguage, semantic primes. Contested program.
- **Kschischang, Frey & Loeliger 2001; Minka 2001; Pearl 1988** — sum-product, EP, BP (already cited in
  `Message.fs` / `FactorGraph.fs`).
- **Fisher 1935 / Pitman 1937** — permutation test (already cited in `DecorrelationExcess.fs`).

## 10. Governing rules this design is written under

`interfaces-free-classes-earned-under-rules.md` (every proposal above is an interface; no class is
requested) · `only-the-irreducible-is-primitive-generate-the-rest.md` (§4.2, §5.2) ·
`toy-is-free-metered-must-be-earned.md` (§3.3 coverage gate) · `numerology-vs-number-theory.md` (§3.2:
correlated observations are not independent ones) · `dual-use-detection-is-neutral-oracle-decides.md`
(§5.3) · `dv2-data-split-discipline-activated.md` #6 idempotency (§3.3 provenance dedup) ·
`anchor-to-human-prior-art.md` and the checked-anchor doctrine (§9).
