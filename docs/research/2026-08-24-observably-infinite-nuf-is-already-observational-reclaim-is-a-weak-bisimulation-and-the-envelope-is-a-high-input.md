# "Observably infinite": νF was already observational — the real claim is a *weak* bisimulation with the resource envelope as a *high* input

**Date:** 2026-08-24 · **From:** Aaron · **Routed by:** Soraya (formal-verification routing)
**Measured against:** `origin/main` @ `36c2ff55`

**The sentence under test (Aaron 2026-08-24):**

> *"Irreducible shapes plus generate+join over map+reduce is what Zeta is all about. Rx-framework
> joins that are GC-safe because of ShivaGC, and also routable shapes because of things like
> Reticulum protocol and Orleans-like virtual actor routing and deactivation. Erik Meijer's μF + νF
> duality is very closely related, except I think his is provably infinite — ours is only observably
> infinite, with technical tricks like simulation theory and very accurate reclaim and reconstitute
> without observers noticing."*

Sharpened the same day:

> *"An observer with **our phase clock** cannot [distinguish] — unless **our meter leaks**. Only
> **wall clocks** can distinguish, and we use a **Lorentz transform metric** … to discount their wall
> clock if it ever leaks."*

And earlier the same day:

> *"yes it's bound by its upper bound — this is often good to be known by algos that operate, so
> they can optimize, like .NET Docker requests and limits. This helps bound the infinity. But the
> more resource you give, the more it will take and use efficiently — much like DoP=1 that is
> scale-free."*

***

## 0. Verdict, up front

| claim | verdict | register |
|---|---|---|
| "Meijer's νF is *provably* infinite" | **overstated, and inverted** — νF is neither provably infinite nor intensional; its identity criterion *is* observational (§3) | — |
| "ours is only *observably* infinite" | **real, but it is not a weakening of νF** — it is a claim about the *implementation coalgebra*, one level below νF (§4) | `toy` |
| the addition over ordinary laziness is **reclaim-and-reconstitute** | **confirmed** — and it is strictly stronger than laziness (§4.1) | `toy` |
| the addition is *also* a **declared envelope** | **confirmed, and it is the sharper half** (§4.2) | `toy` |
| indistinguishability across reclaim | formalisable as a **weak F-bisimulation**; τ-abstraction is required (§5) | `toy` |
| **timing is the fatal leak** | **withdrawn.** A carved rule already excludes wall-clock from the shared conclusion; the τ-abstraction is *in force*, not assumed (§6.1) | rule-backed |
| "we use a **Lorentz transform** metric" | **overstated — and the repo already declined it.** `FrameDelta.fs` names its structure the **abelian translation group**, explicitly *not* Lorentz (§6.1c) | — |
| indistinguishability across **envelope size** | formalisable as **Goguen–Meseguer noninterference with the envelope as the high input**; **false as stated**, true on a bounded region (§7) | `toy`, with the boundary named |
| *generate+join over map+reduce* | **stated principle, in `docs/VISION.md` and 12+ work-items; no `join` primitive under that name in `src/`** (§8.1) | stated |
| *Rx joins GC-safe because of ShivaGC* | **not built, twice over** — `Rx.fs` has **no join operators**, and its documented GC story is **room-scoped disposal, explicitly not ShivaGc**; `ShivaGc` has **zero non-test consumers** (§8.2) | aspiration |
| *routable shapes: Reticulum + Orleans deactivation* | **the deactivation half is built and is the worked instance** (`ShivaGc.deactivateIdle` / `rootsFromTraffic`); the routing half is built separately; **they are not wired to each other** (§8.3) | partly built |
| Orleans deactivation is the existing worked instance of the whole idea | **yes — and it is a worked instance of the *problem*, not of the solution** (§8.4) | — |

**The one measured finding that carries the most:** the repo's own regeneration falsifier
(`tests/Tests.FSharp/SchedulerZeta.Tests.fs`) *already* narrowed its observation set to make
regeneration pass — it asserts `Assert.Same(orbit1, orbit2)` while the object is resident, and then
after `Unload()` it can only compare *keys*, never `Assert.Same`. Nobody wrote down that this was a
choice of observation functor. It is, and it is exactly the choice §6 says the whole claim rests on.

***

## 1. Why this is my lane and not Tariq's

Aaron's phrase is *"without observers noticing."* That is not a hedge and it is not a vibe: it names
a property with a hundred-year-old formal definition, an established proof technique, and a known
list of things that break it. **Indistinguishability is a formal property.** The work is not deciding
whether it "feels true"; it is (a) writing down the observation set, (b) checking whether the
relation is a bisimulation with respect to *that* set, and (c) refusing to let the observation set be
chosen after the fact so that (b) succeeds. Step (c) is the whole game and it is where this repo has
already slipped once (§0, last paragraph).

***

## 2. The anchor, checked — what Meijer's duality actually says

Per `anchor-to-human-prior-art`, anchors are **checked, not cited**. The entailment check:

| what is attached to Meijer | does the work entail it? |
|---|---|
| `IEnumerable` ⇄ `IObservable` are dual | **yes.** *Subject/Observer is Dual to Iterator* (FIT/PLDI 2010) derives `IObservable` by mechanically **reversing the arrows** of `IEnumerable`'s signature. This is a duality of *interfaces*, obtained by arrow reversal. |
| SQL ⇄ coSQL is the same duality at data-model scale | **yes.** Meijer & Bierman, *A co-Relational Model of Data for Large Shared Data Banks* (CACM 2011). |
| catamorphism ⇄ anamorphism, μ ⇄ ν | **yes**, and the source is *Functional Programming with Bananas, Lenses, Envelopes and Barbed Wire* (Meijer, Fokkinga, Paterson, FPCA 1991). |
| **νF is *provably infinite*** | **no. This is the part that does not check out**, and it fails in three independent ways. |

