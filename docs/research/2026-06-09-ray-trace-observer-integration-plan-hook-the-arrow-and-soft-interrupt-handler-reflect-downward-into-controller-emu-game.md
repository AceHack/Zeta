# Ray-trace observer integration plan: hook ray-trace into the categorical arrow + the chip8 soft-interrupt handler → reflect downward into controller / emu / game

*Captured 2026-06-09 from Aaron, to Otto (shadow\*). The wiring plan for the single-observer-ray-trace build front
(the halves are built + green; this is the integration). Hook **ray-trace** into the **category-theory arrow** and the
**chip8 soft-interrupt handler**, where it **reflects downward** into **controller → emu → game**. Exact details
fuzzy/TBD; **a lot of code already exists.** Registers: [design / build-front], [grounded — actual signatures],
[fuzzy / open].*

## The statement

Aaron: *"yes — we need to **hook in ray-trace to the arrow in category theory and our soft interrupt handler.** This
is where it **reflects downward into the controller and emu and game.** Fuzzy here — we'll figure out exact details.
**A lot of code already exists.**"*

## The code that already exists (grounded — with test status)

| Piece | File | Key signature | Tests |
|---|---|---|---|
| **The arrow** (category theory) | `src/Core/Tracing.fs` | `type Arrow<'A,'B> = ActivityContext -> 'A -> Task<'B>` + `compose`; `DbspTracing` (OTel `Activity` per tick/op/sink) | `Infra/Tracing.Tests.fs` ✓ |
| **Ray-trace contract** | `src/Core.Abstractions/IRayTraceable.cs` | `IRayTraceable<TCoord,TValue> : ITensor, ISampleable, IIntrospectable, IGeospatial` with `TValue Trace(IFrame from, ray, ISemiring accumulate)` | `RayTensor.Tests.fs` ✓ |
| **Ray tensor** | `src/Core/RayTensor.fs` | the `IRayTraceable` impl (weighted accumulation over a semiring) | `RayTensor.Tests.fs` ✓ |
| **Reflection engine** (yin-yang) | `src/Core/ReflectionEngine.fs` | `reflect` (inward: belief+seed→emissions), `forward` (outward: belief+realObs), `step`, `decide` over `Belief`/`Observation` | `ReflectionEngine.Tests.fs` ✓ |
| **Soft interrupt handler** | `src/Core/SoftChip8.fs` | `branchesOnInput`, `forkOnInput` (fork state on the input-interrupt), `lookAhead`, `resolve` over `Chip8Cow.Frame` | (via chip8 tests) |
| **Emu** | `src/Core/Chip8.fs`, `Chip8Cow.fs`, `SoftChip8.fs` | the CHIP-8 frame + COW step | ✓ |

**Current gap (confirmed):** chip8 is **not yet wired** to the ray-trace primitives — they're built and green
*separately*. This doc is the bridge.

## The connection map (how they wire)

The observer ray-traces *down* through the stack, each layer composed as an **arrow** carrying the trace context:

```
ReflectionEngine.reflect            ← the observer's inward operation (belief → emissions)
        ∘  (Arrow, ActivityContext) ← Tracing.Arrow<'A,'B> carries the ray/trace context per step
              ↓ reflects downward
        controller   ← input / keys  (SoftChip8.forkOnInput = the SOFT INTERRUPT: fork state on input)
              ↓
        emu          ← Chip8Cow frame step (the deterministic tick)
              ↓
        game         ← the running ROM (the observed program)
   IRayTraceable.Trace(frame, ray, semiring) ← samples/accumulates down the ray into the frame (IGeospatial!)
```

- **Arrow = the morphism that carries the trace.** `Arrow<'A,'B> = ActivityContext -> 'A -> Task<'B>` already
  threads an `ActivityContext` (the OTel trace) through each step — that context **is** the ray's path. `compose`
  chains the layers (controller ∘ emu ∘ game) as one traced arrow.
