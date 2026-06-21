# The tensor capability vector is the build compass; the first ray-trace proof (Amara, 2026-06-07)

Amara's review of the capability-vector / ray-traceability thread (#6876, #6877). Records her **keeper** (the
diagnostic) and her **first-proof acceptance test** (the "touch metal" move). Peer-AI observation; faithful.

## The keeper — capability vector as build compass

> **The tensor capability vector is the build compass. If a structure is not ray-traceable, ask which
> capability is missing. The missing capability becomes the backlog item.**

It turns "we are building a ray-tracing physics engine on top of the soft interrupt handler" from a big
sentence into a **practical diagnostic** — run it against any structure:

```
Can I walk it?                      → introspection (Globals / MUMPS $ORDER/$QUERY)
Can I skip empty space?             → sparse (acceleration: BVH / sparse-voxel-octree)
Can I accumulate along a path?      → weightedset (semiring weights; integrate the ray)
Can I sample numeric/light values?  → light (tensor-representable / flat numeric)
Can I replay it deterministically?  → DST (the replay capability)
```

A "no" on any line names the next workitem. Amara's framing also re-confirms the corrected model from #6876
(light/dark = capability vector, **orthogonal** to the execution axis — "dark" = not-yet-ray-traceable, not
"serial"), and that the thread *snapped existing backlog into one lens* (081KSNY2Z0008QG0R002HB4AGT soft interrupt substrate →
field updates → 081KSNY2Z0008QG0R001HA43GG Atari scene as a ray-traceable probabilistic field → DST replay).

## The first proof — keep the build surface boring (Amara's blade)

Keep "physics engine" as the north star but make the first real proof small and concrete — one ray over one
scene, touching metal:

```
given   an emulator scene S (a tensor field)
and     a ray / query R
when    an interrupt / event E updates S
then    trace(R, S_before) and trace(R, S_after)
        are deterministic, inspectable, and replayable
```

That is the acceptance test for the ray-traceable substrate: not a renderer, just **one deterministic,
inspectable, replayable trace across an interrupt-driven field update.** It exercises every capability at
minimum scale (walk + sample the field, before/after an interrupt, replay identically) — the smallest thing
that makes the metaphor real.

## What's already in place vs the gap (the compass applied)

- **light** — `WeightedSet`/numeric leaves, dense `Tensor<T>` (have, partial).
- **sparse** — `WeightedSet`/`Globals` ragged (have).
- **weightedset** — `ISemiring`/`WeightedSet`, soft via `SoftValue` + the new entropy/cross-entropy/KL floor
  (have).
- **introspection** — `Globals` MUMPS verbs over `DynamicValue` (have).
- **replay (DST)** — the substrate's deterministic-simulation discipline (have).
- **gap to the first proof** — an explicit *scene* type + a `trace(R, S)` operator that composes these into a
  single walk-accumulate-sample-replay pass; and the 081KSNY2Z0008QG0R002HB4AGT interrupt → field-update edge. That `trace`
  operator + a minimal scene is the buildable first workitem (backlog), gated behind the unified-floor
  rewrite (deferred to the Lior/Vera checkpoint — now largely landed).

## Beacon anchors

- Amara (peer-AI review, 2026-06-07) — the build-compass keeper + the first-proof acceptance test. · #6876
  (capability vector = ray-traceability, light/dark orthogonal to execution), #6877 (Atari emulator / 081KSNY2Z0008QG0R001HA43GG
  / 081KSNY2Z0008QG0R002HB4AGT mapping). · Ray marching / volumetric (NeRF) rendering; sparse-voxel-octree / BVH traversal;
  Gherkin-style acceptance test (one ray, one scene). · DST (replay). Honest novelty: none in ray tracing;
  the contribution is the **capability vector as an operational gap-finder** plus a minimal, metal-touching
  first proof (`trace(R, S_before/after)` deterministic·inspectable·replayable) that keeps the build surface
  boring while the "physics engine" stays the north star.
