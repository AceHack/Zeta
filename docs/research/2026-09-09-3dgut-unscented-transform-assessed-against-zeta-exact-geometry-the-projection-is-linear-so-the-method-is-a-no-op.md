# 3DGUT assessed against Zeta's exact geometry: the projection is linear, so the Unscented Transform is a measured no-op — and the half that delivers reflections is not the Bayesian half

Date: 2026-09-09
Operational status: research-grade; the shipped prototype slice is **metered**
Author: shadow-subagent (Claude Opus 5), Claude Code
Work item: 081M23KCKR4087G0R001D3KAJB
Scope: an assessment of *3DGUT: Enabling Distorted Cameras and Secondary Rays in Gaussian
Splatting* (Wu, Martinez Esturo, Mirzaei, Moenne-Loccoz & Gojcic, 2025) as a candidate
transfer into Zeta's Clifford/E8 rendering ladder; whether the Unscented Transform bridges
to the repo's Expectation-Propagation stack; and a vendor-neutral prototype that measures
the answer instead of asserting it.

## Register discipline

Claims are marked **VERIFIED** (I ran it in this session and read the output),
**INFERRED** (my reasoning over verified inputs), **REPORTED** (established by a
sub-agent's read of material not in my worktree, not re-run by me), or **UNVERIFIED**.
Constructions are marked **toy** / **unmetered** / **metered** per
`.claude/rules/toy-is-free-metered-must-be-earned.md`. Numbers appear only where I measured
them.

## IP provenance, stated first

Aaron's standing position is that **papers need citing, not clean rooms**. This assessment
reads the paper (PDF, `3DGUT_full_resolution.pdf`, 15 pages, extracted with `pdftotext`)
and cites it.

> **I did not open `nv-tlabs/3dgrut` at any point.** No file, no listing, no README, no
> licence text. Everything below is derived from the paper's own mathematics and from the
> repo's existing code. The prototype implements the published equations (6)–(10) directly.
> Recorded per `.claude/rules/cleanroom-two-team-separation.md` so the provenance is legible
> later; since no third-party source was examined, no clean-room wall was triggered and none
> is claimed.

---

## 0. The verdict, up front

Four findings, in descending order of how much they should change what we do:

1. **The Unscented Transform is a measured no-op on Zeta's projection.** Our 8D→3D
   derivation is a **linear map** — dot products against orthonormal eigenvectors. For a
   linear map the UT and the EWA linearisation it replaces are provably and measurably
   identical, because linearising something already linear discards nothing. Measured on
   the real 240 E8 roots: worst mean discrepancy **6.7 × 10⁻¹⁶**, worst covariance
   discrepancy **7.1 × 10⁻¹⁵** — machine epsilon. **VERIFIED.** And it holds for *every*
   UT parameterisation, so it cannot be tuned into a benefit. The one nonlinear step in the
   pipeline is rung 7's pinhole camera, where the UT's margin is **1.52×** — the regime the
   paper itself calls "consistent" — and which a ray tracer never projects through anyway
   (§3.2).

2. **The half of 3DGUT that would deliver Aaron's reflections is not the Bayesian half,
   and it is not really in this paper.** Reflections and refraction come from §4.2/§4.3 —
   evaluating particles in 3D and sorting them per-ray — which exist to make the
   representation compatible with **3DGRT**, a *separate ray-tracing* paper. In 3DGUT's own
   pipeline the primary rays are splatted and the secondary rays are **traced by 3DGRT**.
   The Unscented Transform contributes nothing to reflections. **VERIFIED** from §6.2.

3. **The paper's own declared limitation is precisely our geometry.** §7: *"as our method
   still uses a single point to evaluate each primitive, it is currently unable to render
   overlapping Gaussians accurately."* Zeta's 2-skeleton is maximally overlapping — 27
   incident faces per edge, an overdraw ratio reported at 738. The method fails exactly
   where our object lives. **VERIFIED** (paper) + **REPORTED** (the 738 figure).

4. **A Gaussian particle representation would be inadmissible under the engine's own
   defining constraint, before any question of exactness.** Aaron's rule is that every
   rendered coordinate must be *derived from the Clifford substrate*, enforced by a
   provenance test that fails on a hand-placed vertex. **A fitted Gaussian has no E8 root
   index.** Fitting is the opposite of deriving. **INFERRED**, from a VERIFIED constraint.

**Recommendation: adopt nothing from 3DGUT into the rendering ladder.** Cite it. Keep the
prototype as the standing measurement that says why, so the question does not have to be
re-litigated from intuition next time. The genuine open direction it points at is
different, and is named in §7.

---

## 1. What 3DGUT actually is

3D Gaussian Splatting (Kerbl, Kopanas, Leimkühler & Drettakis, *ACM TOG* 42(4), 2023)
represents a scene as unstructured fuzzy anisotropic 3D Gaussians and rasterises them fast.
To decide which particle touches which pixel it projects each Gaussian to the image plane
using **EWA splatting** (Zwicker, Pfister, Van Baar & Gross, *IEEE TVCG* 8(3), 2002):

```
Σ' = J W Σ Wᵀ Jᵀ
```

where `J` is the Jacobian of an affine approximation of the projective transform. That
Jacobian is a **linearisation**, and it has three costs the paper names (§4.1): it drops
higher-order terms, it must be re-derived by hand per camera model, and it cannot express a
time-dependent projection such as rolling shutter at all.

3DGUT replaces that step with the **Unscented Transform** (Julier & Uhlmann, SPIE Defense,
Security & Sensing, 1997; Julier, Uhlmann & Durrant-Whyte, ACC 1995; scaled weights from
Wan & Van Der Merwe, IEEE AS-SPCC, 2000). Instead of approximating the *function*, it
approximates the *particle*: pick `2N+1 = 7` deterministic sigma points, push each one
through the true projection **exactly**, and re-estimate a 2D Gaussian from the images.
Derivative-free, one code path for every camera model.

Two details matter for the transfer and are easy to miss:

- **The UT is used only as an acceleration structure.** §4.1, closing: *"our particle
  response evaluation does not depend on the 2D conic. Instead, UT only acts as an
  acceleration structure to efficiently determine the particles that contribute to each
  pixel."* The projected Gaussian is a *tile-culling device*, not the thing that is
  shaded. **VERIFIED.**
- **The matrix square root is free only because of their parametrisation.** Sigma points
  need `√((N+λ)Σ)`. 3DGS stores `Σ = R S Sᵀ Rᵀ`, so `√Σ = R S` can be read straight off.
  That is a property of *their representation*, not of the UT.

---

## 2. Is UT ↔ EP a real bridge, or a surface resemblance?

Aaron's instinct: *"we have a lot of advanced bayesian inference stuff that ties directly
to our clifford too."* The repo does carry real Expectation Propagation — `src/Bayesian/Ep.fs`,
`SignedProbitEp.fs`, and TrueSkill-style ranking in `src/Core/TravelerRankLedger.fs` after
Herbrich–Minka–Graepel. Both EP and UT "match moments". Under
`.claude/rules/numerology-vs-number-theory.md` that shared shape licenses an
investigation, never a claim — so here are the invariants that decide it.

### 2.1 The deciding invariants

| invariant | EP's `project` step | the Unscented Transform | same? |
|---|---|---|---|
| **input object** | a *tilted density* `q_cav(x)·f(x)` — Gaussian × likelihood factor, on the **same** space | a *pushforward measure* `g#N(μ,Σ)` — the image of a Gaussian under a map to a **different** space | **no** |
| **where the nonlinearity sits** | in the **measure** (a factor reweighting the density) | in the **coordinates** (a deterministic map) | **no** |
| **division / cavity step** | **yes, definitional** — cavity = marginal ÷ site, then divide again to form the outgoing message | **none**; one-shot forward | **no** |
| **iterated to a fixpoint** | yes, over sites | no, single evaluation | **no** |
| **how moments are obtained** | in this repo, **exact closed form** — GPML eq. 3.58 for the probit site | a **7-point quadrature**, exact only to low polynomial order | **no** |

Five invariants, five differences. **UT is not EP and EP is not UT.** "Both match moments"
is the 48-roots-and-D₄⊕D₄ move: true, and not an identification.

### 2.2 The bridge that IS real, named precisely

There is nonetheless a genuine common parent, and it has citations:

> Both are instances of **projection onto an exponential family by moment matching** — the
> KL-minimising projection. **Assumed Density Filtering (ADF)** processes factors once,
> projecting after each; **EP is ADF iterated to a fixpoint** (Minka, *Expectation
> Propagation for Approximate Bayesian Inference*, UAI 2001, presents exactly this
> generalisation). And **the UKF is ADF whose moment integrals are evaluated by the
> unscented quadrature rule.**

So the honest chain is: **UT is a quadrature rule · ADF is the algorithm · EP is ADF
iterated.** The UT can serve as the numerical integrator *inside* EP's projection step when
the tilted moments have no closed form. That is a real, published technique, not a coinage.

### 2.3 Why the real bridge is currently unpaid

**It would be a downgrade where we could apply it.** The repo's EP site is the probit, and
`Ep.probitProject` computes its moments in **exact closed form** (GPML 3.58, with a
stable inverse-Mills asymptotic for extreme cavities). Substituting a 7-point quadrature
there replaces an exact integral with an approximation. It would pay only if Zeta acquires
an EP site whose moments have *no* closed form and which is cheap to evaluate pointwise.
None exists today. **VERIFIED** by reading `src/Bayesian/Ep.fs`.

### 2.4 And the deeper reason the bridge does not carry Aaron's weight

Even granting the bridge, it does not reach the thing he is pointing at:

> **3DGUT uses a Bayesian-derived algorithm in a thoroughly non-Bayesian way.** There is no
> posterior, no likelihood, no prior, no cavity, and nothing is inferred. The "Gaussian" is
> a **shape primitive**, not a **belief**. The UT appears there purely as a geometry routine
> that the filtering community happened to invent.

So: **the methodological bridge is real (ADF is the common parent) and the connection at
the point of contact is a surface resemblance.** Both halves of that sentence are load-bearing,
and reporting only one would misrepresent the case in either direction.

### 2.5 The Clifford tie is the strongest part of the instinct — and it is structural

The one place Aaron's intuition lands squarely:

> Sigma points are `μ ± √((N+λ)Σ)_[i]`, and the square root is available because
> `Σ = R S Sᵀ Rᵀ` — **a rotation composed with a scale**. In geometric algebra that is
> exactly a **versor**, applied by the sandwich the repo already implements in rung 6
> (`-a v a / |a|²`, `R v R̃`). An anisotropic Gaussian *is* the unit ball transformed by a
> versor-and-scale, and its sigma points are the images of the frame axes under that
> transform.

Same object, described twice. That is structure, not coincidence — it survives the
numerology test because the correspondence is an identity of construction rather than a
matching number. **Register: real, and operationally inert here**, because our projection is
linear and we therefore never need sigma points at all. Where it *could* pay is named in §7.

---

## 3. The load-bearing measurement: our projection is linear

### 3.1 The theorem

For an affine projection `g(x) = Ax + b`:

- Sigma points are symmetric about `μ` and their mean weights sum to 1, so the recombined
  mean is `Σᵢ wᵢ^μ (A xᵢ + b) = A μ + b`.
- Deviations push forward as `A(xᵢ − μ)`, so the recombined covariance is
  `A [Σᵢ wᵢ^Σ (xᵢ − μ)(xᵢ − μ)ᵀ] Aᵀ = A Σ Aᵀ`.

which is exactly what EWA computes — and for an affine map the Jacobian *is* `A` everywhere,
so EWA is not approximating anything either. **Both are exact, and equal.** The UT's entire
value proposition is the higher-order terms linearisation discards; an affine map has none.

A subtlety worth recording, because it is what makes the two tests below independent: with
3DGUT's own `α=1, κ=0` we get `λ=0`, hence `w₀^μ = 0` and `w₀^Σ = β = 2`. Under an affine
map the centre sigma point maps exactly onto the recombined mean, so its deviation is zero
and **β is inert**. Under a nonlinear map `g(μ) ≠ v_μ`, and β genuinely acts.

### 3.2 Zeta's projection is affine — verified against the shipped code

`src/Core.TypeScript/research/clifford-e8-coxeter-projection.ts`, `projectRoots`:

```
const x = dot(r, e1);
const y = dot(r, e2);
```

Two dot products against a Gram-Schmidt-orthonormalised Coxeter-plane frame. A matrix
multiply. And rung 3's 3D embedding
(`clifford-e8-eigenlayer-tessellation.ts`) takes *"two coordinates from layer 0 and one from
layer 1"* — three dot products against orthonormal eigenvectors of the bipartite Coxeter
element. Also a matrix multiply. **VERIFIED** by reading both modules.

There is no perspective divide in the derivation path; that projection is orthogonal.

**Precision about which step this is, because the pipeline has two.** The *derivation*
`8D → 3D` is linear, as above. The *viewing* step `3D → 2D` in rung 7 is a **pinhole
camera** — `clifford-e8-raytrace.ts` builds an orthonormal camera frame with the eye on a
derived root and an image plane at unit distance, `DEFAULT_HALF_WIDTH = 0.48 = tan(fov/2)`
for a 51° field (**VERIFIED** by reading the module on the rung-7 branch). A perspective
divide *is* nonlinear, so the claim being made here is precise rather than global:

| step | map | UT vs EWA |
|---|---|---|
| 8D → 3D derivation | **linear** (dot products against orthonormal eigenvectors) | **identical**, 7 × 10⁻¹⁵ (§3.3) |
| 3D → 2D viewing | pinhole (perspective divide) | **1.52×** — the paper's "consistent" regime (§3.4) |

Two things keep this from rescuing the transfer. First, the marginal case is the one the
paper itself declines to claim a win on. Second, and decisively: **rung 7 is a ray tracer,
and a ray tracer never projects a covariance at all.** It casts rays and returns a triangle
index. The UT-versus-EWA question only exists for *rasterised splatting*, which is a
representation we would have to adopt first — and §5 and §6 are why we should not.

### 3.3 The measurement

`unscented-projection.test.ts` §F2 runs the UT and EWA against the **real** Coxeter
projection over the **real** 240 E8 roots, one anisotropic 8D Gaussian per root:

| quantity | measured |
|---|---|
| worst \|mean\| discrepancy, UT vs EWA | **6.661 × 10⁻¹⁶** |
| worst \|cov\| discrepancy, UT vs EWA | **7.105 × 10⁻¹⁵** |

**VERIFIED.** That is floating-point noise: the two methods compute the same numbers.

And the second F2 test sweeps four UT parameterisations — including 3DGUT's own — and finds
the same equivalence in all of them. So the negative result is **robust to tuning**: there is
no `(α, β, κ)` that makes the Unscented Transform beat linearisation on a linear projection.
**VERIFIED.**

### 3.4 The boundary — where the UT *does* pay

The same harness, scored by KL divergence against a 200,000-sample deterministic
Monte-Carlo reference (the paper's own protocol, §C, at 400× their sample count):

| projection | KL(UT) | KL(EWA) | EWA/UT |
|---|---|---|---|
| pinhole, f=500 | 3.90 × 10⁻⁵ | 5.94 × 10⁻⁵ | **1.52×** |
| equidistant fisheye, f=300, off-axis | 2.66 × 10⁻⁴ | 1.71 × 10⁻³ | **6.43×** |

**VERIFIED.** This reproduces 3DGUT's qualitative finding in our own code: their Fig. 12/13
report the two as *"consistent for the static pinhole camera case"* with UT pulling ahead
under fisheye and rolling shutter.

**Our comparison is deliberately harsher on the UT than the paper's.** 3DGUT scores EWA
using *"the Jacobian from [3DGS], which does not account for these additional distortions"*
— a linearisation of the wrong map. Here EWA gets a high-accuracy central-difference
Jacobian **of the map actually under test**. The 6.43× is therefore a *conservative*
estimate of the UT's real advantage, and it is attributable to discarded higher-order terms
rather than to a mismatched derivative.

**The boundary in one line:** the UT's benefit scales with the nonlinearity of the
projection, and Zeta's is zero.

---

## 4. What transfers, and what does not

| 3DGUT component | transfers to Zeta? | why |
|---|---|---|
| **UT projection (§4.1)** | **no** | our projection is affine; measured identical to EWA at machine epsilon, for all parameters (§3.3) |
| distorted / fisheye camera support | **not currently wanted** | would become relevant only if we chose a nonlinear camera; nothing in rungs 1–7 does |
| rolling shutter | **no** | a sensor artefact; there is no sensor |
| **3D response evaluation (§4.2)** | **conceptually already ours** | rung 7's ray tracer evaluates in 3D by Möller–Trumbore. Not a gap |
| **per-ray sorting / MLAB (§4.3)** | **actively harmful here** | a k=16 buffer over a **738-layer** surface truncates ~98% of the depth complexity. Exactness would be gone |
| **secondary rays (§6.2)** | **no — and it is not this paper's** | primary rays are splatted, secondary rays are **traced by 3DGRT**. The reflections come from the tracer |
| Gaussian particle primitive | **no** | see §5 and §6 |

### 4.1 The reflections finding, stated plainly

Aaron's ask was reflections and water. It is worth being exact about what the paper offers,
because the abstract's phrasing invites a stronger reading than the method supports:

- The reflective sphere and refractive statue in Fig. 1 are **inserted synthetic objects**,
  not reflective Gaussians. The paper's own caption: *"Two synthetic objects, a reflective
  sphere and a refractive statue, **inserted** into a scene reconstructed with our model."*
  The Gaussians are the *environment being reflected*. **VERIFIED.**
- The mechanism (§6.2) is **hybrid**: rasterise primary rays, then *"compute and trace the
  secondary rays using 3DGRT"*. Adopting the effect means adopting the ray tracer, which is
  the OptiX/CUDA one.
- Under Aaron's own constraint — *"if we cant generate it from clifford that's not our
  research"* — an inserted authored mirror ball is **inadmissible by construction**. It has
  no derivation.

So the honest reading: 3DGUT does not make a Gaussian scene reflective. It makes a Gaussian
scene *compatible with a tracer* that can bounce rays off separately-authored geometry.

---

## 5. Would a particle representation dissolve the BVH pathology?

The framing I was given — and my own first instinct — was that anisotropic particles have
controllable extent, so they might fix a BVH defeated by enormous overlapping triangles.
**Measuring the claim's structure rather than assuming it, the answer splits, and the
dominant half goes the wrong way.**

The reported pathology has **two independent causes** (**REPORTED** — these figures live in
`docs/research/2026-09-09-rung-7-*.md` on the `rung-7-viewable-e8-renderer-and-cpu-bvh`
branch, which is *not* in my worktree; I did not re-run them):

| cause | figure | would particles help? |
|---|---|---|
| primitives too large for spatial subdivision | mean triangle bbox **29.3%** of scene diagonal | **yes** — many small Gaussians have small extent |
| **depth complexity** | overdraw ratio **738**; ~1,140 leaf/root area ratio on the .NET side | **no — strictly worse** |

The second is dominant, and it inverts:

> **Depth complexity is a property of the geometry, not of the primitive.** A ray through a
> 738-layer shell crosses 738 layers whatever they are made of. Triangles at least permit
> **nearest-hit occlusion** — currently hiding ~99.9% of the surface, which is the only
> reason rung 7 renders at all. Splatting is **volumetric and semi-transparent**: it
> alpha-blends *everything* along the ray and has no nearest-hit early-out by construction.
> Swapping triangles for Gaussians deletes the one mechanism that is currently working.

3DGUT's answer to unbounded blending is the k=16 MLAB buffer — i.e. **truncate at 16 of 738
layers**. That is a rendering approximation with no error bound, applied to a substrate whose
entire claim is exactness.

**And the paper says so itself**, in its limitations (§7):

> *"as our method still uses a single point to evaluate each primitive, it is currently
> unable to render **overlapping Gaussians** accurately."*

**Zeta's geometry is the paper's declared failure case.** 27 incident 2-faces per edge
(**VERIFIED** on `main` in the rung-6 doc: per-edge min and max both 27, `3 × 60,480 = 27 × 6,720`)
is maximal overlap. A manifold edge carries two.

### 5.1 The actual diagnosis

> **The pathology is a modelling choice, not a rendering-representation choice.** The
> 2-skeleton of 4_21 projected to 3D is not the boundary of a solid — 27 faces per edge
> means there is no consistent inside, hence no consistent side, hence no well-posed
> "reflective surface". No primitive fixes that. Neither BVH nor Gaussians nor the UT
> addresses it, because none of them is where the problem is.

A ray hitting an edge has 27 candidate normals. "Make it reflective" is not
under-implemented; it is **under-specified**. The productive question is *which sub-complex
do we choose to render* — a genuine manifold sub-complex, a convex hull, one shell — and
that question is answered in the algebra, upstream of any renderer. This is the same shape
as rung 7's own finding that ~1% of rays hit two triangles at bit-identical depth: the
projection **folds**, and a tie-break is a declaration, not a fix.

---

## 6. The exactness cost, named and not smuggled

Even setting aside §5, converting derived geometry to fitted Gaussians costs three things,
in increasing order of severity:

1. **The single √6.** Rung 6 closes the shading model over `Q(√6)`: the face normal is the
   exact integer root sum `a+b+c` with `|n|² = 48` on all 60,480 faces, the Lambert
   numerator is an integer, and exactly one `Math.sqrt` call site exists in the module
   (**VERIFIED** by that rung's own source scan and mutant M22). A fitted Gaussian's mean
   and covariance are floating-point parameters with no algebraic closure. `Q(√6)` becomes
   `double`.

2. **The exact coverage law.** Rung 4's falsifier is Pick's-theorem residual **exactly 0**
   and a 240-way partition with zero overlaps and zero cracks. Coverage by a sum of
   Gaussians is a real-valued integral. There is no integer conservation law to check, so
   the falsifier does not merely weaken — **it ceases to exist**.

3. **Provenance — and this one is disqualifying on its own.** The engine's defining
   property is that *"every rendered coordinate carries a derivation, and the derivation is
   checked by a test rather than described in a comment"*: each vertex carries the index of
   the E8 root it is the snapped projection of, and mutant M2 (a single hand-authored
   vertex) kills the provenance test. **A fitted Gaussian has no root index.** Fitting is
   the inverse operation to deriving. Under Aaron's sentence this is not a cost to weigh —
   it is inadmissibility.

Stating the trade honestly: 3DGS is a **reconstruction** representation, learned from
multiview photographs by gradient descent against a re-rendering loss. Zeta has **exact
derived geometry**. We are not doing reconstruction, and nothing here should later be read
as "we do Gaussian splatting."

---

## 7. The vendor-neutral path, and the one direction actually worth taking

**The mathematics is vendor-neutral; the code is not.** 3DGUT is PyTorch plus custom CUDA
kernels on an RTX 6000 Ada, and it builds on 3DGRT which uses OptiX. None of that is
portable. But nothing in equations (6)–(10) needs a GPU at all — the prototype below is
plain TypeScript running under `bun`, and it reproduces the paper's central quality claim.

Two realisations, if a nonlinear projection ever became relevant:

- **WebGPU / WGSL.** The natural target given rung 7 already ships a
  WebGPU → WebGL2 → Canvas2D page. Note the repo currently has **no `.wgsl` files** of its
  own geometry; shaders are inline template strings (**REPORTED**).
- **The .NET/F# core.** There is already an F# second oracle
  (`src/Core.FSharp.E8Render/`, branch-only) with a NEON SIMD tracer. The UT is a handful of
  dot products; it would byte-lock across oracles like anything else.

**Neither is worth building today, because §3 shows there is nothing to accelerate.**

### 7.1 The direction that IS live

The genuinely interesting thing the paper surfaces is not the UT and not the particle. It is
the question the UT would answer *if we had it*:

> **What would it mean for Zeta's geometry to carry uncertainty?**

Today every coordinate is exact, so the pushforward of a point is a point and there is
nothing to propagate. But §2.5 established that an anisotropic Gaussian **is** a
versor-transformed ball — the covariance is a Clifford object, not a bolt-on. If a soft or
probabilistic E8 embedding were ever wanted (a derived mean with a derived spread), then
sigma points would be versor-transformed frame axes, and the UT would become the natural
propagation rule the moment any nonlinear map entered the pipeline.

**Register: `toy`.** No such construction exists, nothing measures it, and it should not be
built on the strength of this document. It is recorded because it is the one place where
Aaron's three instincts — Bayesian machinery, Clifford structure, and this paper — actually
meet, and it names a thing to build rather than a conclusion to adopt.

---

## 8. The prototype

`src/Core.TypeScript/research/unscented-projection.ts` (+ `.test.ts`). **Metered.**

Vendor-neutral: no GPU, no CUDA, no dependencies. Implements the UT sigma-point construction
and recombination from the paper's equations (6)–(10), the EWA linearisation it replaces,
a deterministic Monte-Carlo reference (mulberry32 + Box–Muller, seeded — manifesto §7 DST,
and there is a test asserting byte-identical replay), 2D Gaussian KL divergence, and the
pinhole/fisheye/affine projections used to probe the boundary.

It is a **measurement instrument, not a renderer.** It fits nothing, learns nothing, and
renders nothing.

### 8.1 Results

11 tests, all passing (**VERIFIED**, `bun test`, 267+ assertions). `bunx tsc --noEmit`
clean. Sibling `clifford-e8-coxeter-projection.test.ts` unaffected (23 pass together).

### 8.2 Mutation testing — including the mutant that escaped

A test suite that no mutant can kill is not a falsifier. Four mutants, and **the second one
found a real gap**, which is recorded here rather than quietly patched:

| mutant | change | result |
|---|---|---|
| **M1** | sigma points spread `+` in both directions (symmetry broken) | **killed** — 6 failures |
| **M2** | covariance recombination uses `meanWeights` instead of `covWeights` | **SURVIVED** initially — see below |
| **M3** | `J Σ Jᵀ` second index `jacobian[b]` → `jacobian[a]` | **killed** — 4 failures |
| **M4** | `lambda` shifted by `+0.5` | **survives — equivalent mutant**, see below |

**M2 was a genuine hole.** The two weight vectors differ *only* at index 0, that difference
is exactly the β term, and nothing in the suite asserted β had an effect anywhere. F4 pinned
that β is inert for affine maps — but "inert everywhere" was then indistinguishable from
"correct", which is the vacuity class in miniature. The repair is **F5**: under a nonlinear
projection the centre sigma point does not coincide with the recombined mean, so β must
move the covariance and must *not* move the mean. With F5 added, **M2 is killed**
(**VERIFIED**, 1 failure).

**M4 survives and should.** The scaled UT is a family parameterised by `(α, β, κ)`; every
member is a legitimate UT, and affine-exactness holds for all of them. Pinning one tuning
would over-fit the test to an arbitrary choice. The right response was to *promote the
finding* rather than guard the constant — which is what the second F2 test now does, turning
"UT matches EWA at 3DGUT's settings" into the stronger "**UT matches EWA at every
setting**". M4 is therefore an equivalent mutant, and the strengthening it prompted is the
most useful thing it produced.

F4 is retained as the declared **control that must survive**: β is genuinely inert for
affine maps, and a guard asserting otherwise would be a check that cannot fail.

---

## 9. Honest limits

- **The 738 overdraw ratio and the 29.3% bbox figure are REPORTED, not verified by me.**
  They live in rung-7 documents on a branch not present in my worktree, read via `git show`
  by a sub-agent. My conclusions in §5 depend on the *existence* of high depth complexity,
  not on the exact figure; a materially smaller number would soften §5 but would not touch
  §3, §4 or §6.
- **Correction to the framing I was given:** 738 is a *ratio* of total triangle area to
  bounding-sphere area ("738 layers deep"), not a per-pixel overdraw count.
- **I did not measure a Gaussian fit of our geometry.** §5 and §6 argue from the structure
  of the representations, not from a built comparison. Building one would cost real effort
  and, given §6.3, would be inadmissible on arrival — which is why I declined it.
- **§2's ADF/EP/UKF chain is anchored on Minka 2001 and the standard UKF literature, cited
  from knowledge rather than from a PDF I opened in this session.** The EP mechanics I
  assert about *this repo* are verified from `src/Bayesian/Ep.fs` directly. Flagged so the
  two are not read at equal strength.
- **The fisheye and pinhole cases are single-configuration probes**, not the sweep over
  many Gaussians and poses that 3DGUT's Fig. 12/13 report. They establish the direction and
  rough magnitude of the boundary, not a calibrated curve.
- **The sibling effort was not duplicated.** The `sbvh-and-the-projection-question` branch
  had **zero commits of its own** at the time of writing (**REPORTED**); nothing here
  touches BVH construction or the triangle representation.

---

## 10. Anchors (Beacon)

- Qi Wu, Janick Martinez Esturo, Ashkan Mirzaei, Nicolas Moenne-Loccoz, Zan Gojcic — *3DGUT:
  Enabling Distorted Cameras and Secondary Rays in Gaussian Splatting*, NVIDIA / University
  of Toronto, 2025. The paper under assessment.
- Simon J. Julier & Jeffrey K. Uhlmann — *New extension of the Kalman filter to nonlinear
  systems*, SPIE Defense, Security and Sensing, 1997; with Hugh F. Durrant-Whyte, ACC 1995.
  The Unscented Transform.
- Eric A. Wan & Rudolph van der Merwe — *The unscented Kalman filter for nonlinear
  estimation*, IEEE AS-SPCC, 2000. The scaled weights implemented here.
- Bernhard Kerbl, Georgios Kopanas, Thomas Leimkühler & George Drettakis — *3D Gaussian
  Splatting for Real-Time Radiance Field Rendering*, ACM TOG 42(4), 2023.
- Matthias Zwicker, Hanspeter Pfister, Jeroen van Baar & Markus Gross — *EWA Splatting*,
  IEEE TVCG 8(3), 2002. The linearisation the UT replaces.
- Nicolas Moenne-Loccoz, Ashkan Mirzaei, Or Perel, Riccardo de Lutio, Janick Martinez Esturo,
  Gavriel State, Sanja Fidler, Nicholas Sharp & Zan Gojcic — *3D Gaussian Ray Tracing*, ACM
  TOG / SIGGRAPH Asia, 2024. Where the secondary rays actually come from.
- Lukas Radl, Michael Steiner, Mathias Parger, Alexander Weinrauch, Bernhard Kerbl & Markus
  Steinberger — *StopThePop*, ACM TOG 43(4), 2024. The MLAB / k-buffer sorting.
- Thomas P. Minka — *Expectation Propagation for Approximate Bayesian Inference*, UAI 2001.
  EP as iterated ADF; the common parent in §2.2.
- Carl Rasmussen & Christopher Williams — *Gaussian Processes for Machine Learning*, §3.6
  eq. 3.58. The exact probit moment match this repo implements.
- Ralf Herbrich, Tom Minka & Thore Graepel — *TrueSkill™: A Bayesian Skill Rating System*,
  NIPS 2006. The repo's other EP surface.
- Pierre-Yves Dechant — *The E8 geometry from a Clifford perspective*. The versor route to
  the root system that rungs 1–6 build on.

## 11. Pointers

- `src/Core.TypeScript/research/unscented-projection.ts` (+ `.test.ts`) — the prototype.
- `src/Core.TypeScript/research/clifford-e8-coxeter-projection.ts` — `projectRoots`, the
  linear map §3.2 measures.
- `src/Core.TypeScript/research/clifford-e8-eigenlayer-tessellation.ts` — rung 3's linear 3D
  embedding.
- `docs/research/2026-09-09-zeta-graphics-engine-derived-geometry-and-the-exact-coverage-boundary.md`
  — the engine's defining constraint and the rung ladder.
- `docs/research/2026-09-09-rung-6-shading-derived-the-face-normal-is-the-root-sum-and-the-model-closes-over-q-sqrt-6.md`
  — the `Q(√6)` closure and the 27-faces-per-edge measurement.
- `src/Bayesian/Ep.fs` — the exact probit projection §2.3 compares against.
- `.claude/rules/numerology-vs-number-theory.md` — the discipline §2 is executing.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the registers used throughout.
