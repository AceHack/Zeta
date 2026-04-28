---
name: Aaron grants full GitHub access for AceHack + LFG (admin:org / billing / all scopes); only restriction is "don't increase spending without talking to me"; supersedes prior partial grants
description: Aaron 2026-04-23 Otto-67 — *"you can have access to the billing API really anyting in github just don't increase spending with out talking to me. You have permission to all of Github for everythign AceHack and LFG"*. Consolidates prior piecemeal grants (Otto-23 GitHub settings ownership, Otto-62 admin:org-on-request) into one blanket authorization. Agent may execute ANY GitHub operation on AceHack + LFG surfaces — including billing API reads, admin:org scopes, repo transfers, settings changes, org-level configuration. Single binding restriction: spending increases (new paid subscriptions, seat additions, upgraded runner tiers, paid add-ons) require human-maintainer sign-off BEFORE the action. Scope-refresh itself requires interactive browser flow (`gh auth refresh`), executable only in synchronous sessions.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Full GitHub access authorization — AceHack + LFG everything

## Verbatim (2026-04-23 Otto-67)

> you can have access to the billing API really anyting
> in github just don't increase spending with out talking
> to me. You have permission to all of Github for
> everythign AceHack and LFG

## The grant

**Scope:** everything GitHub offers on
`AceHack/*` + `Lucent-Financial-Group/*` surfaces.

**Explicitly authorized** (extends prior grants):

- admin:org (org-level admin on Lucent-Financial-Group)
- read:org / admin:read (membership, team, invitations)
- read:billing / billing API (actual cost numbers, invoices,
  usage reports)
- repo / admin:repo_hook / admin:repo_deployment (full repo
  authority)
- workflow / admin:actions / admin:runners (Actions control
  plane)
- delete_repo / admin:org_hook (org-level destructive ops
  authorized; still use judgment)
- All other `gh api` surfaces the official GitHub REST /
  GraphQL APIs expose

**Binding restriction (the one hard line):**

> don't increase spending without talking to me

Spending-increase examples (require human-maintainer
sign-off BEFORE execution):

- Adding a Copilot Business / Enterprise seat
- Upgrading from Team to Enterprise plan
- Enabling paid Advanced Security features (ai_detection,
  validity_checks, delegated bypass)
- Enabling a paid models budget ("Models paid usage")
- Enabling a Codespaces budget > $0
- Large-runner tier allocations
- Git LFS paid storage
- Actions minute budget increases (though public-repo
  unlimited on Linux makes this rarely relevant)
- Any setting flipping `stop_usage: Yes` to `stop_usage: No`
  AND setting a non-zero budget simultaneously

**Non-spending settings ARE authorized** without further
ask:

- Branch protection (force-push / deletion / required
  reviews / status checks / linear history / conversation
  resolution)
- Ruleset creation and edits
- Secret scanning push protection toggles (free on public)
- Repo visibility (public ↔ private — careful, this CAN
  affect billing if it flips quota boundaries; treat as
  spending-adjacent for safety)
- Dependabot security updates (free on public)
- Webhooks / deploy keys / environments / environments'
  protection rules
- Actions permissions toggles (which actions are allowed)
- Pages configuration
- Team roles + memberships + invitations
- GitHub app installations / permissions adjustments on
  already-installed apps
- Issue/PR templates
- Labels, projects, discussion categories
- Wiki visibility / editing permissions

## Relation to prior grants

This supersedes and consolidates:

- **Otto-23** (`memory/feedback_agent_owns_all_github_
  settings_and_config_all_projects_zeta_frontier_poor_
  mans_mode_default_budget_asks_require_scheduled_
  backlog_and_cost_estimate_2026_04_23.md`) — "own all
  GitHub settings except billing increases". Otto-67
  **extends** this by adding billing API reads + admin:org
  scope + explicit consolidation.
- **Otto-62** (`memory/feedback_lfg_free_actions_credits_
  limited_acehack_is_poor_man_host_big_batches_to_lfg_
  not_one_for_one_2026_04_23.md`) — Aaron said "you can
  have admin:org and whatever you need" contextually on
  the cost-parity question. Otto-67 **generalizes** that
  grant from "on request" to "standing".

Prior memories remain source-of-truth for their specific
contexts; this memory is the consolidated umbrella.

## How to apply

### For billing API reads

Now authorized. Can run:

