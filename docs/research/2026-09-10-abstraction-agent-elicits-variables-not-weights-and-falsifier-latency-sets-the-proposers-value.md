# The abstraction agent elicits VARIABLES, not weights — and the falsifier's latency sets the proposer's value

**Work item:** 081M26HZ7Y2087G0R002CGC4TB
**Date:** 2026-09-10
**Register:** mixed. Every claim about the paper is `reported` (secondary source, see §0).
The mapping onto Zeta's factor-graph substrate is `toy` — nothing is built. The worked
instance in §4 is `metered` — it happened today, with a named falsifier and a measured latency.

---

## 0. What this is a reading OF, and what it is not

Source: `docs/ip-questionable/2026-09-10-abstraction-agent-llm-invents-variables-tsinghua-video-transcript.md`
— a machine-captioned YouTube explainer of a preprint attributed in the talk to Tsinghua
University, dated in the talk 2026-09-07.

**The transcript never states the paper's title or its authors.** I have not read the paper.
So every sentence below of the form "the paper does X" means **"the talk says the paper does
X"** and inherits the talk's error bars, which include the speaker's own illustrations being
mistaken for the paper's content. The rover example in particular reads as the speaker's
teaching device. Treat this document as a reading of a reading, and do not cite it as
evidence about the preprint.

That caveat is not throat-clearing. The interesting content here is a **loop shape**, and a
loop shape survives a lossy channel; a result does not.

---

## 1. The loop, stated as a shape

1. An LLM reads a **verbal specification** of a domain — a rule book, a manual, a protocol.
2. It proposes a small set of **candidate continuous variables** that it claims describe the
   dynamics of that domain.
3. Each variable gets **calibration anchors** — extremal reference points fixing what a score
   on that axis means.
4. The LLM **scores every state** against those fixed anchors, producing a feature vector.
5. Variables with **no variation** are dropped. Variables **highly correlated** with another
   are dropped.
6. What survives is standardised and **clustered**; a cluster is treated as one abstract state.
7. A **conventional numerical solver** consumes that state space and computes. Whether the
   abstraction was any good is judged **by the solver's output**, not by the LLM.
8. Counter-examples from the solver can be fed back, and the LLM revises the coordinates.

The LLM's job in this loop is **not** to produce an answer. It is to produce a **coordinate
system**. Everything after step 2 is ordinary, cheap, inspectable numerics that a human can
read in an afternoon.

---

## 2. What Aaron was avoiding, and why this shape is not it

Aaron, ferrying the transcript:

> *"this is very close to what i'm trying to automate, it's taking LLM weight and turning them
> into parameters of a smaller math model, i was trying to avoid this but many things keep
> pointing back to this as a good way for AI plus human interaction to design the old school
> 'expert systems' or bayesian like EP/BP with expert priors jointly."*

**The thing worth separating is that this loop is not distillation, and the difference is
exactly the property he has been protecting.**

| | **distillation** | **elicitation** (this loop) |
|---|---|---|
| what moves out of the big model | numeric weights | the *names and definitions of the axes* |
| the small model is | fitted, opaque | written, inspectable |
| can a human disagree with it? | only by disagreeing with its outputs | **yes, per axis, before any data** |
| can it be audited without the big model? | no | **yes — the axes are text** |

The repo already carries the test that separates these, and it is not about accuracy:

> **A good meter is one anyone can inspect and agree to the rules of.**
> — `dual-use-detection-is-neutral-oracle-decides.md`

A distilled small network **fails** that test however accurate it is: its rules are weights,
and nobody agrees to weights. An elicited state space **passes** it: the axes are sentences,
the anchors are stated numbers, the pruning rules are two lines of arithmetic. The judgement
crystallises **once, in text**, which is the same property that lets the four-oracle byte-lock
count as a meter at all.

So the honest answer to *"I was trying to avoid this but it keeps coming back"* is: **what you
were avoiding was distillation, and this is the other thing.** It keeps coming back because it
is the version that survives the inspection requirement you already hold everything else to.

**One thing it inherits that distillation does not:** the axes are only as good as the LLM's
domain knowledge, and a wrong axis is *fluent*. §4 is a worked instance of exactly that.

