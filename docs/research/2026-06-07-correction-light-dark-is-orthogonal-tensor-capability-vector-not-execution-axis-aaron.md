# Correction: light/dark is an orthogonal tensor-CAPABILITY vector, not the execution axis (Aaron, 2026-06-07)

**Supersedes the "light vs dark" section of `2026-06-07-greenfield-algebra-floor-design-…` (#6875).** I
conflated two orthogonal things — Aaron: *"no they are two orthogonal things. dark tensors are missing one of
the following maybe more: light / sparse / weightedset / introspection(mumps) tensors."* Owning the error and
recording the right model.

## What I got wrong

#6875 framed light/dark as a **single execution classifier** (light = parallel/GPU, dark = serial/CPU). That
fused it with the parallel-soft↔serial-sharp axis. **Wrong.** Light/dark is **orthogonal to execution** — it
is about which **capabilities a tensor has**, and execution (parallel/serial) is a *different, independent*
concern.

## The right model — a capability vector; "dark" = missing a capability

A tensor (the unified value) carries a vector of **independent capability flags**, each a composable interface
it may or may not implement:

| capability | meaning | interface / carrier |
|---|---|---|
| **light** | tensor-representable — encodes as a flat numeric buffer | dense `Tensor<T>` / `ITensor` dense-lowerable |
| **sparse** | COO / support representation (only nonzeros stored) | `ITensor.IsSparse` / `WeightedSet` |
| **weightedset** | semiring-weighted (carries the algebra) | `ISemiring` weights / `WeightedSet` |
| **introspection (mumps)** | path-addressable, navigable by Globals/MUMPS verbs | `Globals` over the structure |
| *(candidates — "maybe more")* | soft/uncertain · content-addressed · retraction-native | `SoftValue` · `MerkleHash` · Z-set `−1` |

These are **orthogonal axes**: a value can be sparse-but-not-light, introspectable-but-not-weighted,
light-but-not-introspectable, etc. A **"dark tensor" is one missing one (or more) of these capabilities** —
darkness is per-axis (dark *in* a dimension), not a global binary.

## How the existing structures sit in the lattice (illustration)

| structure | light | sparse | weighted | introspection |
|---|---|---|---|---|
| dense `Tensor<T>` | ✓ | ✗ | ✗ | ✗ |
| `WeightedSet<'K,'W>` (numeric `'W`) | ✓ | ✓ | ✓ | ✗ |
| `Globals` / ragged `DynamicValue` | ✗ | ✓ | ✗ | ✓ |
| `SoftValue` (distribution) | ✗ | ✓ | ✓ (prob weights) | ✗ |

No single structure has all four today — each occupies a different capability-subset (= dark in the missing
columns). A "fully light" tensor would carry the whole vector; most carry a subset.

## Why these capabilities — they make the tensor RAY-TRACEABLE (and this grounds "light/dark")

Aaron: *"basically those things make the tensor ray-traceable."* That is the unifying purpose of the
capability vector — and it rescues the naming: **light = participates in ray transport; dark = doesn't.** Not
metaphor — the literal predicate. To ray-trace a tensor (cast a ray = a path query, accumulate along it) you
need exactly these capabilities, each playing its ray-tracing role:

| capability | ray-tracing role |
|---|---|
| **introspection (mumps)** | **walk the ray** — step along coordinates through the structure (`$ORDER`/`$QUERY` = the traversal cursor advancing the ray) |
| **sparse** | **skip empty space** — the acceleration structure (sparse-voxel-octree / BVH style); empty regions cost nothing |
| **weightedset** | **accumulate** — integrate density/opacity/contribution along the ray (volumetric integration; the weight is the sample's contribution) |
| **light** | **sample** — the values are numeric/tensor-representable, so the ray can read them (they transport light) |

So a tensor with the full vector is **ray-traceable**: cast a ray, accelerate through empty space via
sparsity, walk it via introspection, integrate weighted samples via the algebra, read numeric values via
light. A **dark tensor is one you cannot ray-trace** because it lacks a capability — not introspectable (no
way to walk the ray), not sparse (no acceleration / can't skip), not weighted (nothing to accumulate), or not
light (values don't transport — literally dark). **Darkness = no light transport = not traceable.** The
coinage now compresses to a real, testable predicate (ray-traceability), so it is *not* too far — the
naming caveat from #6875 is resolved.

## The capability vector IS the gap-finder; the stack is a ray-tracing physics engine on the soft interrupt handler

Aaron: *"that's how we know what we are missing — we are building a ray-tracing physics engine on top of our
soft interrupt handler."* Two load-bearing points:

1. **Ray-traceability is the gap-finder.** For any tensor/structure, ask which of {light, sparse, weighted,
   introspection, …} it lacks — that missing set *is* the build backlog to make it traceable. The capability
   vector turns "what's missing?" into a checklist (e.g. `WeightedSet` lacks introspection → give its
   coordinates Globals paths; `Globals` lacks light+weight → numeric leaves + semiring weights; dense
   `Tensor<T>` lacks sparse+introspection → an acceleration structure + path index). Each missing cell is a
   workitem.

2. **The architectural stack (directional vision — peeled):**
   - **bottom — the soft interrupt handler:** the observe→act loop where observations arrive as interrupts and
     update `SoftValue` distributions (Bayesian `SoftValue.observe`), over the Rx/event substrate. *(Term to
     pin: "soft interrupt handler" should be bound to the concrete component — the SoftValue observe-loop /
     event source — before it's load-bearing; flagged, not assumed.)*
   - **top — the ray-tracing physics engine:** rays = path queries cast through the soft-tensor field
     (introspection walks them, sparsity accelerates, weights integrate, light samples); "physics" =
     integrating/propagating over that field (volumetric integration; the soft/uncertain field makes it a
     *probabilistic* render — NeRF-shaped: a weighted radiance field sampled along rays).

   **Honest scope:** this is the *direction*, not a built engine. The concrete, in-hand deliverable is the
   capability vector as a gap-finder + the ray-tracing *roles* each capability plays. "Ray-tracing physics
   engine" is the Mirror vision; it earns Beacon status only as the capability cells get filled and a real
   trace runs. Don't overclaim a physics engine from a capability taxonomy — but DO use the taxonomy to drive
   what to build next.

## Consequences

- **Composable capability interfaces, not one mega-tensor.** Model each capability as its own small interface
  (`ITensor` light/sparse facets already exist; add introspection + weighted facets). A concrete tensor
  *implements the subset it has*. Acquiring a capability = adding a facet (e.g. give `WeightedSet`
  introspection by keying coordinates as Globals paths).
- **Still branch-free.** Capability presence is carried as **data / facet-availability**, selected by
  composition, not `if` in the hot path (same discipline as before — instance/facet selection).
- **Orthogonal to execution.** Parallel-vs-serial and sharp-vs-soft remain separate axes (the
  `2026-06-07-one-algebra-many-target-optimized-instances-…` capture). A light tensor *can* run serial; a dark
  (non-introspectable) one *can* run parallel. Do not couple them — that was the error.
- The greenfield floor design (#6875) still stands for the **algebra ladder** (ISemiring→IStarRing, towers);
  only its light/dark paragraph is replaced by this capability-vector model.

## Beacon anchors

- **Capability-based / facet (role) interfaces** — composable small interfaces (ISP, the Interface
  Segregation Principle; role objects pattern) — the right shape for an orthogonal capability vector. ·
  **Lattice of feature flags** (a product/poset of capabilities). · Ours: `ITensor` (light/sparse facets),
  `WeightedSet`/`ISemiring` (weighted), `Globals` (introspection/MUMPS), `SoftValue` (soft), `MerkleHash`
  (content-addressed), Z-set (retraction). Honest novelty: none in capability/facet interfaces; the
  contribution is naming the **tensor capability vector** {light, sparse, weighted, introspection, …} as
  orthogonal axes, with "dark" = a missing capability — explicitly **decoupled** from the execution axis.
