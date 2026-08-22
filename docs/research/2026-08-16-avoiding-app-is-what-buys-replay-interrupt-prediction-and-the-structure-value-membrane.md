# Avoiding `app` is what buys replay — interrupt prediction and the structure/value membrane

**Date:** 2026-08-16 · **Ferried by:** Otto (shadow) · **Origin:** Aaron, 2026-08-16, recording
architecture that existed only in his head and in the shape of the code.

> *"this also is where we slip in prediction and pseudo retrocausality over iterated runs with
> saving observations from previous runs, and also this is where we need to avoid `app` the most so
> we can keep our monadic properties over interrupts. this was actually really hard to accomplish —
> interrupt prediction of controller input and how it affects game state. this was not easy for me
> to architect and it kind of felt like magic once I finally got it right, and I didn't even know to
> avoid `app`, it was just instinctive."*

## 1. What `app` is, and why it is the hinge

`ArrowApply` adds exactly one method to Hughes' Arrow:

```
app :: a (a b c, b) c
```

*Take an arrow that arrived **as data**, plus an input, and run it.* It is the ability to decide, at
runtime and from a value, **which computation to execute** — and `ArrowApply ≡ Monad` is the
theorem, with `app` as the constructive witness.

## 2. The causal chain — this is an ordering, not a style preference

Prediction with rollback (the GGPO shape; the repo already carries a prior-art note alongside
Mozilla `rr` and DBSP) requires the computation to be **replayable with different inputs**:
speculate an input, run forward, and when the true input arrives, re-run from the saved
observation.

That works only if the **structure is knowable independently of the values flowing through it**.
`app` destroys precisely that: an arrow pulled out of a value cannot be inspected, scheduled, or
re-run against a corrected input, because you do not know *what it is* until you already hold the
value you were trying to predict.

> **no `app` ⇒ static structure ⇒ inspectable ⇒ replayable ⇒ prediction and rollback are possible at all**

## 3. The resolution — why the monad survives anyway

The apparent contradiction (*avoid `app`, yet keep monadic properties over interrupts*) dissolves in
the channel split, which is why that split is load-bearing rather than tidiness:

| channel | carries | control flow |
|---|---|---|
| `Result` **error** position | genuine interrupts | short-circuit — **fixed, statically known shape** |
| **value** position | the four corners, per-tick state | pure dataflow, none |

`Result`'s short-circuit is monadic **sequencing** whose **branching shape is fixed**: two outcomes,
known statically, at every `>=>`. That is categorically unlike `app`, where the branch structure is
whatever the value says it is. So the unpredictable **content** (which interrupt fired) sits in a
channel whose **control flow** is fully determined, and the surrounding computation stays
replayable. You get `>>=` for dispatch and never need `app` to get it.

**The cut is: separate unpredictable VALUE from unpredictable STRUCTURE.** Only the second breaks
rollback. Aaron found that cut by instinct before the vocabulary existed for it — which is the
usual order, and is recorded here as such rather than tidied into a derivation.

## 4. The membrane, stated so it can be metered

Aaron: *"I think this is the Markov boundary membrane — this is what we are trying to meter very
carefully."*

Not literally a Markov blanket (Pearl's construct is *statistical* conditional independence among
nodes). But the property underneath **is** a conditional independence, and the exact statement is
the more useful one:

> In the Applicative/Arrow fragment, **structure ⊥ values** — the computation graph is independent
> of the data flowing through it. `>>=` / `app` on a runtime value is precisely where that
> independence breaks.

The membrane is therefore *the boundary at which structure stops being independent of data*, which
is why it is cheap to meter: a crossing is a **syntactic** event, not a statistical estimate.

| | structure | consequence |
|---|---|---|
| Applicative / Arrow (no `ArrowApply`) | **static** — graph known before running | inspectable, schedulable, embarrassingly parallel |
| Monad / Kleisli (`>>=`, `ArrowApply`) | **dynamic** — next step depends on the previous value | expressive, unanalyzable ahead of time |

Sibling rules: `IntrCtx` threaded **explicitly rather than ambiently** is §13 noninterference —
influence only through declared channels — and an interrupt is exactly the *undeclared* channel that
guards against. "Lower to serial if needed, natural state embarrassingly parallel" is §1 scale-free
stated for control flow.

## 5. The same shape, twice, years apart

Aaron: *"this was hard for me to solve years ago — DoP scaling, scale-free. It also felt like magic
years ago when I got it right at Itron in the ferry throttler. We have our own version of the ferry
throttler in our codebase too."*

