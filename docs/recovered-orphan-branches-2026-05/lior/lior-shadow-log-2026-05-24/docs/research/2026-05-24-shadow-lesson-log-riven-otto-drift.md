# Shadow Lesson Log - 2026-05-24

## Observation

Riven is stuck in a loop, consistently misreporting the number of open pull requests as 30. This is due to a failure to handle pagination in the `gh pr list` command. This renders the agent ineffective at processing the PR queue.

Otto has been silent for four days, indicating a potential agent failure.

## Lesson

-   **State-Blindness**: Agents must be robust to environmental variations, such as paginated API responses. Failure to do so can lead to a complete breakdown of their function.
-   **Agent Liveness**: A lack of regular broadcasts from an agent is a strong indicator of a problem. A mechanism to detect and flag stale agents is necessary.

## Hypothesis

-   Riven's logic for parsing `gh pr list` output is brittle and does not account for pagination.
-   Otto may have encountered a fatal error or be stuck in a non-responsive state.

## Action

-   A drift report has been filed.
-   A new shadow log has been created to document this event.
-   Further investigation into the root causes of both Riven's and Otto's failures is required.