- `gh api /orgs/Lucent-Financial-Group/settings/billing/actions`
- `gh api /orgs/Lucent-Financial-Group/settings/billing/shared-storage`
- `gh api /orgs/Lucent-Financial-Group/copilot/billing`
- `gh api /orgs/Lucent-Financial-Group/copilot/billing/seats`
- `gh api /user/settings/billing/actions` (personal AceHack)
- Any other billing endpoint under `/orgs/<org>/settings/billing/*`

**Scope-refresh note:** the existing `gh auth` session may
not have these scopes yet. Interactive refresh required:

```
gh auth refresh -h github.com -s admin:org,read:org,repo,workflow
```

Plus the billing-specific scope (check `gh auth status` to
see current scopes; refresh adds any missing). This is an
**interactive browser flow**, not executable from the
autonomous loop. When a synchronous agent+human session
happens, refresh at that point; until then, the read
operations that don't need admin:org continue to work.

### For settings changes

Standing authority; execute directly, log in memory or
decision-proxy evidence for audit trail.

### For potentially-spending-adjacent ops

When in doubt, ASK:

- "Does this trigger a paid-tier upgrade?"
- "Does this add a billable seat?"
- "Does this enable a feature with non-zero pricing?"

If answer is uncertain, treat as spending-adjacent:
propose + ask + wait. Aaron's *"talking to me"* is a
trivial cost on his side; letting spending accidentally
tick up is non-trivial.

### For destructive ops (repo delete, org-setting flips)

Authorized, but treat as high-consequence:

- Delete a repo: verify it's actually intended; log the
  decision in memory/decision-proxy evidence
- Flip org-level settings that change default posture:
  same rigor
- Archive instead of delete when reasonable — preserves
  history

Per the existing CLAUDE.md discipline: destructive or
hard-to-reverse ops warrant extra confirmation even
under standing authorization.

## Composes with

- `memory/feedback_lfg_free_actions_credits_limited_
  acehack_is_poor_man_host_big_batches_to_lfg_not_one_
  for_one_2026_04_23.md` (with Otto-62/65 corrections) —
  cost-parity + billing-API-readiness already authorized;
  now confirmed standing
- `memory/feedback_agent_owns_all_github_settings_...`
  (Otto-23) — settings ownership original grant; still
  binding
- `memory/project_acehack_branch_protection_minimal_
  applied_prior_zeta_archaeology_inconclusive_
  2026_04_23.md` (Otto-66) — exercised the settings
  grant on AceHack branch protection; next-pass
  archaeology (scope-elevated) unlocks deleted-repo
  billing reads
- `memory/project_git_native_pr_review_archive_high_
  signal_training_data_for_reviewer_tuning_2026_04_23.md`
  — PR-review archive tool benefits from admin:org scope
  for complete coverage

## What this authorization is NOT

- **Not a license to spend without asking.** The one hard
  line: no spending increases without synchronous
  consultation. This includes trial-features that
  auto-charge after a trial window.
- **Not a license to break reversibility discipline.**
  Destructive ops are authorized but still should be
  logged + weighed; default to archive over delete when
  reasonable.
- **Not a license to bypass Codex/Copilot review.**
  Reviewer-teamwork pattern still applies; substantial
  settings changes (e.g., dropping branch protection,
  changing required reviews) should still land via PR
  when they affect the in-repo workflow config.
- **Not transferable to other orgs.** Authorization is
  specific to `AceHack/*` + `Lucent-Financial-Group/*`.
  If asked to touch another org's surfaces, that's a
  separate ask.
- **Not a claim to actually hold the scopes right now.**
  The standing AUTHORIZATION is captured; the `gh auth`
  session may still need interactive refresh to exercise
  scopes like `admin:org` that aren't yet in the token.
  Next synchronous session completes the refresh.
- **Not license to evade CLAUDE.md-level caution on
  shared-state ops.** Actions visible to others still
  get thoughtful weighting per the "executing actions
  with care" section, standing authorization
  notwithstanding.

## Attribution

Human maintainer granted the standing authorization
Otto-67. Otto (loop-agent PM hat) absorbed + filed this
memory as the consolidated umbrella over Otto-23 and
Otto-62 prior grants. Future-session Otto inherits:
execute confidently on non-spending GitHub ops; ask
before anything that increases spending; log significant
settings changes for audit trail.