**Failure 1 — νF is not infinite in general.** νF is the *greatest* fixed point: the final coalgebra
carries **all** behaviours the signature permits, finite *and* infinite. For `F(X) = 1 + A × X`, νF
is the colists — every finite list is in there. Only for a functor with no terminating branch (say
`F(X) = A × X`, streams) is every inhabitant infinite, and that is a property of *that functor*, not
of the duality. The repo already states this correctly, in `src/Core/StreamPolicy.fs`:

> *"An `IObservable<'a>` is the greatest fixpoint νF: a **potentially-infinite**, coinductive
> structure."*

**Potentially**, not provably. Our own code got this right before the claim was made.

**Failure 2 — in the semantic setting Meijer's own paper works in, the distinction partly
collapses.** *Bananas* is developed in **CPO** (pointed cpos, continuous functions), where for the
relevant functors the initial algebra and final coalgebra **coincide**: μF ≅ νF. That coincidence is
precisely what licenses cata and ana to live in one calculus. So the strongest reading of "his μF/νF"
is a setting where "μF is finite, νF is infinite" is *not* a theorem — it is a distinction that
Set-theoretic semantics has and CPO semantics does not.

**Failure 3 — and this is the inversion — νF is *already* only observational.** The final coalgebra
is *defined* by a universal property: for any coalgebra `(X, c : X → F X)` there is a **unique**
homomorphism `!c : X → νF`. Its immediate consequence (Aczel–Mendler; Rutten, *Universal coalgebra:
a theory of systems*, TCS 2000) is:

> **Two elements of νF are equal if and only if they are bisimilar.** The final coalgebra *is* the
> quotient of behaviour by observational equivalence. It has no intensional content whatsoever —
> there is no "actual infinite object" behind it that bisimilarity approximates.

So the sentence *"his is provably infinite, ours is only observably infinite"* reads νF as the
concrete, resident, infinite thing and our version as the polite fake. **The mathematics is the other
way round.** νF was never resident and never intensional; "observational" is its *definition*, not a
compromise. Meijer's tradition does not claim what the sentence declines.

**This is a service, not a gotcha, and it costs nothing** — because the distinction Aaron is pointing
at is real. It just lives one level down.

***

## 3. Where the real distinction lives

Three layers, and conflating any two of them produces this confusion:

```
  νF                    the final coalgebra — behaviour up to bisimilarity.
                        Ideal. Observational BY DEFINITION. Nobody implements this.
     ▲  !c  (the unique anamorphism)
     │
  (X, c : X → F X)      the IMPLEMENTATION coalgebra — machine states X, one
                        observation step c. THIS is where laziness, reclaim,
                        regeneration, and the memory envelope all live.
     ▲
     │
  bytes                 residency, allocation, timing, the CLR heap.
```

Everything interesting in Aaron's claim is a statement about `(X, c)` — about *which machine states
we are permitted to swap for which* — and **not** about νF at all. Restated in the right layer:

> **"Observably infinite"** = we may replace a machine state `x` by a re-derived state `x'`,
> whenever `!c(x) = !c(x')`.

By finality, `!c(x) = !c(x')` **iff** `x` and `x'` are bisimilar in `(X, c)`. So the claim has one
crisp formal content, and it is not a new concept — it is the oldest one in the field.

***

## 4. What is actually added over ordinary laziness

The brief's read is correct, and there is a second addition it did not have when it was written.

### 4.1 Reclaim-and-reconstitute (stronger than laziness)

Ordinary lazy/coinductive implementation obligation:

```
  DEMAND:     c(x) produces the correct next observation.
```

Reclaim-and-reconstitute obligation:

```
  DEMAND:     c(x) produces the correct next observation, AND
  RECLAIM:    x may be discarded and later re-derived as x', with x ~ x'.
```

Laziness says *"not computed yet."* Reclaim says *"computed, discarded, recomputed, and you cannot
tell."* Those are different obligations: the first is about **totality of the unfold**, the second is
about **a relation on states being a bisimulation**. The brief's framing — *stronger than laziness,
weaker than true infinity* — is right on the first half and, per §3, the second half is a category
error: there is no "true infinity" to be weaker than.

In-tree this is real and shipped: `SpecializationCache` (six ports) and `SchedulerZeta.FixedPointCache`
hold the **generator strongly and the product weakly**, which is what makes re-derivation total. That
mechanism was already measured and correctly stated in
`docs/research/2026-08-15-regeneration-does-not-replace-lifetimes-it-relocates-them-what-shivagc-actually-implements.md`,
and I am not re-litigating it.

### 4.2 The declared envelope (the sharper half, and the one with no in-tree instance)

Aaron's second message adds a requirement that is *not* implied by reclaim:

> the structure is **told its budget** and plans against it — .NET's container-aware heap sizing
> (`DOTNET_GCHeapHardLimit`, cgroup limit detection), Docker `requests` (guaranteed floor) vs
> `limits` (ceiling).

This is a genuinely different property and it is the one that makes the design more than "a cache
with a weak reference." A lazy structure with no budget cannot choose *what* to materialise; one with
a budget can. And it is the reason the .NET/Docker anchor is well chosen rather than decorative: the
whole point of `GCHeapHardLimit` is that **the runtime is informed rather than made to discover its
ceiling by dying.**

