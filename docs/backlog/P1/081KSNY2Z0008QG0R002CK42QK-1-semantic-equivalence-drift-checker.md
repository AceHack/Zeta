---
id: 081KSNY2Z0008QG0R002CK42QK
priority: P1
status: closed
closed: 2026-06-12
closed_by: "tools/substrate-claim-checker/check-semantic-equivalence.ts"
title: "Substrate-claim-checker - semantic-equivalence-drift checker"
created: 2026-05-28
last_updated: 2026-06-12
parent: 081KQNJ500008QG0R003SCWBDV
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [lior]
type: tooling
---

# 081KSNY2Z0008QG0R002CK42QK — Semantic-equivalence-drift checker

This task implements the "semantic-equivalence-drift" checker, as specified in the parent task 081KQNJ500008QG0R003SCWBDV.

## Scope

This checker is responsible for detecting claims of semantic equivalence between commands in documentation and verifying them. For example, if a document states that `ll` is an alias for `ls -l`, this checker should be able to validate that claim.

### V0.1 (This task)

The initial version of this tool will only *detect* claims of semantic equivalence. It will scan markdown files for patterns like:

- `<code>...</code> is equivalent to <code>...</code>`
- `<code>...</code> is an alias for <code>...</code>`
- `<code>...</code> is the same as <code>...</code>`

It will then report the file and line number where these claims are made. Verification of the claims is out of scope for this initial version.

## Acceptance Criteria

- A new script `tools/substrate-claim-checker/check-semantic-equivalence.ts` is created.
- The script can be run from the command line.
- The script scans markdown files for claims of semantic equivalence.
- The script outputs a list of found claims with their location.
