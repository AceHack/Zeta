---
id: B-0088.5
zetaid: 081KRA5AR0008QG0R000WP3VYT
priority: P2
status: closed
resolved: 2026-05-29
resolved_note: "verified advisory-only: workflow/job exists and runs the generated-index drift check, but the active required-status ruleset does not require backlog-index-integrity; follow-up B-0934 filed"
title: Audit backlog-index-integrity.yml for advisory-vs-required parity (B-0088 sibling)
tier: factory-tooling
effort: XS
ask: re-decomposition of B-0088 (2026-05-11)
created: 2026-05-11
last_updated: 2026-05-29
parent: B-0088
depends_on: [B-0088]
composes_with: [B-0088]
tags: [riven-2026-05-11, sibling-audit, backlog-index, advisory-enforcement, github-rulesets]
type: audit
---

# B-0088.5 — Sibling audit: backlog-index-integrity.yml

Atomic isolated verification of whether the backlog index lint job is required or advisory only. Completes the B-0088 sibling set.

## Result

Closed 2026-05-29 by Codex/Vera audit.

`backlog-index-integrity.yml` is an active workflow and its job verifies
generated-index drift when the workflow runs:

- Workflow name: `backlog-index-integrity`
- Job name: `check docs/BACKLOG.md generated-index drift`
- Enforcement command: `bun tools/backlog/generate-index.ts --check`

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

Conclusion: `backlog-index-integrity` is advisory for PR merge purposes.
Its workflow comments say the CI surface is the "equivalent enforcement
point", but that claim is only true for workflow execution, not for
merge gating. Follow-up B-0934 tracks the required decision: promote
this workflow/job into the required-status surface or weaken the claim
to state advisory coverage.
