# Trajectory — Topological task invariants

Status: **opened; primary source READ 2026-09-13** — nothing measured against our data yet
Last refreshed: 2026-09-13
Work item: `081M2DYZQQN087G0R000K24MTE`
Ferry (transcript + paper list): `docs/ip-questionable/2026-09-13-topological-intelligence-persistent-homology-ai-planning-transcript.md`
Primary source: **arXiv:2609.11014** — *Topological Necessities: Mechanism-Invariant Strategic
Subgoals for Cross-Embodiment Goal-Conditioned Control*

## Why This Exists

Aaron, 2026-09-13, on a talk about that paper: *"this is very similar to what we are trying to
do."* He is right, and the overlap is sharper than a resemblance — **one of its central objects is
already carved in this repo as a discipline we do not currently compute.**

`.claude/rules/anti-babel-preserve-reconcilability.md`:

> *Two paths around a pole yield genuinely different results, and **that difference is
> information, not error** (monodromy). Reintegration means **both branches held, each with its
> path recorded**.*

The paper's construction is the same structure used for a different purpose: trajectories that
pass on opposite sides of a hole fall into distinct **homotopy classes**, and a **winding number**
records which side was taken. That winding number is "the path recorded" turned into a stored
quantity. **We state the discipline; they compute the invariant.** That gap is the trajectory.

## Current Rule

**The paper is read** (Hao Shi, Xi Li; arXiv:2609.11014v1, 60pp incl. proofs; code at
osf.io/wak7u). What remains `toy` is every claim about what it implies **for Zeta** — nothing
here has touched our own trajectories.

> Register: **`toy`**, and the promotion condition is now concrete rather than "read it":
> a measurement over Zeta trajectories that either finds an invariant surviving a falsifier,
> or shows the construction does not apply and says why.

**The load-bearing question this lane exists to answer.** The paper's carrier is built on `D+`,
successful trajectories only — A.18 states it as a *"hard project constraint"*, so it is a
declared scope, not an oversight. That leaves a hole meaning **"no successful trajectory went
here"**, which conflates *no solution exists* with *nobody tried*. The paper cannot separate
those because it never kept the failures.

**Zeta keeps its failures.** `docs/BUGS.md`, `db/uncertainty/`, every red CI run, every retracted
claim, the whole retraction-native substrate. A carrier built over successes AND failures is a
genuinely different object from the one the paper defines, and whether persistent homology over
it means anything is a question the source literature has not asked. That is this lane's only
original hypothesis; everything else here is application.

## THE BIGGEST DIFFERENCE: their goal is individual, ours is the society (Aaron 2026-09-13)

> *"one of the biggest differences is our goal over the entire society, theirs is individual,
> ours is across all / most society members, mutual empowerment, and dependency injection from
> higher intelligence to lower intelligence models"*

This is the load-bearing distinction and it is not a matter of scale. Stated exactly:

|  | arXiv:2609.11014 | Zeta |
|---|---|---|
| **objective** | one goal set `G ⊂ M`; reach any `g ∈ G` | mutual empowerment across most members |
| **who benefits** | the deploying executor | the society, including members not in the run |
| **transfer axis** | LATERAL — same task, different embodiment (PointMaze → Ant → Humanoid) | VERTICAL — down a capability gradient |
| **what transfers** | a frozen gate set, no retraining | a routing decision that lowers what the next agent needs |

**The lateral/vertical split is the sharp part.** Their Humanoid is not *less capable* than
PointMaze — it is differently embodied, and dynamically harder. Their invariance claim is
"the task structure survives changing WHO executes". Aaron's is "the structure lets a LESSER
intelligence succeed at what a greater one did", which is
[[user_aaron_superagent_is_the_best_honest_router]]: *"every time it works decides how to route
the next same task to an agent with less experience or intelligence."* Those are different
claims and the paper does not make the second one.

**But it supplies the first real evidence for it anyway**, which is why this belongs in the lane
rather than in a footnote. The gates are a **frozen artifact handed to a consumer that did not
produce it, with no retraining** — dependency injection in the literal sense — and the measured
effect is a capability lift on the receiving side: 96.1 with gates against 85.3 for a
map-privileged reference without them, and coverage-class baselines at 0.1–49.5. On the
multi-route task the margin is +36.0 (p=1.4×10⁻⁵). So an injected structural dependency
*measurably raises what the weaker configuration achieves*. That is the mechanism Aaron's
superagent definition asserts, demonstrated on an axis adjacent to ours.

**And their object is already collectively constructed — only its aim is individual.** The
paper's own sentence:

> *"an order of unavoidable stages transmitted by the trajectories of any successful executor
> and belonging to none of them."*

Structure carried by all members, owned by none. That is a society-shaped object with a
single-agent goal bolted on. **Zeta wants it collectively constructed AND collectively aimed**,
and nothing in the paper addresses the second half — a carrier over one goal set cannot express
"everyone gets better", because there is no `G` for mutual empowerment to be the distance to.

**What this means for the lane, concretely.** The transferable part is the *construction* (a
carrier from many members' traces; an invariant belonging to none of them; a frozen artifact
injected into a weaker consumer). The part that does **not** transfer is the *objective*.

### ANSWERED: the objective does admit a coordinate, and we already built it (Aaron, same day)