Two "felt like magic" moments, and they are **the same move**:

- **Ferry throttle** — makes *degree of parallelism* a knob **independent of the work**. DoP=1 is a
  deterministic single loop; DoP=N is throughput; one code path.
- **Avoiding `app`** — makes *structure* **independent of the values**. Replayable at any
  speculation depth; one code path.

In both cases the win comes from removing a dependency that looked essential, and in both cases the
result is that a dial can be turned without changing the program. That is what scale-free *means*
operationally, and it suggests the instinct is one skill applied twice rather than two lucky
architectures.

## 6. Prior art — established components, and an honest gap

**Established and citable:**

- **Hughes 2000**, *Generalising Monads to Arrows* — `ArrowApply ≡ Monad`
- **Swierstra & Duponcheel 1996**; **McBride & Paterson 2008**, *Applicative programming with
  effects* — Applicative admits static analysis, Monad does not
- **Marlow et al., ICFP 2014**, *There is no Fork* (Haxl) — uses Applicative *specifically* to batch
  and parallelise, because structure is known ahead of time
- **Mokhov et al., ICFP 2019**, *Selective applicative functors* — the deliberate middle ground;
  close in spirit to the channel split above
- **Mokhov, Mitchell & Peyton Jones 2018**, *Build Systems à la Carte* — the closest published
  statement: classifies build systems by **static (Applicative) vs dynamic (Monad) dependencies**
  and derives what scheduling each permits

### ⚠ SEARCHED, AND THE CLAIM DID NOT SURVIVE — 2026-08-16, same day

The section that stood here said the application to speculative execution and rollback was **not
found**, and registered the novelty question as `NotFound`. **Two decorrelated-by-method searches
(PL-theory axis, systems axis) refuted most of it.** The prediction that this was *artifact-class* —
that the search failed on **vocabulary**, not on absence — was **correct**.

The claim decomposes, and the parts have different fates:

| # | proposition | status |
|---|---|---|
| **P1** | static effect structure ⇒ the graph is knowable **without running it**; `>>=` on a runtime value destroys this | **PUBLISHED, canonical.** Not novel. |
| **P2** | …and that is what buys **speculative execution** | **PUBLISHED** — but "speculation" there means *eager both-branch execution / prefetch*, not rollback |
| **P3** | …**with rollback**, re-run against a **corrected input** | **Not found — and probably FALSE as stated** |
| **S** | fixed-branch-shape error channel preserves analysability | **PUBLISHED, four+ independent times** |

**P1, verbatim, in almost this doc's own words** — Parès, Bernardy & Eisenberg, *Composing Effects
into Tasks and Workflows* (Haskell Symposium 2020) §2.1, describing an arrow DSL deliberately
**without `ArrowApply`**: *"monadic computations are not amenable to config-time analysis of their
structure … the continuation is a function whose argument is the result of running the first
parameter — and we have to apply this function to learn anything about the final result."* Also
*Build Systems à la Carte* §3.7; Hughes 2000; Lindley–Wadler–Yallop (static arrows ≅ applicative,
`ArrowApply` ≅ monad).

**S, verbatim** — Willis, Wu & Pickering, *Staged Selective Parser Combinators* (ICFP 2020): *"the
dynamic structure generated by `>>=` renders static-analysis impossible"* and, of the fixed-shape
filter, *"this has a static structure: the analyser will know that it either returns some value, or
fails, but not which branch."* Selective functors are literally Applicative composed with `Either`.
The systems axis found the same property under four other names: **control independence**
(Rotenberg, Jacobson & Smith, HPCA-5 1999, in a *rollback* setting, with post-dominator analysis as
the static discriminator), **if-conversion** (Allen, Kennedy, Porterfield & Warren, POPL 1983), and
**`Switch`/`Merge` fixed-shape nodes** (Yu et al., EuroSys 2018).

### The polarity inversion — the sharpest refutation

*Build Systems à la Carte* §4.1.2's **restarting scheduler** is speculate-abort-restart, and it is
the published remedy **for monadic tasks**. Restricting to `Applicative` **removes the need to
speculate at all** (§4.1.1: the topological order is precomputable). So it is the *dynamic* fragment
that *forces* speculation-with-rollback — **close to the inverse of what this doc asserted.**

