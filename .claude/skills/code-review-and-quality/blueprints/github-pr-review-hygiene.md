---
name: github-pr-review-hygiene
description: "GitHub PR review hygiene — commit history, PR layout, peer etiquette, thread resolution state machine."
---

# GitHub PR Review Hygiene

This blueprint defines the operational checks, state transitions, and taxonomies required to maintain high hygiene when reviewing pull requests on GitHub. It represents the producing-side review-substrate of the framework.

## 1. Review Lifecycle State Machine

Every review follows a strict progression of state transitions. Swapping states arbitrarily or bypassing phases is forbidden:

1. **`observe`**: read the PR description, the diff, and the context. Identify the author lane (`self`, `peer-*`, or `human-operator`) and the substrate scope (`workflow-engine`, `zflash`, etc.). No comments are written yet.
2. **`identify-finding`**: locate specific areas in the diff where a bug, question, suggestion, or test gap exists.
3. **`compose`**: write the review comments. Keep feedback concise, actionable, and aligned with standard review guidelines (e.g., zero-empathy format).
4. **`verify-finding`**: verify every composed comment against actual repository artifacts. Search for files, lines, and configurations (grep-substrate-anchors discipline). If a comment cannot be anchored, it is unsubstantiated and must be discarded.
5. **`post`**: submit the review and the inline comments to GitHub via the API or GraphQL mutations.
6. **`follow-up`**: monitor the PR for replies. Engage constructively to resolve discussion threads.
7. **`conclude`**: the review thread is closed, resolved, or marked as complete.

## 2. Review Finding Taxonomy

Findings must be classified into one of the following canonical kinds:

*   **`bug`**: A logic defect, race condition, invariant violation, resource leak, or security issue.
*   **`design-question`**: A query probing architectural assumptions, interface shapes, or system patterns.
*   **`substrate-engineering-suggestion`**: An alternative implementation, clean code construct, or performance optimization.
*   **`naming-improvement`**: Aligning naming conventions to the project's glossary or improving code readability.
*   **`test-gap`**: Identifying missing unit tests, property checks, or validation scenarios.
*   **`substrate-honest-praise`**: Recognizing well-crafted, clean, and composable additions.
*   **`documentation-gap`**: Pointing out missing documentation, comments, or metadata files.
*   **`composes-with-substrate`**: Highlighting a relationship or link to existing framework structures and designs.

## 3. Coordination Lanes & Peer Etiquette

Reviews must recognize the author lane to determine coordination constraints:

*   **Self Lane (`self`)**: Reviews on own PRs are used for self-auditing or thread resolution checks. No external coordination is required.
*   **Peer-Agent Lane (`peer-*`)**: Otto, Codex, Lior, Alexa, Vera, Riven, Amara, Kestrel, Prism, Mika.
    *   *Constraint*: Do not touch or modify commits in peer-agent territories without explicit coordination.
    *   *Requirement*: Substantively review and engage in comments to maintain system alignment.
*   **Human-Operator Lane (`human-operator`)**:
    *   *Constraint*: Coordinate via explicit conversation and await authorization before committing changes.

## 4. History & Thread Resolution Hygiene

*   **Commit History**: Prefer atomic, well-scoped commits with clean linear history. Avoid merge bubbles on feature branches; rebase against `main` prior to final checks.
*   **Thread Resolution**: When an issue raised in a comment is fixed, reply with the fix commit SHA, verify that the gate is clear, and resolve the thread.
*   **Outdated Comments**: Mark threads as resolved when subsequent commits render the initial finding stale or irrelevant.