I raised "whether a mutual-empowerment objective admits any progress coordinate at all" as an
open question. Aaron answered it: *"our mutual empowerment is closely related to our decorrelation
and our antisybil work so you can even measure decorrelation."*

`src/Core/SocietyUsefulWork.fs` computes
`E[U_society] − E[U_i] = (1−ρ)(1−c)(1−(1−c)^(n−1))·Σv`. The `(1−ρ)` factor makes the hardest
degenerate case an identity: **at ρ=1 — clones — the gain is exactly zero for every n**, pinned
by the property tests `expectedGain collapses to zero when rho = 1...` and, in the other
direction, `expectedGain is strictly positive when c is in (0,1) and rho < 1`. Mutual empowerment
and anti-Sybil are therefore **one problem**: the quantity that measures the goal prices a Sybil
at zero.

**The coordinate has the OPPOSITE shape to theirs, and Aaron's framing says WHY — it is caused
by the individual/society split, not incidental to it:**

```
individual goal  →  FINITE game      →  has a terminal state
                 →  coordinate = distance to that state
                 →  ZERO AT SUCCESS  (arrive and stop)

society goal     →  INFINITE game    →  must have NO terminal state
                 →  a distance-to-done coordinate is FORBIDDEN, not merely absent
                 →  ZERO LANDS ON COLLAPSE INSTEAD  (ρ=1: nothing left to discover)
```

The middle step is the load-bearing one and the repo already argued it from the other side:
`docs/research/2026-08-23-backward-induction-is-the-missing-term-*.md` shows a KNOWN terminal
state unravels cooperation by backward induction. So a well-defined finish line would not merely
fail to describe our game — **it would destroy it**. The absence of a terminal state is
load-bearing, which is exactly why the zero had nowhere to go but the degenerate case.

**The consequence for method, and it is a branch change:**

| | arXiv:2609.11014 | Zeta |
|---|---|---|
| coordinate | `r(x) = d_G(x, V_g)` | `(1−ρ)`-weighted society ΔU gain |
| zero at | **the goal** | **clones** — the degenerate case |
| monotone along a trajectory? | yes (Theorem T1, an identity) | **unknown** |

Their shells are "equally far from done"; ours would be "equally decorrelated", which is not a
progress ordering at all. **So eikonal shells do not port, and now for a structural reason rather
than a practical one**: eikonal solves a REACHABILITY problem (descend toward a target), and an
infinite game is a **VIABILITY** problem (stay inside an admissible set indefinitely). Those are
dual branches of control theory sharing vocabulary and almost no machinery — Aubin's viability
theory and its viability kernel, rather than shortest paths and shells.

Measured 2026-09-13: `viability` in that control-theoretic sense appears **nowhere** in this repo,
so this is a new anchor, not a re-reading of an old one. Full argument in the research doc §5.

Full treatment, including the six degenerate cases and which two are NOT closed:
`docs/research/2026-09-13-mutual-empowerment-is-measured-by-decorrelation-and-its-degenerate-cases-are-closed-by-self-claim-consistency.md`.

**Standing caveat:** the measure is metered as MATHEMATICS; `SocietyUsefulWork.fs` states in its
own header that a real fleet's actual ρ and c are **UNMEASURED**. We have a coordinate and no
reading on it.

## What Zeta already has that this would attach to

| their object | ours | relation |
|---|---|---|
| homotopy classes + winding number | monodromy clause, raw-vault "both branches held" | same structure, computed AND deployed there (A.12) — **and its measured benefit is null**, see below |
| eikonal shells (progress without a metric) | ordinal-only ΔU register (`db/uncertainty/`) | both refuse a cardinal metric the space does not supply |
| cross-embodiment invariant, *inferred* | four-oracle byte-lock, *fixed by treaty* | inverse method, same property. "The seed is the treaty." |
| H0-persistence gates, *discovered* | `gate (required)`, *declared* | a discovered gate is a measurement; a declared one is a decision — do not conflate |
| carriers from successful rollouts | DST replay + golden vectors | ours are deterministic and replayable; theirs are statistical |

## The result that should temper expectations

A.12 runs the winding-number route lock in the decision loop. It works exactly as designed —
**zero route switches on every seed of every task**, against the geometric lock's 17 and 26 —
and it produces **no success-rate improvement** (94.8 vs 96.4 on the discriminating task,
p=0.46). The authors keep the cheaper geometric lock and say so.

So the first real datum about computing this invariant is: *the mechanism is confirmed and the
benefit is absent on the metric reported.* Our monodromy clause makes the same commitment for
the same structural reason, so this is evidence about what that commitment costs and buys — and
it argues against expecting a performance win from formalising it.

## Current Next Action

1. **Decide whether we have a trajectory corpus at all.** Candidates: `workitems/events/`,
   `db/uncertainty/`, CI run history. Each records successes AND failures, which is the one
   axis where we differ from the source.
2. The first experiment is **not** persistent homology. It is the cheap falsifier: do our
   trajectories exhibit more than ONE homotopy class at all? If every successful path deforms
   into every other, there is nothing to find and the lane closes for the price of one script.
3. Only if (2) is positive: build a carrier over successes *and* failures and ask whether a hole
   distinguishes "no solution" from "unexplored". That is the question the source could not ask.

## What would close this trajectory

Either a measured invariant over our own trajectories that survives a falsifier, or a written
finding that the method does not transfer and why. **A trajectory that ends in "interesting, we
should look into it" has not ended.**
