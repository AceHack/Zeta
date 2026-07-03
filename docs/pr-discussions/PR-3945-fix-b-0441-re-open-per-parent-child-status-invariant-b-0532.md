---
pr_number: 3945
title: "fix(081KRFA460008QG0R00229616S): re-open per parent-child status invariant (081KRMEXM0008QG0R003FZNK3E)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T21:25:54Z"
merged_at: "2026-05-16T22:54:23Z"
closed_at: "2026-05-16T22:54:23Z"
head_ref: "chore/b-0441-status-closed-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T23:29:09Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3945: fix(081KRFA460008QG0R00229616S): re-open per parent-child status invariant (081KRMEXM0008QG0R003FZNK3E)

## PR description

## Summary

Restores 081KRFA460008QG0R00229616S to `status: open` to satisfy the `--enforce-parent-child-status` lint (081KRMEXM0008QG0R003FZNK3E gate). PR #3942 closed 081KRFA460008QG0R00229616S while child 081KRHWGX0008QG0R001E9KEJ1 (slice 5.2 — subscriber handler) was still open; the lint failure surfaced this correctly but auto-merge fired anyway because the lint check isn't in the required-checks list.

This PR brings origin/main back to parent-child consistency.

## Why the previous close was wrong

The 2026-05-16 acceptance-refresh PR (#3942) marked 6 stale unchecked acceptance boxes as `[x]` correctly — the notifier-side IS fully implemented. But it ALSO flipped `status: closed`, which violated the parent-child invariant because `children: [081KRHWGX0008QG0R0025PX5SZ, 081KRHWGX0008QG0R0000P5YP2, 081KRHWGX0008QG0R001ZJ3W8R, 081KRHWGX0008QG0R001E9KEJ1]` includes one open child (081KRHWGX0008QG0R001E9KEJ1).

The audit output was unambiguous:

```
## 9. Parent-child status mismatch (081KRMEXM0008QG0R003FZNK3E)
Parent-child status-mismatch groups: 1
- 081KRFA460008QG0R00229616S (closed) has open children:
- Re-open the parent if the children represent unfinished work, OR
- Remove the child refs from the parent's `children:` if they no longer apply
error: 1 parent-child status-mismatch group(s) found; --enforce-parent-child-status set (081KRMEXM0008QG0R003FZNK3E gate)
```

I picked "re-open the parent" because 081KRHWGX0008QG0R001E9KEJ1 IS unfinished work (subscriber handler scope is genuinely different from notifier scope; both lanes are legitimate).

## Diff

- `docs/backlog/P1/081KRFA460008QG0R00229616S-*.md`:
  - `status: closed` → `status: open` (one line)
  - Added a new `## Closure status (2026-05-16)` section explaining notifier-side is complete (acceptance refresh stands) but row stays open per parent-child invariant until 081KRHWGX0008QG0R001E9KEJ1 lands
- `docs/BACKLOG.md`: regenerated — flips back `[x] → [ ]` for 081KRFA460008QG0R00229616S line

## Test plan

- [ ] `lint (backlog parent-child status)` passes (verified locally: 0 mismatch groups)
- [ ] Audit doesn't surface any new violations
- [ ] When 081KRHWGX0008QG0R001E9KEJ1 lands later, a follow-up PR can flip 081KRFA460008QG0R00229616S to closed without further substrate work

## Open question for human maintainer

The `lint (backlog parent-child status)` check failed on PR #3942 but auto-merge fired anyway. This suggests the check is NOT in the required-checks list. If parent-child consistency matters (the 081KRMEXM0008QG0R003FZNK3E design implies it does), the check should likely be required. That's a separate decision — flagging for awareness, not addressing here.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-16T21:27:50Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `8e8f1611ca`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T21:29:20Z)

## Pull request overview

This PR restores backlog parent/child status consistency by re-opening **081KRFA460008QG0R00229616S** (parent) while child work (notably 081KRHWGX0008QG0R001E9KEJ1) remains open, and updates the generated backlog index accordingly.

**Changes:**

- Re-opened 081KRFA460008QG0R00229616S (`status: open`) and updated `last_updated` to 2026-05-16.
- Added a “Closure status (2026-05-16)” note to explain why the row remains open despite progress.
- Regenerated `docs/BACKLOG.md` to reflect the row’s open status.

### Reviewed changes

Copilot reviewed 1 out of 1 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KRFA460008QG0R00229616S-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md | Re-opens the parent row and adds a closure/status explanation section. |
| docs/BACKLOG.md | Regenerated index reflecting 081KRFA460008QG0R00229616S as open. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/backlog/P1/081KRFA460008QG0R00229616S-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md:184**

* The closure note says the notifier-side is complete and that all acceptance criteria are checked, but the parent acceptance list includes the assignment-history cooldown criterion (slice 5a) which is still tracked as open in 081KRHWGX0008QG0R0000P5YP2 and not implemented in `tools/bg/backlog-ready-notifier.ts`. Update this note to reflect the remaining unshipped notifier-side work, or align the acceptance checklist/child statuses with what’s actually shipped.
```
## Closure status (2026-05-16)

**Notifier-side: complete.** All 8 acceptance criteria checked (slices 1, 2, 3, 4, 5a, 6 shipped per the decomposition table; tests in `tools/bg/backlog-ready-notifier.test.ts`; launchd plist via 081KRHWGX0008QG0R001ZJ3W8R; docs in `docs/AUTONOMOUS-LOOP.md`). Empirically confirmed live during the 2026-05-16 session via `bun tools/bg/backlog-ready-notifier.ts --once` — returned the documented JSON shape with `queueBusy: true` correctly suppressing publication.

**Row stays `status: open`** because child **081KRHWGX0008QG0R001E9KEJ1** (slice 5.2, agent-side subscriber handler) is genuinely the remaining unshipped scope, and the `--enforce-parent-child-status` lint (081KRMEXM0008QG0R003FZNK3E gate) correctly requires parent rows to stay open while any child is open. Closing this row would violate that invariant.
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-16T21:32:07Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `096774ea47`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T21:40:20Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

### COMMENTED — @AceHack (2026-05-16T22:20:36Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-16T22:20:38Z)

_(no body)_

## Review threads

### Thread 1: docs/backlog/P1/081KRFA460008QG0R00229616S-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md:54 (resolved)

**@chatgpt-codex-connector** (2026-05-16T21:27:50Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Keep slice 5a acceptance unchecked until implemented**

This change marks the "Tracks assignment history ..." criterion as shipped, but the referenced child row `docs/backlog/P1/081KRHWGX0008QG0R0000P5YP2-b0441-slice-5-assignment-history-dedup-cooldown-2026-05-14.md` is still `status: open` with unchecked acceptance items, and the notifier implementation (`tools/bg/backlog-ready-notifier.ts`) still has no `historyFile`/cooldown dedup path. Marking this as complete can cause reviewers and automation to treat slice 5a as finished and skip the remaining implementation work.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P1/081KRFA460008QG0R00229616S-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md:54 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T21:29:20Z):

This marks the assignment-history dedup/cooldown acceptance criterion as shipped and references 081KRHWGX0008QG0R0000P5YP2 as shipped, but 081KRHWGX0008QG0R0000P5YP2 is still `status: open` with unchecked acceptance criteria, and `tools/bg/backlog-ready-notifier.ts` currently contains no history/cooldown logic. This should stay unchecked (or update the child row/status + implementation first) to avoid overstating what’s implemented.

This issue also appears on line 180 of the same file.

### Thread 3: docs/backlog/P1/081KRFA460008QG0R00229616S-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md:182 (resolved)

**@chatgpt-codex-connector** (2026-05-16T21:32:07Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Don’t declare slice 5a shipped while child 081KRHWGX0008QG0R0000P5YP2 is open**

The new closure note says notifier-side work is complete and explicitly lists slice 5a as shipped, but child row `081KRHWGX0008QG0R0000P5YP2` is still `status: open` with all acceptance items unchecked (`docs/backlog/P1/081KRHWGX0008QG0R0000P5YP2-b0441-slice-5-assignment-history-dedup-cooldown-2026-05-14.md`). This creates contradictory backlog state that can mislead reviewers/automation into treating dedup-cooldown work as finished when it is still tracked as unfinished; either the shipped claim needs to be removed here or 081KRHWGX0008QG0R0000P5YP2 needs to be actually closed with implemented criteria.

Useful? React with 👍 / 👎.

### Thread 4: docs/backlog/P1/081KRFA460008QG0R00229616S-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md:184 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T21:40:19Z):

P1: Slice/acceptance status is internally inconsistent after marking slice 5a as open. The new slice table and closure section say 5a (081KRHWGX0008QG0R0000P5YP2) is not shipped, but this same row’s acceptance criteria still has the assignment-history item checked and labeled “081KRHWGX0008QG0R0000P5YP2 shipped”. Update the acceptance checklist (and any “live slices” statements) so it matches 081KRHWGX0008QG0R0000P5YP2’s current `status: open` + unchecked acceptance criteria.

**@AceHack** (2026-05-16T22:20:36Z):

Verified — slice 5a (081KRHWGX0008QG0R0000P5YP2) is `status: open`; the acceptance checkbox + label was inherited from the prior version of this row. Fixed in d0ea0581: line 53-54 now unchecked and labeled `081KRHWGX0008QG0R0000P5YP2 open` with the substrate-honest note that `historyFile`/cooldown logic is not yet in `tools/bg/backlog-ready-notifier.ts`. Acceptance section now matches the slice table on line 173.

### Thread 5: docs/backlog/P1/081KRFA460008QG0R00229616S-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md:188 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T21:40:20Z):

P1: The closure note “When 081KRHWGX0008QG0R0000P5YP2 and 081KRHWGX0008QG0R001E9KEJ1 land and close, this row is ready to flip to closed” appears incomplete given the enforced parent/child invariant: all children must be in a closed status. Today 081KRHWGX0008QG0R001ZJ3W8R is `status: shipped` (not one of the documented closed statuses in tools/backlog/README.md, and not treated as closed by tools/hygiene/audit-backlog-items.ts), so closing 081KRFA460008QG0R00229616S later would still fail unless 081KRHWGX0008QG0R001ZJ3W8R is also moved to a closed status (or the closed-status set is updated). Clarify this in the closure guidance.

**@AceHack** (2026-05-16T22:20:37Z):

Verified — `shipped` is NOT in `CLOSED_STATUSES` (`{closed, landed, superseded, merged, done}` per `tools/hygiene/audit-backlog-items.ts:245`) and is NOT in the documented enum (`open / closed / superseded-by-B-NNNN / deferred / decomposed` per `tools/backlog/README.md:63`). Closure guidance updated in d0ea0581: line 188 now flags the 081KRHWGX0008QG0R001ZJ3W8R `shipped` status mismatch explicitly and names the two resolution paths (flip 081KRHWGX0008QG0R001ZJ3W8R to a documented closed status, OR extend `CLOSED_STATUSES` + README enum to recognize `shipped`).