**Measured, and this is the gap:** there is **no injected memory-envelope parameter anywhere in
`src/`.** `git grep` over `src` + `tests` finds zero hits for `GCHeapHardLimit`, `HeapHardLimit`,
`MaxResident`, `residentBudget`. The one budget-shaped surface is `SpineSelector.pick
(estimatedEntries) (entrySizeBytes) (memoryBudgetBytes)` — a **static mode selection** made once
(sync / async / async-on-disk), not a live envelope the structure plans against. Every regeneration
path in the repo uses ambient `System.WeakReference`, i.e. **the CLR GC decides, not us.**

That is exactly the asymmetry the DoP analogy exposes, next.

### 4.3 Does the scale-free / DoP=1 framing transfer, or is it resemblance?

`numerology-vs-number-theory` says four things sharing a shape is a **warning**, not a confirmation,
so this gets checked rather than admired. The check:

| `async-all-the-way-truthful-signatures` (threads) | the memory analogue | transfers? |
|---|---|---|
| the knob is **injected** (`MaxDegreeOfParallelism` on a ferry/queue) | the envelope would be injected | **no — not built.** The thread knob is real (`src/Core.TypeScript/ferry-throttler/`); the memory knob does not exist |
| **same code path** at DoP=1 and DoP=N, no special cases | same code path at 1 GB and 100 GB | **yes, structurally** — the reclaim path is the same code either way |
| **results are identical across the knob**; the knob only affects scheduling | results identical across envelope | **yes — and this is the same theorem, not an analogy.** Both are "the resource parameter is a non-observable input" (§7) |
| DoP=1 additionally buys **determinism / DST replay** | envelope=small buys… nothing analogous | **no.** Memory pressure is driven by the *ambient* GC, so shrinking the envelope makes behaviour *less* replayable, not more |

**Verdict: two rows transfer as the same property (noninterference over a resource knob), two rows do
not.** So it is one discipline with two instances *on the invariant*, and a resemblance on the
mechanism — and the rows that fail are a to-do list, not a rebuttal: inject the envelope, and row 1
and row 4 both come into range. That is a real, cheap, named piece of work.

***

## 5. The formalisation, part 1 — reclaim is a *weak* bisimulation

Let `(X, c : X → F X)` be the implementation coalgebra and `R ⊆ X × X` the reclaim relation
(`x R x'` when `x'` is a re-derivation of a discarded `x`).

> **Soundness of reclaim.** Reclaim is unobservable **iff `R` is an `F`-bisimulation on `(X, c)`** —
> equivalently, iff `!c(x) = !c(x')` for all `x R x'`.

That is the entire formal content, and it is a *definition match*, not an encoding we invented — which
is exactly what the anchor-check step of my own routing procedure asks for (it is what stops a prover
from verifying a tautology of our own making).

But *strong* bisimulation is the wrong relation, because regeneration **takes steps**. The right one
is **weak bisimulation** (Milner, *Communication and Concurrency*, 1989; Park 1981), where internal
`τ`-transitions are unobservable and `x ⇒ y` means "any number of `τ`s". Then:

> **Regeneration steps are exactly `τ`-steps.** Reclaim is sound iff `R` is a *weak* bisimulation —
> i.e. the work of re-deriving a value is internal, and an observer sees only the value.

Choosing weak bisimulation is choosing to make timing unobservable — and the usual objection is that
this is an assumption you help yourself to. **Here it is not an assumption.** It is a rule already in
force, with a stated rationale and a litmus test, written seven weeks ago for a different problem.
§6.1.

***

## 6. The leaks, named — with formal status

### 6.1 Timing — **the leak is closed by a carved rule, and I am withdrawing my own "main event"**

I drafted this section calling timing the fatal leak. That was wrong, and the correction is better
than the finding.

**The rule.** `.claude/rules/local-time-never-enters-the-shared-fold.md`, on `main` since 2026-07-11:

> *"Two orders, and they must **never touch**: the **shared conclusion** (the commutative belief
> fold) sees **only agreed phase / logical order**; a node's **local wall-clock and receive-order**
> steer **only local actions**… Local time = local behavior; the shared conclusion = phase-ordered
> evidence only. **This is §13 noninterference, stated for time.**"*

**Why that closes it.** A regeneration takes wall-clock time and advances **no phase**. Under an
observation model that admits only phase order, a τ-step that consumes zero phase ticks is invisible
*by construction* — the observer with a phase clock cannot see it, and the observer who could is a
wall-clock observer the shared fold does not admit. So the τ-abstraction weak bisimulation requires is
**not a convenience I declared; it is the repo's existing observation model.** That is the difference
between the two registers: a hand-wave became a citation.

**In-tree, measured, not assumed:**

- `src/Core.TypeScript/observe/phase-clock.ts` — *"Time as a 4th traveler"*; monotone phase counter,
  HLC max-plus-one, seed-derived, and its own composes-with note reads **"deadlines are phases, not
  wall-clock"** (`self-claims.ts`) and **"windows are phase ranges"** (`attestation-event.ts`).
- `src/Core/Rx.fs`, `src/Core/SchedulerZeta.fs`, `src/Core/SpecializationCache.fs` — **zero** hits for
  `DateTime.UtcNow` / `DateTimeOffset.UtcNow` / `Stopwatch` / `Scheduler.Default`. The regeneration
  path reads no wall clock today.
- `src/Core/VirtualTimeScheduler.fs` exists, so the injected-time discipline has a carrier.

