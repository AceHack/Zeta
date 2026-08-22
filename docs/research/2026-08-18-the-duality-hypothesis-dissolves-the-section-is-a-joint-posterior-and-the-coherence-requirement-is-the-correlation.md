# The duality hypothesis dissolves — the section is a JOINT posterior, and its coherence requirement is the correlation structure

> **Origin.** I proposed (2026-08-18) that our soft layer might be the *dual* of the GU construction
> rather than an instance of it, on the grounds that the construction order is opposite: GU builds
> `Y14` **from** `X4`, while the Bayesian reading has the prior primitive and the collapsed version
> derived. Aaron: *"a dual would be cool too — any time we can come up with falsifiability it's good
> and we learn new things."*
>
> **So I tested it, and it fails.** The duality hypothesis was wrong, and what replaces it is sharper
> than either the duality or the agreement would have been.

## 1. Why the duality hypothesis fails

The argument rested on "construction order," and **construction order is not a mathematical
property**. Once both spaces and the maps between them exist, which one was written down first is a
fact about the exposition, not about the structure.

Written out, the two sides have the **same shape**, not opposite ones:

| | GU | Bayesian |
|---|---|---|
| forgetful map | `π : Y14 → X4` (forgets *which* metric) | `E : Dist → Points` (forgets the spread) |
| section | `ι : X4 → Y14` (picks a metric per point) | `δ : Points → Dist` (the point mass) |
| right-inverse law | `π ∘ ι = id` | `E ∘ δ = id` |
| fiber over a point | all metrics **at** that point | all distributions **with** that expectation |

Both are projections admitting sections. That is one shape, appearing twice — **not a dual pair.**
I was reading a presentational artifact as structure, which is the same error as reading a matching
count as an identification.

## 2. What the test actually turned up — the real asymmetry

There *is* a genuine disanalogy, and it is not the one I proposed. It is a **constraint on the
section**:

> **A GU section must be smooth/coherent across `X4`. A Bayesian collapse has no such requirement —
> you may take the mode or mean at each point independently.**

That constraint is not decoration. It is what makes the result a *spacetime* rather than an
arbitrary assignment of metrics to points, and it is the same constraint identified earlier as the
thing that creates causal structure at all: an incoherent assignment gives no light cones.

## 3. The replacement result, and it is the useful one

Follow the constraint through and it names a familiar object:

> **A coherent collapse across a family is a JOINT posterior. An independent per-point collapse is a
> set of MARGINALS. So the GU section corresponds to the joint, and the difference between the two
> is exactly the correlation structure.**

That is a real correspondence rather than a rhyme, and it lands in the lane we already care about:

- **Smooth section ≡ correlated collapse.** The fibers are not chosen independently; the choice at
  one point constrains its neighbours.
- **Pointwise collapse ≡ decorrelated.** Each marginal taken on its own, no cross-constraint.
- **Decorrelation is therefore the loss of section-smoothness**, which gives our decorrelation lane a
  geometric reading it did not have: agents decorrelating is a section becoming *less coherent* —
  and if there is curvature anywhere, this is where it would live, since a coherence constraint that
  fails to integrate around a loop is precisely holonomy.

## 4. What this predicts, stated so it can fail

1. **If decorrelation is section-incoherence, it should be measurable as a failure to integrate.**
   Take a closed loop through agent-states and compare the accumulated collapse against the identity.
   Zero defect = perfectly correlated = flat. Non-zero = the decorrelation has a *direction*, not just
   a magnitude — which is a strictly stronger claim than the current scalar ΔU, and can come back
   negative.
2. **Marginals-vs-joint is a checkable gap, not a metaphor.** `HeavyTailFold.fs` already folds by the
   exponential-family product — that fold *is* an independence assumption. If the section reading is
   right, the fold is taking marginals where a joint is required, and the discrepancy is computable
   on existing data.
3. **The correspondence dies if the coherence constraint turns out to be vacuous.** If every pointwise
   collapse happens to be extendable to a smooth section, the distinction collapses and this is just
   the agreement result after all. That is the cheapest thing to check and should go first.

## 5. What I got wrong, recorded because the error is instructive

I proposed a duality on the basis of which object was *introduced first in prose*. That is not a
structural asymmetry, and I should have written out the maps before proposing the test — the
disproof took one table. The useful part is that pressing a falsifiable hypothesis produced a better
statement than either outcome I had anticipated, which is Aaron's point exactly: *"any time we can
come up with falsifiability it's good, and we learn new things."*

Recording the failed hypothesis alongside its replacement, rather than quietly substituting the
better one, is the same discipline as keeping a retraction rather than compacting it.

## Pointers

- `docs/research/2026-08-18-hashem-haaretz-as-prior-and-collapsed-prior-*.md` — the mapping, and the
  duality hypothesis this retracts (§"Where this could fail", point 3)
- `src/Bayesian/HeavyTailFold.fs` — the exponential-family product fold, i.e. the independence
  assumption prediction 2 targets
- `docs/research/2026-08-18-coordination-is-the-velocity-*.md` — the other candidate metric; note both
  now point at the same place, the residue where coherence fails
- `.claude/rules/numerology-vs-number-theory.md` — reading presentation as structure is the same class
  of error as reading a count as an identification
