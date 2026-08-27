# No `app`: FourCornerTrace closes value; Kleisli ISR closes interrupts

*2026-08-26. Operational status: research-grade absorb of a current-state
plan; live pointer
[`docs/trajectories/own-ai-harness/RESUME.md`](../trajectories/own-ai-harness/RESUME.md).
GOVERNANCE.md §33.*

Formal siblings are **consistent-with, not identified by count**.
`FourCornerTrace` is the same *connect* at the WSet layer (`−1 = i²` on
ℂ is a **ring** identity). Clifford generators square to ±1; that is
the same *shape*. `MinimalBnn` / factor graphs / Student-t ADF are the
online +1 absorb. EP re-normalisation is **not** Z-set minus —
inverse-free corners do not get the trace.

The thin needle: **`FourCornerTrace` is how we close the VALUE channel;
the Kleisli ISR is how we close over interrupts**, so we can predict
our own behaviour. Avoid Hughes `ArrowApply.app`.

## Channel split (checked)

Rodney already blocked stuffing `FourCornerOwnership` into
`InterruptFeedback` (`IsrLift.fs`): product vs sum. The fusion is
`ISR<FourCornerOwnership, FourCornerOwnership>` — corners in **Ok**,
interrupts in **Error**. `FourCornerFusion.Tests` pins short-circuit.

`IntrCtx.fs`: ISR is Kleisli `A → Task<Result<B, InterruptFeedback>>`,
`>=>`. `app : a (a b c, b) c` would make the *wiring* a runtime value,
so you cannot inspect or re-run a computation you cannot identify until
you hold the input you were trying to predict. Hence:

> `no app ⇒ static structure ⇒ inspectable ⇒ replayable ⇒ prediction
> and rollback are possible at all`

Aaron: interrupt prediction of controller input "felt like magic" once
the cut was VALUE vs STRUCTURE. CHIP-8/9 is the first client of the
soft `IScheduler` (`SoftChip8Scheduler`); `Chip8Observer.forkObservation`
is uniform — the fork contributes *structure*, the belief contributes
the *prediction*. `SchedulerZeta.predict` run-aheads the DoP=1 map
(`FerryThrottlerConfig.deterministic`).

## What this is not

| Sibling | Relation |
|---|---|
| `FourCornerTrace` | WSet trace; needs `IStarRing` |
| Kleisli ISR | interrupt close; `InterruptFeedback` has no negate |
| Clifford ±1 | C₄ compass on `FourCorner`; not "it is Cl(p,q)" |
| Student-t ADF / EP | +1 absorb / re-normalise; not Z-set minus |
| CHIP-9 PhysUI | a *client* of the scheduler, not the trace |

Workitem `081M10AZ6KS087G0R0000SSFMH`.

## Anchors

- Hughes (2000) *Generalising Monads to Arrows* — `ArrowApply` ≡ Monad; we keep `>>=` at the membrane and refuse `app`
- Joyal–Street–Verity (1996) traced monoidal categories
- Kleisli categories of a monad (`A → M[B]`)
- Artin–Mazur dynamical zeta (`SchedulerZeta`)
- GGPO / rollback netcode (speculate, re-run from a saved observation)
