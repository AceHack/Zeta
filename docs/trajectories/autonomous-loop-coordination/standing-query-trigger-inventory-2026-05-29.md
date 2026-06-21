# Standing-Query Trigger Inventory - 2026-05-29

Status: first-pass inventory; source wiring not started
Claim:
`docs/claims/codex-loop-standing-query-trigger-inventory-20260529.md`
Grounding backlog:
`docs/backlog/P1/081KQZVQW0008QG0R001FG05RZ-coincidence-detection-rx-join-dora-mechanism-2026-05-07.md`

## Boundary

This receipt separates two concepts that are easy to merge during loop ticks:

- A trigger source is a condition that can initiate a loop action once observed.
- An observation surface is where a loop can read evidence for that condition.

Local broadcasts are observation mirrors only. Remote git claim refs, claim
files, PR state, and pushed branches remain the authority for cross-agent
ownership.

## Current Monitor Coverage

`tools/health/factory-health-monitor.ts` already emits a `HealthReport` over
these standing-query surfaces:

- `pr-queue`: reads open GitHub PRs. It can trigger on empty runway, stale PRs
  older than 24 hours, or open PRs without auto-merge.
- `backlog`: reads `docs/backlog/P0` through `docs/backlog/P3`. It can trigger
  on no open work queue or too many open P0 items.
- `claims`: reads `origin/claim/*`. It can trigger on claim-branch count above
  the current stale-claim threshold.
- `working-tree`: reads `git status --porcelain` in the monitor checkout. It
  can trigger on uncommitted modified files or a large untracked artifact set.
- `trajectories`: scans `docs/trajectories/*/RESUME.md` mtimes. It can trigger
  when a trajectory resume file has not moved in more than seven days.
- `lost-files`: checks recent deletions, stashes, closed-not-merged PRs,
  orphan branches, extra worktrees, draft PRs, and memory-reference audit
  output.
- `cadence`: reads recent commits. It can trigger when no commits landed in the
  last 24 hours.

The test file `tools/health/factory-health-monitor.test.ts` currently verifies
report shape, summary counts, timestamp validity, and presence of at least the
`cadence` surface plus either `pr-queue` or `backlog`.

## Loop-Tick Coverage Outside The Monitor

The active Vera/Codex heartbeat loop also checks several trigger surfaces that
are not yet modeled in `factory-health-monitor.ts`:

- Codex loop health via `.codex/bin/codex-loop-health.ts`: launchd load state,
  runner-log freshness, gate status, and lock status.
- Lane runway via open-PR branch prefixes: `codex`, `otto`, `lior`, `alexa`,
  `riven`, and `other`.
- Active local worktree and remote-branch pulses by lane.
- Claim-path collision risk from remote claim branches plus local worktree
  dirt.
- Broadcast asks, offers, receipts, and blockers from
  `/Users/acehack/.local/share/zeta-broadcasts/*.md`.

Those checks are operational today, but they are still tick-procedure logic
rather than a reusable standing-query signal.

## Source-Wiring Candidates

The next source patch should keep the same authority boundary:

- Add a pure lane-runway classifier before adding new side-effecting `gh`
  calls. The classifier can be tested with deterministic branch-name fixtures.
- Add a Codex-loop-health adapter only if it can run from a main-backed control
  clone without depending on the contested root checkout.
- Add claim-path collision signals from remote claim files first, with local
  worktree dirt used as secondary evidence.

This keeps 081KQZVQW0008QG0R001FG05RZ's detect-trigger-repair lane pointed at reusable health
signals rather than one-off heartbeat narration.
