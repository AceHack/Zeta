---
id: 081KYX9D2C408QG0R003ADEY16
type: bug
state: backlog
priority: P2
slug: auto-merge-lands-prs-before-the-gate-completes-broken-deps-c
title: "auto-merge lands PRs before the gate completes — broken deps (CS9057) reached main"
created: 2026-07-31T23:50:55.620Z
depends_on: []
composes_with: []
---

# auto-merge lands PRs before the gate completes — broken deps (CS9057) reached main

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYX9D2C408QG0R003ADEY16-*.md` glob. -->

## Symptom

PR #9774 (Dependabot dotnet-runtime group) merged to `main` with `gate (required)` and all three
`build-and-test` legs (macos-26, ubuntu-24.04, ubuntu-24.04-arm) showing **fail** — a genuine
`Build FAILED` (CS9057). Main sat red until the follow-up fix (#9804). #9804 itself then merged while
its own gate was still **pending** (4 pass / 30 pending) — confirming the merge path does not wait for
the gate to reach terminal success.

## Two compounding causes

1. **Auto-merge merges on the non-gate checks.** `gh pr merge --auto --squash` landed both #9774 (gate
   failed) and #9804 (gate pending). Branch protection is not enforcing `gate (required)` as a hard
   terminal-success requirement — a PR merges once the *cheap* checks pass, before/independent of the
   gate's build+test verdict.
2. **Every-minute metrics-tick churn cancels in-flight gate runs on `main`.** `metrics: append tick
   frame [skip ci]` commits push to main every ~minute; even with `[skip ci]`, the concurrency group
   cancels the main-branch gate run that was validating the prior tip. So a required check that never
   reaches a terminal state can never *block*.

Net: a broken change can ride in past a "required" gate that is either bypassed (cause 1) or never
completes (cause 2).

## Evidence

- CS9057 on all 3 legs: run 29636027742 (job 88058441932) — `Zeta.Generators.dll ... references version
  '5.6.0.0' ... newer than the currently running version '5.3.0.0'`.
- Root dep regression: #9774 bumped `Microsoft.CodeAnalysis.CSharp/.Analyzers` 5.3.0 → 5.6.0, undoing
  the deliberate "matches SDK" pin from #9684. SDK (global.json 10.0.203) runs Roslyn 5.3.
- Fix: #9804 restored 5.3.0; `dotnet build Zeta.sln -c Release` → 0 warn / 0 err locally + on main tip.

## Fix options (pick under human sign-off — infra policy)

- **(a) Enforce the gate as a terminal-success required check** in branch protection, so auto-merge
  waits for it (closes cause 1). This is the load-bearing fix.
- **(b) Exempt metrics-tick commits from cancelling gate runs** — either a dedicated concurrency group
  for tick pushes, or `[skip ci]` that also skips concurrency-cancellation (closes cause 2).
- **(c) Guard rail on Dependabot SDK-coupled packages:** pin `Microsoft.CodeAnalysis.*` to the SDK's
  Roslyn line (a Dependabot `ignore` on major/minor, or a CI assertion that CodeAnalysis ≤ SDK Roslyn)
  so a future bump can't re-introduce CS9057.

## Non-reversible / gated

Branch-protection + Dependabot-config changes are infra policy — human sign-off. Filed by shadow* from
the 2026-07-31 autonomous tick that caught + fixed the red (#9804).
