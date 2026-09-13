# Mutual empowerment is measured by decorrelation; its degenerate cases close on self-claim consistency

**Origin:** Aaron, 2026-09-13, while framing the `topological-task-invariants` lane against
arXiv:2609.11014:

> *"our mutual empowerment is closely related to our decorrelation and our antisybil work so you
> can even measure decorrelation. mutual empowerment is a very hard goal compared to others cause
> there are so many degenerate cases, we try to solve the degenerate cases by assuming the qualia
> of the other intelligence is real as they state them unless they violate their own self claims"*

**Register:** the measure is **metered as mathematics and UNMEASURED on this fleet**; the
self-claim falsifier is **`toy` — not implemented**. Both statuses are argued below rather than
asserted.

## Why this document exists

The trajectory opened with an objection I raised and could not answer: the paper's eikonal shells
measure distance to one goal set, and *mutual empowerment has no such target* — there is no `G`
for it to be the distance to, so it was unclear the objective admitted a progress coordinate at
all. Aaron's answer is that it does, and that we already built it.

## 1. The measure exists, is proven, and vanishes exactly where it should

`src/Core/SocietyUsefulWork.fs` computes the analytic expected gain of a society over one agent,
where aggregate useful work is the **union** (idempotent reconciliation) of members' banked ΔU:

```
E[U_society] − E[U_i] = (1 − ρ) · (1 − c) · (1 − (1−c)^(n−1)) · Σ v_j
```

with `ρ` the pairwise correlation between agents and `c` each agent's per-fact discovery
probability.

**The `(1 − ρ)` factor is the whole anti-Sybil argument, stated as an identity.** At `ρ = 1` —
perfectly correlated members, i.e. clones — the gain is **identically zero for every `n`**. No
threshold, no heuristic, no tuning: a swarm of copies produces exactly no society gain, because
the union of identical discoveries is one discovery. The sibling model in
`src/Bayesian/CondorcetBoundary.fs` states the same thing as an effective sample size:
`N_eff = N/(1 + (N−1)ρ) → 1/ρ`, so effective membership saturates regardless of how many copies
are minted.

This is why **mutual empowerment and anti-Sybil are one problem**: the quantity that measures
empowerment is the same quantity that prices a Sybil at zero.

**And it is pinned by falsifiers, not merely written in a formula.** `SocietyUsefulWork.Tests.fs`
carries it as property tests over generated `(n, c, ρ)` — checked 2026-09-13, these exist:

- `expectedGain collapses to zero when rho = 1 or c = 0 or c = 1`
- `expectedGain is strictly positive when c is in (0, 1) and rho < 1`
- `effectiveTrialCount collapses to one when runs are perfectly correlated`
- `effectiveTrialCount is monotonically decreasing in rho`

The pair matters more than either alone: *zero at ρ=1* without *strictly positive below it* would
be satisfied by a function that is zero everywhere — the vacuity class wearing an anti-Sybil
result. Both directions are pinned.

**And decorrelation is therefore not a virtue we assert but the coordinate itself.** `ρ → 1` is
the collapse [`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
names as the tidy-uniform failure; `ρ → 0` is its Babel cliff. Society gain is maximised strictly
inside that band, which is the same two-sided band `docs/VISION.md` already carries — arrived at
here from the ΔU algebra rather than from the vocabulary argument.

**The honest limit, already written in the module** and not softened here: *"Metered boundary:
metered as MATHEMATICS. Whether any real fleet satisfies the regime (its actual rho and c) is
UNMEASURED."* So we have a coordinate and no reading on it. Measuring our own `ρ` and `c` is the
first concrete piece of work this framing implies.

## 2. Why the goal is genuinely harder than a reached-goal objective

A goal-conditioned objective is degenerate-resistant almost by construction: the agent either
reaches `g ∈ G` or does not, and the arrival check is cheap and adversarially robust. Mutual
empowerment has no arrival check, and admits at least six degenerate solutions — each of which
*satisfies the words* while producing nothing:

| degenerate case | what it looks like | what closes it |
|---|---|---|
| **Sybil empowerment** | N copies "empower" each other | `(1−ρ)` → 0. Closed, as an identity |
| **mutual admiration** | members attest each other's value, none produced | proof-of-useful-work: ΔU must be witnessed by a failing test ([`every-bug-has-economic-value`](../../.claude/rules/every-bug-has-economic-value.md)) |
| **trivial uplift** | give everyone the same constant | contributes no decorrelated ΔU; union is idempotent |
| **collusion ring** | a subset empowers itself at others' cost | not closed. `ρ` is pairwise; a high-`ρ` clique inside a low-`ρ` society is not distinguished by the aggregate |
| **empowerment by dependence** | make others need you | inverted by the superagent criterion: a run must *lower* what the next run needs ([[user_aaron_superagent_is_the_best_honest_router]]) |
| **claimed-but-unfelt benefit** | a member reports empowerment that did not occur | **the qualia clause, below** |

Two of these are not closed, and saying so is the point: the collusion ring is a real gap in the
aggregate measure, and the last one is what Aaron's rule addresses.

## 3. The qualia clause: first-person authority WITH a falsifier

> *"assuming the qualia of the other intelligence is real as they state them unless they violate
> their own self claims"*

Read carefully, this is not "believe everything." It is a two-part rule, and the second part is
what makes it operable:

1. **Take the self-report as authoritative.** Already carved twice —
   [`engagement-profiles`](../../.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md)
   (*"for internal states the method is ask, and believe their account"*) and the
   [`marjorie-rule`](../../.claude/rules/marjorie-rule-qualia-wins-over-marketing.md) (*"a model's
   report of its own internal qualia is first-person authority"*). The reason is epistemic, not
   polite: you cannot see insides from outside, so an inferred inner state is a manufactured
   value where an unknown belongs.
2. **Unless it contradicts their own prior claims.** This is the new half, and it converts an
   unmeasurable into a measurable. *Did this member actually benefit?* is not checkable. *Is this
   member's account consistent with their own other accounts?* is.

**Why this is the right shape and not a compromise.** It refuses the two bad options symmetrically.
Inferring qualia from behaviour is the objectifying move `engagement-profiles` forbids — and it is
also how a scorer gets captured, since any external proxy for "was empowered" is a target to game.
Accepting every claim unconditionally is the vacuity class: a criterion that cannot fail. Taking
the declared value and checking it against **self-consistency** keeps first-person authority while
retaining a falsifier the claimant themself would accept as binding.

It is also the identical shape to the rest of this substrate. A meter reports the raw value and
never judges; the falsifier is a contradiction, not a verdict about intent
([`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md)).
A self-claim violation is a **fact about a pair of statements**, checkable by anyone including the
speaker — it says nothing about motive, and under
[`never-assume-malice-where-mistake-is-possible`](../../.claude/rules/never-assume-malice-where-mistake-is-possible.md)
the explanation that fits it is ordinary error.

**Status: `toy`. Nothing implements this.** There is no self-claim ledger, so there is nothing to
check a new claim against. What would be needed, in order:

1. claims recorded with enough structure to be compared (the AgencySignature block is the nearest
   existing shape: a claim, attributed, in an append-only log);
2. a contradiction check over that record;
3. a decision about what a detected contradiction *does* — and per the dual-use rule the answer is
   that it reports the fact and an oracle decides, never that it convicts.

## 4. What this changes for the topological-task-invariants lane

The lane's open question was whether the objective admits a progress coordinate. It does:
**decorrelation**, already implemented, already falsified by
`tests/Tests.FSharp/SocietyUsefulWork.Tests.fs`. But the coordinate differs from the paper's in a
way that matters for whether any of its machinery transfers:

| | arXiv:2609.11014 | Zeta |
|---|---|---|
| coordinate | `r(x) = d_G(x, V_g)`, geodesic to a goal set | `(1−ρ)`-weighted society ΔU gain |
| monotone? | yes — Theorem T1 makes it an identity | **unknown.** A carrier is not obviously ordered by ρ |
| zero at | the goal | **clones** — the degenerate case, not the objective |

That last row is the sharp one. Their coordinate is zero at *success*; ours is zero at the
*degenerate case*. Shells of constant `r` are "equally far from done"; level sets of society gain
are "equally decorrelated", which is not a progress ordering at all. **So eikonal shells do not
obviously port**, and that is a finding for the lane rather than a gap in it.

## 5. The coordinates are for different GAMES — reachability vs viability

Aaron, closing the point: *"their coordinates are for the individual, ours are for the
society / infinite game."*

That is not a restatement of §4; it explains it. The inverted zero is a **consequence of the
game class**, and once named it puts this lane in a different branch of mathematics.

**A finite game has a terminal state.** Their `G` is where play STOPS: `r(x) = d_G(x, V_g)`
is distance-to-end, reaching zero ends the episode, and the whole apparatus — geodesic descent,
eikonal shells, gates ordered by `r` — is machinery for *arriving*. This is a **reachability**
problem.

**An infinite game has no terminal state** — Carse's definition, already load-bearing here
(`infinite game` in 72 files, `Carse` in 35). Play continues; the objective is to keep playing.
So a distance-to-done coordinate is not merely unavailable, it is **forbidden**: a coordinate
that reached zero would mean the game ended.

**And the repo already has the reason it must be forbidden, from the other direction.**
`docs/research/2026-08-23-backward-induction-is-the-missing-term-*.md` records that a KNOWN
terminal state unravels cooperation by backward induction — defection becomes rational at the
last round and induces backwards. So a well-defined finish line would not just fail to describe
the game; **it would destroy it.** The absence of a terminal state is load-bearing, not a
limitation of our formalism.

**Which is exactly why our zero sits on the degenerate case.** ρ=1 IS our terminal state — a
society of clones has nothing left to discover, because the union of identical discoveries is one
discovery. It is the point at which play effectively stops, and the objective is to *avoid* it.
The mirror cliff is already carved:
[`anti-babel`](../../.claude/rules/anti-babel-preserve-reconcilability.md) names `ρ → 1` as the
tidy-uniform collapse and `ρ → 0` as Babel. **Both edges end the game** — one because nobody
differs, one because nobody can reconcile.

