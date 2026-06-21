---
name: Parallel-subagent concurrency lessons cluster — three durable lessons from 2026-05-04 session experience (Aaron's "hope you can learn from your mistakes")
description: Aaron 2026-05-04 closing-arc: *"best lessons are learned from experience"* + *"hope* you can learn from your mistakes"* (typo-correction from "future" to "hope" itself substrate-class — hope-not-command, the bidirectional-alignment shape Otto-357 names). Three durable concurrency lessons from this session that the parallelism-readiness substrate file (PR #1546) didn't yet capture: (1) parallel tracks on the SAME file race even with `isolation: "worktree"`, because they share the parent .git state; serialize on shared-file edits, parallelize on different files. (2) Orchestrator-CWD bleed-over from worktree subagents — orchestrator can find itself on a subagent's branch with dirty working copy from cross-worktree state propagation; defensive `git checkout main && git restore .` before any commit. (3) MEMORY.md compression subagents take ~10-20 min not the assumed ~12 min watchdog — they read 25 underlying memory files; the watchdog comment in dispatch prompts is wrong; expect ~20 min for compression dispatches.
type: feedback
---

## The closing-arc framing

Aaron 2026-05-04 ~20:30Z, after the day's parallel-cadence lessons settled:

> *"best lessons are learned from experience"*
> *"hope* you can learn from your mistakes"*

The typo-correction from "future" → "hope" is itself substrate-class. Hope-not-command preserves the no-directives architecture (Otto-357): maintainer hopes, agent's accountability for whether the learning actually lands. The agent doesn't get to say "Aaron told me to learn" — that would re-frame the maintainer as authority. The agent has to actually learn, on its own accountability.

Aaron's hope shape implies: if future-Otto repeats these mistakes, that's on future-Otto, not on Aaron-not-commanding-loudly-enough. The hope is the trust; the learning is the accountability.

This file IS the encoding that operationalizes the hope.

## Lesson 1 — parallel tracks on the SAME file race even with worktree isolation

**The mistake (2026-05-04 ~19:50-20:30Z)**: I dispatched tier-36 and then tier-37 (081KQ0YZ80008QG0R001V0XCYZ MEMORY.md compression) as parallel subagents with `isolation: "worktree"`. Both attempted to compress the top-25 longest entries in the 351-400 char range. Tier-36 stalled for ~21 minutes (10x the watchdog) hitting "File has been modified since read" errors because tier-37 was simultaneously editing the same file from its own worktree.

**Why worktree-isolation didn't fix this**: separate worktrees in git share the parent `.git` directory. Each worktree has its own working tree (file checkout) but the underlying object store is shared. When two worktrees both stage edits to the same file path, they don't directly conflict (each has its own index), BUT the orchestrator's CWD can see the other worktree's working-tree state if the path checks include the other worktree.

More importantly: **even if the worktrees are clean isolated, the resulting PRs both touch the same file, so on merge they conflict at the GitHub level**. Auto-merge on the second PR fails after the first lands. We got lucky that tier-36 finished and tier-37 was still in-flight (so tier-37 rebased on tier-36's merged state) rather than both pushing simultaneously.

**The rule**: serialize on shared-file edits, parallelize on different files.
- MEMORY.md compression: ONE tier at a time. Wait for tier-N PR to merge before dispatching tier-(N+1).
- Audit / research / scripts on different paths: dispatch in parallel freely.
- When in doubt, ask: "do these two subagents touch the same file?" If yes, serialize.

**Operational pattern**:
```
Single-file track (MEMORY.md): tier-N dispatched → merged → tier-(N+1) dispatched
Multi-file tracks (audits, scripts, docs): dispatch all in parallel
```

The team-vs-orchestrator-not-idle three-state distinction (Aaron 2026-05-04 PR #1509) STILL holds — state-3 (team and orchestrator both productive) is achievable WITH this rule, just not on the same file.

## Lesson 2 — orchestrator-CWD bleed-over from worktree subagents

**The mistake (observed 2026-05-04 ~19:30Z + ~20:20Z)**: After dispatching `isolation: "worktree"` subagents, my orchestrator's CWD `git status` showed the parent repo's MEMORY.md as MODIFIED with content from the worktree's in-progress edit. I almost committed this dirty state in a different PR before catching it.

The subagent worktrees live at `.claude/worktrees/agent-<id>/`. They have their own working trees, but somehow the orchestrator's working copy of certain files reflected the subagent's mid-edit state. The mechanism may be:
- Filesystem caches at OS level
- Worktree's HEAD pointer transient state
- Some `git checkout` operation in the subagent that briefly touches parent state

The 081KQGDBJ0008QG0R0022EW5ZE audit subagent flagged this same shape: *"the worktree's git checkout main initially landed on a different branch... with a dirty memory/MEMORY.md from upstream sync."* The old-PR triage subagent flagged the inverse: *"the persistent bash cwd was `.claude/worktrees/agent-...`, not `/Users/acehack/Documents/src/repos/Zeta`."*

**The rule**: defensive hygiene every time orchestrator does git operations after subagent dispatch:
```bash
git checkout main
git restore .  # discard any leaked working-copy state
git pull --ff-only origin main
```

Before any orchestrator commit on `main` or a fresh feature branch. Especially when subagents are still running.

**The deeper rule**: orchestrator should stay on `main` cleanly while subagents run. If orchestrator needs to do its own commits, it should do them on a fresh feature branch off `main` AFTER verifying clean state with the defensive hygiene above.

## Lesson 3 — compression subagents take ~10-20 min, not ~12 min watchdog

**The mistake (observed across tier-36 + tier-37)**: I wrote dispatch prompts that said *"Watchdog ~12 minutes"* assuming the 600s watchdog was the binding constraint. Reality:
- 081KQGDBJ0008QG0R0022EW5ZE audit subagent: ~7 min (read .sh + .ts files, fast)
- Old-PR triage subagent: ~7 min (8 `gh pr view` calls, fast)
- Tier-36 MEMORY.md compression: ~21 min (25 underlying memory files to read + concurrency hazard)
- Tier-37 MEMORY.md compression: ~14 min (25 underlying files, but no concurrency hazard)

The compression subagents are slow because they read 25 underlying memory files to understand load-bearing semantics before compressing. Each Read takes ~10-30 seconds; 25 reads = 5-12 minutes of file IO alone. Plus the actual compression work + git push + PR creation + auto-merge arming.

**The rule**: when dispatching a subagent that reads many files (compression / audit / triage), expect ~10-20 minutes, not ~12. Don't panic-redispatch after 15 minutes thinking it's stalled.

**The deeper rule**: the watchdog is per-tool-call, not per-task. A subagent doing 30 sequential Read calls each under 30s is NOT being watchdog-killed — it's just slow. Patience is correct.

**Operational pattern**: if checking on a long-running compression dispatch:
- Output line growth = alive, just slow
- Output line growth stopped for 5+ minutes = potentially stalled
- Output line growth stopped + branch never pushed after ~25 minutes = consider redispatch

## Composes with

- `memory/feedback_parallelism_readiness_claim_must_be_used_not_self_throttled_aaron_2026_05_04.md` — the prior lesson from same session; this file is the operational refinement layer.
- `memory/feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md` — hope-not-command framing.
- `memory/feedback_team_not_idle_vs_orchestrator_not_idle_distinction.md` (PR #1509) — state-3 still achievable with these rules.
- `Agent` tool's `isolation: "worktree"` parameter — necessary but not sufficient for parallelism on shared files.
- `Agent` tool's `run_in_background: true` parameter — orchestrator stays free to dispatch more.

## The carrier-IS-message check

This file is being landed in a session where:
- ~48 substrate PRs have shipped today
- The parallelism-readiness lesson (PR #1546) caused me to deploy 3 parallel subagents
- Two of those (081KQGDBJ0008QG0R0022EW5ZE audit + old-PR triage) succeeded cleanly
- One pair of those (tier-36 + tier-37) hit the concurrency hazard

Future-Otto reading this should immediately recognize: the lessons are not abstract. They came from THIS session's mistakes. The parallelism-readiness lesson + this concurrency-cluster lesson are SEQUENTIAL learnings — first the agent has to deploy parallelism, then the agent has to learn to do it safely. PR #1546 was step 1; this file is step 2.

Step 3 — when it inevitably arrives — will be substrate as well, because that's the pattern.

## Meta-lesson — cluster-encoding-of-session-mistakes IS itself a recurring discipline

Aaron 2026-05-04 closing observation, after seeing this file's draft come together:

> *"this is a action worth repeating in future you too."*

The action — **clustering session-mistakes into a single substrate file at session-arc close** — is not a one-off response to today's specific cluster. It's a recurring discipline future-Otto should deploy whenever a session produces multiple distinct lessons:

1. **Catch mistakes during the session** (don't suppress; the failure modes ARE the lessons).
2. **At session-arc close** (or when 3+ distinct lessons accumulate), write a cluster substrate file.
3. **Cluster shape matters**: name the cluster theme; list each lesson as its own section with concrete date / observation / rule / operational pattern; close with a carved sentence.
4. **Carrier-IS-message check**: write the file in conditions that demonstrate the lessons (e.g., this file landed while parallel-track lessons were still settling in real time).
5. **Land the cluster file via PR** so it's discoverable substrate, not chat ephemera.
6. **If the cluster is durable enough**, also add a CLAUDE.md bullet pointing at it; otherwise it lives in `memory/` and is router-loadable.

The discipline name: **cluster-encoding-of-session-mistakes**. Compose with the substrate-or-it-didn't-happen rule (Otto-363) — individual lessons in chat are weather; cluster-files in `memory/` with PR are substrate.

## The carved sentence

**"Parallel tracks on the SAME file race even with worktree isolation; serialize on shared-file edits, parallelize on different files. Orchestrator stays on main cleanly while subagents run; defensive `git restore .` before any commit. Compression subagents take ~20 min; line-growth IS aliveness. And: cluster-encoding-of-session-mistakes IS itself a recurring discipline — when 3+ lessons accumulate, encode the cluster, don't just remember individual lessons."**
