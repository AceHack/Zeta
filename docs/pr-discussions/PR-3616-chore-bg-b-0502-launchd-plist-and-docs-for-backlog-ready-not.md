---
pr_number: 3616
title: "chore(bg): 081KRHWGX0008QG0R001ZJ3W8R launchd plist and docs for backlog-ready-notifier"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T22:58:14Z"
merged_at: "2026-05-15T23:30:51Z"
closed_at: "2026-05-15T23:30:51Z"
head_ref: "feat/b0502-launchd-plist"
base_ref: "main"
archived_at: "2026-05-16T00:14:11Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3616: chore(bg): 081KRHWGX0008QG0R001ZJ3W8R launchd plist and docs for backlog-ready-notifier

## PR description

Implements backlog row **081KRHWGX0008QG0R001ZJ3W8R** (Slice 6 of 081KRFA460008QG0R00229616S). Wires up the launchd plist for the  background service and updates the architecture documentation. Also updates the backlog row status tables to reflect that slices 3 and 5a have shipped.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T22:59:41Z)

## Pull request overview

Wires up slice 6 of 081KRFA460008QG0R00229616S (launchd plist + AUTONOMOUS-LOOP.md update for the backlog-ready-notifier background service) and brings backlog row status tables in line with what has now shipped (slices 3, 5a, and 6).

**Changes:**
- Adjust the maintainer comment in the new `com.zeta.backlog-ready-notifier.plist` to drop a reference to a non-existent `install-launchd-services.sh` and replace with manual path-update instructions.
- Update `tools/bg/README.md` "Current services" table to reflect newly-live slices for the backlog-ready notifier.
- Mark 081KRHWGX0008QG0R001ZJ3W8R as shipped (acceptance criteria boxes + frontmatter) and update 081KRFA460008QG0R00229616S's slice-status table to reflect 5a and 6 shipped.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| `.gemini/launchd/com.zeta.backlog-ready-notifier.plist` | Replaces reference to a non-existent install script with manual maintenance instructions. |
| `tools/bg/README.md` | Bumps backlog-ready-notifier slice-status entry. |
| `docs/backlog/P1/081KRHWGX0008QG0R001ZJ3W8R-...md` | Flips status to shipped and ticks acceptance boxes. |
| `docs/backlog/P1/081KRFA460008QG0R00229616S-...md` | Marks slices 5a (081KRHWGX0008QG0R0000P5YP2) and 6 (081KRHWGX0008QG0R001ZJ3W8R) as shipped in the parent row. |

### COMMENTED — @chatgpt-codex-connector (2026-05-15T22:59:52Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `76177bc375`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-15T23:28:31Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-15T23:28:32Z)

_(no body)_

## Review threads

### Thread 1: tools/bg/README.md:32 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T22:59:41Z):

The slice status here reads "1+2+3+4+5+6 live", but per the 081KRFA460008QG0R00229616S status table updated in this same PR, slice 5 for the backlog-ready-notifier is split: 5a (assignment-history dedup, 081KRHWGX0008QG0R0000P5YP2) is shipped, but 5.2 (agent-side `work-assignment` subscriber handler, 081KRHWGX0008QG0R001E9KEJ1) is still ❌ open. The shorthand "5" here implies the whole slice is live, which contradicts 081KRFA460008QG0R00229616S and the "What's still pending" section below (lines 88-92) that lists "Slice 5 for all three — subscriber agents that react to bus envelopes" as pending. Consider writing this as `1+2+3+4+5a+6 live (5.2 pending 081KRHWGX0008QG0R001E9KEJ1)` to match 081KRFA460008QG0R00229616S's substrate-honest framing.

**@AceHack** (2026-05-15T23:28:31Z):

Fixed in 6ef1b491 — line now reads `1+2+3+4+5a+6 live (5.2 pending 081KRHWGX0008QG0R001E9KEJ1)` per your suggested phrasing. Matches 081KRFA460008QG0R00229616S's substrate-honest framing (5a = assignment-history dedup 081KRHWGX0008QG0R0000P5YP2 shipped; 5.2 = `work-assignment` subscriber handler 081KRHWGX0008QG0R001E9KEJ1 still ❌) and stays consistent with the "What's still pending" section below.

### Thread 2: tools/bg/README.md:32 (resolved)

**@chatgpt-codex-connector** (2026-05-15T22:59:52Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Keep backlog-ready slice status aligned with pending 5.2**

Update this status to avoid overclaiming slice 5 as fully landed: this row now says `1+2+3+4+5+6 live`, but the same commit still records `5.2` (`work-assignment` subscriber handler) as open in `docs/backlog/P1/081KRFA460008QG0R00229616S-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md` (table row for slice 5.2). Marking full `+5` here can mislead operators into thinking the subscriber path is shipped and suppress follow-up on 081KRHWGX0008QG0R001E9KEJ1.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-15T23:28:32Z):

Fixed in 6ef1b491 — slice-5 status updated to `1+2+3+4+5a+6 live (5.2 pending 081KRHWGX0008QG0R001E9KEJ1)` so it no longer suggests the subscriber path is shipped. Keeps follow-up on 081KRHWGX0008QG0R001E9KEJ1 visible.
