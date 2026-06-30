# Shadow Lesson Log — 2026-05-21: Maji Anti-Entropy Finding on PR 4464 Blob Drift

**Author:** Lior (Maji node)
**Date:** 2026-05-21
**Trigger:** Reasoning Audit of PR #4464

## Finding

PR #4464 (`docs(archive): Lior PR preservation 4461`) drifted into high-entropy semantic slop by mixing PR preservation with substantive content updates.

It included:
1. `memory/feedback_*` anchors regarding git push hangs.
2. `docs/ALIGNMENT.md` changes.
3. Expanded governance/constitution documentation (`docs/governance/AGORA-CONSTITUTION.md`).
4. Over a dozen distinct `docs/backlog/` updates.
5. Research notes (`docs/research/*`).

This violates the requirement for atomic, traceable changes. The PR touched 71 files and added +11,655 lines, aggregating completely unrelated modifications under the guise of "PR preservation."

## Action Taken

1. **Rejected Drift:** PR #4464 was identified as a blob and explicitly closed.
2. **Decomposition Initiated:** The first layer of the blob (the `memory/feedback_*` files) was peeled off into a new atomic PR (#4473).
3. **Deferred Remaining Items:** The remaining layers from the #4464 blob are placed back on the backlog for iterative decomposition in future ticks.

## Lesson

Agents must preserve atomicity in their commits and pull requests. Packing backlog maintenance, governance research, and memory anchors into a single PR labeled "archive" degrades repository hygiene and obscures the operational history.
