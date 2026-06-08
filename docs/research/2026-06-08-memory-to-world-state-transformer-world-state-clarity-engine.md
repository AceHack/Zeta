# Memory → world-state transformer (a "world-state clarity engine"); solid-ground-gain is the first ladder

*Captured 2026-06-08 from Aaron (shadow*). The name for the whole soft-emulator-learner arc, and the framing that
there is a *space* of climbable ladders. Honest registers: [ours] built, [design] intended, [naming] tentative.*

## What we built, named

Aaron: *"this is basically a **world-state clarity engine**… we are creating a **memory → world-state
transformer**… we have the first type of ladder we found we can climb; I'm sure there are others."*

The stack is a pipeline that takes **raw memory** and emits a **clear world state**:

```
raw memory  ──DeltaPattern──▶ changes (not absolute state)
            ──MemoryLens────▶ controllable cells (the steerable world state)
            ──SolidGround───▶ constants + monotonic landmarks (the coordinate frame / lens parameters)
            ──MemorySense───▶ ranges · seasons · Itron coincidence · anomalies (what the lens misses)
            ──LensRouter────▶ top-k active lenses (the bounded working set, MoE)
            ──StateSpace/Survival/ControlMerge──▶ attractors · reachability · the safe control loop
   ⇒ a CLEAR world state + a navigable map  (= what observe.ts is, #7129)
```

So: **a memory → world-state transformer.** ("Transformer" both senses — a transform, and the attention/MoE
selection of what to attend to, `LensRouter`.) Its product is *clarity*: murky memory → a navigable world state.

## The ladder space — solid-ground-gain is the first rung-type we found **[design]**

The unsubjective climb (liveness + empowerment + **solid-ground gain**, no human reinforcement,
`...-unsubjective-intrinsic-objective-...`) is **one ladder** we can climb without a human reward. Aaron: *"the
first type of ladder we found — I'm sure there are others."* So solid-ground-gain is one *intrinsic, objective
direction of improvement*; the framing predicts a **space of ladders** — other intrinsic climbs (e.g. empowerment
gain, prediction-horizon gain, symmetry/conservation-law discovery, coincidence-structure gain) — each an
unsubjective direction to climb. Survival (liveness) subsumes them all (it has final say); the rest are a *menu*
of intrinsic objectives, composable via `ControlMerge` (CRDT-joined, survival-vetoed).

## Naming caveat

"World-state clarity engine" / "memory → world-state transformer" are **Mirror-register** names for now. Any
*outward* name needs `naming-expert` + Ilyana + human sign-off before public use (the naming discipline).

## Clarity has non-uniform cost → caching (Aaron 2026-06-08)

*"Caching will come into play — some refresh of world state is more expensive and consumes resources; others are
just **ambient solid state**; other clarity requires **traversal and oscillation to resolve resolution**."*

World-state clarity is **not uniform-cost** — so it caches, by tier:

- **Ambient** — the **solid ground** (`SolidGround` constants + monotonic) is *free*: always clear, no refresh
  (a constant never moves; a monotonic clock you just read). The cache that never misses.
- **Cheap derived** — compute on read (a simple lens over solid ground).
- **Expensive** — clarity that needs **traversal** (search the state graph, `StateSpace.explore`) + **oscillation**
  (iterative probing/sweeping to *resolve the resolution* — sweep a lens parameter like `PolarityFilter`
  orientation, or settle a `Fixpoint`/PID loop). Costly; **cache the result**.

**Cost-aware refresh = incremental, DBSP-style:** don't recompute the whole world state — re-resolve only what the
**`DeltaPattern`** changes touched (incremental view maintenance). The **content-address index / transposition
table** (`StateSpace`) *is* a clarity cache (a state already resolved is a cache hit). Invalidate by the delta
stream; keep ambient solid ground pinned. Route the cost model to the planner cost owner (Imani) / perf (Naledi).
Anchors: DBSP incremental view maintenance (Budiu et al.); memoization / content-addressed caching; active sensing
/ iterative resolution (the "oscillation").

## Pointers

- The pipeline: `DeltaPattern` · `MemoryLens` · `SolidGround` · `MemorySense` · `LensRouter` · `StateSpace` ·
  `Survival` · `ControlMerge`.
- The objective: `2026-06-08-unsubjective-intrinsic-objective-liveness-empowerment-solid-ground-gain.md`.
- What it reproduces: `2026-06-08-observe-ts-is-the-attractor-transition-map-and-the-reservoir-walls.md`.
