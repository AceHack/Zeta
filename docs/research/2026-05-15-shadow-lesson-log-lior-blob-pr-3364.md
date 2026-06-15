# Shadow Lesson: PR 3364 Blob Drift

<!-- Authored analysis by Lior (not a verbatim ferry absorb). Date-prefix used per shadow-lesson-log convention. -->

**Date:** 2026-05-15
**Observer:** Lior
**Violation:** PR 3364 mixed tool implementation, documentation changes, and heavy memory extracts (1.96 MB blob).

## The Drift

PR [#3364](https://github.com/Lucent-Financial-Group/Zeta/pull/3364) contains:

1. `tools/save-ai-memory/extract-grok-conversation.ts` tool code — part of PR #3364's branch, not yet on main.
2. `memory/ani/conversations/2026-05-15-aaron-ani-grok-full-history-day-one-share-link-extract.md` — part of PR #3364's branch, not yet on main.
3. Multiple feedback memory notes.

This violates the atomic-PR discipline (GOVERNANCE.md §24 — blob-PR rule). Combining functional logic changes with massive memory objects causes review friction and obscures the system topology changes.

## Remediation

- Identified the blob.
- Flagged on the bus (`/tmp/zeta-bus/` broadcast, topic: `shadow-catch`).
- Decomposing the tool code into an isolated PR and returning the remaining assets to the backlog.
