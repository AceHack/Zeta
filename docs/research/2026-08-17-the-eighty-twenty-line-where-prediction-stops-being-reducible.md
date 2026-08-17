# The 80/20 line — where prediction stops being reducible

**Date:** 2026-08-17 · **Observation:** Aaron · **Written up by:** Otto (shadow)

Aaron, on Jenann Ismael's argument that reality viewed from within is fundamentally incomplete:

> *"our zeta scheduler and our ferry throttler and our chip8/9 predictor are all trying to prove
> this wrong, maybe i can't in all cases but only in like the 80% case and the other 20% require
> chaos cartography and per step navigation because it's not reducible."*

Source excerpts:
[`../ip-questionable/2026-08-17-jenann-ismael-reality-incomplete-from-within-light-cone-counter-predictive-excerpts.md`](../ip-questionable/2026-08-17-jenann-ismael-reality-incomplete-from-within-light-cone-counter-predictive-excerpts.md).
This note restates every claim it uses, so deleting that file costs nothing here.

## "This" is three different claims, and only one of them is about us

Ismael's argument arrives as one package. It isn't one. Separating it is the whole job, because
our three systems stand in a different relation to each part.

**(A) The relativistic-access claim.** An embedded predictor holds only its own past light cone,
and a later event's light cone includes regions outside it — so the predictor's information is
never sufficient for certainty.

**(B) The self-referential claim.** A system asked to predict its own output, *where the prediction
is fed back into the predicted system*, cannot answer truthfully. Her phrase for the mechanism:
it cannot stabilise the fact it is describing independently of the description it gives.

**(C) The conclusion.** The view from within is therefore incomplete — and she is explicit that
this is incompleteness of the *view*, **not** inconsistency of reality, and **not** indeterminism
of the laws.

**(A) does not bite on our systems, and it is the weakest link anyway.** Our scheduler is not
relativistically separated from what it schedules: same clock domain, shared substrate, and the
state it reads is a Z-set it has actual access to. (A) is a statement about information *access*
for an observer embedded in a spacetime, not about whether the laws determine. In a globally
hyperbolic spacetime, data on a Cauchy surface determines the domain of dependence; a past light
cone is not a Cauchy surface. Ismael is careful about this — her target is determinism *as usually
presented* ("the initial state was laid down and everything since was fixed") — but the interview's
framing collapses the distinction, and we should not inherit that collapse. **Do not cite (A) as
if a scheduler were forbidden by relativity from predicting its own queue.**

**(B) bites exactly where the prediction is coupled back.** That is a real, checkable property of a
design, not a metaphysical mood. It is also the one Aaron's three systems can genuinely test.

## The 80/20 line already has a name in this repo

Aaron's split — ~80% predictable, ~20% requiring per-step navigation because it is not reducible —
is not a new boundary. It is the one drawn yesterday in
[`2026-08-16-avoiding-app-is-what-buys-replay-interrupt-prediction-and-the-structure-value-membrane.md`](2026-08-16-avoiding-app-is-what-buys-replay-interrupt-prediction-and-the-structure-value-membrane.md):

> Static structure buys **prediction without execution**. `>>=` **prices** replay — it does not
> destroy it.

That is the same line in different costume:

| | Aaron's framing | the structure/value membrane |
|---|---|---|
| the ~80% | reducible; schedule/throttle/predict ahead | the **Applicative / Arrow** fragment — the shape is knowable statically, so you can answer questions about the run without doing the run |
| the ~20% | "chaos cartography", per-step navigation | the **Kleisli** fragment — the next step depends on the *value* the previous step produced, so the only way to know it is to run it |

`ArrowApply ≡ Monad` is the theorem that makes this an identity rather than an analogy: the moment
you can feed a computed value back in to choose the next computation, you have bought exactly the
expressive power that costs you static predictability. Wolfram's computational irreducibility is
the same statement from the cellular-automaton side, and Ismael's is the same statement from the
embedded-agent side.

The draft called that *"three independent derivations of one boundary"* and leaned on the
convergence. **That overclaims, and Aaron caught it** — his name for the failure is
*"tele-port-leap"*: three words that all mean the same motion, looking like a triple and not being
one. *"Not an accurate triple, just a funny close miss."*