---

## 3. Every pruning step in the loop is a rule already carved here

This is the part that made the shape worth writing up. The paper's numerics are not new
mathematics; they are **this repo's discipline, executed arithmetically.**

| step in the loop | the carved rule it is |
|---|---|
| drop variables with **no variation** | **the vacuity class.** An axis every state scores the same on is a coordinate that cannot discriminate — a check that cannot fail, wearing a number. `toy-is-free-metered-must-be-earned` |
| drop **highly correlated** variables | *"too many correlations is a warning, not a confirmation signal … N correlated observations are not N observations."* `numerology-vs-number-theory` — the same move, done to axes instead of to beliefs |
| validate **only** via the downstream solver | *"every model is a toy until it acquires a falsifier."* A proposed axis is `toy`; **the solver IS the falsifier**, and it is the only thing licensed to promote it |
| keep the axis that **preserves the distinction** | **sufficiency.** The rover mean is a sufficient statistic for "average performance" and *not* for "which rover on a volcano" — Fisher (1922). Which question you are asking decides which statistic is enough |
| the anchors travel with the axis | **anti-Babel.** A score with no anchor is a private vocabulary: two runs' "0.7 on terrain-dependence" are incomparable. The anchors are what make a coinage reconstructible by a peer holding only shared references |
| clustering into abstract states | **DV2.0 satellite partitioning** — group by what changes together, address the group once |

And the rover example, which is the talk's clearest moment, is **the raw-vault sentence stated
as geometry.** Two rovers both average 6; a generalist and a volcanic specialist. Collapsing
them to one number is *a merge that produced one surviving value*, which
`dv2-data-split-discipline-activated` calls a collapse, not a merge:

> **A single version of the FACTS, never a single version of the TRUTH.**

Adding the terrain-volatility axis is not a cleverer average. It is **holding both branches
with their paths recorded** — which is what the rule has said all along, and what nobody had
yet said in the language of coordinates.

**The one rule the loop does NOT satisfy on its own, and the guard it needs.** An LLM that
proposes an axis also *names* it, and a name carries an oracle. An axis called `aggression`
has pre-judged; `variance of payoff across revealed terrain` has not. The failure mode is on
file, in the rule itself:

> *"the oracle did not get in by argument; it got in through a word choice nobody re-read."*

**Guard, if this is ever built here: a proposed variable must be named by its computation, not
by its interpretation.** That is checkable by a reviewer in one pass and cannot be checked by
the solver, because the solver never reads the names.

---

## 4. A worked instance from the same day — with a measured falsifier latency

The loop was run by hand today, on Max's PR #17249, with no LLM-proposes-variables framing in
mind at the time. It is recorded here because it is `metered` and because it exposes the
variable the paper's own framing hides.

The question was *why does CodeQL flag this line?* The proposals, in order, and their fate:

| # | proposed variable ("what this alert is about") | verdict | refuted by |
|---|---|---|---|
| 1 | the **shape of the regex** — naming `\r\n` explicitly would satisfy it | **refuted** | local CodeQL CLI, alert survived at `rules_count: 103` |
| 2 | the value being **free text** rather than structured | **refuted** | same |
| 3 | **which binding the barrier applies to** — the value that *continues* on the continuing branch | **survived** | the fix held, locally and in CI |

Variable 3 is the one that determined the dynamics, and it is not the one a fluent reading of
the alert text suggests. Proposals 1 and 2 were confident, plausible, and wrong; each cost a
commit. **A local falsifier at ~4 seconds made that affordable.** Against CI-only feedback the
same three-hypothesis search costs three full gate runs.

**This yields the design consequence I think is the real result, and the paper does not state
it.** The talk reports that the method *"only works with really powerful LLMs"* and reads that
as a statement about model capability. The instance above suggests a different variable:

> **The value of an LLM proposer is bounded by the falsifier's latency, not by the proposer's
> quality.** A cheap, fast falsifier makes a mediocre proposer productive, because wrong
> proposals are discarded before they cost anything. An expensive falsifier makes even a good
> proposer unaffordable, because you cannot run enough of them to find the one that survives.

