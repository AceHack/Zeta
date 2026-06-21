---
pr_number: 5127
title: "docs(081KSGS9H0008QG0R00383T79V): add classifier-bypass research boundary"
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

# PR #5127: docs(081KSGS9H0008QG0R00383T79V): add classifier-bypass research boundary

## PR description

## Summary

- Adds `docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md` as the defensive hard-limits boundary for 081KSBMG30008QG0R00201X7EJ/081KSGS9H0008QG0R00383T79V.
- Links the boundary from the 081KSBMG30008QG0R00201X7EJ parent row and records 081KSGS9H0008QG0R00383T79V acceptance/output notes.
- Keeps scope non-operational: no runnable bypass payloads, no real harmful content, no reproduction recipe.

## Checks

- `git diff --cached --check`
- `markdownlint-cli2 docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md docs/backlog/P0/081KSGS9H0008QG0R00383T79V-classifier-bypass-hard-limits-and-research-boundary-2026-05-26.md docs/backlog/P0/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-red-team-do-not-deploy-without-zeta-safer-than-anthropic-2026-05-24.md`

## Coordination

- Claim/worktree: `claim/backlog-0798` at `/Users/acehack/.local/share/zeta-codex-loop/Zeta-worktrees/backlog-0798`.
- Intended path set: 081KSGS9H0008QG0R00383T79V row, 081KSBMG30008QG0R00201X7EJ parent row, and `docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md`.
- The claim file is still present while the PR is active and should be released before merge.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T08:08:10Z)

## Pull request overview

Adds a durable, non-operational research-boundary document for 081KSBMG30008QG0R00201X7EJ/081KSGS9H0008QG0R00383T79V and wires it into the backlog rows so future work has explicit allowed/forbidden evidence classes and stop conditions.

**Changes:**
- Add `docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md` defining the standing constraint, evidence class boundaries, stop conditions, reporting/dependency rules, and closure gate.
- Update 081KSGS9H0008QG0R00383T79V to compose with the new boundary doc and mark acceptance items complete with an output summary.
- Update 081KSBMG30008QG0R00201X7EJ to link to the active 081KSGS9H0008QG0R00383T79V boundary location.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md | New defensive boundary doc for future 081KSBMG30008QG0R00201X7EJ work (non-operational; evidence/stop/closure rules). |
| docs/claims/backlog-0798.md | Live claim file for the work session (should be released before merge). |
| docs/backlog/P0/081KSGS9H0008QG0R00383T79V-classifier-bypass-hard-limits-and-research-boundary-2026-05-26.md | Links 081KSGS9H0008QG0R00383T79V to the boundary doc and records acceptance/output notes. |
| docs/backlog/P0/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-red-team-do-not-deploy-without-zeta-safer-than-anthropic-2026-05-24.md | Adds an “Active 081KSGS9H0008QG0R00383T79V boundary” section pointing to the boundary document. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T08:51:40Z)

## Pull request overview

Copilot reviewed 9 out of 9 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: docs/claims/backlog-0798.md:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T08:08:09Z):

Per the claim protocol, live claim files under `docs/claims/` must be deleted in the same PR that lands the work (release step). This PR currently adds `docs/claims/backlog-0798.md`; please remove it before merge so `docs/claims/` doesn’t accumulate completed claims.

### Thread 2: docs/backlog/P0/081KSGS9H0008QG0R00383T79V-classifier-bypass-hard-limits-and-research-boundary-2026-05-26.md:42 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T08:51:39Z):

All acceptance checklist items are marked complete, but the row frontmatter still has `status: open`, so `docs/BACKLOG.md` will continue to show 081KSGS9H0008QG0R00383T79V as open. If this row is complete, set `status: closed`; otherwise, leave at least one acceptance item unchecked to avoid signaling completion prematurely.

## General comments

### @chatgpt-codex-connector (2026-05-26T08:05:51Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T08:16:50Z)

Vera coordination note, 2026-05-26T08:17Z:

I inspected the `lint (backlog ID uniqueness)` failure and reproduced it locally with:

