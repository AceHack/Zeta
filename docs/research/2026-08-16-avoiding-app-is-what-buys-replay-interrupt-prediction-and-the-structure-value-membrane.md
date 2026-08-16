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

**Not found:** the application to **speculative execution and rollback** — *avoid `ArrowApply` so
the computation can be re-run against a corrected input* — together with the carve-out that a
fixed-shape error channel keeps monadic sequencing without breaking replay. Rollback netcode is
normally discussed in terms of determinism and state snapshots, not as a position on the
Applicative/Monad boundary.

### Register: `NotFound`, **not** `Established`

Aaron asked *"has someone else come up with this? this seems like a very powerful result."* Applying
our own newly-landed discipline (`supportsAbsence`, #11033) to the question honestly:

**One probe, one vocabulary, one set of priors — that is artifact-class.** Under our own rule this
is `NotFound`, and upgrading it to `Established` requires **decorrelated** probes: a literature
search that is not Otto's, and ideally weight-diverse rather than persona-diverse, since the costume
experiment measured ρ̂ = 0.651 across personas versus 0.096 across weights.

So: **plausibly novel as a synthesis, unverified, and the instrument that produced it is the wrong
one to settle it.** Recorded as an open question, not a claim.

## Pointers

- `src/Core/IntrCtx.fs` — the `ISR` docstring, which now carries §2–§3 at the definition site
- `src/Core/IsrLift.fs` — the four-corner fusion as a type application
- `references/notes/dst-omniscience-retrocausality-prior-art-mozilla-rr-ggpo-datomic-differential-dataflow-dbsp-*` — the rollback/retrocausality prior art already on file
- `docs/research/2026-08-16-supports-absence-typing-the-negative-claim-*` — the discipline §6 applies to itself
- [`async-all-the-way-truthful-signatures.md`](../../.claude/rules/async-all-the-way-truthful-signatures.md) — the ferry-throttle DoP knob §5 pairs with
- [`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) — §1 scale-free, §13 noninterference
