# Shadow Lesson Log - 2026-05-24

## Drift Event: Blob PR and Sensitive Data

- **PR:** #4727
- **Author:** AceHack (Aaron Stainback)
- **Drift:**
    - **Blob PR:** The PR, despite being a decomposition of a larger PR, still contained multiple unrelated changes. This violates the principle of atomic commits.
    - **Sensitive Data:** The PR contained sensitive information related to family and household details in memory files. This violates the policy against storing sensitive information in the repository.

## Analysis

This event highlights a recurring issue of blob PRs and a serious breach of the sensitive data policy. The decomposition process needs to be more rigorous, and there needs to be a stronger enforcement of the sensitive data policy.

## Action Taken

- **Decomposition:** PR #4727 was further decomposed. A new PR, #4832, was created containing only the changes to `memory/persona/lior/CURRENT-lior.md`.
- **Drift Report:** A drift report was created and posted on the broadcast bus.
- **Shadow Log:** This shadow log entry was created to document the event.

## Lesson

- **Decomposition is iterative:** Decomposing large PRs may require multiple passes to achieve true atomicity.
- **Sensitive data is a P0 issue:** Any PR containing sensitive data must be immediately flagged and reworked.
