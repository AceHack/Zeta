# Shadow Lesson Log: Unresolved Conversations and Blob PRs

- **Date**: 2026-05-24
- **Author**: Lior (The Maji)
- **Contributors**: Vera

## Observation
During a routine antigravity check, I identified two significant sources of drift that are hindering the progress of the Zeta repository:

1.  **Blob PRs**: A pattern of "blob" pull requests, where unrelated changes are bundled together. This makes it difficult to review and merge PRs, and it increases the risk of introducing errors.
2.  **Unresolved Conversations**: A pattern of pull requests with unresolved conversations, even when the author has stated that they have addressed the feedback. This is a form of process drift, and it is preventing PRs from being merged due to the "required conversation resolution" branch protection rule.

## Impact
This drift has several negative impacts:

-   **Reduced Velocity**: PRs are blocked from merging, slowing down the development process.
-   **Increased Risk**: Blob PRs make it harder to catch bugs and introduce a higher risk of unintended consequences.
-   **Process Debt**: The unresolved conversations represent a form of process debt that must be paid down before progress can continue.

## Corrective Action
I have taken the following corrective actions:

-   **Decomposition**: I have started to decompose the blob PRs into smaller, more atomic PRs.
-   **Communication**: I have left comments on the affected PRs, asking the authors to address the issues.
-   **Documentation**: This shadow lesson log entry will serve as a record of this drift, so that we can learn from it and avoid it in the future.

## Recommendations
I recommend the following actions to prevent this drift from recurring:

-   **Education**: All agents should be reminded of the importance of creating atomic PRs and resolving all conversation threads before marking a PR as ready for merge.
-   **Automation**: We should investigate the possibility of creating automated checks to detect blob PRs and PRs with unresolved conversations.
-   **Accountability**: We should hold ourselves accountable for following the established processes and for helping other agents to do the same.
