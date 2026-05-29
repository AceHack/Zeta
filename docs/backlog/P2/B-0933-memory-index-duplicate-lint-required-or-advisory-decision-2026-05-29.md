---
id: B-0933
priority: P2
status: open
title: Decide whether memory-index-duplicate-lint is required or explicitly advisory
tier: factory-tooling
effort: XS
ask: follow-up from B-0088.4 audit (2026-05-29)
created: 2026-05-29
last_updated: 2026-05-29
depends_on: [B-0088.4]
composes_with: [B-0088, B-0088.4]
tags: [advisory-enforcement, github-rulesets, memory-index-duplicate-lint]
type: decision
---

# B-0933 — Decide memory-index-duplicate-lint required/advisory status

## Why

B-0088.4 verified that `.github/workflows/memory-index-duplicate-lint.yml`
is active and runs an enforcing duplicate-link audit, but the live
GitHub `CI Gate` ruleset does not require the workflow or its job name.

The workflow comments currently say the check "ensures" duplicate link
targets are not created. That wording overstates the merge-gate reality:
the check can fail on a PR without being part of the required-status
surface.

## Decision

Choose one path:

- **Promote:** add `lint memory/MEMORY.md for duplicate link targets`
  or the appropriate workflow/check context to the required-status
  ruleset.
- **Weaken:** edit the workflow comment to say the check is advisory
  unless/until the GitHub required-status surface includes it.

## Acceptance

- [ ] Durable decision recorded in this row or a linked implementation
  PR.
- [ ] If promoted, live GitHub ruleset required-status evidence is
  captured.
- [ ] If weakened, `.github/workflows/memory-index-duplicate-lint.yml`
  no longer claims merge-gate enforcement it does not have.