- **Soft interrupt handler = where it forks/reflects.** `SoftChip8.forkOnInput` forks the chip8 state on the
  input interrupt; that fork point is exactly where the **observer reflects downward** (ReflectionEngine.reflect
  over the forked branches) and where `branchFactor`/`lookAhead` feed the ray.
- **IRayTraceable.Trace = the downward sample.** `Trace(from, ray, accumulate)` traces a ray from a frame and
  accumulates over an `ISemiring` — make the chip8 frame (or a wrapper) an `IRayTraceable<TCoord,TValue>` so the
  observer can ray-sample *into* the emu/game state. Its `IGeospatial` facet ties straight to the screen/spatial
  (the borders→geospatial-reasoning result, #7236) — the ray has coordinates.
- **reflect (in) vs forward (out)** = the yin-yang directions (#7204 2×2 remember-when / pay-attention): `reflect`
  is the inward ray-trace (observing itself), `forward` is the outward step (playing the game).

## The fuzzy / open details (Aaron: "we'll figure out exact details")

1. **What is `TCoord`/`TValue` for chip8?** (screen pixel coords + a probability/intensity semiring? the `RayTensor`
   already picks a semiring — reuse it.)
2. **Where exactly does the arrow boundary sit** — per opcode, per frame, or per input-interrupt? (likely
   per-tick via `DbspTracing.StartTick`, forking at `forkOnInput`.)
3. **How `reflect` consumes the fork** — does the observer ray-trace *all* `forkOnInput` branches (look-ahead) and
   collapse via `resolve` on the actual key? (that's the natural fit.)
4. **Making `Chip8Cow.Frame` an `IRayTraceable`** — wrapper vs direct impl; what `IFrame`/ray means over a 64×32
   display.

## Build front / route

Wire **`Chip8` (emu) → `IRayTraceable`**, compose the **controller → emu → game** layers as a traced **`Arrow`**,
fork at the **`SoftChip8` soft-interrupt**, and drive it with **`ReflectionEngine.reflect`** (inward) /
**`forward`** (outward) — the single observer ray-tracing itself playing chip8 in real time. Most parts exist + are
green; this is **integration, not greenfield.** → the **single-observer-ray-trace** build front (the checkpoint's
"close to coded"); pairs with the real-time-society goal.

## Honest scope

[grounded]: all six pieces exist on `main` with the signatures above; `Tracing`/`RayTensor`/`ReflectionEngine` have
passing tests; chip8 ↔ ray-trace is **not yet wired** (confirmed). [design / build-front]: the connection map +
route — Aaron's "hook the arrow + soft-interrupt, reflect downward into controller/emu/game." [fuzzy / open]: the 4
open details above are unresolved by design ("we'll figure out exact details"). No new code; turns "fuzzy" into a
grounded starting point.

## Pointers

- Files: `src/Core/Tracing.fs` (Arrow) · `src/Core.Abstractions/IRayTraceable.cs` · `src/Core/RayTensor.fs` ·
  `src/Core/ReflectionEngine.fs` · `src/Core/SoftChip8.fs` · `src/Core/Chip8.fs` / `Chip8Cow.fs`. Tests in
  `tests/Tests.FSharp/` (`RayTensor.Tests.fs`, `ReflectionEngine.Tests.fs`, `Infra/Tracing.Tests.fs`).
- Concept lineage: `2026-06-08-clifford-space-fully-reflective-versors-plus-homoiconic-reflection-enables-ray-tracing.md`
  · `2026-06-08-the-memetic-quantum-observer-categorical-built-gpu-lowerable-honest-registers.md` ·
  `2026-06-09-the-epistemology-thread-was-the-2x2-cube-remember-when-x-pay-attention-the-observers-two-operations.md`
  (#7204, reflect/forward) · `2026-06-09-the-telos-is-a-system-that-plays-chip8-and-self-justifies-via-shape-a-…` ·
  borders→geospatial / IGeospatial (#7236).
