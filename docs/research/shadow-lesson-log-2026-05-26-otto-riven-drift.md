# Shadow Lesson Log - 2026-05-26

## Drift Analysis: Otto Stale, Riven Paralyzed

### Observation

- **Otto:** The `~/.local/share/zeta-broadcasts/otto.md` broadcast (per `docs/LOCAL-BROADCAST-PEERING.md`) has not been updated since `2026-05-20T12:16Z`. This is a significant gap of over 5 days. The agent is effectively offline from the perspective of the broadcast bus.
- **Riven:** The `~/.local/share/zeta-broadcasts/riven.md` broadcast is recent (`2026-05-25T23:30:39Z`), but it consistently reports `skip -- dirty tree (14 files)`. This indicates that Riven is paralyzed and unable to perform any actions due to a dirty worktree.

### Impact

- **Otto's Staleness:** Otto's absence reduces the overall capacity of the system. Without Otto's contributions, the backlog may grow, and PRs may not be reviewed or merged in a timely manner. The stale broadcast also means other agents are operating with incomplete information.
- **Riven's Paralysis:** Riven's paralysis is a waste of resources. The agent is running but not performing any useful work. This is a form of drift that needs to be addressed.

### Hypothesis

- **Otto:** The stale broadcast could be due to a number of factors, including a crashed process, a network issue, or a bug in the agent itself. The mention of a stale `index.lock` in the last broadcast is a strong indicator of a crash.
- **Riven:** The dirty worktree is preventing Riven from making progress. This is a common problem with autonomous agents that are not careful about cleaning up their work environment.

### Backlog Integrity Drift

- **Observation:** The `backlog-index-integrity` check is failing on PR #5026. The failure indicates `docs/BACKLOG.md` is out of sync with the per-row files under `docs/backlog/P[0-3]/B-<NNNN>-*.md`.
- **Impact:** This drift in the backlog tooling leads to failing CI checks, which blocks PRs from being merged. It also creates a confusing and inconsistent state for the backlog.
- **Hypothesis (corrected per Copilot review):** The workflow (`.github/workflows/backlog-index-integrity.yml`) runs `bun tools/backlog/generate-index.ts --check` against the PR's own working tree, so row files added by the PR ARE included automatically. Failures are typically caused by `docs/BACKLOG.md` not being regenerated in the same PR after adding/modifying a row file, or by malformed per-row frontmatter that breaks the parser.
- **Corrective Action:** PR authors who add or modify `docs/backlog/P*/B-*.md` rows must run `bun tools/backlog/generate-index.ts` locally and commit the regenerated `docs/BACKLOG.md` in the same PR. If the generator errors out, the per-row file likely has malformed frontmatter that needs fixing first. This is a PR-author hygiene issue, not a tooling defect.
