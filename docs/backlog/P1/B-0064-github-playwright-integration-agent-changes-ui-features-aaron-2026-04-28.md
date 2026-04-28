---
id: B-0064
priority: P1
status: open
title: GitHub × Playwright integration — agent can change things in the GitHub UI + watch UI to spot new features (Aaron 2026-04-28)
tier: agent-capability-expansion
effort: M
ask: maintainer Aaron 2026-04-28 ("backlog github/playwrite integration, this is for all those things you need me to change, you should be able to change in the UI, also looking at the UI will help you understand how i see things and find new features as soon as they come out, backlog")
created: 2026-04-28
last_updated: 2026-04-28
composes_with: [B-0060, B-0061]
tags: [agent-capability, github-ui, playwright, mcp, automation, friction-reduction, feature-discovery]
---

# GitHub × Playwright integration — agent UI access

Wire the existing Playwright MCP / harness into a workflow
that lets the agent **change things in the GitHub UI**
(the things Aaron currently has to do manually) AND **watch
the UI to spot new features** as GitHub ships them.

## Why

Aaron 2026-04-28:

> *"backlog github/playwrite integration, this is for all
> those things you need me to change, you should be able to
> change in the UI, also looking at the UI will help you
> understand how i see things and find new features as soon
> as they come out, backlog"*

Two distinct payloads in that one signal:

1. **Friction reduction.** When the agent needs a setting
   changed that is only exposed via the GitHub web UI (not
   the REST/GraphQL API), Aaron currently has to click
   through it himself. Each such ask is a maintainer
   interrupt. Wiring Playwright lets the agent navigate the
   UI directly and apply the change, reducing the ask-Aaron
   tax to an audit-after pattern.
2. **Perspective + feature discovery.** Looking at the same
   UI Aaron looks at lets the agent (a) form a perspective
   that aligns with the maintainer's experience, and (b)
   notice new GitHub features as soon as they ship — before
   they are exposed via API or documented in agent-facing
   sources.

## Existing substrate this composes with

The factory already has Playwright wired in:

- The harness already exposes
  `mcp__plugin_playwright_playwright__*` tools
  (browser_navigate, browser_snapshot, browser_click,
  browser_fill_form, etc.) per the announce-deps rule
  (`feedback_announce_non_default_harness_dependencies_plugins_mcp_skills_2026_04_28.md`).
- `.playwright-mcp/` is referenced in repo state (per
  `git status` at session start) as a working directory.
- A prior task #240 ("Map email-provider signup terrain
  via Playwright") established the pattern of Playwright
  for terrain mapping.

So the integration substrate exists; this row is about
using it on the GitHub-UI surface specifically.

## Scope

### Phase 1 — read-only UI observation (S effort)

- Build a small harness `tools/playwright/github-ui/`
  with helpers for: (a) login (using the maintainer's
  active session via cookies / device-cookie pattern),
  (b) navigate to a settings page, (c) snapshot the
  page state, (d) extract structured data for review.
- Initial use cases:
  - Read repo-level settings (branch protection, code
    scanning, secret scanning) and reconcile against
    `tools/hygiene/github-settings.expected.json`.
  - Read org-level Actions-usage page to fill in the
    cost-parity audit's still-pending billing fields
    (per the cost-parity audit's Otto-65 addendum which
    used manual paste).
  - Read the maintainer's notification / settings panel
    to spot new feature toggles (e.g., a new "AI
    detection" toggle landing in a future GitHub
    release).

### Phase 2 — guarded UI mutation (M effort)

- Extend the harness with mutation helpers: click toggle,
  fill form, save changes.
- Guardrails:
  - Maintainer-pre-authorized list of UI surfaces the
    agent may mutate (start small: dependabot toggles,
    branch-protection-rule edits already authorized via
    the settings backup at `tools/hygiene/github-
    settings.expected.json`, dismissed-alert
    re-classification).
  - Mandatory before-and-after snapshot for every
    mutation, committed as part of a hygiene-history
    drain log.
  - No mutation on shared-production state without the
    visibility constraint already in
    `~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md`
    (user-scope only at this commit; in-repo migration deferred
    per the natural-home-of-memories directive)
    being satisfied (the change must show up somewhere
    the maintainer can see it).
  - Reversibility: every mutation has a documented
    inverse (e.g., toggle-X-on inverse is toggle-X-off);
    record the inverse in the drain log.

### Phase 3 — feature-discovery cadence (S effort, ongoing)

- A scheduled (weekly?) Playwright run that snapshots
  key GitHub settings pages + diffs against the
  prior snapshot, surfacing **new UI elements** as a
  signal that GitHub shipped a feature the agent should
  investigate.
- Output drops as a `docs/research/github-ui-feature-
  diff-YYYY-MM-DD.md` for the maintainer / agent to
  triage.

## Done-criteria

- [ ] Phase 1 harness lands at `tools/playwright/github-
      ui/` with at least 3 read-only use cases.
- [ ] Phase 2 lands with the guardrail enforcement
      mechanisms in code (not just discipline).
- [ ] Phase 3 scheduled job lands as a CI workflow OR
      auto-loop tick task; at least one feature-diff
      report shipped to validate the cadence.

## What this row does NOT do

- Does NOT replace API-first interaction. When the
  REST/GraphQL API exposes the setting, prefer that —
  the API is more reliable + auditable than UI scraping.
  Playwright is for UI-only surfaces.
- Does NOT bypass branch-protection / required-review.
  UI mutations applied via Playwright still go through
  the same governance as API mutations.
- Does NOT exceed the maintainer-pre-authorized
  surface list. Anything outside that list requires
  explicit authorization expansion via memory rule +
  audit trail.

## Composes with

- **B-0060** — human-lineage / external-anchor backfill;
  prior art on agentic GitHub-UI automation should be
  cited when the harness lands.
- `feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md`
  — every Playwright mutation must satisfy this
  constraint.
- `feedback_announce_non_default_harness_dependencies_plugins_mcp_skills_2026_04_28.md`
  — the Playwright MCP is a non-default harness
  dependency that needs announcement at point of use.
- Task #240 (email-provider signup terrain via
  Playwright) — same shape of capability extension.
- `tools/hygiene/github-settings.expected.json` — the
  expected-state document that Phase 1's read-only
  reconciliation reads against.
