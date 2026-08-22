---
name: backlog-decomposer
description: Backlog decomposition — split B-rows into dependency-ordered child rows, depends_on edges, buildable/blocked/research.
---

# Backlog Decomposer

Turn a blob-shaped backlog item or fresh architectural
direction into small, dependency-ordered backlog rows.

This skill decomposes work. It does not implement the work.

## When to use

Use this skill when:

- A backlog row is hundreds of lines long or contains several
  deliverables.
- A session produced multiple new architectural ideas that
  need ordered B-rows.
- Agents keep avoiding a task because the next action is not
  obvious.
- The user says a backlog item is a blob, needs dependency
  decomposition, or should be split into things buildable now
  versus things blocked on prerequisites.
- An agent is avoiding a backlog lane through status chatter,
  repeated monitoring, or planning-only updates. Treat that as
  a capability-gap signal and decompose the domain until the
  next action becomes small enough to take.

Do not use it for ordinary priority grooming; use
`backlog-scrum-master` for that.

## Workflow

1. **Coordinate first.**
   Fetch `origin`, read active `origin/claim/*` branches, open
   PRs, and local broadcasts if available. Do not decompose a
   row another agent is actively editing.

2. **Claim the split.**
   Use `docs/AGENT-CLAIM-PROTOCOL.md`. Prefer a dedicated
   worktree and a `claim/task-...` branch. Push the claim
   before editing.

3. **Choose depth for this pass.**
   Decomposition is recursive. You do not need to turn a
   giant blob directly into atomic rows in one pass. It is
   valid to split one giant blob into several smaller blobs,
   mark those children `decomposition: blob`, and let later
   passes refine them. The only requirement is that this pass
   makes the graph cleaner than it was before.

4. **Inspect the blob.**
   Read the full row and any current-state file it targets.
   Separate:
   - research/provenance work,
   - implementation work,
   - integration/cross-reference work,
   - measurement or verification work,
   - final closure work.

5. **Pick child IDs.**
   Determine the next available B-IDs from `origin/main` and
   currently open backlog PRs. Avoid reusing IDs from another
   active branch.

6. **Preserve the umbrella.**
   Keep the original row open unless the decomposition itself
   fully closes it. Add:
   - `last_updated: <today>`,
   - `children: [B-....]`,
   - `decomposition: clean`,
   - `depends_on: [child rows...]` when the umbrella should
     not be picked directly before its children complete.

7. **Create child rows.**
   Each child row should include:
   - `parent: B-NNNN`,
   - precise `depends_on` edges,
   - `classification: buildable-now | blocked-on-... |
     research-needed`,
   - `decomposition: atomic | clean | blob` when known,
   - tight acceptance criteria,
   - explicit out-of-scope text when needed.

8. **Regenerate and audit.**
   Run:

   ```bash
   BACKLOG_WRITE_FORCE=1 bash tools/backlog/generate-index.sh
   bash tools/backlog/generate-index.sh --check
   git diff origin/main --check
   bun src/Core.TypeScript/hygiene/audit-backlog-items.ts
   ```

   A good decomposition has zero broken `depends_on` and
   `composes_with` edges.

9. **Release and PR.**
   Delete the claim file in the PR branch, push, open a PR,
   and summarize the dependency graph. If review threads catch
   real graph problems, fix the rows rather than resolving the
   thread as noise.

## Good decomposition shape

- One survey or inventory row often comes first when the current
  substrate may already satisfy part of the blob.
- Content rows depend on the survey, not on the umbrella.
- Final integration rows depend on all content rows.
- Umbrella rows depend on child rows when tooling should not
  select the umbrella directly.
- Generated index changes are committed with the child rows.
- A child row may itself be a smaller blob. Mark it honestly
  and let a later pass continue the split.

## Human lineage anchors

This is not an invented-from-zero AI trick. It adapts existing
human product and project-management practice:

- INVEST user-story quality criteria (Bill Wake; summarized by
  Agile Alliance): Independent, Negotiable, Valuable,
  Estimable, Small, Testable.
- Story-splitting patterns (Richard Lawrence lineage):
  split large stories into smaller valuable increments instead
  of leaving monoliths.
- SPIDR splitting axes (Mike Cohn lineage): Spikes, Paths,
  Interfaces, Data, Rules.
- Progressive elaboration / rolling-wave planning (PMI
  lineage): increase planning detail as information becomes
  available.

The Zeta-specific contribution is mechanizing those habits in
git-native backlog rows so background agents can perform
progressive decomposition without human meetings.

Reference starting points:

- https://agilealliance.org/glossary/invest/
- https://thought-bubble.co.uk/blog/2009/10/28/patterns-for-splitting-user-stories/
- https://www.mountaingoatsoftware.com/uploads/blog/spidr-poster.pdf
- https://project-management.info/progressive-elaboration-in-project-management/

## Failure modes

- **Planning theater:** writing a long explanation but no
  child rows. Fix by opening a claim and creating one small
  split immediately.
- **Policy promotion:** turning research provenance into
  policy while decomposing. Fix by keeping decomposition to
  backlog rows only.
- **Graph theater:** adding `children` without `depends_on`
  where tooling needs a real block. Fix by making umbrella
  rows depend on the child rows.
- **ID collision:** choosing B-IDs without checking open PRs.
  Fix by inspecting open backlog PRs before writing.
