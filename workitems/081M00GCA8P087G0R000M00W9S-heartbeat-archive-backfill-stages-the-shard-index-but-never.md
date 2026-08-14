---
id: 081M00GCA8P087G0R000M00W9S
type: bug
state: backlog
priority: P2
slug: heartbeat-archive-backfill-stages-the-shard-index-but-never
title: "heartbeat archive backfill stages the shard index but never the archive bodies, and the shard-keyed selector then never re-selects those PRs"
created: 2026-08-14T16:06:16.086Z
depends_on: []
composes_with: []
---

# heartbeat archive backfill stages the shard index but never the archive bodies, and the shard-keyed selector then never re-selects those PRs

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00GCA8P087G0R000M00W9S-*.md` glob. -->

## The defect

`agent-heartbeat.yml`'s archive step ran:

```sh
git add docs/github/prs/
```

`archive-pr-reviews.ts` writes to **two** places: the shard index under
`docs/github/prs/shards/` and the archive **body** — the rendered markdown — under
`docs/history/pr-reviews/`. The shard's `archive_path` field is a pointer at the body.
The step staged the pointer and dropped the target.

Nothing else rescued it:

- the commit guard used `git diff --quiet`, which is **blind to untracked files**, and a
  freshly-written archive body is always untracked;
- the later codegen step's `git add -A` is gated on a bare `git diff --quiet` with the
  same blindness, so on a tick where the archive was the only producer that block is
  skipped entirely.

## Why it is worse than the hole it was draining

Self-sealing. `selectBatch` skips any PR that already has a shard. So each tick would
have marked 3 PRs archived, committed no body for them, and **never re-selected them**
via `--all-merged` again. The backfill would have converted "1,345 merged PRs missing
from the mirror" into "1,345 shards whose `archive_path` names a file that is not in the
tree", at 3 per tick, recoverable only by an explicit per-number re-run.

## Measured, not inferred

- `origin/main` @ `d55305bb45`: **0** of 6,469 shards were dangling — the damage had not
  landed yet, because the step had not flushed a tick since `#10577` fixed its `--batch`
  defect ~70 minutes earlier.
- **0** archive bodies have *ever* been added by a heartbeat commit. Every one of the
  6,471 on main came from `pr-archive-on-merge.yml` (`archive(pr-reviews)`,
  `ci(pr-archive)`) or a bulk backfill PR (`data(pr-reviews)`, `docs(archive)`).
- `git diff --quiet` blindness reproduced directly in a scratch repo.

## Fix

- The step stages `docs/history/pr-reviews/` as well, and the guard's `git ls-files -o`
  half names it too.
- `archive-pr-reviews.ts` exports `WRITE_TARGETS`; `archive-pr-reviews.test.ts` derives
  the required pathspec set from it, so a new output directory added to the tool fails
  the guard until the step stages it — the class is closed, not the instance.
- `--limit 3` → `--limit 25`, justified by the measured fixed/marginal cost split
  (see the workflow comment).

## Not done here

The ~1,345-PR backlog is **not** bulk-drained in this PR. See the PR body for the
numbers behind that call.
