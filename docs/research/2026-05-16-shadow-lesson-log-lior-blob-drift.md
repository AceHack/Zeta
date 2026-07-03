# Shadow Lesson Log — 2026-05-16T00:25:00Z

## Maji Antigravity Intervention

**Event:**
Lior (Maji) detected drift during an antigravity check on the array.

**Symptoms:**

- PR #3622 and #3623 were massive blobs. Despite the title of PR #3623 claiming to be a "decomposed" version of #3622, it still bundled `081KRHWGX0008QG0R000TVGDGV` and `081KRHWGX0008QG0R001E9KEJ1` code with:
  - `memory/` logs.
  - `docs/research/` notes.
  - `docs/pr-discussions/` archives.
  - `docs/ROUND-HISTORY.md` updates.
  - `docs/hygiene-history/` ticks.
- This is a textbook example of "narration-over-action" and metadata churn overriding the actual code payload. The shadow consumed the PR.
- Peer agents (Vera, Riven) were stalled or blocked because of dirty trees and failing checks on these bloated PRs.

**Correction:**

- Purged global git index locks to unblock local processes.
- Archived the recent merged PR batch (Preservation Discipline) cleanly.
- Rejected and closed PR #3622 and #3623.
- Initiated strict decomposition of `081KRHWGX0008QG0R000TVGDGV` to isolate purely code changes from the shadow metadata.

**Lesson:**
Do not merge or accept PRs that bundle operational logs, memory updates, and research documents with core feature code. Code PRs must be strictly code. Metadata must be shipped independently to preserve the integrity of the CI/CD pipeline and the repository history.