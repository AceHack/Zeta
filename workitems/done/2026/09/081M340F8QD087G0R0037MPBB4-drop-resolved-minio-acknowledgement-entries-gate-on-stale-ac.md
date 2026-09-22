---
id: 081M340F8QD087G0R0037MPBB4
type: task
state: done
priority: P2
slug: drop-resolved-minio-acknowledgement-entries-gate-on-stale-ac
title: "Drop resolved minio acknowledgement entries; gate on stale acks"
created: 2026-09-22T07:32:18.797Z
completed: 2026-09-22T09:45:23.421Z
depends_on: []
composes_with: []
---

# Drop resolved minio acknowledgement entries; gate on stale acks

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M340F8QD087G0R0037MPBB4-*.md` glob. -->

## What

Follow-up to PR #17475 (image-resolvability.ts) now that PR #17486 landed
(GitLab's bundled minio subchart disabled, object storage repointed at
seaweedfs). Two changes:

1. **Removed both entries from `ACKNOWLEDGED_MISSING`** — `minio/minio` and
   `minio/mc` no longer render anywhere in the tree, so the acknowledgement
   that suppressed their gate is dead weight. Register is now empty.
2. **`staleAcknowledgements()` now GATES, not just reports.** An
   acknowledgement whose target is no longer even a current missing/arch-
   missing finding is dead weight either way (fix landed without the entry
   being removed, or the reference never matched anything) — cheap to check,
   cheap to fix (delete the entry), so it fails the checker rather than
   sitting quietly in a report section forever.

Also threaded an injectable `register` parameter through `isGatingRow` /
`gatingRows` / `counts` / `formatReport` (previously hardcoded to the
production `ACKNOWLEDGED_MISSING`) — needed because the existing behavioural
tests for "acknowledged does not gate" had been pinned to the exact minio
references that happened to be in the production register at the time, which
is exactly the fragility this cleanup is itself evidence of. Tests now inject
their own fixture registers.

Kept the "real register" test block meaningful now that it is empty: an
explicit test asserts the register's current (empty) state rather than
silently vanishing, and a separate test proves the shape-invariant checks
would actually catch a malformed entry (against a fixture), so the invariant
tests are not merely vacuous loops over zero entries.

## Measured

Re-`--refresh`d against the real tree post-#17486: 135 distinct images (down
from 137), 134 ok, 0 missing, 0 arch-missing, 0 acknowledged, 1 unknown
(the documented `hat-system-operator:placeholder`). Offline mode also exits
0. 52/52 tests pass (was 45; +7 for `staleAcknowledgements` + the register's
own empty-state assertions).

