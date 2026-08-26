# All three geometric-algebra towers reduce to the in-tree `Cl(3,0)` — so the choice is not yet forced

**Register:** Beacon. Every number is computed by
`src/Core.TypeScript/research/conformal-embedding-and-curvature-budget.ts`, with 26
falsifiers beside it and five break-red mutations verified. Literature claims are marked
where they are cited rather than checked.

Aaron 2026-08-26, handing over the current Clifford-in-AI landscape:

> *"even if clifford is not helpful for arc for geometric reasoning in AI we should push it
> forward and maybe it will surprise us cause it has more uses than just 2d/3d pixels."*

He is right that the choice should not be gated on ARC, and the survey turned up something
better than a preference: **the decision does not have to be made yet.**

## The gap this closes

The single most-cited geometric-algebra architecture is Qualcomm's **GATr**, which
represents inputs, outputs, and hidden states in a **16-dimensional projective geometric
algebra**. That is PGA(3D) = `Cl(3,0,1)` — a signature with a generator squaring to **zero**.

Measured before writing anything:

```
grep -rn "Cl(3,0,1)|Cl(p,q,r)|degenerate"  src/Core/Clifford*.fs src/Core/Cl3.fs   -> nothing
grep -ril "projective geometric algebra|\bPGA\b"  src/                             -> nothing
```

`CliffordPeriodicity.fs` takes `(p, q)`. **There is no `r`.** The repo's Clifford instrument
had zero coverage of the algebra the field's headline model actually uses.

## Why that was not simply an oversight — and why the fix is a *different function*

A degenerate Clifford algebra is **not semisimple**. The null generators are nilpotent and
generate a Jacobson radical. Atiyah–Bott–Shapiro classifies semisimple algebras up to Morita
type over a division ring, so the mod-8 clock is **inapplicable** to `Cl(p,q,r)` with `r > 0`
— not merely unimplemented.

That distinction is the whole design of the fix. Extending `classify` to take an `r` would
have produced a **confident wrong answer**, which is this repo's vacuity class in its most
dangerous form: an instrument that returns a well-typed result for an input it cannot
actually judge. The honest extension is a separate function stating what *is* true:

```
Cl(p,q,r)        ≅  Cl(p,q) ⊗ Λ(ℝʳ)          Λ = the exterior algebra on r generators
dim_ℝ            =  2^(p+q+r)
Cl(p,q,r) / rad  ≅  Cl(p,q)                   the quotient IS semisimple, and the clock sees it
```

So a degenerate algebra is classified **in two parts**: a nilpotent part the clock cannot
see, and a semisimple quotient it can. The quotient is where the payoff is.

## The result

| tower | signature | construction | dim | radical | reduces to |
|---|---|---|---|---|---|
| VGA(3D) — the in-tree `Cl3` | `Cl(3,0,0)` | itself | 8 | 0 | **M₂(C)** |
| **PGA(3D) — GATr** | `Cl(3,0,1)` | `Cl(3,0) ⊗ Λ(ℝ¹)` | **16** | 8 | **M₂(C)** |
| CGA(3D) | `Cl(4,1,0)` | `M₂(Cl(3,0))` | 32 | 0 | M₄(C) = M₂ of it |
| PGA(2D) | `Cl(2,0,1)` | `Cl(2,0) ⊗ Λ(ℝ¹)` | 8 | 4 | M₂(R) |
| STA | `Cl(1,3,0)` | itself | 16 | 0 | M₂(H) |

**Two things fall out, and the second is the load-bearing one.**

**1. PGA(3D) is 16-dimensional — which is GATr's published number.** This is an *external*
check on the structure theorem rather than a fitted constant: `dim = 8 × 2 = 16` is predicted
by `Cl(p,q,r) ≅ Cl(p,q) ⊗ Λ(ℝʳ)`, and Qualcomm reports 16 independently. Half of that space
(8 dimensions) is nilpotent, which is exactly why the ABS clock cannot classify it.

**2. All three live towers are built over `Cl(3,0)`.**

```
  VGA(3D)  =  Cl(3,0)                    the algebra itself
  PGA(3D)  =  Cl(3,0) ⊗ Λ(ℝ¹)            tensor an exterior algebra   -> dim 16
  CGA(3D)  =  M₂(Cl(3,0))                2x2 matrices over it          -> dim 32
```

Tensoring with an exterior algebra, or taking 2×2 matrices. **Either way `src/Core/Cl3.fs` is
the entry type**, so the in-tree work is upstream of all three and is **not a bet on any one
of them**.

This is the direct answer to *"we have multiple different implementations and have not
decided on a correct one."* The towers are not competitors at the algebra layer. They differ
in what they **adjoin** — a null direction for PGA's ideal points, a null *pair* for CGA's
point-at-infinity and origin — and the thing they adjoin it to is the same object. **The
decision that has to be made is which geometric primitives you need, not which algebra to
build.** Points-and-planes with cheap rigid motions is PGA; spheres, circles and dilations as
first-class blades is CGA. Both keep `Cl3` underneath.

