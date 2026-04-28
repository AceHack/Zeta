# PR #422 drain log — drain follow-up to #403: tick-history correction-row pattern

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/422>
Branch: `drain/403-tick-history-correction-row`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during maintainer-
asleep window; pre-summary-checkpoint earlier in this session)
Thread count at drain: 4 Copilot post-merge threads on the parent #403
tick-history append.
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full record of the four post-merge
clarifications captured via the **append-only correction-row**
pattern (Otto-229 discipline).

This PR is the canonical example of the Otto-229 append-only
discipline applied to tick-history rows: when post-merge review
surfaces clarifications about an already-merged tick row, the
correction goes in a NEW row pointing back at the original
timestamp — never an in-place edit of the merged row.

---

## Threads — four clarifications captured in one correction row

### Thread 1 — Otto-NNN cluster placeholder should have been Otto-279

- Reviewer: copilot-pull-request-reviewer
- Severity: P2
- Finding: parent #403 tick-history row had "Otto-NNN cluster" as a
  placeholder in the session-cluster column; should have been
  "Otto-279 cluster" specifically (the load-bearing Otto on that
  tick — research-as-history surface-class refinement).
- Outcome: **APPEND-ONLY CORRECTION-ROW (Otto-229)** — original row
  stays untouched; correction row points back at the original
  timestamp + records "should have been Otto-279 cluster" with
  context.

### Thread 2 — "Three-thread day" vs (a)-(f) enumeration inconsistency

- Reviewer: copilot-pull-request-reviewer
- Severity: P2
- Finding: parent row narrated SIX sub-actions but said "three-thread
  day" in summary text. "Three-thread day" referred informally to
  three drain *PRs* in flight (#282, #398, #401) plus three new
  BACKLOG / refinement landings — NOT three discrete tick threads.
  Read the (a)-(f) enumeration as the canonical per-action list.
- Outcome: **APPEND-ONLY CORRECTION-ROW** — disambiguation captured
  in the new row.

### Thread 3 — Memory file path: forward-mirror landed in #405

- Reviewer: copilot-pull-request-reviewer
- Severity: P2
- Finding: parent row cited Otto-279 memory file via global Anthropic
  AutoMemory path; file has since been forward-mirrored into in-repo
  `memory/feedback_research_counts_as_history_first_name_attribution_for_humans_and_agents_otto_279_2026_04_24.md`
  (landed in PR #405).
- Outcome: **APPEND-ONLY CORRECTION-ROW** — the path resolves
  correctly now via the in-repo location; correction row notes
  the post-tick forward-mirror landing.

### Thread 4 — MAME / FBN naming canonical = FBNeo

- Reviewer: copilot-pull-request-reviewer
- Severity: P2
- Finding: parent row used "FBN" inconsistently for brevity; the
  canonical project name is **FBNeo** (not "FBN"). Lowercased
  `fbneo` may still appear as an EmulationStation/libretro-style
  slug, distinct from the project's display name. (No folder claim:
  per-board BIOS requirement kept MAME/FBNeo out of the
  BIOS-availability-filtered tree.)
- Outcome: **APPEND-ONLY CORRECTION-ROW** — naming clarification
  captured.

---

## Pattern observations (Otto-250 training-signal class)

1. **Otto-229 append-only correction-row is the canonical pattern
   for tick-history clarifications.** When post-merge review
   surfaces clarifications on an already-merged tick row, the
   correction row points back at the original timestamp rather
   than editing the original row in-place. Original row stays
   intact as historical record of what was believed at that
   timestamp; correction row records what we now know. Same
   discipline as ADR-supersedes-ADR pattern; preserves audit
   trail.

2. **Drain-subagent dispatch prompts must include the Otto-229
   constraint.** This was the originating finding behind Otto-229:
   a subagent was caught on PR #364 normalising
   `May-01` → `2026-05-01` in a prior tick-history row "for
   consistency." Absence of an explicit constraint in the dispatch
   prompt looked like permission. Fix: every drain-subagent
   dispatch targeting tick-history or hygiene-history files must
   carry "Constraint: do NOT edit existing rows — only APPEND new
   rows or correction rows."

3. **Single correction row can capture multiple clarifications.**
   #422 captured four distinct clarifications in one correction
   row pointing back at the parent's timestamp. The pattern
   composes: one tick → one parent row + zero-or-more correction
   rows pointing back at the parent's timestamp + one-or-more
   clarifications per correction row.

4. **Forward-mirror-landed-after-tick is its own correction
   sub-class.** Thread 3 captures a particularly clean example:
   the parent row was correct at authoring time (memory file was
   in AutoMemory, not in-repo); a subsequent PR #405 landed the
   forward-mirror; the path is now resolvable in-repo. The
   correction-row notes the post-tick state-shift without
   asserting the original was wrong.

## Final resolution

All 4 threads resolved via single append-only correction row.
PR auto-merge SQUASH armed; CI cleared; PR merged to main as
`043189e`.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