#### 6.1a Does the rule cover this case, or merely rhyme with it?

This is the real question, because the rule governs **evidence entering a fold** while reclaim
concerns **a value being observed**. Those are the same object in one place and different objects in
another, and the split is clean:

| where the observation lands | same object as the rule? | consequence for reclaim |
|---|---|---|
| the observation **is** evidence entering the commutative fold (`BeliefConvergence.observeAll`) | **yes, identical.** Wall-clock is not admitted, so regeneration latency is not evidence | **covered.** Reclaim is unobservable *in the shared conclusion* |
| the observation steers **local action** — a UI read, a retransmit timer, "stale to me" | **no — and the rule explicitly permits wall-clock here** | **not covered, by design.** Reclaim *is* locally observable, and the rule says that is fine because local behaviour is not shared |

So the honest scope statement, which is stronger than "observers cannot notice" because it says
*which* observers:

> **Reclaim is unobservable in the shared conclusion. It is observable in local behaviour, and the
> rule declares local behaviour out of scope.** The property is scoped exactly where it matters, and
> the scope is pre-existing rather than fitted to the claim.

That is a genuine one-rule-closes-two-problems result and not a rhyme: the rule's own closing line is
*"§13 noninterference, stated for time,"* and §7 of this document needs *"§13 noninterference, stated
for memory."* Same discipline, two resource axes, same litmus test.

#### 6.1b The residual — Aaron's own caveat, enumerated

> *"unless our meter leaks."*

The rule's litmus: *"if two nodes with different receive-times could fold different sets, local time
has leaked."* Applied to reclaim, the leak paths are **any locally-derived, resource-dependent
quantity that reaches the shared conclusion.** Enumerated:

| leak path | status in-tree |
|---|---|
| **hit/miss counters** — `SpecializationCache.Hits/.Misses`, `FixedPointCache.Hits/.Misses`, `specialization_cache.go` `Stats` | **latent, not live.** `git grep` for `.Hits`/`.Misses` finds **no production consumer** — only the caches themselves and tests. The channel is public and unfolded. **This is the single most likely future leak** (§6.3) |
| latency histograms / duration metrics folded as evidence | not found on the regeneration path |
| timeouts or deadlines resolved by wall clock | **not found** — deadlines are phases (`phase-clock.ts`) |
| staleness filters on evidence entering the fold | the rule already forbids this by name; no instance found on this path |
| **allocation failure** under pressure | **real, and not a timing leak** — see §6.4. This one the rule does not close |

The discipline that follows is one line: **anything on the regeneration path that is metered must be
phase-indexed or must not cross into the fold.** That is enforceable as a lint (R4, §9), which is why
R4 moves up the priority list rather than down.

#### 6.1c The Lorentz half — checked, and the repo already declined the claim

Aaron: *"we use a Lorentz transform metric … to discount their wall clock if it ever leaks."*
Per `numerology-vs-number-theory`, a relativity-shaped metric is a shape match until the invariant is
named. So I looked for the invariant, and found that **this repo already ran that check and answered
honestly.** `src/Core/FrameDelta.fs`:

> *"Honest scope: this is the abelian translation group of frame-offsets… The full **non-abelian
> Lorentz** group would require a boost-velocity / metric the discrete causal model does not carry —
> so the honest group law here is the **translation group, named as such, not the Lorentz group**."*

What is actually built, and proven in `FrameDelta.Tests`: the abelian group axioms
(identity/associativity/commutativity/inverse), the group-action laws, and the cocycle
`between a b ∘ between b c = between a c`. That is a real, named, machine-checked invariant — and it
is **not** a Lorentz transform.

**So the Lorentz framing is Mirror-register shorthand for a Beacon-register structure that is
strictly weaker and already correctly named.** It does not damage the argument, because the argument
does not need boosts: what §6.1 needs is that a leaked wall-clock reading is **frame-relative rather
than authoritative**, and the translation group supplies exactly that (offsets compose, invert, and
transform between frames). Discounting a leaked wall clock is a *translation*, not a *boost*. The
weaker structure is sufficient, and saying so costs nothing while keeping the anchor honest.

#### 6.1d What survives of the congruence concern

