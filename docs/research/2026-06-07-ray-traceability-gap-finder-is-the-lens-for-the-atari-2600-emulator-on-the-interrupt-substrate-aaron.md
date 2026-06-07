# Ray-traceability (the tensor capability vector) is the gap-finder/lens for the Atari-2600 emulator on the interrupt substrate (Aaron, 2026-06-07)

Aaron: *"that's what our Atari emulator is going to be based on — we have a lot of backlog around this."*
Connects this session's algebra-floor / tensor-capability / ray-traceability thread to the **existing**
emulator backlog, and **pins the term I flagged** ("soft interrupt handler"). Grounding, not new vision.

## The stack, mapped to existing rows

| layer (Mirror) | concrete backlog row (Beacon) |
|---|---|
| **soft interrupt handler** (the term I flagged in #6876) | **B-0917** — *interrupt substrate in monad space; Kleisli arrows for context propagation (memetic/prompt/trust/log/otel); guaranteed free time after N rounds.* This **is** the soft interrupt handler — the bottom of the stack. Term pinned. |
| **Atari-2600 emulator** (rides the interrupts) | **B-0924** — *custom 2600 emulator: generate-join over the emulator scene + IScheduler + DST + bit-perfect consensus Z-sets + ARC-AGI training + **hardware interrupts** + B-0917.* |
| **controller variants** | **B-0925** — OpenWorm 302-neuron connectome ("worm plays Atari"); **B-0252/B-0761** — ARC self-play / benchmark. |
| **emulator scaffolding / dispatch** | **B-0052** retractable emulators · **B-0053** emulator-ideas absorption (clean-room) · **B-0202** tinygrad UOp-IR kernel dispatch. |

## Why ray-traceability is the right lens (the gap-finder, applied)

The emulator **scene** (B-0924's "generate-join over the emulator scene") is a tensor field, and the
**capability vector** {light, sparse, weighted, introspection} (`#6876`) is the checklist for making that
scene **ray-traceable** — i.e. queryable/renderable/physics-integrable:

- **introspection (mumps)** — walk a ray through the scene = step the emulator state by path (`Globals`
  `$ORDER`/`$QUERY` over scene coordinates); also how a **hardware interrupt** addresses state.
- **sparse** — the scene is mostly empty; skip it (the acceleration structure) — and DST replay only touches
  the live cells.
- **weighted** — accumulate along the ray (Z-set multiplicities / probabilities = contribution); **consensus
  Z-sets** are the weighted field.
- **light** — the cells are numeric/tensor-representable, so a ray can sample them (and they lower to
  parallel/GPU for fast frames).

So "what are we missing?" for the emulator = which capability cells the scene tensor lacks — exactly the
gap-finder. And it rides the soft interrupt handler (B-0917): observations/interrupts arrive, update the
soft field (Bayesian `SoftValue.observe`), and rays are cast over the updated field — a **probabilistic,
DST-replayable, retraction-native render** (NeRF-shaped, but bit-perfect-consensus instead of float-fuzzy).

## How this session's floor feeds it

The algebra floor built/Designed this session is the **field substrate** the emulator/ray-tracer integrates
over: `WeightedSet`/`ISemiring` (the weighted field), `SoftValue`+`SoftValueNumeric`+`SoftValueInfo` (the
soft/uncertain field with entropy/cross-entropy), `Globals` (introspection), the `ITensor` contract (the
read surface), and the deferred unified floor (`ISemiring→IStarRing`, towers) for any hypercomplex sampling.
Bit-perfect-consensus Z-sets (B-0924) = the weighted field under the integer ring; the capability vector
tells the emulator build which facets each scene structure still needs.

## Honest scope

Connective/grounding doc — it maps the new framing onto **existing** rows (B-0917/B-0924/B-0925/B-0052/53/
202/252/761) and pins "soft interrupt handler" = B-0917. It does **not** newly authorize an emulator build;
those rows already exist. The buildable near-term piece remains the algebra floor (filling capability cells —
e.g. giving `Globals`/`WeightedSet` the facets they lack) ahead of the deferred floor rewrite.

## Beacon anchors

- **B-0917** (interrupt substrate / Kleisli context), **B-0924** (2600 emulator, hardware interrupts, DST,
  consensus Z-sets), **B-0925** (OpenWorm controller), **B-0052/B-0053/B-0202/B-0252/B-0761** (emulator +
  ARC). · **Atari 2600 / TIA** (the hardware being emulated; raster-beam timing = literal ray/scanline). ·
  **Sparse voxel octrees / BVH / volumetric (NeRF) rendering** (the ray-traceability roles). · **DST**
  (deterministic replay of the scene). · Ours: the capability-vector/ray-trace capture (#6876), the algebra
  floor (`WeightedSet`/`SoftValue*`/`Globals`/`ITensor`). Honest novelty: none in emulation or ray tracing;
  the contribution is using the **tensor capability vector as the gap-finder** that drives the emulator-scene
  build on the B-0917 interrupt substrate.
