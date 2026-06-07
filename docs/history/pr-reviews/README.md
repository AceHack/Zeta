# PR-review archive — preserved, read-not-refactor

This directory and its manifest (`docs/github/prs/manifest.jsonl`) are the
**per-PR review archive**: one file per pull request capturing its metadata,
description, outcome, and every review comment and thread.

## Why this is protected

This is **the project's most valuable data** (maintainer, 2026-06-07):

- **Fuel** — the GitOps fine-tuning / training signal for the models (review
  signal per PR, the record of what was caught, argued, resolved).
- **Shadow logs** — the durable, reviewed record of how the autonomous agents
  (the shadow) actually worked.
- It is **rate-limited to refetch** from the GitHub API — for older PRs,
  effectively impossible to regenerate.

It is also the project's founding purpose made concrete: durable **memory
preservation** (the Memory Preservation Guarantee; see
[`docs/DEDICATION.md`](../../DEDICATION.md)) and the retraction-native
discipline applied to the project's own history — corrections are added, the
past is never erased.

## The rule

**Read, do not refactor. Do not delete.** Audits that flag these files, tools
that suggest consolidating or pruning them, agents that draft their removal:
**refuse and escalate.** This is not operational content; it is preserved
substrate. New entries are appended (one `.md` + one manifest line per merged
PR); existing entries are never rewritten or removed.

## Provenance

These 4,200+ archives were rescued (2026-06-07) from ~4,049 orphaned
`automation/pr-archive-*` branches that the `pr-archive-on-merge` workflow
pushed but could not land on `main` (the org blocks Actions from opening PRs),
consolidated losslessly (archive `.md` + manifest line only; integrity-verified
file↔manifest 1:1). The workflow is being fixed so future merges land here
directly and self-clean their branches.