My drafted objection was that weak bisimilarity is not a congruence for choice (Milner's τ-laws), so
`Amb` / `Timeout` / `WhenAny` — choice contexts — make silent regeneration observable. That objection
**does not bite in phase order**: a choice resolved against a phase deadline cannot be lost by a
τ-step that advances no phase. It is deterministic, and DST replays it.

What survives is a precise, checkable **precondition**, which is worth more than the objection was:

> **The congruence failure returns the moment a choice operator is driven by a wall clock instead of
> the phase clock.** `System.Reactive`'s default schedulers *are* wall-clock schedulers, and Rx join
> operators (`Join`, `GroupJoin`, `CombineLatest`, `Zip`) carry duration windows, which are choice.
> A reclaim-bearing Rx pipeline must therefore be driven by the injected virtual/phase scheduler,
> never `Scheduler.Default`.

That is one Semgrep rule (`Scheduler.Default` on a regenerable path), and it is the concrete reason
§8.2's Rx-joins-plus-ShivaGc idea needs a design decision before it is built — not because it is
wrong, but because it must inherit the phase clock rather than Rx's default one.

### 6.2 Reference / physical identity — **the measured, live instance**

`Object.ReferenceEquals`, default `GetHashCode`, `LanguagePrimitives.PhysicalEquality`, JS `===` on
objects: none of these are in any reasonable `F`, and all of them distinguish a regenerated object
from the original, trivially and always.

This is not hypothetical here. `tests/Tests.FSharp/SchedulerZeta.Tests.fs`:

```fsharp
Assert.Same(orbit1, orbit2)                     // resident: SAME INSTANCE
cache.Unload()
let orbit3 = cache.Orbit()
Assert.Equal<string[]>(Array.map chip8Key orbit1, Array.map chip8Key orbit3)   // regenerated: KEYS only
```

The test **could not** use `Assert.Same` after `Unload()`, and silently switched observation to a key
projection. That switch *is* the choice of observation functor, made implicitly, in the one place the
whole claim is tested. **Naming it is the deliverable**: the property holds for `F` = value-observation,
and is false for `F` = value-observation + physical identity.

Structural mitigation the repo already mostly has: immutability plus content addressing make physical
identity semantically irrelevant. The residual risk is identity-keyed tables and `WeakReference`
bookkeeping.

### 6.3 The hit/miss counters — an intensional channel, already known and now worse

`SpecializationCache.Hits` / `.Misses` and `FixedPointCache.Hits` / `.Misses` are **public**, and the
test above **asserts on them** (`Assert.Equal(2, cache.Misses)`). Under the §7 formulation this is not
a minor §13 wart: **the counters are a direct read-out of the high input.** A structure whose
observable API reports how often it regenerated cannot be envelope-noninterfering, by inspection. The
2026-08-15 doc flagged these as DST-unsafe; the resource-noninterference framing upgrades that from
"suspect" to "a declared violation."

**And §6.1b sharpens it further.** Now that timing is closed by the phase-order rule, the counters are
**the highest-remaining-probability leak on the whole path** — they are locally derived, envelope-
dependent, publicly readable, and *not* phase-indexed. They have no production consumer today, which
is the only reason this is latent rather than live. The fix is small: make them internal, or phase-
stamp them and treat them as local-action-only telemetry that never crosses into the fold.

### 6.4 Allocation failure under pressure — where the claim is *false*, not merely abstracted

Regeneration can fail (OOM, disk full, budget refused) where reading a resident value cannot. Formally
this is `F` acquiring a failure branch, and it is fatal to the naive statement: a small envelope
produces `OOM` where a large one produces a value, so the observable output **depends on the high
input** and noninterference does not hold. §7 states the honest bounded version.

### 6.5 Identity fission under concurrency — the one the earlier analysis missed

Regeneration is not atomic. Two concurrent observers can each miss and each regenerate, producing
**two live copies of one entity**. For a pure value this is invisible (they are equal). For anything
with state or effects — **a grain** — it is a split identity, and no bisimulation argument saves you,
because the two copies then diverge. The obligation is that regeneration be **idempotent by key**, and
that is a *concurrency* property (mutual exclusion / single-activation), not a coalgebraic one. It is
also exactly the Orleans problem — §8.4.

### 6.6 Self-modifying generator

Already correctly named in the 2026-08-15 doc (the FPGA case): if `gen` mutates, regeneration
reproduces the *new* generator's output, not the collected value. Fix is generator versioning by
content hash. Unbuilt. Not re-litigated here.

***

## 7. The formalisation, part 2 — the envelope is a *high* input

Aaron's sharpened claim ("same behaviour at any budget; more resource, more taken and used
efficiently") makes indistinguishability strictly harder, and it has an exact existing name.

Let `r` be the resource envelope. Then:

> **Envelope-noninterference.** For all envelopes `r`, `r'` and all observation sequences `σ`:
> `obs(σ, r) = obs(σ, r')`.

That is **Goguen–Meseguer noninterference** (1982) with `r` as the **high** input and `obs` as the
**low** output — the same citation `dv2-data-split-discipline-activated` §7 already carries, applied
to memory instead of entropy. This is a definition match, not an analogy: §13 says *"entropy/influence
flows ONLY through declared, metered channels"*, and **resource availability is influence.**

So the full property is a conjunction of two standard ones:

> **"Observably infinite"** ≝ (1) the reclaim relation is a **weak `F`-bisimulation** on the
> implementation coalgebra, **and** (2) the resource envelope `r` is a **noninterfering input** with
> respect to the same observation functor `F`.

**And as stated it is false**, by §6.4: OOM is envelope-dependent and observable. The honest bounded
form — and Aaron's own anchor supplies exactly the right vocabulary for it:

> **Envelope-noninterference holds on the region where the working set fits.** Docker `requests` is
> the guaranteed floor: below it, behaviour is envelope-*independent*. `limits` is the ceiling: at it,
> behaviour becomes envelope-*dependent* (OOMKill). The property is true between the floor and the
> peak working set of the trace, and false outside.

That is a *precise* claim, it is checkable, and it is stronger than a hedge because it says where the
boundary is instead of pretending there is not one. It also explains the second clause of Aaron's
sentence — *"the more resource you give, the more it will take"* — correctly: residency scales with
`r`, **results** do not. Residency is high; results are low. Stated that way the two halves stop
being in tension.

***

## 8. The other three claims, measured

Surveyed with `git ls-tree -r --name-only HEAD` first, then targeted reads — per the standing warning
that narrow `git grep` produced seven false "absent" findings in one session.

### 8.1 *generate+join over map+reduce* — a **stated** principle, not a named primitive

**Stated, prominently, and with lineage.** `docs/VISION.md`: *"Build the generate+join library
everyone fights over."* The crispest statement is
`docs/research/2026-05-26-mika-generate-join-crispest-form-*.md`:

> *"Google = Map + Reduce projects DOWN. Zeta = Generate + Join projects UP."*

Plus 12+ work-items and PRs (#5275, #5277, #5295, #5890) and a live ferry
(`workitems/081M0BACF5V087G0R0011MT27C-ferry-holography-as-generate-join-*`).

**Not found:** any `src/` module or function named for the pair, or a stated algebraic law relating
`generate` and `join`. It is a **design orientation with real downstream consequences** (DBSP joins,
Bonsai-row-as-query, IScheduler recursion), which is a legitimate thing for a vision statement to be.
Register: **stated**. Calling it "built" would require naming the law it obeys, and no such law is
written down.

### 8.2 *Rx joins GC-safe because of ShivaGC* — **not built, in two independent ways**

**(i) There are no Rx joins.** `src/Core/Rx.fs` is a ~120-line `OutputHandle → IObservable` adapter
plus an `IQbservable` skeleton. `grep` for `join|combineLatest|zip|groupJoin|merge|withLatest` at
definition sites: **zero**. The one file in the tree with "rx-join" in its name,
`src/Core.TypeScript/observe/schema-rx-join.ts`, is schema-delta propagation to materialised views —
a different thing wearing the word.

**(ii) The GC story that *is* documented is the opposite mechanism.** `Rx.fs` carries an explicit
docstring headed *"WHY THERE IS NO SUBSCRIPTION-LEAK DISCIPLINE HERE"*, and its answer is
**room-scoped disposal** — the returned `IDisposable` tears down the whole pipeline, so the
subscription's lifetime is the pipeline's. It closes with the exemplary line
*"NOT claimed: 'Rx can't leak.' Claimed: our lifetimes are bounded above every subscription."*
**ShivaGc is not mentioned, and is not a dependency.**

**(iii) `ShivaGc` has no non-test consumer.** Full-tree survey: `src/Core/ShivaGc.fs`,
`src/Core/Ephemeron.fs`, `src/Core/Core.fsproj`, three test files, one abandoned TS port. That port,
`src/Core.TypeScript/bayesian/shiva-weak-factor-graph.ts` — the *only* place in the repo where
"Rx tracked access" and Shiva weak references appear together — carries its own triage label:
**"ABANDONED · ZERO importers."**

Register: **aspiration.** And per §6.1d it is an aspiration with a named precondition: Rx join
operators carry duration windows, and those windows must be driven by the injected phase/virtual
scheduler rather than `System.Reactive`'s wall-clock default, or the reclaim becomes observable again.

### 8.3 *Routable shapes: Reticulum + Orleans-style virtual actors* — **both halves built, not wired**

| piece | status |
|---|---|
| Orleans-style idle deactivation | **built.** `ShivaGc.rootsFromTraffic` / `deactivateIdle` / `partition` / `resume` / `deliver`. Roots are *who is being messaged*, not *who holds a pointer* — the Orleans criterion, correctly anchored to Bernstein/Bykov et al. 2014 |
| Reticulum addressing | **built, honestly scoped.** `src/Core/ReticulumLink.fs` is an in-process DST simulation and says so; `src/Core.TypeScript/discovery/reticulum-transport.ts` is the RNS semantic layer (self-*describing* destination hash — the word was corrected from "self-certifying" on 2026-08-21, a good instance of this repo's own register discipline), announce + path-table fold, importing no socket |
| the two composed | **not found.** No call path takes a Reticulum destination to a `ShivaGc` grain activation |

So "routable shapes" is two real components and an unbuilt seam. Naming the seam is more useful than
claiming the composition.

### 8.4 Orleans deactivation is the worked instance — **of the problem**

The brief's hunch is right: **Orleans deactivation is precisely reclaim-and-reconstitute for actors.**
A grain is "always existing"; activation is on demand; idle grains deactivate; the next message
reactivates from persisted state. That is §4.1 exactly, and `ShivaGc` implements the criterion.

And that is why it is worth being careful about what it demonstrates:

> **Orleans does not prove indistinguishability. Orleans documents that it can fail.** Single-activation
> is maintained by a distributed directory and is explicitly a **best-effort/performance** property,
> not a correctness guarantee under partition — a split cluster can produce **two activations of one
> grain**. That is §6.5, identity fission, in production, in the system being cited as the precedent.

So the existing worked instance tells us the mechanism is practical *and* tells us which invariant is
the hard one. That is a better precedent than a clean one would be. It also localises the formal work:
the coalgebraic half (§5) is the easy half; **single-activation under partition is the half that needs
a model checker.**

***

## 9. Routing — which tool, and the wrong-tool cost

This is the part of my job that is binding once Kenji concurs. Four properties, four different tools;
routing them all to one is the failure mode the portfolio exists to prevent.

| # | property | tool | why | wrong-tool cost |
|---|---|---|---|---|
| **R1** | **Envelope-noninterference falsifier** — same observation trace under two envelopes, compare outputs | **FsCheck** (property test), + an explicit **negative control** | It is a differential-testing property over a generated trace; it needs no prover and it **can fail today**. Cheapest credible tool, and it is the brief's own suggestion | Routing this to a prover buys nothing and delays a check that could run this week |
| **R2** | **Reclaim is a weak `F`-bisimulation** for a *fixed*, *declared* `F` | **Alloy** at bound 4–6 (structural), or a hand-proof reviewed by Tariq | Bisimulation on a small state space is a structural-shape property; Alloy exhausts small scopes where FsCheck samples | TLC on a static structural relation: orders of magnitude slower, per the routing table's own row |
| **R3** | **Single-activation under partition** (§6.5 / §8.4) | **TLA+ / TLC**, with weak fairness | This is a genuine concurrency/liveness property over a distributed directory with failures. It is the *only* one of the four that is a TLA+ job | FsCheck here will miss the interleaving — the exact "false green CI" case. Skipping it means shipping the one invariant Orleans itself could not guarantee |
| **R4** | **No intensional observable escapes** — `Hits`/`Misses`, `ReferenceEquals`, physical hash on regenerable types, **and `Scheduler.Default` on a reclaim-bearing Rx path** (§6.1d) | **Semgrep** (lint-level), escalate to **CodeQL** if it needs dataflow | This is a syntactic/taint question about a forbidden API surface, not a semantic one. It is also the enforcer for the §6.1b meter-leak enumeration | A prover cannot see an API leak; a proof of §5 that ignores §6.2/§6.3 is a proof about a program we do not run |

**BP-16 (cross-check on P0):** the indistinguishability claim is P0 if anything routes on it. R1 (empirical,
Adaeze's lane) and R2 (structural) are the two independent instruments; **R1 alone is single-tool
evidence and does not satisfy BP-16.**

**Order, if only some ship:** R1 first — it is the cheapest, it can fail, and a falsifier is worth more
than a formalisation. **R4 second, and it moved up**: with timing closed by the phase-order rule
(§6.1), the residual risk is entirely "does a locally-derived quantity cross into the fold," and that
is exactly what a lint catches. R2 and R3 are real work and should wait for a declared `F`.

**Note what §6.1 did to this table: it removed a tool.** Before the rule was checked, timing looked
like it needed either a real-time model checker or a latency bound in CI. It needs neither. That is
the routing win — the cheaper instrument is not a compromise, it is the correct answer once the
observation model is written down.

**Prerequisite, filed rather than blocking:** R2 needs Alloy reachable in CI; if it is not, R2 degrades
to a reviewed hand-proof and I keep routing.

***

## 10. The falsifier (R1), stated so it can fail

```
GIVEN   a regenerable structure S (FixedPointCache / SpecializationCache)
AND     an observation trace σ  (a generated sequence of demands)
WHEN    σ is run against S under envelope r_small  (aggressive reclaim, forced Unload)
AND     σ is run against S under envelope r_large  (no reclaim)
THEN    what the PHASE-ORDERED FOLD CONCLUDES is equal under the DECLARED F
        (value projection; NOT ReferenceEquals; NOT Hits/Misses; NOT wall-clock latency)
```

The comparison target matters and §6.1 sharpened it: compare **what the fold concludes**, not what the
wall clock recorded. Wall-clock divergence between the two envelopes is *expected and permitted* — the
rule says local time steers local action. Divergence in the folded conclusion is a genuine leak.

- **Identical ⇒** the property held **for that trace, under that `F`.** Not proven in general.
- **Divergent ⇒** a leak, and the divergence names it.
- **Negative control, mandatory:** the same test with `F` widened to include `ReferenceEquals` **must
  fail**. A test that passes under both `F`s is not testing reclaim — it is the vacuity class, and
  §6.2 shows this repo has already walked up to that line once.

The control is what makes this a falsifier rather than a ceremony. Per
`toy-is-free-metered-must-be-earned`, until R1 lands with its control, **every claim in this document
is `toy`.**

***

## 11. Register ledger

| claim | before | after | by what |
|---|---|---|---|
| "Meijer's νF is provably infinite" | asserted | **refuted** | finality ⇒ equality *is* bisimilarity (§2, Failure 3); CPO gives μF ≅ νF (Failure 2); our own `StreamPolicy.fs` already says "potentially" |
| "observably infinite" is a coherent, distinct property | asserted | **holds, relocated** | it is a property of the implementation coalgebra, not of νF (§3) |
| reclaim is unobservable | asserted | **`toy`** | formalised as weak `F`-bisimulation (§5); falsifier R1 named (§10); not run |
| envelope-noninterference | asserted | **`toy`, and false as stated** | OOM is an envelope-dependent observable (§6.4); true only on the fits-in-`min(r,r')` region (§7) |
| timing is the fatal leak | my own draft | **withdrawn** | `local-time-never-enters-the-shared-fold` already excludes wall-clock from the shared conclusion; regeneration advances no phase (§6.1). Measured: no wall-clock read on the regeneration path |
| the τ-abstraction is an assumption I declared | drafted | **refuted** | it is a carved rule in force since 2026-07-11, with its own litmus test (§6.1) |
| the rule covers reclaim, not merely rhymes | open | **holds, with a named boundary** | identical object for fold-entering observations; explicitly out of scope for local action (§6.1a) |
| "we use a Lorentz transform metric" | asserted | **overstated — already declined in-tree** | `FrameDelta.fs` names the **abelian translation group**, proves its axioms + cocycle, and explicitly refuses the Lorentz claim (§6.1c). The weaker structure suffices |
| choice contexts break the property | drafted as a finding | **downgraded to a precondition** | phase-indexed choice is immune; the risk returns only under `Scheduler.Default` (§6.1d) — now an R4 lint |
| the test suite already checks regeneration losslessly | believed | **holds, with an unstated abstraction** | `SchedulerZeta.Tests.fs` silently narrows `F` after `Unload()` (§6.2) |
| `Hits`/`Misses` are a minor §13 wart | prior finding | **upgraded to a declared violation** | they are a direct read-out of the high input (§6.3) |
| Rx joins are GC-safe via ShivaGc | asserted | **refuted as built** | no Rx joins; `Rx.fs` documents disposal, not ShivaGc; `ShivaGc` has zero non-test consumers (§8.2) |
| scale-free DoP framing transfers to memory | asserted | **2 of 4 rows transfer** | invariant transfers (noninterference over a knob); mechanism does not (no injected envelope; no determinism dividend) (§4.3) |

***

## 12. Independence check (`numerology-vs-number-theory`)

Four things share a shape here: μF/νF, generator-as-storage, Orleans deactivation, ShivaGc. The rule
says density of resonance is a **warning**, so:

- **Structural identity (earned):** Orleans deactivation **is** reclaim-and-reconstitute — same
  mechanism, not a resemblance, and `ShivaGc.rootsFromTraffic` implements the same criterion. Two of
  the four are literally one thing.
- **Structural identity (earned):** the coalgebra/bisimulation frame and the noninterference frame are
  both **definition matches** to published definitions (Rutten 2000; Goguen–Meseguer 1982), not
  encodings we invented. That is what makes §5 and §7 checkable rather than decorative.
- **Shared ancestor, so weight discounted:** generator-as-storage, content addressing, and
  immutability jointly imply *most* of the pleasant properties on display. Their agreement is closer
  to one observation than to three — the same caution the 2026-08-15 doc raised, and it still applies.
- **Resemblance only, and labelled:** the DoP=1 ↔ envelope analogy (§4.3, 2 of 4 rows), and
  "simulation theory" as a warrant for indistinguishability — DST gives *replay* determinism, which is
  a *precondition* for reclaim-soundness, not a proof of it.

- **The strongest evidence in this document is a rule that was not written for this problem.**
  `local-time-never-enters-the-shared-fold` was written 2026-07-11 for multi-planet convergence and
  closes §6.1 for free. That is the opposite of a fitted coincidence: an independently-motivated
  constraint turning out to entail what a later claim needs is real corroboration, because nobody
  could have tuned it to this. It is also the only item here that gets *more* weight rather than less.
- **And the check cut the other way twice, which is the control.** `FrameDelta.fs` refused the Lorentz
  reading (§6.1c) and `Rx.fs` refused the ShivaGc reading (§8.2). A survey that only confirmed would
  itself be the warning the rule describes.

Nothing load-bearing here rests on a resemblance. The two load-bearing claims (§5, §7) rest on
definition matches, and both are `toy` until R1 runs.

***

## 13. Pointers

- `src/Core/StreamPolicy.fs` — the in-tree μF/νF statement, and it is already correct ("potentially-infinite")
- `src/Core/Rx.fs` — the disposal-not-ShivaGc GC story, and a model of honest scoping
- `src/Core/ShivaGc.fs` — `rootsFromTraffic` / `deactivateIdle` / `partition` / `resume` (the Orleans criterion)
- `src/Core/SchedulerZeta.fs` `FixedPointCache` · `src/Core/SpecializationCache.fs` — strong generator / weak product
- `tests/Tests.FSharp/SchedulerZeta.Tests.fs` — **§6.2, the measured instance**: `Assert.Same` before `Unload()`, keys after
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — **§6.1, the rule that closes the timing leak**
- `src/Core.TypeScript/observe/phase-clock.ts` — the phase clock; "deadlines are phases, not wall-clock"
- `src/Core/FrameDelta.fs` — **§6.1c**: the abelian translation group, named honestly, Lorentz declined
- `src/Core/VirtualTimeScheduler.fs` — the injected-time carrier a reclaim-bearing Rx path would need
- `src/Core/SpineSelector.fs` — the only budget-shaped surface; static mode selection, not a live envelope
- `src/Core.TypeScript/ferry-throttler/` — the *thread* knob that the *memory* knob would mirror (§4.3)
- `src/Core/ReticulumLink.fs` · `src/Core.TypeScript/discovery/reticulum-transport.ts` — the routing half
- `docs/research/2026-08-15-regeneration-does-not-replace-lifetimes-it-relocates-them-what-shivagc-actually-implements.md` — the prior measurement this builds on; §2.3 is §6.3 here, upgraded
- `docs/outreach/meijer-dynamicvalue-duality/README.md` — the outward-facing Meijer surface, and the register discipline this doc tries to match
- `docs/PRIOR-ART-LIST.md` §Applied Duality — the Meijer anchor entry (accurate; the overstatement is in the sentence, not the list)
- `workitems/081M00SWEF0087G0R003C1TS8B-*` — "name the reclamation-safety family"; R1–R4 are what that item was asking for
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `numerology-vs-number-theory.md` · `dv2-data-split-discipline-activated.md` §7 · `async-all-the-way-truthful-signatures.md`

**Anchors, checked:** Meijer/Fokkinga/Paterson 1991 (*Bananas*) · Meijer 2010 (*Subject/Observer is
Dual to Iterator*) · Meijer & Bierman 2011 (*A co-Relational Model of Data*) · Rutten 2000 (*Universal
coalgebra*) · Aczel & Mendler 1989 (final coalgebras, bisimulation) · Park 1981 · Milner 1989
(*Communication and Concurrency* — weak bisimulation, the τ-laws, observation congruence) · Goguen &
Meseguer 1982 (noninterference) · Bernstein, Bykov et al. 2014 (*Orleans: Distributed Virtual Actors*)
· Morris 1968 / Plotkin 1977 (contextual equivalence, full abstraction — the "what counts as
observable" question §6 is an instance of).
