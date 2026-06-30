---
id: B-0746
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: GitHub auto-closes a PR on force-push to base-SHA + refuses reopen — even after head ref restored — rule-landing + empirical anchor (PR #4997 → carried over to PR #5010 on 2026-05-25 session); industry-wide trap per Aaron's ServiceTitan also-hit-it disclosure
domain: ops-tooling
ferried_by: aaron
owners: [aaron]
composes_with:
  - B-0737
related_substrate:
  - .claude/rules/github-pr-auto-closes-on-force-push-to-base-sha-refuses-reopen.md
tags: [github-trap, force-push, pr-state-machine, squash-via-force-push, gh-cli, lesson-landing, industry-wide-not-zeta-specific]
---

# B-0746 — GitHub PR auto-closes on force-push to base SHA + refuses reopen

## Carved blade

> Squashing a PR's branch via force-push must NEVER land the branch ON the base ref's SHA, even briefly. GitHub treats "head ref == base ref" as terminal (PR has no changes) and auto-closes; the `reopenPullRequest` GraphQL mutation refuses the reopen even after the head ref is restored to a diff-having SHA. Bit Zeta on 2026-05-25 session (PR #4997 → carried over to PR #5010); also bit ServiceTitan per Aaron's disclosure. Industry-wide trap. Rule lands as substrate so future-Otto + future-AI + (transitively) future human collaborators inherit the discipline.

## Origin

Aaron 2026-05-25, after I hit the trap on PR #4997:

> *"save that lesson it's not obvious even to human devs it's bit us too at ServiceTitan"*

## What this row ships in one PR

### New rule (auto-loads at cold-boot)

`.claude/rules/github-pr-auto-closes-on-force-push-to-base-sha-refuses-reopen.md` — names the trap shape + the 2 correct patterns (A: cherry-pick onto fresh branch + new PR; B: verify-HEAD-moved-before-pushing-to-existing-branch) + clarifies that `--force-with-lease` is Aaron-authorized + safe (the trap is the SPECIFIC failure mode of pushing a base SHA, not force-push itself).

### Empirical anchor preserved in rule body

The 2026-05-25 PR #4997 → #5010 trajectory:
1. PR #4997 had 7 review threads + needed squash
2. Squash worktree created on `origin/main`
3. Cumulative diff copied + index regen'd
4. `git commit` succeeded but tail-3 captured only HEREDOC close
5. `git rev-parse HEAD` returned `origin/main`'s SHA (commit had silently failed OR rev-parse misread state)
6. Pushed that SHA via `--force-with-lease` (succeeded; remote branch went to no-diff state)
7. GitHub auto-closed PR #4997
8. `gh pr reopen 4997` refused via GraphQL even after the head ref was restored
9. Recovery: fresh branch + fresh PR #5010 + cross-link close-comment on #4997

## The 2 correct patterns documented

**Pattern A (recommended)**: Cherry-pick onto fresh branch + open new PR. Avoids the trap entirely; old PR's branch is never modified.

**Pattern B**: Verify HEAD-moved-before-pushing-to-existing-branch:

```bash
HEAD_BEFORE=$(git rev-parse origin/main)
HEAD_AFTER=$(git rev-parse HEAD)
if [ "$HEAD_BEFORE" = "$HEAD_AFTER" ]; then
  echo "FATAL: commit didn't move HEAD; would push base SHA to PR branch + auto-close"
  exit 1
fi
git push origin HEAD:refs/heads/<pr-branch> --force-with-lease
```

## Composes with .claude/rules/

- `.claude/rules/zeta-expected-branch.md` — branch-state verification discipline
- `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` — sibling failure mode (commit-tree corruption shape; this row's shape is PR-state corruption)
- `.claude/rules/refresh-before-decide.md` — verify-state-before-action discipline
- `.claude/rules/blocked-green-ci-investigate-threads.md` — failure-mode investigation
- `.claude/rules/honor-those-that-came-before.md` — old PR's thread history matters; Pattern A's cross-link preserves it

## Composes with backlog substrate

- **B-0737** (zflash) — the substrate that was on PR #4997 when the trap fired; carried over to PR #5010 cleanly
- Empirical anchors in the rule body trace the full recovery

## Substrate-honest framing

This row PROPOSES the rule + empirical-anchor landing. It does NOT:

- Ban force-push (per Aaron's standing authorization for `--force-with-lease`)
- Ban squash workflows (squash is fine via Pattern A)
- Critique GitHub's design (the no-diff = no-PR semantic is reasonable in common case; trap is edge case)
- Cover all PR-state edge cases on GitHub (this is one specific trap; others may exist + would be sibling rules when surfaced)

Per `.claude/rules/no-directives.md`: rule auto-loads at cold-boot for the discipline-inheritance; operator + future-AI retain authority to apply or skip per scope.

P2 priority — industry-wide trap with empirical anchors in both Zeta + ServiceTitan; rule landing prevents future-Otto + future-AI + future-contributor from re-discovering the trap.

## Why this matters beyond Zeta

Aaron's disclosure: *"it's bit us too at ServiceTitan"* anchors this as not-Zeta-specific. Any team that:
- Uses GitHub for PRs
- Occasionally squashes branches via force-push
- Has automation that could silently fail at the commit step (e.g., agent-driven workflows; CI rebasers; auto-squash-on-merge tooling)

...is susceptible. The rule's substrate-honest framing + the 2 correct patterns make the discipline portable. If someone forks Zeta + adopts the rule library, they inherit this trap-avoidance for free.

Composes with Aaron's B-0741 fork-substrate framing: this rule is the kind of operational discipline forks adopt at cold-boot via the shared rule library — concrete value of the "any AI-native project adopts Ace conventions for free" framing.
