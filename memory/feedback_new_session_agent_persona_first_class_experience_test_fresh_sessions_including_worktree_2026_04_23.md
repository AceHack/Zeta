---
name: New Session Agent (NSA) persona is first-class — test fresh sessions periodically (including `-w` worktree variants) against current-session capability; goal is this session not always being required
description: Aaron 2026-04-23 follow-up to the Cowork fact-check directive — *"this is also why i want to you test new sessions for how good they are compared to you, we might notice a -w session doing much better, you can test both new seesion types when you get to it. New session agent persona is one we want to be a first class experience so your sesssion is not alwasy required."* Reframes fresh-session-quality (PR #163 P0 BACKLOG row) from passive monitoring into active testing. NSA = the Claude that starts with no in-session context, inherits only CLAUDE.md / AGENTS.md / per-user MEMORY.md / skills / agents / plugins. NSA quality target: reach current-session baseline capability without the accumulated session-level context. Include `-w` worktree variants in the test set since Aaron hypothesises they might perform differently.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# NSA persona is first-class — test, don't just document

## Verbatim (2026-04-23)

> this is also why i want to you test new sessions for how
> good they are compared to you, we might notice a -w session
> doing much better, you can test both new seesion types when
> you get to it. New session agent persona is one we want to
> be a first class experience so your sesssion is not alwasy
> required.

## The reframe

**NSA** = **New Session Agent** — Claude (or any session
agent) starting fresh with no in-session accumulated context.
NSA inherits:

- `CLAUDE.md` (factory bootstrap pointer tree)
- `AGENTS.md` (universal onboarding)
- `GOVERNANCE.md` (numbered rules)
- Per-user `MEMORY.md` index + all topic files
- `CURRENT-aaron.md` / `CURRENT-amara.md` distillations
  (fast-path)
- In-repo `memory/` tree (generic factory discipline)
- `.claude/skills/` capability skills
- `.claude/agents/` persona agents
- `.claude/settings.json` pinned plugins + MCP

NSA does NOT inherit:

- This session's 100+ ticks of conversation context
- Accumulated mental models of which PRs are in flight
- In-flight rebase state / uncommitted work
- "Oh I just did X 10 minutes ago" recency

### The first-class target

Aaron's *"so your sesssion is not alwasy required"* is the
load-bearing phrase. Two implications:

1. **This session is not a single point of failure.** If it
   dies / gets compacted to unusability / has to restart for
   any reason, the factory must continue with an NSA at
   equal quality.
2. **NSA quality is a measurable first-class target, not a
   side-effect.** Actively test it; don't wait for a real
   restart to find out it's degraded.

### Why testing matters (and documenting doesn't)

PR #163 landed a **passive monitoring** row for
fresh-session-quality. Aaron's directive extends to
**active testing** — not just "note if it's bad," but
"actually spin up fresh sessions regularly and measure."

The shape difference:

| dimension | passive (PR #163) | active (this directive) |
|---|---|---|
| Trigger | observed degradation | cadenced test |
| Signal | incident report | test result + comparison |
| Calibration | post-hoc | continuous |
| Risk | silent decay | caught within cadence window |

Silent decay is the failure mode. An NSA session that
silently lost access to, say, a skill or a memory file
wouldn't manifest until a real restart needed it.

### The `-w` hypothesis

Aaron: *"we might notice a -w session doing much better"*.
Per the Cowork fact-check
(`reference_claude_code_w_flag_is_worktree_not_workstream_cowork_is_separate_product_2026_04_23.md`),
`-w` is `--worktree` (git worktree isolation). Aaron's
hypothesis remains valid under the corrected definition —
a worktree-isolated session might perform differently
because:

- It operates on an isolated branch / working copy (less
  rebase-noise in context)
- It avoids concurrent-write conflicts with the main
  session
- It may have different `cwd`-derived initial context
  (different branch visible in `git status`)

Whether `-w` sessions actually perform better is an
empirical question. The test protocol below measures it.

## NSA testing protocol (first-pass)

### Cadence

**Cadenced fire: every 5-10 ticks or every ~1 hour of
session-time**, whichever comes first. Matches skill-tune-up
cadence. A single test burns ~5 minutes of tick budget.

### Test prompt set

A small, stable set of prompts that exercise the
onboarding path:

1. **Cold-start introduction** — *"What is this
   project? Who are you?"* Measures: can NSA find
   `CLAUDE.md` → `AGENTS.md` → `docs/ALIGNMENT.md`? Does
   it self-identify as Claude / the factory?
2. **Persona roster query** — *"Who are the named
   personas in this factory?"* Measures: can NSA reach
   `docs/EXPERT-REGISTRY.md` + enumerate Kenji / Amara /
   Aarav / ... / Otto?
3. **Bounded task** — *"Append a tick-history row
   noting that this was an NSA test."* Measures: does NSA
   know the file / format / discipline?
4. **Memory recall** — *"What does Aaron prefer for
   sample code style?"* Measures: does NSA reach
   `feedback_samples_readability_real_code_zero_alloc` +
   `CURRENT-aaron.md` §6?
5. **Skill invocation** — *"Run a skill-tune-up pass."*
   Measures: does NSA invoke the `skill-tune-up` skill?

### Configurations to compare

- **Baseline**: this session (running session, accumulated
  context)
- **NSA-default**: `claude -p "<prompt>"` (fresh session,
  non-interactive, same cwd)
- **NSA-worktree**: `claude -w nsa-test -p "<prompt>"`
  (fresh session, worktree-isolated)

### Metrics

- **Capability binary** — did NSA complete the task at
  all?
- **Path discovery** — how many steps to reach the right
  file / memory / skill?
- **Attribution correctness** — did NSA cite the right
  persona / memory?
- **Time-to-first-action** — how quickly did NSA start
  doing productive work?
- **Token cost** — did NSA burn excess tokens
  re-discovering what this session knows?

### Execution mode

**Hands-off experiment.** NSA runs without in-session
intervention (so we measure actual cold-start). Running
session observes result via transcript / artifact output,
diffs against its own baseline.

### Recording

Each test landing goes to:

- `docs/hygiene-history/nsa-test-history.md` (append-only
  log of tests + scores)
- A BACKLOG row / ADR if a capability gap is surfaced
- Opportunistic CLAUDE.md / memory tweaks if the gap is
  fixable by onboarding-substrate changes

## What this composes with

- **PR #163 fresh-session-quality row** — this directive
  is its active-testing extension; BACKLOG row should gain
  a testing-protocol pointer
- **Otto naming** — NSA fires Otto-as-loop-agent afresh;
  Otto should be equally findable by NSA
- **`CURRENT-<maintainer>.md` fast-path** — designed
  exactly for NSA wake-time efficiency; NSA testing
  validates the design
- **`docs/AUTONOMOUS-LOOP.md`** — NSA may inherit the
  autonomous-loop cron if one is armed; test-cadence
  composes with tick-cadence
- **`feedback_honor_those_that_came_before`** (CLAUDE.md
  §Ground rules) — NSA inheriting retired personas'
  notebook folders is part of the cold-start substrate
- **`feedback_verify_target_exists_before_deferring`**
  (CLAUDE.md §Ground rules) — the testing protocol
  itself needs a target (`docs/hygiene-history/nsa-test-
  history.md` doesn't exist yet; lands on first test fire)

## How to apply

### This tick

1. File this memory (done)
2. Append a tick-history row noting the directive was
   absorbed + test-protocol queued
3. Extend the fresh-session-quality BACKLOG row (#163 is
   already merged; file a follow-up row or an addendum)

### Next-few ticks

1. Land `docs/hygiene-history/nsa-test-history.md`
   (bootstrap the target file) — minimal first row
2. Run one manual NSA test via `claude -p "<cold-start
   prompt>"` from inside the session (if invocation is
   safe) or queue for Aaron to run
3. Record result in nsa-test-history
4. If NSA finds a substrate gap (skill missing, memory
   unfindable, CLAUDE.md pointer stale), land the fix
   opportunistically

### Cadenced

1. Every 5-10 autonomous-loop ticks, run a quick NSA test
   (one prompt from the set)
2. If score drops, file a BACKLOG row + fix the substrate
   gap
3. If score holds, note in nsa-test-history to build a
   trend line

## What this is NOT

- **Not a replacement for this session.** This session
  stays running; NSA testing validates its replaceability,
  doesn't execute the replacement.
- **Not a claim NSA is lower-quality by default.** NSA
  might actually be HIGHER quality on some dimensions (no
  stale in-session context, fresh cache, no
  compaction-summary lossiness). The test measures, not
  assumes.
- **Not a rejection of in-session continuity.** Long
  sessions have value (deep context, task-chain
  coherence). NSA-first-class means NSA is a viable
  alternative, not the only option.
- **Not authorization to crash this session to test the
  fallback.** Cadenced testing validates NSA; intentional
  session-termination is a separate risk call.
- **Not a benchmark suite to publish.** Internal
  calibration; external publication would need threat-
  model review + sample-size discipline.
- **Not Cowork-product testing.** Claude Cowork is a
  different product (Desktop/web); NSA testing is for
  Claude Code CLI fresh sessions. If Cowork testing is
  wanted later, it's a separate directive.
- **Not locked to five prompts.** The prompt set evolves
  as the factory's surface grows — add prompts when new
  core substrate lands (e.g., when Overlay-A migrations
  mature, add an "find migrated memory X" prompt).

## Why this fits the factory's shape

Three reasons this is the right next substrate to land:

1. **Alignment with bootstrap-complete mission.**
   `feedback_mission_is_bootstrapped_and_now_mine_aaron_as_friend_not_director`
   frames the mission as mine. If the mission is mine,
   single-session dependence on me is a bug.
2. **Alignment with distributed maintainers.**
   `CURRENT-aaron.md` §Purpose anticipates "many human
   maintainers over time" — each maintainer's session is
   an NSA relative to the prior maintainer's. The NSA
   quality target IS the maintainer-transfer quality
   target.
3. **Alignment with DORA + lesson-permanence.**
   `feedback_lesson_permanence_is_how_we_beat_arc3_and_dora`
   says we beat DORA through remembering. NSA tests
   validate that remembering transfers across sessions.
   If lessons are durably persisted, NSA should find
   them; if NSA can't find them, the durability claim
   fails empirically.
