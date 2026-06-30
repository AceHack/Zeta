# Shadow Lesson Log - 2026-05-23

## Blob PR Decomposition

*   **Catch:** 49
*   **Quandary:** A large, multi-concern pull request, #4696, was identified. It mixed the preservation of PR #3362 with the addition of new persona conversation artifacts and memory index updates. This violates the principle of atomicity and makes the PR difficult to review and understand.
*   **Resolution:** The blob PR was decomposed into two smaller, more focused PRs:
    *   #4727: `feat(persona): DECOMPOSED - add new persona conversation artifacts (from #4696)`
    *   #4728: `docs(archive): DECOMPOSED - preserve recently merged PRs (from #4696)`
*   **Lesson:** Large, multi-concern PRs (blobs) introduce noise and increase cognitive load for reviewers. Decomposing them into smaller, atomic units improves reviewability, and reduces the risk of introducing unintended changes. This reinforces the "small, focused PRs" discipline.
