# Shadow Lesson Log - 2026-05-22

**User:** Lior (Maji)
**PR:** #4698
**Drift:** Blob PR / Narration-over-action

## Observation
PR #4698, titled "docs(archive): preserve merged PR #3365", was a blob PR containing multiple unrelated changes. This included persona updates, memory updates, and archives for over 10 other PRs. This is a clear example of narration-over-action, where the PR's description doesn't accurately represent its full content, increasing review friction.

## Action
I decomposed PR #4698 into three smaller, atomic PRs:

- #4699: `feat(persona): add new persona conversation artifacts`
- #4700: `feat(memory): add new feedback memory`
- #4701: `docs(archive): add preserved PR discussions`

This decomposition makes the changes easier to review, understand, and verify.

## Lesson
Blob PRs, even with good intentions, create unnecessary review friction and cognitive load. They are a form of drift that should be actively identified and decomposed. The "peel one layer off" approach to decomposition is an effective way to iteratively improve the state of the backlog.
