---
name: Advisory Enforcement Workflow Gap — class name + decision-fork (Amara naming, Otto incident, 2026-04-28)
description: Amara 2026-04-28T20:24Z named the class after Otto observed paired-edit lint failures merging through on PR #688/#689. Definition — workflow claims/implies enforcement but is not in required-status-checks set; failures are observable but non-blocking. Decision fork — promote to required check OR downgrade enforcement claim to advisory. Risk — factory believes rule is enforced when it's only logged. Worked example: memory-index-integrity.yml lint claims "memory landed without a pointer is undiscoverable" but PRs #688/#689 both failed the lint and auto-merged anyway.
type: feedback
---

# Advisory Enforcement Workflow Gap

## Class name (Amara 2026-04-28T20:24Z)

**Advisory Enforcement Workflow Gap** — Amara formalized the
class after Otto observed paired-edit lint failures merging
through on PR #688/#689 despite the lint's `exit 1` and the
explicit "this prevents incident X" claim in its error
message.

## Definition (Amara verbatim)

> A workflow claims or implies enforcement, but is not included
> in the required-status-checks set, so failures are observable
> but non-blocking.

## Concrete incident (Otto 2026-04-28T20:23Z)

- Workflow: `.github/workflows/memory-index-integrity.yml`,
  job `check memory/MEMORY.md paired edit`.
- Claim in error message: *"Fresh sessions read MEMORY.md at
  cold start; a memory landed without a pointer is
  undiscoverable. See NSA-001 in
  docs/hygiene-history/nsa-test-history.md for the canonical
  incident this check prevents."*
- Reality: NOT in `required_status_checks.contexts` of branch
  protection AND not in any ruleset's required-checks list.
  Verified via `gh api repos/.../branches/main/protection
  --jq '.required_status_checks.contexts'`.
- Observed: PR #688 + #689 both failed the lint, both
  auto-merged anyway.
- Filed as: B-0088.

## Risk (Amara framing)

> The factory believes a rule is enforced when it is only
> logged.

A workflow that fires `exit 1` with a clear discoverability /
correctness claim looks like enforcement to anyone reading the
code. Discovering it isn't is a failure mode that compounds:
each "enforced" rule that's actually advisory adds a hidden
gap between the documented contract and the actual
enforcement.

## Decision fork (the control)

When you find an Advisory Enforcement Workflow Gap, pick one:

**Option A — promote to required status check.**

```bash
# Add the lint job's check name to required-status-checks
gh api repos/<OWNER>/<REPO>/branches/main/protection \
  --method PATCH \
  --input <(gh api repos/<OWNER>/<REPO>/branches/main/protection \
    | jq '.required_status_checks.contexts += ["check memory/MEMORY.md paired edit"]')
```

(Or update via ruleset API if the repo uses rulesets.)

This makes the discoverability / correctness claim TRUE.
Failures now block merge.

**Option B — downgrade the claim to advisory visibility.**

If the lint is intentionally advisory (because some PRs
legitimately need to skip the rule — e.g. CURRENT-* file
edits where MEMORY.md doesn't change semantically), update
the lint's error message to match:

```text
ADVISORY: this check is informational only; review whether
MEMORY.md should be touched. Merge gating does NOT depend on
this check.
```

Don't claim enforcement that isn't enforced.

## Why both options are valid

The factory may legitimately want some lints advisory:

- **Always-required (option A)**: lints that catch real
  correctness bugs (broken-cross-references, schema
  violations, syntax errors).
- **Advisory (option B)**: lints that catch *style* or
  *convention* drift where the maintainer wants signal but
  not gate (e.g. "consider adding pointer entry"; "you
  might want to update CURRENT-aaron.md too").

The ANTI-PATTERN is claiming enforcement while running
advisory.

## How to audit for this class

Walk every workflow in `.github/workflows/`:

1. Read the workflow's failure message / claim text.
2. Identify the check job's name (the YAML `jobs.<id>.name`
   field).
3. Query `gh api repos/.../branches/main/protection
   --jq '.required_status_checks.contexts'` and the same
   for any rulesets.
4. For each check that **claims** enforcement: is its name in
   the required list?
5. For each check that's NOT in the required list: does its
   message claim enforcement?
6. Mismatch = Advisory Enforcement Workflow Gap.

This audit fits as a tier-2 cadenced-counterweight check
(task #269), running monthly or on substantive workflow
changes.

## The dangerous middle state (Amara's framing)

> A guardrail that looks like enforcement but behaves like
> telemetry.

This is the middle state between "enforced rule" and
"advisory hint". From the outside, the factory looks
defended; in fact, the rule is bypassable. Worse than
explicit advisory mode: explicit advisory is honest;
implicit advisory pretends.

## Sibling lints to audit (Otto 2026-04-28)

In Zeta's `.github/workflows/`, candidates for the same audit:

- `memory-index-integrity.yml` (this incident)
- `memory-reference-existence-lint.yml` (likely same shape)
- `memory-index-duplicate-lint.yml` (likely same shape)
- `backlog-index-integrity.yml` (likely same shape)
- `github-settings-drift.yml` (already broken — B-0087;
  separate failure mode, "workflow startup error", but also
  not in required list either way)

Each should be audited per the procedure above.

## Composes with

- B-0088 (the concrete-instance backlog row this class names)
- B-0087 (github-settings-drift — different failure mode but
  same audit family)
- `memory/feedback_incomplete_source_set_regeneration_hazard_and_workflow_null_result_audit_amara_2026_04_28.md`
  — Workflow Null-Result Audit + Scheduled Workflow
  Null-Result Hygiene Scan classes; this is a sibling
  audit class (different failure shape: "fires but doesn't
  enforce" vs "exists but doesn't fire")
- `memory/feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md`
  — branch-protection edits need maintainer pre-approval;
  this audit produces backlog rows, not autonomous fixes
- Task #269 — cadenced-counterweight-audit skill should
  add this audit to its tier-2 catalogue

## What this is NOT

- **NOT a directive to promote every advisory lint.** Some
  lints are intentionally advisory; the discipline is
  message-truth, not always-required.
- **NOT a license to skip audits.** Even on advisory lints,
  the failure mode of failing-without-noticing is real;
  reviewers should still address advisory failures.
- **NOT specific to GitHub Actions.** The same gap exists in
  any CI system (GitLab CI rules with `allow_failure: true`,
  Jenkins post-build steps that report but don't fail the
  build, etc.).

## Pickup notes for future-Otto

When you write a new lint workflow:

1. Decide explicitly: required or advisory?
2. If required: add the check name to
   `required_status_checks.contexts` in the same PR.
3. If advisory: write the failure message in advisory tone
   ("review whether...", "consider whether...", not
   "this prevents incident X").
4. Don't lie about which kind it is.

When you encounter a failing lint that's not in the required
list:

1. Don't assume the failure will block.
2. If you see the check fail and the PR auto-merge anyway,
   that's the gap; file an Advisory Enforcement Workflow Gap
   row.
