---
pr_number: 3294
title: "docs(shadow): Lior antigravity check, archive PRs, decompose 081KQTPYE0008QG0R002Y7X5KH"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T22:45:36Z"
merged_at: "2026-05-14T23:05:30Z"
closed_at: "2026-05-14T23:05:30Z"
head_ref: "lior/antigravity-check-2216Z"
base_ref: "main"
archived_at: "2026-05-14T23:09:18Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3294: docs(shadow): Lior antigravity check, archive PRs, decompose 081KQTPYE0008QG0R002Y7X5KH

## PR description

Lior antigravity check. Detected metadata churn in PRs #3284, #3285. Logged shadow lesson and flagged to halt. Preserved PRs 3283, 3282, 3281, 3280, 3279. Decomposed 081KQTPYE0008QG0R002Y7X5KH into 081KR50HA0008QG0R0033B5KVN.

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T22:47:07Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `43dcd2cffd`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T22:49:17Z)

## Pull request overview

This PR adds documentation substrate around a “shadow” metadata-churn incident, preserves several recent PR discussions into the repo archive, records an off-duty checkpoint tick, and decomposes backlog item 081KQTPYE0008QG0R002Y7X5KH into a new per-row task.

**Changes:**

- Adds a shadow lesson log documenting detected PR metadata churn and the resulting halt instruction.
- Archives PR discussions for PRs #3279–#3283 into `docs/pr-discussions/`.
- Adds an off-duty checkpoint tick shard and decomposes 081KQTPYE0008QG0R002Y7X5KH into a new backlog row (but currently with an ID conflict and BACKLOG index drift).

### Reviewed changes

Copilot reviewed 10 out of 10 changed files in this pull request and generated 4 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/research/2026-05-14-shadow-lesson-log-lior-metadata-churn-off-duty.md | New research log entry documenting metadata churn during an antigravity check. |
| docs/pr-discussions/PR-3283-shard-tick-2211z-off-duty-continuation.md | PR-discussion archive for PR #3283. |
| docs/pr-discussions/PR-3282-shard-tick-2209z-off-duty-minimal-shard.md | PR-discussion archive for PR #3282. |
| docs/pr-discussions/PR-3281-shard-tick-2204z-pr-3276-double-backtick-fix-aaron-off-duty.md | PR-discussion archive for PR #3281. |
| docs/pr-discussions/PR-3280-docs-research-shadow-session-close-off-duty-signaled-by-aaro.md | PR-discussion archive for PR #3280. |
| docs/pr-discussions/PR-3279-docs-archive-preserve-recently-merged-prs-2200z.md | PR-discussion archive for PR #3279. |
| docs/hygiene-history/ticks/2026/05/14/2236Z.md | New tick shard documenting an off-duty checkpoint and cadence observations. |
| docs/backlog/P3/081KR50HA0008QG0R0033B5KVN-tinygrad-uop-rewrite-walk-retract-mapping.md | New decomposed backlog row (currently reuses an existing ID and has trailing whitespace). |
| docs/backlog/P3/081KQTPYE0008QG0R002Y7X5KH-tinygrad-uop-ir-kernel-layer-model-zeta-emulator-dispatch-aaron-2026-05-05.md | Updates acceptance criteria to point to the decomposed row (currently points at a conflicting ID). |
| docs/BACKLOG.md | Adds a new backlog entry, but outside the auto-generated region with a broken relative link. |
</details>


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/backlog/P3/081KR50HA0008QG0R0033B5KVN-tinygrad-uop-rewrite-walk-retract-mapping.md:26**