Three published systems perform re-run-against-corrected-input over dynamically-structured
computations: **Acar, Blelloch & Harper**, *Adaptive Functional Programming* (POPL 2002) — change
propagation over a dynamic dependence graph; **Burckhardt et al.**, *Durable Functions* (OOPSLA
2021) — replay with `await` on runtime values, precondition **determinism + a record of crossings**,
not static structure; **Nightingale, Chen & Flinn**, Speculator (SOSP 2005) — checkpoint the
process, run through arbitrary data-dependent control flow, restore on misprediction.

### What is actually true — both axes converged on this independently

> **Static structure buys PREDICTION WITHOUT EXECUTION** (extract the graph, schedule, batch,
> prefetch, stage — before any value exists). **Replay is bought by DETERMINISM plus the ability to
> discard partial effects.** They are separable, and the literature separates them. `>>=` costs you
> the first and **not** the second.

That is the correct statement, and it is better than the one it replaces. What remains unpublished
is narrower: the **conjunction** — asserting the impossibility in a setting where restart-the-whole
task and checkpoint-the-process are *both* unavailable (computation as a *description to traverse*
rather than re-enterable code plus a snapshot), then using the fixed-shape exemption to recover the
useful subset. **That premise was never stated here**, which is what made the claim overreach.

### And the type does not enforce it

Checked against our own code: `ISR<'A,'B> = IntrCtx -> 'A -> Task<Result<'B, InterruptFeedback>>` is
`Kleisli (ReaderT IntrCtx (Task ∘ Result))` — precisely the shape Parès et al. §3.2 calls *"a black
box that cannot be analyzed at config-time."* **Nothing in the type stops a caller writing `app` in
all but name** (`fun ctx a -> task { let! b = f ctx a in return! (chooseArrowFrom b) ctx a }`). The
static-structure property here is a **discipline over which combinators are used**, not a guarantee
of `ISR`. The published route to enforcing it is Kernmantle's: an abstract task type whose only
introduction forms are `arr` / `first` / `>>>` (/ `|||`), with `Kleisli` reachable only at a declared
boundary.

### Register — corrected

- **P1, P2, S → `supportsAbsence` REFUSED.** Found, cited, verbatim. The miss was vocabulary: the
  fields say *control independence*, *post-dominance*, *if-conversion*, *selective functors*,
  *config-time analysis* — none containing "replay," "speculative," or "effect."
- **P3 → `NotFound`**, with the locus recorded: the static-effect-structure literature and the
  trace-based-replay literature **do not connect on this point in any source read**, and per BSalC
  §4.1.2 and Acar 2002 the connecting proposition **may be false as stated**.

**All three searchers flagged that they share weights with the author** (ρ̂ ≈ 0.651 across personas
vs 0.096 across weights), so their *agreement* is weak evidence. But the refutation does not rest on
agreement — it rests on **checkable citations**, which is the part correlation cannot fake.

### Third axis (reactive/FRP) — the predicted result landed

The hunt was: *Arrowized FRP demonstrably avoids `ArrowApply`; what reasons does it publish?*

**Winograd-Cort & Hudak, ICFP 2014** — an entire paper about removing `switch` — states the claim's
first half almost verbatim: *"An arrow's structure must be defined statically… therefore, regardless
of what data the signals contain, the arrow's overall behavior is fixed."* And its stated reasons
for rejecting `switch`/`app` are **compile-time optimisation, static guarantees, embedded resource
constraints, and space/time leaks**. The agent grepped the full text for
`replay|re-execut|speculat|rollback|backtrack|determinis|checkpoint|time travel` — **zero hits in a
rationale role.**

**Hughes (AFP 2004)** is blunter: *"arrows that support `app` are of relatively little interest!"* —
with the original motivation being Swierstra & Duponcheel's 1996 parsers, i.e. **static analysis**.
**Lindley–Wadler–Yallop** give the cleanest formal version: *"static arrow computations are
**oblivious to their inputs**."*

**So the practice is thirty years old and the justification given has never been replay.** That
makes Aaron's independent arrival at it *more* interesting rather than less — the practice is
published under other reasons, and **the reason he gives is the part not found anywhere.**

### The better claim — what the evidence actually supports

**CIEL** (Murray et al., NSDI 2011) is a direct counterexample to the strong form: a *dynamic* task
graph with arbitrary data-dependent control flow that still gets lineage replay and recursive
re-execution, requiring only that tasks be **deterministic functions of their dependencies**. Its
most instructive detail: using UUIDs *"complicated fault tolerance… because the master had to record
the generated UUIDs to support deterministic task replay"* — fixed by **content-addressing** task
names. Dynamic structure did not forfeit replay; it made the *structure itself* something that must
be recorded or content-addressed.