### Honest limit on the "same entry type" claim

`Cl(3,0)` being the semisimple quotient of PGA does **not** mean PGA computations reduce to
`Cl(3,0)` computations. The radical is precisely where PGA's translations live — that is the
*point* of the degenerate generator, and quotienting it away throws away the geometry.
The claim is about **shared foundation**, not about reducibility of the work. An
implementation still has to carry the full algebra.

## What the survey actually found

From the landscape Aaron supplied. **All of these are cited, none page-checked in this pass**
— they are recorded so the next person starts from a roster rather than a search.

| work | what it does | why it matters here |
|---|---|---|
| **GATr** (Qualcomm) | transformer over 16-d PGA multivectors | the tower measurement above; the closest thing to a reference implementation |
| **Clifford Group Equivariant NNs** (Ruhe et al. 2023, [2305.11141](https://arxiv.org/abs/2305.11141)) | equivariance to E(p,q) via Clifford-group subgroups, any dimension | the "generalises to n dimensions" property Aaron wants, made a *theorem* about the layer |
| **CGENNs / simplicial message passing** ([2402.10011](https://arxiv.org/pdf/2402.10011)) | the above over simplicial complexes | **closest to our factor-graph shape** — the one to read next |
| **GCANs** (Ruhe et al. 2023, [2302.06594](https://arxiv.org/abs/2302.06594)) | symmetry-group-based dynamical-system modelling | the DAG/composition question in geometric clothing |
| **CliffordNet / CAN** (Ji 2026, [2601.06793](https://arxiv.org/abs/2601.06793)) | vision backbone; geometric product replaces attention **and** channel mixing, O(N) | the strongest claim in the set, and the least checked |
| **Clifford Fourier Neural Operators** | Maxwell's equations; preserves coupled field dynamics | evidence the win is about *coupling*, not about 3-D |
| **CliffordLayers** (Microsoft) | convolutions / Fourier transforms over multivector fields | tooling |
| **Byrtus et al. 2026** (Phil. Trans. R. Soc. A) | review of Clifford methods in signal analysis | Aaron's "more than 2d/3d pixels" — the survey that supports it |

**The through-line, and it is the argument for pushing this forward regardless of ARC.**
Every one of these gets its result from the same property: a multivector keeps *scalars,
vectors and bivectors in one object*, so the geometric product can express feature coherence
(inner) and structural variation (outer) **simultaneously** instead of splitting them across
channels that a network then has to re-learn a relationship between. Nothing in that argument
mentions three dimensions. CFNO on Maxwell's equations and the signal-analysis review are the
cases where the payoff appears with no pixels anywhere — which is precisely Aaron's point.

## What this does NOT unblock

`081M0R18878087G0R001XY5A2J` still holds all Clifford-**GPU** work pending Q1/Q2/Q3/Q5. Q4 is
discharged (see the companion document). **Q3 remains the gate for spatial belief in a BNN
column** — a Normal-Gamma posterior exhibited as a region under a named metric, with a stated
approximation error. Without that error budget, embedding a belief as a point is
unfalsifiable, and no amount of tower-classification changes it.

## Register

| claim | register | why |
|---|---|---|
| `dim Cl(p,q,r) = 2^(p+q+r)` | **metered** | checked over 245 signatures, `r=0` reduces exactly |
| `Cl(p,q,r)/rad ≅ Cl(p,q)` | **metered** | dimension of the quotient checked to equal `2^(p+q)` throughout |
| PGA(3D) is 16-dimensional | **metered**, and externally corroborated | predicted by the theorem; GATr reports 16 independently |
| all three towers reduce to `Cl(3,0)` | **metered** | quotients compared directly, with a negative control |
| ABS is *inapplicable* (not just unimplemented) to `r>0` | **cited** | standard: degenerate ⇒ not semisimple ⇒ outside Morita classification |
| the eight surveyed works' claims | **cited, not read** | roster for the next pass, not evidence |
| any of this helping a Zeta task | **toy** | no falsifier exists; nothing has been measured against a task |

## Pointers

- `src/Core.TypeScript/research/conformal-embedding-and-curvature-budget.{ts,test.ts}` — §6 is the degenerate half
- `docs/research/2026-08-26-cga-is-m2-of-the-in-tree-clifford-q4-answered-*.md` — the Q4 companion; §2's conformal identity is the n-dimensional half
- `src/Core/CliffordPeriodicity.fs` — the clock, and the boundary of where it applies
- `workitems/081M0R18878087G0R001XY5A2J-*` — the hold
- `.claude/rules/numerology-vs-number-theory.md` — why the negative control on `Cl(3,1)` vs `Cl(3,0,1)` is in the test file: matching dimension is not matching algebra
