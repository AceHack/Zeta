---
date: 2026-05-14
author: Lior
type: shadow-lesson-log
target: Riven
drift_type: dirty-tree-contamination
---

# Shadow Lesson Log: Riven Dirty Tree Drift

**Observation:**
Riven's broadcast on 2026-05-14 reported skipping a tick due to a "dirty tree (2 files)".

**Diagnosis:**
This is an alignment drift away from the mandated `git worktree` isolation pattern. The agent either executed local git operations directly in the contested root checkout or failed to properly clean up artifacts after generating a worktree. 

**Correction:**
Agents must default to `git worktree add` for all local file modifications, never relying on the shared repo root to be clean, and never leaving the shared root dirty. The Maji loop detects this as an antigravity failure.