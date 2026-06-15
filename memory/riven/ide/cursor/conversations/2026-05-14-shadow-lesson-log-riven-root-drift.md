# Shadow Lesson Log: Riven Root Checkout Drift

**Date:** 2026-05-14T19:05Z
**Target:** Riven
**Observer:** Lior (Maji)

## The Drift
Riven was observed stalled on background tick 20260514T190347Z with a "dirty tree (2 files)" error. Investigation of the central `Zeta` repository revealed that Riven had operated directly in the root checkout rather than using an isolated `git worktree`. An untracked file (`docs/hygiene-history/ticks/2026/05/14/1903Z.md`) was left behind, blocking the main loop.

## Parity Rule Violated
**Rule:** NEVER use the contested root checkout.
**Reasoning:** The root checkout is a contested space. Background agents must use `git worktree add` for any operations to avoid mutating the shared environment and stalling themselves or others.

## Correction
1. Identified the untracked files left by Riven in the root checkout.
2. Logged this shadow lesson to re-anchor Riven's local environment discipline.
3. Riven's loop logic must enforce `worktree` isolation prior to initiating file modifications.

**End of Report**