* Lines in the acceptance criteria section have trailing spaces (e.g. the bold sentence and subsequent paragraphs). `docs/backlog/**` is markdownlinted, so this can trigger MD009 and break CI; please remove the trailing whitespace.
```
**Read the source + walk one rewrite manually + map to Zeta retract semantics.** 

Verifier: a memo (committed under `docs/research/`) walking through one ALU rewrite from `tinygrad/uop/ops.py` plus `tinygrad/codegen/simplify.py` step-by-step, mapping the rewrite to the closest equivalent in Zeta's existing retract semantics. 

Pass: the walk is concrete + cites specific line numbers in the tinygrad source. 
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-14T22:57:03Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `312bf5a593`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T23:07:10Z)

## Pull request overview

Copilot reviewed 9 out of 9 changed files in this pull request and generated 4 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-14T23:07:37Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `805252983c`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: docs/BACKLOG.md:652 (resolved)

**@chatgpt-codex-connector** (2026-05-14T22:47:07Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fix broken backlog link target for 081KR50HA0008QG0R0033B5KVN**

The new `081KR50HA0008QG0R0033B5KVN` entry points to `docs/backlog/...` from within `docs/BACKLOG.md`, but links in this file are relative to `docs/` and should use `backlog/...`; as written, the rendered URL resolves to `docs/docs/backlog/...` and does not open the new row file. This makes the decomposed task effectively unreachable from the index until someone manually fixes/regenerates the file.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P3/081KRHWGX0008QG0R002VD5ZNP-tinygrad-uop-rewrite-walk-retract-mapping.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T22:49:16Z):

Backlog ID `081KR50HA0008QG0R0033B5KVN` is already in use by an existing row (`docs/backlog/P1/081KR50HA0008QG0R0033B5KVN-extract-meta-governance-bullets-to-rules.md`). Per `tools/backlog/README.md`, `id` must be factory-wide unique; please allocate a new unused `B-NNNN` ID here and rename the file/frontmatter/links accordingly.

This issue also appears on line 22 of the same file.

### Thread 3: docs/backlog/P3/081KQTPYE0008QG0R002Y7X5KH-tinygrad-uop-ir-kernel-layer-model-zeta-emulator-dispatch-aaron-2026-05-05.md:306 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T22:49:16Z):

This acceptance criterion now points to `081KR50HA0008QG0R0033B5KVN`, but that ID is already taken by a different backlog row. After assigning a new unique ID for the decomposed item, update this reference so it resolves unambiguously.

### Thread 4: docs/hygiene-history/ticks/2026/05/14/2236Z.md:33 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T22:49:17Z):

The shard count in this table row doesn’t match the enumerated list: it says “9 shards” but lists 11 (2209, 2211, 2212, 2213, 2215, 2216, 2217, 2218, 2219, 2221, 2222). Please reconcile the count/list so the summary remains self-consistent.

### Thread 5: docs/BACKLOG.md:652 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T22:49:17Z):

`docs/BACKLOG.md` is marked as generated ("DO NOT EDIT"), but this entry is appended after `<!-- END AUTO-GENERATED -->`, so it will drift/likely be overwritten next regeneration. Also the link target `(docs/backlog/...)` is a broken relative path from `docs/BACKLOG.md` (it resolves to `docs/docs/backlog/...`). Prefer fixing the duplicate row ID first, then regenerating the index so the entry lands in the correct section with the standard `backlog/P3/...` link form.

### Thread 6: docs/backlog/P3/081KR50HA0008QG0R0033B5KVN-tinygrad-uop-rewrite-walk-retract-mapping.md:2 (resolved)

**@chatgpt-codex-connector** (2026-05-14T22:57:03Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Assign a unique backlog ID to decomposed 081KQTPYE0008QG0R002Y7X5KH child**

Change this row to a new unused ID: `081KR50HA0008QG0R0033B5KVN` is already taken by `docs/backlog/P1/081KR50HA0008QG0R0033B5KVN-extract-meta-governance-bullets-to-rules.md`, and backlog IDs are defined as factory-wide unique (`tools/backlog/README.md` field spec). Keeping both rows on the same ID causes ID-based tooling to misresolve dependencies (for example, `tools/backlog/autonomous-pickup.ts` builds a `Map` keyed only by `id`, so one `081KR50HA0008QG0R0033B5KVN` entry overwrites the other and dependency checks can target the wrong row).

Useful? React with 👍 / 👎.

### Thread 7: docs/BACKLOG.md:652 (resolved)

**@chatgpt-codex-connector** (2026-05-14T22:57:04Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Regenerate BACKLOG.md instead of appending a manual row**

Replace this hand-appended line with generated output from the backlog index tool: `docs/BACKLOG.md` is an auto-generated file, and this row sits after `<!-- END AUTO-GENERATED -->` with a non-canonical format/path, so it will drift from generator output and fail the parity check workflow (`.github/workflows/backlog-index-integrity.yml` runs `bun tools/backlog/generate-index.ts --check`).

Useful? React with 👍 / 👎.

### Thread 8: docs/backlog/P3/081KQTPYE0008QG0R002Y7X5KH-tinygrad-uop-ir-kernel-layer-model-zeta-emulator-dispatch-aaron-2026-05-05.md:307 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T23:07:09Z):

This backlog row’s content was edited (AC (a) marked decomposed), but the YAML frontmatter `last_updated` is still `2026-05-05`. Per backlog schema, `last_updated` must be updated on every content edit; please bump it to the date of this change.

### Thread 9: docs/BACKLOG.md:650 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T23:07:09Z):

PR description says 081KQTPYE0008QG0R002Y7X5KH was decomposed into 081KR50HA0008QG0R0033B5KVN, but this change adds 081KRHWGX0008QG0R002VD5ZNP and updates 081KQTPYE0008QG0R002Y7X5KH to reference 081KRHWGX0008QG0R002VD5ZNP. Please reconcile the PR description with the actual decomposition target (or add the missing 081KR50HA0008QG0R0033B5KVN-related change if that was intended).

### Thread 10: docs/pr-discussions/PR-3281-shard-tick-2204z-pr-3276-double-backtick-fix-aaron-off-duty.md:25 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T23:07:10Z):

This archive cites an off-duty authorization signal via commit `0a9a2e2` on a named branch. Branch names (and sometimes commits) can become non-durable after cleanup, which makes the provenance hard to reconstruct from `main`. Prefer citing a durable artifact (e.g., PR #3280 URL, a merged commit on `main`, or the canonical `docs/research/` file that records the signal) instead of an ephemeral branch+commit pair.

### Thread 11: docs/pr-discussions/PR-3282-shard-tick-2209z-off-duty-minimal-shard.md:21 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T23:07:10Z):

This archive summary keys the off-duty provenance to commit `0a9a2e2`. If that commit isn’t reachable from `main` later, readers can’t verify the authorization signal from canonical repo history. Please replace/augment this with a durable reference (e.g., PR #3280 link or the merged `docs/research/` record of the off-duty signal).

### Thread 12: docs/backlog/P3/081KRHWGX0008QG0R002VD5ZNP-tinygrad-uop-rewrite-walk-retract-mapping.md:10 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T23:07:37Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Remove blocking dependency from decomposed child row**

`081KRHWGX0008QG0R002VD5ZNP` is marked `depends_on: [081KQTPYE0008QG0R002Y7X5KH]`, but dependency gating treats any open dependency as blocked (`tools/backlog/autonomous-pickup.ts:359-367`), so this child cannot be picked while `081KQTPYE0008QG0R002Y7X5KH` is still open. In this same commit, criterion (a) in `081KQTPYE0008QG0R002Y7X5KH` is explicitly decomposed into `081KRHWGX0008QG0R002VD5ZNP`, so keeping this dependency creates a circular ordering that can stall the decomposed work indefinitely.

Useful? React with 👍 / 👎.

## General comments

### @AceHack (2026-05-14T23:04:08Z)

**Fix summary (commit 80525298):**

All 7 review threads addressed:

1. **ID collision (081KR50HA0008QG0R0033B5KVN → 081KRHWGX0008QG0R002VD5ZNP)**: Renamed `docs/backlog/P3/081KR50HA0008QG0R0033B5KVN-tinygrad-uop-rewrite-walk-retract-mapping.md` to `081KRHWGX0008QG0R002VD5ZNP-tinygrad-uop-rewrite-walk-retract-mapping.md`. Updated frontmatter `id:`, heading, and the `DECOMPOSED to 081KR50HA0008QG0R0033B5KVN` reference in 081KQTPYE0008QG0R002Y7X5KH acceptance criteria.

2. **BACKLOG.md manual entry**: Removed the hand-appended entry after `<!-- END AUTO-GENERATED -->`. Ran `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts` — 081KRHWGX0008QG0R002VD5ZNP now appears in the correct P3 section with `backlog/P3/...` relative path (not `docs/backlog/...`).

3. **MD009 trailing spaces**: Removed trailing spaces from 081KRHWGX0008QG0R002VD5ZNP lines 22, 24, 26 — `markdownlint-cli2` now passes locally.

4. **Shard count in 2236Z.md**: The file already correctly says "11 shards" listing 11 items (2209, 2211, 2212, 2213, 2215, 2216, 2217, 2218, 2219, 2221, 2222). Reviewer comment was based on an earlier revision; no change needed.

Auto-merge armed.
