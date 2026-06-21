---
id: 081KR2E4K0008QG0R002A0AGBJ
priority: P1
status: closed
title: "Authorized-mutation surface list — data file defining which GitHub UI surfaces the agent may mutate"
tier: agent-capability-expansion
effort: S
parent: 081KQ8P5D0008QG0R0010FP5SY
created: 2026-05-08
last_updated: 2026-05-08
depends_on: []
composes_with: [081KQ8P5D0008QG0R0010FP5SY, 081KR2E4K0008QG0R000YH9DC6]
tags: [agent-capability, github-ui, authorization, guardrails, safety]
type: friction-reducer
---

# Authorized-mutation surface list

Create `tools/playwright/github-ui/authorized-surfaces.json`
— a maintainer-curated allow-list of GitHub UI surfaces the
agent is pre-authorized to mutate via Playwright.

## Why

081KQ8P5D0008QG0R0010FP5SY Phase 2 requires guardrails. The central guardrail is
a **pre-authorized surface list** — mutations outside this
list are blocked. This data file has no code dependencies
and can land independently, enabling parallel work on
the mutation helpers (081KR2E4K0008QG0R000YH9DC6).

## Scope

- Create a JSON schema + initial data file:
  ```json
  {
    "version": 1,
    "surfaces": [
      {
        "id": "dependabot-toggles",
        "urlPattern": "github.com/<org>/<repo>/settings/security_analysis",
        "description": "Dependabot security update toggles",
        "allowedActions": ["toggle-on", "toggle-off"],
        "addedBy": "maintainer",
        "addedDate": "2026-05-08"
      }
    ]
  }
  ```
- Initial authorized surfaces (conservative start):
  1. Dependabot toggles (security_analysis page).
  2. Branch-protection-rule edits already tracked in
     `github-settings.expected.json`.
  3. Dismissed-alert re-classification.
- Include a `tools/playwright/github-ui/authorized-surfaces.schema.json`
  for validation.
- The mutation helpers (081KR2E4K0008QG0R000YH9DC6) MUST check this list
  before executing — but that enforcement lands with
  081KR2E4K0008QG0R000YH9DC6, not here.

## Done-criteria

- [x] `tools/playwright/github-ui/authorized-surfaces.json`
      exists with at least 3 entries.
- [x] JSON schema file validates the data file.
- [x] Schema `addedBy` enum restricted to `"maintainer"` — expansion
      requires maintainer to add entry + commit (enforced by schema).

## What this row does NOT do

- Does NOT implement mutation code — that is 081KR2E4K0008QG0R000YH9DC6.
- Does NOT auto-expand the list — expansion requires
  explicit maintainer authorization via commit.
