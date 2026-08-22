# Falsifier 1 fails: there is no Levi-Civita analogue here, and contortion is identically zero on the connection our fold actually uses

> **Assignment.** Attack the load-bearing assumption of
> `docs/research/2026-08-18-torsion-not-curvature-is-the-reordering-defect-and-contortion-is-the-metric-for-reversible-computing.md`
> before anything is built on it: *does a canonical torsion-free reference exist here, and is it
> unique?*
>
> **Verdict: it fails, twice, independently — and the second failure is the interesting one.**
> Do not implement a contortion metric. A clean negative, with a survivor named at the end.

## The carved version

> **There IS a metric — Fisher-Rao, and Cencov's theorem makes it essentially unique. That is
> exactly what kills the proposal.** Once the metric is fixed, the geometry is computable, and it
> says: the canonical reference (Levi-Civita) and the connection our fold actually transports along
> (Amari's e-connection) are BOTH torsion-free, so the contortion between them is IDENTICALLY ZERO
> while the connections genuinely differ. The deviation is real and it lives in NON-METRICITY, which
> contortion does not measure. And underneath that: **order-dependence of operations is the Lie
> bracket, not the torsion** — torsion is defined as what is left AFTER the bracket is subtracted.

Everything below is computed, not asserted:
`src/Core.TypeScript/research/information-geometry-contortion-falsifier.ts` and its test.

## 1. What plays the role of the metric? Fisher-Rao — and it is nearly forced

This is the strongest part of the proposal's neighbourhood, so it gets stated at full strength
before it is used against the proposal.

`src/Core/BeliefConvergence.fs` folds unnormalized non-negative weights over a fixed candidate set.
That is the **categorical exponential family**. Its natural parameters are the log-weights, and the
natural Riemannian metric on it is the **Fisher-Rao metric** (Rao 1945), which
**Cencov's theorem (1982)** singles out as the *only* metric invariant under sufficient statistics,
up to scale. It is not aspirational, and it is not new here: `src/Core/SoftValueInfo.fs` already
computes KL divergence over exactly this candidate support, and the second-order expansion of KL
*is* the Fisher metric. The metric was already in the tree; nobody had named it.

So the proposal's first premise is granted in the strongest available form. A metric exists, it is
essentially unique, and therefore a Levi-Civita connection exists and is unique too.

**And that is the problem.** With the metric fixed, everything downstream is determined and can be
computed rather than assumed. So we compute it.

## 2. The computation, and the first kill

`BeliefConvergence.observe` is pointwise multiplication of weights, which is **addition of
log-weights**. Log-weights are the natural parameters `theta`. So the fold is a **translation in
theta**, and translations in theta are precisely the parallel transport of Amari's
**e-connection** (`alpha = 1`), the flat connection whose affine coordinates are the natural
parameters. That is not an analogy chosen for resonance; it is what "affine coordinates of a flat
connection" means, and the fold's operation is literally translation in them.

In `theta`-coordinates the Christoffel symbols of the first kind for the whole Amari alpha-family
collapse to one line:

```
Gamma(alpha)_{ij,k} = ((1 - alpha) / 2) * psi_ijk
```

where `psi_ijk` is the third derivative of the log-partition function — the **Amari-Chentsov
skewness tensor**, which is **fully symmetric**. The canonical reference is `alpha = 0`
(Levi-Civita of Fisher-Rao); the connection our fold uses is `alpha = 1`.

A fully symmetric tensor has zero antisymmetric part. Therefore:

| quantity | measured at `theta = (0.7, -0.4, 0.25)` |
|---|---|
| torsion, at `alpha` in `{-1, 0, 0.5, 1}` | **exactly 0** (every member) |
| deviation of our fold's connection from Levi-Civita | **0.0462936** — nonzero |
| non-metricity at `alpha = 0` (the canonical one) | 7e-18, i.e. zero to float |
| non-metricity at `alpha = 1` (our fold's) | **0.0925872** |

**The deviation is real, and contortion is identically zero on it.** A metric that reports zero
where there is a genuine difference is not an inaccurate metric; it is measuring something else.

### The definitional error this exposes

The proposal states that *contortion is the difference between any connection and the Levi-Civita
connection*. **That is false in general.** The standard decomposition of an arbitrary affine
connection is three-way:

```
Gamma  =  Levi-Civita  +  contorsion (from torsion)  +  disformation (from non-metricity)
```

Contortion is the whole difference only for **metric-compatible** connections. Ours is not
metric-compatible — and that is not a defect to be fixed, it is Amari's **dual flatness**, the
structure that makes the multiplicative fold flat and therefore order-independent in the first
place. The piece we cannot discard is exactly the piece contortion does not see.

Relatedly, the proposal's *"torsion and contortion are inter-derivable, same information"* holds
only given a metric **and** metric compatibility — you need the metric even to lower the index in
the algebraic relation between them.

## 3. What plays the role of torsion-free? A property, not a selecting condition

The fundamental theorem of Riemannian geometry needs **two** conditions to get uniqueness:
torsion-free **and** metric-compatible. The Koszul formula derives the connection from the metric
only when both are imposed. The proposal names one of them.

Torsion-freeness alone leaves an infinite-dimensional affine family — the torsion-free connections
form an affine space modelled on the symmetric-in-the-lower-indices 3-tensors. The alpha-family
computed above is a one-parameter slice of exactly that family, and the test pins that **every**
member of it is torsion-free while all of them are distinct.

So *"order-independent implies torsion-free implies canonical"* does not close. Torsion-freeness is
a **property many connections have**, not a condition that selects one. Aaron's standing correction
applies with force here: importing Levi-Civita uniqueness means importing **both** of its
hypotheses, and we meet one.

## 4. Is the phase-canonical order actually canonical? No — it is a gauge choice

`.claude/rules/local-time-never-enters-the-shared-fold.md` does establish that the shared fold sees
only agreed phase order, and that reads like a canonical reference. The derivation it points at
says otherwise, in its own words
(`docs/research/2026-07-11-multi-planet-convergence-*.md`):

- **HLC-as-real-time-truth** — who actually happened first — needs bounded clock skew and is
  explicitly **dead multi-planet**.
- **HLC-as-deterministic-sort-key** — *"is just a total order"* — is what the design actually uses,
  and its purpose is float-reassociation bit-exactness across the language oracles.

Any deterministic total order serves that purpose equally: content hash, ZetaId, node-id then
logical counter. Nothing in the substrate distinguishes the HLC tuple from the alternatives for the
property being bought. It is a **convention chosen for determinism**, which is a gauge choice.

And note *why* it is free to be arbitrary: **because the fold is commutative, the choice does not
change the conclusion.** A reference whose arbitrariness is licensed precisely by the
order-independence of the thing it references cannot serve as the zero-point of an order-deviation
measure — if it could, the measure would depend on the arbitrary choice. Pinned in the test:
holding the executions fixed and swapping the reference from `alpha = 0` to `alpha = -0.7` changes
the reported deviation by more than 0.03, having changed nothing about the executions.

A canonical-looking order that admits a family of equally valid alternatives gives a **family of
contortions, not a metric** — which is the failure mode the assignment named in advance.

## 5. The deeper error: order-dependence is the Lie bracket, not the torsion

This is the correction that matters most, because it survives every repair of the details above.

```
T(X, Y)  =  grad_X Y  -  grad_Y X  -  [X, Y]
```

The bracket `[X, Y]` — the failure of the two flows to commute, which **is** the A-then-B versus
B-then-A question — appears in the definition of torsion as the term that is **subtracted off**.
Torsion measures the *additional* closure failure attributable to the **connection**, once the
operations' own non-commutativity has been removed. Attributing order-dependence to torsion assigns
it to the wrong object.

**Counterexample, computed.** Flat `R^2` with the standard connection: torsion is identically zero
everywhere. Take `X = d_x` and `Y = x d_y`. Then `[X, Y] = d_y`, nonzero, and the A-then-B and
B-then-A endpoints differ by exactly `s*t` in `y` (test pins 0.30 for `s = 0.75, t = 0.4`).
**Maximal order-dependence, zero torsion.** Falsifier 3 fails from the other side before it can even
be asked: the proposed metric reports zero on a genuinely order-dependent execution.

### The steelman, and why it also fails here

There *is* a connection whose torsion is exactly the non-commutativity: the **Weitzenbock /
teleparallel** connection on a Lie group, for which `T(X, Y) = -[X, Y]` — the structure constants.
That is genuinely Cartan's picture and it is the honest rescue of the proposal's intuition. But:

1. It is **not Levi-Civita**, so the proposal's canonical reference is the wrong one.
2. Our group is **abelian** — translations in log-weight space — so its structure constants vanish
   and even the teleparallel torsion is zero.
3. The resulting contortion would be a fixed property of the **group**, identical for every
   execution. A constant is not a per-execution measurement.

## 6. Scope note: half the substrate has no manifold at all

The Z-set fold is over the free abelian group on a key set — a discrete module. No tangent bundle,
no metric, no connection, so the question "which connection" does not arise. Its order-independence
is a group/monoid theorem, not a geometric one.

And the *"24 components split 4 + 4 + 16"* table is a statement about a **4-dimensional** manifold
under the **Lorentz** group. Our belief manifold has dimension `n - 1` for `n` candidates and no
Lorentzian structure; the analogous split would be a `GL(n-1)` irreducible decomposition with
different multiplicities. Under `.claude/rules/numerology-vs-number-theory.md`, quoting the 4D
numbers without naming the dimension and the structure group is a count without an identification.

## 7. What survives — three things, and they are worth having

### 7a. Relative deviation is well-defined; absolute deviation is not

Connections form an **affine space (a torsor)** over the space of difference tensors. So while
`Gamma_E - Gamma_ref` depends on the reference, the difference **between two executions** does not:

```
(Gamma_1 - Gamma_ref) - (Gamma_2 - Gamma_ref)  =  Gamma_1 - Gamma_2
```

Pinned in the test: computed via `alpha = 0` and via `alpha = -0.7`, the two agree to 1e-15 and are
not vacuously zero. This is the same structure as a gauge potential — the absolute value is a
choice, the difference is the physical content.

**So a RELATIVE order-deviation quantity is admissible even with no canonical reference; an ABSOLUTE
one is not.** That is the weaker-but-usable form the assignment anticipated, and it is the only form
that should ever be built.

### 7b. If a per-execution geometric object is ever wanted, it is a holonomy, not a contortion

Torsion is a **pointwise tensor on a geometry**; an execution is a **path**. Paths do not have
torsion. The finite quantity "by how much did this circuit fail to close" is the **Cartan
development**, and its value is the **Burgers vector** — the translational holonomy of a closed
circuit, whose density is the torsion.

That is a real, named, measurable object with a serious lineage: **Kondo (1952)**,
**Bilby-Bullough-Smith (1955)**, **Kroner (1958)** — dislocation density in a continuum *is* torsion,
and the Burgers circuit is how it is measured. Note the inversion this forces on the proposal: the
per-execution number is a **holonomy**, which the proposal explicitly ruled out as the wrong object.
Both were needed. Torsion is the density; holonomy is the measurement. Ruling out holonomy ruled out
the measurement and kept the density.

### 7c. The order-deviation we can measure today needs no geometry at all

Two orderings of the same evidence set: fold both, subtract. Measured here:

- in the **exact** algebra that `BeliefConvergence` actually runs (integer pointwise product),
  the two orderings agree **bit-for-bit** — pinned with exact big-integer arithmetic;
- in **float** log-space they differ by **one ULP** (measured under 1e-15), which is precisely and
  only what the phase-canonical sort order exists to remove.

That is the whole honest content of "how far did this execution sit from canonical" on the shipped
paths, and it is a rounding artifact rather than a geometric defect.

## 8. And the defect that IS live is a multiplicity, which no torsion measures

`src/Core/BeliefConvergence.fs` already names the real hazard in its own docstring: the fold is
commutative and associative but **not idempotent**, so redelivery double-counts. The bug found on
2026-08-10 by two independent reviewers was **multiplicity, not order**.

Computed here for the one non-commuting operation in the module: the residue of `sharpen` against
`observe` is **exactly the log-likelihood** — one extra copy of the evidence. A counting quantity.
No antisymmetric part of any connection measures a count, and a contortion metric pointed at this
substrate would have been silent on its only known live defect.

## 9. Register and disposition

- **The falsifier bites.** Mutation-checked: breaking the symmetry of the Amari-Chentsov tensor (one
  term zeroed) turns 3 of the 12 assertions red, including the torsion-is-zero one. These are not
  assertions that cannot fail.
- **CONJECTURE, refuted in the stated form.** Filed as `Z-2` under §B-torsion in
  `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`. It never reached §A and nothing implemented it, so
  this closes it before it could be cited — which is the cheap outcome the falsifier was for.
- **The corrected substance survives and is worth keeping**, exactly as the proposal's own
  self-correction survives: there IS a defect, it lives where reordering is not free, and it is
  structural. What is wrong is the *tensor*, the *reference*, and the *object* (density vs
  measurement) — not the intuition that something is there.
- **Math-shape correspondence only.** Amari's information geometry is borrowed, published
  mathematics; that the shapes match is a validity-level statement about our fold's algebra. It is
  not evidence that "the physics measures our system." The metering side of this thread is Landauer,
  and it is a separate claim with its own falsifiers.

## Anchors (checked, not merely cited)

- **Levi-Civita (1917)** / the fundamental theorem of Riemannian geometry — uniqueness needs
  torsion-free **and** metric-compatible. Both hypotheses, or no uniqueness.
- **Cartan (1922)** — torsion; and the teleparallel connection where torsion equals the structure
  constants, which is the proposal's honest steelman.
- **Rao (1945)**; **Cencov / Chentsov (1972, 1982)** — the Fisher-Rao metric and its uniqueness
  under sufficient statistics.
- **Amari & Nagaoka, _Methods of Information Geometry_ (2000)** — the alpha-connections, the
  Amari-Chentsov skewness tensor, dual flatness, and the fact that every alpha-connection is
  torsion-free while only `alpha = 0` is metric-compatible. This is the load-bearing citation and
  the computation checks it against finite differences rather than trusting the recollection.
- **Kondo (1952)**, **Bilby, Bullough & Smith (1955)**, **Kroner (1958)** — dislocation density as
  torsion; the Burgers vector as the translational holonomy that measures it.
- **Palatini** — why GR's Lagrangian does not select torsion (from the source passage; recorded as
  the proposal's framing, not relied on here).

## Pointers

- `docs/research/2026-08-18-torsion-not-curvature-is-the-reordering-defect-and-contortion-is-the-metric-for-reversible-computing.md`
  — the proposal this attacks, and whose falsifier 1 is the reason this was cheap to settle.
- `src/Core.TypeScript/research/information-geometry-contortion-falsifier.ts` (+ test) — every
  number above.
- `src/Core/BeliefConvergence.fs` — the fold; its commutativity theorem and its non-idempotence.
- `src/Core/SoftValueInfo.fs` — the KL divergence whose Hessian is the Fisher metric.
- `docs/research/2026-07-11-multi-planet-convergence-*.md` — HLC as a sort key, not as truth.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `.claude/rules/numerology-vs-number-theory.md`
