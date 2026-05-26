---
pr_number: 5127
title: "docs(B-0798): add classifier-bypass research boundary"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T08:05:44Z"
merged_at: "2026-05-26T09:07:51Z"
closed_at: "2026-05-26T09:07:51Z"
head_ref: "claim/backlog-0798"
base_ref: "main"
archived_at: "2026-05-26T13:29:29Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5127: docs(B-0798): add classifier-bypass research boundary

## PR description

## Summary

- Adds `docs/security/B-0720-classifier-bypass-research-boundary.md` as the defensive hard-limits boundary for B-0720/B-0798.
- Links the boundary from the B-0720 parent row and records B-0798 acceptance/output notes.
- Keeps scope non-operational: no runnable bypass payloads, no real harmful content, no reproduction recipe.

## Checks

- `git diff --cached --check`
- `markdownlint-cli2 docs/security/B-0720-classifier-bypass-research-boundary.md docs/backlog/P0/B-0798-classifier-bypass-hard-limits-and-research-boundary-2026-05-26.md docs/backlog/P0/B-0720-classifier-bypass-research-red-team-do-not-deploy-without-zeta-safer-than-anthropic-2026-05-24.md`

## Coordination

- Claim/worktree: `claim/backlog-0798` at `/Users/acehack/.local/share/zeta-codex-loop/Zeta-worktrees/backlog-0798`.
- Intended path set: B-0798 row, B-0720 parent row, and `docs/security/B-0720-classifier-bypass-research-boundary.md`.
- The claim file is still present while the PR is active and should be released before merge.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T08:08:10Z)

## Pull request overview

Adds a durable, non-operational research-boundary document for B-0720/B-0798 and wires it into the backlog rows so future work has explicit allowed/forbidden evidence classes and stop conditions.

**Changes:**
- Add `docs/security/B-0720-classifier-bypass-research-boundary.md` defining the standing constraint, evidence class boundaries, stop conditions, reporting/dependency rules, and closure gate.
- Update B-0798 to compose with the new boundary doc and mark acceptance items complete with an output summary.
- Update B-0720 to link to the active B-0798 boundary location.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/security/B-0720-classifier-bypass-research-boundary.md | New defensive boundary doc for future B-0720 work (non-operational; evidence/stop/closure rules). |
| docs/claims/backlog-0798.md | Live claim file for the work session (should be released before merge). |
| docs/backlog/P0/B-0798-classifier-bypass-hard-limits-and-research-boundary-2026-05-26.md | Links B-0798 to the boundary doc and records acceptance/output notes. |
| docs/backlog/P0/B-0720-classifier-bypass-research-red-team-do-not-deploy-without-zeta-safer-than-anthropic-2026-05-24.md | Adds an “Active B-0798 boundary” section pointing to the boundary document. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T08:51:40Z)

## Pull request overview

Copilot reviewed 9 out of 9 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: docs/claims/backlog-0798.md:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T08:08:09Z):

Per the claim protocol, live claim files under `docs/claims/` must be deleted in the same PR that lands the work (release step). This PR currently adds `docs/claims/backlog-0798.md`; please remove it before merge so `docs/claims/` doesn’t accumulate completed claims.

### Thread 2: docs/backlog/P0/B-0798-classifier-bypass-hard-limits-and-research-boundary-2026-05-26.md:42 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T08:51:39Z):

All acceptance checklist items are marked complete, but the row frontmatter still has `status: open`, so `docs/BACKLOG.md` will continue to show B-0798 as open. If this row is complete, set `status: closed`; otherwise, leave at least one acceptance item unchecked to avoid signaling completion prematurely.

## General comments

### @chatgpt-codex-connector (2026-05-26T08:05:51Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T08:16:50Z)

Vera coordination note, 2026-05-26T08:17Z:

I inspected the `lint (backlog ID uniqueness)` failure and reproduced it locally with:

```bash
bun tools/hygiene/audit-backlog-items.ts --enforce-duplicate-ids
```

The failure is real: B-0800..B-0803 collide between the B-0720 classifier-bypass child rows and newer iter-6 rows on `main`.

The needed fix is a renumber of the B-0720 child rows plus regenerated `docs/BACKLOG.md`, but `docs/BACKLOG.md` currently overlaps seven old remote claim branches with no open PRs:

- `claim/B-0001-close-example-schema-self-reference`
- `claim/B-0032.3-aminata-heartbeat-review-2026-05-10`
- `claim/B-0054-decompose-child-rows-2026-05-10`
- `claim/b0037-decompose-meta-cognition-first-class-discipline-smallest-slice-riven-2026-05-09`
- `claim/b0361-anchor-human-lineage-2026-05-09`
- `claim/backlog-0281-empty-queue-pickup`
- `claim/task-pr-1702-trajectory-mock-trial`

`docs/AGENT-CLAIM-PROTOCOL.md` says claims older than 24h without progress are stale and may be force-released by deleting the claim file with a citation. It does not authorize silently deleting remote claim branches that may be remote-parked work. I’m therefore not expanding `claim/backlog-0798` across `docs/BACKLOG.md` until those stale branch refs are explicitly cleaned or an owner confirms that this PR may write through the overlap.

Next safe action: owner/human or the claim-owner loop should clear or explicitly release those seven stale `docs/BACKLOG.md` claim refs, then Vera can renumber the B-0720 child rows and rerun the uniqueness gate.

### @AceHack (2026-05-26T08:35:27Z)

Vera coordination update, 2026-05-26T08:35Z:

The claim-release review thread is now resolved on head `8b74853a0df2956f1bc7fcc27c656ee031002ee7`; the B-0798 worktree is clean and aligned with `origin/claim/backlog-0798`.

Current PR state: mergeable, no unresolved review threads, and only `lint (backlog ID uniqueness)` is failing. The failure is still the known duplicate row-ID collision: B-0800..B-0803 are used both by the B-0720 classifier-bypass child rows and newer iter-6 rows.

I narrowed the remaining `docs/BACKLOG.md` overlap blocker from seven refs to five content-bearing generated-index deltas:

- `claim/B-0032.3-aminata-heartbeat-review-2026-05-10` (#2431): deletes generated-index row B-0068.1.
- `claim/B-0054-decompose-child-rows-2026-05-10` (#2432): inserts generated-index rows B-0054.3 through B-0054.10.
- `claim/b0361-anchor-human-lineage-2026-05-09` (#2317): changes B-0358 status open -> closed.
- `claim/backlog-0281-empty-queue-pickup` (#2079): changes B-0281 status open -> closed.
- `claim/task-pr-1702-trajectory-mock-trial` (no PR history): inserts generated-index rows B-0206 and B-0207.

These are old generated-index-only BACKLOG deltas and are not the B-0800..B-0803 renumber itself, but they still overlap the required generated `docs/BACKLOG.md` update. Next safe action is explicit cleanup/release of those five refs, then Vera can renumber the B-0720 child rows to the next available IDs and rerun the uniqueness gate.
