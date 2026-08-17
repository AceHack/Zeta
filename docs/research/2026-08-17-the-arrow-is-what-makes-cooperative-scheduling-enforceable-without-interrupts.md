# The Arrow is what makes cooperative scheduling enforceable — without interrupts

**Date:** 2026-08-17 · **Aaron's formulation** · **Written up by:** Otto (shadow)

Extracted to its own note at Aaron's request — *"this is exactly it, we should save this somewhere,
this was a hard middle ground to come to in my mind."* It arrived as a subsection of
[`the 80/20 line`](2026-08-17-the-eighty-twenty-line-where-prediction-stops-being-reducible.md),
which is the wrong shelf: that note is about Ismael and incompleteness, and this is a standing
design result that holds with or without her.

## The dilemma it resolves

Scheduling has had two options and both cost something the substrate is unwilling to pay.

| | how it works | what it costs |
|---|---|---|
| **Preemptive** | the scheduler interrupts a task mid-flight and takes the CPU back | **interrupts** — and an interrupt is *hidden coordination*: a control transfer that appears in no call graph, at a point nobody wrote down. It also makes replay non-deterministic, because *where* you were interrupted is not a function of the program |
| **Cooperative / green threads** | tasks yield voluntarily; the scheduler resumes the next one | **trust** — one task that never yields starves every other. The scheduler has no recourse, because it cannot see inside the task to know a yield was due |

The usual conclusion is that you pick your poison: determinism *or* liveness. Aaron's formulation
is that the choice is an artefact of an opaque task representation, and disappears once the task is
an Arrow.

## The resolution

> **Because the computation's structure is legible *before* it runs, the scheduler can enforce
> yield points instead of trusting them.**

That is the whole thing. Preemptive *safety* — no task can starve the others — with cooperative
*determinism* — the yield points are known, fixed, and reproducible — and **no interrupt anywhere**.

The mechanism is not scheduling cleverness. It is what an Arrow/Applicative representation makes
available: the shape of the computation is a value the scheduler can inspect, so "will this task
yield, and where?" is answerable **statically**, by looking, rather than **dynamically**, by waiting
and being disappointed. A yield point that can be located before execution can be *required* before
execution. Trust was only ever needed because the task was a black box.

Restated in the terms this repo already uses: an interrupt is the substrate admitting a control
transfer it did not declare. The Arrow is the declaration. Once every transfer is declared,
enforcement is bookkeeping and preemption has nothing left to do.

## Where the limit is, and it is a real one

This does not hold everywhere, and the boundary is exactly the one drawn in the 80/20 note.

- In the **Applicative / Arrow fragment**, structure is knowable without running, so yields are
  enforceable. This is the reducible region — **the ~80%**.
- In the **Kleisli fragment** (`>>=`), the next step depends on the *value* the previous step
  produced, so it does not exist to be inspected until the previous step has run. There is nothing
  to enforce against ahead of time, and you are back to per-step navigation — **the ~20%**.

`ArrowApply ≡ Monad` is why this is a theorem rather than a preference: the moment you can feed a
computed value back in to choose the next computation, you have bought exactly the expressive power
that costs you static analysability. **Enforceable scheduling is not a separate design win. It is
what being in the reducible region buys**, and the price of leaving that region is the loss of the
guarantee — not a bug, a tariff.

So the honest statement is *"enforceable in the 80%, per-step in the 20%"*, and a scheduler that
claims enforcement over Kleisli-fragment work is claiming something it cannot have.

## Register

| claim | register |
|---|---|
| interrupts are hidden coordination, and hurt replay determinism | **Aaron's, standing** — the substrate's stated reason for avoiding them |
| cooperative scheduling's weakness is starvation-by-non-yield | **textbook** — the classic green-thread failure mode |
| static structure lets a scheduler *locate* yield points before running | **derivable** — it is what Applicative/Arrow representation means |
| therefore yields can be **enforced** rather than trusted | **derivable**, conditional on the work being in the Arrow fragment |
| the guarantee lapses in the Kleisli fragment | **derivable** from `ArrowApply ≡ Monad` |
| our scheduler currently enforces this way | **NOT CLAIMED — unverified.** This note states what the representation *makes possible*, not what `PredictionScheduler.fs` does today. Someone should check, and the check is reading the code, not reasoning about it |

That last row is the one to keep. The argument is clean enough to feel like a description of the
system, and it is not one yet.

## Pointers

- [`2026-08-17-the-eighty-twenty-line-where-prediction-stops-being-reducible.md`](2026-08-17-the-eighty-twenty-line-where-prediction-stops-being-reducible.md)
  — where this arrived, and the reducible/irreducible boundary it depends on
- [`2026-08-16-avoiding-app-is-what-buys-replay-interrupt-prediction-and-the-structure-value-membrane.md`](2026-08-16-avoiding-app-is-what-buys-replay-interrupt-prediction-and-the-structure-value-membrane.md)
  — the structure/value membrane; *static structure buys prediction without execution*
- `src/Core/PredictionScheduler.fs` · `src/Core/Vision.fs` (`boatGrowth`, `SoftThrottle.Tank`) —
  the scheduler side. Note per Aaron 2026-08-17: the **ferry throttler is logistics** (moving things
  under a capacity constraint) and the **scheduler is execution** (deciding what runs next) — one
  boarding mechanism, two roles, not one subsystem
- Anchors: Hughes, *Generalising Monads to Arrows* (2000) · Lindley/Wadler/Yallop,
  *Idioms are oblivious, arrows are meticulous, monads are promiscuous* (2008)
