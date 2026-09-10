# Graphics/physics engine roadmap — read the generator at rank 3, and price the fast path

Work item: 081M23QZTS3087G0R003T4JP4S · 2026-09-09 · register: the measurements are
`metered`; the sequencing is a `toy` proposal until each phase's falsifier exists.

Aaron asked for a roadmap once the analysis returned, and named three questions inside it:
switch to quaternions or something else for performance; should there be a "correct" and a
"performance" version that sacrifices 100% correctness; and where the Bayesian work fits.
This answers those from what was measured today, and says plainly where it is guessing.

## 1. The four measurements that constrain everything below

**(a) Every rank-3 projection of a 2-complex self-intersects. This is a theorem, not a
defect.** A rank-3 map from `R⁸` has a 5-dimensional kernel, and a 2-complex is in general
position only in dimension `2k+1 = 5` (Whitney 1936). Measured consequence: across 56
eigenlayer frames plus 60 random orthonormal frames the overdraw ratio spans **598–834, a
total spread of 1.39×**, and the best of 24 random frames buys **1.16×**. No choice of
projection repairs it.

**(b) 27 faces per edge is combinatorial.** `edgeFaceIncidence` runs on the face list with
no coordinates anywhere in its call graph and reports min 27 / max 27 over all 6,720 edges.
It is `3·f₂/f₁`. **No change of algebra alters it** — not PGA, not CGA, not anything. So
the surface has no consistent side, and "reflective" is under-_specified_ rather than
under-implemented.

**(c) Exactness comes from ALGEBRAIC INTEGERS, not from dimension 8.** Measured: **H3
closes at exactly 30 roots in `Z[φ]`**, one norm class (the rational integer 4, φ-component
exactly zero), zero reflections leaving the ring, **rank 3, no projection**. What dimension
8 uniquely buys is 240 directions and a Weyl group of order 696,729,600. A 3D renderer
needs neither.

**(d) The projection is a one-time load-time step, so it is free per frame — unless you
animate in 8D, which costs 25.2×.** Per vertex, M2 Ultra, Bun 1.3.14, single-threaded
scalar TS, median of 41 trials after 20 warm-up:

| path                      | ns/vertex | × mat4    |
| ------------------------- | --------- | --------- |
| 8D-then-project           | 45.5      | **25.2×** |
| mat4                      | 1.81      | 1.00×     |
| quaternion + translation  | 3.03      | 1.67×     |
| **PGA motor**             | **3.03**  | 1.69×     |
| PGA naive (unspecialised) | 364       | **201×**  |

## 2. Aaron's question 1 — quaternions, or something else?

**We already have quaternions, and the question dissolves rather than resolves.** Motors
_are_ dual quaternions (Clifford 1873; Study 1903), and this was derived before it was
measured: symbolic expansion of `M X M̃` gives weight `= s²+e23²+e31²+e12²` — the rotor norm
alone — so the action is affine and PGA's degenerate half does **no per-vertex work**. The
measurement agrees to the digit: 3.03 ns either way.

So the decision is not _which algebra_ but _which code path_:

- **Inner loop: the specialised motor/quaternion path** (1.69× mat4). Never the naive GA
  call — that is the 201× row, and it is the whole of the folklore that "GA is slow."
- **Composition, screw motions, and physics joints: PGA.** This is where uniform versors
  and a single motor for rigid motion earn their place.
- **Never animate in 8D.** 25.2×, for a dimension count a renderer does not use.

## 3. Aaron's question 2 — a "correct" and a "performance" build?

**Yes — and the discipline is that the correct one PRICES the fast one, rather than the fast
one being unpriced.** We already have three measured instances of the trade, which is what
makes this a real proposal rather than a preference:

| fast path                    | speedup                       | measured price                                         |
| ---------------------------- | ----------------------------- | ------------------------------------------------------ |
| triangle subdivision vs SBVH | **7.4×** (2.2 vs 16.3 µs/ray) | **2.9% of pixels move**; 58× memory (234 MB vs 4.0 MB) |
| SAH / SBVH                   | —                             | **zero pixels move**                                   |
| one-ulp scene perturbation   | —                             | **2.40% of pixels move**                               |

The third row is the important one: it is not a _choice_ we make, it is a property of the
scene. **The tracer is deterministic; the scene is ill-conditioned.** So "100% correct" is
already not on offer at float32 — the honest framing is _which_ approximations are declared
and measured, not whether any exist.

Proposed rule, and it is the falsifier for the whole split:

> **The exact build is the ORACLE. Every fast path ships with the measured fraction of
> pixels it moves against that oracle, and a fast path whose divergence is unmeasured does
> not ship.**

That keeps the split from becoming the vacuity class — a "performance mode" nobody priced
is just a slower correctness claim. It also means the exact build must stay runnable at some
resolution forever, which is a real ongoing cost and is the argument against ever deleting
it.

