---
name: If a check is too weak to auto-merge on, it's too weak to merge on at all — strengthen the check, not the manual gate
description: Aaron 2026-04-22 "If a check is too weak to auto-merge on, it's too weak to merge on at all — strengthen the check,  prefectly said". Factory principle confirmed. Manual-gate-as-safety is an anti-pattern; the required-check list is the contract.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
When considering whether a PR is safe to auto-merge (vs requiring
a manual human/agent click), the right question is *not* "is this
PR safe enough for auto-merge?" The right question is *"are the
required checks strong enough to be the merge contract?"*

If the answer is no, the manual-gate discipline is *papering over*
the weakness — it adds human-in-the-loop theater without actually
strengthening the guarantee, because the same weak checks are all
that gate a manual merge too.

**Aaron's quote (2026-04-22):**

> *"If a check is too weak to auto-merge on, it's too weak to
> merge on at all — strengthen the check, prefectly said"*

(Agreement with the line as-written in
`docs/research/parallel-worktree-safety-2026-04-22.md` §10.6.
Aaron's *"prefectly said"* confirms the framing.)

**Why:** the manual-merge "click" does not validate anything; it
only pauses. The validation is in the checks. Adding a human click
after weak checks creates a false sense of rigor — both because
humans often click through without inspecting, and because
automation forces the question *"what are we actually gating on?"*
in a way that a manual process never does. Auto-merge is thus a
**forcing function** for check-contract honesty.

**How to apply:**

- **Before claiming a PR "needs manual review"**, ask: *which
  specific property of the PR does a human click validate that
  the required checks don't?* If the answer is a property, that
  property is a gap in the check contract — fix the checks, then
  auto-merge safely. If the answer is "I dunno, just gut feel",
  the manual gate is theater.
- **"Strengthen the check" is broader than test coverage.** New
  checks are fair game: a required CODEOWNERS-approval check; a
  required Copilot-findings-resolved check; a required ADR-for-
  GOVERNANCE-changes check. The shape is "mechanise the validation
  the manual gate was trying to do", not "make CI slower".
- **When Copilot findings are a stated blocker but not a required
  check**, that's the exact anti-pattern. Decide: required
  (add as a check) or advisory (auto-merge past them). Half-
  gating is the worst answer.
- **When the Dependabot / submit-nuget / other advisory check is
  flaky**, not-required is the right classification — but then
  *actually treat it as advisory*. Don't block merges manually
  "just in case".

**Anti-patterns this rule kills:**

- "We should have a human eye on every PR" — without naming what
  the human eye catches that checks don't.
- "Auto-merge feels dangerous" — the danger is in the checks, not
  in the clicking.
- "Manual gate gives us one more chance to catch things" — one
  more chance to catch *what*? Name the property.

**Corollary for the factory's current state (2026-04-22):**

The six required checks are the *actual* merge contract today:
`build-and-test (ubuntu-22.04)`, `build-and-test (macos-14)`,
`lint (semgrep)`, `lint (shellcheck)`, `lint (actionlint)`,
`lint (markdownlint)`. Everything else (CodeQL, submit-nuget,
Copilot findings) is advisory. When merge queue + auto-merge
goes live (2026-04-22 PR #41), the agent convention becomes
`gh pr merge --auto --squash` and the six required checks
become the sole gate — which is the honest state they already
were under manual merging.

**Pairs with:**

- `feedback_merge_queue_structural_fix_for_parallel_pr_rebase_cost.md`
  — this rule is the reason merge queue + auto-merge is safe to
  flip.
- `feedback_fix_factory_when_blocked_post_hoc_notify.md` — the
  agent-merges-own-PR directive; this rule closes the loop by
  saying *merges via required checks, not via agent judgement*.
- `feedback_discovered_class_outlives_fix_anti_regression_detector_pair.md`
  — "strengthen the check" is the mechanism by which a discovered-
  class detector becomes a required-merge-gate.

**Scope:** `factory` — applies to any software-factory merge
policy on GitHub or equivalent. Not Zeta-specific.
