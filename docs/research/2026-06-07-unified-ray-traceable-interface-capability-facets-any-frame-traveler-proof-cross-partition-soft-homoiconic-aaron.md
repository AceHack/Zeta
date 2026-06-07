# The unified ray-traceable interface — capability facets, any-frame trace, traveler-frame proofs, cross-partition soft uncertainty, homoiconic memory↔function routing (Aaron, 2026-06-07)

Builds the ray-traceability capability vector (#6876/#6877, Amara's build-compass #6882) into **C# contracts**
in `Zeta.Core.Abstractions`. Faithful capture of Aaron's streamed refinements; design doc for the landed
interfaces.

## The facets (the capability vector as one-type-per-file C# contracts)

| facet | interface | role in the ray trace |
|---|---|---|
| sparse + enumerate | `ITensor<TCoord,TValue>` (existing) | skip empty space; the support |
| **light** | `ISampleable<TCoord,TValue>` | sample values along the ray (the field carries light) |
| **introspection** | `IIntrospectable<TCoord>` | walk/query the structure (MUMPS/Globals-style) |
| **geospatial** | `IGeospatial<TCoord>` | metric **locality topology** — makes a "ray" geometric |
| **weighted** | `ISemiring<TValue>` (existing, passed to `Trace`) | accumulate along the ray |
| frame | `IFrame` / `ITravelerFrame` | where the ray is cast *from* |
| unified | `IRayTraceable<TCoord,TValue>` | composes the above + `Trace(from, ray, accumulate)` |

A structure missing a facet is **"dark" in that dimension** — the gap-finder: the missing capability is the
next build (the compass made into types).

## Any frame is the capability; the traveler frame is the proof

> Aaron: *"from any arbitrary frame actually — that's what ray-traceable gives you. The traveler frame gives
> you proofs you can prove across all self-propagating patterns including Zeta itself."*

- **`Trace(IFrame from, …)`** — ray-traceability is the ability to trace from **any** frame (a view from any
  vantage point).
- **`ITravelerFrame` (`IsDeterministic`)** — the distinguished, **proof-bearing** frame: DST-deterministic →
  replayable → **provable**. A trace from a traveler frame is a *theorem*, not just an observation, and it
  holds **across all self-propagating patterns — including Zeta itself** (a self-propagating pattern proving
  things about itself; self-reference made sound by determinism).

## Cross-partition + irreducible uncertainty (soft tracing)

> Aaron: *"it lets you [do] cross-partition ray tracing based on others' DynamicValue/SoftValue and their
> irreducible uncertainty."*

The ray may cross partition boundaries and sample other partitions' `DynamicValue`/`SoftValue` fields. With
`TValue = SoftValue` and a probability `ISemiring`, the trace **propagates each partition's irreducible
uncertainty** — you cannot sample away another partition's residual; it is theirs and carries forward. So a
cross-partition trace returns a *soft* result, and the traveler-frame proof becomes a proof about
*distributions/bounds* (provable despite — and about — the uncertainty), not point values. (NeRF-shaped:
a probabilistic radiance field, but bit-perfect-consensus + DST instead of float-fuzzy.)

## Geospatial = a unified locality topology (not just lat/lon)

> Aaron: *"the geospatial holds the Sequoia-like Stanford memory topology … the network memory map and
> generator function map … remember when / pay attention."*

`IGeospatial` is the metric **where/when/what-to-attend** topology. The "space" generalizes to:

- **Hierarchical memory** — Sequoia (Fatahalian et al., Stanford 2006): a recursive memory-level tree;
  position = locality in the memory hierarchy.
- **Network memory map** — distributed placement across nodes/cells (which machine holds it); proximity =
  network locality → enables cross-partition tracing.
- **Generator-function map** — where the generators/compressors live (compression-as-generators); position
  locates a region's *producer*.
- **Spatio-temporal + attention** — a `when` axis and an attention weighting ("remember when / pay
  attention"); attention is learned proximity/relevance in this space — the substrate's analogue of
  transformer attention.

So a coordinate's position is its location in (memory hierarchy × network × generator-space × time ×
attention); a ray respects locality across all of these at once.

## The homoiconic payoff — route memory↔function both ways

> Aaron: *"this way you can route memory to functions and functions to memory both — they are all homoiconic
> data."*

Because the substrate is **homoiconic** — functions are Bonsai expr-trees, and Bonsai expr-trees are
`DynamicValue`, the same `DynamicValue` that memory is — **the memory map and the generator-function map are
the same map.** So the locality topology routes **bidirectionally**: a ray goes from a memory region to the
**generator function that produces it**, and from a function to the **memory it reads/writes** — one
addressable, ray-traceable space for code and data alike. (Lisp/Smalltalk homoiconicity + content-addressed
code (Unison), realized as routable locality: code-as-data isn't just storable, it's *traceable in the same
space as the data*.)

## Geometry as the optimizer — and geospatial in Clifford (geometric-algebra) space

> Aaron: *"and optimize with geometry geospatial … I'd love to do geospatial in Clifford space too if we can."*

- **Geometry IS the optimizer.** The geospatial embedding turns the trace into a geometric problem, so the
  classic acceleration structures apply: BVH / sparse-voxel-octree / R-tree / geohash skip empty and far
  regions; nearest/within queries prune the ray. Locality (memory/network) + geometry (space) jointly make
  the trace sub-linear instead of a full scan.
- **Clifford / geometric-algebra (GA) space (desired direction).** Embed the locality space as a **Clifford
  algebra** (multivectors, rotors) rather than plain ℝⁿ. Two reasons it's the right home:
  1. **GA is built for ray geometry.** A ray and a surface are blades; their **meet** (`∨`) *is* the
     intersection — ray-object intersection becomes one algebraic operation. Rotors do rotation/orientation
     without gimbal/quaternion-glue.
  2. **It composes with the floor we just unified.** Clifford algebras subsume the Cayley-Dickson towers:
     **quaternions = the even subalgebra Cl⁺(3,0)** (rotors in 3-space); complex = Cl⁺(2,0). So the
     `IStarRing` hypercomplex floor (#6888) and a GA geospatial space are the *same* algebraic family —
     `WeightedSet<_, multivector>` over a Clifford `IStarRing` would give GA weights *and* GA geometry in one
     substrate. (Honest scope: a Clifford `IStarRing` instance + a GA-backed `IGeospatial` is a backlog
     build, gated on a conformal-vs-Euclidean GA signature choice; "if we can" → yes, and it slots cleanly
     into the existing floor + facets.)

## Status / next

Landed: the C# contract facets (`IFrame`, `ITravelerFrame`, `ISampleable`, `IIntrospectable`, `IGeospatial`,
`IRayTraceable`) in `Zeta.Core.Abstractions` (one-type-per-file; Abstractions + Core build 0/0). **No
implementations yet** — these are the contracts; the buildable next step (per Amara's first-proof) is one
structure adopting the facets + a `trace(R, S_before/after)` that is deterministic, inspectable, replayable
from a traveler frame over one small scene. `Globals` (introspection ✓) + `WeightedSet` (sparse+weighted ✓)
are the closest existing structures; the gaps are `ISampleable`/`IGeospatial` impls + the `Trace` operator.

## Beacon anchors

- **Sequoia** (Fatahalian, Knight et al., Stanford 2006 — memory-hierarchy-as-tree). · **Ray marching /
  volumetric (NeRF) rendering**; sparse-voxel-octree / R-tree / BVH (geometric acceleration). · **Homoiconicity**
  (Lisp; Smalltalk image) + **Unison** (content-addressed code). · **Transformer attention** (learned
  proximity in an embedding space) — the geospatial attention dimension. · **DST** (the traveler-frame proof
  property). · Ours: `ITensor`/`ISemiring`/`IStarRing` (the floor), `Globals` (introspection), `WeightedSet`
  (sparse/weighted), `SoftValue` (irreducible uncertainty), `Bonsai` (functions-as-DynamicValue),
  `TravelerFrame`, the capability-vector captures (#6876/#6877/#6882). Honest novelty: none in ray tracing or
  homoiconicity individually; the contribution is the **unified ray-traceable contract** — one
  facet-composed interface, traced from any frame (proof from the traveler frame), cross-partition over soft
  fields, over a locality topology that unifies memory/network/generator/time-attention, routing code↔data
  homoiconically.
