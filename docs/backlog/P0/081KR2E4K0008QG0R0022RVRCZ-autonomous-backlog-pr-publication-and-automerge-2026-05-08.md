---
id: 081KR2E4K0008QG0R0022RVRCZ
priority: P0
status: closed
closed: 2026-05-08
closed_by: "tools/backlog/pr-publication-executor.ts — executor with push/create-pr/auto-merge sequence and 10 focused tests"
title: "Autonomous backlog pickup - PR publication and auto-merge"
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQZVQW0008QG0R000C35RNY
depends_on: [081KR2E4K0008QG0R000YTJS3Q]
classification: buildable-now
decomposition: atomic
owners: [architect, codex]
---

# 081KR2E4K0008QG0R0022RVRCZ - PR publication and auto-merge

Turn one autonomous backlog pickup into a reviewable GitHub PR
without the maintainer acting as courier or permission surface.

## Acceptance criteria

- Runs the focused checks required by the selected row.
- Commits with the Codex `Co-Authored-By` trailer.
- Pushes the claim branch.
- Opens a PR with summary, checks, and selected backlog row.
- Arms auto-merge only when the PR has no unresolved review threads
  and required checks are clean or pending.

## Progress

- 2026-05-08: First implementation slice adds
  `tools/backlog/pr-publication-plan.ts`, a deterministic PR packet
  builder for selected backlog rows, focused check summaries, and
  auto-merge eligibility. Full row remains open until the executor path
  performs the push/create/auto-merge sequence end to end.
- 2026-05-08: Second implementation slice adds the deterministic Codex
  commit command, including the required Codex co-author trailer, to the
  publication plan.
- 2026-05-08: Third implementation slice replaces the placeholder PR body
  file argument with a validated `bodyFilePath` input and adds an explicit
  `--write-body` helper that writes the generated review packet exactly once
  before `gh pr create` runs.
- 2026-05-08: Final slice adds `tools/backlog/pr-publication-executor.ts` —
  the executor that takes a PublicationPlan, writes the PR body file, pushes
  the branch, opens the PR via `gh pr create`, parses the PR URL, and arms
  auto-merge via `gh pr merge --auto --squash` when the gate allows. Command
  runner is dependency-injected for testability. 10 focused tests cover the
  full happy path, push/create-pr/auto-merge failures, auto-merge gating,
  and URL extraction.