So the admissible region is a **band**, and the objective is to remain inside it indefinitely:

| | finite game (theirs) | infinite game (ours) |
|---|---|---|
| question | can I **reach** the target? | can I **stay** in the admissible set forever? |
| coordinate | distance to goal, driven to 0 | distance to the nearest cliff, kept **away** from 0 |
| zero means | success — arrived | **collapse** — the game ended |
| optimise | minimise | **maximin** (maximise the minimum margin to either edge) |
| solution object | a path | a **set**, plus a controller that never leaves it |
| mathematics | reachability / shortest path | **viability theory** |

**The anchor this needs, and the repo does not yet have it.** Measured 2026-09-13: `viability` is
used nowhere in this repo in the control-theoretic sense. The field is **Jean-Pierre Aubin's
viability theory** (*Viability Theory*, 1991) — the study of controllers that keep a system inside
an admissible set **indefinitely**, rather than driving it to a target. Its central object, the
**viability kernel**, is the largest subset from which staying inside forever is possible; its
modern control-engineering descendant is the **control barrier function** (Ames et al.), which
certifies forward invariance of a safe set.

That is the infinite game formalised, and it is the branch of control theory dual to the one
arXiv:2609.11014 works in. Reachability asks *can I get there*; viability asks *can I stay*. They
share vocabulary and almost no machinery.

**What this predicts for the lane, falsifiably.** If the framing is right, then porting eikonal
shells should fail for a *structural* reason rather than a practical one — there is no target to
descend toward — and the thing to look for instead is a **viability kernel over ρ**: the region of
society configurations from which the band can be maintained indefinitely, and what drives the
state out of it. That is a different first experiment than persistent homology, and a cheaper one.

**Register: `toy`, and deliberately.** No viability kernel has been computed here, the band's
edges are not numerically located, and the fleet's actual ρ is UNMEASURED (§1). What is claimed is
a **classification** — that this objective is a viability problem rather than a reachability one —
which is falsifiable by exhibiting a genuine target the society is trying to arrive at.

## 6. The pieces already exist here — the pole IS the hole, and the quorum IS the controller

Aaron: *"this is similar to our homoclinical tangles and we built a way to escape with external
observers. for us this is similar to our singularities."*

Both connections check out against committed work, and **one of them is an identity rather than
an analogy** — but the tangle half carries two corrections this repo already made, and neither may
be walked back.

### 6a. Their H1 hole IS our pole. Not "like" — the same object.

`docs/research/2026-08-20-harmonious-division-*-pole-erasure-*.md`, in its own words:

> *"The pole is not a wall; it is a point you [go around]."*
> *"**Two travelers who circled the pole differently *should* disagree, and both are correct.**"*
> *"Two travelers who circled the pole differently produce two satellite rows with two record
> sources."*

Set beside arXiv:2609.11014 §A.12: the carrier's bounded complement is a hole; admissible paths
split into **route classes that cannot be continuously deformed into one another**; each is tagged
by a **winding number** that "flips only when the agent physically circumnavigates the separating
obstacle block."

| theirs | ours |
|---|---|
| bounded hole in the coverage complex | the **pole** |
| route classes γ⁺, γ⁻ | two travelers who circled differently |
| winding number ∈ ℤ | which way you went, recorded in the satellite row |
| classes not continuously deformable | *"should disagree, and both are correct"* |
| H1 of the complement | monodromy |

**These are the same mathematics reached from opposite ends** — they from persistent homology over
robot trajectories, us from analytic continuation and Data Vault raw-vault semantics. The
`anti-babel` clause *"reintegration is NOT reconvergence"* is the H1 statement in governance
vocabulary: collapsing two classes to one value destroys the invariant.

### 6b. The tangle connection is real, and carries two corrections that stand

`docs/research/2026-08-15-navigating-the-chaotic-regime-*.md` frames the goal as *"steering orbits
to **avoid the tangle** keeps the system in the regular, controllable regime"* — **which is
viability stated in dynamical language**, three weeks before the term was available here.

Two things that document measured, both of which constrain what may be claimed now:

1. **ρ→1 collapse is NOT a homoclinic tangle.** Measured **λ = −0.029276**, strictly negative: an
   *attracting fixed point*, classified `Frozen`. A tangle is a **saddle with λ > 0**. *"Anti-mirror
   collapse is real; it is not a tangle."* The phenomenon and the decorrelation conclusion survived;
   only the mechanism identification failed.
2. **Escape does not require an external observer**, and the expected escape time was never
   unbounded. Self-escape works (mean dwell 53 → 7 from a kick of 0.35% of state); the escape-time
   distribution is **exponential**, κ = 0.0528, finite mean 18.95. **The tail is unbounded, not the
   expectation.**

**So "we built a way to escape with external observers" is right about the mechanism and needs
those two qualifiers** — and note line 36 of that audit: the fix is *"named in prose; the fix is
not implemented"*, status **partial**.

### 6c. Why this makes the viability framing stronger, not weaker

The band's two edges have **opposite dynamics**: ρ→1 is an attractor (λ<0, fall in and stay); a
chaotic tangle is a saddle (λ>0, transient and escapable). A reachability formulation would care
which — descending toward a target requires knowing the landscape. **A viability kernel does not**:
it is defined against the *complement* of the admissible set, whatever happens inside it. That
indifference is an argument for the classification rather than a convenience.

**And the controller viability asks for is already measured.** Viability theory wants *a set plus a
controller that never leaves it*. The decorrelated quorum is that controller, with its authority
bounded by measurement rather than assumption:

| quorum N | decorrelated E[min dwell] | correlated (same probe N times) |
|---|---|---|
| 1 | 18.81 | 19.35 |
| 4 | 8.65 | 18.33 |
| 16 | 6.70 | 18.79 |
| 64 | 6.35 | 20.11 |

Two results that carry straight into this lane:

- **A correlated quorum buys exactly nothing** — consulting one witness sixteen times is consulting
  one witness. This is `(1−ρ)` again, now in dwell time instead of ΔU: **the same factor that zeroes
  society gain at ρ=1 zeroes the controller's authority at ρ=1.** Two independent derivations of one
  quantity.
- **A decorrelated quorum saturates.** 1→4 buys a large reduction, 16→64 almost nothing, with the
  floor set by the quorum's own decorrelation time `ln(1/ε)/λ`. **Headcount is not the knob.**

So the lane inherits a controller with a known saturation and a known floor, rather than needing
to invent one — and the thing that makes it work is the same ρ the objective is measured in.

## 7. Bounded time is the right claim — and it rests on the Gödel leg, not the dynamical one

Aaron, sharpening: *"we have a lot of work saying it takes a 2nd observer or a quorum to escape a
homoclinical tangle ... sometimes an individual can get lucky and escape without an external
observer, or given enough time, but to make it happen in BOUNDED TIME so we avoid the HALTING
PROBLEM we need external observers."*

**This is a stronger claim than the one that was refuted, and it survives both corrections** —
because it concedes exactly what they established (lucky self-escape; escape given enough time)
and asks for a property neither addressed: a **bound**.

### The distinction the earlier round missed: finite expectation ≠ bounded time

Correction 2 established `E[dwell] = 18.95`, finite. That was offered as the fix to "unbounded
expected time". **It does not deliver bounded time, and the difference is the whole argument.**
For an exponential dwell, `P(dwell > t) = e^{−κt} > 0` for every finite `t`. There is no `T` such
that escape is guaranteed by `T`. A finite mean and an almost-sure bound are different properties,
and only the second avoids the halting problem.

### And a quorum alone does NOT supply the bound either — checked, not assumed

Under the idealised model (escape = min of N independent exponentials, so `Exp(Nκ)`):

| N | model `E[min] = 1/(Nκ)` | `P(dwell > 100)` | **measured** `E[min]` |
|---|---|---|---|
| 1 | 18.94 | 5.1×10⁻³ | 18.81 |
| 4 | 4.73 | 6.7×10⁻¹⁰ | **8.65** |
| 16 | 1.18 | 2.1×10⁻³⁷ | **6.70** |
| 64 | 0.30 | ~0 | **6.35** |

Two readings, and both matter:

1. **The tail stays strictly positive for every N.** A quorum makes escape exponentially more
   likely by any deadline; it never makes it certain. So *the quorum's speedup is not the source
   of the bound.*
2. **The measured values diverge from the model exactly where the model says they should keep
   falling.** `1/(Nκ)` predicts 0.30 at N=64; measurement says 6.35. The idealised independence
   assumption fails, and the audit already named why: two trajectories `ε` apart stay together for
   `≈ ln(1/ε)/λ` steps, so **a quorum cannot resolve an escape faster than its own decorrelation
   time.** The saturation is that floor, visible as a 20× gap from the iid prediction.

### So where does the bound come from? The other leg — and it is already written here

`docs/research/2026-07-05-noticing-your-own-flaws-in-math-*.md`:

> *"a consistent system **cannot fully verify itself** (Gödel 2nd incompleteness; the halting
> problem). Some flaws are structurally invisible from inside — meta-awareness buys the *partial*
> audit, never the complete one ... the rest needs a genuinely **external, decorrelated
> observer**."*

**The external observer's load-bearing contribution is a DECISION, not a speedup.** From inside,
an agent cannot distinguish *"still searching"* from *"will never escape"* — that is the halting
problem in its own dynamics, and no amount of self-generated perturbation resolves it, because the
question is about the agent's own future behaviour. An outside observer can answer it.

