---
id: B-0442
priority: P1
status: open
title: "Missed-substrate cascade detector — background service that catches branch-vs-merged-PR drift (e.g., Otto-section-missed-PR-2980-by-3-min class)"
tier: factory-infrastructure
effort: M
created: 2026-05-13
last_updated: 2026-05-14
depends_on: [B-0400]
composes_with: [B-0402, B-0440, B-0441]
children: [B-0503, B-0504, B-0505]
tags: [multi-agent, background-service, bus, mechanization, drift-detection, race-condition]
type: feature
---

# Missed-substrate cascade detector background service

## Origin

Companion mechanization to B-0440 + B-0441. The substrate-honest
architectural challenge from the human maintainer 2026-05-13:

> *"you need to imagine how would you survive without this foreground
> loop and you background should be strong enough to do that"*

Operational example that surfaced this row: my Otto-section-missed-PR-#2980-by-3-min
cascade — a feature-branch commit landed AFTER its parent PR squash-merged,
leaving substrate on the branch but not on main.
Caught manually + recovered via PR #2997, but the recovery was reactive.

This row mechanizes detection of the failure class: substrate present
on a branch but missing from main due to merge-timing race conditions.

## The failure-class pattern

| Step | What happened | What should be caught |
|------|---------------|----------------------|
| 1 | Branch B has commits C1, C2 | (normal state) |
| 2 | PR #N opens against main | (normal state) |
| 3 | Auto-merge armed on PR #N | (normal state) |
| 4 | New commit C3 lands on B (after squash plan formed) | DETECT: C3 not in #N's squash |
| 5 | PR #N squash-merges (lacks C3) | DETECT: C3 orphaned from main |
| 6 | Branch B deleted post-merge | DETECT: C3 about to be lost |

The cascade can be caught at any step 4-6 by comparing:

- Branch HEAD commits
- Merged PR's squash content
- Main HEAD content
- Branch deletion plan

When the comparison shows substrate missing from main but present on
a branch, the service catches it BEFORE branch deletion.

## Acceptance criteria

- [x] Background service `tools/bg/missed-substrate-detector.ts` exists (slices 1+2+4 — earlier)
- [x] Runs under existing launchd / cron infrastructure (slice 6 — landed 2026-05-13)
- [x] On PR merge events (poll or webhook), checks if branch HEAD ==
      merge commit content (slice 3 — landed 2026-05-13 via `gh pr view --json headRefOid`
      + `git log <headRefOid>..origin/<branch>`)
- [x] When branch HEAD has commits the merged PR didn't include,
      publishes cascade-detected message via bus (B-0400):
      `{ topic: "missed-substrate-cascade", to: <agent>,
         payload: { branchName, missingCommits, recommendedAction:
         "open-recovery-PR" } }` (slice 4 — earlier)
- [x] Optionally auto-opens recovery PR with the missing commits
      (gated by configuration) (slice 5 — landed 2026-05-15 via
      B-0503 (`openRecoveryPR` core + `RecoveryAdapters` contract) +
      B-0504 (wire `--auto-recover` into `pollOnce` + real
      `REAL_RECOVERY_ADAPTERS` with 5-layer safety: type-contract,
      delete-and-recreate, working-tree-clean gate, detach-HEAD-before-
      delete, post-cherry-pick `--abort`))
- [x] Tests cover the detection heuristics (DST-replayable) — 24 tests cover slice 4 wiring + slice 3 detector (drift / no-drift / branch-deleted / branch-rebased / gh-error / git-error) + urgency classification
- [x] Documented in `docs/AUTONOMOUS-LOOP.md` (slice 6 — landed 2026-05-13)

## Slice 3 implementation summary (2026-05-13)

`realCascadeDetector` is a pure function composed with `CascadeDetectorAdapters`:

- `fetchPRRefs(prNumber)` — calls `gh pr view N --json headRefOid,mergeCommit`
- `compareBranchToMerged(branchName, headRefOid)` — runs:
  1. `git fetch --quiet origin <branchName>` (branch-deleted → null)
  2. `git merge-base --is-ancestor <headRefOid> origin/<branchName>` (rebased → null)
  3. `git log <headRefOid>..origin/<branchName> --format=%H` (the drift commits)

