---
pr_number: 3098
title: "docs(b-0258): document ordering/formatting contract; close 081KR2E4K0008QG0R001E27DDV"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T05:06:53Z"
merged_at: "2026-05-14T05:21:45Z"
closed_at: "2026-05-14T05:21:45Z"
head_ref: "feat/b0258-document-ordering-formatting-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T06:42:37Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3098: docs(b-0258): document ordering/formatting contract; close 081KR2E4K0008QG0R001E27DDV

## PR description

## Summary

- Closes 081KR2E4K0008QG0R001E27DDV (MEMORY.md index generator implementation, P1)
- The generator itself was already shipped under 081KRCQQF0008QG0R0037YYP1A (`tools/memory/reindex-memory-md.ts`, PR #3004, merged 2026-05-13)
- The last open AC was *"Ordering and formatting are documented"*

## Changes

**`tools/memory/reindex-memory-md.ts`** — add three block-comment sections to the file header:

- `## Ordering` — sort key is `created` frontmatter field (ISO date, descending); filename-date fallback; `0000-00-00` bottom-bucket; ties broken by readdir order
- `## Formatting` — entry format: `- [**<name>**](<filename>) — <description>`; 240-char truncation; 100-entry cap with overflow note
- `## Stability` — same-day idempotence guarantee; `--check` exit codes (0 = current, 2 = stale)

**`docs/backlog/P1/081KR2E4K0008QG0R001E27DDV-*.md`** — `status: open → closed`; add pre-start checklist documenting prior-art search (found 081KRCQQF0008QG0R0037YYP1A implementation) and dependency confirmation (081KR2E4K0008QG0R001J0536V merged PR #3097)

## Test plan

- [x] `bun test tools/memory/reindex-memory-md.test.ts` — 18/18 pass
- [x] `dotnet build -c Release` — 0 warnings, 0 errors
- [x] `bun tools/memory/reindex-memory-md.ts --check` — exits 2 (STALE, 1202 entries); confirms the generator correctly detects drift
- [ ] No hook or CI wiring added (per 081KR2E4K0008QG0R001E27DDV AC)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T05:09:02Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `d77e288067`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-14T05:18:21Z)

_(no body)_

## Review threads

### Thread 1: tools/memory/reindex-memory-md.ts:30 (resolved)

**@chatgpt-codex-connector** (2026-05-14T05:09:02Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fix tie-break ordering claim in reindexer contract docs**

The new ordering contract says same-date ties are broken by lexicographic filename order, but `collectEntries` only sorts by `date` (`entries.sort((a, b) => b.date.localeCompare(a.date))`) and does not apply a filename comparator. In practice this leaves tie order dependent on `readdir` input order, so the documented guarantee is stronger than the implementation and can mislead anyone relying on reproducible ordering across environments.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-14T05:18:21Z):

Fixed in commits 38a670b (Aaron, same session) and cbb03e29 (this commit). The sort now uses a chained comparator: `b.date.localeCompare(a.date) || a.filename.localeCompare(b.filename)`, so same-date ties are broken by ascending lexicographic filename — matching the documented contract exactly. Comment + implementation are now consistent.
