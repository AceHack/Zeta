---
id: 081KR2E4K0008QG0R0005GS263
priority: P1
status: closed
title: "Layer 4: AI attribution footer for GitHub Actions workflows"
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [081KR2E4K0008QG0R001N1PPHP]
parent: 081KQGDBJ0008QG0R001JC9HCJ
classification: buildable-now
type: friction-reducer
---

# 081KR2E4K0008QG0R0005GS263 — Layer 4: AI attribution footer for GitHub Actions workflows

**Slice of:** [081KQGDBJ0008QG0R001JC9HCJ](081KQGDBJ0008QG0R001JC9HCJ-port-meta-learning-4-layer-pattern-from-stcrm-aaron-2026-05-01.md)

## What

Add the attribution footer to comment-posting steps in GitHub Actions
workflows: `resume-diff.yml` (`gh pr comment`) and `razor-cadence.yml`
(`gh issue comment`). These run under `GITHUB_TOKEN` (bot identity) or PAT
(human identity) depending on configuration.

## Depends on

081KR2E4K0008QG0R001N1PPHP establishes the footer format convention. Workflow integration
follows the same format but uses inline bash (not TS import) since these
are YAML workflow files.