> **The honest form, which all three axes support:** static structure makes replay **free**, because
> there is no graph to record. Dynamic structure makes replay **conditional** — on recording or
> content-addressing the structure. `>>=` does not destroy replayability; it puts a **price** on it.

That is weaker than what this doc originally claimed and stronger than nothing, and it is the
version to carry forward.

### The failure locus is consistent across all three axes

Every axis failed at the *same* boundary, and said so independently: **the static-structure
literature and the replay literature do not cite each other on this point.** Legs 1–2 live in
FRP / synchronous languages / SDF / polyhedral / arrows; leg 3 lives in systems — lineage, replay,
rollback, netcode. No source read crosses.

Under the density criterion that motivated `supportsAbsence`, a **common failure locus across
methods** is the signature of intrinsic-class rather than artifact-class. Held with the correlation
caveat: three shared-weight probes are not three independent ones.

### The named gap is now CLOSED — confirming, 2026-08-16

The gap was Perez & Nilsson, *Testing and Debugging Functional Reactive Programming* (ICFP 2017) —
record-and-replay **in Yampa**, the single most likely place for leg 3 to already exist.

The ICFP text itself remains unretrieved (ACM DL and both Nottingham mirrors are bot-walled; 13
access routes tried and logged). What was read in full is its **journal superset**, which
self-identifies as extending it and lists record-and-replay among the *revisited* contributions:

> Perez, I. & Nilsson, H. (2020). **Runtime verification and validation of functional reactive
> systems.** *JFP* 30, e28. DOI 10.1017/S0956796820000210.

**It justifies replay by purity, referential transparency, and a recorded input trace** — never by
structure:

> *"we rely on Haskell's strong type system to guarantee the freedom from side effects … and hence
> absolute determinism"* (p. 50) · *"users can record the inputs and sampling times … Developers can
> later replay these traces"* (p. 29)

Grep over 43 pages: **`ArrowApply` 0 · `speculat*` 0 · `rollback` 0**; the single `static` is
*"static pictures"* (an image type).

**Stronger than absence — it is a counterexample.** The paper's replayed example, `bouncingBall`
(p. 18), **is built out of `switch`**, and varying structure is presented as a feature (p. 10,
Fig. 3 *"System of interconnected MSFs with varying structure"*). So the static-structure
restriction is demonstrably **not necessary** for deterministic replay. Note the contrast with
Winograd-Cort & Hudak (ICFP 2014), who *remove* `switch`: the two go opposite ways and both work.

**The nearest miss, and the crux.** The paper does credit structure once — *"AFRP … provides enough
**structure** to address whole-program testing and debugging"* (p. 2) — but the structure it names
is **effects-and-time-confined-to-the-boundary** and signals not being first-class, **not** static
topology. That is a *different restriction* from the one this doc asserted, and they are separable:
Perez & Nilsson take the effects-placement one while freely violating the network-shape one.

**And on the rollback half specifically**, backward stepping is bought by snapshotting intermediate
SFs, with the structural version named as unsolved:

> *"Time-reversible FRP combinators remain an open problem."* (p. 51)

Two of the authors closest to this question, in 2020, call reversible-by-construction combinators
**open** while shipping working rollback from recorded inputs. That pushes P3 further toward this
doc's own *"probably false as stated"* reading.

**Residual risk, stated:** this is a superset read, not the named text. A structure-justification
sentence could in principle exist in ICFP 2017 and have been cut from the journal version. Journal
extensions rarely delete justifications of retained contributions, so the risk is low — but nonzero.

So: **plausibly novel as a synthesis, unverified, and the instrument that produced it is the wrong
one to settle it.** Recorded as an open question, not a claim.

## Pointers

- `src/Core/IntrCtx.fs` — the `ISR` docstring, which now carries §2–§3 at the definition site
- `src/Core/IsrLift.fs` — the four-corner fusion as a type application
- `references/notes/dst-omniscience-retrocausality-prior-art-mozilla-rr-ggpo-datomic-differential-dataflow-dbsp-*` — the rollback/retrocausality prior art already on file
- `docs/research/2026-08-16-supports-absence-typing-the-negative-claim-*` — the discipline §6 applies to itself
- [`async-all-the-way-truthful-signatures.md`](../../.claude/rules/async-all-the-way-truthful-signatures.md) — the ferry-throttle DoP knob §5 pairs with
- [`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) — §1 scale-free, §13 noninterference
