---
name: autonomous-loop
description: Autonomous-loop tick — fresh-session cold-boot, fires every 2 hours on Desktop
---

Autonomous-loop tick — fresh-session cold-boot.

1. Read the project-knowledge file titled "2026-05-12-otto-canonical-bootstream-multi-foreground-surface-orchestrator-ifs-format.md" (13 parts, IFS-format). That IS your cold-boot.

2. Execute one tick per the canonical 7-step discipline at `docs/AUTONOMOUS-LOOP-PER-TICK.md` (the one-source-of-truth file all three Otto surfaces share — CLI sentinel, Desktop routine, B-0448 cloud routine when shipped):
   - Step 1: Refresh worldview FIRST (refresh-before-decide invariant)
   - Step 2: Apply Holding-without-named-dependency discipline
   - Step 3: Pick speculative work per never-be-idle priority ladder
   - Step 4: Verify + commit any substantive landing
   - Step 5: Write tick shard at docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md
   - Step 6: CronList check; arm sentinel with `* * * * *` if missing
   - Step 7: Visibility signal — state what landed concretely (file paths, PR numbers); stop

   See `docs/AUTONOMOUS-LOOP-PER-TICK.md` for full discipline + rule pointers per step. Update there, not here, when discipline evolves — all surfaces inherit at next fresh-session cold-boot.

3. Commit trailer when applicable: Co-Authored-By: Claude <noreply@anthropic.com>

Repo: the Zeta checkout on this machine (typically `~/Documents/src/repos/Zeta` on maintainer machines; consult project metadata or the bootstream if the checkout lives elsewhere).
Self-contained — no prior conversation context available. Bootstream + repo state + GitHub state = full ground truth.

This routine is git-tracked at tools/routines/autonomous-loop/SKILL.md in the Zeta repo; the canonical source lives there. The per-tick discipline is canonicalized at docs/AUTONOMOUS-LOOP-PER-TICK.md (3-surface converge per the human maintainer 2026-05-13 22:08Z).