That is falsifiable, and cheaply: hold the proposer fixed, vary only the falsifier's latency,
and measure hypotheses-tried-per-hour and time-to-surviving-variable. Register: `toy` — the
claim is argued from one instance, not measured across a range.

It also lands directly on the thread Aaron opened earlier today about audit-vs-time-to-commit
and splitting into smaller self-contained repos. Under this reading, **shortening the gate is
not only a cost saving — it raises the value of every LLM proposal the fleet makes**, because
the search width you can afford is set by the falsifier, not by the model. The measured gate
composition from earlier today (dotnet matrix 44.2%, wall-clock floor 1087s on `macos-26`)
is the current ceiling on that width.

---

## 4a. Aaron's own position, and why it is a different claim from §4

Under the video, a commenter argued the whole approach is misconceived — *"the model has a
design flaw and currently everyone is constantly compensating for it. Changing the model design
fixes that … the harness codebase should be reduced by 90 percent."* Aaron replied
(`@AceHack00`, 2026-09-10, ferried in the transcript file):

> *"Changing the model design seems irrelevant for this problem; it's turn-based. What's needed
> is model context design and model context window compression that keeps long-running context
> and ontologies. We should try to come up with an ontology reduction over either model or
> harness upgrades."*

**Three things in that are worth separating out.**

**(1) "It's turn-based" is the load-bearing observation, and it is a structural argument, not a
preference.** In a loop where a model proposes and a solver disposes, a model upgrade improves
what happens *inside* one turn. It does nothing whatsoever for what **crosses the boundary
between turns** — and in this loop that boundary is where the entire product lives, because the
product is a set of axes that has to survive to the next turn to be worth anything. So the
architecture of the proposer is, for this problem class, the wrong variable to optimise. That
is the same move as §4's, arrived at independently and by a different route: both say *the
binding constraint is not the model*, and they disagree about what it is instead.

**(2) It reframes what the paper is.** Read Aaron's way, the elicited state space is not
primarily a solver input. It is an **ontology reduction**: a rule book compressed to a handful
of named axes with stated anchors. That object has exactly the three properties a
context-window-bound agent needs — it fits in any window, it is stable across turns, and it is
transferable to another agent — and the solver's role is to keep the compression **honest**,
which is the part every other context-compression scheme lacks. Under this reading the
contribution is not state-space geometry at all. It is **lossy context compression with a
falsifier attached.**

**(3) The two-option framing was the actual error, and Aaron's reply is the third path.** The
argument on offer was *fix the model* versus *shrink the harness*. Both locate the problem in a
**substrate**. Aaron relocates it to the **representation** — which is his standing move, and
the reason it is worth recording rather than agreeing with in passing.

**Where his claim and §4's come apart — held separately, not merged.**

