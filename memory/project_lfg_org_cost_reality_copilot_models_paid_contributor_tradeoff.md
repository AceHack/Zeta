---
name: Lucent-Financial-Group org — Copilot + model costs are paid, contributor-attraction is worth the bill
description: Aaron 2026-04-21 post-transfer cost reality — "we don't have github copilot over here unless i pay and the models cost money over here too, but this is this only way we are going to get contributors." The LFG org does not inherit Aaron's personal Copilot/model entitlements; anything beyond free-tier GHA minutes is billed to the org. The contributor-visibility upside (org-owned repo, org-level rulesets, future merge queue, external-contributor story) is explicitly deemed worth the cost. Frames future tooling decisions as cost-aware.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# LFG org — cost surface after the transfer

Aaron's direct statement 2026-04-21, immediately after the
`AceHack/Zeta` -> `Lucent-Financial-Group/Zeta` org transfer
landed: *"we don't have github copilot over here unless i pay
and the models cost money over here too, but this is this
only way we are going to get contributors."*

## What the statement encodes

The old `AceHack/Zeta` user-owned repo rode on Aaron's
personal-account entitlements:

- **GitHub Copilot** (including Copilot code review attached
  via the `Default` ruleset rule 3 — "Copilot code review —
  review draft PRs + review on push") was covered by Aaron's
  personal Copilot subscription, not billed separately for
  the repo.
- **Copilot model inference** + any Copilot CLI / Copilot
  extensions that Aaron runs locally while working on Zeta
  were his personal-account spend, transparent to the repo.
- **GitHub Actions minutes** — user-owned public repos get
  unlimited-free minutes; the billing surface is the account
  tier, not per-repo.

Post-transfer, the LFG org is a separate billing entity:

- **Copilot at the org level** is a paid seat subscription.
  Without an org Copilot plan, Copilot code review cannot
  bill to LFG and will fail / skip on LFG-owned PRs. The
  `Default` ruleset's "Copilot code review" rule assumes
  Copilot is enabled for the org — until Aaron pays for at
  least one org seat, that rule is paper-only.
- **Model inference** from any LFG-org-scoped service
  (Copilot Workspace, Copilot CLI in org context, Copilot
  API usage) bills LFG.
- **GitHub Actions minutes** — public repos in orgs still
  get generous free-tier minutes. Not a concern for the
  current workflow volume.

## Why Aaron is paying anyway

*"this is the only way we are going to get contributors."*

Aaron has been clear across several rounds that contributor
attraction is a first-class factory goal:

- External contributors find org-owned repos (`Lucent-
  Financial-Group/Zeta`) more legible as "real" open source
  than user-owned repos (`AceHack/Zeta`).
- Org-level rulesets, org-level team permissions, and
  platform-gated features (merge queue in particular —
  see the HB-001 diagnosis) require org ownership.
- The LFG umbrella (see
  `project_lucent_financial_group_external_umbrella.md`) is
  the stated destination for all AceHack open-source work
  that is not explicitly AceHack-only.

The cost is accepted as the price of that positioning. Not
open for re-litigation.

## How to apply this in future decisions

- **Default to cost-aware recommendations on the LFG repo.**
  When proposing tooling that requires Copilot / Copilot API
  / model inference, surface the LFG cost implication in the
  proposal, not as a blocker — Aaron has already decided the
  contributor-attraction value dominates — but so the cost
  is visible and auditable.
- **Never enable Copilot-seat-consuming features without a
  stated rationale** linking the feature to a concrete
  contributor-visibility / review-quality outcome. A feature
  that "might be useful" is not enough justification for a
  paid seat.
- **Prefer org-free alternatives when function is equivalent.**
  If a job can be done by a free GHA-based check instead of
  a Copilot-powered one, default to the GHA check; add
  Copilot on top only when the Copilot value is material.
- **Respect the separation between LFG-org cost and
  AceHack-personal cost.** Aaron's personal fork (see
  `feedback_fork_based_pr_workflow_for_personal_copilot_usage.md`)
  is where HIS paid Copilot / models do the work;
  `Lucent-Financial-Group/Zeta` is where the results land.
  Don't propose work that collapses the two surfaces unless
  the reason is strong.
- **Track paid-feature usage.** Any time a factory change
  lights up a paid Copilot surface, note it in
  `docs/ROUND-HISTORY.md` with the cost category. If we
  ever get a "monthly LFG bill" dashboard, the round-history
  entries become the audit trail for where the charges came
  from.

## Cross-references

- `project_zeta_org_migration_to_lucent_financial_group.md`
  — the transfer itself; the reason we have two separate
  billing surfaces now.
- `project_lucent_financial_group_external_umbrella.md`
  — the LFG umbrella framing; "LFG" dual meaning.
- `feedback_fork_based_pr_workflow_for_personal_copilot_usage.md`
  (pending this session) — Aaron's proposal to fork LFG/Zeta
  to AceHack/Zeta for personal-Copilot development +
  cross-account PR submission.
- `docs/GITHUB-SETTINGS.md` §"Rulesets" rule 3 "Copilot code
  review" — the declarative-settings row that depends on an
  org Copilot seat being active.
