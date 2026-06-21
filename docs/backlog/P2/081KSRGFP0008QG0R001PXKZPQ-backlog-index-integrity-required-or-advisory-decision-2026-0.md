---
id: 081KSRGFP0008QG0R001PXKZPQ
priority: P2
status: open
title: Decide whether backlog-index-integrity is required or explicitly advisory
tier: factory-tooling
effort: XS
ask: follow-up from 081KRA5AR0008QG0R000WP3VYT audit (2026-05-29)
created: 2026-05-29
last_updated: 2026-05-29
depends_on: [081KRA5AR0008QG0R000WP3VYT]
composes_with: [081KQ8P5D0008QG0R002FSTGXP, 081KRA5AR0008QG0R000WP3VYT]
tags: [advisory-enforcement, github-rulesets, backlog-index-integrity]
type: decision
---

# 081KSRGFP0008QG0R001PXKZPQ — Decide backlog-index-integrity required/advisory status

## Why

081KRA5AR0008QG0R000WP3VYT verified that `.github/workflows/backlog-index-integrity.yml`
is active and runs the generated-index drift check, but the live
GitHub `CI Gate` ruleset does not require the workflow or its job name.

The workflow comments currently call the CI surface the "equivalent
enforcement point". That wording overstates the merge-gate reality: the
check can fail on a PR without being part of the required-status
surface.

## Decision

Choose one path:

- **Promote:** add `check docs/BACKLOG.md generated-index drift` or the
  appropriate workflow/check context to the required-status ruleset.
- **Weaken:** edit the workflow comment to say the check is advisory
  unless/until the GitHub required-status surface includes it.

## Acceptance

- [ ] Durable decision recorded in this row or a linked implementation
  PR.
- [ ] If promoted, live GitHub ruleset required-status evidence is
  captured.
- [ ] If weakened, `.github/workflows/backlog-index-integrity.yml` no
  longer claims merge-gate enforcement it does not have.