Register note: the exact core is a differentiator for **correctness and cross-oracle
byte-lock**, not for visual quality. Five brightness levels is, as a renderer, a toy — said
plainly. **49 levels are available at no loss of exactness** (a non-root integral light;
the field moves `Q(√6) → Q(√17)`), and two root lights stay in `Q(√6)` entirely. Per-vertex
normals go _backwards_: the vertex normal is exactly 1512 × the vertex, so Gouraud
degenerates to the sphere normal and yields **three** levels.

## 4. Aaron's question 3 — where the Bayesian work fits

**Not in rendering.** Measured: our 8D→3D derivation is a **linear map**, so the Unscented
Transform and the EWA linearisation it replaces agree to **6.7e-16 mean / 7.1e-15
covariance** across _every_ UT parameterisation. There is nothing to buy, and it cannot be
tuned into a benefit.

**In physics, and the reason is structural.** The UT's whole purpose is propagating a
distribution through a **nonlinear** map. Rigid-body dynamics is nonlinear; a rendering
projection is not. The common parent identified is **ADF** — EP is ADF iterated (Minka
2001), the UKF is ADF with unscented quadrature — so the repo's existing EP machinery and
the UT are siblings rather than the same tool. A physics layer that carries _uncertainty in
its state_ rather than a single trajectory is where that inheritance pays.

**And in the reasoning goal, which is the actual thesis.** The fidelity meter proposed in
PR #17158 — mutual k-NN, CKA/RSA, and the Williams shape metric against three nulls
including a **random-carrier control at equal dimension** — is what converts "mind, body,
English and affect project onto one space" from an unfalsifiable claim into a measurement.
That control is the one that decides whether Clifford is doing any work at all.

## 5. The roadmap

**Phase 0 — stop paying for what we do not use.** Read the generator at **rank 3**.
Dechant's chain runs **H3 → H4 → E8**, so rendering should read it at the bottom rather than
squash from the top. H3 gives exact `Z[φ]` geometry with no projection and therefore no
forced self-intersection. **0 bytes of geometry survives and improves** — an H3 seed is
_smaller_ than the E8 one. Falsifier: an H3 golden document byte-locked across oracles, the
same shape as the E8 one that held first try today.

**The caveat Phase 0 rests on, named by the agent that measured it:** the H3 result is
measured for the **ring**, not the **light**. `Z[φ]` closure, the single norm class and the
rank-3-no-projection facts are run. **Exact shading over an H3 orbit polytope is `toy` and
unrun.** If Phase 0 proceeds, that is the first thing to falsify — before the byte-lock, not
after, because a golden document that locks an inexact shading model locks the wrong thing.

**Phase 1 — one renderable object.** 4_21 cannot be an occlusion-correct 3D scene, and that
is filed. The engine needs content whose 2-skeleton embeds. This is the phase that unblocks
reflections, water and everything downstream, because all of them presuppose a surface with
a side.

**Phase 2 — the engine core, in F#.** The .NET oracle already byte-locks to TypeScript on
first run, `Vector<T>` gives one code path across NEON/AVX2/AVX-512 at a measured ×3.4, and
DoP 1 and DoP 24 are byte-identical — the scale-free discipline honoured rather than
asserted. Add the specialised motor path, keep the naive GA call out of the loop.

**Phase 3 — GPU, rasterisation first.** Rasterisation is indifferent to the acceleration
structure; **GPU ray tracing hits the same wall we did**, because the leaf/root surface-area
ratio (~1,140 on 4_21) is a property of the geometry. So GPU rasterise now; GPU ray-trace
only after Phase 1 supplies geometry a BVH can separate.

**Phase 4 — physics, and the first wall is arithmetic.** Geometry stayed exact because all
irrationality sat in one named `√6`. **Time integration brings division and roots
everywhere**, so the fixed-point / rational / float decision is the _first_ thing a physics
proposal must answer, ahead of any solver choice. DST replay depends on it.

**Phase 5 — reflections, water, materials.** Blocked on Phase 1, not on effort.

## 6. What this roadmap does not know

- Whether H3 produces a _usable_ scene, or merely an exact one. Phase 0's falsifier tests
  the byte-lock, not the aesthetics.
- **Whether shading stays exact over an H3 orbit polytope at all.** The ring is measured;
  the light is not. E8's five levels came from a light that _is a root_ meeting root-sum
  normals — an H3 analogue of that argument exists on paper and has not been run.
- The fixed-point/rational/float decision. Named, not made.
- Whether the fidelity meter's random-carrier control will vindicate Clifford or refute it.
  It is designed to be able to do either, which is the point.
- Nothing here implements an engine. No dynamics, no solver, no materials.

## 7. Anchors

Whitney (1936), general position. Clifford (1873) and Study (1903), dual quaternions.
Dechant, the H3 → H4 → E8 induction chain. Stich, Friedrich & Dietrich (2009), spatial
splits in BVHs. Julier & Uhlmann, the unscented transform. Minka (2001), EP as iterated ADF.
Elliott & Hudak (ICFP 1997), functional reactive animation. Laine, Karras & Aila (HPG 2013),
wavefront path tracing. Kornblith et al. (2019) and Williams et al. (2021), representational
alignment. Coxeter, the 4_21 polytope and its 60,480 triangles — **counted in-tree, not
quoted**.
