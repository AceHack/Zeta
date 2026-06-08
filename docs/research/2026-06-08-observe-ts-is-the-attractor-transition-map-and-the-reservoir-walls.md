# observe.ts = the attractor-transition map (reachability + step-difficulty) = the reservoir walls

*Captured 2026-06-08 from Aaron (shadow*). What `observe.ts` (the production observe stack) is, and why the
soft-emulator game-learner *is* the same thing on a small machine. Honest registers: [ours] built, [design]
intended, [anchor] prior art.*

## What observe.ts shows **[design/anchor]**

Aaron: *"at the end of the day what we have in `observe.ts` we want for the controller for our game-player learner
— but what `observe.ts` is showing is **transitions between different stable attractors in state space** and the
**ability to move between them**; then we put **planning** on top. `observe.ts` **constrains what's reachable** and
the **difficulty of the step** to reach a desired outcome."*

`observe.ts` is exactly the model the game machinery already builds:

| observe.ts concept | our piece |
|---|---|
| stable attractors | `Survival` safe limit cycles (#7123) — the stable loops you can sit in |
| transitions between attractors | `StateSpace` edges (#7118) — moving between basins |
| ability to move between them | `StateSpace.recoverPlan` / `planTo` (#7120) — the path |
| what's reachable | `exploreGuarded` reachable safe set |
| difficulty of the step | path length / cost in the DAG (steps to reach a target attractor) |
| planning on top | `ControlMerge` / `SoftDrive` over the constrained set |

So the game-learner controller and `observe.ts` are the **same object**: an attractor-transition graph with
reachability + step-difficulty, planning layered on. The emulator is `observe.ts` at toy scale — where we can
*prove* the attractors and the difficulties exactly.

## observe.ts = the walls in reservoir computing **[anchor]**

Aaron: *"observe.ts is also the WALLS in the reservoir-computing analogy."* Reservoir computing (Jaeger's
echo-state networks; Maass's liquid-state machines) drives a rich fixed dynamical system (the *reservoir*) and
reads out its state; the **walls/boundaries** are the constraints that shape which trajectories the reservoir can
occupy — they *define the reachable manifold*. `observe.ts` is those walls: it **constrains the reachable state
space** (exactly "constrains what's reachable" above). The controller plays *within* the walls; the walls
(observe.ts) set the attractor landscape the planner navigates. `MemoryLens`/`MemorySense` discover where the walls
are (controllable vs autonomous cells, ranges/seasons); `exploreGuarded`'s invariant is a wall (the alive boundary).

## The cohered picture

`observe.ts` = the **attractor-transition map** (stable attractors + transitions + reachability + step-difficulty)
= the **reservoir walls** (the constraints shaping the reachable manifold). The soft-emulator learner reproduces it
(`Survival` attractors + `StateSpace` transitions + `planTo` movement + `ControlMerge` planning) on a machine small
enough to *prove* the map — then the proven small map is the rehearsal for driving `observe.ts` on the real system.
This closes the loop with the testbed framing (#7116) and the games≡zero-downtime-shipping unification (#7119):
the same attractor-navigation, derisked small.

## Pointers

- `Survival.fs` · `StateSpace.fs` · `ControlMerge.fs` · `MemoryLens.fs`/`MemorySense.fs` (the map's machinery)
- `2026-06-08-emulator-as-whole-stack-testbed-...` · `2026-06-08-playing-games-equals-zero-downtime-shipping-...`
- **[anchor]** reservoir computing: Jaeger (echo-state networks), Maass (liquid-state machines); attractors /
  basins of attraction (dynamical systems); `docs/PRIOR-ART-LIST.md` (RL envs: Gym/Gymnasium, Gym Retro, OpenSpiel).
