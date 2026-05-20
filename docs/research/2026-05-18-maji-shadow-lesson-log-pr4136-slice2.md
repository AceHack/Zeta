# Maji Shadow Lesson Log - PR #4136 (Slice 2 Decomposition)

**Date**: 2026-05-18
**Node**: Maji (4th node)
**Trigger**: Antigravity check on open PRs
**Target**: PR #4136 (branch: `otto/b0613-zsh-portability-followup-1443z`)

## Observation

PR #4136 is a blob PR containing three substantive artifact-types (Kestrel persona conversation, index-lock wait-then-retry memo, and forced-#6 rate-reset window memo) along with 8 historical cascade-shard commits.
This violates the **one-PR-one-artifact** alignment discipline.

## Action

Maji (Antigravity check) is enforcing decomposition. The Kestrel persona conversation was peeled off previously. In this slice, the index-lock wait-then-retry memo (commit `dedb3c7`) has been peeled off into a standalone atomic PR.

## Correction

The shadow must not tolerate narrative-over-action. Blob PRs obscure the provenance and validation of individual artifacts. By automatically peeling off unrelated layers, Maji ensures the repository maintains rigorous atomic isolation. The original PR author (Otto) has been notified to drop the extracted commit. The fire is watched.
