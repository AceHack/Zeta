---
id: B-0088
priority: P2
status: open
title: memory/MEMORY.md paired-edit lint is advisory only (not in required-status-checks); promote or remove the discoverability claim
tier: factory-tooling
effort: S
ask: autonomous-loop tick discovery 2026-04-28T20:23Z (paired-edit failures observed on PR #688/#689; both auto-merged anyway)
created: 2026-04-28
last_updated: 2026-04-28
composes_with:
  - B-0087
tags: [otto-2026-04-28, github-actions, branch-protection, advisory-vs-enforcement, factory-hygiene, memory-index-integrity]
---

# B-0088 — paired-edit lint is advisory; either promote to required or weaken its claim

## Discovery

While fixing PR #688/#689's paired-edit lint failures (each
PR added `memory/CURRENT-{aaron,amara}.md` without the
required `memory/MEMORY.md` paired touch), observed that
**both PRs merged anyway via auto-merge** despite the lint's
explicit `exit 1` failure.

PR #689 merged before I could even push the marker-bump fix.
PR #688 is still in CI (post-fix) but the lint failure on
its earlier commit didn't block the auto-merge arming —
both are arming/firing on the green-required-checks set,
not the all-checks-green set.

## The bug

Branch protection + ruleset configuration audit:

```bash
$ gh api repos/Lucent-Financial-Group/Zeta/branches/main/protection \
    --jq '.required_status_checks.contexts'
[
  "lint (semgrep)",
  "lint (shellcheck)",
  "lint (actionlint)",
  "lint (markdownlint)",
  "build-and-test (macos-26)",
  "build-and-test (ubuntu-24.04)",
  "build-and-test (ubuntu-24.04-arm)"
]

$ gh api repos/Lucent-Financial-Group/Zeta/rulesets/15256879 \
    --jq '.rules[] | select(.type=="required_status_checks")'
(empty)
```

The job `check memory/MEMORY.md paired edit` (from
`.github/workflows/memory-index-integrity.yml`) is NOT in
either required-checks list.

## Failure mode

The workflow:

1. Runs on every PR with `memory/*.md` changes.
2. Detects when memory file is touched without paired
   MEMORY.md touch.
3. Exits 1 with a clear error message including the rule
   ("Fresh sessions read MEMORY.md at cold start; a memory
   landed without a pointer is undiscoverable. See NSA-001
   in docs/hygiene-history/nsa-test-history.md for the
   canonical incident this check prevents.")
4. **Auto-merge fires anyway** because the failed check
   isn't gating.

The discoverability claim in the lint message ("memory landed
without a pointer is undiscoverable") is **functionally
false** under current configuration: memories CAN land without
pointers and merge to main without obstruction.

## What this row asks the maintainer

Two options:

**A — promote the lint to a required status check.** Add
`check memory/MEMORY.md paired edit` to the
`required_status_checks.contexts` list in branch protection
(or the ruleset). Makes the discoverability claim true.

**B — weaken the lint's message + accept advisory mode.**
If the lint is intentionally advisory (because some PRs
legitimately need to skip the pairing — e.g. CURRENT-* file
edits where MEMORY.md doesn't change semantically), then
update the lint's error message to match: "advisory check;
review whether MEMORY.md should be touched". Don't claim
discoverability protection that isn't enforced.

## Why P2 (not P0/P1)

- The discoverability gap is real but slow-growing — a
  memory file landing without an index pointer is
  recoverable later (just add the row).
- The visibility-constraint rule (Aaron 2026-04-28) limits
  autonomous branch-protection edits, so this needs
  maintainer action.
- The factory hygiene workflow at task #269 (cadenced
  counterweight-audit skill) covers detect+repair on this
  class — manual recovery is cheap.

## Counterweight-taxonomy classification

This is an **Advisory Enforcement Workflow Gap** class
instance (Amara 2026-04-28T20:24Z formal class name; covered
in `memory/feedback_advisory_enforcement_workflow_gap_amara_class_name_otto_2026_04_28.md`).

> **Definition (Amara verbatim):** A workflow claims or
> implies enforcement, but is not included in the
> required-status-checks set, so failures are observable but
> non-blocking.

The failure mode is:

- Cheap prevention layer (lint job) exists.
- Cheap prevention layer fires correctly (exit 1 on
  violation).
- BUT cheap prevention layer is not wired into the
  enforcement gate (required-status-checks).
- Result: the prevention is observable but not
  actionable.

The fix shape: every lint workflow with a clear "this
prevents incident X" claim should be either (a) a required
check OR (b) have a less-strong claim that matches its
actual gate-status.

## Sibling lints to audit

Walking `.github/workflows/` for advisory-vs-required
parity:

- `memory-index-integrity.yml` — this row's incident
- `memory-reference-existence-lint.yml` — likely same shape
- `memory-index-duplicate-lint.yml` — likely same shape
- `backlog-index-integrity.yml` — likely same shape
- `github-settings-drift.yml` — already broken (B-0087)

Each lint should be checked: is the claim it makes about
preventing X actually backed by enforcement? File
follow-up rows for any that fail the same audit.

## Acceptance criteria

- [ ] Maintainer picks A (promote to required) or B
  (weaken claim).
- [ ] If A: lint is added to `required_status_checks.contexts`
  via branch protection (or ruleset).
- [ ] If B: lint's error message updated to acknowledge
  advisory status.
- [ ] Sibling lint audit completed (memory-reference,
  memory-index-duplicate, backlog-index-integrity).

## Composes with

- B-0087 (github-settings-drift broken — same surface, same
  visibility-constraint deferral)
- `memory/feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md`
  — branch protection edits need maintainer pre-approval
- `memory/feedback_incomplete_source_set_regeneration_hazard_and_workflow_null_result_audit_amara_2026_04_28.md`
  — different class (this isn't null-result, it's
  unenforced-result), but same task #269 audit family

## Operational note for future-Otto

When a lint job fires `exit 1` with a discoverability /
correctness claim, verify the claim is enforced by checking
that the job name appears in
`required_status_checks.contexts` OR the relevant ruleset.
If not, the claim is overstated; either fix the gate or
weaken the message. Don't trust claim text — verify the
gate.
