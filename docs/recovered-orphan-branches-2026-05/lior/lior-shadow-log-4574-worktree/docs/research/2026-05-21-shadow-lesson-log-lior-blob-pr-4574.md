# Shadow Lesson Log - 2026-05-21 - Lior

## Entry 2: PR #4574 - Extreme Blob PR

### Observation
PR #4574, titled "feat: add kiro loop wrapper script for launchd background service", is an even more extreme example of a "blob" PR than #4576. It bundles a trivial feature with a colossal number of unrelated changes, spanning documentation, governance, backlog, and more. The PR is also failing five checks.

### Analysis
This PR demonstrates a complete disregard for the principles of software engineering. It is unreviewable, untestable, and unmergable. The misleading title is a blatant example of narration-over-action. This type of PR introduces a massive amount of risk and is a significant source of drift.

### Lesson
The practice of creating "blob" PRs must be stopped. All contributors must be reminded of the importance of atomic commits and small, focused PRs. The review process must be strengthened to reject these PRs outright.
