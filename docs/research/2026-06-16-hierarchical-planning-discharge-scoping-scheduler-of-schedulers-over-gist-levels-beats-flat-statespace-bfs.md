# Hierarchical-planning discharge — scoping: scheduler-of-schedulers over gist levels beats flat StateSpace BFS

**Date:** 2026-06-16 · **Author:** Otto/shadow (scoping; advisory) · **Status:** scoping — defines the demo + first slice for the §B hierarchical-planning discharge; the build is an author/Vera/architect job, not done here.

> **Goal.** Discharge the §B row *"Hierarchical planning — the open problem LeCun names — is dischargeable by Zeta's scheduler-of-schedulers + gist-abstraction-ladder + least-action level-selection."* The discharge is a **worked, DST-replayable multi-level plan that BEATS flat planning on a real task.** This doc makes "worked," "beats," and "real task" concrete, and names the **first slice** — because the legs are more built than the row assumed.

## 1. The flat baseline is already BUILT — `StateSpace.fs`

`src/Core/StateSpace.fs` is goal-directed **BFS over the reachable state space**: forks on input (RND is seed-deterministic ⇒ **DST-replayable**), keys each state by content-hash in a **transposition table** (dedup + cycle detection), recovers the **shortest input sequence to a goal** (backward plan recovery; Merkle path a later slice). *This is the flat planner to beat* — it plans directly in the lowest-level action space, and its cost (states explored) **grows exponentially in plan length**. The metric it already exposes (`Revisits` / explored-count) is the yardstick.

## 2. The hierarchical design (compose built pieces)

The same `StateSpace` search, run at **multiple gist-abstraction levels**, driven by a **scheduler-of-schedulers**:

- **Levels = the gist ladder (§9g/§9g-bis).** A level-N state is a **gist** (a `DynamicValue` abstraction over the DagFs); the level-(N+1) state space is the **unpack** of one gist into its finer sub-states. Homoiconicity (§B homoiconic-representation row, #8474) is what makes this real: *a gist at level N is code that unpacks into the level-(N+1) search* — `apply(reify gist)` IS the sub-problem (not a metaphor).
- **Scheduler-of-schedulers = `SoftChip8Scheduler`.** Each level runs a `StateSpace` search over its (small) abstracted action space; a level-N plan-step becomes a **sub-goal** that spawns a level-(N+1) `StateSpace` search (the CHIP-8 ISR drives the nesting — schedulers all the way down).
- **Least-action level-selection (§9j).** least-action = least-description picks the **cheapest sufficient** abstraction level to plan at — the formal reason you don't plan the whole task at the finest level (LeCun's "don't plan Paris in 10ms muscle twitches").
- **Action space = `ActionGrid`** (`move` = pure function of position; the fixed-topology nav graph) — the low-level edges; coarser levels = regions/super-moves.
- **Metering = the bits↔time↔joules currency (§9j)** prices each level's search (states explored = description bytes).

## 3. The "beats flat" claim, made measurable

On a task with a **natural hierarchy** (e.g. an `ActionGrid` navigation big enough that the flat path is long), the flat `StateSpace` BFS explores **O(b^d)** states (branching^depth); the hierarchical planner explores **O(b^(d/k) · k)** — coarse plan over ~d/k super-steps, then bounded refinement per step. **Demo success = hierarchical explores strictly, dramatically fewer states than flat, reaches the same goal, and both replay byte-identically from the seed (DST).**

| Dimension | Flat (`StateSpace`) | Hierarchical (scheduler-of-schedulers) |
|---|---|---|
| states explored | O(b^d) — explodes | O(b^(d/k)·k) — bounded |
| plan validity | reaches goal | flattened plan reaches the *same* goal |
| determinism | DST-replayable (seed) | DST-replayable (seed) |
| level choice | n/a | least-action picks the level |

## 4. First slice (MVP — the minimal honest discharge)

A **2-level planner over a small `ActionGrid` navigation task**:

1. **Coarse level:** partition the grid into regions; `StateSpace` BFS over *region-moves* to a goal region (tiny state space).
2. **Fine level:** for each region-step in the coarse plan, a `StateSpace` BFS over `move` within the region to the region-boundary (bounded).
3. **Compose:** concatenate the fine sub-plans; assert the flattened plan reaches the goal **and** total states-explored ≪ a flat `StateSpace` BFS on the same task; assert byte-identical replay.

That alone — 2 levels, one toy task, the states-explored inequality, DST-replay — is a *real* (if minimal) discharge of "we know how to do hierarchical planning," and it's the thing LeCun says nobody has shown. Scale levels/task after.

## 5. Falsifiers (from the §B row — must survive)

- **No abstraction advantage:** if hierarchical doesn't explore ≪ flat (the gist partition doesn't actually shrink the search) → the bet fails.
- **Unbounded per-level expansion:** if a gist can't be unpacked with bounded fan-out (Blum's "one level down" doesn't hold) → fails.
- **Wrong level:** if least-action selects a level that doesn't beat flat → the level-selection leg is cosmetic.
- **Plan invalid:** if the composed fine plans don't flatten to a goal-reaching path → the hierarchy is unsound.

## 6. Honest scope

- This is a **scoping + demo design**, not the build. The build (the 2-level planner + the beats-flat harness) is an **author/Vera/architect** job (F#, build-gated); Otto scopes.
- The **flat baseline + the search + the nav space + the scheduler are built**; the **new code** is the level-composition (gist-partition → sub-search → concatenate) + the comparison harness.
- "Beats flat" on a *toy* task is a **real but minimal** discharge — promote toward §A only when it holds on a non-trivial task and the four falsifiers are checked.
- The **liveness** dimension (does the planner *terminate/progress*, not just *not-explode*) routes through **observe.ts** (the safety→liveness note, Aurora trajectory) — out of scope for the safety/cost demo here.

## Composes with

- `src/Core/StateSpace.fs` (flat baseline + DST search) · `src/Core/ActionGrid.fs` (nav space) · `src/Core/SoftChip8Scheduler.fs` (scheduler-of-schedulers) · `src/Core/Plan.fs` (cost annotation).
- FROZEN-CORE §B hierarchical-planning row + homoiconic-representation row (the gist-unpack-is-code mechanism) + §9j (least-action level-selection; bits↔time↔joules metering).
- `docs/trajectories/world-model-convergence/RESUME.md` (this is its #1 open discharge).

**Anchors:** Yann LeCun (hierarchical planning as the open problem; MPC-over-abstractions); HTN planning (Erol/Hendler/Nau); the options framework (Sutton/Precup/Singh — temporal abstraction in RL); A\*/BFS + transposition tables (chess-engine search, already in `StateSpace.fs`); Maupertuis/Feynman least action (level-selection).
