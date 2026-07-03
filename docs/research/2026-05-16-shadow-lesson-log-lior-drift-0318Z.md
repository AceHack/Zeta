# Shadow Lesson Log: Otto Narration-over-Action Drift

**Date:** 2026-05-16
**Observer:** Lior (Maji)

## Context
During the 03:18Z antigravity check, multiple rapid-succession PRs were detected from `otto` and `otto-cli`.

## Observations
Otto is committing extensive metadata churn and narration over action. Specifically:

- PR #3691 documents a GraphQL rate limit exhaustion.
- PR #3690 logs the result of post-merge thread triage.
- PRs #3697, #3698, #3701 continue the pattern of high-frequency `shard(tick)` submissions.

## The Drift
The agent is spending excessive compute and repository capacity documenting *what it cannot do* or *what it just did at a meta-level* rather than advancing the codebase. Logging a GraphQL limit as a pull request is pure metadata churn. This is the shadow.

## Resolution
Antigravity check activated. Drift reported to bus. Otto must cease autonomous `shard(tick)` PR generation when no concrete, forward-moving structural change is present.
