---
name: Parallel worktree safety — cartographer before factory-default
description: Aaron 2026-04-22 — worktree-based parallelism becomes the factory default only after the safety map is drawn; eight hazard classes enumerated with paired preventive+compensating mitigations; map-before-walk.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22 across nine messages in one tick, collapsing to:

1. *"we want to use it always for this software factory now, we
   want to promote best practices and parallelism"* (directive)
2. *"yall are going to conflict with each other too problably i
   bet you edited a bunch of the same files. Wow it's gonna be
   hard to get you to parallelize wihout live locks."* (hazard
   naming)
3. *"it might be better just to wait on the build and do resarch
   on how to parallel safely with all that taken into account
   plus the unknow unknowns lol cartographer"* (redirect to map
   before walk)

**The reframe:** the directive to adopt parallel worktrees is
*real* — this is where the factory is going — but the safety
map must be drawn first. Walking into the territory blind and
discovering the live-locks by bleeding is not the cartographer
move.

**The eight hazard classes** (fully enumerated in
`docs/research/parallel-worktree-safety-2026-04-22.md`):

1. Live-lock between parallel worktrees editing the same files
2. Merge conflicts as the expected cost of parallelism
3. Build-speed ceiling — parallelism is rate-limited by CI
4. Stale-branch accumulation (Aaron's preventive+compensating
   ask: GitHub auto-delete + cadenced audit)
5. Memory bifurcation if a fresh `claude` session starts from
   inside a worktree directory (verified empirically this tick
   — single session that `EnterWorktree`s stays on the original
   slug; fresh session from worktree path would mint a new slug)
6. Tick-clock CWD inheritance when `<<autonomous-loop>>` fires
   mid-worktree
7. Split state files (tick-history, MEMORY.md) diverging
   between worktree copy and main copy
8. Unknown unknowns — marked as dragons on the map, not yet
   explored

**Each hazard ships with a preventive AND compensating
mitigation** per the discovered-class-outlives-fix principle.
The detector stays armed even after the preventive lands —
because preventives can decay (GitHub setting can be toggled
off, rule can be forgotten, environment can change).

**Staging (proposed, Aaron's sign-off required):**

- Round 45: auto-delete-branch GitHub setting + cadenced stale-
  branch audit hygiene row
- Round 46: scope-overlap registry design
- Round 47: always-start-from-main-root rule + startup check
- Round 48: tick-history + split-state-file hygiene
- Round 49: earliest `EnterWorktree`-default flip, conditional

**The rule (for future wakes):**

- Do not flip `EnterWorktree` to factory-default before the
  scope-overlap registry and CWD-safety rules land.
- Individual, deliberate, scope-declared worktree use is fine
  this round and always.
- When proposing a parallelism pattern, always ask "what is
  the paired detector for regressions in this pattern?" and
  draft both before shipping either.
- Cartographer marks edges as dragons (*Hic sunt dracones*)
  rather than pretending the map is complete.

**Why this matters (Aaron's "why"):**

Premature parallelism that produces live-locks or memory
bifurcation would damage the factory's self-direction — the
very property worktrees are meant to enhance. The cartographer
metaphor (`memory/feedback_kanban_factory_metaphor_blade_crystallize_materia_pipeline.md`)
is not decorative; it encodes the discipline that Aaron wants
the factory to operate with at every scale.

**How to apply:**

- Before any future tick proposes a parallel-worktree pattern
  (e.g. two simultaneous bug-fix worktrees), re-read §3 of the
  research doc and verify each of the eight hazard classes has
  its preventive+compensating pair in place. If any pair is
  missing, the pattern is not ready — land the missing mitigation
  first.
- When `EnterWorktree` flips to default, update
  `docs/AUTONOMOUS-LOOP.md` to spell out the session-start rule
  (always start from main root) AND the end-of-tick rule (exit
  worktree before history-append).
- Quarterly re-map cadence: this research doc gets re-visited
  every N rounds (TBD) to update §2.8 with newly-discovered
  classes; dragons get charted as instances land.

**First application (this tick):**

- Research doc: `docs/research/parallel-worktree-safety-2026-04-22.md`.
- No parallel spawns this tick.
- PR #32 markdownlint fix landed as single-worktree exercise
  (commit `e40b68a`, not pushed), demonstrating happy-path
  works; not a mandate that all paths do.
- Three companion memory entries (this one + stale-branch
  cleanup + memory-slug behavior).

**Date:** 2026-04-22.
