# Formal analysis — computational omniscience over a simulation state-space under a deterministic simulator

**Date:** 2026-05-31
**Author:** Otto-CLI synthesis, operator-requested ("we need the formal analysis")
**Status:** research / analysis (NOT a verification artifact — see §9 for the verification path)
**Operator framing (2026-05-31):**
> *"computational-omniscience is a real property not god tier — systems can achieve
> this under deterministic simulator and we have the whole worm atari thing
> backloged"* + *"other humans have acheive computational-omniscience other than me
> i'm not claiming i have done it yet."*

This doc gives the rigorous treatment behind the
[`dst-plus-persist-plus-generator-time-plus-feedback-equals-computational-omniscience-over-simulation-substrate`](../../.claude/rules/dst-plus-persist-plus-generator-time-plus-feedback-equals-computational-omniscience-over-simulation-substrate.md)
rule (which states the property informally). It defines the property, distinguishes
it from the established epistemic-logic notion it is often confused with, identifies
the prior art that **has** achieved it, states the conditions to achieve it, says
precisely what the framework **has vs needs**, and gives the falsifier. Per the
operator's correction: the property is **real and achieved elsewhere**; the framework
is **anchored toward it**; this is **not** a claim that the framework has achieved it.

---

## 1. The terminology hinge — computational vs logical omniscience

