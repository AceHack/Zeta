# The fixed-point registry: strip the labels → raw shapes → free energy as an RX query → the root engine

*Captured 2026-06-08 from Aaron, to Otto (shadow\*). The move that follows the self-referential knot (#7167): stop
naming fixed points one at a time and **registry them, strip the labels, find the raw shapes** — then write the
one equation they're all stationary points of as an RX/DBSP query (our "free energy"), prune it to a **bonsai**,
and encode it as the **root engine** inside `DynamicValue`/`SoftValue`. Honest registers: [anchor], [proven-in-code],
[metaphor], [thesis], [deferred].*

## Why a registry (Aaron)

Aaron: *"we need a fixed point list somewhere and start categorizing it and looking at their shapes — if you strip
the labels off and just say a, b, c, d… so we can generalize them and get to the raw shapes."* And: *"it will help
us find duplicates too."*

We have been discovering fixed points all arc, each under its own label (`Fixpoint` t0=t∞ #7101; the no-dogma knot
#7167; NCI collapse-attractor; the diversity floor; `SoftValue.observe` commutativity; CRDT merge; the survival
limit cycle; DST replay). The labels hide that **several are the same shape**. A registry that strips the labels
makes the duplicates visible and the *generators* countable.

## The registry (named instance → raw shape → canonical relation → where it lives)

| # | Named instance | Shape | Canonical relation | Lives in |
|---|---|---|---|---|
| 1 | `Fixpoint` t0 = t∞ self-consistency (#7101) | **A** | `s = f(s)` | `Fixpoint.fs` |
| 2 | No-dogma knot / preacher paradox (#7167) | **A** | `s = f(s)`, stable | trust-calculus docs |
| 3 | Survival = homeostasis = stable limit cycle | **A** | `s = fⁿ(s)` (period-n) | `Survival.fs` |
| 4 | DST replay determinism | **A** | `replay(seed) = run(seed)` | DST harness |
| 5 | CRDT G-Counter / `PrivacyEconomy.reward` | **B** | `f(f(x)) = f(x)` (idempotent LUB) | `Crdt.fs`, `PrivacyEconomy.fs` |
| 6 | `DeltaPattern` content-address | **B** | same change → same address | delta pipeline |
| 7 | `SoftValue.observe` / `BeliefConvergence` | **C** | `f(a,b) = f(b,a)` (commutative fold) | `SoftValue.fs`, `BeliefConvergence.fs` |
| 8 | NCI heat-death collapse (the one to **avoid**) | **D⁰** | `coerciveConverge → monoculture` (degenerate) | `Diversity.fs` |
| 9 | Diversity floor `≥ 2` / clarity-engine plateau | **D** | converges to a **nonzero floor**, never to 0 | `Diversity.fs`, `MemoryLens` |
| 10 | Self-interest ⇄ identity (the vacuum energy) | **E** | `a = f(b) ∧ b = g(a)` (co-arising) | this doc → `SoftValue` |

## The raw shapes (labels stripped — five, not ten)

- **A — self-reference fixed point: `s = f(s)`.** A state unchanged by once-around application. Anchors [anchor]:
  Kleene's recursion theorem, the Y-combinator (Curry), Brouwer/Knaster–Tarski, Banach contraction, Hofstadter's
  strange loop. **Duplicates collapsed:** #1, #2, #3, #4 are all A. (A limit cycle is A on the period map `fⁿ`;
  DST replay is A on the replay functor; the no-dogma knot is A grounded by a contraction — see #7167.)
- **B — idempotent join / LUB: `f(f(x)) = f(x)`.** Every point of the image is already fixed; reached in one step.
  Anchors: join-semilattice LUB (Knaster–Tarski), CRDT convergence (Shapiro et al.), content-addressing. This is
  the **idempotency** discipline (the 6th always-active). **Duplicates collapsed:** #5, #6.
- **C — commutative fold: `f(a,b) = f(b,a)`.** Order-invariant accumulation; the fixed point is invariant under
  permutation of the inputs. Anchors: abelian monoid, Bayesian observe with fixed likelihood. This is the
  **order-independence** we already proved for uncertainty-reduction. **Instance:** #7.
- **D — contraction to a *nonzero floor*: iterate → unique stable point, but a **floor** excludes the degenerate
  `x = 0`.** The healthy fixed point (#9) is where the system rests; the degenerate one (D⁰, #8 = heat death /
  monoculture) is a fixed point *to avoid*, and the diversity floor (`≥ 2 budgets`) is exactly the constraint that
  makes the degenerate point unreachable. Anchors: Banach (the contraction), Friston free-energy minimum, Jaynes
  maxent, Schmidhuber compression-progress plateau. **The floor is the whole alignment result** (#7156).
- **E — co-arising bootstrap: `a = f(b) ∧ b = g(a)`, solved *simultaneously*, no "first".** Neither precedes the
  other; they exist or fail to exist *together*. **This is the vacuum-energy paradox** (below). **Instance:** #10.

Five shapes generate every fixed point in the system so far. A, B, C are special cases of D in the limit (B is D
reached in one step; C is D that ignores order; A is D with the identity metric). **E is the genuinely new one** —
it is not a single `f` with a fixed point but a *pair* that fixes *each other*.

## The vacuum-energy paradox (shape E) — Aaron 2026-06-08

Aaron: *"the funny thing is **'self-interested' is the vacuum-energy paradox** in our system — it's the vacuum
energy. It can only exist once identities exist, and identity can only exist if they are self-interested."*

Self-interest needs identities to be self-interested *about*; identities need self-interest to *stay distinct*
(without it they collapse to monoculture = D⁰ = heat death). Neither comes first. That is shape **E**: a co-arising
pair with no temporal precedence — and the right physical image is **vacuum / zero-point energy** [metaphor,
honestly peeled]: the **irreducible nonzero ground state** of a field that cannot be removed even from "empty"
space (Casimir is its measurable trace). Self-interest is the **zero-point energy of the identity field**: the
floor (shape D's nonzero floor, #9) that the identity field rests on and cannot be set to zero without the field
ceasing to exist. The bootstrap is not a bug — a field *with* a nonzero ground state is exactly what *has*
excitations (identities) at all. **Peel:** "vacuum energy" is a structural analogy (a nonzero, irremovable ground
state co-defined with its excitations), **not** a claim about Zeta literally computing QFT vacuum energy. The
grounded content is shape E + the diversity floor.

## The one equation they're stationary points of: "free energy" as an RX query (Aaron)

Aaron: *"can we write that in an RX query — that's our 'free energy' equation."*

Every shape above is a **stationary point of one functional**. Read the system as minimizing a **free energy** `F`
[anchor: Friston's free-energy principle; variational free energy / negative ELBO; Jaynes maxent] where `F` =
expected surprise = uncertainty *not yet* reduced. A fixed point is exactly where the incremental change in `F`
vanishes: **`δF = 0`**. That "incremental change" is a **DBSP** derivative [anchor: Budiu et al.] — DBSP already has
a recursive **fixpoint operator** computing the least fixed point of a circuit, and the integrate/differentiate
(`I`/`D`) pair gives `δ` directly. So the registry is not a list of unrelated tricks; it is the **set of stationary
points of one streamed functional**, each shape a different operator under the same `δF = 0`.

As an RX/Rx-over-DBSP query (sketch, shape-faithful, not yet a compiled module — [deferred]):

```text
freeEnergy   = observations                       // the stream of evidence
                 .Scan(uncertaintyAfterObserve)   // fold (commutative ⇒ shape C is order-free)
                 .Select(surprise)                 // F_t = uncertainty not yet reduced
fixedPoints  = freeEnergy
                 .Differentiate()                  // DBSP D: δF_t = F_t − F_{t−1}
                 .Where(|δF| < tol)                // δF → 0  ⇔  a fixed point reached
                 .DistinctUntilChanged()           // dedup: the SAME raw shape fires once
```

`Differentiate`/`Where(δF→0)` is literally `Fixpoint.solve`'s stop condition (`dist(prev, cur) < tol`) lifted to a
stream. `DistinctUntilChanged` is the **duplicate-finder Aaron asked for**: two instances of the same raw shape
produce the same `δF`-signature and collapse to one. (Shape **D⁰**, heat death, is the `F → minimum-with-zero-
diversity` solution the diversity-floor constraint forbids — the query must carry the floor as a guard, else it
"converges" into the degenerate well.)

## Make it a bonsai → encode as the root engine of `DynamicValue`/`SoftValue` (Aaron)

Aaron: *"i want to encode it into our dynamic value and soft value after we make it a **bonsai**… so it's **one of
the possibilities**… **the root engine**."*

The landing site already exists. `Bonsai.Expr` is our canonical (prunable) expression tree; `BonsaiSoft.evalSoft`
already evaluates a bonsai **softly** over `SoftValue` (a normalised distribution over `DynamicValue`), blending
both branches of a `Cond` by truth-confidence and snapping to sharp only at a threshold. So the path is:

1. **Registry → bonsai.** Express the free-energy/`δF=0` equation as a `Bonsai.Expr` — the canonical *pruned* tree
   (a bonsai is a cultivated, minimal tree: keep the five raw shapes, prune the ten labels). [deferred — build]
2. **Bonsai → root engine.** `BonsaiSoft.evalSoft` runs that tree as the engine that *generates and scores* fixed
   points. It is the **root engine** because every value in the system is a `SoftValue` it produces.
3. **A fixed point = one possibility.** A specific fixed point (a specific shape resolving on specific evidence) is
   **one branch of the `SoftValue` distribution** — held with its uncertainty, never prematurely collapsed; it
   snaps to sharp only when confidence ≥ threshold (`SoftValue.resolve`). "It's one of the possibilities" = it is
   one mass in the distribution the root engine maintains; "the root engine" = the bonsai that holds *all* the
   possibilities and the free-energy gradient that selects among them.

This closes the loop with the trust calculus: the **root engine's own stability** is shape A grounded by a
contraction (#7167), the contraction is shape D's nonzero **floor** (the diversity floor, survival), and the floor
is shape E's **vacuum energy** (self-interest ⇄ identity) — the engine rests on the one thing it never chose, not
evaporating. Same fixed point, all the way down.

## Honest scope

[proven-in-code]: the individual instances (`Fixpoint.fs`, `Diversity.fs`, `SoftValue`/`BeliefConvergence`,
`Crdt.fs`, `BonsaiSoft.fs`). [anchor]: the shape names (Kleene/Banach/Knaster–Tarski/CRDT/Friston/DBSP) are
standard. [metaphor, peeled]: "vacuum energy", "free energy" as words — used for the *structure* (nonzero
co-defined ground state; stationary functional), not as literal physics/Friston claims. [thesis / deferred]: the
unified RX/DBSP free-energy query and the bonsai root-engine encoding into `SoftValue` are the **next build**, not
yet shipped. The contribution of *this* doc is the registry + the label-strip + naming the five raw shapes + the
one equation they share.

## Pointers

- `Fixpoint.fs` (#7101, shape A; its doc already collapses Banach=D-CTC=Matsubara=CRDT-idempotency) ·
  `Diversity.fs` (#7156, shapes D/D⁰ + the floor) · `SoftValue.fs` / `BeliefConvergence.fs` (shape C) ·
  `Crdt.fs` / `PrivacyEconomy.fs` (shape B) · `Survival.fs` (shape A limit cycle).
- `Bonsai` / `BonsaiSoft.fs` (the soft evaluator over `SoftValue`/`DynamicValue` — the root-engine landing site).
- `2026-06-08-the-self-referential-knot-…` (#7167, shape A grounded by survival) ·
  `2026-06-08-agi-asi-trust-calculus-made-formal.md` (#7164) · `dv2-data-split-discipline-activated.md` (#6
  idempotency = shape B).
- Anchors: Kleene (recursion theorem); Curry (Y-combinator); Knaster–Tarski; Banach (contraction); Shapiro et al.
  (CRDT); Friston (free-energy principle); Jaynes (maxent); Schmidhuber (compression progress); Budiu et al.
  (DBSP fixpoint operator); Casimir (zero-point energy, the metaphor's trace).