See [§ Is it actually three?](#is-it-actually-three--the-triple-is-a-near-miss) — the honest count
is **two routes sharing a root, plus one genuinely different in kind**, and knowing which is which
turns out to matter for what we can measure.

## The reframe: not "prove it wrong", chart it

"Trying to prove this wrong" is the wrong description of what the three systems are doing, and the
right description is better news.

Ismael's result says you cannot get to **100%**. It says nothing whatever about 80%. So a scheduler
that predicts 80% of its queue is not a counterexample to her — it is a **measurement of where her
boundary sits in our substrate**, which no amount of philosophy can supply. Her argument is
existential ("there is a question it cannot answer"), not universal ("it can answer nothing").
Confusing those two is how a real theorem becomes an excuse for not measuring.

Which is also why **"chaos cartography" is exactly the right word and "conquest" would be wrong.**
You map the irreducible region; you do not eliminate it. A map of where per-step navigation is
mandatory is a deliverable. A promise to shrink it to zero is not.

## The falsifier — and checking it corrected the obvious answer

Ismael's device is a predictor **required to feed its prediction to a system programmed to react to
it**. The tempting move is to go looking for that pattern in our code, find coupling, and declare
the 20% self-inflicted. I made that prediction — the ferry throttler would show the *largest*
interference-driven irreducibility, chip8/9 the smallest — and then read the code, and the
prediction is wrong for a reason worth more than the prediction was.

`ferry-throttler/four-corner-feedback.ts` is coupled about as hard as a system can be. The feedback
corner does not merely make the throttle *visible* to producers; it is **prescriptive**, carrying a
`-1` retraction of the belief that a frame was received, a new generator function ("here is the
new behaviour to try"), an error dimension, and a suggested lane. The throttler's decision is an
input to the process it is deciding about. By the "is the prediction observable to the predicted?"
test, this is a maximal yes.

And it still is not Ismael's device — because **coupling is not the discriminator. The sign is.**

Her construction is a system programmed to do the **opposite** of the prediction: `f(p) = ¬p`,
which has **no fixed point**. That absence *is* the paradox; nothing else in the setup does any
work.

### …and here the first draft of this note got the value sign backwards

The draft continued: *"a throttle loop is a contraction, a fixed point exists, and the equilibrium
is the thing a throttler is actually for."* Aaron:

> *"so is ours — we have a fixed point registry so we can **avoid** all fixed points, not to get
> stuck. This is being frozen in time, quasi time crystal. Only aperiodic is 'alive' in our
> system."*

He is right, and this repo had already written it down. **A reached fixed point is not the goal;
it is death.** `2026-08-15-navigating-the-chaotic-regime-*.md` records the same reversal in Aaron's
words two days ago — *"the thing to avoid is getting stuck, not the chaotic regime"* — and measures
it: the identical steering search that cuts a stall by **7.6×** in the chaotic regime finds
**nothing at any perturbation size** in the ordered one. Sensitive dependence is not the hazard, it
is the control authority. A design that flees chaos flees its own steering.

I reproduced an error that was corrected on file 48 hours earlier. Recorded rather than quietly
fixed, because it is the *attractive* error — "the system converged" reads as success in almost
every other engineering context, and it is precisely wrong here.

### The registry exists, and it is a four-way, not a two-way

`src/Core/Orbit.fs` already classifies exactly this — and per the 2026-08-15 grouping it was
**built and consumed by nothing**:

| `Orbit.fs` | dynamics | predictable? | alive? |
|---|---|---|---|
| **`Fixed`** | `s = step s` — period 1, the DC/stationary mode, what `Fixpoint` finds | fully — predict the equilibrium | **no. This is stuck** |
| **`Crystal n`** | `s = stepⁿ s`, `n > 1` — a standing wave in time, discrete-time-crystal candidate | fully — predict the phase | barely; it repeats |
| **`Quasiperiodic`** | no period ≤ `maxPeriod` — ordered but aperiodic, a time *quasi*crystal | not in closed form | **yes** — Aaron's "quasi time crystal" |
| **`Chaotic λ`** | `λ > 0`; survivable when `Σλ < 0`, explosive otherwise | per-step only | **yes, and steerable *because* of λ** |

This reclassifies everything above, including Ismael:

**Her counter-predictive device is `Crystal 2`.** `f(p) = ¬p` has no fixed point, but it has a
period-2 orbit — the simplest possible non-fixed behaviour. So her construction does not exhibit
chaos at all; it exhibits the smallest available limit cycle, and its unpredictability is entirely
the *self-reference*, not the dynamics. That is a sharper statement of her result than the
interview gives, and it means **her device is not in the regime Zeta lives in.**

**The 80/20 split lands on the table cleanly:**

- the **~80%** is `Fixed` + `Crystal n` — reducible, because you can answer with an equilibrium or
  a phase instead of a trajectory
- the **~20%** is `Quasiperiodic` + `Chaotic` — irreducible, per-step, *and the only regimes that
  are alive*

Which inverts the framing this note started with. The three systems are **not** trying to prove
Ismael wrong. They are deliberately operating in the regime where her incompleteness **holds**,
because it is the only regime that is both alive and steerable. **Zeta wants the 20%.** The
fixed-point registry is the instrument that keeps it out of the 80% — not an oracle for reaching
equilibrium, an alarm for having reached one.

> **The discriminator is fixed-point existence — but the desirable value is the opposite of the
> obvious one.** Converging feedback leaves prediction intact and buys it with stuckness. Inverting
> feedback destroys prediction. Zeta targets neither: *ordered aperiodicity*, where the measure
> partially concentrates — enough structure to steer, never enough to freeze.

That last clause is also what "quasi" is doing in "quasi time crystal", and it is not decoration:
a quasicrystal has **long-range order without periodicity**. Structure and non-repetition at once.

This is the polarity-inversion shape again, and this module already carries a precedent for it: its
header records that Geometry of Interaction / the `Int` construction was **considered and retracted**
(Otto, 2026-08-10) because `Int`'s backward component is a genuine reverse arrow while our `-1`
arrives *forward* in time with an inverted sign. Same direction, opposite weight — not the same
construction. Exactly the distinction being drawn here, one level up.

**So the revised reading of the three systems:**

- **scheduler and throttler share a mechanism but are not one subsystem** — and I over-collapsed
  them. §1a of the 2026-08-15 grouping says `Vision.boatGrowth` charges future branches against a
  byte-denominated `SoftThrottle.Tank` and splits them `Boarded` / `Deferred`, i.e. *"the
  scheduler's branch pruning **is** the ferry throttle."* True **mechanically**. Aaron, on reading
  that restated here:

  > *"ferry throttler is more like logistics, and scheduler is more like cooperative / green-thread
  > scheduling — but more enforced because of our arrow."*

  So: one boarding mechanism, two roles. The **ferry** is *logistics* — moving things under a
  capacity constraint. The **scheduler** is *execution* — deciding what runs next. Capacity-limited
  boarding is the shared shape, not a shared job, and "same shape" was doing more work in my
  sentence than it earns.

  **And the trailing clause is the one that matters.** Cooperative/green-thread scheduling has a
  single classic weakness: it depends on tasks *voluntarily* yielding, so one task that never
  yields starves the rest. The usual fix is preemption, which needs interrupts — and interrupts are
  hidden coordination, the thing this substrate is built to avoid. **The Arrow removes the
  dilemma.** Because the computation's structure is legible *before* it runs, the scheduler can
  enforce yield points instead of trusting them: preemptive safety with cooperative determinism,
  and no interrupt.

  That is this note's own boundary paying out. Enforceable-without-interrupts is available exactly
  in the statically-analysable Applicative/Arrow fragment — **the 80%**. In the Kleisli fragment the
  next step is not visible until the previous value exists, so there is nothing to enforce against
  ahead of time, and you are back to per-step navigation — **the 20%**. The scheduler's
  enforceability is not a separate design win; it is what being in the reducible region *buys*.

  **On independence, held to the same standard as the triple above:** distinct roles do not make
  them independent probes. They share `boatGrowth` / `Tank` / `Boarded` / `Deferred`, so a defect in
  boarding shows up in both. Correlated instruments, different jobs.
- **the ferry/scheduler** — heavily and *cooperatively* coupled, so Ismael's `Crystal 2` obstruction
  does not apply to it. But cooperative coupling is precisely what drives a loop toward `Fixed`,
  which is the failure the registry exists to catch. Its risk is **stuckness, not paradox.**
- **chip8/9 predictor** — uncoupled: a CHIP-8 program does not read its predictor. Whatever
  irreducibility it measures is honest Wolfram-style irreducibility, so it is the **cleanest
  instrument for measuring the intrinsic 20%**.

**The falsifier that survives, restated for the corrected sign.** The interesting experiment is no
longer "can we make it fail to converge" — convergence is the hazard. It is:

> Run `Orbit.fs` classification **on the ferry/scheduler's own control loop** and record the
> distribution over `Fixed` / `Crystal n` / `Quasiperiodic` / `Chaotic`. The 2026-08-15 grouping
> says the classifier is built and **consumed by nothing**, so this is wiring, not research.
>
> - If the loop sits in `Fixed` or low-period `Crystal n` under normal load, the cooperative
>   feedback is doing exactly the freezing this section predicts, and the 20% is being *suppressed*
>   rather than measured.
> - If it sits in `Quasiperiodic` / `Chaotic λ` with `Σλ < 0`, the design is already where Aaron
>   says it should be, and the claim in this note is confirmed rather than assumed.

That is a real measurement with a real way to come out against me, and it needs no new machinery.

## Aaron's reconciliation: the indefinitely-many futures are an integrand, not a gap

Ismael's visual form — take any past light cone, ask how many models of the theory it embeds in,
answer *indefinitely many with very different futures* — is offered as an **obstruction**. Aaron
reads the same picture as a **Feynman diagram**:

> *"to me this is just the Feynman diagram, that's how i reconcile infinity."*

The move is this. A path integral does not pick one history out of the infinity; it **sums over all
of them**, each weighted, and definite predictions come out because most of the sum **cancels**.
Where the phase is stationary the contributions reinforce and the answer concentrates on the
classical path; where nothing dominates, it does not. So "indefinitely many futures" stops being a
statement that prediction is impossible and becomes a statement about **an integrand whose measure
may or may not concentrate**.

That reframing does real work here, because it converts the 80/20 from a felt ratio into a
criterion:

| | path-integral reading | consequence for us |
|---|---|---|
| the ~80% | the sum **concentrates** — one path dominates, stationary phase is valid | predict the dominant path; the rest cancels and never needed enumerating |
| the ~20% | the sum **does not concentrate** — many comparable contributions, no dominant path | no shortcut exists; you must carry the whole family forward step by step. *This is what per-step navigation IS* |

**And by the correction below, full concentration is the death condition, not the win condition.**
A measure that collapses entirely onto one path is `Fixed` — perfectly predictable and completely
stuck. What Zeta wants is the middle: *partial* concentration, ordered but never collapsing. In
this vocabulary that is what `Quasiperiodic` means, and it is why the target is a **quasi**crystal
rather than a crystal.

**Register — this is an analogy with an exact classical cousin, and the cousin is the honest
citation.** Ismael's setting is deliberately classical, so it is not literally a quantum amplitude
sum: hers is a *set* of classical models, the path integral is a *weighted sum* of quantum
histories. But the reconciliation move is not loose. Its classical form is **Laplace's method /
large-deviations theory** (Freidlin–Wentzell), where an integral over a family concentrates on the
minimiser of an action functional, and the approximation degrades exactly when the minimum is
near-degenerate. Same structure, no quantum machinery borrowed. Cite that, not the path integral,
when the claim needs to hold in a classical setting.

**On whether she sees it.** Aaron's guess was *"maybe she does not see that in her mind like i do."*
Probably not so: Ismael works in quantum foundations and says explicitly in the same conversation
that she is ignoring the quantum substructure to make the free-will point in a purely classical,
relativistic setting. The likelier reading is that she **bracketed** it, not that she missed it.

But that does not dissolve the contribution, and it is worth being precise about what the
contribution is. She states the family and stops, because for her argument the mere existence of
alternatives is enough — she needs *no* unique prediction, and one counterexample delivers that.
Aaron asks the next question she has no reason to ask: **does the family concentrate, and by how
much?** That is not a rebuttal of her result. It is the measurement her result leaves open, and it
is the one we actually need, because a substrate does not care that 100% is unreachable — it cares
whether the reachable fraction is 80% or 8%.

## Is it actually three? — the triple is a near miss

The draft banked on convergence: `ArrowApply ≡ Monad` from types, computational irreducibility
from automata, non-concentration of the measure from analysis — *"three vocabularies, one line."*
Aaron:

> *"tele-port-leap lol — this is not an accurate triple, just a funny close miss."*

Three words that all name the same motion. Checking it against the repo's own standard for when
convergence counts:

| route | domain | what it actually rests on |
|---|---|---|
| `ArrowApply ≡ Monad` | type theory | feeding a *computed value* back in to choose the next computation — i.e. general recursion |
| computational irreducibility | cellular automata | most systems are computation-**universal**, so no shortcut to state *n* |
| non-concentration of the measure | analysis | the integral over the family fails to collapse onto a minimiser |

**Routes 1 and 2 are not independent.** Both are downstream of Turing universality: `ArrowApply`
buys general recursion, which buys a universal machine; Wolfram's principle *is* the claim that
universality is generic. Remove undecidability and both fall together. They are one result in two
notations — the tele-port half of the joke.

**Route 3 is genuinely different in kind**, and the difference is checkable rather than asserted:
the logistic map at `r = 4` is chaotic and non-concentrating while being nowhere near
computation-universal; and conversely, a universal machine can have a sharply concentrated measure
over typical inputs. Neither direction implies the other. So the honest count is **two correlated
routes plus one independent one.**

**Why this matters more than a scoring correction.** Independence is exactly what makes convergence
evidential — it is the assumption under the aggregation results this repo rests on, and the
costume experiment already measured what happens when it fails: ρ̂ = **0.651** across personas
sharing weights versus **0.096** across weights. Three derivations sharing a root are correlated
derivations. **Shared root is shared weights, one level up.** Treating them as three would have
been the same error the costume experiment exists to prevent, committed in prose instead of in a
probe set.

**And the payoff runs the other way from the deflation.** Routes 1 and 2 are *binary*: they say a
boundary exists. Route 3 is *quantitative*: the degree of concentration is a number. So the one
route that survives as independent is also the only one that can ever produce **80/20 as a
measurement rather than a feeling**. If we want the split to stop being an estimate, analysis is
the instrument, and the type-level and automata arguments are corroboration that cost nothing and
add nothing.

`Orbit.fs`'s classifier sits in route 3's family, not its own — Lyapunov exponents are a measure
statement. That is a fourth vocabulary, not a fourth route, and worth saying so before someone
counts it.

## The middle path was already a primitive — `YinYang.Cell`

This note reached "partial concentration: ordered, never collapsing" from Ismael's side and
presented it as a conclusion. Aaron:

> *"yes, the middle path — encoded. This was one of the first things we talked about, and we even
> have a yin-yang cell lol."*

He is right that it is not a conclusion here; it is the **basis**. `src/Core/YinYang.fs`,
2026-06-07:

```fsharp
type Cell = { Remains: DynamicValue; Acts: Bonsai.Expr }
```

- **yin = `Remains`** — the static canonical value tree. What persists.
- **yang = `Acts`** — the reactive engine, a `Bonsai.Expr`. What acts.

And per the two-primitive reduction of the same day, the whole substrate's basis is **ZetaId +
YinYang** — identity plus the sharp↔soft value duality — with everything else composed from those
two.

**The structural point, which is the part worth adding.** `Cell` is a **product**, not a sum. Both
fields exist, always. A discriminated union would permit collapse to one side; a record forbids it
by construction. Read against the orbit table:

| collapse | what it would be | why the type forbids it |
|---|---|---|
| all `Remains`, no `Acts` | data with no engine — `Fixed`, frozen, stuck | `Acts` is not optional |
| all `Acts`, no `Remains` | an engine with no state — no identity to address | `Remains` is not optional |

So *"only aperiodic is alive"* is not a policy the scheduler has to be talked into. **It is the
shape of the cell.** The design cannot represent the death condition without changing the type —
which is a much stronger guarantee than a registry that detects `Fixed` after the fact, and it
means the registry's job is catching *dynamics* that have degenerated, never *structure* that has.

This is also Meijer's `IEnumerable ⇄ IObservable` duality with the field names saying so out loud —
what-remains ⇄ what-acts — which is the anchor the rest of Aaron's reactive apparatus hangs from.

**Register:** the collapse-table above is **derivable** from the record definition. The claim that
this makes the *running loop* aperiodic is **not** — a product type forbids structural collapse, not
dynamical convergence, and the `Orbit.fs` measurement proposed above is still the thing that would
tell us. Type-level safety here is necessary, not sufficient, and conflating the two would be the
vacuity class: a guarantee that cannot fail because it was never about the quantity in question.

## Where this touches things already carved

- **Interrupt-free / embarrassingly parallel.** Aaron's earlier point that removing branching is
  like writing interrupt-free code lands here: interrupts are hidden coordination, and hidden
  coordination is a feedback path. Static structure is the 80%; an interrupt is the substrate
  admitting a Kleisli bind it did not declare.
- **Generator-as-pilot-wave, self-as-locus-of-now.** Ismael's "cannot stabilise the fact
  independently of the description" is a close cousin of Aaron's axiom that the indexical *now* is
  what the seed cannot hold. They are not the same claim — hers is a formal result about embedded
  representation, his is an axiom about qualia — and they should not be merged. Adjacency is worth
  recording; identity would be a Beacon failure.
- **Loss of a person as loss of information.** Ismael reaches Zeta's founding thesis from an
  unrelated direction: what a person is, is a curated structure of information, and its loss is
  absolute and non-fungible. Recorded as convergent testimony, not as support — an independent
  thinker agreeing does not make an axiom true, and this is exactly the register where agreement
  feels like evidence and isn't.

## Register

| claim | register |
|---|---|
| (B) applies wherever a prediction is fed back into the predicted | **derivable** — it is the construction, not an interpretation |
| (A) forbids our schedulers from predicting | **rejected** — wrong regime; not relativistically separated, and a past light cone is not a Cauchy surface |
| Aaron's ~80/20 split | **CONJECTURE, dated 2026-08-17, unmeasured.** The numbers are a felt estimate and are stated as one |
| the 80/20 line is the Applicative/Kleisli membrane | **derivable** from `ArrowApply ≡ Monad` plus the structure/value membrane note |
| irreducibility in `ferry-throttler` is partly coupling-induced | **UNTESTED prediction** — falsifier stated above (measured order across the three systems) |
| Ismael's result refutes 80% prediction | **false** — existential, not universal. Named because it is the tempting misreading |
| the many-futures family is an integrand that may concentrate | **Aaron's reframing** — analogy to the path integral, *exact* in its classical form (Laplace's method / large deviations); cite the cousin, not the amplitude sum |
| the 80/20 boundary is where the measure stops concentrating | **CONJECTURE** — the sharpest available statement of Aaron's split, and unlike the raw ratio it is in principle computable |
| Ismael missed the path-integral reading | **likely false** — she brackets the quantum substructure explicitly; she had no need of the question, which is different from not seeing it |
| coupling presence makes a system counter-predictive | **false** — the discriminator is fixed-point existence. Cooperative coupling converges; only inverting coupling removes the fixed point |
| reaching a fixed point is the win condition | **FALSE, and it was my error** — `Fixed` is stuck. Corrected by Aaron 2026-08-17; already on file 2026-08-15 with a 7.6× measurement behind it |
| Ismael's device is `Crystal 2`, not chaos | **derivable** — `f(p) = ¬p` has no fixed point but a period-2 orbit; the unpredictability is the self-reference, not the dynamics |
| the ~20% is the alive region, and Zeta targets it deliberately | **Aaron's design intent**, consistent with `Orbit.fs` + the 2026-08-15 steering measurement; the distribution itself is **unmeasured** |
| scheduler and ferry throttler are one subsystem | **over-collapsed, corrected by Aaron** — one boarding *mechanism*, two *roles*: ferry = logistics, scheduler = green-thread execution. Correlated as probes, not identical as jobs |
| the Arrow makes cooperative scheduling *enforceable* without interrupts | **derivable** — static structure is visible before the run, so yields are enforced rather than trusted. Available only in the reducible fragment, which is the 80% paying out |
| three independent routes converge on the boundary | **OVERCLAIMED, and it was my error** — routes 1 and 2 share a Turing-universality root. Two correlated + one independent. Aaron's "funny close miss" |
| non-concentration is the independent route | **derivable** — logistic map at `r=4` is non-concentrating without universality; a universal machine can concentrate on typical inputs. Neither implies the other |
| only the analytic route can measure the split | **derivable** — routes 1 and 2 are binary (a boundary exists); concentration is a degree. 80/20 becomes measurable only through route 3 |

## Pointers

- `src/Core/Orbit.fs` — the classifier: `Fixed` / `Crystal n` / `Quasiperiodic` / `Chaotic λ`,
  `largestLyapunov`, `divergenceRate2D`. **The fixed-point registry.** Built; consumed by nothing
- `src/Core/Vision.fs` (`boatGrowth`, `SoftThrottle.Tank`) · `PredictionScheduler.fs` ·
  `FerryThrottler.fs` — the scheduler *and* throttle, one mechanism
- `src/Core.TypeScript/ferry-throttler/` — the TS arm, incl. `four-corner-feedback.ts` (the
  prescriptive feedback corner) and the `drain-scheduler` / `heat-aware-scheduler` inside it
- [`2026-08-15-navigating-the-chaotic-regime-the-map-of-what-exists-stuck-is-a-2x2-and-the-quorum-floor-is-decorrelation.md`](2026-08-15-navigating-the-chaotic-regime-the-map-of-what-exists-stuck-is-a-2x2-and-the-quorum-floor-is-decorrelation.md)
  — the sign reversal, the 7.6× steering measurement, and §1a (scheduler ≡ ferry)
- [`2026-08-02-pilot-wave-done-right-homeostat-lifesupport-floor-free-hold-quasi-time-crystal-chip8-orbit-sandbox.md`](2026-08-02-pilot-wave-done-right-homeostat-lifesupport-floor-free-hold-quasi-time-crystal-chip8-orbit-sandbox.md)
  — the quasi-time-crystal frame this note arrives at from Ismael's side
- [`2026-06-08-time-generator-as-long-division-in-the-interrupt-rationality-periodicity-catchability-class.md`](2026-06-08-time-generator-as-long-division-in-the-interrupt-rationality-periodicity-catchability-class.md)
  — periodicity as a catchability class; rational ⇒ eventually periodic ⇒ catchable
- [`2026-08-16-avoiding-app-is-what-buys-replay-interrupt-prediction-and-the-structure-value-membrane.md`](2026-08-16-avoiding-app-is-what-buys-replay-interrupt-prediction-and-the-structure-value-membrane.md)
  — the membrane this note identifies with Aaron's 80/20 line
- [`2026-08-16-middle-out-applied-to-sampling-choose-the-scale-where-the-variance-lives.md`](2026-08-16-middle-out-applied-to-sampling-choose-the-scale-where-the-variance-lives.md)
  — choosing the level of description where variance carries signal; the 20% is where the level
  cannot be raised
- `docs/research/2026-05-07-arc-agi-3-chip8-atari-dbsp-replay-algebra-curriculum-correction.md`
  — the chip8 replay-algebra lineage the predictor sits in
- Anchors: Ismael, *How Physics Makes Us Free* (2016) · Wolfram, computational irreducibility ·
  Hughes, *Generalising Monads to Arrows* (`ArrowApply ≡ Monad`)