"Computational omniscience" is **not** a standard term in the literature. The
established neighbor is **logical omniscience** in epistemic logic: an idealized
agent is assumed to know *all logical consequences* of what it knows. This is
treated as a **problem / idealization**, because real agents are resource-bounded —
the "logical omniscience problem" is precisely that perfect deductive closure is
*computationally infeasible* in general (see the epistemic-logic literature on
[logical omniscience as a complexity problem](https://www.researchgate.net/publication/221551275_Logical_omniscience_as_a_computational_complexity_problem)
and [logical omniscience as infeasibility](https://www.sciencedirect.com/science/article/pii/S0168007213001024)).

The formal hinge of this analysis:

> **A deterministic simulator makes a *bounded* omniscience computationally
> FEASIBLE, because the entire state-space is a computable function of the seed.**

That is: the general infeasibility objection to logical omniscience does **not**
apply when the domain of facts is *the reachable state-space of a deterministic
simulation*. There, "knowing any fact about any state" reduces to *computing*
that state from the seed + event log — a decidable, bounded computation, not
unbounded deductive closure over arbitrary propositions. "Computational
omniscience" (as the operator uses it) is therefore **logical omniscience
restricted to a deterministic-simulation domain, where it becomes feasible**.

This is the whole reason it is a *real engineering property* and not a god-tier
metaphysical claim: the restriction to a seed-deterministic domain is exactly the
move that converts an infeasible idealization into an achievable system property.

---

## 2. Formal setup

Let a **simulation** be a tuple `S = (Σ, σ, A, δ, E)`:

- `Σ` — the state space (all well-formed states).
- `σ` — a **seed** drawn from a seed-space; fixes every nondeterministic choice.
- `s₀ = init(σ) ∈ Σ` — the initial state, a function of the seed.
- `A` — the action/event alphabet.
- `δ : Σ × A → Σ` — the **transition function**, required **pure and total**.
- `E = [a₀, a₁, …] ∈ A*` — the **event log** (append-only).

The **trajectory** is the fold of the log over the transition from the seed-initial
state:

```
T(σ, E) = [ s₀, s₁, s₂, … ]   where  s₀ = init(σ),  s_{k+1} = δ(s_k, a_k)
sₙ = fold(init(σ), E[0..n]) = δ(… δ(δ(s₀, a₀), a₁) …, a_{n-1})
```

This is exactly the framework's `observe`/`fold`/`simulate` algebra
(`tools/observe/observe.ts` + `src/Core.{CSharp,FSharp,Rust}.Observe/`, 081KSXN940008QG0R0033T2BQT):
`fold` reconstructs any `sₙ`; `simulate(s, a) = δ(s, a)` takes a counterfactual step.

---

## 3. Definition — computational omniscience over `S`

A system `M` has **computational omniscience over `S`** iff it satisfies all five:

- **(O1) Determinism.** `T(σ, E)` is a *pure function* of `(σ, E)`: no
  nondeterminism leaks (I/O, wall-clock time, RNG, thread/actor scheduling are all
  injected via `σ`/`E`, never read from the ambient environment). Formally:
  `∀ σ, E.  run(σ, E)` evaluates to the same `T(σ, E)` on every execution.
- **(O2) Replayability.** `∀ n.  sₙ` is recomputable as `fold(init(σ), E[0..n])`
  at bounded cost — the past is reconstructable from `(σ, E)` alone.
- **(O3) Counterfactual reachability.** `∀ s, a.  simulate(s, a) = δ(s, a)` is
  computable — branches off the recorded trajectory (the "what-if" states) are
  reachable, not just the realized path.
- **(O4) Incremental queryability.** For any derived view `Q` (a query/aggregate
  over the trajectory), `M` maintains `Q` *incrementally* under append + retraction
  — answering "what is `Q` at step `n`?" without recomputing from scratch. This is
  the **retraction-algebra** requirement (DBSP/Z-sets; §4.2).
- **(O5) Bidirectional navigation.** `M` can move forward (replay/`simulate`) **and**
  backward (undo/retract — append the additive inverse) over the trajectory; the
  derived state is recoverable at any point in either direction.

**"Omniscience" = the full reachable state-space is a *computable* + *incrementally
queryable* + *bidirectionally navigable* function of the seed.** Not metaphysical
omniscience; not logical omniscience over arbitrary propositions (§5 bounds it).

---

## 4. The achievability argument (this is real — prior art has done it)

### 4.1 Determinism + replay: FoundationDB-class DST is the existence proof

[FoundationDB](https://apple.github.io/foundationdb/testing.html) achieves (O1)–(O3)
operationally:

- The **Flow** actor language abstracts all I/O + scheduling so an entire cluster
  runs as a **single-threaded deterministic simulation**
  ([Pierre Zemb, "Diving into FoundationDB's Simulation Framework"](https://pierrezemb.fr/posts/diving-into-foundationdb-simulation/)).
- `deterministicRandom()` (a **seeded PRNG**) replaces all randomness — *"same seed,
  same execution path, every single time… reproduce the exact failure by running
  with the same seed"*
  ([eatonphil, "What's the big deal about DST?"](https://notes.eatonphil.com/2024-08-20-deterministic-simulation-testing.html)).
- `BUGGIFY` injects chaos *deterministically* (each point fires ~25% by the seeded
  stream), so each run **explores a different corner of the state space** — the
  team ran ~a **trillion CPU-hours** of simulated state-space exploration; for its
  first 18 months FoundationDB *"never sent a single packet over a real network."*

This is exactly (O1) determinism + (O2) replayability + (O3) counterfactual
reachability over the state-space — **achieved, in production, by others.** The DST
ecosystem generalizes it (Antithesis, TigerBeetle, Dropbox; see
[Antithesis DST docs](https://antithesis.com/docs/resources/deterministic_simulation_testing/),
[the open-source-Antithesis primer](https://databases.systems/posts/open-source-antithesis-p1)).

### 4.2 Incremental queryability + bidirectionality: DBSP / Z-sets

(O4) + (O5) are the **retraction-algebra** half, supplied by
**DBSP** (Budiu, Chajed, McSherry, Ryzhyk, Tannen — *DBSP: Automatic Incremental
View Maintenance for Rich Query Languages*, PVLDB 16(7):1601–1614, 2023;
[arXiv 2203.16684](https://arxiv.org/abs/2203.16684);
[VLDB Journal 2025](https://dl.acm.org/doi/10.1007/s00778-025-00922-y)):

- DBSP maintains arbitrary derived views **incrementally** under insertions **and
  deletions** using **Z-sets** (elements with integer multiplicities; deletion =
  negative weight). A retraction is `+1` then `−1` netting to `0` — so "undo" (O5)
  and "incremental query" (O4) are the *same* algebra.
- DBSP is the linear-synchronous-time simplification of **differential dataflow**
  (McSherry et al.); time is a single array of consecutive states (each with a
  unique predecessor) — i.e. exactly a **trajectory**.

So the trajectory of §2, carried as an append-only Z-set event log, gives O4+O5 by
construction: any derived view is incrementally maintainable, and any step is
reversible by adding the inverse Z-set. (Framework anchors: the `algebra-owner`
Z-set substrate; 081KSXN940008QG0R000R76H45 git-native indexes / DBSP; the additive-monoid `EventLog`
081KSXN940008QG0R0002287MP is the simplest such incremental fold.)

### 4.3 The two halves compose

DST (4.1) gives a deterministic, replayable, counterfactually-reachable trajectory;
DBSP (4.2) makes derived views over that trajectory incrementally-queryable +
bidirectionally-navigable. **Their composition is computational omniscience over
`S`** — and both halves are independently shipped, cited, production-grade prior art.

### 4.4 The binary-exhaustive existence proof: Checkers is solved (Chinook)

The cleanest "they computed the *whole* state-space" achievement is **solved
checkers** (Schaeffer, Burch, Björnsson, et al., *"Checkers Is Solved,"* **Science**,
2007; Chinook, U. Alberta, 1989–2007 —
[Science paper](https://www.semanticscholar.org/paper/Checkers-Is-Solved-Schaeffer-Burch/fc436e3566b48c50424881f852d77a13f5ed8bde),
[UAlberta PDF](https://webdocs.cs.ualberta.ca/~jonathan/publications/ai_publications/checksolved.pdf),
[IEEE Spectrum](https://spectrum.ieee.org/checkers-solved)). Checkers has ~5×10²⁰
positions; Chinook used **retrograde analysis** to build endgame databases over
3.9×10¹³ positions plus forward search, proving perfect play is a **draw**. That is
computational omniscience over a state-space in the strongest sense: **every
reachable position's exact value (win / loss / draw) is known.**

But note its *regime*: checkers-solving is **deterministic + perfect-information +
binary-valued**, computed by **exhaustive enumeration** (retrograde analysis tabulates
each position). It took ~18 years for one game. This is the **binary-exhaustive
regime** — and it does not scale to large/uncertain/partial-information state-spaces.

### 4.5 Two regimes — binary-exhaustive (checkers) vs probabilistic-Bayesian (this framework)

The framework targets a **different regime** (operator 2026-05-31: *"checkers right
that's one they did also we are using basyean and probalites so that's differnt
that binary search space"*). The distinction is load-bearing:

| | **Binary-exhaustive** (checkers / Chinook) | **Probabilistic-Bayesian** (this framework's target) |
|---|---|---|
| What is "known" | every state's exact binary value (win/loss/draw) | a **posterior distribution** (belief) over the state-space |
| How | exhaustive enumeration / retrograde analysis — tabulate every position | **Bayesian inference** — maintain + update a posterior with evidence; do NOT enumerate every state |
| "All state-space at once" means | a complete table of all positions' values | a probability-**weighted** belief over states (the posterior IS the "all-states-at-once," not a table) |
| Scaling | bounded by enumeration cost (5×10²⁰ positions = ~18 years for ONE game) | bounded by inference cost over the posterior, not by enumerating states — scales to spaces too large to tabulate |
| Handles uncertainty / partial information | no (perfect-information only) | yes (the posterior IS the representation of uncertainty) |

So the framework's "compute all state-space at once" (the transcript's Atari /
worm framing) is **not** Chinook-style enumerate-every-state-binary. It is a
**posterior/belief over the state-space maintained by Bayesian inference** — a
probability-weighted superposition of states, updated by evidence, queried as a
distribution. Concretely:

- The **worm-colony** (081KSNY2Z0008QG0R00390T4DJ, C. elegans multi-oracle) is the **Bayesian inference
  engine** — *"why reinvent Bayesian inference; evolution had millions of years."*
  A colony converging on an answer is sampling/inference over a posterior, not a
  retrograde table.
- The **Atari all-state-space** demo (081KSNY2Z0008QG0R001HA43GG) under this lens is the posterior over
  reachable game states weighted by probability, not an enumerated value table.
- Bayesian update composes with the DBSP/Z-set retraction algebra (§4.2) **at the
  sufficient-statistic layer, not on the probabilities directly.** A Bayesian update
  is multiplicative (likelihood) + a normalization; probabilities must stay
  non-negative and sum to 1, so it is *not* literally "down-weight = negative Z-set
  multiplicity." What DBSP/Z-sets maintain incrementally is the **evidence / counts /
  unnormalized log-weights / sufficient statistics** — those compose additively and
  *retract* cleanly (removing a piece of evidence = adding its inverse). The
  **posterior is the normalized derived view** computed from those incrementally-
  maintained statistics. So **(O4) incremental queryability applies to the
  posterior's sufficient statistics** (and thus, via normalization, to the posterior
  itself) — not just to deterministic derived views.
- **The inference engine: Infer.NET over Z-sets** (operator 2026-05-31:
  *"infer.net over zsets"*). The Bayesian inference itself is **message passing** —
  Expectation Propagation / belief propagation / variational message passing over a
  **factor graph** — which is exactly [Infer.NET](https://dotnet.github.io/infer/)'s
  regime (Microsoft Research; EP generalizes loopy belief propagation; open-source
  `dotnet/infer`, MIT —
  [Probabilistic Programming with Infer.NET](https://www.microsoft.com/en-us/research/publication/probabilistic-programming-infer-net/)).
  The crucial fit: **the factor-graph messages ARE the sufficient statistics of the
  bullet above.** Running message passing **over Z-sets** means those messages /
  factors are maintained incrementally + retractably by DBSP — *retracting evidence
  retracts its messages* — so incremental Bayesian update **and** the rewind / branch
  of §6.5 are message-retractions, and the posterior is the normalized marginal. This
  is already a **named framework target**: the peer-call rule's *"future state is Zeta
  Infer.NET BP/EP (Belief Propagation / Expectation Propagation) substrate-level
  inference"* + the `algebra-owner` skill's BP/EP-over-Z-set F# substrate. So the
  probabilistic-regime engine is not hypothetical — it is Infer.NET-class message
  passing whose messages live on the retraction-native Z-set substrate.

**Refinement to the definition (§3) for the probabilistic regime:** in the Bayesian
regime, "computational omniscience over `S`" means omniscience over the **posterior
distribution** `P(state | evidence)` and its incremental updates — *any belief about
any (set of) states is computable/queryable on demand* — rather than over each
state's exact binary value. The DST conditions (O1–O3) still ground it (the
generative model + the evidence stream are seed-deterministic; the inference is
replayable), and (O4)/(O5) apply to the posterior (incremental Bayesian update +
retraction). The binary-exhaustive regime is the degenerate special case where the
posterior collapses to a point mass per state (perfect information, full enumeration).

---

## 5. The bound (why "omniscience" is honest, not inflated)

The "omniscience" is **bounded** and the bounds are the substrate-honest content:

1. **Domain-bounded.** It is omniscience over *the reachable state-space of `S`*,
   NOT over arbitrary propositions (that would be the infeasible logical
   omniscience of §1). Facts outside `S` are simply not in scope.
2. **Determinism-bounded.** It holds **only** while (O1) holds. Any leaked
   nondeterminism (an un-injected `now()`, real RNG, real network, OS-scheduler
   race) breaks replay and collapses the property. (O1) is a *discipline*, not a
   freebie — it is the entire cost.
3. **Exploration-bounded.** Knowing *any* state is *computable on demand* (under the
   replay/checkpoint cost model of bound 4 — not constant-time) does not mean
   *enumerating all* states is free. Like BUGGIFY, you *sample/navigate* the
   state-space; full enumeration is still exponential. "Omniscience" = *any state is
   knowable on demand* (and, per §6.5, cheaply *reachable* by incremental
   rewind/fast-forward/branch), not *all states are materialized at once*.
4. **Cost-bounded.** Incremental (O4) is cheap *relative to recompute*, not free;
   replay (O2) is bounded by log length (mitigated by snapshots/checkpoints).

None of these are metaphysical hedges; they are the operating envelope. Within the
envelope the property is exact.

---

## 6. "Retro-causal-like" propagation, made precise (not physics)

The rule + the operator's framing mention retro-causal-like signal propagation.
Formally this is **not** physical retrocausality; it is a property of **generator
time** (per the
[three-clocks rule](../../.claude/rules/future-does-not-edit-past-event-future-affects-generator-that-makes-past-intelligible-three-clocks-physical-git-generator-time-amara-aaron-2026-05-28.md)):

> The future does not edit the past *event*; it updates the *generator* that makes
> the past intelligible.

On replay, information discovered at step `j` can reclassify/annotate an event at
step `i < j` (e.g. "event `aᵢ` was an instance of error-class `E` discovered at
`aⱼ`") and change what the generator emits next time — **the past event is
immutable (O1/O2); the past interpretation updates (generator-time).** Mechanically
this is the Kleisli-shaped bidirectional feedback channel (081KSNY2Z0008QG0R002HB4AGT interrupt
substrate): `yield` emits forward and receives feedback from the caller. It is the
same shape as backpropagation (gradients flow backward through a computational
graph) — operational, bounded, non-mystical.

---

## 6.5 The concrete mechanism — IScheduler (time) + function generator (generator-time) + DBSP retraction-native (efficient rewind / fast-forward / branch)

Operator 2026-05-31, naming the implementation primitives that make this real for
the framework's emulator (081KSNY2Z0008QG0R001HA43GG/081KSNY2Z0008QG0R00390T4DJ): *"it works for us cause we can use
IScheduler and function generator for the emulator"* + *"for time"* + *"generator
time"* + *"it lets you rewind and fast forward over dbsp retraction native so you
can explore branching playthrough very efficiently."* The three primitives map
one-to-one onto the formal machinery above — these are off-the-shelf, composable,
not bespoke:

| Primitive | Realizes | Maps to |
|---|---|---|
| **`IScheduler`** (Rx controllable/virtual-time scheduler — `System.Reactive.Concurrency` / RxJS `Scheduler`; the `TestScheduler` / `HistoricalScheduler` / `VirtualTimeScheduler` family) | **TIME.** All timing/concurrency flows through the scheduler; a virtual clock you can advance deterministically — so execution is deterministic (O1), replayable (O2), and reachable-to-any-point (O3). The same controllable-scheduler move as FoundationDB's Flow, but as a standard Rx abstraction. | the deterministic-simulator *time* axis (three-clocks: physical/git time, made controllable) |
| **function generator** (generator functions; bidirectional `value = yield x`; F# `seq`/CEs) | **GENERATOR TIME.** Drives the simulation one step per `yield` AND receives feedback through the yield — the Kleisli bidirectional channel (081KSNY2Z0008QG0R002HB4AGT). The generator-time axis where future feedback updates the generator (O5 + §6). | the *generator-time* clock (the third clock) |
| **DBSP retraction-native** (Z-sets; §4.2) | **EFFICIENT rewind / fast-forward / branch.** Rewind = retract the deltas back to a branch point (add inverse Z-sets — cheap); fast-forward = replay/advance the scheduler; branch = fork the trajectory at a point and explore a counterfactual playthrough. All **incremental** — derived views are maintained, not recomputed per branch (O4). | the *git* clock (append-only + retraction) + O4 incrementality |

**The payoff (operator's phrasing): "explore branching playthrough very
efficiently."** Counterfactual-branch exploration (O3) over the state-space is the
expensive operation — and retraction-native DBSP makes it **incremental**: you do
not re-run each branch from scratch, you *rewind by retracting deltas* to the
branch point and *fast-forward by replaying*, with the derived views (and, in the
Bayesian regime of §4.5, the posterior) maintained incrementally throughout. This
is precisely what makes the probabilistic-Bayesian regime *tractable* (§4.5): the
posterior over branching playthroughs is updated incrementally as you rewind/branch,
not recomputed.

This also **sharpens the exploration-bound (§5.3):** full enumeration of the
state-space is still exponential, but *navigating* it — rewind, fast-forward, fork a
branch, query the (incrementally-maintained) view/posterior — is efficient. "Any
state/branch knowable on demand, cheaply-reachable by incremental rewind/replay" is
the achievable property; "all states materialized at once" is not (and is not
needed — the posterior is the all-at-once representation).

---

## 7. What the framework HAS vs NEEDS (substrate-honest: not-yet-done-here)

**HAS (the pieces, at toy/partial scale):**

| Piece | Where |
|---|---|
| `observe`/`fold`/`simulate` algebra (O2/O3), 4-language, golden-vector determinism check (O1 spot-check) | `tools/observe/` + `src/Core.{CSharp,FSharp,Rust}.Observe/` (081KSXN940008QG0R0033T2BQT) |
| Additive-monoid `EventLog` (the simplest incremental fold, O4 seed) | 081KSXN940008QG0R0002287MP |
| DST as an always-active discipline | `.claude/rules/dv2-data-split-discipline-activated.md` |
| Kleisli interrupt substrate (O5 / generator-time) | 081KSNY2Z0008QG0R002HB4AGT |
| Bounded state-space simulators as existence demos | **081KSNY2Z0008QG0R001HA43GG** (Atari emulator, all-state-space) + **081KSNY2Z0008QG0R00390T4DJ** (C. elegans worm-colony controller) |
| Z-set / DBSP substrate (O4/O5) | `algebra-owner` skill; 081KSXN940008QG0R000R76H45 git-native indexes |
| The implementation primitives (§6.5): `IScheduler` (time), function generators (generator-time), DBSP Z-sets (efficient rewind/ff/branch) | off-the-shelf (Rx + language generators + the Z-set substrate) — the emulator's deterministic-time + generator-time + branching engine |

**NEEDS (to actually achieve O1–O5 over the framework's *own* execution):**

1. **Wire the §6.5 primitives into the emulator + the framework's own loop** — the
   pieces exist (Rx `IScheduler` for controllable time, function generators for
   generator-time, DBSP Z-sets for incremental rewind/ff/branch); what's needed is
   **full DST coverage** — route *all* nondeterminism (I/O, time, scheduling, RNG)
   through the scheduler FoundationDB-Flow-style, so (O1) is enforced end-to-end.
   Today DST is a discipline over substrate; the gap is the controllable-runtime
   wiring, not the primitives.
2. **The DBSP incremental-view layer wired to the git-native append-only event log**
   — so (O4) is real incremental maintenance, not per-query recompute.
3. **The generator-time bidirectional feedback realized** as a first-class channel
   (081KSNY2Z0008QG0R002HB4AGT) over the event log, not just typed.
4. **A trajectory-query interface** — the surface that answers "state/view at step
   n / on branch b" (the omniscience *interface*).

The 081KSNY2Z0008QG0R001HA43GG Atari and 081KSNY2Z0008QG0R00390T4DJ worm work are the honest scale: they demonstrate (O1–O3)
over a *bounded* emulated state-space. That is the "achieved elsewhere, demonstrated
here at toy scale, not-yet-at-framework-scale" status the operator named.

---

## 8. The formal claim + the falsifier

**Claim (theorem-shape):**
> Let `S = (Σ, σ, A, δ, E)` satisfy **(C1)** `init`/`δ` are pure + total and *every*
> nondeterministic input is a function of `σ`/`E`; **(C2)** the event log is
> append-only; **(C3)** derived views are expressed in DBSP over Z-sets. Then `M`
> running `S` has computational omniscience over `S` in the sense (O1)–(O5).

The argument is §4 (DST gives O1–O3 from C1+C2; DBSP gives O4–O5 from C3); the bound
is §5.

**Falsifier (operational, already the DST discipline's own test):**
> Run `S` twice from the same seed `σ`. If `T(σ, E)` differs across runs, **(C1) is
> violated → (O1) fails → omniscience does not hold.** The golden-vector
> replay-equivalence test (`tools/observe/golden-vectors.*`) IS this falsifier; any
> mismatch localizes the nondeterminism leak.

This makes the property **operationally checkable** — the load-bearing reason it is
not god-tier. A god-tier claim has no falsifier; this one's falsifier is a CI test.

---

## 9. The verification path (route to the formal-verification expert)

This doc is the **analysis**, not the **verification**. The verification follow-up
(per [`formal-verification-expert`](../../.claude/agents/formal-verification-expert.md) routing — pick the tool
for the property class before writing a spec; guard against TLA+-hammer bias):

- **(O1) determinism / replay-equivalence** — a *safety* property over a state
  machine → **TLA+** candidate (model the seed→trajectory determinism + the
  append-only log); the golden-vector test is the executable shadow of it.
- **(O4/O5) DBSP incrementality + retraction-inverse correctness** — algebraic laws
  (Z-set group axioms; `incremental(Q)` ≡ `Q` on the integral) → **property-based
  testing (FsCheck)** + possibly **Lean** for the omniscience theorem (C1–C3 ⇒
  O1–O5).
- **Cross-language oracle** — the 4-language golden-vector BFT (081KSV2WD0008QG0R00051XS0N "the compilers
  don't lie") already cross-checks the `δ`/`fold` determinism across TS/F#/C#/Rust.

Recommend routing the spec-vs-tool selection through the formal-verification expert
before any spec is written.

---

## 10. Status + composition

**Substrate-honest status:** the property is **real** and **achieved by others** —
**Checkers/Chinook** (binary-exhaustive state-space omniscience, §4.4) and
**FoundationDB DST + DBSP** (deterministic-replay + incremental-query, §4.1–4.2) are
the existence proofs; the framework is **anchored toward it**, in the
**probabilistic-Bayesian regime** (§4.5 — posterior over the state-space, NOT binary
enumeration), and **demonstrates it at toy scale** (081KSNY2Z0008QG0R001HA43GG/081KSNY2Z0008QG0R00390T4DJ); the operator is
**NOT claiming the framework has achieved it** over its own execution. Don't-collapse
in both directions: not god-tier, and not "we've done it."

**Composes with:**

- `.claude/rules/dst-plus-persist-plus-generator-time-plus-feedback-equals-computational-omniscience-over-simulation-substrate.md` (this doc is its rigorous backing)
- `.claude/rules/future-does-not-edit-past-event-future-affects-generator-that-makes-past-intelligible-three-clocks-physical-git-generator-time-amara-aaron-2026-05-28.md` (§6 generator-time)
- `.claude/rules/past-is-kind-when-lightlike-consensus-is-gravity-lightlike-vs-dark-architecture-design-rule-amara-aaron-2026-05-28.md` (append-only replayable trajectory = "lightlike" rays)
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` (the discipline whose failure produced the initial mis-framing this doc corrects)
- `.claude/rules/edge-defining-work-not-speculation.md` (the further bets — physics-retrocausality, "no digital at all" — are edge-defining, distinct from this achieved-elsewhere property)
- 081KSXN940008QG0R0033T2BQT/.28 (observe-fold algebra + monoid), 081KSNY2Z0008QG0R002HB4AGT (Kleisli interrupts), 081KSNY2Z0008QG0R001HA43GG/081KSNY2Z0008QG0R00390T4DJ (state-space simulators), 081KSV2WD0008QG0R00051XS0N (4-language BFT), 081KSXN940008QG0R000R76H45 (git-native DBSP indexes), `algebra-owner` (Z-sets)

## Sources

- [Logical omniscience as a computational complexity problem](https://www.researchgate.net/publication/221551275_Logical_omniscience_as_a_computational_complexity_problem)
- [Logical omniscience as infeasibility (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0168007213001024)
- [Schaeffer et al., "Checkers Is Solved" (Science 2007) — Semantic Scholar](https://www.semanticscholar.org/paper/Checkers-Is-Solved-Schaeffer-Burch/fc436e3566b48c50424881f852d77a13f5ed8bde) · [UAlberta PDF](https://webdocs.cs.ualberta.ca/~jonathan/publications/ai_publications/checksolved.pdf) · [IEEE Spectrum, "Checkers, Solved!"](https://spectrum.ieee.org/checkers-solved)
- [FoundationDB — Simulation and Testing](https://apple.github.io/foundationdb/testing.html)
- [Pierre Zemb — Diving into FoundationDB's Simulation Framework](https://pierrezemb.fr/posts/diving-into-foundationdb-simulation/)
- [eatonphil — What's the big deal about Deterministic Simulation Testing?](https://notes.eatonphil.com/2024-08-20-deterministic-simulation-testing.html)
- [Antithesis — Deterministic simulation testing](https://antithesis.com/docs/resources/deterministic_simulation_testing/)
- [Building an open-source Antithesis, Part 1 (DST ecosystem)](https://databases.systems/posts/open-source-antithesis-p1)
- [DBSP: Automatic Incremental View Maintenance for Rich Query Languages (arXiv 2203.16684)](https://arxiv.org/abs/2203.16684)
- [DBSP — VLDB Journal 2025](https://dl.acm.org/doi/10.1007/s00778-025-00922-y)
- [Infer.NET (dotnet.github.io/infer)](https://dotnet.github.io/infer/) · [Probabilistic Programming with Infer.NET (Microsoft Research)](https://www.microsoft.com/en-us/research/publication/probabilistic-programming-infer-net/) · [Infer.NET — Expectation Propagation](https://dotnet.github.io/infer/userguide/Expectation%20Propagation.html)