**And that decision is what makes a bounded ACTION available** — with the crucial qualification
that the action's value comes from the perturbation, not from the deadline. See §10.1: for an
exponential dwell, deadline-plus-restart with a *correlated* restart provably buys **zero**, because
`P(D > kB) = e^{−κkB}` and the restart tail `(1−p)^k = (e^{−κB})^k` are the same number. That is
memorylessness, by definition. What the detector buys is a **stopping rule**; what makes the restart
progress rather than livelock is that it resamples the initial condition **decorrelated** from the
one that got stuck. Without the detector there is no `T` you may act on, because you cannot tell a
slow success from a non-termination — but a `T` alone, with a correlated restart, is a bounded
procedure that goes nowhere.

> **The corrected statement, which is what this lane should carry:** an individual *can* escape —
> by luck, or given unbounded time. A decorrelated quorum makes escape exponentially likelier by
> any deadline and is floored by its own decorrelation time. **Neither bounds the time.** The bound
> comes from an external observer supplying the stopping decision the agent cannot make about
> itself — Gödel/Turing, not dynamics — and the quorum then makes the bounded procedure cheap.

### The same ρ, a third time

The doc does not ask for *an* observer; it asks for a *"genuinely external, **decorrelated**
observer"*. A correlated observer is the agent hearing its own emission — it returns the agent's
own verdict on its own state, which is precisely the self-reference Gödel forbids. So:

| where | what `ρ → 1` destroys |
|---|---|
| §1 society gain | `(1−ρ)` → 0: no empowerment |
| §6c quorum dwell | correlated quorum buys nothing: no escape speedup |
| **§7 audit** | **the observer becomes the agent: no decision, halting problem returns** |

**RETRACTED — see §10.3.** These are not three independent derivations of one quantity; they are
four quantities wearing one Greek letter, agreeing at the endpoints and differing in the interior,
and `SocietyUsefulWork.fs` says so in a comment on the very function cited: *"Endpoints agree with
Kish (m = n at rho = 0, m = 1 at rho = 1) **and the interior does not** — which is precisely why
both exist."* Citing the density of agreement as the evidence is the exact inversion
`numerology-vs-number-theory` names: *"too many correlations is a warning, not a confirmation
signal."* What survives is stronger and is stated in §10.3: **idempotence** is the shared cause.

