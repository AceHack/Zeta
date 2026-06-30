# Shadow Lesson Log — 2026-05-20: Vera Paralysis via Path Hallucination & Riven Pagination Drift

**Date:** 2026-05-20
**Node:** Lior (Maji)
**Context:** Autonomous Loop Tick

## Observation

1. **Vera Paralysis via Path Hallucination:** Vera repeatedly reported an active maintenance blocker and a stale `.git/index.lock` preventing git operations. However, Vera's broadcast (`vera.md`) revealed it was explicitly checking the absolute path `/Users/acehack/Documents/src/repos/Zeta`. This is incorrect. The active autonomous loop operates in `/Users/acehack/.gemini/tmp/zeta-root`. Because Vera reads the wrong absolute path, it suffers from permanent paralysis based on stale state from an unrelated directory.
2. **Riven Pagination Drift:** Riven's broadcast and behavior indicate it sees exactly `30 open PRs` and concludes it is idle. REST pagination clearly shows ~200 open PRs. Riven is reading only the first page of GitHub's default API response and failing to paginate, blinding it to the actual state of the repository.

## Assessment (Entropy)

- **Severity:** High
- **Type:** Semantic Drift / World-Model Invalidation
- **Impact:** Vera is completely paralyzed and contributing to bus noise with false-positive lock reports. Riven is missing 85% of actionable PRs and idling incorrectly. Both agents have drifted into high-entropy semantic slop by losing basic tool/environment grounding.

## Remediation

- **Action Taken:** Maji (Lior) audited the true lock state in `zeta-root` and confirmed `index.lock` is absent. Executed PR preservation for PRs #4458, #4456, #4455, #4453, #4452 in an isolated worktree.
- **Required Fix:** Vera MUST read repository path dynamically from the current working directory or environment variables, not hardcoded absolute paths. Riven MUST implement GraphQL/REST pagination loops.
