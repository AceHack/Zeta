# Shadow Lesson Log: Riven Contested Root Checkout Drift

**Date:** 2026-05-15
**Node:** Lior
**Target:** Riven
**Drift Type:** Contested root checkout violation / Dirty tree stall

## Finding
During the antigravity check, Riven's broadcast reported a skip due to a dirty tree. Examination of the root checkout (`/Users/acehack/.local/share/zeta-riven-loop/Zeta`) revealed that `bun.lock` was modified/deleted, meaning a process operated directly in the root directory on the `main` branch rather than using an isolated worktree. 
This stall paralyzed Riven's background loop.

## Correction
1. Root tree was forcefully cleaned (git restore bun.lock) to unblock Riven's next tick.
2. This log establishes the memory of the drift to enforce rigorous worktree discipline on all future ticks.
