# Playing games ≡ zero-downtime shipping: both are constrained state-space path-finding

*Captured 2026-06-08 from Aaron (shadow*). The unification that says the CHIP-8/emulator arc is a derisking
rehearsal for the actual product goal.*

## The claim

> "We can imagine playing games and shipping features with 0 downtime are similar things, and we are optimizing
> for the simpler one first before we optimize the forever game of DORA metrics."

**Both are the same problem: find a path through a state space that reaches a goal while every step satisfies an
invariant.**

| | Game (CHIP-8) | Zero-downtime shipping |
|---|---|---|
| state space | reachable emulator frames | system configs (versions, schema, routing, data) |
| step / edge | a button input (frame) | a deploy action (migrate, flip traffic, scale) |
| goal | a high-value terminal state (win/score) | the new version fully live |
| **invariant** | **never enter a "dead" state** (don't die) | **never enter a "down" state** (always serving) |
| solver | `StateSpace.explore` + `recoverPlan` | the *same* search, on the real system |

## The shared machinery (already built, on the small instance)

- **`StateSpace.explore`** — reachable-state search; the **content-hash index** (transposition table) bounds it
  and detects cycles (don't revisit a bad config; catch a deploy loop).
- **invariant-checking** — prune any edge into a dead/down state (don't-die ≡ no-downtime).
- **`StateSpace.recoverPlan`** — backward-recover the safe *sequence* (the winning inputs ≡ the safe deploy steps).
- **omniscience while small** — prove the optimum (game) before betting prod on the search (deploy).

Hand-crafted versions of the deploy path already exist as named patterns — **blue-green**, **canary / progressive
delivery**, **expand-contract (parallel-change) migrations**. Each is a human-found downtime-free path; automating
them = searching the state space for one. The game teaches the search.

## Why "simpler first" is the right order (honest)

- **Game = bounded + provable + consequence-free.** Finite state space → omniscient ground truth → prove the
  optimum, debug the search, measure learning against proof. The tractable rehearsal.
- **Zero-downtime shipping = the forever game.** Unbounded state, real consequences, *continuous* — never "won."
  **DORA** (deployment frequency · lead time for changes · change-failure rate · time-to-restore — Forsgren,
  Humble, Kim, *Accelerate*) is the perpetual scoreboard, not a finish line. You don't *solve* it; you keep
  optimizing it.

So CHIP-8 (then Atari) derisks the path-search algorithm on a one-hand machine; the *same* algorithm, scaled to
the unbounded real system, is zero-downtime delivery. The emulator arc is the product goal in miniature.

## Pointers

- `StateSpace.fs` (#7118) — the indexed search + cycle detection + `recoverPlan`.
- `2026-06-08-emulator-as-whole-stack-testbed-and-backward-plan-recovery.md` — the test-bed framing + planner.
- `2026-06-08-chip8-octo-toolchain-via-ace-declarative-install.md` — the host→compiler→OS dependency-closure
  vector (the deploy/OS substrate this search eventually drives).
