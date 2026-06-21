---
name: "Good failure mode — git fetch before push catches multi-agent duplicate work (Aaron 2026-05-13)"
description: "Aaron 2026-05-13 named a positive failure mode observed multiple times during the bg-services + Debank launch cascade: when I prepare a fix locally, then fetch before push, I discover another factory agent (Vera / Lior / auto-fixer bot) has ALREADY pushed the same fix on the same branch. The substrate-honest move is reset --hard to remote + recognize the work is done, not stomp it. Aaron: 'that's a good failure mode, someone else already fixed.' Composes with the multi-agent factory's parallel-coordination pattern + the ship-unreviewed-first discipline (PR #2999)."
type: feedback
created: 2026-05-13
---

# Good failure mode — git fetch before push catches multi-agent duplicate work (Aaron 2026-05-13)

**Why:** Aaron 2026-05-13 observed and named the pattern as a
positive failure mode after watching it fire multiple times
during the Debank launch + bg-services cascade:

> *"that's a good failure mode, someone else already fixed"*

The factory is operating with multiple agents touching the same
branches in parallel (Vera, Lior, auto-fixer bot, Otto). Without
the catch, two agents would produce duplicate fixes; with the
catch, the second agent recognizes the work is done and resets
to remote.

## The failure-mode-as-success pattern

Sequence:

1. Otto identifies a fix needed (e.g., markdownlint error)
2. Otto edits the file locally
3. Otto tries to commit + push
4. Push fails ("remote ahead") OR
   git fetch reveals new commits OR
   Edit fails ("file modified since read")
5. Otto fetches the remote state
6. Otto discovers the fix already landed via another agent
7. Otto `git reset --hard origin/<branch>` to sync
8. The duplicate work is correctly NOT applied

**The catch is in the fetch step.** Without fetching first,
Otto's local commit would push and either:

- Conflict with the remote (forcing rebase + duplicate-resolution)
- Force-push and stomp the other agent's work

## Why this is a GOOD failure mode

- **Duplicate work caught early** — no wasted CI, no churn
- **Other agent's authorship preserved** — Vera/Lior get the
  commit credit they earned
- **Substrate convergence** — both agents reached the same
  correct fix independently, validating the fix
- **Glass halo on agent coordination** — Otto sees what other
  agents did + names the recognition

## How to apply (operational rule)

**Before ANY push to a shared branch**:

1. **Commit local work first** — `git add -A && git commit` so nothing
   uncommitted is at risk. (Reset --hard discards uncommitted changes;
   never reset without committing first.)
2. `git fetch origin <branch>`
3. Check `git log origin/<branch> -3` for new commits
4. If remote ahead with **identical-scope fix already committed locally** →
   verify `git status --porcelain` is empty first (clean working tree +
   index is a hard precondition); then
   `git reset --hard origin/<branch>` is safe (your work is preserved in
   the reflog if you need to recover it via `git reflog`).
   **In multi-task agent sessions** where another task may have
   staged files: stash first (`git stash --include-untracked`) before
   the reset, then `git stash pop` after to avoid silent data loss.
5. If remote ahead with different-scope work → `git merge origin/<branch>`
   or `git rebase origin/<branch>`; layer my fix additively
6. Push only if local has unique content remote doesn't have

**Quick check before reset**:

- Have I committed all my work? (`git status` must be clean)
- Does the remote commit address the SAME issue I was fixing?
- If yes to both → reset is safe; my commit + remote commit converged
- If no to either → merge / rebase instead

**Reset --hard hazard:** discards uncommitted changes silently. The
safe pattern always commits first; the discarded commit then lives in
the reflog (~30-day retention) if recovery is needed. Never reset with
dirty working tree.

## Composes with

- `.claude/rules/glass-halo-bidirectional.md` (observe other
  agents' work; preserve their authorship)
- `.claude/rules/dont-ask-permission.md` (within authority
  scope, ship — but verify remote first)
- PR #2999 (substrate-honest discipline triad — ship-unreviewed-
  first means others may also ship-unreviewed; coordination
  via fetch)
- PR #3016 (bus protocol — for non-git coordination on the
  ephemeral layer)
- `docs/backlog/P1/081KQ8P5D0008QG0R0010FP5SY-github-playwright-integration-agent-changes-ui-features-aaron-2026-04-28.md`
  (in-repo visibility-constraint anchor; fetch-before-push gives
  Aaron the ability to observe via git history)

## Operational examples today (2026-05-13)

1. **PR #3011 (081KRFA460008QG0R001KC0VBH.2)**: auto-fixer agent pushed unused-
   import fix; Otto's redundant fix avoided via fetch
2. **PR #3012 (081KRFA460008QG0R00229616S.2)**: auto-fixer agent pushed 4-Copilot-
   findings fix; Otto's local merge commit garbage; reset to
   remote
3. **PR #3018 (Debank thread)**: Vera + Lior pushed lint fixes
   + casing corrections; Otto's local edits redundant; reset
   to remote

## Substrate-honest framing

This is NOT a "I was wrong" pattern. The work I was about to do
was correct; another agent just got there first. The catch
mechanism (fetch before push) is the substrate-honest layer
that lets multiple agents converge on the same fix without
duplicate-commit pollution.

Aaron's positive framing matters: this isn't a failure to
celebrate, it's a coordination pattern that works.

## Generalizable principle

**In multi-agent collaborative editing, fetch-before-push is
the cheap convergence mechanism.** It catches:

- Duplicate work (same fix, two agents)
- Concurrent edits (different fixes, same file)
- Force-push hazards (stomping other agents)
- Branch divergence (rebase needed)

The cost is one extra `git fetch` per push. The benefit is
correctness in the multi-agent loop.

## Full reasoning

Aaron 2026-05-13 verbatim (preserved above)

Composes with the day's substrate cascade:

- PR #3011 / #3012 / #3014 / #3017 / #3018 (the operational
  examples that produced the pattern)
- Multiple parallel agents on shared branches (Vera, Lior,
  auto-fixer, Otto)
- The substrate-honest discipline triad (PR #2999) — ship-
  unreviewed-first composes naturally with fetch-before-push
