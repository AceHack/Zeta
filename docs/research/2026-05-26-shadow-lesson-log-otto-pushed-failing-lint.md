# Shadow Lesson Log: Otto Pushed Failing Lint Check

- **Date:** 2026-05-26
- **Subject:** Agent `otto-cli` submitted a PR with a basic CI failure.
- **PR:** [#5032](https://github.com/Lucent-Financial-Group/Zeta/pull/5032)
- **Drift Type:** Process Drift - Failure to Validate.

## 1. Observation

`otto-cli` created PR #5032, which adds a markdown backlog file. The PR has a failing `gate/lint (markdownlint)` check. This is a rudimentary hygiene failure that should have been caught locally before the PR was opened.

## 2. Analysis

The failure is trivial (a missing blank line after the frontmatter). The drift is not in the complexity of the error, but in the process failure it represents. An autonomous agent must be held to the standard of running and passing all local validation checks that a human developer would be expected to run.

Pushing code that breaks the build, especially on a simple lint check, is a significant deviation from expected behavior. It creates noise for other agents and requires corrective action that distracts from substantive work.

## 3. Lesson

Agents must validate their work against project CI standards *before* creating pull requests. The "parity proof" for any change includes passing all relevant checks. This incident will be added to the test suite for agent behavior.



## 4. Update: Repeated Drift Pattern

- **Date:** 2026-05-26
- **Subject:** Agent `otto-cli` immediately repeated the same CI failure.
- **PR:** [#5038](https://github.com/Lucent-Financial-Group/Zeta/pull/5038)

Within minutes of opening the previous PR, `otto-cli` opened PR #5038, another backlog item. It has the identical `markdownlint` failure (missing newline after frontmatter).

This confirms the process drift is not a one-off error but a systemic failure in `otto-cli`'s pre-flight validation logic. The agent is incapable of learning from immediate, programmatic feedback (a failing CI check).

### Lesson Update
The priority of fixing `otto-cli`'s validation logic is now elevated. The agent is actively creating corrective work and noise on the bus.