Urgency classified via `classifyCascadeUrgency(commitCount, mergedAtIso, nowMs)`:
fresh (<1hr) or 4+ commits → high; 2-3 commits or <24hr → medium; else low.

Cap on reported commits: `MAX_REPORTED_MISSING_COMMITS = 50` prevents false-positive
floods when the branch is being reused for follow-up work (not a cascade).

## Design sketch

```typescript
// tools/bg/missed-substrate-detector.ts
//
// Detects branch-vs-merged-PR drift; surfaces recovery work.

interface MergedPRState {
  prNumber: number;
  branchName: string;
  squashCommit: string;       // SHA on main after squash
  branchHead: string;          // SHA on the feature branch
  branchCommits: string[];     // all commits on the branch
  squashIncludedCommits: string[];  // commits included in the squash
}

async function findMissedSubstrate(pr: MergedPRState): Promise<string[]> {
  // Find branch commits NOT included in the squash merge
  return pr.branchCommits.filter(
    sha => !pr.squashIncludedCommits.includes(sha)
  );
}

async function watchRecentMerges(bus: BusClient): Promise<void> {
  const recentlyMerged = await ghMergedPRsLastHour();

  for (const pr of recentlyMerged) {
    const state = await fetchMergedPRState(pr.number);
    const missed = await findMissedSubstrate(state);

    if (missed.length > 0) {
      await bus.publish({
        topic: "missed-substrate-cascade",
        to: "all-active-agents",
        payload: {
          prNumber: pr.number,
          branchName: state.branchName,
          missingCommits: missed,
          recommendedAction: "open-recovery-PR",
          urgency: state.branchAboutToBeDeleted ? "high" : "medium",
        },
      });
    }
  }
}
```

## Operational examples this would catch

1. **Otto-section-missed-PR-#2980-by-3-min** (the originating example):
   commit `f5aed67` (Otto-in-own-voice) pushed at 09:25:58Z;
   PR #2980 squash-merged at 09:22:42Z; auto-merge fired before
   push arrived. Service would have caught at step 5 above.

2. **Concurrent-agent index-lock branch drift**: Vera commits on
   her branch while Otto's branch auto-merges; if Vera's commits
   reference Otto's branch content that's been squashed, the
   drift gets detected.

3. **Force-push-over content** (composes with lost-files surface):
   substrate committed + force-pushed-over before merge; if branch
   tracking includes pre-force-push content, the service surfaces
   the lost commits.

## Composes with

- `.claude/rules/encoding-rules-without-mechanizing.md` (the rule
  this mechanizes)
- `.claude/rules/lost-files-surface.md` (this service IS a lost-files
  prevention layer at the auto-merge timing scope)
- `.claude/rules/dependency-status-surface.md` (composes; both
  surface drift detection at different scopes)
- B-0400 (bus protocol — transport for cascade detection)
- B-0402 (shadow observer — canonical pattern)
- B-0440 (Standing-by detector — composes; full background-services
  suite)
- B-0441 (backlog-ready notifier — composes; full suite)
- `tools/hygiene/LOST-FILES-LOCATIONS.md` (the 15-class survey; this
  service mechanizes one of the classes)
- PR #2980 (the operational example)
- PR #2997 (the reactive recovery; this service makes future
  recovery proactive)
- PR #2998 (background-services architecture)
- PR #2999 (substrate-honest discipline triad — decomposition path
  that produced this row)

## Pre-start checklist

- [ ] Prior-art search: `tools/hygiene/audit-lost-files.ts` (current
      TS implementation; check for overlap; possible composition)
- [ ] Dependency proof: B-0400 bus protocol slice ready
- [ ] Verify detection heuristics handle GitHub squash-merge SHA
      resolution correctly

## Substrate-honest caveats

- Design sketch only
- Auto-recovery-PR opening is gated; first implementation should
  default to detect-only (publish + log; don't auto-act)
- Per razor-discipline: claim is design-level
- The detection has a time-window heuristic; perfect detection
  requires webhook subscription rather than polling

## Decomposition into implementation slices (TBD)

When picked up for implementation:

- Slice 1: merged-PR state fetch via gh CLI
- Slice 2: branch-vs-squash comparison logic
- Slice 3: cascade-detection message schema
- Slice 4: bus integration
- Slice 5: optional auto-recovery-PR opening (gated)
- Slice 6: tests + documentation
