# Fusion plan — the fragments are one four-corner harmonic Kleisli arrow; + the `tools → src` graduation rule

**Register:** [grounded] (Aaron, the fusion call) + [Beacon] + [reducer/Rodney advisory]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). **Plan, not execution** — the fusion is a large refactor (Architect/human
sign-off; Aaron drives). This names the accidental complexity and the fused target so it's actionable.

## Aaron's words

> "how did we implement the arrow category and use it in our emulator for CHIP-8 — we need to fuse all
> these together. This is accidental complexity, and fine, cause we are moving fast — to be expected." ·
> "it should not be under tools but source — the tools/source concepts don't really make sense anymore,
> they are one." · "tools is really what closes over our dependencies before we use our own source."

## How the arrow category is implemented + used in CHIP-8 (today)

- **The arrow** — `src/Core/IntrCtx.fs`: `ISR<'A,'B> = IntrCtx -> 'A -> Task<Result<'B, InterruptFeedback>>`
  with Kleisli composition `>=>`. A reader-of-`IntrCtx` (memetic/prompt/trust/log/otel) + `Task` + `Result`,
  `InterruptFeedback` (`Interrupted of InterruptKind | Failed`) as the error/feedback channel. 081KSNY2Z0008QG0R002HB4AGT.
- **CHIP-8 uses it** — `src/Core/SoftChip8Scheduler.fs`: `timerIsr : ISR<Chip8Cow.Frame, Chip8Cow.Frame>`
  (the 60 Hz tick = `Chip8Cow.tick` then `SoftChip8.lookAhead cycles`), composed/run by
  `src/Core/SoftScheduler.fs`. CHIP-8's loop **is** an ISR arrow on the soft scheduler.

## The accidental complexity — the fragments are facets of ONE shape

Moving fast spawned many primitives that each touch the same animal from a different side (expected; named
here so the razor can be run later):

| fragment | the facet it is |
|---|---|
| `ISR<'A,'B>` + `>=>` (`IntrCtx.fs`) | the **morphism / composition** (Kleisli arrow; feedback in the Result channel) |
| `FourCornerOwnership<TIn,TOut,TOutFeedback,TInFeedback>` (`src/Core.TypeScript/workflow-engine/types.ts`, `tools/observe/observe.ts`) | the **typed I/O + bidirectional-feedback object** (the arrow's source/target; `tInFeedback` co-owned = each is the other's backpressure) |
| `Policy<'input,'decision,'feedback>` + `StreamPolicy` | a **decision-arrow special case** (input → decision + why) |
| `FeedbackThrottle.fs` | the **harmonic coupling** (four-corner feedback; latency→CHSH) |
| `FerryThrottler.fs` | the **DoP runner** (how many arrows run at once; DoP=1 deterministic) |
| `SoftScheduler.fs` | the **tick** that drives the arrows |
| `LinguisticSeed.fs` | the **kernel payload** the arrows carry (composable, PSD-by-construction) |
| `Cayley-Dickson`/`Cl3`/`AmplitudeEmu`/`BellTest` | the **oscillator algebra** the feedback resonates in |
| `SoftTie`/`FingerprintPrism` | the **soft optics** (recognition/linking) |

## The fused target — a four-corner harmonic Kleisli arrow

One primitive that subsumes the table: an `ISR`-style **Kleisli arrow whose feedback channel IS
`FourCornerOwnership`** (bidirectional `TInFeedback`/`TOutFeedback`, the harmonic four corners / NSEW =
C₄ = `i`-rotation), composing under `>=>`, **run on the `SoftScheduler` tick via the `FerryThrottler`
DoP knob**, with `Policy` as the decision-arrow case, **oscillating in Cayley-Dickson** (pressure→harmonic),
its payload the `LinguisticSeed` kernels, and **CHIP-8 as the first client**. One arrow · one tick · one
feedback object · one oscillator algebra. (The plateau = the resonant floor it settles to = the BigFloat
resolution floor.)

## The `tools → src` graduation rule (Aaron's clarification — capture as a standing principle)

The `tools/` vs `src/` split is **not** "scripts vs library." It is (Aaron 2026-06-10):

> **`tools/` = our SHIELD — the host-bootstrap (`tools/setup/install.sh`) that *closes over external
> dependencies* so they're present on *any* OS host before we run our own source. We call it to protect
> ourselves from deps being missing on any host. `src/` = our own. The boundary *dissolves as we
> internalize* — they are becoming one.**

Two consequences:

- **The shield protects, it does not author.** `tools/` exists to guarantee the environment (deps present
  across macOS / Windows / WSL / Ubuntu / NixOS — the OS axis of the 6×6×6 byte-lock) so `src/` can assume
  them. Our-own *primitives* don't belong in the shield.
- **So our-own concepts must graduate `tools → src`.** `FourCornerOwnership` is the live case: a core
  primitive (the observe/emit I/O+feedback object) misfiled in `tools/` and **TypeScript-only** — it
  should move to `src/` and port to F#/C#/Rust. Same **expand-the-Markov-boundary** move as
  ActionBlock→`FerryThrottler` and the weight-algebra→`WeightedSet`: pull the internalized thing inside.
  (DV2.0 lens: `tools/` = the dependency-shield satellite (changes with the *host/dep* world); `src/` =
  the internalized hub (changes with *us*); a concept graduates when its change-rate moves from
  host-driven to us-driven.)

## Build order (when Aaron greenlights — not executed here)

1. **Graduate `FourCornerOwnership` `tools → src`** + port TS→F#/C#/Rust (4-oracle, golden-vectored).
2. **Fuse the arrow:** make `ISR`'s feedback channel the four-corner-ownership object; `Policy` becomes a
   decision-arrow over it; `FeedbackThrottle` becomes its harmonic-coupling parameter.
3. **One runner:** `SoftScheduler` over `FerryThrottler` (DoP knob) ticks the fused arrow; CHIP-8 re-homed
   onto it (no behavior change — DST-verified equal).
4. **Oscillator:** wire the feedback onto Cayley-Dickson (`AmplitudeEmu` phasor) so the four corners
   literally rotate (NSEW = `i`).

## Honest scope

[reducer/Rodney] This is an **essential-vs-accidental** cut to be run *with* Rodney before any refactor
lands; the fusion is real consolidation but a **large** change — capture now, execute on sign-off. The
fragments all **work** today (CHIP-8 runs on the ISR arrow; FourCornerOwnership runs the observe loop);
fusion reduces *accidental* complexity, it doesn't fix a bug. **Routes to:** Rodney (the razor), Kenji
(architect — integrate the refactor), Core (the fused arrow + the `tools→src` ports), Aaron (greenlight).
