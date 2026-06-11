---
id: B-0266
zetaid: 081KR2E4K0008QG0R001VZMQBH
priority: P1
status: closed
title: "GitHub ruleset split — review policy ruleset (conversation resolution + reviews)"
created: 2026-05-08
last_updated: 2026-05-09
parent: B-0155
depends_on: [B-0265]
classification: buildable-now
decomposition: atomic
type: friction-reducer
---

# B-0266 — Review policy ruleset

Second child of B-0155. Create a dedicated ruleset for review
policy (required conversation resolution, code review settings).

## Pre-start checklist

- [x] Prior-art search: B-0265 (CI Gate, closed) followed same
  pattern — API creation + snapshot update. Commit cd9e0483.
- [x] Dependency check: B-0265 (CI Gate) is closed. No blockers.
- [x] Parent B-0155 reviewed — three-ruleset target documented in
  `docs/GITHUB-SETTINGS.md` migration matrix.

## Acceptance criteria

- New ruleset "Review Policy" created
- Conversation resolution migrated from branch protection
- Copilot code review settings preserved

## Implementation

Migration script: `tools/migrations/b0266-review-policy-ruleset.ts`

Two API operations:

1. `POST /repos/{owner}/{repo}/rulesets` — create "Review Policy"
   with `pull_request` (thread resolution, squash-only) +
   `copilot_code_review` (draft + push review)
2. `PUT /repos/{owner}/{repo}/rulesets/15256879` — update "Default"
   to keep only `deletion`, `non_fast_forward`,
   `required_linear_history`

After API calls, re-snapshot via
`bun tools/hygiene/snapshot-github-settings.ts`.

### Run

```bash
bun tools/migrations/b0266-review-policy-ruleset.ts
```

Dry run first:
```bash
bun tools/migrations/b0266-review-policy-ruleset.ts --dry-run
```
