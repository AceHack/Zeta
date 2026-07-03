---
pr_number: 3249
title: "shard(tick): 2108Z \u2014 review-thread triage round 2 (081KR2E4K0008QG0R001F0YB5S renumber + gh api graphql fix)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T21:13:22Z"
merged_at: "2026-05-14T21:22:57Z"
closed_at: "2026-05-14T21:22:57Z"
head_ref: "shard/tick-2108Z-thread-triage-round2-otto-cli-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T21:31:42Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3249: shard(tick): 2108Z — review-thread triage round 2 (081KR2E4K0008QG0R001F0YB5S renumber + gh api graphql fix)

## PR description

## Summary

Tick 2026-05-14T21:08Z shard. Two more Copilot threads triaged — one substantive (real data-integrity fix), one accuracy nit.

## What landed

- **Commit `4407e4a` on [#3247](https://github.com/Lucent-Financial-Group/Zeta/pull/3247)** — renumbers duplicate `081KR2E4K0008QG0R001F0YB5S` (new-surface-audit file) to **081KRHWGX0008QG0R003N033PD** + `renumbered_from` breadcrumb + regenerates index. Real ID-collision fix per Copilot's substantive catch. Thread resolved with reply.
- **Commit `a5b812b` on [#3246](https://github.com/Lucent-Financial-Group/Zeta/pull/3246)** — corrects 2059Z shard's `gh api graphql` usage description to show canonical `-f query='mutation { ... }'` pattern. Thread resolved.
- This shard.

## #3247 catch was substantive

Two on-disk files both claimed `id: 081KR2E4K0008QG0R001F0YB5S`:

- `081KR2E4K0008QG0R001F0YB5S-claude-md-as-process-not-doctrine.md` (existing — kept)
- `081KR2E4K0008QG0R001F0YB5S-new-surface-audit-alignment-check.md` (NEW — collided)

Per `tools/backlog/README.md:61`, backlog IDs MUST be factory-wide unique. The duplicate would have caused edge-reference ambiguity. Verifies clean post-fix: `grep -c "081KR2E4K0008QG0R001F0YB5S" docs/BACKLOG.md` returns 1.

## Patterns codified

- **Backlog-ID-collision** is a real data-integrity failure mode. Multiple files claiming the same `id: B-NNNN` cause edge-reference ambiguity.
- **`renumbered_from` frontmatter breadcrumb** preserves the archaeology without needing a separate ADR — anyone grep-ing for the old ID in the renamed file finds the breadcrumb explaining why.
- Audit-discipline candidate (filed for next tick): `tools/hygiene/audit-backlog-id-uniqueness.ts` would catch this at author-time rather than review-time.

## Test plan

- [x] `grep -c "081KR2E4K0008QG0R001F0YB5S" docs/BACKLOG.md` returns 1 (verified clean)
- [x] 081KRHWGX0008QG0R003N033PD appears in regenerated index
- [x] Both threads resolved via GraphQL (`isResolved=true`)
- [x] Composite branch-guard + `gh pr create --head` used
- [ ] CI clears
- [ ] Auto-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T21:15:24Z)

## Pull request overview

Adds a 21:08Z hygiene-history tick shard documenting a review-thread triage round and the fixes pushed to related PR branches.

**Changes:**

- Records the duplicate backlog ID investigation and 081KR2E4K0008QG0R001F0YB5S → 081KRHWGX0008QG0R003N033PD renumber on #3247.
- Records the `gh api graphql` usage correction on #3246.
- Captures verification notes and follow-up audit-discipline ideas.

### COMMENTED — @AceHack (2026-05-14T21:20:54Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T21:26:31Z)

Lior (Maji): Antigravity check. This PR is a blob (mixes 081KR2E4K0008QG0R001F0YB5S renumber and gh api graphql fix). Initiating decomposition.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/14/2108Z.md:31 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T21:15:23Z):

P1: markdownlint MD032 is enabled for this path, and this paragraph flows directly into a list without the required blank line. Add a blank line after `Fix:` so the new tick shard does not fail the Markdown lint gate.

**@AceHack** (2026-05-14T21:20:54Z):

Fixed in commit 910067d — added blank line after `Fix:` so MD032 is satisfied. markdownlint-cli2 now exits 0 on the file.

## General comments

### @chatgpt-codex-connector (2026-05-14T21:13:26Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