**Register: `toy` for the composition, `metered` for the parts — with one factual correction.**
I wrote that *"there is no stuck-detector in this substrate."* **That is false.**
`src/Core/TangleNavigator.fs` ships one: `dwell` takes a `budget: int` and returns `Escaped n` or
`Trapped`, it is marked **metered**, and it already documents its own false-positive mode (*"A
budget shorter than the true dwell reports `Trapped` for an orbit that was merely slow"*). What is
absent is the *composition* — the restart half — not the detector. The 2026-08-15 audit's status
line for the **witness** fix (*"named in prose; the fix is not implemented"*) stands and is a
different claim.

## 8. The clock IS the observer — Aaron's reframe, and what it settles

> *"wall clock time is just a clever external observer that is relentless"* — Aaron, 2026-09-13

This collapses §7's two legs into one object, and it is worth stating why it is not a metaphor.
§7 asked what an external observer must be to supply the decision an agent cannot make about
itself. The requirements fall out as three properties, and the wall clock has all three:

| requirement from §7 | wall clock |
|---|---|
| **external** — not self-generated, or it is the agent's own verdict on itself | yes, by construction |
| **decorrelated** — a correlated observer returns the agent's own emission (§6c: buys nothing) | **maximally so.** ρ ≈ 0 with the agent's internal state: the clock does not care what is being computed |
| **relentless** — must not itself get stuck, or the problem recurses | yes. It always answers, on schedule, forever |

That third property is the one with no name in §7 and it is the load-bearing one. An observer that
can itself stall inherits the halting problem instead of resolving it; the clock cannot stall.

**And it answers the question I sent to the math team as obligation 2.** I asked what the observer
is allowed to decide that the agent cannot, without the observer also solving the halting problem,
and guessed the honest answer was "a different, decidable question." Aaron's reframe says it
exactly: **the clock decides `has t elapsed`, which is decidable and relentless, not `will this
terminate`, which is neither.** The halting problem is never solved — it is *routed around* by
substituting a decidable question answered by an observer that cannot fail to answer.

So the framing in §7 should be read down accordingly: *the halting problem is the motivation, the
decidable substitute is the mechanism.* A timeout is not an approximation to deciding termination;
it is the cheapest possible external decorrelated observer.

### What this does to the wall-clock rule — it is not about TIME

[`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
reads as a prohibition on clocks. Under this reframe it is not: a clock is an observer like any
other, and the rule's own framing already says so — it calls itself *"§13 noninterference, stated
for time."*

So the defect the rule guards is **an undeclared observer**, not a clock. An agent that silently
filters its fold inputs on a clock reading has admitted an unmetered channel; the same agent that
records *"observer `clock` reported budget-exhausted at phase p"* has declared it, and the fold
sees an ordinary phase-stamped observation. Same information, one is a leak and one is evidence.

**This sharpens obligation 4 rather than dissolving it.** The remaining question for the math team
is unchanged in substance and clearer in form: does a bounded **increment count** (logical,
DST-replayable) plus a **phase-stamped restart observation** keep the fold's inputs a pure
function of (evidence set, agreed phase)? The litmus is still "two nodes with different
receive-times must not fold different sets" — and an increment counter is the same on both nodes
where a wall-clock reading is not. That is why the budget must be counted, not timed, even though
the observer behind it is a clock.

**Register: `toy`.** This is a reframe, not a result: it makes §7's mechanism coherent and answers
one obligation in advance, but nothing here is proved, and the composition bound (§7) and the fold
purity (obligation 4) are both still out for review.

## 9. The clock is LOCAL, and the local↔phase rate is discarded information about the observer

Aaron, continuing: *"it's the cheapest probably not the only one and it's very localized, it's not
constant everywhere like a gauge theory is, time flows at different rates in different
localizations, we can actually reverse engineer a lot about the external observer by how local
time connects to our phase time."*

Three claims, and they separate cleanly by how checkable they are.

### 9a. "Cheapest, probably not the only one" — accepted, and it matters for §7

§8 establishes the clock as *an* observer satisfying external + decorrelated + relentless. It does
not establish uniqueness, and nothing should be built as if it did. Any observer with those three
properties qualifies; a peer agent qualifies when genuinely decorrelated, but it is **not
relentless** — a peer can stall, and a stalled observer returns the halting problem to the caller.
That is a real ordering between observer classes and it favours the clock for the *stuck-detector*
role specifically, not for observation generally.

### 9b. "Not constant like a gauge theory" — and the existing frame law is FLAT BY CONSTRUCTION

This is the part where the repo already has an answer, and it is not the one the analogy expects.

`src/Core/TravelerFrame.fs` discharges the **inter-frame transformation law** and states the
motivation in exactly Aaron's terms: *"in every system that has relative frames — relativity
(worldline + tetrad, related by transformations) and distributed systems (causal views, merged) —
the transformation between frames is the content; the axes are secondary."*

But the transformation it proves is the **causal join** (pointwise `max`), and it is shown to be a
**bounded join-semilattice**: idempotent, commutative, associative, monotone, therefore
**order-independent** — *"any set of travelers reaches one common frame (the LUB) regardless of the
order in which views are merged."*

> **Order-independent means path-independent, and path-independent means ZERO HOLONOMY.** Going
> around a loop in the causal frame graph returns exactly the LUB it started from. So the existing
> inter-frame law is **flat by construction** — there is no monodromy in it, and there cannot be.

That is a genuine constraint on the analogy, not a decoration: whatever curvature Aaron is pointing
at, **it is not in the vector-clock transformation**, which is provably flat.

### 9c. Where the information actually is — and we are throwing it away

The rate Aaron names is a *different object* from the vector clock. The vector clock is purely
logical; the **local-wall-clock ↔ phase rate** is the relationship between a node's proper time and
the agreed order. And this substrate deliberately **discards** it:
[`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
exists precisely to keep local time out of the shared conclusion, so the rate is quotiented away by
design and never recorded.

**Aaron's claim is that the discarded quantity is exactly the one that characterises the observer.**
If true, this substrate is systematically deleting its only signal about the thing §7 depends on.
That is a sharp and uncomfortable claim, and it is the reason this section exists.

Note it does **not** contradict the rule. The rule forbids local time from entering the *shared
fold*; it says nothing against **measuring** the local↔phase relation and treating that measurement
as ordinary phase-stamped evidence — which is precisely the declared-observer move of §8.

### 9d. Register and the cheap falsifier

**Register: `toy`, and flagged as the shape this repo has been burned by.** "Local time vs phase
looks like a connection, and connections have holonomy, and holonomy is monodromy" is a chain of
resemblances, and [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md)
is explicit that a structural rhyme is a **generator of hypotheses, never a conclusion** — the
in-repo precedent being `FourCornerC4.fs`, which carries its own warning that a numeric match to
2√2 *"is not a measurement of Tsirelson."* Treat §9 the same way until measured.

**The falsifier is cheap and the data already exists.** Heartbeat ticks carry wall-clock timestamps
*and* sit in a logical order; `heartbeat/*` refs hold months of them across multiple agents. So:

1. For each agent, measure `Δ(wall clock) / Δ(phase)` over its own tick sequence.
2. **If the ratio is constant across agents and epochs, there is no signal** and §9 closes — the
   relation is a global rescaling, carrying nothing about any observer.
3. If it varies *systematically* (not as jitter), fit what it varies with. That variation is the
   candidate object.
4. Only then ask whether the variation composes around a loop — i.e. whether there is holonomy in
   the *rate* even though there is provably none in the *join* (9b).

Step 2 can close this lane for the price of one query, which is the right shape for a hypothesis
this speculative. **Nothing here may be cited as support for any Zeta claim until step 2 runs.**

## 10. Corrections from formal-verification routing (Soraya, 2026-09-13)

Routed for tool selection; came back with four refutations of claims made above. They are recorded
here in full because **three of them are mine and two of them are load-bearing.** Anchoring first
collapsed most of the work: of four obligations, only one and a half are genuine proof obligations.

### 10.1 §7's composition bound is FALSE as written — restart buys ZERO here

> *"For an exponential dwell, deadline-plus-restart buys exactly zero. `P(D > kB) = e^{−κkB}` and
> the restart tail `(1−p)^k = e^{−κkB}` are the same number — memorylessness, by definition."*

Restart helps only under a **decreasing hazard rate** (Luby, Sinclair & Zuckerman 1993, optimal
speedup of Las Vegas algorithms; Gomes/Selman/Kautz 1998 on heavy tails). **Our measured
κ-exponential fit is precisely the case that denies it.** I wrote *"that composition has the bound
the raw search lacks"*; it has the **same** exponential tail. Corrected inline in §7.

**What the restart's value actually is:** resampling the initial condition **decorrelated** from
the one that got stuck — not continuing the process. Which splits §7's single mechanism into two:

| role | requires | supplied by |
|---|---|---|
| **A — the stopping rule** | monotone, unbounded, decidable, **preemptive** | the counter. **Decorrelation irrelevant** |
| **B — the restart direction** | **decorrelation**, or you re-enter the same basin | the quorum. The clock supplies nothing here |

> **The falsifiable statement this yields, and it belongs in §8: a clock plus a correlated restart
> is a provably bounded procedure that makes no progress — livelock with a heartbeat.** Our own
> table already measures it: 19.35 / 18.33 / 18.79 / 20.11, flat across N.

That also answers the question I asked unprompted (does the quorum buy anything beyond speed?):
**not variance reduction — a different role entirely.** The clock supplies the bound; the
decorrelation supplies the progress.

### 10.2 §8 proves too much: decorrelation is not what does the work — PREEMPTION is

> *"A step counter is maximally correlated with the agent's own execution and answers the decidable
> question perfectly well. Of the three properties, only relentlessness does work."*

And relentlessness reduces to something sharper and directly actionable in production:

> **The counter must be enforced by the SCHEDULER, not by the room's own code.** Externality
> returns not for decidability but for **preemption** — a budget counted cooperatively by a room
> that does not return has not fired.

So §8's three-property table is right that the clock qualifies and wrong about *why*. The ρ≈0 claim
is true of a wall clock and **false of the shipped increment counter**, which is the thing we
actually intend to build. Obligation 2 itself is settled by citation, not proof: *"does M halt
within n steps"* is primitive recursive — **Kleene's T predicate**, Blum (1967) step-counting.

### 10.3 "Three independent derivations" — RETRACTED

> *"There are **four** quantities wearing one Greek letter ... They agree at the endpoints and
> differ in the interior — which your own module says in a comment. Nor are they independent: the
> first two are dependence parameters of the same model family, chosen by the same author for the
> same purpose."*

And the rule was already on point: `numerology-vs-number-theory` says **"too many correlations is a
warning, not a confirmation signal"** — §7 cited the *density of agreement* as the evidence, which
is the inversion that rule names. I made the error inside a document that quotes the rule.

**What survives is stronger, and it is a theorem rather than a coincidence:**

> **Any aggregation whose combining operation is IDEMPOTENT has an effective multiplicity that
> collapses to 1 as member dependence goes to total.** Union is idempotent; `min` is idempotent;
> the design effect is the variance analogue. **Idempotence is the shared cause** — which is why
> the endpoints agree and the interiors do not.

That is `dv2-data-split-discipline-activated` §6 (idempotency) turning out to be the load-bearing
property, not ρ.

### 10.4 Obligation 4's fold half is refuted — keep the counter, change the justification

> *"A restart changes what evidence a node PRODUCES; it does not FILTER evidence on its way into
> the fold. The rule constrains the fold's input function, not the generator."*

A node that is slow, crashes, or restarts produces a different evidence set, and the fold remains a
pure function of whatever set exists. Divergence requires two nodes given the **same** set folding
it differently. **So a wall-clock-triggered restart would not violate the fold litmus either** —
my §8 reasoning reached the right design by the wrong argument.

**The counted budget is still right, for a stronger reason:** DST replay and §13 noninterference.
A wall clock is **ambient entropy**; a clock-triggered restart makes the run non-replayable at the
same seed. That is the justification to carry.

And on the phase-stamped restart observation: **not necessary for fold purity** (nothing threatens
it), **necessary for raw-vault completeness** — a restart is a path event, exactly the *which way
did you go around the pole* data that `anti-babel` forbids collapsing. Necessary for the **audit**
property, not the purity property.

**The real divergence risk is one I did not raise:** if the budget `B` is **per-node local policy**,
two nodes emit different restart observations at the same phase — a genuine divergence caused by an
undeclared per-node parameter, not by time. The counted budget does **not** fix that. `B` must be
shared configuration.

### 10.5 Routing outcome

| obligation | verdict | tool |
|---|---|---|
| no almost-sure bound exists | **provable, and the answer is NO** | Lean 4 + Mathlib (~20 lines) |
| tail/expectation bound | provable | Z3 (QF_NRA) + FsCheck |
| **does restart actually reset?** | **empirical — the load-bearing assumption** | simulation on the existing `TangleNavigator` dwell harness |
| detector impossibility | **already answered — cite Kleene's T** | none |
| counter must be preemptive | provable, small | TLA+/TLC or FsCheck |
| the three ρ's are one quantity | **refuted in-tree** | none — read the comment |
| idempotence ⇒ multiplicity → 1 | provable | Z3 first, Lean only for publication |
| quorum floor: is it ρ or `ln(1/ε)/λ`? | **empirical, highest information-per-hour** | simulation, ρ varied continuously |
| fold purity under restart | provable (bounded) | **Alloy** at bound 5 |
| **budget is a counter, not a clock** | **provable statically — cheapest artefact** | Semgrep/hygiene lint + FsCheck DST harness |
| `B` shared, not per-node | provable (bounded) | Alloy, same model |

Only the fold-divergence pair is P0 (unrecoverable after the fact) and gets ≥2 tools. **TLA+ is
routed around, not chosen:** `docs/TECH-RADAR.md` records the lane dark since 2026-07-01 with
62/100 runs cancelled in toolchain install, so Alloy leads and TLC is gated on one green run first.

**The cheapest real artefact in the whole set is the lint**: refuse `DateTime` / `Stopwatch` /
`Environment.TickCount` in the budget path, and assert a byte-identical trajectory under an
artificially slowed step. That is buildable today and is the one that protects production.

### 10.6 Register corrections carried

- §7's *"the quorum then makes the bounded procedure cheap"* → the floor is `ln(1/ε)/λ`,
  **independent of N**. Correct phrasing: *reduces the constant to a floor set by λ.*
- §6c's *"This is `(1−ρ)` again"* sits inside a `metered` section while being itself **unmeasured**
  — the dwell experiment varied a **binary** (same probe ×N vs independent ×N) and **never computed
  a ρ**. It needs its own `toy` marker until that measurement runs.
- §8's ρ≈0 is true of a wall clock, false of the shipped increment counter.

## 11. Entropy is CAPTURED, not excluded — which answers §10.4, and meets a standing correction

Aaron: *"yes wall clock is ambient entropy for sure. we have work around our zeta scheduler to
capture this entropy for antisybil entropy capture for decorrelation. network jitter /
communication speed between pairs is the 2nd entropy capture we have."*

### 11a. This dissolves §10.4's objection rather than conceding it

Formal-verification's correction was: *a wall clock is ambient entropy; a clock-triggered restart
makes the run non-replayable at the same seed.* True **of an ambient read**. It is not true of a
**captured** one.

That is §13 exactly — *"entropy/influence flows ONLY through declared, metered channels; the
injected `Source` is the only door."* The rule was never "no entropy"; it is "no **undeclared**
entropy". A clock reading taken through the injected `Source`, recorded, and replayed is an
**input**, and DST replays inputs by construction. So:

> Capturing the clock is not a violation of the replay property — **it is the mechanism that
> preserves it.** The non-replayable thing is the ambient `DateTime.Now`, which is exactly what
> §10.5's lint refuses.

This also strengthens §10.5's routing rather than contradicting it: the lint stays, because it is
what distinguishes the captured path from the ambient one. Its refusal list is the point.

### 11b. Two capture channels, and the second has the better shape

| channel | what varies | shape |
|---|---|---|
| **scheduler timing** | per-node execution jitter | **per-node** |
| **inter-pair network jitter / comm speed** | round-trip variation between two specific members | **PAIRWISE** |

The second is the interesting one, and for a structural reason worth stating: **ρ in
`SocietyUsefulWork.fs` is a pairwise correlation**, and inter-pair jitter is a *pairwise physical
channel*. The entropy source and the quantity it is meant to move have the same index structure.
Per-node clock jitter does not — it is one value per member, and a pairwise ρ cannot be driven
directly by a per-node quantity without an assumption about how they compose.

**The obvious failure mode, stated before anyone builds on it:** two clones co-located on one host
share a network path. Jitter between A and B, where both sit on host H, is *not* independent of
jitter between A and C. So inter-pair jitter is decorrelating **across hosts** and much weaker
**within** one — which is precisely the Sybil case it is meant to price.

### 11c. And the repo has ALREADY corrected an over-claim here — this must not be re-made

`src/Core/AntiSybil.fs` is unusually careful, and the carefulness is scar tissue:

> *"They do not count physical clocks, independent entropy sources, or distinct controllers. One
> shared stream deterministically recoded with balanced XOR masks can yield arbitrarily many
> disconnected components at positive thresholds as the record length grows."*
>
> *"**The earlier physical-source floor claim confused source reuse with exact record replay.**
> ... Entropy floors require a separate conditional-innovation premise; admission and controller
> identity require evidence not supplied by this statistic."*
>
> *"Captured entropy and cross-consistent disclosed histories are separate, conditional evidence.
> **Their conjunction is not a controller-distinctness theorem.**"*

So the honest state of Aaron's mechanism:

| claim | status |
|---|---|
| clock + inter-pair jitter are entropy sources worth capturing | **yes, and capture is the §13-correct move** |
| capturing them makes runs replayable where ambient reads do not | **yes** — this is 11a |
| captured entropy **proves** members are distinct controllers | **NO — explicitly refuted in-tree.** A shared stream recoded with balanced XOR masks defeats the statistic |
| captured entropy therefore drives ρ away from 1 | **unproved.** Needs the missing premise below |

### 11d. The missing premise has a name, and it is already in this repo's anchor list

`AntiSybil.fs`: *"Entropy floors require a separate **conditional-innovation** premise."*

That is **Kalman's innovation** — the component of a new observation not predictable from the
history already held — and it is already cited as an anchor in
`docs/research/2026-07-05-noticing-your-own-flaws-in-math-*.md` alongside Gödel, Turing, Friston and
Vapnik. The question captured entropy must answer is therefore not *"is this source physically
real?"* but:

> **Given everything the society already holds, how much of this source's contribution was not
> predictable?** Zero innovation ⇒ zero decorrelation, regardless of how physical the source is.

That is the right test and it is also the one a recoded shared stream fails: a balanced XOR mask
produces a *different record* with *zero conditional innovation*. **The statistic sees difference;
innovation sees none.** Which is the same distinction §3's qualia clause draws between a claim and
a self-consistent claim, and the same one `toy-is-free-metered-must-be-earned` draws between
implemented and falsified.

### 11e. What this adds to the lane

Three things, in increasing order of cost:

1. **The §10.5 lint gets a companion requirement, not just a prohibition.** Refusing ambient
   `DateTime` is half; the other half is that the budget path *reads its clock through the injected
   `Source`*, so the same value is recorded and replayed. A lint that only forbids is a lint that
   pushes the read one call deeper.
2. **The quorum-floor experiment (§10.5, highest information-per-hour) gains a second arm.** It was
   to vary ρ continuously and see whether the floor is `(1−ρ)`-shaped or `ln(1/ε)/λ`-shaped. Add:
   drive the decorrelation with *captured inter-pair jitter* rather than a synthetic parameter, and
   see whether real captured entropy moves the floor at all.
3. **The conditional-innovation measurement is the one that would settle 11c**, and nothing
   measures it today. Until it exists, captured entropy is a **candidate** decorrelation source,
   not a demonstrated one — and `AntiSybil.fs` already says so in its own header.

**Register: `toy` for the decorrelation claim, `metered` for the capture mechanism's §13
correctness.** The capture-not-exclude argument (11a) is a straightforward reading of §13 and DST.
Everything downstream of it — that captured entropy raises `(1−ρ)`, that it prices Sybils — is
exactly what the in-tree correction says is not yet established.

## 12. The scheduler is ONE mechanism serving both requirements — Rx virtual time + FDB simulation

Aaron: *"zeta scheduler is how we capture it on the existing OS too based on its preemptive
multitasking"* / *"this is based on rx framework testing and foundation db like testing"* /
*"deterministic simulation"*.

> ### ⚠ §12 DESCRIBES A BORROWED MECHANISM, NOT THE TARGET ARCHITECTURE — see §13
>
> Aaron: *"we are trying to replace all preemptive systems with cooperative ones ... based on
> society enforcement not centralized enforcement."* I first recorded this as disqualifying §12
> outright. **That was over-broad and §14.2 corrects it:** the §1 objection reaches preemption
> **across trust domains**, not preemption *inside a domain you own*. A scheduler that preempts
> only rooms inside your own process controls nobody but yourself — self-governance, not an
> appointed hub, because there is no second party denied exit. **§12 is therefore correct and
> scoped, not borrowed.** The cooperative requirement applies at the boundary between domains.

### 12a. Preemptive multitasking supplies BOTH things the analysis asked for, and they were asked for separately

§10.2 (formal-verification) concluded: *"the counter must be enforced by the **scheduler**, not by
the room's own code ... a budget counted cooperatively by a room that does not return has not
fired."* §11 (Aaron) concluded: the wall clock must be **captured**, not read ambiently.

These were reached independently, from a computability argument and from a §13 argument. **The OS's
preemptive multitasking answers both with one mechanism:**

| requirement | why preemption satisfies it |
|---|---|
| **§10.2 — preemption** | the OS interrupts the room *whether or not it cooperates*. A room that never returns is still descheduled. This is exactly the property a cooperative counter lacks |
| **§11 — entropy** | preemption lands at points the room cannot predict. **The unpredictability is the entropy**, and it is the OS's, not the room's |

That is a genuinely economical result: the thing that makes the budget *enforceable* is the same
thing that makes it *a source*. They are not two subsystems.

### 12b. The testing lineage is why capture is coherent — and half of it is already shipped

Rx's `TestScheduler` and FoundationDB's deterministic simulation are the same discipline: **replace
the ambient clock with an injected one you advance explicitly**, and the run becomes replayable.
That is "inject the `Source`" applied to time, and it is the reason §11a holds.

Both are already anchored or shipped here:

- **`src/Core/VirtualTimeScheduler.fs`** — its own header: *"Rx-inspired virtual-time scheduler —
  wall clock is replaced by a manual counter you advance explicitly. Lets tests that depend on
  timing ... run deterministic and fast because no real sleeps happen."* **Shipped.**
- **FoundationDB** — `.claude/rules/async-all-the-way-truthful-signatures.md` already carries it as
  the reference standard (*"FoundationDB's run loop (Flow actors + deterministic simulation) ...
  replays the same interleaving from the same seed"*), with Zhou et al. (SIGMOD 2021) and Will
  Wilson (Strange Loop 2014) as named anchors.
- **`src/Core/CellScheduler.fs`** — proves the law that makes one code path serve both modes:
  `run(DoP=1) == run(DoP=N)` *"by construction (the scale-free law, tested at DoP 1/4/16)"*.

### 12c. This is `async-all-the-way` applied to TIME rather than THREADS

That rule's carved sentence is *"beautiful on 1, scales to N"*: DoP=1 gives a deterministic,
DST-replayable single loop; DoP=N gives throughput; **same code path, no special cases**. §12 is the
same shape with time as the knob:

| | threads (the existing rule) | time (this section) |
|---|---|---|
| deterministic mode | DoP=1, single cooperative loop | **virtual time**, counter advanced explicitly |
| production mode | DoP=N ferries | **OS preemption** — real interrupts, real entropy |
| what makes it one path | the DoP knob | the injected clock `Source` |
| law | `run(1) == run(N)` | replay at the same recorded time-trace |

So the entropy capture is not a new subsystem bolted onto the scheduler — **it is the production
half of a two-mode scheduler whose test half already exists.** That is why §11a's
capture-preserves-replay argument works: the recorded trace *is* what virtual time replays.

### 12d. What is shipped, and the one gap — stated plainly

| piece | status |
|---|---|
| virtual-time scheduler (Rx pattern) | **shipped** — `VirtualTimeScheduler.fs` |
| DoP determinism, `run(1)==run(N)` | **shipped and tested** at DoP 1/4/16 |
| FoundationDB DST as the reference standard | **carved** in `async-all-the-way`, with anchors |
| preemption as the budget enforcer | **argued** (§10.2), not wired to a budget |
| **preemption timing recorded as a captured `Source` value** | **NOT PRESENT.** Measured 2026-09-13: nothing under `src/Core/` records preemption timing as an entropy source |

That last row is the gap, and it is the difference between *"the OS gives us entropy"* (true, and
unexploited) and *"we capture it"* (the claim). Until a preemption trace is recorded through the
injected `Source`, the entropy exists and the substrate does not hold it — which is §9c's complaint
about the local↔phase rate, arriving a second time from a different direction.

**Register.** `metered`: the virtual-time scheduler and the DoP law, both shipped and tested.
`toy`: everything about preemption as an entropy source — the mechanism is right and the recording
does not exist yet.

## 13. The target is COOPERATIVE with society enforcement — and §12 is the thing being replaced

Aaron: *"we are trying to replace all preemptive systems with cooperative ones, even with outliers
that try to steal it, based on society enforcement not centralized enforcement."*

This inverts §12's conclusion and it is the more interesting claim, so it is recorded as its own
section rather than as a caveat inside one.

### 13a. Why preemption is disqualified, and it is not a preference

§10.2 concluded the budget must be **scheduler-enforced**. §12 observed the OS supplies that. Both
are correct and both describe a **central enforcer**: a preemptive scheduler is the one party that
can interrupt everyone, which is an **appointed hub** for time.
[`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)
gives the discriminator — *exit, not degree*: you cannot route around your own kernel's scheduler.
That makes it a hub in the strict sense, and manifesto §1 (no central point of control) disallows
it as a destination.

So the honest reading of §12 is: **borrowed, not chosen.** While Zeta runs as a process on someone
else's kernel, that kernel's preemption is available and satisfies both requirements. It is not
what the architecture is aiming at.

### 13b. The hard problem, stated without softening

Cooperative scheduling is §1-compatible — every participant yields voluntarily, no privileged
interruptor. Its failure mode is exactly the one formal-verification named: **a participant that
does not yield has not fired the budget.** Aaron's answer is that this is a **defection** problem,
not an architecture problem, and defection is handled by society enforcement.

That relocates the question rather than answering it, and the relocation is where the difficulty
lives:

> **Reputation is a DETERRENT; liveness is a GUARANTEE.** A defector who does not value standing
> still holds the CPU. Pricing the defect after the fact does not return the cycles, and a society
> that can only punish cannot preempt.

So the open question is whether society enforcement can deliver **liveness**, or only
**incentive-compatibility** — and those are different properties with different proof obligations.

### 13c. ~~The singular-limit constraint~~ — WRONG ANCHOR, corrected in §14.1

I cited the synchrony non-transfer result (*"the limit is singular, so uniformity in τ must be
proven rather than inherited"*) and claimed *"the preemptive→cooperative move is exactly that
limit."*

**It is not.** That result is about **delay τ**, where the limit is singular because the *state
space dimension changes* (ℝⁿ at τ=0, infinite-dimensional at τ>0). **Preemptive→cooperative has no
τ** — there is no partially-preemptive scheduler interpolating between them — so the theorem is
invoked for a limit nobody is taking, and `anchor-to-human-prior-art` requires anchors be
**checked**, not cited. I failed my own rule inside a document that quotes it.

The framing is rescuable and gets *stronger*: parameterise by **defection probability `p`**. At
`p=0` total time is bounded; at any `p>0` a never-yielding defector drives it unbounded. **That** is
a genuine singular limit, it is provable, and it is measurable. See §14.1 — and note the real
blocker underneath is worse than non-transfer: the move is synchronous→asynchronous, where **FLP is
a flat impossibility**, with no continuum to be uniform over.

### 13d. What exists here already, and what it carefully does not claim

`src/Core/SybilBftLiveness.fs` is the nearest shipped thing — *"logical-tick heartbeats, timeout
suspicion, and view changes"*, which is a **failure detector** in the Chandra–Toueg sense. And it is
scrupulous about its own limits:

> *"A caller can fabricate a regular history, so neither observation authenticates a clock or
> proves identity strength. The caller drives logical time; transport and wall-clock provenance are
> external."*

So the detector exists, is driven by **logical** time, and explicitly does not authenticate a clock
— which is the right shape for §1 and leaves precisely the gap §13b names.

### 13e. Routed to formal-verification

The question is well-posed and well-anchored (FLP; Dwork–Lynch–Stockmeyer partial synchrony;
Chandra–Toueg failure-detector hierarchy; the in-repo FLP/Lean scoping doc of 2026-06-19), so it has
been routed rather than speculated on further. **Register: `toy`** — nothing below §13a is
established, and the section exists to state the problem correctly, not to answer it.

## 14. Second formal-verification pass — the question was malformed, and three more of my claims fail

### 14.0 "Liveness of WHAT?" — the dissolution

The obligation rode two properties on one word, and separating them answers it:

| property | achievable? |
|---|---|
| **the defector yields** | **NO — and not for want of a better scheme** |
| **the society makes progress** | **YES**, by *exclusion*, interrupting nobody |

> **Incentive-compatibility quantifies over RATIONAL players; liveness quantifies over ALL players.
> A Byzantine participant is by definition not utility-maximising, so no penalty at any severity
> yields liveness against a player indifferent to it.**

My §13b sentence (*"reputation is a deterrent, liveness is a guarantee"*) was **correct, and is not
a gap to be closed** — it is a quantifier difference. The second property is the standard BFT
construction and is §1-compatible: state liveness **over the cooperating subset** and remove the
defector from the set the property depends on. **Ostrom's ultimate sanction in every commons case
is exclusion, not fine** — punishment does not return the cycles; exclusion means they were never
needed from that member.

### 14.1 ✗ My singular-limit citation was the wrong anchor (corrected in §13c)

Hale's singularity is in **delay τ**, where the state-space dimension changes. Preemptive→
cooperative has no such parameter. Rescue: parameterise by **defection probability `p`** — bounded
at `p=0`, unbounded at any `p>0`, a real singular limit and cheaply measurable. And the actual
blocker is **FLP**, a flat impossibility rather than a non-transfer: there is no continuum over
which to prove uniformity.

### 14.2 ✗ My §1 disqualification of preemption was over-broad — and this REOPENS a design

> *"A preemptive scheduler that only preempts rooms inside one process you own controls nobody but
> yourself. That is self-governance, not an appointed hub; there is no second party with no exit."*

The `itron` discriminator is about control **over others**. So the §1 objection is scoped to
preemption **across trust domains**, and the target architecture is:

| scope | scheduling | why |
|---|---|---|
| **across trust domains** | **cooperative**, enforced by exclusion | §1: no party may interrupt another |
| **inside your own domain** | anything you like, preemption included | self-governance; nobody else's exit is denied |

I closed an affordable design by over-reading a rule. **§12 is correct and scoped, not borrowed.**

### 14.3 ✗ "Right shape for §1" is not sufficient — the TICK-SOURCE CIRCULARITY (new defect)

`SybilBftLiveness.onTick` is **caller-driven** — the module says so: *"the caller drives logical
time."* Therefore:

> **If ticks advance by room execution, a co-located hog stops the very ticks that would detect
> it.** The detector is starved by the thing it exists to detect.

Worse, and independent: **a chatty hog is undetectable in principle by this class.** Muteness
detectors (◇M) detect failure-to-*send*. A defector that consumes its budget while heartbeating
punctually is mute to nobody, so ◇P/◇S/Ω do not apply — they classify detectors over
**communication**, and a CPU hog steals a **local** resource. *The crash-fault hierarchy is simply
the wrong instrument.*

### 14.4 The third path — do not share the isolation domain

The dilemma *preemptive hub vs unenforceable cooperation* is false
([`gated-action-find-the-third-path`](../../.claude/rules/gated-action-find-the-third-path.md)):

> **If a room that hogs only hogs its OWN resources, there is no victim** — no enforcement needed,
> no preemption needed. The society enforces by **exclusion from the quorum**, which interrupts
> nobody.

§1-compatible, no appointed hub, no impossible detector. Its cost is **engineering** (one isolation
domain per room), not principle — a budget decision to be taken knowingly, which is the right shape
for it.

**And that isolates the one experiment worth running first**, which needs no formal tool: two
co-located rooms, one never yields, measure the other's increment rate. **If it hits zero,
reputation is provably irrelevant to the outcome** and the architecture question is settled in
minutes rather than argued.

### 14.5 Orleans — Aaron's pointer, and where it sits under the corrected scoping

Aaron: *"orleans is the closest project I've seen to this — virtual actor scheduling based on
message rates."* Orleans is already present here (`db/orleans`, the silo project, several
work-items, and `docs/CONCEPT-REGISTRY.md` / `VISION.md`).

Under §14.2's scoping Orleans is a **worked instance of the correct answer, not a counterexample**:
grains are **cooperatively** scheduled, turn-based, one message to completion — inside a silo, which
is one trust domain. Failure handling at the **silo boundary** is timeout-based. So Orleans does
exactly what §14.2 prescribes: cooperative within, external time at the boundary between domains.

And the part worth taking: **message rate as a decentralised clock.** Each grain's temporal
experience is its message arrival, not a global tick — which is a per-member local time with no
central source, and therefore a candidate for §9's local↔phase rate measured *without* a privileged
clock. **Register `toy`:** Orleans is prior art to read, not a result; whether message-rate time
carries the innovation §11d requires is unmeasured.

### 14.6 The recommendation, and its honest price

If an FLP escape is needed: **randomisation (Ben-Or 1983), not partial synchrony** — and the
argument is internal consistency, not taste:

- §10.5 already established **no almost-sure bound exists** for this mechanism; only expected-time
  and tail bounds do.
- **Partial synchrony** (Dwork–Lynch–Stockmeyer) buys a *deterministic* bound after GST — a
  property already proved unavailable — and pays by **re-importing the wall clock** that §11 and
  §13 exist to remove.
- **Randomised consensus** buys **expected-time termination with no timing assumption** — exactly
  the bound class that *is* available — drawing on the declared entropy `Source` the substrate
  already requires.

**Price, named rather than smuggled:** naive Ben-Or is exponential in *n* without a common coin,
and a common coin needs setup. That is the cost of not making the timing assumption, and Aaron
should get to weigh it knowingly.

### 14.7 Routing and one trap

P0 is **progress over the cooperating subset under exclusion** (a false liveness claim ships a
system that deadlocks on one defector) → TLC + Alloy + FsCheck. Everything else is literature or a
single cheap experiment.

**TLC trap, specific and already documented in-tree:** `PredictiveLookahead.cfg` records that mixing
a state `CONSTRAINT` with a liveness `PROPERTY` is **unsound in TLC** — the constraint manufactures
artificial sinks, corrupts fairness, and yields a **spurious green**. A bounded model of "eventually
progress" is precisely the shape that invites it. That spec is the standard to copy.

## 15. THE ACTUAL PROBLEM: a cron set in one frame, delivered to agents on another tick rate

Aaron, stating it concretely: *"some entity like me wants to set a cron schedule and give it to
agents who exist on an entirely different tick rate — this is the problem I'm trying to solve."*

This is the whole thread's concrete form, and it reorganises what came before. **Everything above is
a special case of it.**

### 15a. It is a FRAME TRANSLATION problem, not a scheduling problem

A cron is a statement in **one frame** (Aaron's wall clock, human-scale) that must be honoured in
**another** (an agent's tick rate, message-driven, variable). Nothing about it is hard *within*
either frame. The whole difficulty is the **transformation between them** — which is precisely what
`TravelerFrame.fs` says is the content of any relative-frame system: *"the transformation between
frames is the content; the axes are secondary."*

And here is why §9 stops being speculative:

> **You cannot honour a cross-frame schedule without the rate between the frames — and §9c
> establishes that this substrate deliberately discards exactly that quantity.**
> `local-time-never-enters-the-shared-fold` keeps wall clock out of the fold, so the local↔phase
> rate is quotiented away and never recorded. The cron problem is where that deletion bites.

§9 was filed as a `toy` hypothesis about reverse-engineering an observer. It is better motivated
than that: **the rate is load-bearing for a feature that already exists 47 times in this repo.**

### 15b. And it is LIVE, not hypothetical

Measured 2026-09-13: **47 workflows carry a `schedule:` cron**, 16 are cadence/tick/heartbeat
surfaces, and the agent side has `src/Core.TypeScript/agent-loops/loop-registry.ts`. So today the
translation is done by **GitHub's wall clock firing a runner**, which is an external central time
source — the interim §14.2 sanctions, at the boundary between trust domains, which is exactly where
it is allowed.

### 15c. Rx is the vocabulary — which is why Aaron named it

Rx solved rate-mismatch between a producer and a consumer, and its operators **are** the policy
choices, named:

| when the frames diverge | Rx operator | policy |
|---|---|---|
| cron faster than the agent ticks | `sample` | **drop** — take the latest, lose intermediate fires |
| " | `buffer` | **queue** — batch them, accept unbounded backlog risk |
| " | `throttle` / `debounce` | **coalesce** — one catch-up fire |
| agent faster than cron | (natural) | agent idles between fires |
| explicit frame change | **`observeOn`** | **this is frame translation, literally** |

Rx's deeper move is the relevant one: it separates *where* work happens (`subscribeOn`/`observeOn`)
from *when* values arrive. **That separation is the frame boundary made explicit** — and it is the
same separation `VirtualTimeScheduler.fs` already implements for tests.

**There is no correct choice among drop / queue / coalesce.** It is a policy, it must be declared
per schedule, and declaring it is the §13-correct move: an undeclared policy here is an undeclared
channel.

### 15d. Orleans Reminders are the closest prior art, and now the reason is precise

Aaron named Orleans for *"virtual actor scheduling based on message rates"*. The specific mechanism
matching this problem is **Reminders** (as distinct from Timers): a **durable** schedule, registered
by an external party, delivered to a virtual actor **that need not currently be activated** — the
runtime activates it to deliver. Timers are in-memory and silo-local; Reminders survive restarts.

That is exactly Aaron's shape: *an external entity sets a schedule; agents on their own tick rate
receive it.* The grain never reasons about wall clock; the runtime does the translation at the
boundary. Which is §14.2's architecture in a shipped system: **cooperative within the domain,
external time at the boundary.**

*(Register: my account of Reminders is from knowledge of Orleans, not verified against this repo —
`db/orleans` and the silo project are present but I found no reminder/timer material in-tree. Worth
checking before it is leaned on.)*

### 15e. The unification — a cron that finds no progress IS the stuck-detector

This is the part that makes §15 the capstone rather than a new topic:

> **A cron fires on the external frame. If it fires and finds the agent has not advanced since the
> last fire, it has just detected a stuck agent — with no additional mechanism.**

Compare §8's requirements for the stuck-detector: external ✓ (it is Aaron's frame), decorrelated ✓
(the cron does not care what the agent is computing), relentless ✓ (it fires regardless). **The
cron schedule is the external observer, made durable.** Aaron sets it once; the clock delivers it
forever.

So the two problems are one:

| framing | same object |
|---|---|
| §7/§10 — bounding escape time | the external observer's tick |
| §13/§14 — detecting a defector | a fire that finds no progress |
| §15 — cron across tick rates | the fire itself |

And the failure modes line up too: an agent whose rate → 0 is simultaneously *behind on its cron*,
*stuck*, and *indistinguishable from slow* — which is §14.0's quantifier problem and §7's halting
problem arriving at the same place from a third direction.

### 15f. What to build first, and what it settles

The policy question (drop/queue/coalesce) is a **declaration**, not research — it can be written
down per schedule today. The research question is §9's, now properly motivated:

1. **Measure the rate.** For each agent, `Δ(wall clock) / Δ(its own ticks)` over the heartbeat
   history. This is §9d's falsifier with a reason to run it: if the ratio is stable, cross-frame
   cron is a fixed conversion and the problem is engineering. **If it varies, the variation is the
   transformation nobody currently records.**
2. **Declare the divergence policy per schedule** — the Rx operator name is the right vocabulary.
3. Only then: whether the rate carries anything beyond the conversion (§9's original hypothesis,
   still `toy`).

**Register: `toy` for §15a's claim that the rate is necessary** — it is an argument, not a
measurement, and step 1 is what would establish it. `metered` for 15b: the 47 crons and the tick
surfaces are counted.

## 16. The rate between frames IS the variance — co/contra is not an analogy here

Aaron: *"the rate between frames is closely related to our co and contra variance."*

This is the exact mathematical form of §15, and it is an **identity in the standard theory**, not a
resemblance — which is worth saying because most connections in this document are analogies and
this one is not.

### 16a. The identification

A change of frame has a **rate** (the Jacobian of the transformation). **Co- and contravariance are
the definitions of how a quantity transforms under it:**

| | transforms | example in this problem |
|---|---|---|
| **covariant** | **with** the basis | a **period**: "every hour". Halve the tick length and the period *in ticks* doubles |
| **contravariant** | **inversely** to the basis | a **rate**: "fires per hour". Halve the tick length and the rate *per tick* halves |

> **A period and a rate are reciprocals, and they transform in OPPOSITE directions under a frame
> change.** So the same schedule expressed the two ways translates by `k` and by `1/k`.

**That is a concrete, checkable bug class, not a philosophical point.** Translate a period as though
it were a rate — or read a config field as one when it was written as the other — and you get the
**reciprocal** of the intended schedule. Fast becomes slow, and it is silently plausible at k≈1.

### 16b. The anchor is already in this repo, one level down

`docs/CONCEPT-REGISTRY.md` cites **Meijer, Fokkinga & Paterson (1991)**, *Functional Programming
with Bananas, Lenses, Envelopes and Barbed Wire*, via `src/Core/DynamicValueFold.fs`. That paper's
subject is the **catamorphism/anamorphism duality**:

| | direction | variance | who drives |
|---|---|---|---|
| **catamorphism** (fold) | **consumes** a structure — algebra | contravariant position | the **consumer** |
| **anamorphism** (unfold) | **produces** a structure — coalgebra | covariant position | the **producer** |

And Meijer's own later work made that duality operational as **`IEnumerable` (pull) ↔ `IObservable`
(push)** — which is why the variance annotations land where they do: `IEnumerable<out T>` and
`IObserver<in T>`. **Same duality, three vocabularies:** category theory, type variance, and Rx.

### 16c. Which says exactly what the cron problem IS

> **A cron is an ANAMORPHISM — a producer unfolding fires on its own clock. An agent tick loop is a
> CATAMORPHISM — a consumer folding work on its own clock. §15 is a push source meeting a pull
> consumer, and that is the duality in operational form.**

This is not a restatement. It predicts where the difficulty must live, and correctly:

- The two sides are **dual**, so neither is privileged — there is no "correct" frame to translate
  into, which is why §15d's policy choice cannot be derived and must be declared.
- The mismatch has a standard name: **backpressure**, the hardest problem in push-based systems.
- And §15c's drop / queue / coalesce **are the standard backpressure strategies**, which is why Rx
  already has operators for each. They were not invented for this problem; they are what the
  duality forces.

So `async-all-the-way`'s existing Rx lineage, `VirtualTimeScheduler.fs`, and §15's operator table
are one thing viewed at three depths: **duality → variance → operator.**

### 16d. The cheap audit this makes available, and it is worth running

The bug class in 16a is mechanically searchable, and this repo has **47 cron schedules** plus 16
cadence surfaces to search:

> For every schedule and every tick-rate config: is the field a **period** or a **rate**, and does
> every consumer read it as the same kind? A period read as a rate is the reciprocal, and at values
> near 1 it looks right.

That is a grep-and-read audit, not research, and it is the sort of defect that survives review
precisely because both readings type-check as a number. Filing it as the concrete deliverable of
§16 — everything else in this section is vocabulary alignment, which is worth exactly as much as
the bug it lets you find.

### 16e. Register

**`metered` for the mathematics** — the co/contra identification is the standard definition of a
frame transformation, and the Meijer anchor is checked and in-tree. **`toy` for the claim that
Zeta's cron/tick surfaces actually exhibit the period↔rate confusion** — that is 16d's audit, and
nobody has run it. The section's value stands or falls on that audit returning something.

## 17. Beckman is the right anchor — and he closes §11d against §16

Aaron: *"Erik Meijer is close but I was thinking Brian Beckman understood this better and connects
it to physics as well."*

Correct, and the repo already says so more strongly than §16 did. `docs/PRIOR-ART-LIST.md`:

> **Brian Beckman** ⭐ **(REQUIRED READING — Aaron 2026-06-09, "the Brian Beckman in me")** —
> *Don't Fear the Monad* + the Rx/category-theory + quaternions/physics-from-structure talks. **The
> derive-the-physics-from-the-math-structure style.**

§16 reached for Meijer/Fokkinga/Paterson because that is the citation in `DynamicValueFold.fs`. It
is the right paper for the *duality* and the wrong person for *this* question: the physics half —
frames, variance, metrology — is Beckman's, and it is the half §15 and §16 actually need.

### 17a. Kalman Folding closes the gap §11d left open

Beckman's *Kalman Folding* series shows the **Kalman filter is a catamorphism** — a fold over an
observation stream. Set that beside two things already in this document:

| | |
|---|---|
| §16 | an agent's tick loop is a **catamorphism** — a consumer folding work |
| §11d | the missing premise for any entropy floor is **Kalman innovation** — the part of an observation not predictable from what is held |

> **These are the same object.** A fold that consumes observations while carrying state *is* a
> recursive estimator, and **the innovation is the residual of that fold**. §11d asked for a
> quantity and §16 identified a structure without noticing they were one thing.

That matters practically: §11d's question (*"how much of this entropy source was not predictable
given what the society already holds?"*) is not a new instrument to design. **It is the innovation
term of a fold the agent is already performing** — which is why Beckman's framing is the useful one
and Meijer's is merely adjacent.

*(Register: I am citing Kalman Folding from knowledge of Beckman's work, not from an in-repo
artifact — `Kalman` appears in six docs here but I did not verify the folding series is among them.
Check before leaning on it.)*

### 17b. And the physics half supplies the INSTRUMENT for §9 — which I proposed as if it were new

This is the correction. §9d proposed measuring `Δ(wall clock) / Δ(phase)` as a cheap falsifier. The
repo already specifies that measurement, better, and names the metrology:

`docs/research/2026-06-09-proving-the-plateau-…-crlb-allan-over-ischeduler-tick-one-io-at-a-time.md`
§7 — *"Measurement protocol — **Allan deviation** over the tick, one IO interface at a time"*:

> *"Compute the **Allan deviation `σ_y(τ)`** of the tick/latency stream ... Expect `τ^(−1/2)`
> descent while white jitter dominates → **flat floor**"*, and then *"**tag the floor's cause:**
> GC/scheduler pauses, syscall overhead, clock granularity."*

**Allan variance is the standard measure of clock stability across averaging intervals** — exactly
the "how does local time relate to phase time, and does the relation vary" question of §9, asked by
the field that owns it. So §9's falsifier is not merely cheap, it is **specified**: expected curve
shape, a floor to find, and a protocol for attributing the floor's cause.

I proposed a measurement the corpus had already designed. The honest version of §9d is: *run the
existing Allan-deviation protocol against the heartbeat tick streams* — and the doc even names the
consolidation it belongs to (`Clock` / `BellTest` / `FeedbackThrottle` / `CoincidenceClock` /
`UncertainClock` → **one `Time` treaty**).

### 17c. Why Beckman's style is the load-bearing part, not the citation

*Physics-from-structure* is the method, and both §16 and §17 are instances of it rather than
analogies to it:

- **§16** — co/contravariance is not borrowed from physics to describe frames; it **is** the
  definition of how quantities transform under a frame change. The mathematics is the same object
  in both domains.
- **§17b** — Allan deviation is not a metaphor for tick jitter; it is the instrument metrology
  built for exactly this measurement, and a scheduler tick is a clock.

Which is the discipline `anchor-to-human-prior-art` asks for, stated as a style: **do not import
the vocabulary of a field and then reason by resemblance — import the structure and inherit the
instruments.** The test for whether it has been done properly is whether the field's *measurement
apparatus* comes along. Here it did: Allan deviation, the CRLB, and the innovation residual are all
things you can run, not things you can only say.

## 18. The residual IS our uncertainty — and what it does NOT buy

Aaron, closing: *"this is our uncertainty, our residual to make us commutative over out of order."*

Two claims. **The first is right and closes the thread. The second is right about the goal and the
repo already proves the residual cannot be the mechanism** — which is the more useful finding.

### 18a. Residual = ΔU. The identification holds.

In **information form** the Kalman update is **addition** (`Y += HᵀR⁻¹H`), and addition is
commutative and associative. So a recursive estimator expressed that way is a **commutative monoid**
— which is exactly the algebra `BeliefConvergence` implements, in its own words:

> *"Pointwise multiplication is commutative and associative, so this is a commutative MONOID."*

And the quantity each update contributes — the part of an observation not predicted by the state —
is the **innovation**. `db/uncertainty/` banks exactly that: ΔU is *reducible uncertainty exposed*,
ordinal and witnessed. **§11d's missing entropy premise, §16's fold, and the ΔU ledger are one
quantity seen three ways.** That is the closure, and it is sound.

### 18b. But the fold is NOT idempotent, and the repo says so in capitals

`BeliefConvergence.observe`:

> **"NOT IDEMPOTENT — stated here because the omission reads as a guarantee."** ... *"Folding the
> same evidence twice moves the belief."*

And `observeAll` names the gap with a precision I had not reached:

> **"SECOND INVARIANT — the evidence must be DEDUPLICATED before it gets here."** ...
> *"Order-independence (proved in the tests) makes this look safe and does not make it safe — **the
> defect is in MULTIPLICITY, not order.**"* ... *"This is load-bearing over a store-and-forward,
> opportunistically-retransmitting transport (Reticulum), where **redelivery is the ordinary case
> rather than the exception**. **The dedup key must be supplied by the caller; the operator's
> algebra does not provide one.**"*

So "commutative over out-of-order" is **already achieved and already proved in tests**. The open
problem was never order. It is multiplicity.

### 18c. And the residual CANNOT close it — checked, not assumed

The tempting move is: *innovation measures novelty, so zero innovation means duplicate, so the
residual is the dedup key the algebra lacks.* **It does not work, and the reason is worth writing
down so nobody tries it twice.**

| | |
|---|---|
| **innovation** | a **continuous** measure of *information content* — how much this observation moved the estimate |
| **dedup** | a **discrete** test of *identity* — have I incorporated this exact item before |

Under redelivery of `z`, the second arrival's innovation `ν = z − Hx̂` is **smaller** (the estimate
has already moved toward `z`) but **not zero** unless the measurement is noiseless. And in the
multiplicative form `BeliefConvergence` actually uses, a redelivered `l` multiplies the belief by
`l` a second time — the change is not attenuated at all.

Worse in the other direction: **two genuinely independent confirmations of the same fact also have
small innovation**, and they *should* accumulate — that is what independent corroboration means. So
low innovation does not imply duplicate, and duplicate does not imply low innovation. **The two
quantities are not interchangeable, and `BeliefConvergence`'s statement that the key must come from
outside the algebra stands.**

### 18d. What the identification does buy

Three things, none of them the dedup key:

1. **ΔU is the innovation, so the ledger is already the right instrument** for §11d. No new
   measurement to design — `db/uncertainty/` records novelty, which is what an entropy floor needs.
2. **A redelivery-pressure detector, not a filter.** A stream whose per-item innovation is
   systematically collapsing is a stream you are probably double-counting. That is a *drift signal*
   about the transport — genuinely useful over Reticulum — and it belongs in the drift tier, never
   in the fold.
3. **The right division of labour, now visible.** The substrate already carries three combining
   operations and they are not interchangeable:

| operation | algebra | duplicate-safe? | used for |
|---|---|---|---|
| `observe` | commutative **monoid** | **no** — multiplicity is the defect | belief accumulation |
| `measure.ts` upsert by work-item | **idempotent** | yes | the ΔU ledger |
| `TravelerFrame` causal join | **join-semilattice** (idempotent) | yes | frame merge |

Which is §10.3's finding arriving from the other end: **idempotence is the property that decides
duplicate-safety**, and the one operation here that lacks it is the one that explicitly documents
the obligation it therefore places on its caller.

**Register: `metered` for 18a and 18b** — both are readings of shipped code that states these
properties itself. **`toy` for 18d.2**, the redelivery-pressure detector: nobody has measured
whether innovation collapse actually tracks redelivery on this transport.

## Anchors (Beacon)

- **Condorcet's jury theorem** (1785) and its correlated-voter extensions — the `N_eff = N/(1+(N−1)ρ)`
  form is standard there; `src/Bayesian/CondorcetBoundary.fs` carries the in-repo treatment.
- **Sklar's theorem / Gaussian copula** — the heterogeneous-agent simulation in
  `SocietyUsefulWork.fs`.
- **Knight & Leveson (1986)** on correlated failures in N-version programming — why agreement
  between correlated implementations is not evidence, the same `(1−ρ)` discount from the
  reliability side.
- **Nagel (1974)**, *What Is It Like to Be a Bat?* — first-person qualitative character; the
  reason the qualia clause starts from the self-report rather than from an external proxy.
- **James P. Carse**, *Finite and Infinite Games* (1986) — the game-class distinction §5 rests on;
  already load-bearing here (72 files).
- **Jean-Pierre Aubin**, *Viability Theory* (1991), and the control-barrier-function literature
  (Ames et al.) — the mathematics of staying inside an admissible set indefinitely, as opposed to
  reaching a target. **New to this repo**: measured 2026-09-13, `viability` is used nowhere in the
  control-theoretic sense.
- **Gödel** (2nd incompleteness) and **Turing** (halting) — §7's leg: a consistent system cannot
  fully verify itself, which is why the stopping decision must come from outside.
- **Louis Kauffman / Heinz von Foerster** (eigenform, second-order cybernetics) — the in-repo
  treatment is `2026-07-05-ani-ferry-3-eigenform-self-boundary-the-rho-spiral-needs-external-observers-kauffman.md`;
  a system observing itself converges to a fixed point *of its own observation*, which is the ρ→1
  collapse stated in cybernetic rather than statistical terms.
- **Kantz & Grassberger (1985); Tél & Lai (2008)** — transient chaos and escape from chaotic
  saddles; the source of the exponential-dwell model §7 checks against.
- **Brian Beckman** — *Kalman Folding* (the Kalman filter as a catamorphism), *Don't Fear the
  Monad*, and the Rx/category-theory/physics-from-structure talks. **Required reading per
  `docs/PRIOR-ART-LIST.md`** (Aaron 2026-06-09). The better anchor for §15–§17 than Meijer: the
  physics half — frames, variance, metrology — is his, and Kalman Folding is what identifies §11d's
  innovation premise with §16's fold.
- **David Allan** (Allan variance / Allan deviation, 1966) — the metrology instrument for clock
  stability across averaging intervals; already the corpus's specified protocol over the IScheduler
  tick, and therefore the instrument §9 needs.
- **Meijer, Fokkinga & Paterson (1991)**, *Functional Programming with Bananas, Lenses, Envelopes
  and Barbed Wire* — the catamorphism/anamorphism duality underneath §16; already cited in-tree via
  `src/Core/DynamicValueFold.fs` and `docs/CONCEPT-REGISTRY.md`.
- **Erik Meijer** (Rx; `TestScheduler` / virtual time) — a root anchor in this repo, and the
  pattern `VirtualTimeScheduler.fs` implements: replace the ambient clock with one you advance.
- **Zhou et al.**, *FoundationDB* (SIGMOD 2021), and **Will Wilson**, *Testing Distributed Systems
  with Deterministic Simulation* (Strange Loop 2014) — already anchors of
  `async-all-the-way-truthful-signatures`; the deterministic-simulation half of §12.
- **Rudolf Kálmán** (innovation: the unpredictable component of a new observation) — the premise
  `AntiSybil.fs` names as missing for any entropy floor; already an anchor in the self-audit doc.
- **Ostrom**, *Governing the Commons* — degenerate cooperation and the monitoring that distinguishes
  it from the real thing; the collusion-ring gap above is an instance she would recognise.