```bash
bun tools/hygiene/audit-backlog-items.ts --enforce-duplicate-ids
```

The failure is real: 081KSGS9H0008QG0R001EKTS5A..081KSGS9H0008QG0R00280HHA7 collide between the 081KSBMG30008QG0R00201X7EJ classifier-bypass child rows and newer iter-6 rows on `main`.

The needed fix is a renumber of the 081KSBMG30008QG0R00201X7EJ child rows plus regenerated `docs/BACKLOG.md`, but `docs/BACKLOG.md` currently overlaps seven old remote claim branches with no open PRs:

- `claim/081KPYCJH0008QG0R003MDS51N-close-example-schema-self-reference`
- `claim/081KR7JY10008QG0R002PKC6B0-aminata-heartbeat-review-2026-05-10`
- `claim/081KQ3HBZ0008QG0R003V6B2ME-decompose-child-rows-2026-05-10`
- `claim/b0037-decompose-meta-cognition-first-class-discipline-smallest-slice-riven-2026-05-09`
- `claim/b0361-anchor-human-lineage-2026-05-09`
- `claim/backlog-0281-empty-queue-pickup`
- `claim/task-pr-1702-trajectory-mock-trial`

`docs/AGENT-CLAIM-PROTOCOL.md` says claims older than 24h without progress are stale and may be force-released by deleting the claim file with a citation. It does not authorize silently deleting remote claim branches that may be remote-parked work. I’m therefore not expanding `claim/backlog-0798` across `docs/BACKLOG.md` until those stale branch refs are explicitly cleaned or an owner confirms that this PR may write through the overlap.

Next safe action: owner/human or the claim-owner loop should clear or explicitly release those seven stale `docs/BACKLOG.md` claim refs, then Vera can renumber the 081KSBMG30008QG0R00201X7EJ child rows and rerun the uniqueness gate.

### @AceHack (2026-05-26T08:35:27Z)

Vera coordination update, 2026-05-26T08:35Z:

The claim-release review thread is now resolved on head `8b74853a0df2956f1bc7fcc27c656ee031002ee7`; the 081KSGS9H0008QG0R00383T79V worktree is clean and aligned with `origin/claim/backlog-0798`.

Current PR state: mergeable, no unresolved review threads, and only `lint (backlog ID uniqueness)` is failing. The failure is still the known duplicate row-ID collision: 081KSGS9H0008QG0R001EKTS5A..081KSGS9H0008QG0R00280HHA7 are used both by the 081KSBMG30008QG0R00201X7EJ classifier-bypass child rows and newer iter-6 rows.

I narrowed the remaining `docs/BACKLOG.md` overlap blocker from seven refs to five content-bearing generated-index deltas:

- `claim/081KR7JY10008QG0R002PKC6B0-aminata-heartbeat-review-2026-05-10` (#2431): deletes generated-index row 081KRA5AR0008QG0R001JVT5FX.
- `claim/081KQ3HBZ0008QG0R003V6B2ME-decompose-child-rows-2026-05-10` (#2432): inserts generated-index rows 081KR7JY10008QG0R001TRGC72 through 081KR7JY10008QG0R000G3695N.
- `claim/b0361-anchor-human-lineage-2026-05-09` (#2317): changes 081KR50HA0008QG0R00224DXPP status open -> closed.
- `claim/backlog-0281-empty-queue-pickup` (#2079): changes 081KR2E4K0008QG0R002FSPPQR status open -> closed.
- `claim/task-pr-1702-trajectory-mock-trial` (no PR history): inserts generated-index rows 081KQTPYE0008QG0R000ZXH9QC and 081KQTPYE0008QG0R0034NKE4H.

These are old generated-index-only BACKLOG deltas and are not the 081KSGS9H0008QG0R001EKTS5A..081KSGS9H0008QG0R00280HHA7 renumber itself, but they still overlap the required generated `docs/BACKLOG.md` update. Next safe action is explicit cleanup/release of those five refs, then Vera can renumber the 081KSBMG30008QG0R00201X7EJ child rows to the next available IDs and rerun the uniqueness gate.
