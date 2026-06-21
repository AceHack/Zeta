---
id: 081KRA5AR0008QG0R001JKYFRJ
priority: P2
status: closed
resolved: 2026-05-29
resolved_note: "verified advisory-only: workflow/job exists and runs --enforce, but the active required-status ruleset does not require memory-index-duplicate-lint; follow-up 081KSRGFP0008QG0R001YC1WNP filed"
title: Audit memory-index-duplicate-lint.yml for advisory-vs-required parity
tier: factory-tooling
effort: XS
ask: re-decomposition of 081KQ8P5D0008QG0R002FSTGXP (2026-05-11)
created: 2026-05-11
last_updated: 2026-05-29
parent: 081KQ8P5D0008QG0R002FSTGXP
depends_on: [081KQ8P5D0008QG0R002FSTGXP]
composes_with: [081KQ8P5D0008QG0R002FSTGXP]
tags: [riven-2026-05-11, sibling-audit, advisory-enforcement, github-rulesets]
type: audit
---

# 081KRA5AR0008QG0R001JKYFRJ — Sibling audit: memory-index-duplicate-lint advisory status

Isolated atomic check for duplicate-index lint enforcement parity. Same pattern as 081KQ8P5D0008QG0R002FSTGXP.

## Result

Closed 2026-05-29 by Codex/Vera audit.

`memory-index-duplicate-lint.yml` is an active workflow and its job
does enforce duplicate-link detection when the workflow runs:

- Workflow name: `memory-index-duplicate-lint`
- Job name: `lint memory/MEMORY.md for duplicate link targets`
- Enforcement command: `bun tools/hygiene/audit-memory-index-duplicates.ts --enforce`

However, the workflow is not part of the live merge gate. The active
GitHub ruleset `CI Gate` targets the default branch and requires only:

- `build-and-test (macos-26)`
- `build-and-test (ubuntu-24.04)`
- `build-and-test (ubuntu-24.04-arm)`
- `lint (actionlint)`
- `lint (markdownlint)`
- `lint (semgrep)`
- `lint (shellcheck)`

The legacy branch-protection required-status-checks endpoint reports
`Required status checks not enabled`; live enforcement is via rulesets.

Conclusion: `memory-index-duplicate-lint` is advisory for PR merge
purposes. Its comments say the check "ensures" duplicate link targets
are not created, but that claim is only true for workflow execution, not
for merge gating. Follow-up 081KSRGFP0008QG0R001YC1WNP tracks the required decision: promote
this workflow/job into the required-status surface or weaken the claim
to state advisory coverage.