| | claim | what it buys |
|---|---|---|
| §4 (mine) | **falsifier latency** bounds a proposer's value | how *cheaply* you can find a good axis |
| §4a (Aaron's) | **ontology reduction** beats model or harness upgrades | whether you have to find it **again** |

These are complements, not the same sentence, and stating them as one would lose the useful
part. A fast falsifier with no retention re-derives the same axes every session and pays the
search repeatedly; perfect retention with a slow falsifier cannot validate a *new* axis when
the domain moves. Together they are the ratchet Aaron already carved elsewhere — *"a superagent
routes the next same task to less intelligence"* — with an **elicited, retained axis as the
ratchet artifact**: it is a written thing that removes work the next run would otherwise redo.

**And the falsifier for his claim is that this repository has been running it for months.** The
carved-sentence discipline is not an analogy for ontology reduction; it *is* ontology reduction
aimed at exactly the boundary he names:

> *"Anything auto-loaded at context startup is a carved sentence + pointers, not an essay …
> a startup-loaded surface states only what an agent must hold to act, in 1–3 sentences."*
> — `rules-are-small-carved-sentences-pointing-to-docs`

Same for the `MEMORY.md` hub (210KB / 399 entries → ~1.5KB of pointers), the `CURRENT-*.md`
fast path, and the DV2.0 hub/satellite split that governs both. So the position is not a
speculation about what someone should build. It is a description of a substrate that exists,
offered to a thread that was arguing about model weights — and it makes the claim **testable
here**, because the fleet has the before/after: hold model and harness fixed, change only what
crosses the turn boundary, and measure. Register: `toy`; nobody has run that comparison, and
the confound (model versions changed underneath) is real.

---

## 5. Where it plugs into what is already built here

The EP/BP substrate Aaron names already exists, and is not a stub:

- `src/Bayesian/FactorGraph.fs` — bipartite variable/factor structure, sum-product
  (Kschischang–Frey–Loeliger 2001), generic over the message family.
- `src/Bayesian/Ep.fs` — expectation propagation as a **factor type**, cavity → tilt →
  project → divide (Minka 2001; probit site cross-checked against quadrature in tests).
- `src/Bayesian/SignedProbitEp.fs`, `src/Core/TravelerRankLedger.fs` — TrueSkill-style EP over
  (traveler × hat-domain), Herbrich–Minka–Graepel 2006.

**What does not exist is a structure proposer.** Measured: every factor graph in the tree is
built by hand-written F# — `EngineAdapter.fs`, `MinimalBnn.fs`, `MultilayerBnn.fs`,
`AdinkraEquivariantFactorLayer.fs` all call `FactorGraph.addFactor` from literal code. The
variables, the factors, and the priors are authored by a person. That is the
**knowledge-acquisition bottleneck** (Feigenbaum's term for exactly this, and the reason the
1970s–80s expert-system programme stalled), sitting in our tree in 2026.

The mapping — **mine, not the paper's**, and `toy`:

| abstraction-agent output | factor-graph element |
|---|---|
| a proposed variable | a **variable node** |
| its calibration anchors (min/max reference points) | a **prior** over that node — anchors *are* prior specification wearing different clothes |
| the LLM's score for a state | an **observation factor** on that node |
| "drop constant" / "drop correlated" | structure pruning before inference runs |
| the solver's verdict | the **likelihood** the whole structure is judged by |

The paper (per the talk) clusters its feature vectors with K-means and stops. Routing them
into a factor graph instead is a proposal with nothing behind it yet, which is what `toy`
means. What makes it worth writing down is that **it is the "expert priors jointly" half of
Aaron's sentence, made concrete**: the human supplies priors and refuses bad axes; the LLM
supplies candidate axes at a rate no human can; the solver refuses both. Three roles, none of
them trusting the other two.

---

## 6. The role the vocabulary did not have a name for

`dual-use-detection-is-neutral-oracle-decides` carves two roles:

- a **meter** reports a raw value and never judges (judgement crystallised once, in a treaty);
- an **oracle** attaches meaning to a measurement, and must be plural.

**The abstraction agent is neither, and the gap is load-bearing.** It does not report a value
about a fixed quantity — it *invents the quantity*. It does not attach meaning to a
measurement — it runs **before any measurement is possible**. What it produces is the thing
Aaron already named from the other direction:

> **"the meter buys the demarcation, not the claim"** — the measurable/unmeasurable partition
> itself is the product.

An abstraction agent is a **demarcation proposer**: it proposes where that partition should
fall, and the solver decides whether the proposal was any good. It sits strictly upstream of
the meter, and that placement has a consequence the rule's existing text implies but never
states:

> **A demarcation proposer must be plural for the same reason an oracle must be.** A single
> proposer is not a monopoly on judgement — it is a monopoly on **what can be judged at all**,
> which is strictly worse, because a question that was never given an axis is not refuted,
> it is invisible. The falsifiability argument that forces multiple meters (§"a lone meter
> cannot be falsified") applies here *a fortiori*: a lone proposer's blind spots are
> undetectable by construction, since nothing else ever proposed the missing axis.

Concretely, for anything built here: **propose axes from more than one model**, and treat
agreement between two proposers with a shared trainset as the weak evidence Knight–Leveson
says correlated redundancy is — which, per
`docs/research/2026-08-25-rho-is-a-layer-stack-not-a-scalar-and-the-trainset-is-the-floor.md`,
is the floor an all-LLM proposer pool cannot get below.

---

## 7. Anchors (Beacon)

Old and modern, per `anchor-to-human-prior-art`. The lineage this paper sits in is long, and
the talk names none of it.

- **R. A. Fisher (1922), "On the Mathematical Foundations of Theoretical Statistics"** —
  *sufficiency*. The rover example is a sufficiency argument: the mean is sufficient for one
  question and not for another. This is the oldest and sharpest statement of "which variables
  preserve the distinctions that matter."
- **Kadanoff (1966); Wilson (1971) — renormalization group / coarse-graining.** The talk's own
  thermodynamic analogy, named properly: choosing which microscopic detail survives to the
  effective description. Collective variables in molecular dynamics are the same idea under a
  different name.
- **Feigenbaum — the knowledge-acquisition bottleneck**; MYCIN (Shortliffe 1976) as the
  worked expert system. This is the precise problem Aaron's *"old school expert systems"*
  phrase points at, and the one this loop claims to relieve.
- **Langley, Simon, Bradshaw & Zytkow — BACON** (automated scientific discovery), and
  **Michalski — constructive induction.** The 1970s–80s programme for *inventing* intermediate
  variables rather than selecting among given ones. The abstraction agent is that programme
  with an LLM where the search heuristics used to be.
- **Brunton, Proctor & Kutz (2016) — SINDy**; **Udrescu & Tegmark (2020) — AI Feynman.** The
  modern frontier: discover governing equations from a *candidate library*. The delta this
  paper claims is exactly that the library stops being hand-written — which is a smaller and
  more honest claim than "the LLM does science."
- **Kschischang, Frey & Loeliger (2001)** — factor graphs and sum-product; **Minka (2001)** —
  expectation propagation; **Herbrich, Minka & Graepel (2006)** — TrueSkill. All three are
  already implemented in `src/Bayesian/` and `src/Core/`, and are what a structure proposer
  here would feed.

---

## 8. What would have to be true, and what would refute it

Kept short and checkable, so this document can fail rather than age into scripture.

**Claims and their register:**

| claim | register | how it dies |
|---|---|---|
| the loop is elicitation, not distillation | argued | show the small model's parameters come from the LLM's weights rather than from the solver's fit |
| the pruning steps restate rules already carved here | argued, and the strongest thing in this doc | show a pruning step with no corresponding rule, or a correspondence that is only verbal |
| a proposed axis is `toy` until a solver survives it | follows from an existing rule | — |
| **falsifier latency bounds proposer value** | `toy` | hold the proposer fixed, vary falsifier latency, and find hypotheses-per-hour flat |
| abstraction-agent output maps onto our factor graphs | `toy`, mine not the paper's | build it and find the anchors do not function as priors |
| a demarcation proposer must be plural | argued from the existing falsifiability argument | show a single proposer whose blind spots are detectable without a second proposer |
| "only works with frontier models" | **reported, unverified** | the talk's claim; nothing here tests it, and §4 suggests it may be measuring the falsifier |

**What I did not do:** read the paper, run the loop, or build anything. This is a reading with
one worked instance attached.

---

## Pointers

- `docs/ip-questionable/2026-09-10-abstraction-agent-llm-invents-variables-tsinghua-video-transcript.md` — the ferried source
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register discipline this doc marks itself under
- `.claude/rules/numerology-vs-number-theory.md` — "too many correlations is a warning", the decorrelation step's rule
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — meter/oracle, the good-meter test, and the plurality argument §6 extends
- `.claude/rules/dv2-data-split-discipline-activated.md` — raw vault: the rover example's rule
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — the same principle stated a priori: only the irreducible is primitive, generate the rest
- `.claude/rules/anti-babel-preserve-reconcilability.md` — why the anchors must travel with the axis
- `src/Bayesian/FactorGraph.fs` · `src/Bayesian/Ep.fs` · `src/Core/TravelerRankLedger.fs` — the substrate a structure proposer would feed
- `docs/research/2026-09-10-developer-tooling-assumes-decorrelated-authors-and-llm-agents-do-not-have-that-property.md`
  — the same day's companion: why a pool of LLM proposers is correlated below the layer their personas vary on.
  That is the measured version of §6's warning, and it is the reason "propose axes from more than one model"
  is weaker evidence than it looks.
- `memory/user_aaron_the_meter_buys_the_demarcation_not_the_claim_2026_08_24.md` — the phrase §6 builds the missing role from
