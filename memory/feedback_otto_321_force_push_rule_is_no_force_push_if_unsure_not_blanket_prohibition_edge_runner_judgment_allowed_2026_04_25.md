---
name: Otto-321 Force-push rule clarification — operational rule is "no force-push if you are unsure"; Edge runner judgment is allowed and expected when force-push is clearly the right call (rule lives in system-prompt Git Safety Protocol, NOT in CLAUDE.md per earlier mis-attribution)
description: Aaron 2026-04-25 corrected my over-strict reading of the system-prompt Git Safety Protocol "NEVER run destructive git commands (push --force, ...) unless the user explicitly requests these actions" rule — actual operational rule is "no force-push if you are unsure"; force-push is OFTEN the right call (e.g., updating one's own PR branch after rebase); Edge runner judgment is expected; default-to-no-force-push only when uncertain. Non-force-push alternative for stale-PR CI refresh: `git merge origin/main` into the PR branch (additive merge commit, no history rewrite — same operation as GitHub's "Update branch" button). Both force-push-after-rebase AND merge-main-into-branch are acceptable; choose based on context. Earlier draft incorrectly attributed the rule to CLAUDE.md and used `--merge-into-PR` as if it were a real flag — corrections per Codex + Copilot catches on PR #509.
type: feedback
---

# Otto-321 — Force-push rule is unsure-default-no, not blanket prohibition

## Verbatim quotes

Aaron 2026-04-25, after I declined force-push citing "no force-push without explicit permission":

> "'no force-push without explicit permission' the rule is no force push if you are unsure"

> "many times it's the right choice"

> "you should be able to know"

## The corrected rule

**OLD (over-strict)**: never force-push without Aaron's explicit per-event permission.

**NEW (correct)**: don't force-push when you're unsure. Use Edge runner judgment when it's clearly the right move. Default-to-no-force-push only applies to the uncertainty cases.

## When force-push IS clearly right

- Updating one's own PR branch after a rebase (refreshing against current main).
- Fixing a misnamed/misformatted commit on a topic branch nobody else has pulled.
- Squashing a noisy WIP-commit history before merging into main.
- Rewriting a recent commit message before push (or before merge).
- Refreshing CI against current required-runners by rebasing onto main.

These are STANDARD git workflow operations on topic branches. Force-push to a topic branch is not damage; it's normal.

## When force-push is clearly WRONG

- Pushing to `main` / `master` (almost always damages history visible to all collaborators).
- Pushing to a branch other contributors have pulled and are working on.
- Bypassing security-relevant commit history (e.g., overwriting a commit that fixed a vulnerability).
- Skipping hooks (--no-verify) when force-pushing.

## When uncertain (default-to-no)

- Mixed-author topic branches where collaborators may have local copies.
- Long-lived branches with established history.
- When the maintainer hasn't established a workflow norm.
- When you're not sure if anyone else has based work on the branch.

In uncertainty cases: ASK or use a non-force-push alternative.

## Non-force-push alternative for stale PRs

`git fetch origin main` then `git merge origin/main` into the PR branch creates a merge commit that brings the branch up-to-date with current main. CI runs against the merged state. No history rewrite. Same operation as GitHub's "Update branch" UI button. **Critical**: must `git fetch origin main` FIRST — `git merge origin/main` only uses the existing local ref, so a stale local `origin/main` would merge an out-of-date base. (Codex catch on PR #509 — real bug class.)

Trade-off: merge commit clutters the PR history vs rebase keeps linear history. Both are valid; choose based on team preference. For Zeta's discipline: linear-history-after-merge is preferred (squash-merge already collapses), so either approach during PR work is fine.

## Composition with prior

- **Otto-310 Edge runner peer-bond + cohort discipline** — Aaron expects me to bring judgment, not blanket-rule-following. The over-strict reading was subservient-agent posture, not Edge runner discipline.
- **Otto-300 rigor-proportional-to-blast-radius** — force-push to a topic branch with no other consumers has zero blast-radius; force-push to main has high blast-radius. Match rigor to actual impact.
- **Otto-238 retractability + glass-halo** — visible reversal of my over-strict reading goes here in the substrate trail. Future audits see I learned the correct rule.
- **Otto-313 decline-as-teaching** — when I decline an action citing a rule, the citation must reflect the ACTUAL rule, not a stricter version. Otherwise the decline teaches the wrong rule to other agents reading my reasoning.

## Operational implications

1. **For Zeta queue-drain**: rebase + force-push older PRs (whose CI is stale against current required-runners) IS a valid operation. Aaron's primary objective is queue-drain; force-push to topic branches serves that.
2. **For multi-author branches**: still default to no-force-push; ask if uncertain.
3. **For `main` / `master`**: ALWAYS NO. Never force-push. This stays absolute.
4. **For my own commits on topic branches**: judgment + Edge runner discretion.

## What this memory does NOT claim

- Does NOT authorize force-push to `main`. That's still always-NO.
- Does NOT eliminate the "no force-push when unsure" default. The Edge runner judgment is for clear-rightness cases, not uncertain-cases.
- Does NOT propose force-push as preferred-by-default. Non-force alternatives (`git merge origin/main` into the PR branch — same operation as GitHub's "Update branch" UI button) are equally valid; choose based on context.

## Key triggers for retrieval

- Force-push rule is "no if unsure," not blanket prohibition
- Edge runner judgment expected for clear-rightness cases
- Default-to-no-force-push applies to uncertainty
- Force-push to main always-NO
- Force-push to own topic branch is standard practice
- merge-main-into-branch is non-force alternative
- System-prompt Git Safety Protocol "explicit permission" wording was my over-strict reading (rule lives in system prompt's Bash tool description, NOT in CLAUDE.md / AGENTS.md / GOVERNANCE.md per Codex + Copilot xref-drift catches)
