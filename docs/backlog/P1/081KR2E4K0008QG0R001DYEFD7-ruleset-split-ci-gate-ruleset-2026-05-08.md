---
id: 081KR2E4K0008QG0R001DYEFD7
priority: P1
status: closed
closed: 2026-05-08
closed_by: "Ruleset 'CI Gate' (id 16134995) created; 7 status checks migrated from legacy branch protection; snapshot updated"
title: "GitHub ruleset split — CI gate ruleset (required status checks)"
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQGDBJ0008QG0R0028YTDQ2
depends_on: []
classification: buildable-now
decomposition: atomic
---

# 081KR2E4K0008QG0R001DYEFD7 — CI gate ruleset

First child of 081KQGDBJ0008QG0R0028YTDQ2. Create a dedicated ruleset for required
status checks (the 7 CI contexts currently in legacy branch
protection). Move from legacy branch protection to ruleset.

## Acceptance criteria

- [x] New ruleset "CI Gate" created via `gh api`
- [x] 7 required status checks migrated from branch protection
- [x] Legacy branch protection status checks removed
- [x] Drift detector snapshot updated

## Implementation (2026-05-08)

Created ruleset "CI Gate" (id: 16134995, enforcement: active)
targeting `~DEFAULT_BRANCH` with 7 required status checks:

| Context | Integration ID |
|---|---|
| build-and-test (macos-26) | 15368 |
| build-and-test (ubuntu-24.04) | 15368 |
| build-and-test (ubuntu-24.04-arm) | 15368 |
| lint (actionlint) | 15368 |
| lint (markdownlint) | 15368 |
| lint (semgrep) | 15368 |
| lint (shellcheck) | 15368 |

Removed `required_status_checks` from legacy branch protection
via `DELETE /repos/{owner}/{repo}/branches/main/protection/required_status_checks`.

Updated `tools/hygiene/github-settings.expected.json` to reflect
the new ruleset and null status checks in legacy protection.
