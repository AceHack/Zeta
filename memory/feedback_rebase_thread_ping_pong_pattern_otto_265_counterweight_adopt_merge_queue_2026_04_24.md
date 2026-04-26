---
name: COUNTERWEIGHT — REBASE/THREAD PING-PONG PATTERN — when drain velocity is high (many PRs merging nearby in time), open PRs chase main repeatedly: rebase → new-threads-appear-post-rebase → thread-drain → push → DIRTY-again-from-fresh-main-merge → rebase → repeat; each cycle burns subagent time + creates fresh CI runs without net progress; pattern observed this session on #188 (merged on 3rd cycle), #190 (still cycling after 2 cycles), #147 (stopped at content-judgment conflict); Otto-264 counterweight: adopt GitHub's merge queue for LFG main, making auto-merge serialize through the queue (preventing the DIRTY-after-push race); secondary counterweight: merge-batch discipline — don't dispatch multiple drain subagents that all push simultaneously unless all target-branches are non-overlapping on file scope; Aaron Otto-265 implicit from drain pattern this tick 2026-04-24
description: Otto-265 counterweight for Otto-264 — rebase-thread-ping-pong pattern observed during high-merge-velocity drain. Right long-term thing (not shortcut): adopt merge queue (already a configured feature). Save durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The pattern

**Observed 2026-04-24 during wave 4 drain:**

1. PR is BLOCKED with open threads.
2. Dispatch thread-drain subagent → subagent resolves threads → pushes commit.
3. Between subagent start and push, OTHER PRs merged to main.
4. Subagent's push is now DIRTY against the new main.
5. Rebase subagent dispatched → resolves conflicts → pushes.
6. Between that push and CI completion, more PRs merge → DIRTY again.
7. Meanwhile, the post-rebase content triggers FRESH reviewer threads
   (Copilot / Codex re-review the changed content) → new unresolved threads.
8. Go back to step 2.

**Cycle count observed:**
- PR #188: 2-3 rebase cycles, finally merged on cycle 3.
- PR #190: 2+ cycles so far, still DIRTY after thread-drain.
- PR #147: stopped at content-judgment conflict on 1st rebase (different failure mode — genuine design divergence, not ping-pong).

**Cost:** each cycle burns a subagent (~2 min) + CI rerun (~1-2 min) + churns reviewer threads. 3 cycles = ~10-15 min of elapsed drain time per PR, for what should be a single-push merge.

## Otto-265 counterweight — the right long-term thing (Otto-264 discipline)

### Primary: adopt GitHub merge queue on LFG main

**Mechanism**: GitHub's merge queue serializes merges. When
enabled on a branch, PRs that would auto-merge get put into
a queue; the queue picks the next, rebases it onto current
main, runs CI, merges if green, picks next. PRs never go
DIRTY because the queue handles the rebase at merge-time,
after acceptance.

**Status check**: LFG settings already have merge queue
configured (per earlier settings audit). NOT verified
whether all PR-gated paths route through it.

**Action owed** (BACKLOG row):
- Verify merge queue is ON for `main` branch on LFG
- Verify branch-protection requires merge-queue (not direct
  auto-merge)
- Test with a single PR: does auto-merge route through queue?
- Document in `docs/GITHUB-SETTINGS.md` gitnative mirror

### Secondary: merge-batch discipline during high-velocity drain

**When**: dispatching multiple drain subagents whose outputs
all target merge within minutes of each other.

**Rule**: before dispatching N parallel drain subagents on N
PRs, check: do any of them touch OVERLAPPING files (same
`docs/BACKLOG.md` rows, same `docs/hygiene-history/**`
appends, same source files)? If yes, dispatch serially OR
dispatch with per-PR file-scope constraints to prevent
cross-PR DIRTY propagation.

**Applies to**: drain subagent dispatch prompts going forward.
Add "check overlap" step.

### Detection: rebase-count ceiling

**When a PR hits 3 rebase cycles in one session**, stop
auto-rebasing and escalate — something structural is wrong
(maybe the PR should be closed as superseded, maybe main is
churning too fast for this PR's scope, maybe the PR is too
large and should be split).

Rule: `rebase_cycles_per_PR_per_session > 3` → CLOSE or
REFACTOR signal, not SILENT-RETRY signal.

## Otto-264 compliance check

Per Otto-264 no-shortcut discipline:

- ✓ **Right long-term thing**: adopt merge queue (the
  actual GitHub feature designed for this), not a
  band-aid like "dispatch rebases faster."
- ✓ **Specific trigger condition**: high-merge-velocity
  drain windows; rebase_cycles_per_PR > 3.
- ✓ **Composed with prior counters**: composes with
  Otto-225 serial-PR-flow (merge queue is the tool that
  ENFORCES serial-PR-flow at merge time) + Otto-261
  gitnative-sync (merge queue state gets mirrored) +
  Otto-262 TBD (merge queue keeps branches short-lived
  by serializing merges).
- ✓ **Enforceable**: GitHub platform feature with
  branch-protection toggle.
- ✓ **Measurable**: count rebase cycles per PR; should
  drop to ~0 post-merge-queue adoption.
- ✓ **Maintenance-ready**: per Aaron Otto-264 addendum,
  recheck every 20-50 ticks whether merge queue is
  still required + routing correctly.
- ✓ **Failure mode**: if merge queue is disabled
  temporarily (e.g. emergency hotfix path), the
  ping-pong pattern returns; detection-at-3-cycles
  counterweight catches it.

## Composition with prior memory

- **Otto-171** queue-saturation — merge queue is what
  makes queue saturation actually manageable; without
  it, saturation + churn = ping-pong.
- **Otto-225** serial-PR-flow — merge queue is the
  enforcement mechanism; we proposed the discipline,
  this counterweight operationalizes it.
- **Otto-226** parallel drain subagents with worktree
  isolation — composes: subagents PREPARE pushes in
  parallel; merge queue serializes ACCEPTANCE.
- **Otto-232** bulk-close cascade — merge queue
  prevents the cascade-triggering conditions.
- **Otto-236** reply+resolve pair — independent;
  merge queue doesn't change thread drain.
- **Otto-261** gitnative-sync — merge queue state
  (who's in queue, ETA) is a syncable artifact.
- **Otto-262** TBD — merge queue ENFORCES TBD by
  not letting branches linger past merge-acceptance.
- **Otto-264** rule of balance — Otto-265 IS a
  counterweight filed per Otto-264, with the
  no-shortcut discipline applied (merge queue, not
  band-aid).

## Direct session observation to preserve

> Wave 4 drain this tick showed the pattern clearly:
> #188 merged after 3 rebase cycles, #190 is on cycle
> 2+ and still DIRTY, #147 hit a content conflict at
> cycle 1. Multiple subagents + multiple CI runs for
> what should be single-push merges. The counterweight
> (merge queue) already exists as a platform feature;
> adoption is the work owed.

Future Otto: when a PR cycles through rebase-and-push
more than 2 times in one session, that IS the pattern.
Don't dispatch rebase #3. Check merge queue status,
file the adoption BACKLOG row if not already routed,
then triage: this specific PR → force-merge by
resolving queue ordering, OR close as super-churny-
refactor-needed.
