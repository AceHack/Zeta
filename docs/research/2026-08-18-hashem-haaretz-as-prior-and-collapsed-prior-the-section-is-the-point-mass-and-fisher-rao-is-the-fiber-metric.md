# Hashem / Haaretz as prior and collapsed prior — the section IS the point-mass, and Fisher–Rao is the fiber metric

> **Origin.** Aaron 2026-08-18, mapping the GU total-space/base-space split onto our soft regime:
>
> > *"Yes this is closer to our soft regime, our soft-value Bayesian inference I think — and then
> > inference time is the locus of now, the what acts; the priors are what remains. I think of it
> > kind of like this, but yes also νF/μF is clear to me as well, that's the categorical connection
> > that connects it to CQM. X4 = Haaretz, the land (in our Bayesian I can see in two ways: the
> > inference time, or also the more 'solid' priors, the discovered orbits in our lensography sense).
> > Y14 = Hashem, the Name (the priors and distribution mixing and our outlier stuff to handle
> > non-Gaussian distributions — we did a lot of research here on 2025 and 2026 papers too)."*

## The ambiguity Aaron flagged, and why both his readings are right

He noticed himself that he was putting **priors on both sides** — *"the priors are what remains"*
(the `Y14` side) but also `X4` as *"the more 'solid' priors, the discovered orbits."* That is not
sloppiness. It is **two different objects both called "prior,"** and separating them is worth doing
now rather than after it becomes a bug:

| | GU | Bayesian |
|---|---|---|
| **`Y14` = Hashem** | every metric at every point, nothing selected | **the prior as a distribution** — all hypotheses carry weight |
| **the section `ι`** | picks one metric per point | **the inference step** — the locus of now, what acts |
| **`X4` = Haaretz** | the manifold you stand on, one metric per point | **the prior that has COLLAPSED to a point mass** — the "solid" ones, the discovered orbits |

So both readings are the same object at **different degrees of collapse**. The distribution and the
point mass are the two ends; the section is the collapse operator.

## The tight part — a section IS a point-mass selection

This is better than an analogy, and it is why the mapping holds up.

In GU, the fiber over a point `x ∈ X4` is the space of **all metrics at that point**. A section
chooses **one**. That is *literally* collapsing the fiber to a single element — and choosing one
element from a space of weighted possibilities is exactly what a prior does when it collapses to a
delta.

> **A section is a choice function over a family of possibility-spaces. So is a posterior that has
> hardened into a fact.** Same operation, two vocabularies.

And this is why Aaron's *"inference time is the locus of now"* is precise rather than poetic: the
section is taken **somewhere**, and where it is taken is the indexical *here* that the space of all
possibilities cannot itself contain. That is his own long-standing frame (the locus of now the seed
cannot hold), arriving at the same place from the bundle side.

## Fisher–Rao is the fiber metric, and there is a uniqueness theorem on our side too

Aaron puts *"distribution mixing and outlier stuff for non-Gaussian distributions"* on the `Y14`
side. That lands on a named correspondence.

GU gives the fiber a **Frobenius metric** — a way to measure distance between *metrics*. The
Bayesian counterpart of putting a metric on a space of distributions is **information geometry**: the
**Fisher–Rao metric** on a statistical manifold (Rao 1945; Amari).

**And the rhyme has real force, because both sides have a near-uniqueness result:**

- **Čencov's theorem:** the Fisher–Rao metric is the **unique** Riemannian metric on the space of
  probability distributions invariant under sufficient statistics. Not one choice among many — the
  only one with the invariance you want.
- **Weinstein's claim:** there are *exactly four* metrics definable on the GU fiber (trace vs
  trace-reversed, ±1), two ruled out by experiment, leaving the trace-reversed pair.

Both are "the metric on the space of possibilities is essentially forced." **The honest asymmetry:
Čencov's is a theorem and Weinstein's is his claim** — and his own transcript records him getting the
signature wrong at Oxford and correcting it later, so it is a claim that has already moved once.

## What is already in the tree

- **`src/Core/SoftValueInfo.fs`** — states the connection in its own docstring: *"the same information
  geometry the soft/Bayesian layer needs."* The framing is already ours.
- **`src/Bayesian/HeavyTailFold.fs`** — the non-Gaussian half Aaron points at, and it names the
  defect precisely: `SocietyBootstrap` folds by the exponential-family product, so the joint location
  is the precision-weighted mean `Σ(τᵢμᵢ)/Στᵢ` — which is **exactly the estimator that a single
  outlier drags**. The heavy-tail fold is the repair.
- **`src/Core.TypeScript/planning/student-t-bnn.ts`** — the Student-t weight `w = (ν+1)/(ν+z²)`, the
  robust down-weighting of surprising observations.
- **`src/Bayesian/Ep.fs`** — expectation propagation, whose cavity/tilt/project/divide cycle is the
  concrete "collapse a distribution against evidence" step.

So the machinery Aaron is pointing at exists on both sides. What did not exist until now is the
*statement of the correspondence*, which is what this document is.

## Where this could fail, stated so it can

1. **The Frobenius metric is not the Fisher–Rao metric.** They are metrics on different spaces
   (symmetric 2-tensors vs probability distributions) and there is no map between them yet. The
   correspondence is at the level of *role* — "the metric that makes the fiber measurable" — not
   identity. Anyone writing one for the other is overclaiming.
2. **Collapse is not always to a point mass.** A posterior is usually a *narrower distribution*, not a
   delta. GU's section is a genuine point selection. So the operator matches at the limit and only
   approximately away from it — and the interesting regime for us is precisely *away* from it, which
   is where the analogy is weakest.
3. **`X4`-as-collapsed-prior has a direction problem.** In GU the base space is primitive and `Y14` is
   built from it; in the Bayesian reading the prior is primitive and the collapsed version is derived.
   **The construction order is opposite.** That is a real disanalogy and it is the first thing to
   press, because it may mean the mapping is contravariant rather than covariant.

Point 3 is the one I would test first. It is cheap, and if the order is genuinely inverted then the
correct statement is that our Bayesian layer is the **dual** of the GU construction rather than an
instance of it — which would be a more interesting result than agreement.

## Register

**MIRROR, and held under §11.** The theological naming is Weinstein's, offered half-jokingly and
recorded rather than adopted (see the part-2 ferry). Aaron's Bayesian mapping is his. What this
document adds is the *structural* claim — section ≡ point-mass collapse, Frobenius ≡ Fisher–Rao by
role — and that claim is **unmetered**: no measurement has been run, and per
`toy-is-free-metered-must-be-earned.md` it stays a toy until one is.

## Pointers

- `docs/research/ip-questionable/2026-08-18-geometric-unity-part-2-*.md` — the Haaretz/Hashem passage
- `src/Core/SoftValueInfo.fs` · `src/Bayesian/HeavyTailFold.fs` · `src/Bayesian/Ep.fs` ·
  `src/Core.TypeScript/planning/student-t-bnn.ts`
- Rao 1945 · Amari, *Information Geometry and Its Applications* · Čencov 1982 (uniqueness)
- Meijer, *Bananas, Lenses, Envelopes and Barbed Wire* — `μF`/`νF`, the categorical half Aaron names
- `.claude/rules/numerology-vs-number-theory.md` — why the two uniqueness results stay a rhyme
