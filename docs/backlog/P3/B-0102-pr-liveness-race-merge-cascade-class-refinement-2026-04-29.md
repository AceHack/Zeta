---
id: B-0102
priority: P3
status: open
title: PR-liveness race during merge cascade — micro-class rename + mechanical guard + recovery-note format
tier: research-grade
effort: S
ask: Multi-AI synthesis packet 2026-04-29 (Deepseek + Amara filter on Otto's micro-class)
created: 2026-04-29
last_updated: 2026-04-29
composes_with: [B-0103]
tags: [github-platform, force-push, pr-aliveness, merge-cascade, micro-class-refinement]
---

# PR-liveness race during merge cascade — refinement

The 2026-04-29 autonomous-loop session arc surfaced a real GitHub
operational trap: PR #806 was unexpectedly auto-closed by GitHub
1 second after PR #808 merged, while #806's branch had been
freshly rebased + force-pushed. The branch still had 476 lines of
unique unmerged substrate. The original micro-class name
`force-push-triggers-pr-auto-close` overclaimed GitHub internals.

## Better naming (per Amara's filter)

```text
pr-liveness-race-during-merge-cascade
```

or empirically:

```text
force-push-during-merge-cascade can collapse PR uniqueness
```

Reason: the dangerous condition is not force-push alone — it's
`history rewrite + active base movement + GitHub PR
reachability/diff computation`. GitHub's "indirect merge"
detection (head reachable from base = auto-merge marker) can
race with mid-cascade rebases.

```text
This is an observed probabilistic race, NOT a deterministic
GitHub rule. The guard remains in force even if a future
force-push happens not to close the PR — one survival is not
evidence the race retired.
```

## Operational rule

```text
Do not rebase or force-push open tick-history PR branches
while adjacent auto-merge PRs are landing.

Branch protection "up-to-date" is a merge-readiness gate.
PR-aliveness is a separate head/base reachability and diff
invariant. Do not confuse them.
```

## Pre-flight: cascade detection (run BEFORE rebase/force-push)

```bash
# Query active auto-merge PRs on the same base branch.
gh pr list --state open \
  --json number,baseRefName,headRefName,autoMergeRequest,mergeStateStatus,title \
  --jq '.[] | select(.baseRefName == "main" and .autoMergeRequest != null)'
```

If any PRs are returned (active cascade), defer the rebase/
force-push until the cascade drains. The detection is
mechanical — Otto remembering the cascade state is exactly
the failure mode that produced this incident.

## Mechanical guard (before any force-push/rebase of an open PR)

The guard uses a per-run identifier to avoid two concurrent
ticks overwriting each other's evidence (parallel-agent
future-proofing) — Claude.ai's catch.

```bash
PR=<number>
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

gh pr view "$PR" \
  --json number,state,headRefName,headRefOid,baseRefName,baseRefOid,mergeStateStatus,autoMergeRequest,isDraft,title \
  > "/tmp/pr-$PR-$RUN_ID-before.json"
# Refresh base ref before computing uniqueness — during a merge
# cascade `origin/main` can lag the actual base by several
# seconds (Codex's catch). The captured `baseRefOid` from
# `gh pr view` is the canonical base for this PR; use it
# directly rather than `origin/main`.
git fetch --no-tags origin
BASE_BEFORE=$(jq -r '.baseRefOid' "/tmp/pr-$PR-$RUN_ID-before.json")
git log --oneline "${BASE_BEFORE}..HEAD" > "/tmp/pr-$PR-$RUN_ID-unique-commits-before.txt"
git diff --stat "${BASE_BEFORE}...HEAD" > "/tmp/pr-$PR-$RUN_ID-diff-before.txt"

# ... do the rebase / force-push ...

# Wait for GitHub's API to converge to the local HEAD before
# classifying. GitHub's PR state computation is async; querying
# immediately after a push can return stale headRefOid (Gemini's
# catch). Poll up to 30s.
LOCAL_HEAD="$(git rev-parse HEAD)"
for i in 1 2 3 4 5 6; do
  GH_HEAD="$(gh pr view "$PR" --json headRefOid --jq .headRefOid 2>/dev/null || true)"
  [ "$GH_HEAD" = "$LOCAL_HEAD" ] && break
  sleep 5
done
if [ "$GH_HEAD" != "$LOCAL_HEAD" ]; then
  echo "GitHub PR headRefOid did not converge to local HEAD after 30s; stop classification"
  exit 1
fi

gh pr view "$PR" \
  --json number,state,headRefName,headRefOid,baseRefName,baseRefOid,mergeStateStatus,autoMergeRequest,isDraft,title \
  > "/tmp/pr-$PR-$RUN_ID-after.json"
# Refresh + use the captured base again (may have advanced
# during the operation).
git fetch --no-tags origin
BASE_AFTER=$(jq -r '.baseRefOid' "/tmp/pr-$PR-$RUN_ID-after.json")
git log --oneline "${BASE_AFTER}..HEAD" > "/tmp/pr-$PR-$RUN_ID-unique-commits-after.txt"
git diff --stat "${BASE_AFTER}...HEAD" > "/tmp/pr-$PR-$RUN_ID-diff-after.txt"
```

## Enforcement after the action

```text
If PR state != OPEN:
  stop and recover with successor PR.

If unique commits == 0 and diff == empty:
  do not force-push again; classify as merged/covered/collapsed.

If unique commits or diff still exist but PR is closed:
  open successor PR and record old→new mapping.
```

## Recovery-note format (when opening a successor PR)

```text
old PR: #<num>
new PR: #<num>
branch: <name>
before head SHA: <sha>
after head SHA: <sha>
base SHA: <sha>
diff-stat proving remaining content: <output>
seconds_between_force_push_and_pr_close: <int>
whether original later became merged/covered: <yes/no/n-a>
reason reopen failed (if applicable): <message>
```

The `seconds_between_force_push_and_pr_close` field
(Claude.ai's catch) lets future incidents cluster against this
one. Sub-five-second close = almost certainly platform race;
spread across minutes = different mechanism.

## Successor-PR dedup (Deepseek's catch)

GitHub's eventual consistency means an auto-closed PR may
later be marked as merged once the comparison/diff state
settles. After opening the successor:

```text
After opening successor PR:
- re-check original PR state after GitHub settles (~60s+)
- if original later became merged/covered AND successor
  content is identical → close successor as duplicate
  (preserves attribution lineage)
- if content has diverged → keep successor and record
  why in the recovery note
- always record old→new PR mapping in a recovery-log file
  for future incident clustering
```

Otherwise the queue accumulates phantom successor PRs.

## Why P3 (research-grade, not blocking)

The trap was caught and recovered (PR #811 successor opened
within minutes). The mechanical guard would prevent future
recurrence but isn't blocking. Promote when active drain is
clear AND the same trap recurs (composition signal).

## Composes with

- B-0103 (computed-metadata-discipline) — same family of
  agent-asserted-state vs derived-truth checks.
- The auto-merge fix in PR #811 + #814 — the safer alternative
  to manual rebase + force-push during cascade.
- `memory/feedback_outdated_review_threads_block_merge_resolve_explicitly_after_force_push_2026_04_27.md`
  — sibling force-push-affects-PR rule.
